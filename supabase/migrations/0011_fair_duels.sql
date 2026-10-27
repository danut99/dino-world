-- Dino Realms: duels cannot be farmed against one player. The weekly ranking counts at most one win per rival per
-- day (Bucharest days), and a player may start at most three duels a day against the same rival. Run after 0010.

create or replace function public.weekly_ranking(since timestamptz)
returns table (user_id uuid, name text, wins bigint)
language sql stable security definer set search_path = public as $$
  with won as (
    select b.attacker as winner, b.defender as rival, b.created_at from public.friend_battles b
    where b.created_at >= since and b.result = 'victory'
    union all
    select b.defender, b.attacker, b.created_at from public.friend_battles b
    where b.created_at >= since and b.result = 'defeat'
  ),
  w as (
    select p.user_id, p.name,
      count(distinct (won.rival, (won.created_at at time zone 'Europe/Bucharest')::date)) as wins
    from public.profiles p
    join won on won.winner = p.user_id
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

create or replace function public.record_duel(rival uuid, outcome text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or rival is null or rival = me or outcome not in ('victory', 'defeat', 'draw') then
    return 'invalid';
  end if;
  if not exists (select 1 from public.profiles where user_id = me)
    or not exists (select 1 from public.profiles where user_id = rival) then
    return 'no_profile';
  end if;
  if exists (select 1 from public.friend_battles where attacker = me and created_at > now() - interval '1 minute') then
    return 'too_soon';
  end if;
  if (select count(*) from public.friend_battles
      where attacker = me and defender = rival and created_at > now() - interval '1 day') >= 3 then
    return 'daily_limit';
  end if;
  insert into public.friend_battles (attacker, defender, result) values (me, rival, outcome);
  return null;
end;
$$;
revoke all on function public.record_duel(uuid, text) from public, anon;
grant execute on function public.record_duel(uuid, text) to authenticated;
