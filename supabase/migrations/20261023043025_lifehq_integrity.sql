-- Reject malformed recurrence objects even when SQL expressions evaluate to NULL.
create or replace function private.valid_recurrence(r jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if r is null then return true; end if;
 return coalesce(jsonb_typeof(r)='object' and r->>'frequency' in ('daily','weekly','monthly','yearly') and (r->>'interval')::integer between 1 and 52 and jsonb_typeof(r->'weekdays')='array' and jsonb_array_length(r->'weekdays')<=7 and not exists(select 1 from jsonb_array_elements_text(r->'weekdays') d where d::integer not between 1 and 7) and ((r->>'until') is null or (r->>'until')::date is not null),false);
exception when others then return false;
end; $$;
create function private.validate_schedule() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid schedule timezone'; end if;
 if new.recurrence is not null and (new.recurrence->>'until')::date < new.due_date then raise exception 'Recurrence ends before it starts'; end if;
 if tg_table_name='tasks' then
  if new.recurrence is not null and new.status='done' then raise exception 'Complete recurring occurrences in the planner'; end if;
  if new.parent_id is not null and exists(select 1 from public.tasks where id=new.parent_id and parent_id is not null) then raise exception 'Checklist items cannot contain nested checklists'; end if;
 end if;
 return new;
end; $$;
create trigger validate_schedule before insert or update on public.tasks for each row execute function private.validate_schedule();
create trigger validate_schedule before insert or update on public.events for each row execute function private.validate_schedule();
create function private.validate_progress_entry() returns trigger language plpgsql set search_path='' as $$
declare start_day date; zone text; current_day date; days integer[]; frequency text;
begin
 select coalesce(preferences->>'timezone','Asia/Kolkata') into zone from public.profiles where user_id=new.user_id;
 zone=coalesce(zone,'Asia/Kolkata');
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone='UTC'; end if;
 current_day=(now() at time zone zone)::date;
 if tg_table_name='habit_entries' then
  select start_date,weekdays,h.frequency into start_day,days,frequency from public.habits h where id=new.habit_id and user_id=new.user_id;
  if frequency='daily' and not (extract(isodow from new.date)::integer=any(days)) then raise exception 'Habit is not scheduled on this day'; end if;
 else
  select start_date into start_day from public.goals where id=new.goal_id and user_id=new.user_id;
 end if;
 if start_day is null or new.date<start_day or new.date>current_day then raise exception 'Progress date must be between the start date and today'; end if;
 return new;
end; $$;
create trigger validate_progress before insert or update on public.habit_entries for each row execute function private.validate_progress_entry();
create trigger validate_progress before insert or update on public.goal_entries for each row execute function private.validate_progress_entry();
