import { describe, expect, it } from 'vitest';
import {
  advance,
  COLLECTION,
  COLLECTION_MILESTONES,
  command,
  GEM_SOURCES,
  GEMS,
  gemsToFinish,
  newSave,
  parseSave,
  STORY_CHAPTERS,
  type Command,
  type Save,
} from './game';
import { DAILY_BONUS, DAILY_QUESTS, WHEEL_PRIZES } from './daily';

const now = Date.UTC(2026, 9, 25, 12);
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);
const rich = () => command(newSave(now), { type: 'addGems', amount: 490 }, now);

describe('diamonds', () => {
  it('start with a welcome gift and are added by the test grant within limits', () => {
    expect(newSave(now).gems).toBe(GEM_SOURCES.welcome);
    expect(GEM_SOURCES.welcome).toBe(10);
    expect(rich().gems).toBe(500);
    expect(() => command(newSave(now), { type: 'addGems', amount: 0 }, now)).toThrow('gems');
    expect(() => command(newSave(now), { type: 'addGems', amount: GEMS.maxGrant + 1 }, now)).toThrow('gems');
    expect(() => parseSave(JSON.stringify({ ...newSave(now), gems: -1 }))).toThrow();
  });

  it('finish a wait for ceil(1.2 × √minutes): 5 min 3, an hour 10, eight hours 27', () => {
    expect(gemsToFinish(0)).toBe(0);
    expect(gemsToFinish(-5)).toBe(0);
    expect(gemsToFinish(1)).toBe(1);
    expect(gemsToFinish(5 * 60_000)).toBe(3);
    expect(gemsToFinish(3_600_000)).toBe(10);
    expect(gemsToFinish(8 * 3_600_000)).toBe(27);
    for (const minutes of [1, 2, 7, 30, 90, 240, 600]) expect(gemsToFinish(minutes * 60_000)).toBe(Math.ceil(1.2 * Math.sqrt(minutes)));
    // Longer waits cost more in all, but less per minute.
    const prices = [5, 15, 60, 240, 480].map((m) => gemsToFinish(m * 60_000));
    expect(prices.every((p, i) => i === 0 || p > prices[i - 1])).toBe(true);
    expect(prices[4] / 480).toBeLessThan(prices[0] / 5);
  });

  it('cost the time prices of the plan', () => {
    expect(GEMS).toMatchObject({ boost: { 1: 15, 4: 45 }, spin: 8, rest: 3, restTeam: 6, reroll: 3 });
    expect('trade' in GEMS).toBe(false);
  });

  it('finish an incubating egg at once, and refuse when there are not enough', () => {
    let s = command({ ...newSave(now), gems: 0 }, { type: 'incubate' }, now);
    expect(() => command(s, { type: 'gemFinish', target: 'egg', id: s.eggs[0].id }, now)).toThrow('gems');
    s = command(s, { type: 'addGems', amount: 10 }, now);
    s = command(s, { type: 'gemFinish', target: 'egg', id: s.eggs[0].id }, now);
    expect(s.gems).toBe(9);
    expect(s.eggs[0].hatchAt).toBe(now);
    s = command(s, { type: 'hatch' }, now);
    expect(s.dinos).toHaveLength(1);
    roundTrip(s);
  });

  it('double habitat gold while a boost runs, and stack a second boost on the first', () => {
    const base = advance({ ...rich(), dinos: [{ id: 'd', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' }], champion: 'd' } as Save, now);
    const plain = advance(base, now + 3_600_000).storedGold;
    let boosted = command(base, { type: 'gemBoost', hours: 1 }, now);
    expect(boosted.gems).toBe(500 - 15);
    expect(advance(boosted, now + 3_600_000).storedGold).toBeCloseTo(plain * 2);
    // Half the next two hours are boosted: 1.5 times the plain rate.
    expect(advance(boosted, now + 2 * 3_600_000).storedGold).toBeCloseTo(advance(base, now + 2 * 3_600_000).storedGold * 1.5);
    boosted = command(boosted, { type: 'gemBoost', hours: 4 }, now);
    expect(boosted.gems).toBe(500 - 15 - 45);
    expect(boosted.boostUntil).toBe(now + 5 * 3_600_000);
    roundTrip(boosted);
  });

  it('are never traded for gold or food any more, and wake a tired champion', () => {
    let s = rich();
    for (const offer of ['gold', 'food'])
      expect(() => command(s, { type: 'gemTrade', offer } as unknown as Command, now)).toThrow('command');
    s = { ...s, dinos: [{ id: 'd', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' }], champion: 'd' };
    expect(() => command(s, { type: 'gemRest' }, now)).toThrow('rested');
    s.tired = { d: now + 60_000 };
    s = command(s, { type: 'gemRest' }, now);
    expect(s.tired.d).toBeUndefined();
    expect(s.gems).toBe(500 - GEMS.rest);
  });

  it('finish a growing farm plot, which can then be harvested', () => {
    let s = command(rich(), { type: 'build', kind: 'farm', x: 5, y: 8 }, now);
    s = command(s, { type: 'plant' }, now);
    const plot = s.plots.findIndex((p) => p);
    expect(() => command(s, { type: 'harvest', plot }, now)).toThrow('timer');
    const gems = s.gems;
    s = command(s, { type: 'gemFinish', target: 'plot', plot }, now);
    // Ferns take two minutes: ceil(1.2 × √2) = 2.
    expect(s.gems).toBe(gems - 2);
    const food = s.food;
    s = command(s, { type: 'harvest', plot }, now);
    expect(s.food).toBeGreaterThan(food);
    expect(() => command(s, { type: 'gemFinish', target: 'plot', plot }, now)).toThrow('timer');
    roundTrip(s);
  });

  it('buy extra turns of the daily wheel once the free one is used', () => {
    let s = rich();
    expect(() => command(s, { type: 'gemSpin' }, now)).toThrow('dailyFree');
    s = command(s, { type: 'spinDaily' }, now);
    const { gems } = s;
    s = command(s, { type: 'gemSpin' }, now);
    const prize = WHEEL_PRIZES[s.daily.spin!];
    expect(s.gems).toBe(gems - GEMS.spin + (prize.reward.gems ?? 0));
    roundTrip(s);
    expect(() => command({ ...s, gems: GEMS.spin - 1 }, { type: 'gemSpin' }, now)).toThrow('gems');
  });

  it('keep the save loadable after finishing a craft or an expedition early', () => {
    let s = command(rich(), { type: 'build', kind: 'workshop', x: 6, y: 1 }, now);
    s.inventory.wood = 50;
    s = command(s, { type: 'craft', recipeId: 'provisions' }, now);
    s = command(s, { type: 'craft', recipeId: 'provisions' }, now);
    const [first, second] = s.crafting;
    s = command(s, { type: 'gemFinish', target: 'craft', id: first.id }, now + 1000);
    expect(s.crafting[0].endsAt).toBe(now + 1000);
    // The job queued behind it moves up by the time saved, keeping its own length.
    expect(s.crafting[1].endsAt - s.crafting[1].startedAt).toBe(second.endsAt - second.startedAt);
    expect(s.crafting[1].startedAt).toBeLessThan(second.startedAt);
    roundTrip(s);
    s = { ...s, dinos: [{ id: 'd', species: 'trex', element: 'fire', level: 12, stage: 'juvenile', nickname: 'Ignis' }], champion: 'd', team: ['d'] };
    s = command(s, { type: 'build', kind: 'portal', x: 8, y: 5 }, now);
    s = command(s, { type: 'expedition', regionId: 'training', team: ['d'] }, now);
    s = command(s, { type: 'gemFinish', target: 'expedition', id: s.expeditions[0].id }, now + 1000);
    expect(s.expeditions[0]).toMatchObject({ endsAt: now + 1000, rushed: true });
    roundTrip(s);
  });

  it('refuse a shortened timer that diamonds did not pay for', () => {
    let s = command(rich(), { type: 'build', kind: 'workshop', x: 6, y: 1 }, now);
    s = command(s, { type: 'craft', recipeId: 'provisions' }, now);
    s = command(s, { type: 'gemFinish', target: 'craft', id: s.crafting[0].id }, now + 1000);
    expect(parseSave(JSON.stringify(s)).crafting[0].rushed).toBe(true);
    const forged = JSON.parse(JSON.stringify(s));
    delete forged.crafting[0].rushed;
    expect(() => parseSave(JSON.stringify(forged))).toThrow('Invalid crafting');
  });
});

describe('earning diamonds', () => {
  it('pays a chapter finale once, with a notice', () => {
    let s = newSave(now);
    s.dinos = [{ id: 'ignis', species: 'trex', element: 'fire', level: 14, stage: 'juvenile', nickname: 'Ignis' }];
    s.champion = 'ignis';
    s.team = ['ignis'];
    s.buildings.push({ id: 'farm', kind: 'farm', x: 5, y: 8 }, { id: 'portal', kind: 'portal', x: 8, y: 5 });
    s.portalLevel = 1;
    s.expeditionProgress = { training: 5 };
    const steps = STORY_CHAPTERS[0].steps;
    s.questEggs = steps.slice(0, -2).map((q) => q.id);
    // An ordinary goal pays no diamonds.
    s = command(s, { type: 'claimQuestEgg', questId: steps.at(-2)!.id }, now);
    expect(s.gems).toBe(GEM_SOURCES.welcome);
    expect(s.notice?.gems).toBeUndefined();
    s = command(s, { type: 'claimQuestEgg', questId: steps.at(-1)!.id }, now);
    expect(s.gems).toBe(GEM_SOURCES.welcome + GEM_SOURCES.chapter);
    expect(s.notice).toMatchObject({ gems: GEM_SOURCES.chapter });
    roundTrip(s);
    expect(() => command(s, { type: 'claimQuestEgg', questId: steps.at(-1)!.id }, now)).toThrow('locked');
    // The notice belongs to the command that earned it.
    expect(command(s, { type: 'collectAvailable' }, now).notice).toBeUndefined();
  });

  it('pays every collection milestone once, as the collection reaches it', () => {
    expect(COLLECTION_MILESTONES.map((m) => [m.count, m.gems])).toEqual([[5, 3], [10, 3], [15, 4], [20, 5], [25, 5], [30, 10]]);
    expect(COLLECTION_MILESTONES.at(-1)!.count).toBe(COLLECTION.length);
    let s = newSave(now);
    s.discovered = COLLECTION.slice(0, 4);
    s.eggs = [{ id: 'e', species: 'trex', element: 'fire', seconds: 30, hatchAt: now }];
    const gold = s.gold;
    s = command(s, { type: 'hatch' }, now);
    // trex_fire may be in the first four: then the collection did not grow.
    const reached = s.discovered.length >= 5;
    expect(s.collectionMilestones).toBe(reached ? 1 : 0);
    expect(s.gems).toBe(GEM_SOURCES.welcome + (reached ? 3 : 0));
    s.discovered = COLLECTION.slice(0, 12);
    const before = s.gems;
    s = command(s, { type: 'collectAvailable' }, now);
    expect(s.collectionMilestones).toBe(2);
    expect(s.gems).toBe(before + (reached ? 3 : 6));
    expect(s.gold).toBeGreaterThan(gold);
    roundTrip(s);
    // Nothing more until the next one.
    expect(command(s, { type: 'collectAvailable' }, now).gems).toBe(s.gems);
  });

  it('adds one diamond with the daily chest, and three from the wheel slice', () => {
    let s = newSave(now);
    for (const id of s.daily.quests) {
      s.daily.progress[id] = DAILY_QUESTS[id].target;
      s = command(s, { type: 'claimDailyQuest', quest: id }, now);
    }
    const gems = s.gems;
    s = command(s, { type: 'claimDailyBonus' }, now);
    expect(DAILY_BONUS.gems).toBe(1);
    expect(s.gems).toBe(gems + 1);
    expect(s.notice?.gems).toBe(1);
    const slice = WHEEL_PRIZES.findIndex((p) => p.reward.gems === 3);
    expect(slice).toBeGreaterThanOrEqual(0);
    expect(WHEEL_PRIZES[slice].weight).toBe(3);
    // Find a moment whose free spin lands on the diamond slice.
    let t = now;
    while (command(newSave(now), { type: 'spinDaily' }, t).daily.spin !== slice) t += 1000;
    const spun = command(newSave(now), { type: 'spinDaily' }, t);
    expect(spun.gems).toBe(GEM_SOURCES.welcome + 3);
    expect(spun.notice?.gems).toBe(3);
  });
});
