-- Dino Realms: player names, the player list, and visiting other players' worlds (read only).
-- Run once in Supabase → SQL Editor, after 0001_cloud_saves.sql.

-- Every player picks a public name when creating the account. The e-mail address is never shown to others.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint profiles_name_format check (
    char_length(name) between 3 and 20
    and name ~ '^[A-Za-z0-9ĂÂÎȘȚŞŢăâîșțşţ][A-Za-z0-9ĂÂÎȘȚŞŢăâîșțşţ _.-]*$'
  )
);
-- Names are unique regardless of capitals ("Ignis" and "ignis" are the same name).
create unique index if not exists profiles_name_unique on public.profiles (lower(name));

alter table public.profiles enable row level security;

drop policy if exists "players read names" on public.profiles;
create policy "players read names" on public.profiles
  for select to authenticated using (true);

drop policy if exists "create own name" on public.profiles;
create policy "create own name" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "rename self" on public.profiles;
create policy "rename self" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Signed-in players may look at (never change) each other's saves, to visit their worlds.
-- Writing stays limited to one's own save (policies from 0001).
drop policy if exists "read own save" on public.saves;
drop policy if exists "players view saves" on public.saves;
create policy "players view saves" on public.saves
  for select to authenticated using (true);

-- The player list: name and a short summary of each world, without sending whole saves.
-- security_invoker: the view obeys the row level security of the tables it reads.
create or replace view public.players with (security_invoker = true) as
select
  p.user_id,
  p.name,
  s.updated_at,
  coalesce(jsonb_array_length(s.data -> 'dinos'), 0) as dinos,
  coalesce((select sum(v::int) from jsonb_each_text(coalesce(s.data -> 'stars', '{}'::jsonb)) as t (k, v)), 0)::int as stars,
  coalesce((select count(*) from jsonb_object_keys(coalesce(s.data -> 'habitats', '{}'::jsonb))), 0)::int as worlds,
  c.dino ->> 'species' as species,
  c.dino ->> 'element' as element,
  c.dino ->> 'stage' as stage,
  coalesce((c.dino ->> 'level')::int, 0) as level
from public.profiles p
left join public.saves s on s.user_id = p.user_id
left join lateral (
  select d as dino from jsonb_array_elements(coalesce(s.data -> 'dinos', '[]'::jsonb)) d
  where d ->> 'id' = s.data ->> 'champion'
  limit 1
) c on true;

grant select on public.players to authenticated;
