-- Additive JSON import. Authenticated callers can only insert into their own workspace.
-- Every insert (and an optional preferences update) succeeds or rolls back together.
create function public.import_workspace(payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); entity text; item jsonb; records jsonb; prefs jsonb; total integer:=0;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(payload->'data') is distinct from 'object' or octet_length(payload::text)>5242880 then raise exception 'Invalid import payload'; end if;
  for entity in select jsonb_object_keys(payload->'data') loop
    if entity not in ('projects','habits','goals','tasks','events','notes','milestones','habit_entries','goal_entries','task_occurrences','event_occurrences','reviews') then raise exception 'Unknown record type'; end if;
    if jsonb_typeof(payload->'data'->entity)<>'array' then raise exception 'Invalid record list'; end if;
    total:=total+jsonb_array_length(payload->'data'->entity);
  end loop;
  if total>2000 then raise exception 'Import at most 2000 records at a time'; end if;
  prefs:=nullif(payload->'preferences','null'::jsonb);
  if prefs is not null then
    if jsonb_typeof(prefs)<>'object' or octet_length(prefs::text)>100000 then raise exception 'Invalid preferences'; end if;
    insert into public.profiles(user_id,preferences,updated_at) values(uid,prefs,clock_timestamp())
      on conflict(user_id) do update set preferences=excluded.preferences,updated_at=excluded.updated_at;
  end if;
  foreach entity in array array['projects','habits','goals','tasks','events','notes','milestones','habit_entries','goal_entries','task_occurrences','event_occurrences','reviews'] loop
    records:=coalesce(payload->'data'->entity,'[]'::jsonb);
    for item in select value from jsonb_array_elements(records) loop
      if jsonb_typeof(item)<>'object' then raise exception 'Invalid record'; end if;
      item:=item || jsonb_build_object('user_id',uid,'version',1,'created_at',clock_timestamp(),'updated_at',clock_timestamp());
      execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).*',entity,entity) using item;
    end loop;
  end loop;
  return jsonb_build_object('imported',total);
end; $$;
revoke all on function public.import_workspace(jsonb) from public,anon;
grant execute on function public.import_workspace(jsonb) to authenticated;
