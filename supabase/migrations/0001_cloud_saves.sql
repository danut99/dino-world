-- Dino Realms: one cloud save per player.
-- Run once in Supabase → SQL Editor (or `supabase db push` with the Supabase CLI).

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The whole game state, exactly as the game stores it locally (see Save in src/realms/game.ts).
  data jsonb not null,
  schema_version integer not null,
  updated_at timestamptz not null default now()
);

-- A save is at most a few hundred kilobytes; refuse anything far larger.
alter table public.saves drop constraint if exists saves_data_size;
alter table public.saves add constraint saves_data_size check (pg_column_size(data) < 2000000);

-- The server stamps every write, so a device's clock never decides which save is newer.
create or replace function public.saves_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before insert or update on public.saves
  for each row execute function public.saves_touch();

-- Row level security: a signed-in player reads and writes only their own row.
alter table public.saves enable row level security;

drop policy if exists "read own save" on public.saves;
create policy "read own save" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "create own save" on public.saves;
create policy "create own save" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "update own save" on public.saves;
create policy "update own save" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
