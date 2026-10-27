-- Dino Realms: a basic server guard on cloud saves.
-- The browser writes the whole save and row level security only checks whose it is, so a hand-edited save could
-- hold any amount of gold or diamonds. This refuses writes that are plainly not play: progress going backwards and
-- diamonds or gold rising far faster than the game ever pays them. It is a coarse net against absurd edits
-- (+1e9 gold), not a replay of the game rules. Run once in Supabase → SQL Editor (or `supabase db push`), after
-- 0001–0003.
-- Already in place: updated_at is the server time of each write (saves_touch, 0001), and schema_version must match
-- data->>'schemaVersion' and never go down (saves_schema_floor, 0003).
--
-- Caps per write, over the real (server) time since the row's previous write:
-- - diamonds: +200, plus 20 an hour. Every one-time source together (welcome 10, ten chapter finales 5 each, ten
--   region finales 3 each, star milestones 40, collection milestones 30) is about 160; repeating ones (daily chest
--   1, wheel 3, arena season 8 a week) are a few a day. So even a guest's whole progress moving in at once fits.
-- - gold: +200 000, plus 50 000 an hour. The largest legit bursts (releasing every dinosaur, the 10 000 gold star
--   milestone, 4 200 gold region finales) stay far below; habitat storage tops out near 28 000 for all ten worlds.
-- A row with no real progress yet (no dinosaur, no fight won) and a move to a newer schema skip the caps: there is
-- nothing to protect, and a guest's progress or a new game must be able to replace it.
-- On a refused write the game takes the cloud copy back (see useCloudSync).

create or replace function public.saves_guard() returns trigger
language plpgsql as $$
declare
  hours numeric;
  old_revision numeric;
  old_gems numeric;
  old_gold numeric;
begin
  if jsonb_typeof(new.data->'revision') is distinct from 'number'
    or jsonb_typeof(new.data->'gems') is distinct from 'number'
    or jsonb_typeof(new.data->'gold') is distinct from 'number' then
    raise exception 'save revision, gems and gold must be numbers' using errcode = 'check_violation';
  end if;
  -- The same bounds the game's own loader demands (parseSave).
  if (new.data->>'revision')::numeric < 0
    or (new.data->>'gems')::numeric not between 0 and 1e9
    or (new.data->>'gold')::numeric not between 0 and 1e9 then
    raise exception 'save revision, gems or gold out of range' using errcode = 'check_violation';
  end if;
  if tg_op <> 'UPDATE' or old.schema_version <> new.schema_version
    or (case when jsonb_typeof(old.data->'dinos') = 'array' then jsonb_array_length(old.data->'dinos') else 0 end) = 0
      and (case when jsonb_typeof(old.data->'cleared') = 'array' then jsonb_array_length(old.data->'cleared') else 0 end) = 0 then
    return new;
  end if;
  old_revision := case when jsonb_typeof(old.data->'revision') = 'number' then (old.data->>'revision')::numeric else 0 end;
  old_gems := case when jsonb_typeof(old.data->'gems') = 'number' then (old.data->>'gems')::numeric else 0 end;
  old_gold := case when jsonb_typeof(old.data->'gold') = 'number' then (old.data->>'gold')::numeric else 0 end;
  hours := greatest(extract(epoch from now() - old.updated_at) / 3600, 0);
  -- Every action adds one to the revision: a lower one is an older save (a stale tab) overwriting newer progress.
  if (new.data->>'revision')::numeric < old_revision then
    raise exception 'save revision % is older than the stored %', new.data->>'revision', old_revision
      using errcode = 'check_violation';
  end if;
  if (new.data->>'gems')::numeric - old_gems > 200 + 20 * hours then
    raise exception 'diamonds rose by % in % hours', (new.data->>'gems')::numeric - old_gems, round(hours, 2)
      using errcode = 'check_violation';
  end if;
  if (new.data->>'gold')::numeric - old_gold > 200000 + 50000 * hours then
    raise exception 'gold rose by % in % hours', (new.data->>'gold')::numeric - old_gold, round(hours, 2)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves
  for each row execute function public.saves_guard();
