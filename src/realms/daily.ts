import type { Save } from './game';
import type { ItemId } from './content';

export type DailyReward = { gold?: number; food?: number; materials?: Partial<Record<ItemId, number>> };
export const DAILY_QUESTS = {
  feed: { title: ['Hrănește dinozaurii de 3 ori', 'Feed dinosaurs 3 times'], target: 3, to: 'dino', reward: { food: 60, gold: 40 } },
  harvest: { title: ['Recoltează 2 straturi', 'Harvest 2 plots'], target: 2, to: 'farm', reward: { gold: 80, materials: { fiber: 5 } } },
  craft: { title: ['Colectează un obiect fabricat', 'Collect one crafted item'], target: 1, to: 'workshop', reward: { gold: 60, materials: { wood: 5, stone: 5 } } },
  battle: { title: ['Termină o luptă', 'Finish one battle'], target: 1, to: 'arena', reward: { food: 80, gold: 80 } },
  expedition: { title: ['Colectează recompensa unei expediții', 'Collect an expedition reward'], target: 1, to: 'expedition', reward: { gold: 100, materials: { provisions: 1 } } },
} as const;
export type DailyQuestId = keyof typeof DAILY_QUESTS;
export type DailyState = { day: string; progress: Record<DailyQuestId, number>; claimed: DailyQuestId[]; bonus: boolean; spin: number | null };
const combinations: DailyQuestId[][] = [
  ['feed', 'harvest', 'craft', 'expedition'],
  ['feed', 'harvest', 'battle', 'expedition'],
  ['harvest', 'craft', 'battle', 'expedition'],
];
export const DAILY_BONUS: DailyReward = { gold: 200, food: 100, materials: { crystal: 5 } };
export const WHEEL_PRIZES: { label: string[]; reward: DailyReward; weight: number; icon: string }[] = [
  { label: ['100 aur', '100 gold'], reward: { gold: 100 }, weight: 25, icon: '●' },
  { label: ['100 hrană', '100 food'], reward: { food: 100 }, weight: 25, icon: '❧' },
  { label: ['20 lemn', '20 wood'], reward: { materials: { wood: 20 } }, weight: 15, icon: '▰' },
  { label: ['20 piatră', '20 stone'], reward: { materials: { stone: 20 } }, weight: 15, icon: '◆' },
  { label: ['2 provizii', '2 supply packs'], reward: { materials: { provisions: 2 } }, weight: 10, icon: '◈' },
  { label: ['5 cristale', '5 crystals'], reward: { materials: { crystal: 5 } }, weight: 5, icon: '♦' },
  { label: ['1 kit habitat', '1 habitat kit'], reward: { materials: { habitatKit: 1 } }, weight: 3, icon: '⌂' },
  { label: ['500 aur', '500 gold'], reward: { gold: 500 }, weight: 2, icon: '★' },
];
export const dailyDay = (now: number) => new Date(now).toISOString().slice(0, 10);
export function newDaily(now: number): DailyState {
  return { day: dailyDay(now), progress: { feed: 0, harvest: 0, craft: 0, battle: 0, expedition: 0 }, claimed: [], bonus: false, spin: null };
}
export function dailyState(save: Pick<Save, 'daily' | 'updatedAt'>, now: number) {
  const effective = Math.max(now, save.updatedAt);
  return save.daily?.day === dailyDay(effective) ? save.daily : newDaily(effective);
}
export function dailyQuests(day: string) {
  return combinations[Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000) % combinations.length];
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
