import { describe, expect, it } from 'vitest';
import { autoPlay } from './autoBattle';
import { RECIPES } from './content';
import {
  arenaTicketPrice,
  command,
  MARKET_ELEMENTS,
  storyChapter,
  type Command,
  type RealmId,
  type Save,
} from './game';
import { DAILY_QUESTS } from './daily';
import { dayTable, runBot, type BotResult } from './pacingBot';
import { playableSpecies } from './playableDinosaurs';

/*
 * The ~30-day pace (see docs/BALANCE.md): a steady player without diamonds, four short sessions a day (08, 13, 18 and
 * 22, Bucharest time), crosses the last region in the fourth week and finishes everything (story, 50 stages, 90 stars,
 * 30/30, every habitat at level 5) around day 30; three sessions a day (08, 14, 21) take a few days longer.
 */
const TABLE_DAYS = [1, 3, 7, 14, 21, 26, 30, 34];
/** Mid-game saves of the four-session player, for the zero-time checks. */
const snapshots: Save[] = [];
let fourRun: BotResult | undefined, threeRun: BotResult | undefined;
const four = () =>
  (fourRun ??= runBot({
    sessions: [8, 13, 18, 22],
    days: 60,
    onDay: (day, s) => [5, 12, 20].includes(day) && snapshots.push(structuredClone(s)),
  }));
const three = () => (threeRun ??= runBot({ sessions: [8, 14, 21], days: 60 }));

describe('pacing bot', () => {
  it('four sessions a day: the regions last past day 22 and everything is done between days 26 and 34', () => {
    const r = four();
    console.log(
      `4 sessions/day (08 13 18 22), done on day ${r.doneDay}, regions on day ${r.regionsDay}\n${dayTable(r.records, TABLE_DAYS)}`,
    );
    expect(r.lowest).toBeGreaterThanOrEqual(0);
    expect(r.regionsDay).not.toBeNull();
    expect(r.regionsDay!).toBeGreaterThanOrEqual(22);
    expect(r.doneDay).not.toBeNull();
    expect(r.doneDay!).toBeGreaterThanOrEqual(26);
    expect(r.doneDay!).toBeLessThanOrEqual(34);
    expect(storyChapter(r.save)).toBeNull();
    // Diamonds come slowly (about 220 in a month) and the bot never spends one.
    const earned = r.records.at(-1)!.gemsEarned;
    expect(earned).toBeGreaterThan(180);
    expect(earned).toBeLessThan(260);
    expect(r.save.gems).toBe(earned);
    // Unlocks keep coming: every week opens worlds, crosses regions and wins stars.
    const at = (day: number) => r.records.find((x) => x.day === day)!;
    for (const [a, b] of [
      [1, 7],
      [7, 14],
      [14, 21],
    ]) {
      expect(at(b).worlds, `worlds ${a}→${b}`).toBeGreaterThan(at(a).worlds);
      expect(at(b).regions, `regions ${a}→${b}`).toBeGreaterThan(at(a).regions);
      expect(at(b).stars, `stars ${a}→${b}`).toBeGreaterThan(at(a).stars);
    }
  }, 120_000);

  it('three sessions a day finish by day 40', () => {
    const r = three();
    console.log(
      `3 sessions/day (08 14 21), done on day ${r.doneDay}, regions on day ${r.regionsDay}\n${dayTable(r.records, [...TABLE_DAYS, 38])}`,
    );
    expect(r.lowest).toBeGreaterThanOrEqual(0);
    expect(r.doneDay).not.toBeNull();
    expect(r.doneDay!).toBeLessThanOrEqual(40);
    expect(r.regionsDay!).toBeGreaterThanOrEqual(22);
  }, 120_000);
});

/** Applies commands one after another at the same moment; a refused one changes nothing. */
function apply(s: Save, steps: ((s: Save) => Command | 'fight' | null)[], now: number) {
  for (const step of steps) {
    const c = step(s);
    if (!c) continue;
    try {
      s = c === 'fight' ? (s.battle ? autoPlay(s, now) : s) : command(s, c, now);
    } catch {
      // Refused: nothing changes.
    }
  }
  return s;
}
/** Gold (arena tickets counted at their price, since buying one only swaps gold for it), food and items. */
const total = (s: Save) => ({
  gold:
    s.gold +
    s.storedGold +
    (Object.entries(s.arenaTickets) as [RealmId, number][]).reduce(
      (n, [realm, count]) => n + count * arenaTicketPrice(realm),
      0,
    ),
  food: s.food,
  items: Object.values(s.inventory).reduce((a, b) => a + b, 0),
});
/** Every cheap command (or short sequence) a player could hammer without letting time pass. */
function loops(s0: Save): [string, ((s: Save) => Command | 'fight' | null)[]][] {
  const fire = MARKET_ELEMENTS[0];
  return [
    ['collect', [() => ({ type: 'collect' })]],
    ['collectAvailable', [() => ({ type: 'collectAvailable' })]],
    ['harvest', [() => ({ type: 'harvest' })]],
    ['claim expeditions', s0.expeditions.map((x) => () => ({ type: 'claimExpedition', runId: x.id }))],
    ['claim crafts', s0.crafting.map((j) => () => ({ type: 'claimCraft', jobId: j.id }))],
    ['claim story', [(s) => (storyChapter(s) ? { type: 'claimQuestEgg', questId: storyChapter(s)!.step.id } : null)]],
    [
      'daily',
      [
        () => ({ type: 'spinDaily' }),
        ...(Object.keys(DAILY_QUESTS) as (keyof typeof DAILY_QUESTS)[]).map(
          (quest) => () => ({ type: 'claimDailyQuest', quest }) as Command,
        ),
        () => ({ type: 'claimDailyBonus' }),
      ],
    ],
    ['sell eggs', s0.eggs.map((e) => () => ({ type: 'sellEgg', eggId: e.id }))],
    // The egg just bought and the job just queued (named after the revision that made them), never older ones: undoing
    // an older job only gives back what it took.
    [
      'buy and sell an egg',
      [
        () => ({ type: 'buyEgg', species: playableSpecies(fire)[0], element: fire }),
        (s) => ({ type: 'sellEgg', eggId: `egg-${s.revision}` }),
      ],
    ],
    ...RECIPES.map((r): [string, ((s: Save) => Command | null)[]] => [
      `craft and cancel ${r.id}`,
      [
        () => ({ type: 'craft', recipeId: r.id }),
        (s) =>
          s.crafting.some((j) => j.id === `craft-${s.revision}`)
            ? { type: 'cancelCraft', jobId: `craft-${s.revision}` }
            : null,
      ],
    ]),
    [
      'buy a ticket and fight',
      [
        () => ({ type: 'buyArenaTicket', realm: fire, quantity: 1 }),
        () => ({ type: 'battle', encounterId: 'arena-fire-1' }),
        () => 'fight',
        () => ({ type: 'claim' }),
      ],
    ],
    ['plant and harvest', [() => ({ type: 'plant', crop: 'ferns' }), () => ({ type: 'harvest' })]],
  ];
}

describe('no resources from nothing', () => {
  it('repeating any cheap command at the same moment pays at most once', () => {
    four();
    expect(snapshots).toHaveLength(3);
    // Days 5, 12 and 20, right after the evening session and the next morning (crops, trips and crafts ready).
    for (const s0 of snapshots)
      for (const now of [s0.updatedAt, s0.updatedAt + 10 * 3_600_000])
        for (const [name, steps] of loops(s0)) {
          const once = apply(s0, steps, now),
            twice = apply(once, steps, now),
            five = apply(apply(apply(twice, steps, now), steps, now), steps, now);
          const [a, b, c] = [total(once), total(twice), total(five)];
          // The second time (and every later one) brings no gold, food or items of its own (beyond float rounding).
          for (const key of ['gold', 'food', 'items'] as const) {
            expect(b[key], `${name}: ${key} at ${new Date(now).toISOString()}`).toBeLessThanOrEqual(a[key] + 1e-6);
            expect(c[key], `${name} ×5: ${key} at ${new Date(now).toISOString()}`).toBeLessThanOrEqual(b[key] + 1e-6);
          }
        }
  }, 120_000);
});
