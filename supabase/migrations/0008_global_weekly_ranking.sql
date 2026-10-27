-- Dino Realms: the weekly ranking covers every player, not only friends: the 50 with the most friendly wins
-- since `since`, plus the caller wherever they stand. Run after 0007_leaderboard.sql.

create or replace function public.weekly_ranking(since timestamptz)
returns table (user_id uuid, name text, wins bigint)
language sql stable security definer set search_path = public as $$
  with w as (
    select p.user_id, p.name, count(*) as wins
    from public.profiles p
    join public.friend_battles b on b.created_at >= since
      and ((b.attacker = p.user_id and b.result = 'victory') or (b.defender = p.user_id and b.result = 'defeat'))
    group by p.user_id, p.name
  ),
  top as (select * from w order by wins desc, name limit 50)
  select * from (
    select * from top
    union
    select p.user_id, p.name, coalesce((select w.wins from w where w.user_id = p.user_id), 0)
    from public.profiles p
    where p.user_id = (select auth.uid())
  ) r
  where (select auth.uid()) is not null
  order by 3 desc, 2;
$$;

revoke all on function public.weekly_ranking(timestamptz) from public, anon;
grant execute on function public.weekly_ranking(timestamptz) to authenticated;
