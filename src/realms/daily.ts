import type { Save } from './game';
import type { ItemId } from './content';
import type { IconName } from './ui/Icon';

export type DailyReward = { gold?: number; food?: number; materials?: Partial<Record<ItemId, number>> };
/**
 * The pool of daily missions; each day draws DAILY_COUNT of them (see dailyQuests). `to` is where the mission is
 * played (null: the island itself), `icon` its picture in the daily panel.
 */
export type DailyQuestId = 'feed' | 'harvest' | 'plant' | 'collect' | 'startCraft' | 'craft' | 'battle' | 'win' | 'expedition';
export const DAILY_QUESTS: Record<
  DailyQuestId,
  { title: readonly [string, string]; target: number; to: 'dino' | 'farm' | 'workshop' | 'arena' | 'expedition' | null; reward: DailyReward; icon: IconName }
> = {
  feed: { title: ['Hrănește dinozaurii de 3 ori', 'Feed dinosaurs 3 times'], target: 3, to: 'dino', reward: { food: 60, gold: 40 }, icon: 'dino' },
  harvest: { title: ['Recoltează 2 straturi', 'Harvest 2 plots'], target: 2, to: 'farm', reward: { gold: 80, materials: { fiber: 5 } }, icon: 'food' },
  plant: { title: ['Plantează 3 culturi', 'Plant 3 crops'], target: 3, to: 'farm', reward: { gold: 60, materials: { fiber: 3 } }, icon: 'fiber' },
  collect: { title: ['Colectează aurul de 2 ori', 'Collect gold twice'], target: 2, to: null, reward: { food: 50, materials: { stone: 5 } }, icon: 'gold' },
  startCraft: { title: ['Pornește 2 fabricări în atelier', 'Start 2 crafts in the workshop'], target: 2, to: 'workshop', reward: { gold: 70, materials: { wood: 5 } }, icon: 'workshop' },
  craft: { title: ['Colectează un obiect fabricat', 'Collect one crafted item'], target: 1, to: 'workshop', reward: { gold: 60, materials: { wood: 5, stone: 5 } }, icon: 'chest' },
  battle: { title: ['Termină o luptă', 'Finish one battle'], target: 1, to: 'arena', reward: { food: 80, gold: 80 }, icon: 'arena' },
  win: { title: ['Câștigă 2 lupte', 'Win 2 battles'], target: 2, to: 'arena', reward: { gold: 120, food: 60 }, icon: 'trophy' },
  expedition: { title: ['Colectează recompensa unei expediții', 'Collect an expedition reward'], target: 1, to: 'expedition', reward: { gold: 100, materials: { provisions: 1 } }, icon: 'expedition' },
};
const QUEST_IDS = Object.keys(DAILY_QUESTS) as DailyQuestId[];
/** Missions offered each day. */
export const DAILY_COUNT = 3;
export type DailyState = { day: string; progress: Record<DailyQuestId, number>; claimed: DailyQuestId[]; bonus: boolean; spin: number | null };
export const DAILY_BONUS: DailyReward = { gold: 200, food: 100, materials: { crystal: 5 } };
/** `icon` is the text glyph (wiki), `art` the pixel icon drawn on the wheel. */
export const WHEEL_PRIZES: { label: string[]; reward: DailyReward; weight: number; icon: string; art: IconName }[] = [
  { label: ['100 aur', '100 gold'], reward: { gold: 100 }, weight: 25, icon: '●', art: 'gold' },
  { label: ['100 hrană', '100 food'], reward: { food: 100 }, weight: 25, icon: '❧', art: 'food' },
  { label: ['20 lemn', '20 wood'], reward: { materials: { wood: 20 } }, weight: 15, icon: '▰', art: 'wood' },
  { label: ['20 piatră', '20 stone'], reward: { materials: { stone: 20 } }, weight: 15, icon: '◆', art: 'stone' },
  { label: ['2 provizii', '2 supply packs'], reward: { materials: { provisions: 2 } }, weight: 10, icon: '◈', art: 'chest' },
  { label: ['5 cristale', '5 crystals'], reward: { materials: { crystal: 5 } }, weight: 5, icon: '♦', art: 'crystal' },
  { label: ['1 kit habitat', '1 habitat kit'], reward: { materials: { habitatKit: 1 } }, weight: 3, icon: '⌂', art: 'habitatKit' },
  { label: ['500 aur', '500 gold'], reward: { gold: 500 }, weight: 2, icon: '★', art: 'trophy' },
];
export const dailyDay = (now: number) => new Date(now).toISOString().slice(0, 10);
export function newDaily(now: number): DailyState {
  return { day: dailyDay(now), progress: Object.fromEntries(QUEST_IDS.map((id) => [id, 0])) as DailyState['progress'], claimed: [], bonus: false, spin: null };
}
export function dailyState(save: Pick<Save, 'daily' | 'updatedAt'>, now: number) {
  const effective = Math.max(now, save.updatedAt);
  return save.daily?.day === dailyDay(effective) ? save.daily : newDaily(effective);
}
/** The day's missions: the same for every player on a given UTC day, a different draw from the pool each day. */
export function dailyQuests(day: string): DailyQuestId[] {
  let seed = (Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000) * 2654435761) >>> 0;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const ids = [...QUEST_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, DAILY_COUNT);
}
/**
 * Brings a stored day up to the current mission pool: missions added since start at zero, and claims for missions
 * no longer drawn that day are dropped (their reward was already paid).
 */
export function normalizeDaily(value: DailyState) {
  if (!value || typeof value !== 'object' || !value.progress || typeof value.progress !== 'object' || !Array.isArray(value.claimed)) return value;
  const progress = Object.fromEntries(QUEST_IDS.map((id) => [id, value.progress[id] ?? 0])) as DailyState['progress'];
  if (typeof value.day !== 'string' || !Number.isFinite(Date.parse(value.day))) return { ...value, progress };
  const today = dailyQuests(value.day);
  const claimed = value.claimed.filter((id) => today.includes(id) && progress[id] >= DAILY_QUESTS[id].target);
  return { ...value, progress, claimed, bonus: value.bonus && today.every((id) => claimed.includes(id)) };
}
export function addDailyProgress(save: Save, id: DailyQuestId, amount = 1) {
  save.daily.progress[id] = Math.min(DAILY_QUESTS[id].target, save.daily.progress[id] + amount);
}
export function grantDailyReward(save: Save, reward: DailyReward) {
  save.gold += reward.gold ?? 0; save.food += reward.food ?? 0;
  for (const [id, amount] of Object.entries(reward.materials ?? {})) save.inventory[id as ItemId] += amount!;
}
export function wheelPrize(random: number) {
  let draw = Math.min(0.999999, Math.max(0, random)) * 100;
  for (let i = 0; i < WHEEL_PRIZES.length; i++) { draw -= WHEEL_PRIZES[i].weight; if (draw < 0) return i; }
  return WHEEL_PRIZES.length - 1;
}
export function validDaily(value: DailyState) {
  if (!value || typeof value.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.day) || !Number.isFinite(Date.parse(value.day)) ||
    new Date(value.day).toISOString().slice(0, 10) !== value.day || !value.progress || typeof value.progress !== 'object' ||
    !Array.isArray(value.claimed) || new Set(value.claimed).size !== value.claimed.length || typeof value.bonus !== 'boolean' ||
    !(value.spin === null || Number.isInteger(value.spin) && value.spin >= 0 && value.spin < WHEEL_PRIZES.length)) return false;
  const ids = Object.keys(DAILY_QUESTS) as DailyQuestId[];
  if (ids.some(id => !Number.isInteger(value.progress[id]) || value.progress[id] < 0 || value.progress[id] > DAILY_QUESTS[id].target)) return false;
  if (value.claimed.some(id => !dailyQuests(value.day).includes(id) || value.progress[id] !== DAILY_QUESTS[id].target)) return false;
  return !value.bonus || dailyQuests(value.day).every(id => value.claimed.includes(id));
}
