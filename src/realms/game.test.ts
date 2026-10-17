import { describe, expect, it } from 'vitest';
import { advance, command, newSave, parseSave, type Save } from './game';
import { project, unproject } from './World';
import { legacy } from './test-fixtures';
const now = 1_800_000_000_000;
function juvenile(): Save {
  let s = command(newSave(now), { type: 'incubate' }, now);
  s = command(s, { type: 'hatch' }, now + 30_000);
  for (let i = 0; i < 8; i++) s = command(s, { type: 'feed' }, now + 30_000);
  return command(s, { type: 'evolve' }, now + 30_000);
}
describe('Dino Realms first playable path', () => {
  it('keeps habitats out of the main island and migrates the first preview without losing progress', () => {
    const old = {
      ...legacy(juvenile(), 1),
      buildings: [
        { id: 'nest', kind: 'hatchery', x: 2, y: 4 },
        { id: 'home', kind: 'habitat', x: 7, y: 4 },
      ],
    };
    const migrated = parseSave(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.buildings.map((b) => b.kind)).toEqual(['hatchery']);
    expect(migrated.dinos).toMatchObject([{ id: 'ignis', level: 10, species: 'trex', element: 'fire' }]);
    expect(migrated.champion).toBe('ignis');
    expect(migrated.food).toBe(30);
    const invalid = newSave(now);
    invalid.buildings.push({ id: 'home', kind: 'habitat', x: 7, y: 4 });
    expect(() => parseSave(JSON.stringify(invalid))).toThrow();
  });
  it('resumes incubation and hatches once without duplicating the dinosaur', () => {
    const s = parseSave(JSON.stringify(command(newSave(now), { type: 'incubate' }, now)));
    expect(() => command(s, { type: 'hatch' }, now + 29_999)).toThrow();
    const hatched = command(s, { type: 'hatch' }, now + 30_000);
    expect(hatched.dinos).toMatchObject([{ nickname: 'Ignis', level: 1 }]);
    expect(hatched.champion).toBe('ignis');
    expect(() => command(hatched, { type: 'hatch' }, now + 30_000)).toThrow();
  });
  it('locks at evolution thresholds and charges exactly 270 food to reach juvenile', () => {
    let s = command(newSave(now), { type: 'incubate' }, now);
    s = command(s, { type: 'hatch' }, now + 30_000);
    expect(() => command(s, { type: 'battle' }, now + 30_000)).toThrow();
    for (let i = 0; i < 8; i++) s = command(s, { type: 'feed' }, now + 30_000);
    expect(() => command(s, { type: 'feed' }, now + 30_000)).toThrow();
    s = command(s, { type: 'evolve' }, now + 30_000);
    expect(s.dinos[0]).toMatchObject({ stage: 'juvenile', level: 10 });
    expect(s.food).toBe(30);
    s.food = 10_000;
    for (let i = 10; i < 24; i++) s = command(s, { type: 'feed' }, now + 30_000);
    expect(() => command(s, { type: 'feed' }, now + 30_000)).toThrow();
    s = command(s, { type: 'evolve' }, now + 30_000);
    expect(s.dinos[0]).toMatchObject({ stage: 'adult', level: 25 });
  });
  it('validates placement atomically and keeps farm timers across reload', () => {
    const s = newSave(now);
    expect(() => command(s, { type: 'build', x: 2, y: 4 }, now)).toThrow();
    expect(s.gold).toBe(1200);
    expect(() => command(s, { type: 'build', x: 20, y: 0 }, now)).toThrow();
    // The lawn reaches past the original 12×12 square on the sides.
    expect(command(s, { type: 'build', x: 10, y: 0 }, now).buildings.at(-1)).toMatchObject({ x: 10, y: 0 });
    let farm = command(s, { type: 'build', x: 5, y: 8 }, now);
    farm = parseSave(JSON.stringify(command(farm, { type: 'plant' }, now)));
    expect(() => command(farm, { type: 'harvest' }, now + 59_999)).toThrow();
    farm = command(farm, { type: 'harvest' }, now + 60_000);
    expect(farm.food).toBe(325);
    expect(() => command(farm, { type: 'harvest' }, now + 60_000)).toThrow();
    expect(() => command(farm, { type: 'move', id: 'farm', x: 2, y: 4 }, now + 60_000)).toThrow();
  });
  it('caps offline production, retains fractional gold, and prevents repeated collection', () => {
    const s = juvenile();
    const accrued = advance(s, s.updatedAt + 24 * 3_600_000);
    expect(accrued.storedGold).toBe(240);
    const collected = command(accrued, { type: 'collect' }, accrued.updatedAt);
    expect(collected.gold).toBe(1440);
    expect(() => command(collected, { type: 'collect' }, accrued.updatedAt)).toThrow();
    expect(advance(accrued, accrued.updatedAt - 10000).storedGold).toBe(240);
  });
  it('resumes deterministic combat and grants victory rewards exactly once', () => {
    let s = command(juvenile(), { type: 'battle' }, now + 30_000);
    expect(() => command(s, { type: 'action', action: 'ultimate' }, now + 30_000)).toThrow();
    s = command(s, { type: 'action', action: 'skill' }, now + 30_000);
    expect(() => command(s, { type: 'action', action: 'skill' }, now + 30_000)).toThrow();
    const round = parseSave(JSON.stringify(s));
    expect(command(s, { type: 'action', action: 'basic' }, now + 30_000)).toEqual(
      command(round, { type: 'action', action: 'basic' }, now + 30_000),
    );
    while (!s.battle?.result) s = command(s, { type: 'action', action: 'basic' }, now + 30_000);
    expect(s.battle.result).toBe('victory');
    const claimed = command(s, { type: 'claim' }, now + 30_000);
    expect(claimed.gold).toBe(1450);
    expect(claimed.food).toBe(180);
    expect(() => command(claimed, { type: 'claim' }, now + 30_000)).toThrow();
    expect(claimed.dinos).toEqual(s.dinos);
  });
  it('unlocks ultimate only for adults and consumes all energy', () => {
    const adult = juvenile();
    adult.dinos[0] = { ...adult.dinos[0], level: 25, stage: 'adult' };
    let s = command(adult, { type: 'battle' }, now + 30_000);
    for (let i = 0; i < 7; i++) s = command(s, { type: 'action', action: 'defend' }, now + 30_000);
    expect(s.battle?.energy).toBe(100);
    s = command(s, { type: 'action', action: 'ultimate' }, now + 30_000);
    expect(s.battle?.energy).toBe(0);
  });
  it('rejects corrupt imports and overlapping buildings', () => {
    for (const change of [
      { gold: -1 },
      { food: Infinity },
      { schemaVersion: 99 },
      { dinos: [{ id: 'x', species: 'trex', element: 'fire', level: 25, stage: 'baby', nickname: 'x' }], champion: 'x' },
      { dinos: [{ id: 'x', species: 'dragon', element: 'fire', level: 1, stage: 'baby', nickname: 'x' }], champion: 'x' },
      { eggs: [{ id: 'e', species: 'trex', element: 'void', seconds: 300, hatchAt: null }] },
      { habitats: { fire: 9 } },
      { battle: {} },
      { rewardPending: true },
    ]) {
      expect(() => parseSave(JSON.stringify({ ...newSave(now), ...change }))).toThrow();
    }
    const s = newSave(now);
    s.buildings.push({ id: 'farm', kind: 'farm', x: 2, y: 4 });
    expect(() => parseSave(JSON.stringify(s))).toThrow();
    expect(parseSave(JSON.stringify(juvenile()))).toEqual(juvenile());
  });
  it('maps isometric cell centers back to the correct cell', () => {
    for (let x = 0; x < 12; x++)
      for (let y = 0; y < 12; y++) {
        const p = project(x + 0.5, y + 0.5);
        expect(unproject(p.x, p.y)).toEqual({ x, y });
      }
  });
});
