begin;

create table if not exists public.elo_households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'ELO Casal',
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.elo_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.elo_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (user_id),
  unique (household_id, user_id)
);

create table if not exists public.elo_state (
  household_id uuid primary key references public.elo_households(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.elo_is_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.elo_members m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.elo_is_member(uuid) from public;
grant execute on function public.elo_is_member(uuid) to authenticated;

alter table public.elo_households enable row level security;
alter table public.elo_members enable row level security;
alter table public.elo_state enable row level security;

drop policy if exists elo_households_select on public.elo_households;
create policy elo_households_select on public.elo_households
for select to authenticated
using (public.elo_is_member(id));

drop policy if exists elo_households_update on public.elo_households;
create policy elo_households_update on public.elo_households
for update to authenticated
using (public.elo_is_member(id))
with check (public.elo_is_member(id));

drop policy if exists elo_members_select on public.elo_members;
create policy elo_members_select on public.elo_members
for select to authenticated
using (public.elo_is_member(household_id));

drop policy if exists elo_members_update_self on public.elo_members;
create policy elo_members_update_self on public.elo_members
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists elo_state_select on public.elo_state;
create policy elo_state_select on public.elo_state
for select to authenticated
using (public.elo_is_member(household_id));

drop policy if exists elo_state_insert on public.elo_state;
create policy elo_state_insert on public.elo_state
for insert to authenticated
with check (public.elo_is_member(household_id));

drop policy if exists elo_state_update on public.elo_state;
create policy elo_state_update on public.elo_state
for update to authenticated
using (public.elo_is_member(household_id))
with check (public.elo_is_member(household_id));

create or replace function public.elo_create_household(
  p_name text default 'ELO Casal',
  p_display_name text default 'Pessoa 1'
)
returns table (household_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing uuid;
  v_household_id uuid;
  v_invite_code text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select m.household_id into v_existing
  from public.elo_members m
  where m.user_id = v_user_id
  limit 1;

  if v_existing is not null then
    return query
      select h.id, h.invite_code
      from public.elo_households h
      where h.id = v_existing;
    return;
  end if;

  insert into public.elo_households(name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'ELO Casal'), v_user_id)
  returning id, elo_households.invite_code into v_household_id, v_invite_code;

  insert into public.elo_members(household_id, user_id, display_name, role)
  values (
    v_household_id,
    v_user_id,
    coalesce(nullif(trim(p_display_name), ''), 'Pessoa 1'),
    'owner'
  );

  insert into public.elo_state(household_id, data, updated_by)
  values (v_household_id, '{}'::jsonb, v_user_id);

  return query select v_household_id, v_invite_code;
end;
$$;

create or replace function public.elo_join_household(
  p_invite_code text,
  p_display_name text default 'Pessoa 2'
)
returns table (household_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing uuid;
  v_household_id uuid;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select m.household_id into v_existing
  from public.elo_members m
  where m.user_id = v_user_id
  limit 1;

  if v_existing is not null then
    return query
      select h.id, h.invite_code
      from public.elo_households h
      where h.id = v_existing;
    return;
  end if;

  select h.id, h.invite_code into v_household_id, v_code
  from public.elo_households h
  where upper(h.invite_code) = upper(trim(p_invite_code))
  limit 1;

  if v_household_id is null then
    raise exception 'Código de convite inválido';
  end if;

  insert into public.elo_members(household_id, user_id, display_name, role)
  values (
    v_household_id,
    v_user_id,
    coalesce(nullif(trim(p_display_name), ''), 'Pessoa 2'),
    'member'
  );

  return query select v_household_id, v_code;
end;
$$;

revoke all on function public.elo_create_household(text, text) from public;
revoke all on function public.elo_join_household(text, text) from public;
grant execute on function public.elo_create_household(text, text) to authenticated;
grant execute on function public.elo_join_household(text, text) to authenticated;

create or replace function public.elo_touch_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists elo_state_touch on public.elo_state;
create trigger elo_state_touch
before update on public.elo_state
for each row execute function public.elo_touch_state();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'elo_state'
  ) then
    alter publication supabase_realtime add table public.elo_state;
  end if;
end $$;

commit;
