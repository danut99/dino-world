-- Dino Realms: friends, and friends collecting your habitat gold for you (only if you allow it).
-- Run once in Supabase → SQL Editor (or `supabase db push`), after 0001–0004.

-- The "friends may collect my gold" switch, off until the player turns it on.
alter table public.profiles add column if not exists accept_help boolean not null default false;

-- One row per pair: `requester` asked, `addressee` accepts (status 'accepted') or deletes the row.
create table if not exists public.friendships (
  requester uuid not null references public.profiles (user_id) on delete cascade,
  addressee uuid not null references public.profiles (user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- A pair is one friendship whichever side asked.
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);

alter table public.friendships enable row level security;

drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester, addressee));

drop policy if exists "ask a friend" on public.friendships;
create policy "ask a friend" on public.friendships
  for insert to authenticated with check ((select auth.uid()) = requester and status = 'pending');

drop policy if exists "accept a friend" on public.friendships;
create policy "accept a friend" on public.friendships
  for update to authenticated using ((select auth.uid()) = addressee) with check (status = 'accepted');

drop policy if exists "end a friendship" on public.friendships;
create policy "end a friendship" on public.friendships
  for delete to authenticated using ((select auth.uid()) in (requester, addressee));

-- Accepting may change the status and nothing else.
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

-- A friend's collect, waiting for the owner's game to apply it (it empties the owner's gold storage at
-- `created_at`, so the storage fills again after) and then delete it.
create table if not exists public.friend_helps (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (user_id) on delete cascade,
  helper_id uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists friend_helps_owner on public.friend_helps (owner_id, created_at);

alter table public.friend_helps enable row level security;

drop policy if exists "see helps" on public.friend_helps;
create policy "see helps" on public.friend_helps
  for select to authenticated using ((select auth.uid()) in (owner_id, helper_id));

drop policy if exists "clear own helps" on public.friend_helps;
create policy "clear own helps" on public.friend_helps
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- The only way to add a help: an accepted friend, the owner allows it, and at most one help per hour per owner.
-- Returns null on success, otherwise why not ('not_friends', 'help_off', 'too_soon').
create or replace function public.help_friend(target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or target = me then
    return 'not_friends';
  end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = me and f.addressee = target) or (f.requester = target and f.addressee = me))
  ) then
    return 'not_friends';
  end if;
  if not coalesce((select p.accept_help from public.profiles p where p.user_id = target), false) then
    return 'help_off';
  end if;
  if exists (select 1 from public.friend_helps h where h.owner_id = target and h.created_at > now() - interval '1 hour') then
    return 'too_soon';
  end if;
  insert into public.friend_helps (owner_id, helper_id) values (target, me);
  return null;
end;
$$;
revoke execute on function public.help_friend(uuid) from public, anon;
grant execute on function public.help_friend(uuid) to authenticated;
