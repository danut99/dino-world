-- Dino Realms: duel leagues and weekly seasons. Players are ranked against others whose champion level falls in the
-- same league (see DUEL_LEAGUES in game.ts), for any span of time, so last week's final places can be read for the
-- season prizes. Wins count once per rival a day (Bucharest days), as in 0011. Run after 0011_fair_duels.sql.

create or replace function public.league_ranking(since timestamptz, until timestamptz, min_level int, max_level int)
returns table (user_id uuid, name text, level int, wins bigint)
language sql stable security definer set search_path = public as $$
  with won as (
    select b.attacker as winner, b.defender as rival, b.created_at from public.friend_battles b
    where b.created_at >= since and b.created_at < until and b.result = 'victory'
    union all
    select b.defender, b.attacker, b.created_at from public.friend_battles b
    where b.created_at >= since and b.created_at < until and b.result = 'defeat'
  ),
  w as (
    select pl.user_id, pl.name, pl.level,
      count(distinct (won.rival, (won.created_at at time zone 'Europe/Bucharest')::date)) as wins
    from public.players pl
    join won on won.winner = pl.user_id
    where pl.level between min_level and max_level
    group by pl.user_id, pl.name, pl.level
  ),
  top as (select * from w order by wins desc, name limit 50)
  select * from (
    select * from top
    union
    select pl.user_id, pl.name, pl.level, coalesce((select w.wins from w where w.user_id = pl.user_id), 0)
    from public.players pl
    where pl.user_id = (select auth.uid())
  ) r
  where (select auth.uid()) is not null
  order by 4 desc, 2;
$$;
revoke all on function public.league_ranking(timestamptz, timestamptz, int, int) from public, anon;
grant execute on function public.league_ranking(timestamptz, timestamptz, int, int) to authenticated;
