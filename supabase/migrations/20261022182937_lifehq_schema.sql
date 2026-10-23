-- LifeHQ owns this fresh Supabase project. CipherVault has no tables or network integration.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.valid_recurrence(r jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if r is null then return true; end if;
 return jsonb_typeof(r)='object' and r->>'frequency' in ('daily','weekly','monthly','yearly') and (r->>'interval')::integer between 1 and 52 and jsonb_typeof(r->'weekdays')='array' and jsonb_array_length(r->'weekdays')<=7 and not exists(select 1 from jsonb_array_elements_text(r->'weekdays') d where d::integer not between 1 and 7) and ((r->>'until') is null or (r->>'until')::date is not null);
exception when others then return false;
end; $$;
revoke all on function private.valid_recurrence(jsonb) from public;
grant execute on function private.valid_recurrence(jsonb) to authenticated;
create function private.touch_record() returns trigger language plpgsql set search_path='' as $$
begin
 if new.user_id<>old.user_id or new.id<>old.id then raise exception 'Record ownership is immutable'; end if;
 new.updated_at=now(); new.created_at=old.created_at; new.version=old.version+1; return new;
end; $$;
create table public.profiles (user_id uuid primary key references auth.users(id) on delete cascade, preferences jsonb not null default '{}', updated_at timestamptz not null default now());
alter table public.profiles enable row level security;
create policy owner on public.profiles for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.profiles to authenticated;

create table public.projects (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), title text not null check(length(trim(title)) between 1 and 200), description text not null default '' check(length(description)<=50000), status text not null default 'active' check(status in ('active','paused','completed','archived')), due_date date, color text not null default 'forest' check(color in ('forest','copper','ink','sage')), tags text[] not null default '{}' check(cardinality(tags)<=20));
alter table public.projects enable row level security;
create policy owner on public.projects for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.projects to authenticated;
create index projects_owner on public.projects(user_id,updated_at desc);
create trigger touch_record before update on public.projects for each row execute function private.touch_record();

create table public.habits (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), title text not null check(length(trim(title)) between 1 and 200), description text not null default '' check(length(description)<=50000), frequency text not null default 'daily' check(frequency in ('daily','weekly')), weekdays integer[] not null default '{1,2,3,4,5,6,7}' check(cardinality(weekdays) between 1 and 7 and weekdays <@ ARRAY[1,2,3,4,5,6,7]), weekly_target integer not null default 3 check(weekly_target between 1 and 7), start_date date not null, color text not null default 'forest', archived boolean not null default false);
alter table public.habits enable row level security;
create policy owner on public.habits for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.habits to authenticated;
create index habits_owner on public.habits(user_id,updated_at desc);
create trigger touch_record before update on public.habits for each row execute function private.touch_record();

create table public.goals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), title text not null check(length(trim(title)) between 1 and 200), description text not null default '' check(length(description)<=50000), measurement text not null default 'count' check(measurement in ('count','percent','milestones','actions')), target numeric not null default 100 check(target>0 and target<=1000000000), unit text not null default 'units' check(length(unit)<=40), start_date date not null, due_date date check(due_date>=start_date), project_id uuid, habit_id uuid, archived boolean not null default false, tags text[] not null default '{}' check(cardinality(tags)<=20), foreign key(project_id,user_id) references public.projects(id,user_id) on delete cascade, foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade);
alter table public.goals enable row level security;
create policy owner on public.goals for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.goals to authenticated;
create index goals_owner on public.goals(user_id,updated_at desc);
create trigger touch_record before update on public.goals for each row execute function private.touch_record();

create table public.tasks (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), title text not null check(length(trim(title)) between 1 and 200), description text not null default '' check(length(description)<=50000), status text not null default 'todo' check(status in ('todo','doing','done')), priority text not null default 'medium' check(priority in ('low','medium','high','urgent')), due_date date, start_time text check(start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), duration integer not null default 30 check(duration between 5 and 1440), timezone text not null default 'Asia/Kolkata', recurrence jsonb check(private.valid_recurrence(recurrence)), reminder_minutes integer check(reminder_minutes between 0 and 10080), check(recurrence is null or due_date is not null), project_id uuid, parent_id uuid, category text not null default 'Personal' check(length(category)<=80), tags text[] not null default '{}' check(cardinality(tags)<=20), completed_at timestamptz, check(parent_id is distinct from id), foreign key(project_id,user_id) references public.projects(id,user_id) on delete cascade, foreign key(parent_id,user_id) references public.tasks(id,user_id) on delete cascade);
alter table public.tasks enable row level security;
create policy owner on public.tasks for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.tasks to authenticated;
create index tasks_owner on public.tasks(user_id,updated_at desc);
create trigger touch_record before update on public.tasks for each row execute function private.touch_record();

create table public.events (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), title text not null check(length(trim(title)) between 1 and 200), description text not null default '' check(length(description)<=50000), due_date date, start_time text check(start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), duration integer not null default 30 check(duration between 5 and 1440), timezone text not null default 'Asia/Kolkata', recurrence jsonb check(private.valid_recurrence(recurrence)), reminder_minutes integer check(reminder_minutes between 0 and 10080), check(recurrence is null or due_date is not null), location text not null default '' check(length(location)<=200), tags text[] not null default '{}' check(cardinality(tags)<=20), check(due_date is not null));
alter table public.events enable row level security;
create policy owner on public.events for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.events to authenticated;
create index events_owner on public.events(user_id,updated_at desc);
create trigger touch_record before update on public.events for each row execute function private.touch_record();

create table public.notes (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), title text not null check(length(trim(title)) between 1 and 200), content text not null default '' check(length(content)<=50000), folder text not null default 'Inbox' check(length(folder)<=80), tags text[] not null default '{}' check(cardinality(tags)<=20), pinned boolean not null default false, favorite boolean not null default false, project_id uuid, foreign key(project_id,user_id) references public.projects(id,user_id) on delete cascade);
alter table public.notes enable row level security;
create policy owner on public.notes for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.notes to authenticated;
create index notes_owner on public.notes(user_id,updated_at desc);
create trigger touch_record before update on public.notes for each row execute function private.touch_record();

create table public.milestones (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), title text not null check(length(trim(title)) between 1 and 200), goal_id uuid, project_id uuid, completed boolean not null default false, due_date date, check((goal_id is null) <> (project_id is null)), foreign key(goal_id,user_id) references public.goals(id,user_id) on delete cascade, foreign key(project_id,user_id) references public.projects(id,user_id) on delete cascade);
alter table public.milestones enable row level security;
create policy owner on public.milestones for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.milestones to authenticated;
create index milestones_owner on public.milestones(user_id,updated_at desc);
create trigger touch_record before update on public.milestones for each row execute function private.touch_record();

create table public.habit_entries (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), habit_id uuid not null, date date not null, unique(habit_id,date), foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade);
alter table public.habit_entries enable row level security;
create policy owner on public.habit_entries for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.habit_entries to authenticated;
create index habit_entries_owner on public.habit_entries(user_id,updated_at desc);
create trigger touch_record before update on public.habit_entries for each row execute function private.touch_record();

create table public.goal_entries (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), goal_id uuid not null, date date not null, value numeric not null check(value between 0 and 1000000000), note text not null default '' check(length(note)<=2000), foreign key(goal_id,user_id) references public.goals(id,user_id) on delete cascade);
alter table public.goal_entries enable row level security;
create policy owner on public.goal_entries for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.goal_entries to authenticated;
create index goal_entries_owner on public.goal_entries(user_id,updated_at desc);
create trigger touch_record before update on public.goal_entries for each row execute function private.touch_record();

create table public.task_occurrences (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), task_id uuid not null, occurrence_date date not null, scheduled_date date not null, status text not null default 'todo' check(status in ('todo','doing','done')), start_time text check(start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), completed_at timestamptz, unique(task_id,occurrence_date), foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade);
alter table public.task_occurrences enable row level security;
create policy owner on public.task_occurrences for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.task_occurrences to authenticated;
create index task_occurrences_owner on public.task_occurrences(user_id,updated_at desc);
create trigger touch_record before update on public.task_occurrences for each row execute function private.touch_record();

create table public.event_occurrences (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), event_id uuid not null, occurrence_date date not null, scheduled_date date not null, start_time text check(start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), cancelled boolean not null default false, unique(event_id,occurrence_date), foreign key(event_id,user_id) references public.events(id,user_id) on delete cascade);
alter table public.event_occurrences enable row level security;
create policy owner on public.event_occurrences for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.event_occurrences to authenticated;
create index event_occurrences_owner on public.event_occurrences(user_id,updated_at desc);
create trigger touch_record before update on public.event_occurrences for each row execute function private.touch_record();

create table public.reviews (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1 check(version > 0), unique(id,user_id), title text not null check(length(trim(title)) between 1 and 200), period text not null check(period in ('daily','weekly')), date date not null, content text not null default '' check(length(content)<=50000));
alter table public.reviews enable row level security;
create policy owner on public.reviews for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.reviews to authenticated;
create index reviews_owner on public.reviews(user_id,updated_at desc);
create trigger touch_record before update on public.reviews for each row execute function private.touch_record();
create index tasks_project_id_owner on public.tasks(project_id,user_id);
create index tasks_parent_id_owner on public.tasks(parent_id,user_id);
create index notes_project_id_owner on public.notes(project_id,user_id);
create index goals_project_id_owner on public.goals(project_id,user_id);
create index goals_habit_id_owner on public.goals(habit_id,user_id);
create index milestones_goal_id_owner on public.milestones(goal_id,user_id);
create index milestones_project_id_owner on public.milestones(project_id,user_id);
create index habit_entries_habit_id_owner on public.habit_entries(habit_id,user_id);
create index goal_entries_goal_id_owner on public.goal_entries(goal_id,user_id);
create index task_occurrences_task_id_owner on public.task_occurrences(task_id,user_id);
create index event_occurrences_event_id_owner on public.event_occurrences(event_id,user_id);

create index tasks_due on public.tasks(user_id,due_date);
create index events_due on public.events(user_id,due_date);
create table public.activity (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, entity text not null, entity_id uuid not null, action text not null, occurred_at timestamptz not null default now());
alter table public.activity enable row level security;
create policy owner_read on public.activity for select to authenticated using((select auth.uid())=user_id);
create policy owner_insert on public.activity for insert to authenticated with check((select auth.uid())=user_id);
grant select,insert on public.activity to authenticated;
grant usage on sequence public.activity_id_seq to authenticated;
create index activity_owner on public.activity(user_id,occurred_at desc);
create function private.record_activity() returns trigger language plpgsql set search_path='' as $$
begin
 insert into public.activity(user_id,entity,entity_id,action) values(coalesce(new.user_id,old.user_id),tg_table_name,coalesce(new.id,old.id),lower(tg_op));
 return coalesce(new,old);
end; $$;
create trigger record_activity after insert or update on public.projects for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.habits for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.goals for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.tasks for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.events for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.notes for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.milestones for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.habit_entries for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.goal_entries for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.task_occurrences for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.event_occurrences for each row execute function private.record_activity();
create trigger record_activity after insert or update on public.reviews for each row execute function private.record_activity();

-- Explicit self-service account erasure. Never accepts a target user ID.
create function private.erase_own_account() returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from auth.sessions where user_id=uid and id=(auth.jwt()->>'session_id')::uuid) then raise exception 'Active session required'; end if;
 delete from auth.users where id=uid;
end; $$;
revoke all on function private.erase_own_account() from public;
grant execute on function private.erase_own_account() to authenticated;
create function public.delete_own_account() returns void language sql security invoker set search_path='' as $$select private.erase_own_account();$$;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
