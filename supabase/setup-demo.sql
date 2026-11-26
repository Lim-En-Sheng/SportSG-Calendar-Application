-- Coach Calendar: temporary unauthenticated demo. Expires 10 December 2026 UTC.
-- Run in Supabase SQL Editor. Does not touch other application tables.
begin;
create schema if not exists coach_calendar_private;
revoke all on schema coach_calendar_private from public, anon, authenticated;
create table if not exists public.coach_calendar_revision (
  id integer primary key check (id = 1),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.coach_calendar_revision(id) values(1) on conflict do nothing;
alter table public.coach_calendar_revision enable row level security;
revoke all on public.coach_calendar_revision from anon, authenticated;
grant select on public.coach_calendar_revision to anon, authenticated;
drop policy if exists demo_revision_read on public.coach_calendar_revision;
create policy demo_revision_read on public.coach_calendar_revision for select to anon, authenticated
  using (now() < timestamptz '2026-12-10 00:00:00+00');

-- One row per entity (or per coach/month for keyed state). JSON retains exact
-- hourly evidence while indexed generated columns support SQL joins/reports.
do $$
declare table_name text;
begin
  foreach table_name in array array['sessions','coaches','assignments','availability','availabilitySlots','availabilitySubmissions','attendance','drafts','submissions','resolutions','finalised','requests','audit'] loop
    execute format('create table if not exists coach_calendar_private.%I (id text primary key, position integer not null default 0, data jsonb not null)', table_name);
    execute format('alter table coach_calendar_private.%I enable row level security', table_name);
    execute format('revoke all on coach_calendar_private.%I from public, anon, authenticated', table_name);
  end loop;
end $$;
alter table coach_calendar_private.sessions add column if not exists programme_name text generated always as (data->>'title') stored;
alter table coach_calendar_private.sessions add column if not exists session_date text generated always as (data->>'date') stored;
alter table coach_calendar_private.coaches add column if not exists coach_name text generated always as (data->>'name') stored;
alter table coach_calendar_private.assignments add column if not exists session_id text generated always as (data->>'sessionId') stored;
alter table coach_calendar_private.assignments add column if not exists coach_id text generated always as (data->>'coachId') stored;
create index if not exists cc_session_date on coach_calendar_private.sessions(session_date);
create index if not exists cc_assignment_session on coach_calendar_private.assignments(session_id);
create index if not exists cc_assignment_coach on coach_calendar_private.assignments(coach_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='cc_assignment_session_fk') then
    alter table coach_calendar_private.assignments add constraint cc_assignment_session_fk foreign key(session_id) references coach_calendar_private.sessions(id) deferrable initially deferred;
    alter table coach_calendar_private.assignments add constraint cc_assignment_coach_fk foreign key(coach_id) references coach_calendar_private.coaches(id) deferrable initially deferred;
  end if;
end $$;

create or replace function public.coach_calendar_read() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_revision bigint; result jsonb; table_name text; part jsonb;
begin
  if now() >= timestamptz '2026-12-10 00:00:00+00' then raise exception 'Demo access expired. Configure authenticated access.' using errcode='42501'; end if;
  -- Shared lock prevents a mixed snapshot while a save updates several tables.
  select revision into current_revision from public.coach_calendar_revision where id=1 for share;
  if current_revision=0 then return jsonb_build_object('revision',0,'state',null); end if;
  result := '{"schema":1,"legacyDemoRemoved":true}'::jsonb;
  foreach table_name in array array['sessions','coaches','assignments','submissions','requests','audit'] loop
    execute format('select coalesce(jsonb_agg(data order by position), ''[]''::jsonb) from coach_calendar_private.%I',table_name) into part;
    result := result || jsonb_build_object(table_name,part);
  end loop;
  foreach table_name in array array['availability','availabilitySlots','availabilitySubmissions','attendance','drafts','resolutions','finalised'] loop
    execute format('select coalesce(jsonb_object_agg(id,data), ''{}''::jsonb) from coach_calendar_private.%I',table_name) into part;
    result := result || jsonb_build_object(table_name,part);
  end loop;
  return jsonb_build_object('revision',current_revision,'state',result);
end $$;

create or replace function public.coach_calendar_save(expected_revision bigint, next_state jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_revision bigint; table_name text; items jsonb; id_expression text;
begin
  if now() >= timestamptz '2026-12-10 00:00:00+00' then raise exception 'Demo access expired. Configure authenticated access.' using errcode='42501'; end if;
  if expected_revision is null or expected_revision < 0 then raise exception 'Invalid revision'; end if;
  select revision into current_revision from public.coach_calendar_revision where id=1 for update;
  if current_revision <> expected_revision then raise exception 'Another workstation changed the demo. Review the latest data and try again.' using errcode='40001'; end if;
  if next_state is null or next_state->>'schema' is distinct from '1' or octet_length(next_state::text)>5000000 then raise exception 'Invalid or oversized demo data (maximum 5 MB).'; end if;
  foreach table_name in array array['sessions','coaches','assignments','submissions','requests','audit'] loop
    items := next_state->table_name;
    if jsonb_typeof(items) is distinct from 'array' then raise exception 'Invalid array: %',table_name; end if;
    if table_name='coaches' and jsonb_array_length(items)=0 then raise exception 'At least one coach is required'; end if;
    if exists(select 1 from jsonb_array_elements(items) e where jsonb_typeof(e) <> 'object') then raise exception 'Invalid record in %',table_name; end if;
    -- Arrays with IDs preserve identity; submissions/audit preserve exact history order.
    id_expression := case when table_name in ('sessions','coaches','assignments','requests') then 'value->>''id''' else 'ordinality::text' end;
    execute format('insert into coach_calendar_private.%I as target (id,position,data) select %s, ordinality::integer, value from jsonb_array_elements($1) with ordinality on conflict(id) do update set position=excluded.position,data=excluded.data where target.data is distinct from excluded.data or target.position <> excluded.position',table_name,id_expression) using items;
    execute format('delete from coach_calendar_private.%I where id not in (select %s from jsonb_array_elements($1) with ordinality)',table_name,id_expression) using items;
  end loop;
  foreach table_name in array array['availability','availabilitySlots','availabilitySubmissions','attendance','drafts','resolutions','finalised'] loop
    items := coalesce(next_state->table_name,'{}'::jsonb);
    if jsonb_typeof(items) is distinct from 'object' then raise exception 'Invalid object: %',table_name; end if;
    execute format('insert into coach_calendar_private.%I as target (id,data) select key,value from jsonb_each($1) on conflict(id) do update set data=excluded.data where target.data is distinct from excluded.data',table_name) using items;
    execute format('delete from coach_calendar_private.%I where id not in (select key from jsonb_each($1))',table_name) using items;
  end loop;
  update public.coach_calendar_revision set revision=current_revision+1,updated_at=now() where id=1;
  return public.coach_calendar_read();
end $$;
revoke all on function public.coach_calendar_read() from public;
revoke all on function public.coach_calendar_save(bigint,jsonb) from public;
grant execute on function public.coach_calendar_read() to anon, authenticated;
grant execute on function public.coach_calendar_save(bigint,jsonb) to anon, authenticated;
-- Only revision updates need Realtime publication; readers fetch an atomic snapshot.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='coach_calendar_revision') then
    alter publication supabase_realtime add table public.coach_calendar_revision;
  end if;
end $$;
commit;
