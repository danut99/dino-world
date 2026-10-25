import { describe, expect, it } from 'vitest';
import { advance, command, feedCost, newSave, OutdatedSave, parseSave, type Save } from './game';
import { project, unproject } from './World';
const now = 1_800_000_000_000;
function juvenile(): Save {
  let s = command(newSave(now), { type: 'incubate' }, now);
  s = command(s, { type: 'hatch' }, now + 30_000);
  s.food = 1000;
  for (let i = 0; i < 8; i++) s = command(s, { type: 'feed' }, now + 30_000);
  return command(s, { type: 'evolve' }, now + 30_000);
}
/** Juvenile Ignis at level 15 with the arena built and fire tickets. */
function fighter(): Save {
  let s = juvenile();
  s.dinos[0].level = 15;
  s = command(s, { type: 'build', kind: 'arena', x: 1, y: 8 }, now + 30_000);
  s.arenaTickets.fire = 5;
  return s;
}
describe('Dino Realms first playable path', () => {
  it('refuses saves from before the v6 reset, and habitats on the main island', () => {
    for (const schemaVersion of [1, 4, 5, 7]) {
      const error = (() => {
        try {
          parseSave(JSON.stringify({ ...juvenile(), schemaVersion }));
        } catch (e) {
          return e;
        }
      })();
      expect(error).toBeInstanceOf(OutdatedSave);
    }
    expect(() => parseSave(JSON.stringify({ gold: 5 }))).toThrow(OutdatedSave);
    expect(() => parseSave('null')).toThrow('Invalid save');
    const invalid = newSave(now);
    invalid.buildings.push({ id: 'home', kind: 'habitat', x: 7, y: 4 });
    expect(() => parseSave(JSON.stringify(invalid))).toThrow('Invalid buildings');
  });
  it('resumes incubation and hatches once without duplicating the dinosaur', () => {
    const s = parseSave(JSON.stringify(command(newSave(now), { type: 'incubate' }, now)));
    expect(() => command(s, { type: 'hatch' }, now + 29_999)).toThrow();
    const hatched = command(s, { type: 'hatch' }, now + 30_000);
    expect(hatched.dinos).toMatchObject([{ nickname: 'Ignis', level: 1 }]);
    expect(hatched).toMatchObject({ champion: 'ignis', team: ['ignis'], discovered: ['trex_fire'] });
    expect(() => command(hatched, { type: 'hatch' }, now + 30_000)).toThrow();
  });
  it('locks at evolution thresholds, charges 482 food to reach juvenile and a crystal for adult', () => {
    let s = command(newSave(now), { type: 'incubate' }, now);
    s = command(s, { type: 'hatch' }, now + 30_000);
    s.food = 1000;
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, now + 30_000)).toThrow('juvenile');
    // Feeding several times stops at the evolution gate.
    s = command(s, { type: 'feed', times: 10 }, now + 30_000);
    expect(s.dinos[0].level).toBe(9);
    expect(() => command(s, { type: 'feed' }, now + 30_000)).toThrow('evolve');
    s = command(s, { type: 'evolve' }, now + 30_000);
    expect(s.dinos[0]).toMatchObject({ stage: 'juvenile', level: 10 });
    expect(s.food).toBe(1000 - 482);
    expect(() => command(s, { type: 'feed', times: 11 }, now + 30_000)).toThrow('feed');
    // ...and when the food runs out.
    s.food = feedCost(10) + feedCost(11) + 1;
    s = command(s, { type: 'feed', times: 5 }, now + 30_000);
    expect(s).toMatchObject({ food: 1, dinos: [{ level: 12 }] });
    s.food = 100_000;
    while (s.dinos[0].level < 24) s = command(s, { type: 'feed', times: 10 }, now + 30_000);
    expect(() => command(s, { type: 'feed' }, now + 30_000)).toThrow('evolve');
    expect(() => command(s, { type: 'evolve' }, now + 30_000)).toThrow('evolutionCrystal');
    s.inventory.evolutionCrystal = 1;
    s = command(s, { type: 'evolve' }, now + 30_000);
    expect(s.dinos[0]).toMatchObject({ stage: 'adult', level: 25 });
    expect(s.inventory.evolutionCrystal).toBe(0);
    expect(s.daily.progress.feed).toBe(3);
  });
  it('raises one level with a crystal anywhere but at an evolution gate', () => {
    let s = juvenile();
    s.inventory.evolutionCrystal = 2;
    s = command(s, { type: 'useCrystal' }, now + 30_000);
    expect(s.dinos[0].level).toBe(11);
    s.dinos[0].level = 24;
    expect(() => command(s, { type: 'useCrystal' }, now + 30_000)).toThrow('level');
  });
  it('validates placement atomically and keeps farm timers across reload', () => {
    const s = newSave(now);
    expect(() => command(s, { type: 'build', x: 2, y: 4 }, now)).toThrow();
    expect(s.gold).toBe(1000);
    expect(() => command(s, { type: 'build', x: 20, y: 0 }, now)).toThrow();
    // The lawn reaches past the original 12×12 square on the sides.
    expect(command(s, { type: 'build', x: 10, y: 0 }, now).buildings.at(-1)).toMatchObject({ x: 10, y: 0 });
    let farm = command(s, { type: 'build', x: 5, y: 8 }, now);
    expect(farm.gold).toBe(900);
    farm = parseSave(JSON.stringify(command(farm, { type: 'plant' }, now)));
    expect(() => command(farm, { type: 'harvest' }, now + 119_999)).toThrow();
    farm = command(farm, { type: 'harvest' }, now + 120_000);
    expect(farm.food).toBe(403);
    expect(() => command(farm, { type: 'harvest' }, now + 120_000)).toThrow();
    expect(() => command(farm, { type: 'move', id: 'farm', x: 2, y: 4 }, now + 120_000)).toThrow();
  });
  it('caps offline production, retains fractional gold, and prevents repeated collection', () => {
    const s = juvenile();
    const accrued = advance(s, s.updatedAt + 24 * 3_600_000);
    // A juvenile makes 8 gold an hour, for at most eight hours away.
    expect(accrued.storedGold).toBe(64);
    const collected = command(accrued, { type: 'collect' }, accrued.updatedAt);
    expect(collected.gold).toBe(1064);
    expect(() => command(collected, { type: 'collect' }, accrued.updatedAt)).toThrow();
    expect(advance(accrued, accrued.updatedAt - 10000).storedGold).toBe(64);
  });
  it('resumes deterministic combat and grants victory rewards exactly once', () => {
    const start = fighter();
    let s = command(start, { type: 'battle', encounterId: 'arena-fire-1' }, now + 30_000);
    expect(() => command(s, { type: 'action', action: 'ultimate' }, now + 30_000)).toThrow();
    expect(() => command(s, { type: 'action', action: 'skill' as never }, now + 30_000)).toThrow('action');
    s = command(s, { type: 'action', action: 'basic' }, now + 30_000);
    const round = parseSave(JSON.stringify(s));
    expect(command(s, { type: 'action', action: 'basic' }, now + 30_000)).toEqual(
      command(round, { type: 'action', action: 'basic' }, now + 30_000),
    );
    while (!s.battle?.result) s = command(s, { type: 'action', action: 'basic' }, now + 30_000);
    expect(s.battle.result).toBe('victory');
    const claimed = command(s, { type: 'claim' }, now + 30_000);
    // Fire apprentice, first win, one dinosaur: 20 × level 10 gold and 8 × level 10 food.
    expect(claimed.gold).toBe(start.gold + 200);
    expect(claimed.food).toBe(start.food + 80);
    expect(claimed.arena.weekWins).toBe(1);
    expect(() => command(claimed, { type: 'claim' }, now + 30_000)).toThrow();
    expect(claimed.dinos).toEqual(s.dinos);
  });
  it('unlocks ultimate only for adults and consumes all energy', () => {
    const adult = fighter();
    adult.dinos[0] = { ...adult.dinos[0], level: 25, stage: 'adult' };
    let s = command(adult, { type: 'battle', encounterId: 'arena-fire-1' }, now + 30_000);
    for (let i = 0; i < 4; i++) s = command(s, { type: 'action', action: 'defend' }, now + 30_000);
    expect(s.battle?.energy).toBe(100);
    s = command(s, { type: 'action', action: 'ultimate' }, now + 30_000);
    // The bar empties; a blow taken in the same round charges it a little again.
    expect(s.battle?.energy).toBe(s.battle!.report!.taken > 0 ? 15 : 0);
  });
  it('rejects corrupt imports and overlapping buildings', () => {
    const base = juvenile();
    for (const change of [
      { gold: -1 },
      { food: Infinity },
      { dinos: [{ id: 'x', species: 'trex', element: 'fire', level: 25, stage: 'baby', nickname: 'x' }], champion: 'x', team: ['x'] },
      { dinos: [{ id: 'x', species: 'dragon', element: 'fire', level: 1, stage: 'baby', nickname: 'x' }], champion: 'x', team: ['x'] },
      { dinos: [{ id: 'x', species: 'boss', element: 'fire', level: 5, stage: 'baby', nickname: 'x' }], champion: 'x', team: ['x'] },
      { team: ['ignis', 'ignis'] },
      { eggs: [{ id: 'e', species: 'trex', element: 'void', seconds: 300, hatchAt: null }] },
      { habitats: { fire: 9 } },
      { lamps: 6 },
      { portalLevel: 1 },
      { discovered: ['dragon_fire'] },
      { expeditions: [{ id: 't', kind: 'stage', regionId: 'training', team: ['ignis'], startedAt: now, endsAt: now + 1, stage: 0, reward: { gold: 1, food: 1, materials: {} } }] },
      { construction: { target: 'castle', level: 2, startedAt: now, endsAt: now } },
      { arena: { week: 'monday', weekWins: 0, weekClaimed: 0 } },
      { battle: {} },
      { rewardPending: true },
    ]) {
      expect(() => parseSave(JSON.stringify({ ...base, ...change })), JSON.stringify(change)).toThrow();
    }
    const s = newSave(now);
    s.buildings.push({ id: 'farm', kind: 'farm', x: 2, y: 4 });
    expect(() => parseSave(JSON.stringify(s))).toThrow();
    expect(parseSave(JSON.stringify(base))).toEqual(base);
  });
  it('maps isometric cell centers back to the correct cell', () => {
    for (let x = 0; x < 12; x++)
      for (let y = 0; y < 12; y++) {
        const p = project(x + 0.5, y + 0.5);
        expect(unproject(p.x, p.y)).toEqual({ x, y });
      }
  });
});
