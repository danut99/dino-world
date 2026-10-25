import { describe, expect, it } from 'vitest';
import { CROPS, FARM_LEVELS, RECIPES, UTILITY_BUILDINGS, stageLevel } from './content';
import {
  ARENA_LEVELS,
  command,
  currentTrip,
  ELEMENTS,
  EGG_SECONDS,
  eggPrice,
  eggSellPrice,
  feedCost,
  HABITAT_LEVELS,
  HATCHERY_LEVELS,
  MARKET_ELEMENTS,
  newSave,
  PORTAL_LEVELS,
  RARITIES,
  releaseGold,
  STORY_CHAPTERS,
  stats,
  WON_EGG_PRICE,
  WORKSHOP_LEVELS,
  WORLD_UNLOCK,
  type Save,
} from './game';

/** Each value is at least the previous one (strictly more with `strict`). */
const rising = (values: number[], strict = true) => values.every((v, i) => i === 0 || (strict ? v > values[i - 1] : v >= values[i - 1]));
const total = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => feedCost(from + i)).reduce((a, b) => a + b, 0);

describe('economy tables', () => {
  it('make every level of every building better and dearer than the last', () => {
    expect(FARM_LEVELS).toHaveLength(5);
    expect(rising(FARM_LEVELS.map((l) => l.plots))).toBe(true);
    expect(rising(FARM_LEVELS.map((l) => l.yield))).toBe(true);
    expect(HABITAT_LEVELS).toHaveLength(5);
    for (const key of ['capacity', 'cap', 'income'] as const) expect(rising(HABITAT_LEVELS.map((l) => l[key])), key).toBe(true);
    expect(rising(HABITAT_LEVELS.map((l) => l.kits), false)).toBe(true);
    expect(HATCHERY_LEVELS.map((l) => l.slots)).toEqual([1, 2, 3, 4]);
    expect(WORKSHOP_LEVELS.map((l) => [l.slots, l.lanes, l.speed])).toEqual([[3, 1, 1], [5, 2, 0.8], [7, 3, 0.6]]);
    expect(PORTAL_LEVELS.map((l) => l.slots)).toEqual([1, 2, 3]);
    for (const table of [FARM_LEVELS, HABITAT_LEVELS, HATCHERY_LEVELS, WORKSHOP_LEVELS, PORTAL_LEVELS, ARENA_LEVELS]) {
      expect(rising(table.map((l) => l.gold))).toBe(true);
      expect(rising(table.map((l) => l.minutes))).toBe(true);
    }
    expect([UTILITY_BUILDINGS.farm, UTILITY_BUILDINGS.workshop, UTILITY_BUILDINGS.portal, UTILITY_BUILDINGS.arena, UTILITY_BUILDINGS.market].map((b) => b.cost)).toEqual([100, 300, 500, 800, 300]);
  });
  it('opens worlds at rising prices, about 100,000 gold in all', () => {
    expect(ELEMENTS.map((e) => WORLD_UNLOCK[e.id].gold)).toEqual([0, 600, 1500, 3000, 5000, 8000, 12000, 17000, 23000, 30000]);
    expect(Object.values(WORLD_UNLOCK).reduce((n, w) => n + w.gold, 0)).toBe(100_100);
  });
  it('grows crops that cost more and take longer for more food, every one by farm level 5', () => {
    expect(CROPS.map((c) => c.level)).toEqual([1, 1, 2, 3, 4, 5]);
    expect(Math.max(...CROPS.map((c) => c.level))).toBeLessThanOrEqual(FARM_LEVELS.length);
    for (const key of ['seconds', 'food', 'cost'] as const) expect(rising(CROPS.map((c) => c[key])), key).toBe(true);
  });
  it('charges more food per level as dinosaurs grow', () => {
    expect([1, 9, 24, 49].map(feedCost)).toEqual([14, 110, 600, 2318]);
    expect(rising(Array.from({ length: 49 }, (_, i) => feedCost(i + 1)))).toBe(true);
    expect(total(1, 10)).toBe(482);
    expect(total(1, 25)).toBe(5551);
    expect(total(1, 50)).toBe(40_550);
  });
  it('makes crafting slower for better items', () => {
    const minutes = Object.fromEntries(RECIPES.map((r) => [r.id, r.seconds / 60]));
    expect(minutes).toEqual({ provisions: 3, planks: 5, blocks: 5, kit: 20, evolution: 30, lamp: 20 });
  });
  it('grows stats smoothly: 6% a level, 5% for adulthood, no cliff', () => {
    expect(stats(10, 'juvenile').hp).toBe(220);
    expect(stats(20, 'juvenile').hp).toBe(Math.round(220 * 1.6));
    expect(stats(25, 'adult').hp / stats(24, 'juvenile').hp).toBeLessThan(1.15);
  });
});

describe('selling and releasing', () => {
  it('sells a market egg back for less than it costs, and won eggs by rarity', () => {
    expect(MARKET_ELEMENTS.map(eggPrice)).toEqual([300, 600, 1000]);
    for (const element of MARKET_ELEMENTS) expect(eggSellPrice({ element })).toBe(Math.round(eggPrice(element) * 0.3));
    expect((['common', 'rare', 'epic'] as const).map((rarity) => eggSellPrice({ element: 'nature', rarity }))).toEqual([250, 400, 600]);
    expect(WON_EGG_PRICE.common).toBeLessThan(Math.min(...MARKET_ELEMENTS.map(eggPrice)));
  });
  it('pays less for releasing a dinosaur than it cost to buy and raise', () => {
    const cheapest = Math.min(...MARKET_ELEMENTS.map(eggPrice));
    expect(releaseGold({ species: 'trex', stage: 'baby' })).toBe(50);
    expect(releaseGold({ species: 'trex', stage: 'juvenile', rarity: 'rare' })).toBe(300);
    expect(releaseGold({ species: 'trex', stage: 'adult', rarity: 'epic' })).toBe(1200);
    expect(releaseGold({ species: 'boss', stage: 'juvenile', rarity: 'legendary' })).toBe(0);
    expect(releaseGold({ species: 'trex', stage: 'baby' })).toBeLessThan(cheapest);
    expect(releaseGold({ species: 'trex', stage: 'juvenile' })).toBeLessThan(cheapest + total(1, 10));
    expect(releaseGold({ species: 'trex', stage: 'adult' })).toBeLessThan(cheapest + total(1, 25));
    for (const rarity of RARITIES.filter((r) => r !== 'legendary'))
      expect(releaseGold({ species: 'trex', stage: 'baby', rarity })).toBeLessThan(WON_EGG_PRICE[rarity] + 1);
  });
  it('incubates eggs by where they came from', () => {
    expect(EGG_SECONDS).toEqual({ tutorial: 30, market: 600, story: 1200, won: 3600, boss: 21600 });
  });
});

describe('the first steps of a new game', () => {
  it('reach a juvenile champion, the portal, three fire stages and the water world without help', () => {
    const t0 = 1_800_000_000_000;
    let s: Save = newSave(t0),
      now = t0;
    const go = (c: Parameters<typeof command>[1]) => (s = command(s, c, now));
    const claim = () => go({ type: 'claimQuestEgg', questId: STORY_CHAPTERS.flatMap((c) => c.steps).find((q) => !s.questEggs.includes(q.id))!.id });
    expect(s).toMatchObject({ gold: 1000, food: 400 });
    go({ type: 'incubate' });
    now += 30_000;
    go({ type: 'hatch' });
    claim();
    go({ type: 'build', kind: 'farm', x: 5, y: 8 });
    claim();
    go({ type: 'build', kind: 'market', x: 6, y: 1 });
    claim();
    go({ type: 'feed', times: 10 });
    go({ type: 'evolve' });
    expect(s.dinos[0]).toMatchObject({ stage: 'juvenile', level: 10 });
    claim();
    go({ type: 'build', kind: 'portal', x: 8, y: 5 });
    claim();
    // The fire region's first three stages, feeding Ignis up to each stage's level; cicadas fill in the food.
    for (let stage = 1; stage <= 3; stage++) {
      while (s.dinos[0].level < stageLevel(1, stage))
        if (s.food >= feedCost(s.dinos[0].level)) go({ type: 'feed' });
        else {
          s.plots.forEach((p, plot) => p || go({ type: 'plant', crop: 'cicadas', plot }));
          now += 15 * 60_000;
          go({ type: 'harvest' });
        }
      go({ type: 'expedition', regionId: 'training', team: [s.dinos[0].id] });
      now = currentTrip(s)!.endsAt;
      go({ type: 'claimExpedition' });
    }
    expect(s.expeditionProgress.training).toBe(3);
    go({ type: 'unlockHabitat', realm: 'water' });
    expect(s.habitats.water).toBe(1);
    expect(s.gold).toBeGreaterThan(0);
    expect(now - t0).toBeLessThan(3 * 3_600_000);
  });
});
