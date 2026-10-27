import type { Save } from './game';
import type { ItemId } from './content';
import type { IconName } from './ui/Icon';
import { PATROL } from './expeditionRules';

/**
 * A daily reward: gold, food and materials; diamonds (never scaled); `tickets` arena tickets of a world drawn at
 * random among the open leagues (the reducer draws it).
 */
export type DailyReward = {
  gold?: number;
  food?: number;
  materials?: Partial<Record<ItemId, number>>;
  gems?: number;
  tickets?: number;
};
/**
 * The pool of daily missions; each day draws DAILY_COUNT of them among those the player can do (see dailyQuests).
 * `to` is where the mission is played (null: the island itself), `icon` its picture in the daily panel, `available`
 * whether the player can do it yet (the building it needs, a dinosaur old enough, an open patrol).
 */
export type DailyQuestId =
  'feed' | 'harvest' | 'plant' | 'collect' | 'startCraft' | 'craft' | 'battle' | 'win' | 'expedition' | 'patrol';
type QuestSave = Pick<Save, 'dinos' | 'eggs' | 'buildings' | 'portalLevel' | 'expeditionProgress'>;
const built = (s: QuestSave, kind: string) => s.buildings.some((b) => b.kind === kind);
const fighter = (s: QuestSave) => s.dinos.some((d) => d.stage !== 'baby');
export const DAILY_QUESTS: Record<
  DailyQuestId,
  {
    title: readonly [string, string];
    target: number;
    to: 'dino' | 'farm' | 'workshop' | 'arena' | 'expedition' | null;
    reward: DailyReward;
    icon: IconName;
    available: (s: QuestSave) => boolean;
  }
> = {
  feed: {
    title: ['Hrănește dinozaurii de 3 ori', 'Feed dinosaurs 3 times'],
    target: 3,
    to: 'dino',
    reward: { food: 60, gold: 40 },
    icon: 'dino',
    available: (s) => s.dinos.length > 0 || s.eggs.length > 0,
  },
  harvest: {
    title: ['Recoltează 2 straturi', 'Harvest 2 plots'],
    target: 2,
    to: 'farm',
    reward: { gold: 80, materials: { fiber: 5 } },
    icon: 'food',
    available: (s) => built(s, 'farm'),
  },
  plant: {
    title: ['Plantează 3 culturi', 'Plant 3 crops'],
    target: 3,
    to: 'farm',
    reward: { gold: 60, materials: { fiber: 3 } },
    icon: 'fiber',
    available: (s) => built(s, 'farm'),
  },
  collect: {
    title: ['Colectează aurul de 2 ori', 'Collect gold twice'],
    target: 2,
    to: null,
    reward: { food: 50, materials: { stone: 5 } },
    icon: 'gold',
    available: (s) => s.dinos.length > 0 || s.eggs.length > 0,
  },
  startCraft: {
    title: ['Pornește 2 fabricări în atelier', 'Start 2 crafts in the workshop'],
    target: 2,
    to: 'workshop',
    reward: { gold: 70, materials: { wood: 5 } },
    icon: 'workshop',
    available: (s) => built(s, 'workshop'),
  },
  craft: {
    title: ['Colectează un obiect fabricat', 'Collect one crafted item'],
    target: 1,
    to: 'workshop',
    reward: { gold: 60, materials: { wood: 5, stone: 5 } },
    icon: 'chest',
    available: (s) => built(s, 'workshop'),
  },
  battle: {
    title: ['Termină o luptă', 'Finish one battle'],
    target: 1,
    to: 'arena',
    reward: { food: 80, gold: 80 },
    icon: 'arena',
    available: (s) => built(s, 'arena') && fighter(s),
  },
  win: {
    title: ['Câștigă 2 lupte', 'Win 2 battles'],
    target: 2,
    to: 'arena',
    reward: { gold: 120, food: 60 },
    icon: 'trophy',
    available: (s) => built(s, 'arena') && fighter(s),
  },
  expedition: {
    title: ['Colectează recompensa unei expediții', 'Collect an expedition reward'],
    target: 1,
    to: 'expedition',
    reward: { gold: 100, materials: { provisions: 1 } },
    icon: 'expedition',
    available: (s) => s.portalLevel > 0 && fighter(s),
  },
  patrol: {
    title: ['Încheie o patrulă', 'Finish a patrol'],
    target: 1,
    to: 'expedition',
    reward: { gold: 120, food: 40, materials: { provisions: 1 } },
    icon: 'target',
    available: (s) =>
      s.portalLevel > 0 &&
      fighter(s) &&
      Object.values(s.expeditionProgress).some((n) => (n ?? 0) >= PATROL.unlockStage),
  },
};
const QUEST_IDS = Object.keys(DAILY_QUESTS) as DailyQuestId[];
/** Missions offered each day. */
export const DAILY_COUNT = 3;
/** Free mission rerolls a day; each one after costs diamonds (GEMS.reroll). */
export const DAILY_REROLLS_FREE = 1;
/** Missions drawn when a newcomer cannot do three yet (the farm comes with the second story goal). */
const STARTER_QUESTS: DailyQuestId[] = ['feed', 'collect', 'plant', 'harvest'];
/** The missions this player can do now. */
export const availableQuests = (s: QuestSave) => QUEST_IDS.filter((id) => DAILY_QUESTS[id].available(s));
/**
 * Daily rewards grow with the story: ×(1 + 0.15 · (chapter − 1)) on gold, food and materials, so chapter X pays
 * 2.35 times chapter I. Diamonds and tickets stay as they are.
 */
export const dailyScale = (chapter: number) => Math.round((1 + 0.15 * (Math.max(1, chapter) - 1)) * 100) / 100;
export function scaleDailyReward(reward: DailyReward, chapter: number): DailyReward {
  const k = dailyScale(chapter),
    up = (n?: number) => (n ? Math.round(n * k) : undefined);
  return {
    ...reward,
    ...(reward.gold ? { gold: up(reward.gold) } : {}),
    ...(reward.food ? { food: up(reward.food) } : {}),
    ...(reward.materials
      ? { materials: Object.fromEntries(Object.entries(reward.materials).map(([id, n]) => [id, up(n)])) }
      : {}),
  };
}
/**
 * One day of daily rewards: the missions drawn (`quests`), their progress and claims, the completion bonus, the last
 * wheel prize (`spin`) and how many turns were taken (`spins`), the mission rerolls and the patrols claimed today.
 */
export type DailyState = {
  day: string;
  quests: DailyQuestId[];
  progress: Record<DailyQuestId, number>;
  claimed: DailyQuestId[];
  bonus: boolean;
  spin: number | null;
  spins: number;
  rerolls: number;
  patrols: number;
  /** Petting, training and treasures found today; `treasureAt` is when the last treasure was found. */
  pets: number;
  trainings: number;
  treasures: number;
  treasureAt: number;
  /** Duels won today that paid their reward (see DUEL), and the rivals they were won against. */
  duels: number;
  duelRivals: string[];
};
/** The chest for all three missions of the day (scaled with the chapter, its diamond as it is). */
export const DAILY_BONUS: DailyReward = { gold: 200, food: 100, materials: { crystal: 5 }, gems: 1 };
/**
 * The daily wheel, in percent (100 in all). The ticket slice gives two arena tickets of a world drawn among the
 * open leagues; it took its 6% from the common prizes (2 points each from gold and food, 1 each from wood and stone).
 * `icon` is the text glyph (wiki), `art` the pixel icon drawn on the wheel.
 */
export const WHEEL_PRIZES: { label: string[]; reward: DailyReward; weight: number; icon: string; art: IconName }[] = [
  { label: ['150 aur', '150 gold'], reward: { gold: 150 }, weight: 22, icon: '●', art: 'gold' },
  { label: ['100 hrană', '100 food'], reward: { food: 100 }, weight: 22, icon: '❧', art: 'food' },
  { label: ['20 lemn', '20 wood'], reward: { materials: { wood: 20 } }, weight: 13, icon: '▰', art: 'wood' },
  { label: ['20 piatră', '20 stone'], reward: { materials: { stone: 20 } }, weight: 13, icon: '◆', art: 'stone' },
  {
    label: ['2 provizii', '2 supply packs'],
    reward: { materials: { provisions: 2 } },
    weight: 10,
    icon: '◈',
    art: 'chest',
  },
  { label: ['2 bilete de arenă', '2 arena tickets'], reward: { tickets: 2 }, weight: 6, icon: '⚔', art: 'arena' },
  { label: ['6 cristale', '6 crystals'], reward: { materials: { crystal: 6 } }, weight: 6, icon: '♦', art: 'crystal' },
  {
    label: ['1 cristal de evoluție', '1 evolution crystal'],
    reward: { materials: { evolutionCrystal: 1 } },
    weight: 3,
    icon: '✧',
    art: 'evolutionCrystal',
  },
  {
    label: ['1 kit habitat', '1 habitat kit'],
    reward: { materials: { habitatKit: 1 } },
    weight: 2,
    icon: '⌂',
    art: 'habitatKit',
  },
  { label: ['3 diamante', '3 diamonds'], reward: { gems: 3 }, weight: 3, icon: '💎', art: 'star' },
];
/** Before the arena is built, the ticket slice pays gold and food instead (same slice, same odds). */
const NO_ARENA_PRIZE: (typeof WHEEL_PRIZES)[number] = {
  label: ['200 aur + 100 hrană', '200 gold + 100 food'],
  reward: { gold: 200, food: 100 },
  weight: 6,
  icon: '●',
  art: 'gold',
};
export const wheelPrizes = (s: Pick<Save, 'buildings'>) =>
  s.buildings.some((b) => b.kind === 'arena')
    ? WHEEL_PRIZES
    : WHEEL_PRIZES.map((p) => (p.reward.tickets ? NO_ARENA_PRIZE : p));
/** Days (and weeks) follow the clock in Romania, where the players are: a new day starts at midnight in Bucharest. */
const bucharest = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const dailyDay = (now: number) => bucharest.format(now);
const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
/** The Monday (as YYYY-MM-DD) of the Bucharest week `now` falls in. */
export function weekId(now: number) {
  const day = dailyDay(now);
  return shiftDay(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
}
/** When the day `day` ends: the next midnight in Bucharest (UTC+2 in winter, UTC+3 in summer). */
export function dailyReset(day: string) {
  const next = shiftDay(day, 1);
  return (
    [3, 2]
      .map((h) => Date.parse(`${next}T00:00:00Z`) - h * 3600000)
      .find((t) => dailyDay(t) === next && dailyDay(t - 1) === day) ?? Date.parse(`${next}T00:00:00Z`)
  );
}
/** Monday 00:00 in Bucharest of the week `now` falls in (ms). */
export const weekStart = (now: number) => dailyReset(shiftDay(weekId(now), -1));
/** A fresh day: its missions are drawn among those `save` can do (any mission without a save). */
export function newDaily(now: number, save?: QuestSave): DailyState {
  const day = dailyDay(now);
  return {
    day,
    quests: dailyQuests(day, save && ((id) => DAILY_QUESTS[id].available(save))),
    progress: Object.fromEntries(QUEST_IDS.map((id) => [id, 0])) as DailyState['progress'],
    claimed: [],
    bonus: false,
    spin: null,
    spins: 0,
    rerolls: 0,
    patrols: 0,
    pets: 0,
    trainings: 0,
    treasures: 0,
    treasureAt: 0,
    duels: 0,
    duelRivals: [],
  };
}
export function dailyState(save: Pick<Save, 'daily' | 'updatedAt'> & QuestSave, now: number) {
  const effective = Math.max(now, save.updatedAt);
  return save.daily?.day === dailyDay(effective) ? save.daily : newDaily(effective, save);
}
/**
 * The day's missions, drawn once when the day starts: the pool is shuffled by the day (the same order for every
 * player), then the first three the player can do are taken. A newcomer who cannot do three yet gets the starter
 * missions (feeding, collecting, the farm).
 */
export function dailyQuests(day: string, available: (id: DailyQuestId) => boolean = () => true): DailyQuestId[] {
  let seed = (Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000) * 2654435761) >>> 0;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const ids = [...QUEST_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const open = ids.filter(available);
  return [...open, ...STARTER_QUESTS.filter((id) => !open.includes(id))].slice(0, DAILY_COUNT);
}
/**
 * Brings a stored day up to the current mission pool: missions and counters added since start at zero, and claims
 * for missions not drawn that day are dropped (their reward was already paid).
 */
export function normalizeDaily(value: DailyState) {
  if (
    !value ||
    typeof value !== 'object' ||
    !value.progress ||
    typeof value.progress !== 'object' ||
    !Array.isArray(value.claimed)
  )
    return value;
  const progress = Object.fromEntries(QUEST_IDS.map((id) => [id, value.progress[id] ?? 0])) as DailyState['progress'];
  const counters = {
    spins: value.spins ?? (value.spin === null ? 0 : 1),
    rerolls: value.rerolls ?? 0,
    patrols: value.patrols ?? 0,
    pets: value.pets ?? 0,
    trainings: value.trainings ?? 0,
    treasures: value.treasures ?? 0,
    treasureAt: value.treasureAt ?? 0,
    duels: value.duels ?? 0,
    duelRivals: value.duelRivals ?? [],
  };
  if (typeof value.day !== 'string' || !Number.isFinite(Date.parse(value.day)))
    return { ...value, ...counters, progress };
  const quests = Array.isArray(value.quests) ? value.quests : dailyQuests(value.day);
  const claimed = value.claimed.filter((id) => quests.includes(id) && progress[id] >= DAILY_QUESTS[id].target);
  return {
    ...value,
    ...counters,
    quests,
    progress,
    claimed,
    bonus: value.bonus && quests.every((id) => claimed.includes(id)),
  };
}
export function addDailyProgress(save: Save, id: DailyQuestId, amount = 1) {
  save.daily.progress[id] = Math.min(DAILY_QUESTS[id].target, save.daily.progress[id] + amount);
}
export function grantDailyReward(save: Save, reward: DailyReward) {
  save.gold += reward.gold ?? 0;
  save.food += reward.food ?? 0;
  for (const [id, amount] of Object.entries(reward.materials ?? {})) save.inventory[id as ItemId] += amount!;
}
export function wheelPrize(random: number) {
  let draw = Math.min(0.999999, Math.max(0, random)) * 100;
  for (let i = 0; i < WHEEL_PRIZES.length; i++) {
    draw -= WHEEL_PRIZES[i].weight;
    if (draw < 0) return i;
  }
  return WHEEL_PRIZES.length - 1;
}
export function validDaily(value: DailyState) {
  const count = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 1000;
  if (
    !value ||
    typeof value.day !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.day) ||
    !Number.isFinite(Date.parse(value.day)) ||
    new Date(value.day).toISOString().slice(0, 10) !== value.day ||
    !value.progress ||
    typeof value.progress !== 'object' ||
    !Array.isArray(value.quests) ||
    value.quests.length !== DAILY_COUNT ||
    new Set(value.quests).size !== DAILY_COUNT ||
    value.quests.some((id) => !QUEST_IDS.includes(id)) ||
    !count(value.spins) ||
    !count(value.rerolls) ||
    !count(value.patrols) ||
    !count(value.pets) ||
    !count(value.trainings) ||
    !count(value.treasures) ||
    !count(value.duels) ||
    !Array.isArray(value.duelRivals) ||
    value.duelRivals.length > 50 ||
    value.duelRivals.some((id) => typeof id !== 'string' || id.length > 64) ||
    !(typeof value.treasureAt === 'number' && Number.isFinite(value.treasureAt) && value.treasureAt >= 0) ||
    !Array.isArray(value.claimed) ||
    new Set(value.claimed).size !== value.claimed.length ||
    typeof value.bonus !== 'boolean' ||
    !(value.spin === null || (Number.isInteger(value.spin) && value.spin >= 0 && value.spin < WHEEL_PRIZES.length)) ||
    (value.spin === null) !== (value.spins === 0)
  )
    return false;
  if (
    QUEST_IDS.some(
      (id) =>
        !Number.isInteger(value.progress[id]) || value.progress[id] < 0 || value.progress[id] > DAILY_QUESTS[id].target,
    )
  )
    return false;
  if (value.claimed.some((id) => !value.quests.includes(id) || value.progress[id] !== DAILY_QUESTS[id].target))
    return false;
  return !value.bonus || value.quests.every((id) => value.claimed.includes(id));
}
