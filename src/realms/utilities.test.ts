import { describe, expect, it } from 'vitest';
import { advance, command, newSave, parseSave, type Save } from './game';
import { legacy } from './test-fixtures';
import { ELEMENTS } from './game';
import { ENCOUNTERS } from './content';
const now = 1_800_000_000_000;
function withHero(s: Save): Save {
  s.eggs = [];
  s.dinos = [{ id: 'ignis', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' }];
  s.champion = 'ignis';
  return s;
}
function built(): Save {
  let s = newSave(now);
  for (const [kind, x, y] of [
    ['farm', 5, 8],
    ['workshop', 6, 1],
    ['portal', 8, 5],
    ['arena', 1, 8],
  ] as const)
    s = command(s, { type: 'build', kind, x, y }, now);
  return s;
}
describe('reference utility systems', () => {
  it('connects every elemental world to a reachable expedition node without prerequisite cycles', () => {
    const nodes = ENCOUNTERS.filter((e) => e.mode === 'expedition');
    expect(nodes).toHaveLength(10);
    expect(new Set(nodes.map((e) => e.image))).toEqual(new Set(ELEMENTS.map((e) => e.id)));
    for (const node of nodes) {
      const visited = new Set<string>();
      let current: typeof node | undefined = node;
      while (current) {
        expect(visited.has(current.id)).toBe(false);
        visited.add(current.id);
        if (!current.requires) break;
        const previous = nodes.find((e) => e.id === current!.requires);
        expect(previous).toBeDefined();
        current = previous;
      }
    }
  });
  it('places five utilities and preserves all of them through reload', () => {
    const s = built();
    expect(s.gold).toBe(350);
    expect(s.buildings).toHaveLength(5);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    expect(() => command(s, { type: 'build', kind: 'workshop', x: 0, y: 0 }, now)).toThrow();
    expect(() => command(s, { type: 'move', id: 'arena', x: 5, y: 8 }, now)).toThrow();
  });
  it('reserves materials, refunds only queued jobs, and adjusts later start times', () => {
    let s = built();
    for (let i = 0; i < 3; i++) s = command(s, { type: 'craft', recipeId: 'planks' }, now);
    expect(s.inventory.wood).toBe(0);
    expect(() => command(s, { type: 'craft', recipeId: 'blocks' }, now)).toThrow();
    expect(() => command(s, { type: 'cancelCraft', jobId: s.crafting[0].id }, now)).toThrow();
    s = command(s, { type: 'cancelCraft', jobId: s.crafting[1].id }, now);
    expect(s.inventory.wood).toBe(10);
    expect(s.crafting[1].startedAt).toBe(now + 30_000);
    expect(s.crafting[1].endsAt).toBe(now + 60_000);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('collects offline farm and queued outputs once, including after refresh', () => {
    let s = command(built(), { type: 'plant' }, now);
    s = command(s, { type: 'craft', recipeId: 'planks' }, now);
    s = command(s, { type: 'craft', recipeId: 'blocks' }, now);
    const loaded = parseSave(JSON.stringify(s));
    expect(() => command(loaded, { type: 'claimCraft', jobId: s.crafting[0].id }, now + 29_999)).toThrow();
    s = command(loaded, { type: 'collectAvailable' }, now + 61_000);
    expect(s.inventory.planks).toBe(2);
    expect(s.inventory.blocks).toBe(2);
    expect(s.food).toBe(325);
    const again = command(s, { type: 'collectAvailable' }, now + 61_000);
    expect(again.inventory).toEqual(s.inventory);
    expect(again.food).toBe(s.food);
    expect(() => command(again, { type: 'claimCraft', jobId: loaded.crafting[0].id }, now + 61_000)).toThrow();
  });
  it('gates encounters and grants first-victory materials exactly once', () => {
    let s = withHero(built());
    expect(() => command(s, { type: 'battle', encounterId: 'ruins' }, now)).toThrow();
    s = command(s, { type: 'battle' }, now);
    while (!s.battle?.result) s = command(s, { type: 'action', action: 'basic' }, now);
    s = command(parseSave(JSON.stringify(s)), { type: 'claim' }, now);
    expect(s.cleared).toEqual(['training']);
    expect(s.inventory.wood).toBe(45);
    expect(() => command(s, { type: 'claim' }, now)).toThrow();
    expect(command(s, { type: 'battle' }, now).battle?.reward.gold).toBe(50);
    expect(command(s, { type: 'battle', encounterId: 'ruins' }, now).battle?.encounterId).toBe('ruins');
  });
  it('migrates v2 progress and live battles without deleting resources', () => {
    let s = withHero(built());
    s = command(s, { type: 'battle' }, now);
    const old = {
      ...legacy(s, 2),
      inventory: undefined,
      crafting: undefined,
      cleared: undefined,
      worldIncomeBonus: undefined,
      lanterns: undefined,
    };
    const migrated = parseSave(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.battle?.dinoId).toBe('ignis');
    expect(migrated.gold).toBe(s.gold);
    expect(migrated.food).toBe(s.food);
    expect(migrated.battle?.hp).toBe(s.battle?.hp);
  });
  it('rejects invalid crafting imports and applies income upgrades prospectively', () => {
    let s = withHero(built());
    s.inventory.habitatKit = 1;
    s = command(s, { type: 'upgradeHabitat', realm: 'fire' }, now + 3_600_000);
    expect(s).toMatchObject({ storedGold: 30, gold: 200, habitats: { fire: 2 } });
    expect(advance(s, now + 7_200_000).storedGold).toBe(63);
    expect(() => parseSave(JSON.stringify({ ...s, inventory: { ...s.inventory, wood: -1 } }))).toThrow();
    expect(() =>
      parseSave(
        JSON.stringify({ ...s, crafting: [{ id: 'bad', recipeId: 'planks', startedAt: now, endsAt: now + 1 }] }),
      ),
    ).toThrow();
  });
});
describe('farm levels, plots and crops', () => {
  const farm = () => command(newSave(now), { type: 'build', x: 5, y: 8 }, now);
  it('has three levels, preserves five final plots, and raises every harvest', () => {
    let s = farm();
    expect(s.plots).toHaveLength(1);
    s.gold = 10_000;
    s.inventory.planks = 20;
    s.inventory.blocks = 20;
    s.inventory.crystal = 0;
    s = command(s, { type: 'upgradeFarm' }, now);
    expect(s).toMatchObject({ farmLevel: 2, gold: 9750, plots: [null, null, null] });
    s = command(s, { type: 'upgradeFarm' }, now);
    expect(s.inventory.planks).toBe(16);
    expect(s.farmLevel).toBe(3);
    expect(s.plots).toHaveLength(5);
    expect(() => command(s, { type: 'upgradeFarm' }, now)).toThrow('maxLevel');
    for (let i = 0; i < 5; i++) s = command(s, { type: 'plant' }, now);
    expect(() => command(s, { type: 'plant' }, now)).toThrow('plots');
    const food = s.food;
    s = command(s, { type: 'harvest' }, now + 60_000);
    expect(s.food).toBe(food + 5 * 50);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('charges more and waits longer for bigger crops, gated by farm level', () => {
    let s = farm();
    expect(() => command(s, { type: 'plant', crop: 'ginkgo' }, now)).toThrow('locked');
    s = command(s, { type: 'plant', crop: 'cicadas' }, now);
    expect(s.gold).toBe(1100 - 20);
    expect(() => command(s, { type: 'harvest' }, now + 299_999)).toThrow();
    s = command(s, { type: 'harvest', plot: 0 }, now + 300_000);
    expect(s.food).toBe(390);
  });
  it('migrates a v3 save with a growing crop onto the first plot', () => {
    const v3 = { ...legacy(farm(), 3), farmAt: now + 5000 };
    const s = parseSave(JSON.stringify(v3));
    expect(s).toMatchObject({ schemaVersion: 5, farmLevel: 1, plots: [{ crop: 'ferns', readyAt: now + 5000 }] });
    expect('farmAt' in s).toBe(false);
  });
  it('migrates former farm levels without losing crops and remains stable on reload', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const old = farm();
      old.farmLevel = level;
      old.plots = Array.from({ length: level }, () => ({ crop: 'ferns' as const, readyAt: now + 5000 }));
      const migrated = parseSave(JSON.stringify(old));
      expect(migrated.farmLevel).toBe(Math.min(level, 3));
      expect(migrated.plots.filter(Boolean)).toHaveLength(level);
      expect(parseSave(JSON.stringify(migrated))).toEqual(migrated);
    }
  });
  it('unlocks every crop within the three farm levels', () => {
    let s = farm();
    s.gold = 10_000;
    s.inventory.planks = 4;
    s = command(command(s, { type: 'upgradeFarm' }, now), { type: 'upgradeFarm' }, now);
    expect(() => command(s, { type: 'plant', crop: 'amber' }, now)).not.toThrow();
    expect(() => command(s, { type: 'plant', crop: 'feast' }, now)).not.toThrow();
  });
});
