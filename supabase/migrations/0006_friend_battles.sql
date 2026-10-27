-- Dino Realms: friendly fights between friends and their score. No rewards ride on them, so the game reports
-- the result itself. Run once in Supabase → SQL Editor (or `supabase db push`), after 0005_friends.sql.

create table if not exists public.friend_battles (
  id bigint generated always as identity primary key,
  attacker uuid not null references public.profiles (user_id) on delete cascade,
  defender uuid not null references public.profiles (user_id) on delete cascade,
  result text not null check (result in ('victory', 'defeat', 'draw')),
  created_at timestamptz not null default now(),
  check (attacker <> defender)
);
create index if not exists friend_battles_attacker on public.friend_battles (attacker, defender);
create index if not exists friend_battles_defender on public.friend_battles (defender, attacker);

alter table public.friend_battles enable row level security;

drop policy if exists "see own battles" on public.friend_battles;
create policy "see own battles" on public.friend_battles
  for select to authenticated using ((select auth.uid()) in (attacker, defender));

-- Only your own fights, only against an accepted friend, and at most one a minute (a fight lasts longer).
drop policy if exists "record own battle" on public.friend_battles;
create policy "record own battle" on public.friend_battles
  for insert to authenticated with check (
    (select auth.uid()) = attacker
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = attacker and f.addressee = defender) or (f.requester = defender and f.addressee = attacker))
    )
    and not exists (
      select 1 from public.friend_battles b
      where b.attacker = (select auth.uid()) and b.created_at > now() - interval '1 minute'
    )
  );
