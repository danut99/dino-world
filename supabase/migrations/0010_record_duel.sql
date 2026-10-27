-- Dino Realms: fixes "infinite recursion detected in policy for relation friend_battles". The insert policy counted
-- rows of friend_battles itself, which runs that table's policies again. Duels are now recorded through one
-- function that checks the limits with the table's owner rights. Run after 0009_open_duels.sql.

drop policy if exists "record own battle" on public.friend_battles;

-- Returns null when recorded, otherwise why not: 'invalid', 'no_profile', 'too_soon' (one a minute) or
-- 'daily_limit' (five a day against the same rival).
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
      where attacker = me and defender = rival and created_at > now() - interval '1 day') >= 5 then
    return 'daily_limit';
  end if;
  insert into public.friend_battles (attacker, defender, result) values (me, rival, outcome);
  return null;
end;
$$;
revoke all on function public.record_duel(uuid, text) from public, anon;
grant execute on function public.record_duel(uuid, text) to authenticated;
