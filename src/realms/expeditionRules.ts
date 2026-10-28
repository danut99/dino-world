import { REGIONS, REGION_STAGES, regionNumber, regionTeamSize, stageLevel, type ItemId, type Region } from './content';
import {
  busyDinos,
  ELEMENT_BEATS,
  ELEMENTS,
  portalSlots,
  type Dino,
  type RealmId,
  type Reward,
  type Save,
} from './game';

/**
 * Expeditions (see REGIONS): a team of one to three dinosaurs crosses a region's five stages once each, region by
 * region in the worlds' order; a region secured to its third stage can then be patrolled again and again. Every check
 * lives here and is shared by the UI and the command reducer, so both always agree.
 *
 * Nothing here runs while the module loads: game.ts imports this file, and this file reads game.ts only when called.
 */
export const regionById = (id: string): Region | undefined => REGIONS.find((r) => r.id === id);
/** How long stage `stage` (0 to 4) of a region takes. */
export const stageMs = (regionId: string, stage: number) => (regionById(regionId)?.minutes[stage] ?? 0) * 60_000;
/** Stages completed in a region (0 to 5). */
export const regionProgress = (save: Pick<Save, 'expeditionProgress'>, regionId: string) =>
  save.expeditionProgress[regionId] ?? 0;
/** A world opens once the previous world's region is secured this far (see `worldLock`). */
export const WORLD_UNLOCK_STAGE = 3;
export const PATROL_HOURS = [1, 3, 8] as const;
export type PatrolHours = (typeof PATROL_HOURS)[number];
/** Patrols: repeatable trips into a region secured to its third stage. */
export const PATROL = {
  unlockStage: 3,
  hours: PATROL_HOURS,
  /** Total reward of the trip, against one hour. */
  length: { 1: 1, 3: 2.85, 8: 6.8 } as Record<PatrolHours, number>,
  /** Reward multiplier by team size (1, 2, 3). */
  team: [1, 1.8, 2.5],
  /** Supply packs a patrol takes, whatever the team. */
  supplies: 1,
  /** The first patrols claimed each (Bucharest) day pay this much more. */
  daily: 3,
  dailyBonus: 1.5,
  /** Chance of an egg for every hour away. */
  eggPerHour: 0.02,
  /** Arena tickets of the region's element. */
  tickets: { 1: 0, 3: 1, 8: 2 } as Record<PatrolHours, number>,
};
/** Each member of the recommended element adds this much to the reward, up to ELEMENT_BONUS_MAX. */
export const ELEMENT_BONUS = 0.2;
export const ELEMENT_BONUS_MAX = 0.6;
/** Stage rewards: gold and food per minute away, materials as a share of the minutes; tickets and the finale. */
export const STAGE_REWARD = { food: 1, materials: 0.15, tickets: 1, finaleTickets: 2, finaleGems: 3 };
export const stageGoldPerMinute = (region: number) => 2 + 0.5 * region;
/** Patrol pay per hour, before the length, team and element multipliers. */
export const patrolPerHour = (region: number) => ({
  gold: 20 + 8 * region,
  food: 8 + 4 * region,
  materials: 3 + region,
});

/** The element that beats the region's: its dinosaurs bring more back. */
export const recommendedElement = (element: RealmId): RealmId =>
  ELEMENTS.find((e) => ELEMENT_BEATS[e.id].includes(element))!.id;
export function elementBonus(save: Pick<Save, 'dinos'>, team: readonly string[], element: RealmId) {
  const matching = team.filter((id) => save.dinos.find((d) => d.id === id)?.element === element).length;
  return Math.min(ELEMENT_BONUS_MAX, ELEMENT_BONUS * matching);
}
/** Splits a material count over the region's pair, the first getting the odd one. */
export function splitMaterials(total: number, pair: readonly [ItemId, ItemId]): Partial<Record<ItemId, number>> {
  const first = Math.ceil(total / 2),
    second = total - first;
  return Object.fromEntries(
    (
      [
        [pair[0], first],
        [pair[1], second],
      ] as const
    ).filter(([, n]) => n > 0),
  );
}
export type ExpeditionReward = Reward & { tickets?: number; gems?: number };
/** What stage `stage` (0 to 4) pays, with the element bonus; the finale's egg is drawn when the team leaves. */
export function stageReward(regionId: string, stage: number, bonus = 0): ExpeditionReward {
  const r = regionById(regionId)!,
    n = regionNumber(regionId),
    // The introductory region is faster but keeps its established one-time rewards.
    minutes = regionId === 'training' ? [5, 10, 15, 20, 30][stage] : r.minutes[stage],
    up = (x: number) => Math.round(x * (1 + bonus)),
    finale = stage === REGION_STAGES - 1;
  return {
    gold: up(minutes * stageGoldPerMinute(n)),
    food: up(minutes * STAGE_REWARD.food),
    materials: splitMaterials(up(minutes * STAGE_REWARD.materials), r.materials),
    tickets: finale ? STAGE_REWARD.finaleTickets : STAGE_REWARD.tickets,
    ...(finale ? { gems: STAGE_REWARD.finaleGems } : {}),
  };
}
/** What a patrol pays, before the daily bonus (added when it is claimed). */
export function patrolReward(regionId: string, hours: PatrolHours, size: number, bonus = 0): ExpeditionReward {
  const r = regionById(regionId)!,
    base = patrolPerHour(regionNumber(regionId)),
    factor = PATROL.length[hours] * (PATROL.team[Math.max(1, Math.min(3, size)) - 1] ?? 1) * (1 + bonus);
  return {
    gold: Math.round(base.gold * factor),
    food: Math.round(base.food * factor),
    materials: splitMaterials(Math.round(base.materials * factor), r.materials),
    ...(PATROL.tickets[hours] ? { tickets: PATROL.tickets[hours] } : {}),
  };
}
/** The daily bonus on a claimed patrol: half again of its gold, food and materials. */
export function patrolDailyExtra(reward: Pick<Reward, 'gold' | 'food' | 'materials'>) {
  const extra = (n: number) => Math.round(n * (PATROL.dailyBonus - 1));
  return {
    gold: extra(reward.gold),
    food: extra(reward.food),
    materials: Object.fromEntries(Object.entries(reward.materials).map(([id, n]) => [id, extra(n!)])) as Partial<
      Record<ItemId, number>
    >,
  };
}

/** Why a dinosaur cannot join a team: missing, still a baby, under the level, or away (trip or fight). */
export type MemberIssue = 'missing' | 'baby' | 'level' | 'busy';
export function memberIssue(
  save: Pick<Save, 'dinos' | 'expeditions' | 'battle'>,
  dino: Dino | string,
  level: number,
  busy = busyDinos(save),
): MemberIssue | null {
  const d = typeof dino === 'string' ? save.dinos.find((x) => x.id === dino) : dino;
  if (!d) return 'missing';
  if (d.stage === 'baby') return 'baby';
  if (d.level < level) return 'level';
  if (busy.has(d.id)) return 'busy';
  return null;
}
/** The first thing stopping a departure, in the order the player meets them. */
export type ExpeditionBlocker =
  'world' | 'previous' | 'portal' | 'done' | 'running' | 'patrolLocked' | 'slots' | 'teamSize' | 'team' | 'supplies';

function teamCheck(save: Save, team: readonly string[], level: number) {
  const busy = busyDinos(save);
  const failing = team
    .map((id) => ({ id, reason: memberIssue(save, id, level, busy) }))
    .filter((x): x is { id: string; reason: MemberIssue } => !!x.reason);
  return { failing, unique: new Set(team).size === team.length };
}

/**
 * The next stage of a region, for a chosen team: its level, team size, supplies and reward (with the element bonus
 * of that team), and what still stops it, if anything.
 */
export function expeditionPlan(save: Save, regionId: string, team: readonly string[] = []) {
  const region = regionById(regionId);
  if (!region) throw new Error('region');
  const number = regionNumber(regionId),
    completed = regionProgress(save, regionId),
    done = completed >= REGION_STAGES,
    stage = Math.min(completed, REGION_STAGES - 1),
    level = stageLevel(number, stage + 1),
    teamSize = regionTeamSize(number),
    minutes = region.minutes[stage],
    supplies = number === 1 ? 0 : teamSize,
    previousRegion = REGIONS[number - 2];
  const world = !!save.habitats[region.element],
    previous = !previousRegion || regionProgress(save, previousRegion.id) >= REGION_STAGES,
    portal = save.portalLevel > 0,
    running = save.expeditions.some((x) => x.kind === 'stage' && x.regionId === regionId),
    slotFree = save.expeditions.length < portalSlots(save),
    stocked = save.inventory.provisions >= supplies;
  const { failing, unique } = teamCheck(save, team, level);
  const recommended = recommendedElement(region.element),
    bonus = elementBonus(save, team, recommended);
  const blocker: ExpeditionBlocker | null = !world
    ? 'world'
    : !previous
      ? 'previous'
      : !portal
        ? 'portal'
        : done
          ? 'done'
          : running
            ? 'running'
            : !slotFree
              ? 'slots'
              : team.length !== teamSize || !unique
                ? 'teamSize'
                : failing.length
                  ? 'team'
                  : !stocked
                    ? 'supplies'
                    : null;
  return {
    region,
    number,
    total: REGION_STAGES,
    completed,
    done,
    stage,
    minutes,
    duration: minutes * 60_000,
    level,
    teamSize,
    supplies,
    world,
    previous,
    previousRegion,
    portal,
    running,
    slotFree,
    stocked,
    failing,
    recommended,
    bonus,
    reward: stageReward(regionId, stage, bonus),
    blocker,
    canSend: !blocker,
  };
}
export type ExpeditionPlan = ReturnType<typeof expeditionPlan>;

/** A patrol into a region secured to its third stage: 1, 3 or 8 hours, one to three members, one supply pack. */
export function patrolPlan(save: Save, regionId: string, hours: PatrolHours, team: readonly string[] = []) {
  const region = regionById(regionId);
  if (!region) throw new Error('region');
  const number = regionNumber(regionId),
    level = stageLevel(number, 1),
    unlocked = regionProgress(save, regionId) >= PATROL.unlockStage,
    validHours = (PATROL.hours as readonly number[]).includes(hours),
    portal = save.portalLevel > 0,
    slotFree = save.expeditions.length < portalSlots(save),
    stocked = save.inventory.provisions >= PATROL.supplies;
  const { failing, unique } = teamCheck(save, team, level);
  const recommended = recommendedElement(region.element),
    bonus = elementBonus(save, team, recommended),
    daily = save.daily.patrols < PATROL.daily;
  const blocker: ExpeditionBlocker | null = !unlocked
    ? 'patrolLocked'
    : !portal
      ? 'portal'
      : !slotFree
        ? 'slots'
        : !validHours || team.length < 1 || team.length > 3 || !unique
          ? 'teamSize'
          : failing.length
            ? 'team'
            : !stocked
              ? 'supplies'
              : null;
  return {
    region,
    number,
    hours,
    duration: hours * 3_600_000,
    level,
    unlocked,
    portal,
    slotFree,
    stocked,
    supplies: PATROL.supplies,
    failing,
    recommended,
    bonus,
    /** Whether a patrol claimed now still gets the daily bonus. */
    daily,
    dailyLeft: Math.max(0, PATROL.daily - save.daily.patrols),
    eggChance: validHours ? PATROL.eggPerHour * hours : 0,
    reward: patrolReward(regionId, validHours ? hours : 1, Math.max(1, team.length), bonus),
    blocker,
    canSend: !blocker,
  };
}
export type PatrolPlan = ReturnType<typeof patrolPlan>;

/**
 * A team to start from: free dinosaurs able to go, the recommended element first, then the highest levels. Stages
 * take exactly the region's team size; patrols up to three.
 */
export function suggestTeam(save: Save, regionId: string, kind: 'stage' | 'patrol') {
  const region = regionById(regionId);
  if (!region) return [];
  const number = regionNumber(regionId),
    stage = Math.min(regionProgress(save, regionId), REGION_STAGES - 1),
    level = kind === 'stage' ? stageLevel(number, stage + 1) : stageLevel(number, 1),
    size = kind === 'stage' ? regionTeamSize(number) : 3,
    recommended = recommendedElement(region.element),
    busy = busyDinos(save);
  return save.dinos
    .filter((d) => !memberIssue(save, d, level, busy))
    .sort((a, b) => Number(b.element === recommended) - Number(a.element === recommended) || b.level - a.level)
    .slice(0, size)
    .map((d) => d.id);
}
/** Error code a blocked departure throws (the messages live in RealmsApp). */
export function blockerCode(blocker: ExpeditionBlocker, failing: { reason: MemberIssue }[]) {
  if (blocker === 'team')
    return ({ missing: 'dino', baby: 'juvenile', level: 'level', busy: 'busy' } as const)[failing[0].reason];
  return (
    {
      world: 'locked',
      previous: 'locked',
      portal: 'building',
      done: 'done',
      running: 'busy',
      patrolLocked: 'patrolLocked',
      slots: 'slots',
      teamSize: 'teamSize',
      supplies: 'provisions',
    } as const
  )[blocker];
}
