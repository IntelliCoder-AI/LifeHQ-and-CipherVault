-- Revoke still-valid access JWTs as soon as their Auth session is removed.
-- Not exposed by PostgREST. Read only the caller's session, never a supplied UID.
create function private.session_is_active() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.user_id=(select auth.uid())
      and s.id=case when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then (auth.jwt()->>'session_id')::uuid else null end
      and (s.not_after is null or s.not_after > now())
      and u.deleted_at is null and not coalesce(u.is_anonymous,false)
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.session_is_active() from public,anon;
grant execute on function private.session_is_active() to authenticated;

-- A restrictive policy also protects newly added permissive ownership policies.
-- The scalar subquery evaluates the session check once per statement, not per row.
do $$
declare item text;
begin
  foreach item in array array[
    'public.profiles','public.projects','public.tasks','public.events',
    'public.habits','public.goals','public.notes','public.milestones',
    'public.habit_entries','public.goal_entries','public.task_occurrences',
    'public.event_occurrences','public.reviews','public.activity',
    'private.pending_record_deletions'
  ] loop
    execute format('create policy active_session on %s as restrictive for all to authenticated using ((select private.session_is_active())) with check ((select private.session_is_active()))',item);
  end loop;
end; $$;

create or replace function private.erase_own_account() returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); fresh_password boolean:=false;
begin
  if not private.session_is_active() then raise exception 'Active session required'; end if;
  if jsonb_typeof(auth.jwt()->'amr')='array' then
    select exists (
      select 1 from jsonb_array_elements(auth.jwt()->'amr') entry
      where entry->>'method'='password'
        and case when (entry->>'timestamp') ~ '^[0-9]{1,12}$' then
          (entry->>'timestamp')::bigint between extract(epoch from now())-120 and extract(epoch from now())+60
          else false end
    ) into fresh_password;
  end if;
  if not fresh_password then raise exception 'Recent password sign-in required'; end if;
  delete from auth.users where id=uid;
end; $$;

-- Supabase can grant anon explicitly; revoking PUBLIC alone does not remove it.
revoke execute on function
  private.erase_own_account(),private.record_activity(),private.touch_record(),
  private.valid_recurrence(jsonb),private.validate_progress_entry(),private.validate_schedule(),
  public.delete_own_account(),public.finalize_record_deletions(),public.import_workspace(jsonb),
  public.pending_record_deletions(),public.process_record_deletions(),
  public.schedule_record_deletion(text,uuid,integer),public.undo_record_deletion(uuid)
from public,anon;
grant execute on function
  private.record_activity(),private.touch_record(),private.valid_recurrence(jsonb),
  private.validate_progress_entry(),private.validate_schedule()
to authenticated;
alter default privileges in schema public,private revoke execute on functions from public,anon;
