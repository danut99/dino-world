-- Dino Realms: the weekly friends ranking. Counts every friendly win (as attacker: victory; as defender: the
-- attacker's defeat) since `since` for the caller and their accepted friends, fights with anyone included.
-- Run once in Supabase → SQL Editor (or `supabase db push`), after 0006_friend_battles.sql.

create or replace function public.weekly_ranking(since timestamptz)
returns table (user_id uuid, name text, wins bigint)
language sql stable security definer set search_path = public as $$
  with circle as (
    select (select auth.uid()) as id
    union
    select case when f.requester = (select auth.uid()) then f.addressee else f.requester end
    from public.friendships f
    where f.status = 'accepted' and (select auth.uid()) in (f.requester, f.addressee)
  )
  select p.user_id, p.name,
    (select count(*) from public.friend_battles b
      where b.created_at >= since
        and ((b.attacker = p.user_id and b.result = 'victory') or (b.defender = p.user_id and b.result = 'defeat')))
  from circle c
  join public.profiles p on p.user_id = c.id
  where (select auth.uid()) is not null
  order by 3 desc, p.name;
$$;

revoke all on function public.weekly_ranking(timestamptz) from public, anon;
grant execute on function public.weekly_ranking(timestamptz) to authenticated;
