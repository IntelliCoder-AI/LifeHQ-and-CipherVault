-- Apply resource bounds at the direct Data API boundary as well as the app API.
create function private.valid_tags(tags text[]) returns boolean
language sql immutable security invoker set search_path='' as $$
  select cardinality(tags)<=20 and coalesce(array_ndims(tags),1)=1
    and not exists(select 1 from unnest(tags) tag where tag is null or length(trim(tag)) not between 1 and 40);
$$;
revoke all on function private.valid_tags(text[]) from public,anon;
grant execute on function private.valid_tags(text[]) to authenticated;
alter table public.projects add constraint projects_valid_tags check(private.valid_tags(tags));
alter table public.goals add constraint goals_valid_tags check(private.valid_tags(tags));
alter table public.tasks add constraint tasks_valid_tags check(private.valid_tags(tags));
alter table public.events add constraint events_valid_tags check(private.valid_tags(tags));
alter table public.notes add constraint notes_valid_tags check(private.valid_tags(tags));
alter table public.profiles add constraint bounded_preferences
  check(jsonb_typeof(preferences)='object' and octet_length(preferences::text)<=100000);
alter table public.tasks add constraint bounded_task_recurrence
  check(recurrence is null or octet_length(recurrence::text)<=1024);
alter table public.events add constraint bounded_event_recurrence
  check(recurrence is null or octet_length(recurrence::text)<=1024);
