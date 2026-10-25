import { describe, expect, it } from 'vitest';
import { FARM_LEVELS } from './content';
import {
  advance,
  ARENA_LEVELS,
  command,
  constructionLeft,
  gemsToFinish,
  habitatCapacity,
  HABITAT_LEVELS,
  hatcherySlots,
  HATCHERY_LEVELS,
  newSave,
  nextUpgrade,
  parseSave,
  PORTAL_LEVELS,
  targetLevel,
  WORKSHOP_LEVELS,
  type BuildTarget,
  type Command,
  type Save,
} from './game';

const now = 1_800_000_000_000;
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);
/** Every building placed, plenty of gold and materials, a few diamonds. */
function town(): Save {
  let s = newSave(now);
  s.gold = 200_000;
  s.inventory = { ...s.inventory, planks: 200, blocks: 200, crystal: 200, habitatKit: 20 };
  for (const [kind, x, y] of [
    ['farm', 5, 8],
    ['workshop', 6, 1],
    ['portal', 8, 5],
    ['arena', 1, 8],
  ] as const)
    s = command(s, { type: 'build', kind, x, y }, now);
  return s;
}
const UPGRADES: [BuildTarget, Command][] = [
  ['farm', { type: 'upgradeFarm' }],
  ['hatchery', { type: 'upgradeHatchery' }],
  ['workshop', { type: 'upgradeWorkshop' }],
  ['portal', { type: 'upgradePortal' }],
  ['arena', { type: 'upgradeArena' }],
  ['habitat:fire', { type: 'upgradeHabitat', realm: 'fire' }],
];

describe('timed construction', () => {
  it('builds every level in 5 minutes to 8 hours; new buildings and worlds stay instant', () => {
    for (const table of [FARM_LEVELS, HABITAT_LEVELS, HATCHERY_LEVELS, WORKSHOP_LEVELS, PORTAL_LEVELS, ARENA_LEVELS])
      for (const level of table.slice(1)) {
        expect(level.minutes).toBeGreaterThanOrEqual(5);
        expect(level.minutes).toBeLessThanOrEqual(480);
      }
    const s = town();
    expect(s.construction).toBeNull();
    expect(s.portalLevel).toBe(1);
    s.expeditionProgress = { training: 3 };
    s.inventory.wood = 50;
    const opened = command(s, { type: 'unlockHabitat', realm: 'water' }, now);
    expect(opened.habitats.water).toBe(1);
    expect(opened.construction).toBeNull();
  });

  it('pays up front, then the building keeps its old level until the build time is over', () => {
    for (const [target, upgrade] of UPGRADES) {
      const before = town();
      const step = nextUpgrade(before, target)!;
      const level = targetLevel(before, target);
      const s = command(before, upgrade, now);
      expect(s.gold, target).toBe(before.gold - step.gold);
      expect(s.construction, target).toEqual({ target, level: level + 1, startedAt: now, endsAt: now + step.minutes * 60_000 });
      expect(targetLevel(s, target), target).toBe(level);
      roundTrip(s);
      // One minute before the end: still the old level. At the end: the new one.
      expect(targetLevel(advance(s, s.construction!.endsAt - 60_000), target), target).toBe(level);
      const done = advance(s, s.construction!.endsAt);
      expect(targetLevel(done, target), target).toBe(level + 1);
      expect(done.construction).toBeNull();
      roundTrip(done);
    }
  });

  it('adds the new level only when it is done: farm plots, hatchery nests, habitat spots', () => {
    let s = command(town(), { type: 'upgradeFarm' }, now);
    expect(s.plots).toHaveLength(FARM_LEVELS[0].plots);
    // The farm keeps growing at its old level meanwhile.
    s = command(s, { type: 'plant' }, now);
    s = advance(s, s.construction!.endsAt);
    expect(s.plots).toHaveLength(FARM_LEVELS[1].plots);
    expect(s.plots.filter(Boolean)).toHaveLength(1);
    s = command(s, { type: 'upgradeHatchery' }, s.updatedAt);
    expect(hatcherySlots(s)).toBe(1);
    s = advance(s, s.construction!.endsAt);
    expect(hatcherySlots(s)).toBe(2);
    s = command(s, { type: 'upgradeHabitat', realm: 'fire' }, s.updatedAt);
    expect(habitatCapacity(s, 'fire')).toBe(2);
    s = advance(s, s.construction!.endsAt);
    expect(habitatCapacity(s, 'fire')).toBe(3);
    roundTrip(s);
  });

  it('has one builder: a second upgrade waits, free of charge, until the first is done', () => {
    let s = command(town(), { type: 'upgradeWorkshop' }, now);
    const gold = s.gold;
    for (const [target, upgrade] of UPGRADES) expect(() => command(s, upgrade, now + 1000), target).toThrow('builderBusy');
    expect(s.gold).toBe(gold);
    expect(constructionLeft(s, now + 1000)).toMatchObject({ target: 'workshop', left: 30 * 60_000 - 1000 });
    // As soon as it is done (no command needed in between) the builder takes the next one.
    s = command(s, { type: 'upgradeFarm' }, s.construction!.endsAt);
    expect(s).toMatchObject({ workshopLevel: 2, construction: { target: 'farm', level: 2 } });
    // Max level is still refused first.
    const top = { ...town(), arenaLevel: ARENA_LEVELS.length };
    expect(() => command(top, { type: 'upgradeArena' }, now)).toThrow('maxLevel');
  });

  it('finishes now with diamonds: ceil(1.2 × √minutes left)', () => {
    let s = command(town(), { type: 'upgradePortal' }, now);
    expect(() => command({ ...s, gems: 0 }, { type: 'gemFinish', target: 'construction' }, now)).toThrow('gems');
    // Two hours to build, half an hour gone: 90 minutes left.
    const at = now + 30 * 60_000,
      cost = gemsToFinish(90 * 60_000);
    expect(cost).toBe(12);
    s = command(s, { type: 'addGems', amount: 20 }, at);
    const gems = s.gems;
    s = command(s, { type: 'gemFinish', target: 'construction' }, at);
    expect(s.gems).toBe(gems - cost);
    expect(s).toMatchObject({ portalLevel: 2, construction: null });
    roundTrip(s);
    expect(() => command(s, { type: 'gemFinish', target: 'construction' }, at)).toThrow('construction');
    // The builder is free again at once.
    expect(command(s, { type: 'upgradeArena' }, at).construction?.target).toBe('arena');
  });

  it('refuses a construction the save could not have made', () => {
    const s = command(town(), { type: 'upgradeFarm' }, now);
    const forge = (patch: Partial<NonNullable<Save['construction']>>) => JSON.stringify({ ...s, construction: { ...s.construction!, ...patch } });
    expect(() => parseSave(forge({ endsAt: now + 60_000 }))).toThrow('Invalid construction');
    expect(() => parseSave(forge({ level: 3 }))).toThrow('Invalid construction');
    expect(() => parseSave(forge({ target: 'habitat:water' }))).toThrow('Invalid construction');
    expect(() => parseSave(forge({ target: 'castle' as BuildTarget }))).toThrow('Invalid construction');
    expect(() => parseSave(forge({ endsAt: now + 10 * 60_000, rushed: true }))).toThrow('Invalid construction');
    // Rushed: shorter than the build time is fine, longer is not.
    expect(parseSave(forge({ endsAt: now + 60_000, rushed: true })).construction?.rushed).toBe(true);
    // A building that is not there cannot be upgraded.
    const plain = newSave(now);
    plain.inventory.planks = 10;
    const bare = command(plain, { type: 'upgradeHatchery' }, now);
    roundTrip(bare);
    expect(() => parseSave(JSON.stringify({ ...bare, construction: { ...bare.construction!, target: 'arena' } }))).toThrow('Invalid construction');
    expect(() => command(newSave(now), { type: 'upgradeWorkshop' }, now)).toThrow('workshop');
  });

  it('earns at the old habitat level until the upgrade is done, even across a long absence', () => {
    let s = town();
    s.eggs = [];
    s.dinos = [{ id: 'd', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' }];
    s.champion = 'd';
    s.team = ['d'];
    s = command(s, { type: 'upgradeHabitat', realm: 'fire' }, now);
    const start = s.storedGold;
    // 15 minutes at 8/h, then 45 at 8 × 1.15.
    expect(advance(s, now + 3_600_000).storedGold - start).toBeCloseTo(8 * 0.25 + 8 * 1.15 * 0.75);
    // Away for two days: income still stops at the offline cap, the upgrade is done.
    const back = advance(s, now + 48 * 3_600_000);
    expect(back.habitats.fire).toBe(2);
    expect(back.storedGold - start).toBeCloseTo(8 * 1.15 * 8);
  });
});
