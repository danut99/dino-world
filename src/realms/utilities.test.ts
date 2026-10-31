import { describe, expect, it } from 'vitest';
import { advance, command, decorCount, farmYield, newSave, parseSave, tripSpeed, type Save } from './game';
import { ELEMENTS } from './game';
import { REGIONS } from './content';
const now = 1_800_000_000_000;
function withHero(s: Save): Save {
  s.eggs = [];
  s.dinos = [{ id: 'ignis', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' }];
  s.champion = 'ignis';
  s.team = ['ignis'];
  s.discovered = ['trex_fire'];
  return s;
}
function built(): Save {
  let s = newSave(now);
  s.gold = 5000;
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
  it('gives every elemental world one expedition region, chained in the order of the worlds', () => {
    expect(REGIONS).toHaveLength(10);
    expect(REGIONS.map((r) => r.element)).toEqual(ELEMENTS.map((e) => e.id));
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(10);
    // Every island sits on the map.
    for (const r of REGIONS) expect(r.x >= 0 && r.x <= 100 && r.y >= 0 && r.y <= 100, r.id).toBe(true);
  });
  it('places five utilities at their prices and preserves all of them through reload', () => {
    const s = built();
    expect(s.gold).toBe(5000 - 100 - 300 - 500 - 800);
    expect(s.buildings).toHaveLength(5);
    expect(s.portalLevel).toBe(1);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    expect(() => command(s, { type: 'build', kind: 'workshop', x: 0, y: 0 }, now)).toThrow();
    expect(() => command(s, { type: 'move', id: 'arena', x: 5, y: 8 }, now)).toThrow();
  });
  it('reserves materials, refunds only queued jobs, and adjusts later start times', () => {
    let s = built();
    s.inventory.wood = 6;
    for (let i = 0; i < 3; i++) s = command(s, { type: 'craft', recipeId: 'provisions' }, now);
    expect(s.inventory.wood).toBe(0);
    expect(() => command(s, { type: 'craft', recipeId: 'provisions' }, now)).toThrow();
    expect(() => command(s, { type: 'cancelCraft', jobId: s.crafting[0].id }, now)).toThrow();
    s = command(s, { type: 'cancelCraft', jobId: s.crafting[1].id }, now);
    expect(s.inventory.wood).toBe(2);
    expect(s.crafting[1].startedAt).toBe(now + 180_000);
    expect(s.crafting[1].endsAt).toBe(now + 360_000);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('turns old planks, blocks and their jobs back into wood and stone on load', () => {
    const s = built();
    const old = JSON.parse(JSON.stringify(s));
    old.inventory = { ...old.inventory, planks: 3, blocks: 2 };
    old.crafting = [
      { id: 'p', recipeId: 'planks', startedAt: now, endsAt: now + 300_000 },
      { id: 'b', recipeId: 'blocks', startedAt: now + 300_000, endsAt: now + 600_000 },
    ];
    const loaded = parseSave(JSON.stringify(old));
    expect(loaded.inventory).toEqual({
      ...s.inventory,
      wood: s.inventory.wood + 15 + 10,
      stone: s.inventory.stone + 10 + 10,
    });
    expect(loaded.crafting).toEqual([]);
    expect(parseSave(JSON.stringify(loaded))).toEqual(loaded);
  });
  it('collects offline farm and queued outputs once, including after refresh', () => {
    let s = command(built(), { type: 'plant' }, now);
    s = command(s, { type: 'craft', recipeId: 'provisions' }, now);
    s = command(s, { type: 'craft', recipeId: 'provisions' }, now);
    const loaded = parseSave(JSON.stringify(s));
    expect(() => command(loaded, { type: 'claimCraft', jobId: s.crafting[0].id }, now + 179_999)).toThrow();
    s = command(loaded, { type: 'collectAvailable' }, now + 601_000);
    expect(s.inventory.provisions).toBe(2);
    expect(s.food).toBe(400 - 2 * 30 + 10);
    const again = command(s, { type: 'collectAvailable' }, now + 601_000);
    expect(again.inventory).toEqual(s.inventory);
    expect(again.food).toBe(s.food);
    expect(() => command(again, { type: 'claimCraft', jobId: loaded.crafting[0].id }, now + 601_000)).toThrow();
  });
  it('fights only in the arena and grants first-victory materials exactly once', () => {
    let s = withHero(built());
    s.dinos[0].level = 15;
    s.arenaTickets.fire = 3;
    // Expeditions are timed trips, never battles, so the first one cannot be farmed as a fight.
    expect(() => command(s, { type: 'battle', encounterId: 'training' }, now)).toThrow('encounter');
    expect(() => command(s, { type: 'battle', encounterId: 'ruins' }, now)).toThrow('encounter');
    expect(() => command(s, { type: 'battle' }, now)).toThrow('encounter');
    s = command(s, { type: 'battle', encounterId: 'arena-fire-1' }, now);
    while (!s.battle?.result) s = command(s, { type: 'action', action: 'basic' }, now);
    s = command(parseSave(JSON.stringify(s)), { type: 'claim' }, now);
    expect(s.cleared).toEqual(['arena-fire-1']);
    expect(s.inventory.wood).toBe(45);
    expect(() => command(s, { type: 'claim' }, now)).toThrow();
    // A repeat pays a quarter of the first win, and half of that gold and food once the fight has 3★; the team
    // rests two minutes after an apprentice win.
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, now)).toThrow('tired');
    expect(s.stars['arena-fire-1']).toBe(3);
    const mastered = command(s, { type: 'battle', encounterId: 'arena-fire-1' }, now + 2 * 60_000).battle!.reward;
    expect(mastered).toMatchObject({ gold: 25, food: 10, materials: { wood: 4, stone: 3 } });
    const repeat = command(
      { ...s, stars: { 'arena-fire-1': 2 } },
      { type: 'battle', encounterId: 'arena-fire-1' },
      now + 2 * 60_000,
    ).battle!.reward;
    expect(repeat).toMatchObject({ gold: 50, food: 20, materials: { wood: 4, stone: 3 } });
  });
  it('rejects invalid crafting imports and applies income upgrades prospectively', () => {
    let s = withHero(built());
    s.inventory.habitatKit = 1;
    s = command(s, { type: 'upgradeHabitat', realm: 'fire' }, now + 3_600_000);
    // Paid now, built in 15 minutes: the habitat earns at its old level until then.
    expect(s).toMatchObject({
      storedGold: 8,
      gold: 3300 - 900,
      habitats: { fire: 1 },
      inventory: { habitatKit: 0 },
      construction: {
        target: 'habitat:fire',
        level: 2,
        startedAt: now + 3_600_000,
        endsAt: now + 3_600_000 + 15 * 60_000,
      },
    });
    const later = advance(s, now + 7_200_000);
    expect(later.habitats.fire).toBe(2);
    expect(later.construction).toBeNull();
    expect(later.storedGold).toBeCloseTo(8 + 8 * 0.25 + 8 * 1.15 * 0.75);
    expect(() => command(s, { type: 'upgradeHabitat', realm: 'fire' }, now + 3_600_000)).toThrow('builderBusy');
    expect(() => command(s, { type: 'upgradeHabitat', realm: 'fire' }, now + 7_200_000)).toThrow('gold');
    expect(() => parseSave(JSON.stringify({ ...s, inventory: { ...s.inventory, wood: -1 } }))).toThrow();
    expect(() =>
      parseSave(
        JSON.stringify({ ...s, crafting: [{ id: 'bad', recipeId: 'provisions', startedAt: now, endsAt: now + 1 }] }),
      ),
    ).toThrow();
  });
  it('adds a lamp at a time, up to five, each paying 5% more habitat gold', () => {
    let s = withHero(built());
    s.inventory.lamp = 6;
    const base = advance(s, now + 3_600_000).storedGold;
    for (let i = 0; i < 5; i++) s = command(s, { type: 'placeDecor', kind: 'lamp' }, now);
    expect(() => command(s, { type: 'placeDecor', kind: 'lamp' }, now)).toThrow('maxLevel');
    expect(decorCount(s, 'lamp')).toBe(5);
    expect(s.inventory.lamp).toBe(1);
    expect(advance(s, now + 3_600_000).storedGold).toBeCloseTo(base * 1.25);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('moves lamps from saves made before decorations into the decor list', () => {
    let s = withHero(built());
    s.inventory.lamp = 1;
    s = command(s, { type: 'placeDecor', kind: 'lamp' }, now);
    const { x, y } = s.decor[0];
    const old = { ...s, decor: undefined, lamps: 2, lampSpots: [{ x, y }] };
    const loaded = parseSave(JSON.stringify(old));
    expect(decorCount(loaded, 'lamp')).toBe(2);
    expect(loaded.decor[0]).toEqual({ kind: 'lamp', x, y });
    expect(loaded).not.toHaveProperty('lamps');
    expect(loaded).not.toHaveProperty('lampSpots');
  });
  it('makes harvests bigger with scarecrows and trips shorter with signposts', () => {
    let s = withHero(built());
    s.inventory.scarecrow = 2;
    s.inventory.signpost = 2;
    for (const kind of ['scarecrow', 'scarecrow', 'signpost', 'signpost'] as const)
      s = command(s, { type: 'placeDecor', kind }, now);
    expect(farmYield(1, 'feast', decorCount(s, 'scarecrow'))).toBe(Math.round(350 * 1.1));
    expect(tripSpeed(s)).toBeCloseTo(0.9);
    expect(() => command(s, { type: 'placeDecor', kind: 'signpost' }, now)).toThrow('materials');
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
});
describe('farm levels, plots and crops', () => {
  const farm = () => command(newSave(now), { type: 'build', x: 5, y: 8 }, now);
  /** Upgrades the farm and finishes the build at once with diamonds. */
  const upgradeFarm = (s: Save) =>
    [{ type: 'upgradeFarm' }, { type: 'addGems', amount: 100 }, { type: 'gemFinish', target: 'construction' }].reduce(
      (x, c) => command(x, c as Parameters<typeof command>[1], now),
      s,
    );
  it('has five levels, adds a plot at each one and raises every harvest', () => {
    let s = farm();
    expect(s.plots).toHaveLength(2);
    s.gold = 30_000;
    s.inventory = { ...s.inventory, wood: 200, stone: 150, crystal: 10 };
    s = upgradeFarm(s);
    expect(s).toMatchObject({ farmLevel: 2, gold: 29_600, plots: [null, null, null] });
    s = upgradeFarm(s);
    expect(s).toMatchObject({ farmLevel: 3, gold: 28_100, inventory: { wood: 170 } });
    s = upgradeFarm(s);
    expect(s).toMatchObject({ farmLevel: 4, gold: 23_100, inventory: { wood: 110, stone: 110 } });
    s = upgradeFarm(s);
    expect(s).toMatchObject({ farmLevel: 5, gold: 11_100, inventory: { wood: 10, stone: 30, crystal: 0 } });
    expect(s.plots).toHaveLength(6);
    expect(() => command(s, { type: 'upgradeFarm' }, now)).toThrow('maxLevel');
    for (let i = 0; i < 6; i++) s = command(s, { type: 'plant' }, now);
    expect(() => command(s, { type: 'plant' }, now)).toThrow('plots');
    const food = s.food;
    s = command(s, { type: 'harvest' }, now + 300_000);
    expect(s.food).toBe(food + 6 * 10 * 2.5);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('opens all three crops at once: longer ones cost more and give more food', () => {
    let s = farm();
    s = command(s, { type: 'plant', crop: 'cicadas' }, now);
    expect(s.gold).toBe(900 - 5);
    expect(() => command(s, { type: 'harvest' }, now + 3_599_999)).toThrow();
    s = command(s, { type: 'harvest', plot: 0 }, now + 3_600_000);
    expect(s.food).toBe(460);
    expect(() => command(s, { type: 'plant', crop: 'feast' }, now)).not.toThrow();
  });
  it('picks a growing crop early for 70% of the food grown so far and frees the plot', () => {
    let s = command(farm(), { type: 'plant', crop: 'feast' }, now);
    const food = s.food;
    s = command(s, { type: 'harvestEarly', plot: 0 }, now + 4 * 3_600_000);
    expect(s.food).toBe(food + Math.floor(350 * 0.5 * 0.7));
    expect(s.plots[0]).toBeNull();
    expect(() => command(s, { type: 'harvestEarly', plot: 0 }, now)).toThrow('timer');
    s = command(s, { type: 'plant', crop: 'ferns', plot: 0 }, now);
    expect(() => command(s, { type: 'harvestEarly', plot: 0 }, now + 300_000)).toThrow('timer');
  });
  it('multiplies every harvest with the farm level', () => {
    expect([1, 2, 3, 4, 5].map((level) => farmYield(level, 'feast'))).toEqual([350, 438, 525, 700, 875]);
  });
  it('replants crops from older saves as the closest current crop', () => {
    const s = farm();
    s.plots = [
      { crop: 'ginkgo' as never, readyAt: now },
      { crop: 'amber' as never, readyAt: now },
    ];
    expect(parseSave(JSON.stringify(s)).plots).toEqual([
      { crop: 'cicadas', readyAt: now },
      { crop: 'feast', readyAt: now },
    ]);
  });
});
