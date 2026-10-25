-- Durable ten-second undo window. No snapshots or secret-bearing trash copies.
create table private.pending_record_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_table text not null check (record_table in ('projects','tasks','task_occurrences','events','event_occurrences','goals','milestones','goal_entries','habits','habit_entries','notes','reviews')),
  record_id uuid not null,
  record_version integer not null check (record_version > 0),
  expires_at timestamptz not null default (clock_timestamp() + interval '10 seconds'),
  constraint unique_pending_record_deletion unique(user_id,record_table,record_id)
);
alter table private.pending_record_deletions enable row level security;
create policy owner on private.pending_record_deletions for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant usage on schema private to authenticated;
-- UPDATE privilege is also required for SELECT ... FOR UPDATE row locks.
grant select,insert,update,delete on private.pending_record_deletions to authenticated;
create index pending_record_deletions_owner_expiry on private.pending_record_deletions(user_id,expires_at);

create function public.schedule_record_deletion(entity text, record_id uuid, record_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); actual_version integer; pending private.pending_record_deletions;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if entity not in ('projects','tasks','task_occurrences','events','event_occurrences','goals','milestones','goal_entries','habits','habit_entries','notes','reviews') then raise exception 'Invalid record type'; end if;
  execute format('select version from public.%I where id=$1 and user_id=$2 for update',entity)
    into actual_version using record_id,uid;
  if actual_version is null or actual_version <> record_version then raise exception 'This record changed. Refresh before deleting.'; end if;
  insert into private.pending_record_deletions(user_id,record_table,record_id,record_version)
    values(uid,entity,record_id,record_version)
    on conflict on constraint unique_pending_record_deletion do nothing;
  select * into pending from private.pending_record_deletions q
    where q.user_id=uid and q.record_table=entity and q.record_id=schedule_record_deletion.record_id;
  return to_jsonb(pending)-'user_id';
end; $$;

create function public.undo_record_deletion(deletion_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from private.pending_record_deletions where id=deletion_id and user_id=auth.uid() and expires_at > clock_timestamp();
  if not found then raise exception 'The undo window has ended. Refresh your workspace.'; end if;
end; $$;

create function public.pending_record_deletions()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)-'user_id' order by q.expires_at),'[]'::jsonb)
  from private.pending_record_deletions q where q.user_id=auth.uid();
$$;

-- Finalized by workspace reads and record mutations, including the browser's expiry timer.
-- If a tab is closed, the next authenticated request completes expired deletions.
-- Version checks preserve records edited concurrently; FK cascades remain atomic.
create function public.finalize_record_deletions()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pending private.pending_record_deletions; affected integer; still_exists boolean; conflicts jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  for pending in select * from private.pending_record_deletions q
    where q.user_id=auth.uid() and q.expires_at <= clock_timestamp()
    order by q.expires_at limit 100 for update skip locked
  loop
    execute format('delete from public.%I where id=$1 and user_id=$2 and version=$3',pending.record_table)
      using pending.record_id,auth.uid(),pending.record_version;
    get diagnostics affected=row_count;
    if affected=0 then
      execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',pending.record_table)
        into still_exists using pending.record_id,auth.uid();
      if still_exists then conflicts:=conflicts || jsonb_build_array(pending.record_id); end if;
    end if;
    delete from private.pending_record_deletions where id=pending.id and user_id=auth.uid();
  end loop;
  return conflicts;
end; $$;
revoke all on function public.schedule_record_deletion(text,uuid,integer) from public;
revoke all on function public.undo_record_deletion(uuid) from public;
revoke all on function public.pending_record_deletions() from public;
revoke all on function public.finalize_record_deletions() from public;
grant execute on function public.schedule_record_deletion(text,uuid,integer),public.undo_record_deletion(uuid),public.pending_record_deletions(),public.finalize_record_deletions() to authenticated;

create function public.process_record_deletions()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare conflicts jsonb;
begin
  conflicts:=public.finalize_record_deletions();
  return jsonb_build_object('conflicts',conflicts,'pending',public.pending_record_deletions());
end; $$;
revoke all on function public.process_record_deletions() from public;
grant execute on function public.process_record_deletions() to authenticated;
