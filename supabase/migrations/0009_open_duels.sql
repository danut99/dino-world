-- Dino Realms: duels against any player, not only friends. Each fight a player starts is recorded once; at most one
-- a minute and five a day against the same rival, so the weekly ranking cannot be farmed. Run after 0008.

drop policy if exists "record own battle" on public.friend_battles;
create policy "record own battle" on public.friend_battles
  for insert to authenticated with check (
    (select auth.uid()) = attacker
    and exists (select 1 from public.profiles p where p.user_id = defender)
    and not exists (
      select 1 from public.friend_battles b
      where b.attacker = (select auth.uid()) and b.created_at > now() - interval '1 minute'
    )
    and (
      select count(*) from public.friend_battles b
      where b.attacker = (select auth.uid()) and b.defender = friend_battles.defender
        and b.created_at > now() - interval '1 day'
    ) < 5
  );
