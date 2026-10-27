import { arenaBoss, ARENA_BOSSES } from './arenaBosses';
import { arenaFoes, arenaTier, BOSS_STATS, foeHasUltimate, roundCap, teamReward, type Foe } from './arenaTeams';
import { isPlayableDinosaur, playableSpecies, PLAYABLE_DINOSAURS } from './playableDinosaurs';
import {
  CROPS,
  ENCOUNTERS,
  FARM_LEVELS,
  ITEMS,
  RECIPES,
  REGIONS,
  REGION_STAGES,
  RETIRED_CROPS,
  UTILITY_BUILDINGS,
  leagueBaseLevel,
  leagueNumber,
  regionNumber,
  regionTeamSize,
  stageLevel,
  initialInventory,
  recipeFoodCost,
  type CropId,
  type Encounter,
  type Inventory,
  type ItemId,
  type Region,
  type UtilityKind,
} from './content';
import { buildable, BUILDABLE_CELLS } from './grid';
import { DEV_TOOLS } from './devTools';
import {
  newDaily,
  dailyState,
  weekId,
  availableQuests,
  scaleDailyReward,
  DAILY_QUESTS,
  DAILY_BONUS,
  DAILY_REROLLS_FREE,
  wheelPrizes,
  wheelPrize,
  grantDailyReward,
  addDailyProgress,
  normalizeDaily,
  validDaily,
  type DailyReward,
  type DailyState,
  type DailyQuestId,
} from './daily';
import {
  blockerCode,
  expeditionPlan,
  patrolDailyExtra,
  patrolPlan,
  PATROL,
  regionById,
  stageMs,
  WORLD_UNLOCK_STAGE,
  type ExpeditionReward,
  type PatrolHours,
} from './expeditionRules';
export const SAVE_KEY = 'dino-realms-save-v1';
export const BALANCE = {
  offlineCap: 8 * 3_600_000,
  maxEggs: 12,
  maxDinos: 60,
};
/** Incubation by where the egg came from; a won egg takes longer the rarer it is (see `eggSeconds`). */
export const EGG_SECONDS = { tutorial: 30, market: 10 * 60, story: 20 * 60, won: 3600, boss: 6 * 3600 };
const RARITY_INCUBATION: Record<Rarity, number> = { common: 1, rare: 1.5, epic: 2, legendary: 1 };
/** Seconds an egg of this kind incubates: market eggs come with `market`, story eggs carry `story`. */
export const eggSeconds = (egg: EggKind, market = false) =>
  egg.species === 'boss'
    ? EGG_SECONDS.boss
    : market
      ? EGG_SECONDS.market
      : egg.story
        ? EGG_SECONDS.story
        : Math.round(EGG_SECONDS.won * RARITY_INCUBATION[rarityOf(egg)]);
/**
 * Diamonds buy time, never power: finishing a timer now, doubling habitat gold for a while, waking a tired
 * dinosaur, another turn of the wheel or another daily mission. Prices are in diamonds. They are earned slowly in
 * the game (about 220 a month, see GEM_SOURCES); paid packs come later.
 */
export const GEMS = {
  boost: { 1: 15, 4: 45 } as Record<1 | 4, number>,
  /** Wakes one resting dinosaur; `restTeam` wakes the whole arena team at once. */
  rest: 3,
  restTeam: 6,
  /** Another turn of the daily wheel, once the free one is used. */
  spin: 8,
  /** Another daily mission, once the free reroll of the day is used. */
  reroll: 3,
  /** The most a single test grant may add. */
  maxGrant: 10_000,
};
/**
 * Where diamonds come from, each paid once and announced with a notice: a welcome gift, every story chapter's
 * finale, every region's last stage (see expeditionRules), star and collection milestones, the daily chest, a slice
 * of the daily wheel and the weekly arena season.
 */
export const GEM_SOURCES = { welcome: 10, chapter: 5 };
/** A crafting job's full length, at the slowest workshop level. */
const craftMs = (recipe: { seconds: number }) =>
  Math.max(...WORKSHOP_LEVELS.map((l) => Math.round(recipe.seconds * 1000 * l.speed)));
/** An expedition's planned length: its stage's minutes, or the patrol's hours. */
const tripMs = (x: Pick<ExpeditionRun, 'kind' | 'regionId' | 'stage' | 'hours'>) =>
  x.kind === 'patrol' ? (x.hours ?? 0) * 3_600_000 : stageMs(x.regionId, x.stage ?? -1);
/**
 * Diamonds to finish a wait of `ms` right away: `ceil(1.2 × √minutes)`, at least one. Long waits cost less per
 * minute: 5 minutes is 3, an hour 10, eight hours 27.
 */
export const gemsToFinish = (ms: number) => (ms <= 0 ? 0 : Math.max(1, Math.ceil(1.2 * Math.sqrt(ms / 60_000))));
export const ELEMENTS = [
  { id: 'fire', name: ['Foc', 'Fire'], role: ['Atacator', 'Attacker'], color: '#ee7541', symbol: '♨' },
  { id: 'water', name: ['Apă', 'Water'], role: ['Vindecător', 'Healer'], color: '#65c8e1', symbol: '≈' },
  {
    id: 'earth',
    name: ['Pământ', 'Earth'],
    role: ['Protector pasiv', 'Passive protector'],
    color: '#c4a16b',
    symbol: '◆',
  },
  { id: 'nature', name: ['Natură', 'Nature'], role: ['Regenerare', 'Regeneration'], color: '#93bc65', symbol: '❧' },
  { id: 'ice', name: ['Gheață', 'Ice'], role: ['Control', 'Control'], color: '#a5dcf2', symbol: '❄' },
  {
    id: 'lightning',
    name: ['Fulger', 'Lightning'],
    role: ['Atacator exploziv', 'Burst attacker'],
    color: '#dac371',
    symbol: 'ϟ',
  },
  { id: 'wind', name: ['Vânt', 'Wind'], role: ['Suport de viteză', 'Speed support'], color: '#9ce2cf', symbol: '≋' },
  { id: 'dark', name: ['Întuneric', 'Dark'], role: ['Slăbire', 'Debuffs'], color: '#b393d2', symbol: '☾' },
  { id: 'light', name: ['Lumină', 'Light'], role: ['Purificare', 'Purification'], color: '#f3dda0', symbol: '☼' },
  { id: 'arcane', name: ['Arcan', 'Arcane'], role: ['Sigilare', 'Ability control'], color: '#b7a2ef', symbol: '✧' },
] as const;
export type RealmId = (typeof ELEMENTS)[number]['id'];
export const REALM_NAMES: Record<RealmId, readonly [string, string]> = {
  fire: ['Caldera de jar', 'Ember Caldera'],
  water: ['Laguna primordială', 'Primordial Lagoon'],
  earth: ['Canionul fosilelor', 'Fossil Canyon'],
  nature: ['Jungla pierdută', 'Lost Jungle'],
  ice: ['Valea ghețarilor', 'Glacier Valley'],
  lightning: ['Crestele tunetului', 'Thunder Peaks'],
  wind: ['Pajiștile cerului', 'Sky Meadows'],
  dark: ['Pădurea amurgului', 'Twilight Grove'],
  light: ['Sanctuarul zorilor', 'Dawn Sanctuary'],
  arcane: ['Insula sigiliilor', 'Isle of Sigils'],
};
export const SPECIES = [
  'trex',
  'raptor',
  'triceratops',
  'ankylosaurus',
  'brachiosaurus',
  'ignasaur',
  'thalassaur',
  'terrasaur',
  'therizinosaurus',
  'quetzalcoatlus',
  'dilophosaurus',
  'ankylobiped',
  'solarraptor',
  'cryptoraptor',
] as const;
export type Species = (typeof SPECIES)[number] | 'boss';
export const SPECIES_NAMES: Record<Species, string> = {
  trex: 'T-Rex',
  raptor: 'Raptor',
  triceratops: 'Triceratops',
  ankylosaurus: 'Ankylosaurus',
  brachiosaurus: 'Brachiosaurus',
  ignasaur: 'Ignasaur',
  thalassaur: 'Thalassaur',
  terrasaur: 'Terrasaur',
  therizinosaurus: 'Therizinosaurus',
  quetzalcoatlus: 'Quetzalcoatlus',
  dilophosaurus: 'Dilophosaurus',
  ankylobiped: 'Ankylosaurus Biped',
  solarraptor: 'Solar Raptor',
  cryptoraptor: 'Cryptoraptor',
  boss: 'Boss',
};
/** Species stat multipliers from the plan (section 3). */
const SPECIES_STATS: Record<Species, { hp: number; power: number; defense: number; speed: number }> = {
  trex: { hp: 1, power: 1.1, defense: 1, speed: 0.9 },
  raptor: { hp: 0.9, power: 1, defense: 1, speed: 1.15 },
  triceratops: { hp: 1.1, power: 1, defense: 1, speed: 0.9 },
  ankylosaurus: { hp: 1, power: 1, defense: 1.15, speed: 0.85 },
  brachiosaurus: { hp: 1.15, power: 0.9, defense: 1, speed: 1 },
  ignasaur: { hp: 0.95, power: 1.1, defense: 0.95, speed: 1.1 },
  thalassaur: { hp: 1, power: 1, defense: 1.05, speed: 1.05 },
  terrasaur: { hp: 1.1, power: 1, defense: 1.15, speed: 0.8 },
  therizinosaurus: { hp: 1, power: 1.1, defense: 1, speed: 1 },
  quetzalcoatlus: { hp: 0.95, power: 1.05, defense: 0.95, speed: 1.15 },
  dilophosaurus: { hp: 0.9, power: 1.1, defense: 0.9, speed: 1.2 },
  ankylobiped: { hp: 1.1, power: 1, defense: 1.15, speed: 0.8 },
  solarraptor: { hp: 1, power: 1.05, defense: 1.1, speed: 0.95 },
  cryptoraptor: { hp: 1, power: 1.1, defense: 0.95, speed: 1.05 },
  boss: { hp: 1.15, power: 1.1, defense: 1.1, speed: 0.9 },
};
/** Arena roles: each species brings one ability to the relay (see ROLE_EFFECTS). */
export type Role = 'tank' | 'attacker' | 'fast' | 'support';
export const ROLES: readonly Role[] = ['tank', 'attacker', 'fast', 'support'];
export const SPECIES_ROLE: Record<Species, Role> = {
  ankylosaurus: 'tank',
  terrasaur: 'tank',
  triceratops: 'tank',
  ankylobiped: 'tank',
  trex: 'attacker',
  therizinosaurus: 'attacker',
  ignasaur: 'attacker',
  cryptoraptor: 'attacker',
  boss: 'attacker',
  raptor: 'fast',
  dilophosaurus: 'fast',
  quetzalcoatlus: 'fast',
  brachiosaurus: 'support',
  thalassaur: 'support',
  solarraptor: 'support',
};
export const ROLE_NAMES: Record<Role, readonly [string, string]> = {
  tank: ['Tanc', 'Tank'],
  attacker: ['Atacator', 'Attacker'],
  fast: ['Rapid', 'Fast'],
  support: ['Suport', 'Support'],
};
export const ROLE_ICONS: Record<Role, string> = { tank: '🛡', attacker: '⚔', fast: '💨', support: '💚' };
export const ROLE_INFO: Record<Role, readonly [string, string]> = {
  tank: [
    'Prima lovitură primită pe arenă îi face doar jumătate.',
    'The first blow it takes on stage deals half damage.',
  ],
  attacker: ['Sub 50% viață, loviturile lui fac +20%.', 'Below 50% health, its strikes deal +20%.'],
  fast: ['Se eschivează mai des.', 'Dodges more often.'],
  support: [
    'Din rezervă, apără cu 10% luptătorul de pe arenă; pe arenă se vindecă o dată cu 15%.',
    'From the bench, the fighter on stage takes 10% less; on stage it heals 15% once.',
  ],
};
/**
 * Role abilities, tuned by `arenaBalance.test.ts`: tank `shield` (share of the first blow taken), attacker `rage`
 * (strike multiplier below `rageBelow` health), fast `swiftAlly`/`swiftFoe` (extra dodge chance), support `aura`
 * (share of damage the side's fighter takes while it waits on the bench) and `heal` (share of max health, once,
 * as soon as that much is missing). Opponents rage and shelter behind a bench support more mildly (`foeRage`,
 * `foeAura`): at full strength the level-50 arcane boss could not be beaten without a fall.
 */
export const ROLE_EFFECTS = {
  shield: 0.5,
  rage: 1.2,
  rageBelow: 0.5,
  swiftAlly: 0.04,
  swiftFoe: 0.06,
  aura: 0.9,
  heal: 0.15,
  foeRage: 1.1,
  foeAura: 0.95,
};
export const roleOf = (x: { species: Species }) => SPECIES_ROLE[x.species];
export type AbilityKind = 'shield' | 'rage' | 'aura' | 'heal' | 'swift';
export const ABILITY_KINDS: readonly AbilityKind[] = ['shield', 'rage', 'aura', 'heal', 'swift'];
/** A role ability that fired in a round, on the side it helped; `amount` is the health a heal gave back. */
export type Ability = { on: 'ally' | 'enemy'; kind: AbilityKind; amount?: number };
export type Stage = 'baby' | 'juvenile' | 'adult';
export type BuildingKind = UtilityKind | 'habitat';
export interface Building {
  id: string;
  kind: BuildingKind;
  x: number;
  y: number;
}
export interface FarmPlot {
  crop: CropId;
  readyAt: number;
}
export interface Dino {
  id: string;
  species: Species;
  element: RealmId;
  level: number;
  stage: Stage;
  nickname: string;
  /** Missing in older saves: common. */
  rarity?: Rarity;
  /** Stat points spent by the player; missing means none (free points count as spread evenly). */
  points?: StatPoints;
}
export const POINT_STATS = ['hp', 'power', 'defense'] as const;
export type PointStat = (typeof POINT_STATS)[number];
export type StatPoints = Record<PointStat, number>;
/** An egg knows its species and element before incubation. `hatchAt` is null while it waits in the inventory. */
export interface Egg {
  id: string;
  species: Species;
  element: RealmId;
  seconds: number;
  hatchAt: number | null;
  /** Decided when the egg is won and passed on to the dinosaur; missing means common. */
  rarity?: Rarity;
}
/** An egg's identity before it reaches the shelf. */
export interface EggKind {
  species: Species;
  element: RealmId;
  rarity?: Rarity;
  /** A story reward waiting for room on the shelf (it incubates like a story egg). */
  story?: true;
}
/**
 * Rarity: the same species can hatch common, rare or epic; arena champions are always legendary. A rarer
 * dinosaur has more health and power at the same level.
 */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_POWER: Record<Rarity, number> = { common: 1, rare: 1.1, epic: 1.2, legendary: 1.35 };
export const RARITY_NAMES: Record<Rarity, readonly [string, string]> = {
  common: ['Comun', 'Common'],
  rare: ['Rar', 'Rare'],
  epic: ['Epic', 'Epic'],
  legendary: ['Legendar', 'Legendary'],
};
/** Chance of a rare and of an epic egg, by where it is won; harder arena tiers pay better. Market eggs are common. */
export function rarityOdds(encounter: { id: string; mode: 'arena' | 'expedition' }): { rare: number; epic: number } {
  if (encounter.mode !== 'arena') return { rare: 0.2, epic: 0.04 };
  const tier = Number(encounter.id.split('-')[2] ?? 1);
  return tier >= 3 ? { rare: 0.25, epic: 0.12 } : tier === 2 ? { rare: 0.22, epic: 0.08 } : { rare: 0.2, epic: 0.05 };
}
export const rarityOf = (x: { rarity?: Rarity }): Rarity => x.rarity ?? 'common';
/** A team member in an arena fight: its health, kept through the relay (a fallen member stays at 0). */
export interface BattleAlly {
  dinoId: string;
  hp: number;
  maxHp: number;
  /** Missing in fights started before roles. */
  species?: Species;
  /** A tank's half-damage first blow is spent. */
  shieldUsed?: true;
  /** A support's one heal is spent. */
  healed?: true;
}
/**
 * An arena fight between the player's team (1 to 3 dinosaurs) and the tier's opponents, fought as a relay: one
 * fighter per side at a time; when one falls the next of its side steps in with an empty energy bar. The fields
 * from `dinoId` to `enemyEnergy` mirror the fighters on stage (`team[active]` against `foes[foeIndex]`).
 */
export interface Battle {
  encounterId: string;
  team: BattleAlly[];
  /** Index in `team` of the dinosaur fighting now. */
  active: number;
  foes: Foe[];
  /** Index in `foes` of the opponent fighting now. */
  foeIndex: number;
  /** `egg` is rolled when the fight is won (see `eggOdds`); `milestones` counts star milestones it pays out. */
  reward: { gold: number; food: number; materials: Partial<Inventory>; egg?: EggKind; milestones?: number };
  /** Stars earned when the fight was won, from the team's health left (see `starsFor`). */
  stars?: number;
  dinoId: string;
  hp: number;
  maxHp: number;
  /** The active dinosaur's bar: an adult unleashes its ultimate when it is full. */
  energy: number;
  enemy: number;
  enemyMax: number;
  /** The active opponent's bar: +50 a round, its ultimate fires when full (see `foeMove`). */
  enemyEnergy: number;
  round: number;
  result: 'victory' | 'defeat' | 'draw' | null;
  log: 'start' | AllyMove;
  /** What happened in the last round, for the replay and the on-screen callouts. */
  report?: RoundReport;
  /** Fight recap (missing in older fights): the biggest single strike and the damage each ally dealt. */
  bestHit?: { amount: number; dinoId: string };
  damage?: Record<string, number>;
}
export type AllyMove = 'basic' | 'defend' | 'ultimate';
export type FoeMove = 'attack' | 'defend' | 'ultimate';
export type Reward = { gold: number; food: number; materials: Partial<Inventory>; egg?: EggKind };
/**
 * A timed expedition: the team leaves, and its rewards wait until it is back (`endsAt`). `stage` runs cross the
 * region's next stage (0 to 4); `patrol` runs (`hours` long) roam a region secured to its third stage. The reward
 * also carries arena tickets of the region's element and, for a finale, diamonds.
 */
export interface ExpeditionRun {
  id: string;
  kind: 'stage' | 'patrol';
  regionId: string;
  stage?: number;
  hours?: 1 | 3 | 8;
  team: string[];
  startedAt: number;
  endsAt: number;
  reward: ExpeditionReward;
  /** Brought back early with diamonds: shorter than its stage's time. */
  rushed?: true;
}
/** What a building upgrade under construction is for; habitats are one target per world. */
export type BuildTarget = 'farm' | 'hatchery' | 'workshop' | 'portal' | 'arena' | `habitat:${RealmId}`;
export interface Construction {
  target: BuildTarget;
  level: number;
  startedAt: number;
  endsAt: number;
  rushed?: true;
}
export interface RoundReport {
  ally: AllyMove;
  /** `none` when the opponent fell to the dinosaur's strike before it could act. */
  foe: FoeMove | 'none';
  /** Damage the dinosaur's strike dealt, after the opponent's guard. */
  dealt: number;
  /** Opponent HP right after the strike, before any reflected damage. */
  enemyAfterStrike: number;
  /** Damage the dinosaur took. */
  taken: number;
  dodged: boolean;
  /** Damage the dinosaur's guard turned back on the opponent. */
  reflected: number;
  /** The dinosaur's and the opponent's health at the end of the round (the round's fighters, before any swap). */
  hpAfter?: number;
  enemyAfter?: number;
  /** Who fell and was replaced by the next member of its side at the end of the round. */
  swap?: 'ally' | 'enemy' | 'both';
  /** Role abilities that fired this round; heals come last, already counted in `hpAfter`/`enemyAfter`. */
  abilities?: Ability[];
  /** The ultimate was tapped in time and hit harder (see TAP_BONUS). */
  tapped?: true;
}
export interface Save {
  /** 6: the reset of the ~30-day economy. Any other version is refused on load (see OutdatedSave). */
  schemaVersion: 6;
  contentVersion: 1;
  revision: number;
  updatedAt: number;
  gold: number;
  food: number;
  /** Diamonds: the premium currency, spent to save time (see GEMS). Older saves have none. */
  gems: number;
  /** Until when habitat gold flows twice as fast (a diamond boost); 0 when none. */
  boostUntil: number;
  /** Gold produced by all habitats, waiting to be collected. */
  storedGold: number;
  buildings: Building[];
  dinos: Dino[];
  /** The dinosaur that fights and that the HUD follows: always `team[0]`. */
  champion: string | null;
  /** The arena team, champion first (1 to 3 dinosaurs). */
  team: string[];
  /** Who friends fight when they challenge this player (0 to 3 dinosaurs); empty = the arena team. */
  defense: string[];
  eggs: Egg[];
  hatcheryLevel: number;
  /** Workshop and Arena Gate levels (see WORKSHOP_LEVELS, ARENA_LEVELS). */
  workshopLevel: number;
  arenaLevel: number;
  /** Expedition Portal level (see PORTAL_LEVELS); 0 until the portal is built. */
  portalLevel: number;
  /** One elemental ticket is consumed when an arena battle starts. */
  arenaTickets: Partial<Record<RealmId, number>>;
  /** The weekly arena season (Bucharest weeks): wins this week and season rewards already paid. */
  arena: { week: string; weekWins: number; weekClaimed: number };
  /** Habitat level per element world; a missing world has no habitat yet. */
  habitats: Partial<Record<RealmId, number>>;
  /** Story goals already claimed (see STORY_CHAPTERS). */
  questEggs: string[];
  /** Wins that could have dropped an egg but did not, since the last egg (see EGG_DROP.pity). */
  eggLuck: number;
  /** Eggs won while the shelf was full; they move to the shelf as soon as there is room. */
  owedEggs: EggKind[];
  bossEggsClaimed: RealmId[];
  /** Best stars (1 to 3) won in each arena fight; two stars on a tier open the next one. */
  stars: Record<string, number>;
  /** Star milestones already paid out (see STAR_MILESTONES). */
  starMilestones: number;
  /** Dinosaurs resting after a lost fight, until the given time; they cannot fight before. */
  tired: Record<string, number>;
  farmLevel: number;
  /** One entry per unlocked plot (see FARM_LEVELS); null = empty. */
  plots: (FarmPlot | null)[];
  battle: Battle | null;
  victories: number;
  rewardPending: boolean;
  inventory: Inventory;
  crafting: CraftJob[];
  /** Teams away on timed expeditions, and what they bring back (one per portal slot). */
  expeditions: ExpeditionRun[];
  /** Stages completed per region. */
  expeditionProgress: Partial<Record<string, number>>;
  daily: DailyState;
  cleared: string[];
  /** The building upgrade being built, if any. */
  construction: Construction | null;
  /** Families ever hatched (`species_element`, bosses as `boss_element`); releasing a dinosaur keeps its entry. */
  discovered: string[];
  /** Collection milestones already paid out. */
  collectionMilestones: number;
  /** Ornamental lamps placed on the island, each adding to habitat gold (see LAMP_BONUS). */
  lamps: number;
  /** Where each lamp stands on the home grid (one cell each), as many as `lamps`. */
  lampSpots: { x: number; y: number }[];
  /** Legend trials done in the Bucharest week `week`, once the story is finished (see LEGEND_TRIAL). */
  legend: { week: string; trials: number };
  /** The weekly tower: highest floor cleared this week (0 to TOWER_FLOORS) and reward floors already claimed. */
  tower: { week: string; floor: number; claimed: number[] };
  /** The dinosaur training for a free level, and when it is done (see TRAINING); null when nobody trains. */
  training: { dinoId: string; endsAt: number } | null;
  /**
   * Something the last command did on its own that the player should hear about: an egg sold for lack of room,
   * diamonds earned, arena tickets won for a world drawn at random.
   */
  notice?: Notice;
}
export interface Notice {
  eggSold?: number;
  gems?: number;
  tickets?: { realm: RealmId; count: number };
}
export interface CraftJob {
  id: string;
  recipeId: string;
  startedAt: number;
  endsAt: number;
  /** Which of the workshop's parallel jobs runs it; older saves have none (lane 0). */
  lane?: number;
  /** Finished early with diamonds: shorter than its recipe's time. */
  rushed?: true;
}

type Materials = Partial<Record<ItemId, number>>;
/**
 * Building levels: `gold` and `materials` buy that level (level 1 comes with the building), `minutes` is how long
 * the upgrade takes to build. Hatchery: eggs incubating at the same time.
 */
export const HATCHERY_LEVELS: { slots: number; gold: number; materials: Materials; minutes: number }[] = [
  { slots: 1, gold: 0, materials: {}, minutes: 0 },
  { slots: 2, gold: 800, materials: { wood: 20 }, minutes: 10 },
  { slots: 3, gold: 3000, materials: { wood: 40, stone: 40 }, minutes: 120 },
  { slots: 4, gold: 8000, materials: { wood: 70, stone: 70, crystal: 10 }, minutes: 360 },
];
/** Workshop: `slots` jobs running or waiting, `lanes` of them running at once, `speed` multiplies crafting time. */
export const WORKSHOP_LEVELS: {
  slots: number;
  lanes: number;
  speed: number;
  gold: number;
  materials: Materials;
  minutes: number;
}[] = [
  { slots: 3, lanes: 1, speed: 1, gold: 0, materials: {}, minutes: 0 },
  { slots: 5, lanes: 2, speed: 0.8, gold: 1200, materials: { wood: 30, stone: 30 }, minutes: 30 },
  { slots: 7, lanes: 3, speed: 0.6, gold: 4000, materials: { wood: 60, stone: 60, crystal: 10 }, minutes: 180 },
];
/** Expedition Portal: how many teams can be away at once. */
export const PORTAL_LEVELS: { slots: number; gold: number; materials: Materials; minutes: number }[] = [
  { slots: 1, gold: 0, materials: {}, minutes: 0 },
  { slots: 2, gold: 3000, materials: { wood: 50, stone: 50 }, minutes: 120 },
  { slots: 3, gold: 10000, materials: { wood: 100, stone: 100, crystal: 20 }, minutes: 480 },
];
/** Arena Gate: level 2 adds 25% to arena rewards and opens the last five leagues. */
export const ARENA_LEVELS: { bonus: number; gold: number; materials: Materials; minutes: number }[] = [
  { bonus: 0, gold: 0, materials: {}, minutes: 0 },
  { bonus: 0.25, gold: 6000, materials: { stone: 60, crystal: 20 }, minutes: 240 },
];
export const GATE_LEAGUES = ['lightning', 'wind', 'dark', 'light', 'arcane'];
/**
 * Arena tickets are per element: a league takes one ticket of its own element, spent when the fight starts (a
 * draw gives it back). They never refill on their own: they are bought with gold (five times the league's base
 * level: fire 50 … arcane 230, never with diamonds) or won on expeditions, patrols, the daily wheel and the season.
 */
export const arenaTicketPrice = (realm: RealmId) => 5 * leagueBaseLevel(leagueNumber(realm) || 1);
export const ARENA_TICKET_LIMIT = 9999;
/**
 * The weekly arena season (Bucharest weeks, see `weekId`): wins this week reach these steps, each paid once, with
 * the claim of the win that reaches it. The 15-win step adds three tickets of a world whose league is open.
 */
export const ARENA_SEASON: {
  wins: number;
  gold: number;
  gems: number;
  materials: Partial<Inventory>;
  tickets: number;
}[] = [
  { wins: 5, gold: 500, gems: 3, materials: {}, tickets: 0 },
  { wins: 15, gold: 0, gems: 5, materials: { evolutionCrystal: 1 }, tickets: 3 },
  { wins: 30, gold: 1500, gems: 0, materials: { habitatKit: 1 }, tickets: 0 },
];
/**
 * The Legend trial, for players who finished the story: a few times a Bucharest week, gold and food buy diamonds
 * and an egg of a world with a habitat, rarer than a won one more often.
 */
export const LEGEND_TRIAL = { perWeek: 3, gold: 10_000, food: 20_000, gems: 5, rarity: { rare: 0.3, epic: 0.15 } };
/** Legend trials left this week (none before the story is finished). */
export const legendTrialsLeft = (s: Save, now: number) =>
  storyChapter(s) ? 0 : LEGEND_TRIAL.perWeek - (s.legend.week === weekId(now) ? s.legend.trials : 0);
/**
 * Habitat per element world: residents, gold storage (`cap`), income multiplier. Each upgrade costs gold and
 * habitat kits.
 */
export const HABITAT_LEVELS: {
  capacity: number;
  cap: number;
  income: number;
  gold: number;
  kits: number;
  minutes: number;
}[] = [
  { capacity: 2, cap: 500, income: 1, gold: 0, kits: 0, minutes: 0 },
  { capacity: 3, cap: 900, income: 1.15, gold: 900, kits: 1, minutes: 15 },
  { capacity: 4, cap: 1400, income: 1.3, gold: 2500, kits: 1, minutes: 60 },
  { capacity: 5, cap: 2000, income: 1.45, gold: 7000, kits: 2, minutes: 240 },
  { capacity: 6, cap: 2800, income: 1.6, gold: 14000, kits: 2, minutes: 480 },
];
/** Each placed lamp adds this share to habitat gold, up to MAX_LAMPS. */
export const LAMP_BONUS = 0.05;
export const MAX_LAMPS = 5;
/**
 * Construction: building upgrades take time (each level's `minutes`, from 5 minutes to 8 hours) and there is one
 * builder, so one upgrade is built at a time. The price is paid when it starts; the building keeps working at its
 * old level until the new one is done (see `advance`), or until diamonds finish it (`gemFinish`). Placing a new
 * building and opening a world stay instant.
 */
export type UpgradeStep = { gold: number; materials: Materials; minutes: number };
/** A target's current level (0 when it is not built yet). */
export function targetLevel(
  s: Pick<Save, 'farmLevel' | 'hatcheryLevel' | 'workshopLevel' | 'portalLevel' | 'arenaLevel' | 'habitats'>,
  target: BuildTarget,
) {
  if (target === 'farm') return s.farmLevel;
  if (target === 'hatchery') return s.hatcheryLevel;
  if (target === 'workshop') return s.workshopLevel;
  if (target === 'portal') return s.portalLevel;
  if (target === 'arena') return s.arenaLevel;
  return s.habitats[target.slice(8) as RealmId] ?? 0;
}
/** The price and build time of level `level` of a target, or undefined past its last level. */
export function upgradeStep(target: BuildTarget, level: number): UpgradeStep | undefined {
  const row =
    target === 'farm'
      ? FARM_LEVELS[level - 1]
      : target === 'hatchery'
        ? HATCHERY_LEVELS[level - 1]
        : target === 'workshop'
          ? WORKSHOP_LEVELS[level - 1]
          : target === 'portal'
            ? PORTAL_LEVELS[level - 1]
            : target === 'arena'
              ? ARENA_LEVELS[level - 1]
              : HABITAT_LEVELS[level - 1] && {
                  ...HABITAT_LEVELS[level - 1],
                  materials: { habitatKit: HABITAT_LEVELS[level - 1].kits },
                };
  return level >= 2 && row ? { gold: row.gold, materials: row.materials, minutes: row.minutes } : undefined;
}
/** The next level of a target, its price and build time; undefined at the last level. */
export const nextUpgrade = (s: Save, target: BuildTarget) => upgradeStep(target, targetLevel(s, target) + 1);
/** The upgrade being built and how long it still takes, or null when the builder is free. */
export function constructionLeft(s: Pick<Save, 'construction'>, now: number) {
  return s.construction && s.construction.endsAt > now
    ? { ...s.construction, left: s.construction.endsAt - now }
    : null;
}
/** The name of what is being built, for the UI. */
export function targetName(target: BuildTarget, lang: number) {
  if (target.startsWith('habitat:')) {
    const realm = target.slice(8) as RealmId;
    return lang
      ? `${ELEMENTS.find((e) => e.id === realm)?.name[1]} habitat`
      : `Habitat ${ELEMENTS.find((e) => e.id === realm)?.name[0]}`;
  }
  return UTILITY_BUILDINGS[target as UtilityKind].name[lang];
}
/** Puts a finished upgrade in place: the level rises and the farm gets its new plots. */
function completeConstruction(s: Save) {
  const b = s.construction;
  if (!b) return;
  s.construction = null;
  if (b.target === 'farm') {
    s.farmLevel = b.level;
    s.plots.push(...Array<null>(Math.max(0, FARM_LEVELS[b.level - 1].plots - s.plots.length)).fill(null));
  } else if (b.target === 'hatchery') s.hatcheryLevel = b.level;
  else if (b.target === 'workshop') s.workshopLevel = b.level;
  else if (b.target === 'portal') s.portalLevel = b.level;
  else if (b.target === 'arena') s.arenaLevel = b.level;
  else s.habitats[b.target.slice(8) as RealmId] = b.level;
}
/**
 * Opening another element world (and its first habitat) costs gold and materials, rising world by world like
 * the original game's unlock costs. The fire world comes with the tutorial; the others open in ELEMENTS order
 * (see `worldLock`).
 */
export const WORLD_UNLOCK: Record<RealmId, { gold: number; materials: Materials }> = {
  fire: { gold: 0, materials: {} },
  water: { gold: 600, materials: { wood: 15 } },
  earth: { gold: 1500, materials: { stone: 20, wood: 20 } },
  nature: { gold: 3000, materials: { wood: 20, fiber: 20, stone: 20 } },
  ice: { gold: 5000, materials: { stone: 20, crystal: 15, wood: 30 } },
  lightning: { gold: 8000, materials: { crystal: 20, wood: 40, stone: 40 } },
  wind: { gold: 12000, materials: { fiber: 30, wood: 50, stone: 50 } },
  dark: { gold: 17000, materials: { crystal: 30, stone: 70 } },
  light: { gold: 23000, materials: { crystal: 35, wood: 70, stone: 70 } },
  arcane: { gold: 30000, materials: { crystal: 45, wood: 90, stone: 90 } },
};
/**
 * The Market sells a common egg of every world's regular families (bosses are fight-only), for the worlds with a
 * habitat; prices rise with the world's place in the unlock order.
 */
export const EGG_PRICES: Partial<Record<RealmId, number>> = {
  fire: 300,
  water: 600,
  earth: 1000,
  nature: 1500,
  ice: 2200,
  lightning: 3000,
  wind: 4000,
  dark: 5200,
  light: 6500,
  arcane: 8000,
};
export const MARKET_ELEMENTS = Object.keys(EGG_PRICES) as RealmId[];
export const eggPrice = (element: RealmId) => EGG_PRICES[element] ?? Infinity;
/** Leagues that drop eggs of their element: every world after the first three. */
export const LEAGUE_EGG_ELEMENTS: RealmId[] = ['nature', 'ice', 'lightning', 'wind', 'dark', 'light', 'arcane'];
/** What a won (or story) egg sells for, by rarity. */
export const WON_EGG_PRICE: Record<Rarity, number> = { common: 250, rare: 400, epic: 600, legendary: 0 };
/** What a waiting egg sells back for: 30% of the market price, or the won-egg price for elements leagues drop. */
export const eggSellPrice = (egg: Pick<EggKind, 'element' | 'rarity'>) =>
  LEAGUE_EGG_ELEMENTS.includes(egg.element) ? WON_EGG_PRICE[rarityOf(egg)] : Math.round(0.3 * eggPrice(egg.element));
/** Gold for releasing a dinosaur: by age, times its rarity. Bosses are never released. */
export const RELEASE_GOLD: Record<Stage, number> = { baby: 50, juvenile: 200, adult: 600 };
export const RELEASE_RARITY: Record<Exclude<Rarity, 'legendary'>, number> = { common: 1, rare: 1.5, epic: 2 };
export const releaseGold = (d: Pick<Dino, 'stage' | 'rarity' | 'species'>) =>
  d.species === 'boss' || rarityOf(d) === 'legendary'
    ? 0
    : Math.round(RELEASE_GOLD[d.stage] * RELEASE_RARITY[rarityOf(d) as Exclude<Rarity, 'legendary'>]);
/**
 * Egg drops. League fights drop their own element, more often on harder tiers (`tiers`), only in
 * LEAGUE_EGG_ELEMENTS; a boss gives its own egg the first time it is beaten. After `pity` drop-eligible
 * wins without an egg, the next one always drops. Within an element, a family not yet discovered comes `fresh` of
 * the time. Expeditions bring their region's egg: always at a region's last stage, sometimes on patrols (see
 * PATROL); those never touch the pity counter.
 */
export const EGG_DROP = { tiers: [0.1, 0.12, 0.15], pity: 8, fresh: 0.75 };
/** Won eggs waiting for the shelf: twenty regular ones, plus room kept for the unique boss and story eggs. */
const MAX_OWED_EGGS = 40,
  MAX_OWED_REGULAR = 20;
/** The collection: every playable family plus each world's boss (see `discovered`). */
export const familyId = (d: Pick<Dino, 'species' | 'element'>) => `${d.species}_${d.element}`;
export const COLLECTION: string[] = [
  ...PLAYABLE_DINOSAURS.map(familyId),
  ...(Object.keys(ARENA_BOSSES) as RealmId[]).map((element) => familyId({ species: 'boss', element })),
];
/** The chance and elements of the regular egg a win can drop, or null when this fight never drops one. */
export function eggOdds(encounter: Encounter) {
  const league = encounter.league as RealmId | undefined,
    tier = arenaTier(encounter.id);
  if (!league || !tier || !LEAGUE_EGG_ELEMENTS.includes(league) || !playableSpecies(league).length) return null;
  return { chance: EGG_DROP.tiers[tier - 1], elements: [league] };
}
/** Share of a first win's gold, food and materials that a repeat win pays. */
export const REPEAT_SHARE = 0.25;
/** A repeat of a fight already won with 3★ pays this share of the repeat's gold and food (materials stay). */
export const MASTERED_SHARE = 0.5;
/**
 * What winning this arena fight pays a team of `teamSize`: the encounter's first-win reward (a quarter of it once
 * cleared, and half of that gold and food at 3★), times the team size bonus and the Arena Gate bonus, and the egg
 * it may bring. The reducer pays exactly this; the arena screen shows it. `eggChance` is the real chance of a
 * regular egg (1 once the pity counter is full), undefined when the fight drops none; `bossEgg` is set while the
 * league boss still owes its own egg.
 */
export function rewardPreview(
  s: Pick<Save, 'cleared' | 'stars' | 'arenaLevel' | 'bossEggsClaimed' | 'eggLuck'>,
  encounterId: string,
  teamSize: number,
) {
  const e = ENCOUNTERS.find((x) => x.id === encounterId);
  if (!e) return null;
  const repeat = s.cleared.includes(e.id),
    mastered = repeat && (s.stars[e.id] ?? 0) >= 3,
    scale = (repeat ? REPEAT_SHARE : 1) * teamReward(teamSize) * (1 + ARENA_LEVELS[s.arenaLevel - 1].bonus),
    pay = (n: number, min = 0, share = 1) => Math.max(min, Math.round(n * scale * share));
  const bossEgg = !!arenaBoss(e) && !s.bossEggsClaimed.includes(e.league as RealmId),
    odds = bossEgg ? null : eggOdds(e);
  return {
    repeat,
    mastered,
    gold: pay(e.gold, 0, mastered ? MASTERED_SHARE : 1),
    food: pay(e.food, 0, mastered ? MASTERED_SHARE : 1),
    materials: Object.fromEntries(
      (Object.entries(e.materials) as [ItemId, number][]).map(([id, n]) => [id, pay(n, 1)]),
    ) as Partial<Inventory>,
    bossEgg,
    eggChance: odds ? (s.eggLuck >= EGG_DROP.pity ? 1 : odds.chance) : undefined,
  };
}
/** A number in [0, 1) fixed by its seed, so `command` stays pure and replayable. */
function roll(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
/** The expedition region of each element world. */
export const regionOf = (world: RealmId): Region => REGIONS.find((r) => r.element === world)!;
/**
 * Why a world cannot be unlocked yet, or null when it can (costs aside): worlds open in ELEMENTS order, each one
 * after the previous world and after the previous world's region is secured to its third stage.
 */
export function worldLock(
  s: Pick<Save, 'habitats' | 'expeditionProgress'>,
  world: RealmId,
): { reason: 'open' | 'world' | 'region'; world: RealmId } | null {
  if (s.habitats[world]) return { reason: 'open', world };
  const i = ELEMENTS.findIndex((e) => e.id === world),
    previous = ELEMENTS[i - 1]?.id;
  if (!previous) return null;
  if (!s.habitats[previous]) return { reason: 'world', world: previous };
  return (s.expeditionProgress[regionOf(previous).id] ?? 0) >= WORLD_UNLOCK_STAGE
    ? null
    : { reason: 'region', world: previous };
}
/**
 * The story card: ten chapters of short goals, followed one at a time. Chapter I settles the player
 * on the island and in the fire world (up to the portal and the fire region's five stages); each later chapter is
 * one world, in the order they unlock: open it, build or upgrade what the next steps need, cross its region's five
 * stages and win in its arena league. Every goal pays gold and food when claimed (more each chapter); a chapter's
 * last goal adds an egg of that world's own dinosaur and diamonds (GEM_SOURCES.chapter).
 */
export type StoryStep = {
  id: string;
  chapter: number;
  task: readonly [string, string];
  /** One line on how to get there. */
  hint: readonly [string, string];
  done: (s: Save) => boolean;
  /** Progress toward the goal as [now, needed], shown as a bar on the story card. */
  progress?: (s: Save) => [number, number];
  /** Where the player works on it. */
  panel: 'hatchery' | 'dino' | 'build' | 'farm' | 'workshop' | 'expedition' | 'arena' | 'realms' | 'collection';
  /** Select the right building when this goal opens the construction panel. */
  building?: UtilityKind;
  gold: number;
  food: number;
  /** The egg a chapter's last goal gives. */
  species?: Species;
  element?: RealmId;
};
export type StoryChapter = {
  number: number;
  /** The world the chapter is about; null for the opening chapter. */
  world: RealmId | null;
  rank: readonly [string, string];
  title: readonly [string, string];
  steps: StoryStep[];
};
type Goal = Omit<StoryStep, 'chapter' | 'gold' | 'food'>;
const leagueOf = (world: RealmId) => ENCOUNTERS.find((e) => e.id === `arena-${world}-1`)!;
const has = (kind: UtilityKind) => (s: Save) => s.buildings.some((b) => b.kind === kind);
/** Arena bosses beaten (the Champion tier of a league). */
export const bossesBeaten = (s: Pick<Save, 'cleared'>) => s.cleared.filter((id) => /^arena-[a-z]+-3$/.test(id)).length;
/** Playable families ever hatched (bosses left out). */
export const familiesFound = (s: Pick<Save, 'discovered'>) =>
  s.discovered.filter((id) => !id.startsWith('boss_')).length;
const thousands = (n: number, lang: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang ? ',' : '.');
/** A build time as "5 min", "1 h" or "1 h 30 min". */
export const buildTime = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
/** "1.500 aur, 30 lemn" — a price in words, for the hints. */
function priceText(gold: number, materials: Materials, lang: number) {
  return [
    `${thousands(gold, lang)} ${lang ? 'gold' : 'aur'}`,
    ...(Object.entries(materials) as [ItemId, number][])
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${n} ${ITEMS[id].name[lang].toLowerCase()}`),
  ].join(', ');
}
/** "1.500 aur, 30 lemn · 1 h" — the price and build time of an upgrade level. */
const stepText = (step: UpgradeStep, lang: number) =>
  `${priceText(step.gold, step.materials, lang)} · ${buildTime(step.minutes)}`;
/** A goal of reaching level `level` of a building (one level at a time, by the single builder). */
function levelGoal(target: BuildTarget, level: number, panel: Goal['panel'], id: string): Goal {
  const step = upgradeStep(target, level)!,
    name = [targetName(target, 0), targetName(target, 1)];
  return {
    id,
    task: [
      `Îmbunătățește ${target.startsWith('habitat:') ? name[0].toLowerCase() : BUILD_TASK[target as UtilityKind].replace('o fermă', 'ferma')} la nivelul ${level}`,
      `Upgrade the ${name[1].toLowerCase()} to level ${level}`,
    ],
    hint: [
      `Nivelul ${level}: ${stepText(step, 0)} de construcție.${level > 2 ? ' Nivel cu nivel, un upgrade odată.' : ''}`,
      `Level ${level}: ${stepText(step, 1)} to build.${level > 2 ? ' One level at a time, one upgrade at once.' : ''}`,
    ],
    done: (s) => targetLevel(s, target) >= level,
    progress: (s) => [Math.min(level, targetLevel(s, target)), level],
    panel,
  };
}
/** Building names as the Romanian goals say them ("Construiește atelierul"). */
const BUILD_TASK: Record<UtilityKind, string> = {
  hatchery: 'incubatorul',
  farm: 'o fermă',
  workshop: 'atelierul',
  portal: 'Portalul de expediții',
  arena: 'Poarta arenei',
  market: 'piața',
};
/** A goal of placing a new building (instant once paid). */
function buildGoal(kind: UtilityKind, id: string, hint: readonly [string, string]): Goal {
  const name = UTILITY_BUILDINGS[kind].name,
    cost = UTILITY_BUILDINGS[kind].cost;
  return {
    id,
    task: [`Construiește ${BUILD_TASK[kind]}`, `Build ${kind === 'farm' ? 'a farm' : `the ${name[1]}`}`],
    hint: [`${hint[0]} Costă ${thousands(cost, 0)} aur.`, `${hint[1]} It costs ${thousands(cost, 1)} gold.`],
    done: has(kind),
    panel: 'build',
    building: kind,
  };
}
/** The story goal of crossing a world's region: all five stages, with the team size and level its finale asks. */
function regionStep(world: RealmId, intro?: readonly [string, string]): Omit<Goal, 'id'> {
  const region = regionOf(world),
    n = regionNumber(region.id),
    size = regionTeamSize(n),
    level = stageLevel(n, REGION_STAGES);
  const team: [string, string] =
    size === 1 ? ['un dinozaur', 'one dinosaur'] : [`${size} dinozauri`, `${size} dinosaurs`];
  return {
    task: [
      `Traversează ${region.name[0]} (${REGION_STAGES}/${REGION_STAGES})`,
      `Cross ${region.name[1]} (${REGION_STAGES}/${REGION_STAGES})`,
    ],
    hint: [
      `${intro ? `${intro[0]} ` : ''}Ultima etapă cere ${team[0]} de nivel ${level}+.`,
      `${intro ? `${intro[1]} ` : ''}The last stage takes ${team[1]} at level ${level}+.`,
    ],
    done: (s) => (s.expeditionProgress[region.id] ?? 0) >= REGION_STAGES,
    progress: (s) => [Math.min(REGION_STAGES, s.expeditionProgress[region.id] ?? 0), REGION_STAGES],
    panel: 'expedition',
  };
}
/** Rewards grow with each chapter: gold 80·ch + 40 and food 50·ch + 30 for every goal. */
const pay = (chapter: number) => ({ gold: 80 * chapter + 40, food: 50 * chapter + 30 });

/**
 * A world's chapter: open the world, the chapter's own goals (`before` the region), cross the region, then `after`
 * it (by default a first win in the world's league). The last goal gives the world's egg, unless `eggOn` names an
 * earlier one (the last chapter ends on the full collection, so its egg comes with the boss, while it still counts).
 */
function worldChapter(
  number: number,
  world: RealmId,
  rank: readonly [string, string],
  egg: Species,
  before: Goal[],
  after?: Goal[],
  eggOn?: string,
): StoryChapter {
  const name = REALM_NAMES[world],
    league = leagueOf(world),
    element = ELEMENTS.find((e) => e.id === world)!;
  const lock = WORLD_UNLOCK[world],
    previous = regionOf(ELEMENTS[ELEMENTS.indexOf(element) - 1].id);
  const steps: Goal[] = [
    {
      id: `w-${world}-open`,
      task: [`Deblochează ${name[0]}`, `Unlock ${name[1]}`],
      hint: [
        `Costă ${priceText(lock.gold, lock.materials, 0)}; cere etapa ${WORLD_UNLOCK_STAGE} în ${previous.name[0]}.`,
        `It costs ${priceText(lock.gold, lock.materials, 1)}; it needs stage ${WORLD_UNLOCK_STAGE} in ${previous.name[1]}.`,
      ],
      done: (s) => !!s.habitats[world],
      panel: 'realms',
    },
    ...before,
    { id: `w-${world}-trip`, ...regionStep(world) },
    ...(after ?? [
      {
        id: `w-${world}-league`,
        task: [
          `Câștigă o luptă în ${league.name[0].split(' · ')[0]}`,
          `Win a fight in the ${league.name[1].split(' · ')[0]}`,
        ],
        hint: [
          `Treapta Ucenic: nivel ${league.level}+ pentru fiecare membru și un bilet de ${element.name[0].toLowerCase()}. Un element avantajat ajută mult.`,
          `The Apprentice tier: level ${league.level}+ for every member and a ${element.name[1].toLowerCase()} ticket. A strong element helps a lot.`,
        ],
        done: (s: Save) => s.cleared.includes(league.id),
        panel: 'arena' as const,
      },
    ]),
  ];
  return {
    number,
    world,
    rank,
    title: name,
    steps: steps.map((step, i) => ({
      ...step,
      chapter: number,
      ...pay(number),
      ...((eggOn ? step.id === eggOn : i === steps.length - 1) ? { species: egg, element: world } : {}),
    })),
  };
}
const bossLevel = (world: RealmId) => ENCOUNTERS.find((e) => e.id === `arena-${world}-3`)!.level;

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    number: 1,
    world: null,
    rank: ['Explorator', 'Explorer'],
    title: ['Prima scânteie', 'The first spark'],
    steps: (
      [
        {
          id: 'c1-hatch',
          task: ['Eclozează primul ou', 'Hatch your first egg'],
          hint: [
            'Pune oul de foc în incubator și așteaptă să crape.',
            'Put the fire egg in the hatchery and wait for it to crack.',
          ],
          done: (s) => s.dinos.length > 0,
          panel: 'hatchery',
        },
        buildGoal('farm', 'c1-farm', [
          'Ferma crește hrana cu care îți hrănești dinozaurii.',
          'The farm grows the food your dinosaurs eat.',
        ]),
        buildGoal('market', 'w-earth-market', [
          `Din Piață cumperi ouă cu aur pentru fiecare lume deblocată. Un ou de Foc costă ${eggPrice('fire')} aur; lumile următoare costă mai mult. Cumpărarea unui ou este opțională.`,
          `Buy eggs with gold at the Market for every unlocked world. A fire egg costs ${eggPrice('fire')} gold; later worlds cost more. Buying an egg is optional.`,
        ]),
        {
          id: 'c1-grow',
          task: ['Crește-ți campionul până la juvenil', 'Raise your champion to juvenile'],
          hint: ['Hrănește-l până la nivelul 9, apoi evoluează-l.', 'Feed it up to level 9, then evolve it.'],
          done: (s) => s.dinos.some((d) => d.stage !== 'baby'),
          progress: (s) => [Math.min(9, Math.max(0, ...s.dinos.map((d) => d.level))), 9],
          panel: 'dino',
        },
        buildGoal('portal', 'c1-portal', [
          'Din portal pleacă echipele în expediții.',
          'Teams leave on expeditions from the portal.',
        ]),
        {
          id: 'c1-trip',
          ...regionStep('fire', ['Prima ta aventură, în lumea focului.', 'Your first adventure, in the fire world.']),
        },
      ] satisfies Goal[]
    ).map((step, i, all) => ({
      ...step,
      chapter: 1,
      ...pay(1),
      ...(i === all.length - 1 ? { species: 'ignasaur' as Species, element: 'fire' as RealmId } : {}),
    })),
  },
  worldChapter(2, 'water', ['Navigator', 'Navigator'], 'thalassaur', [
    buildGoal('workshop', 'w-water-workshop', [
      'De acum expedițiile cer provizii; atelierul le face.',
      'From now on expeditions take supplies; the workshop makes them.',
    ]),
    buildGoal('arena', 'w-water-gate', [
      'Arena e locul unde câștigi stele, materiale și ouă.',
      'The arena is where you win stars, materials and eggs.',
    ]),
  ]),
  worldChapter(3, 'earth', ['Pionier', 'Pioneer'], 'terrasaur', [
    levelGoal('hatchery', 2, 'hatchery', 'w-earth-hatchery'),
  ]),
  worldChapter(4, 'nature', ['Îngrijitor', 'Keeper'], 'brachiosaurus', [
    levelGoal('farm', 3, 'farm', 'w-nature-farm'),
    {
      id: 'w-nature-habitat',
      task: ['Îmbunătățește un habitat la nivelul 2', 'Upgrade a habitat to level 2'],
      hint: [
        `Nivelul 2: ${stepText(upgradeStep('habitat:fire', 2)!, 0)}. Kitul se face în atelier. Un loc în plus.`,
        `Level 2: ${stepText(upgradeStep('habitat:fire', 2)!, 1)}. Kits are crafted in the workshop. One more spot.`,
      ],
      done: (s) => Object.values(s.habitats).some((l) => (l ?? 0) >= 2),
      panel: 'realms',
    },
  ]),
  worldChapter(5, 'ice', ['Îmblânzitor', 'Tamer'], 'therizinosaurus', [
    levelGoal('portal', 2, 'expedition', 'w-ice-portal'),
    {
      id: 'w-ice-boss',
      task: ['Învinge bossul unei ligi', 'Beat a league boss'],
      hint: [
        `Treapta Campion a oricărei ligi, după 2★ la Ucenic și Veteran. Bossul focului e nivel ${bossLevel('fire')}.`,
        `The Champion tier of any league, after 2★ on Apprentice and Veteran. The fire boss is level ${bossLevel('fire')}.`,
      ],
      done: (s) => bossesBeaten(s) >= 1,
      progress: (s) => [Math.min(1, bossesBeaten(s)), 1],
      panel: 'arena',
    },
  ]),
  worldChapter(6, 'lightning', ['Veteran', 'Veteran'], 'ankylobiped', [
    {
      ...levelGoal('arena', 2, 'arena', 'w-lightning-gate'),
      hint: [
        `Nivelul 2: ${stepText(upgradeStep('arena', 2)!, 0)}. Deschide ligile 6–10 (de la fulger) și dă +25% la recompense.`,
        `Level 2: ${stepText(upgradeStep('arena', 2)!, 1)}. Opens leagues 6–10 (lightning onward) and adds 25% to rewards.`,
      ],
    },
  ]),
  worldChapter(7, 'wind', ['Gardian', 'Guardian'], 'quetzalcoatlus', [
    levelGoal('farm', 4, 'farm', 'w-wind-farm'),
    {
      id: 'w-wind-families',
      task: ['Descoperă 12 familii de dinozauri', 'Discover 12 dinosaur families'],
      hint: [
        'Fiecare lume are două familii. Ouăle noi vin din piață, ligi și finalurile regiunilor.',
        'Every world has two families. New eggs come from the market, the leagues and region finales.',
      ],
      done: (s) => familiesFound(s) >= 12,
      progress: (s) => [Math.min(12, familiesFound(s)), 12],
      panel: 'collection',
    },
  ]),
  worldChapter(8, 'dark', ['Campion', 'Champion'], 'dilophosaurus', [
    levelGoal('portal', 3, 'expedition', 'w-dark-portal'),
    {
      id: 'w-dark-bosses',
      task: ['Învinge 3 boși de ligă', 'Beat 3 league bosses'],
      hint: [
        'Treapta Campion a trei ligi diferite. Fiecare boss dă o singură dată oul lui legendar.',
        'The Champion tier of three different leagues. Each boss gives its legendary egg once.',
      ],
      done: (s) => bossesBeaten(s) >= 3,
      progress: (s) => [Math.min(3, bossesBeaten(s)), 3],
      panel: 'arena',
    },
  ]),
  worldChapter(9, 'light', ['Maestru', 'Master'], 'solarraptor', [
    {
      id: 'w-light-builder',
      task: ['Ferma la nivelul 5 și atelierul la nivelul 3', 'Farm at level 5 and workshop at level 3'],
      hint: [
        `Ferma 5: ${stepText(upgradeStep('farm', 5)!, 0)}. Atelierul 3: ${stepText(upgradeStep('workshop', 3)!, 0)}.`,
        `Farm 5: ${stepText(upgradeStep('farm', 5)!, 1)}. Workshop 3: ${stepText(upgradeStep('workshop', 3)!, 1)}.`,
      ],
      done: (s) => s.farmLevel >= 5 && s.workshopLevel >= 3,
      progress: (s) => [Math.min(5, s.farmLevel) + Math.min(3, s.workshopLevel), 8],
      panel: 'farm',
    },
  ]),
  worldChapter(
    10,
    'arcane',
    ['Erou', 'Hero'],
    'cryptoraptor',
    [],
    [
      {
        id: 'w-arcane-boss',
        task: ['Învinge bossul arcan', 'Beat the arcane boss'],
        hint: [
          `Treapta Campion a Ligii sigiliilor: nivel ${bossLevel('arcane')}, după 2★ la Ucenic și Veteran.`,
          `The Champion tier of the Sigil league: level ${bossLevel('arcane')}, after 2★ on Apprentice and Veteran.`,
        ],
        done: (s) => s.cleared.includes('arena-arcane-3'),
        panel: 'arena',
      },
      {
        id: 'w-arcane-collection',
        task: [
          `Completează colecția (${COLLECTION.length}/${COLLECTION.length})`,
          `Complete the collection (${COLLECTION.length}/${COLLECTION.length})`,
        ],
        hint: [
          'Toate cele 20 de familii și cei 10 boși, eclozați măcar o dată.',
          'All 20 families and the 10 bosses, each hatched at least once.',
        ],
        done: (s) => s.discovered.length >= COLLECTION.length,
        progress: (s) => [Math.min(COLLECTION.length, s.discovered.length), COLLECTION.length],
        panel: 'collection',
      },
    ],
    'w-arcane-boss',
  ),
];
/** The player's level: the story chapter being played (the last one once every chapter is done). */
export const storyLevel = (s: Save) => storyChapter(s)?.chapter.number ?? STORY_CHAPTERS.length;
/** Every story goal in play order. Claimed ones are listed in Save.questEggs. */
export const QUEST_EGGS: StoryStep[] = STORY_CHAPTERS.flatMap((c) => c.steps);
/** The chapter being played and its next unclaimed goal; null once every chapter is done. */
export function storyChapter(s: Save) {
  const chapter = STORY_CHAPTERS.find((c) => c.steps.some((q) => !s.questEggs.includes(q.id)));
  if (!chapter) return null;
  const step = chapter.steps.find((q) => !s.questEggs.includes(q.id))!;
  return { chapter, step, index: chapter.steps.indexOf(step) };
}

export type Command =
  | { type: 'buyArenaTicket'; realm: RealmId; quantity: number }
  | { type: 'spinDaily' | 'claimDailyBonus' }
  | { type: 'claimDailyQuest'; quest: DailyQuestId }
  /** Swaps an unfinished daily mission for another one: free once a day, then GEMS.reroll. */
  | { type: 'rerollDailyQuest'; quest: DailyQuestId }
  | { type: 'incubate' | 'hatch'; eggId?: string }
  /** `times` (1 to 10) feeds again and again, stopping at the next evolution or when the food runs out. */
  | { type: 'feed'; dinoId?: string; times?: number }
  | { type: 'evolve' | 'useCrystal'; dinoId?: string }
  | { type: 'releaseDino'; dinoId: string }
  | { type: 'allocate'; dinoId: string; stat: PointStat; amount?: number }
  | { type: 'resetPoints'; dinoId: string }
  | {
      type:
        | 'collect'
        | 'claim'
        | 'collectAvailable'
        | 'upgradeFarm'
        | 'upgradeHatchery'
        | 'upgradeWorkshop'
        | 'upgradeArena'
        | 'upgradePortal'
        | 'devSkip'
        | 'devResources'
        | 'devRarityEggs';
    }
  /** Puts a dinosaur first in the arena team (it leads the fights and the HUD follows it). */
  | { type: 'setChampion'; dinoId: string }
  /** The arena team: one to three different dinosaurs, juvenile or older, at home and rested; the first leads. */
  | { type: 'setTeam'; dinoIds: string[] }
  /** The team friends fight against: zero to three different juvenile or older dinosaurs. */
  | { type: 'setDefense'; dinoIds: string[] }
  | { type: 'buyEgg'; species: Species; element: RealmId }
  | { type: 'sellEgg'; eggId: string }
  | { type: 'claimQuestEgg'; questId: string }
  | { type: 'unlockHabitat' | 'upgradeHabitat'; realm: RealmId }
  | { type: 'plant'; crop?: CropId; plot?: number }
  | { type: 'harvest'; plot?: number }
  | { type: 'battle'; encounterId?: string }
  /** Sends a team (1 to 3 dinosaurs) on a region's next stage. */
  | { type: 'expedition'; regionId: string; team: string[] }
  /** Sends a team on a 1, 3 or 8 hour patrol in a region secured to its third stage. */
  | { type: 'patrol'; regionId: string; hours: PatrolHours; team: string[] }
  /** Claims a finished run (the first one when no id is given). */
  | { type: 'claimExpedition'; runId?: string }
  | { type: 'build'; x: number; y: number; kind?: UtilityKind }
  | { type: 'craft'; recipeId: string }
  | { type: 'claimCraft' | 'cancelCraft'; jobId: string }
  | { type: 'move'; id: string; x: number; y: number }
  /** Lights a lamp from the inventory on cell (x, y), or on the first free cell when none is given. */
  | { type: 'placeLamp'; x?: number; y?: number }
  | { type: 'moveLamp'; index: number; x: number; y: number }
  | { type: 'action'; action: AllyMove; tapped?: boolean }
  /** Adds diamonds: the test button now, real purchases later. */
  | { type: 'addGems'; amount: number }
  | { type: 'gemFinish'; target: 'egg' | 'craft' | 'expedition' | 'plot' | 'construction'; id?: string; plot?: number }
  | { type: 'gemBoost'; hours: 1 | 4 }
  /** Once the story is finished: pays LEGEND_TRIAL's gold and food for diamonds and an egg. */
  | { type: 'legendTrial' }
  /** Fights the weekly tower's next floor with the arena team (no tickets, no rest). */
  | { type: 'towerFight' }
  | { type: 'claimTower'; floor: TowerRewardFloor }
  /** Pets a dinosaur (a little food, PET.perDay times a day), or starts its free training (TRAINING). */
  | { type: 'pet' | 'train'; dinoId: string }
  /** Ends a finished training (+1 level) or picks up the island's lost treasure. */
  | { type: 'claimTraining' | 'treasure' }
  /** Wakes a resting dinosaur (the champion when none is given), or with `team` every resting team member. */
  | { type: 'gemRest'; dinoId?: string; team?: boolean }
  | { type: 'gemSpin' };
export function newSave(now: number): Save {
  const s: Save = {
    schemaVersion: 6,
    contentVersion: 1,
    revision: 0,
    updatedAt: now,
    gold: 1000,
    // A welcome gift: enough to try finishing a timer or two.
    gems: GEM_SOURCES.welcome,
    boostUntil: 0,
    // Enough to raise the first dinosaur to juvenile with the first two story rewards.
    food: 400,
    storedGold: 0,
    buildings: [{ id: 'nest', kind: 'hatchery', x: 2, y: 4 }],
    dinos: [],
    champion: null,
    team: [],
    defense: [],
    eggs: [{ id: 'egg-ignis', species: 'trex', element: 'fire', seconds: EGG_SECONDS.tutorial, hatchAt: null }],
    hatcheryLevel: 1,
    workshopLevel: 1,
    arenaLevel: 1,
    portalLevel: 0,
    arenaTickets: {},
    arena: { week: weekId(now), weekWins: 0, weekClaimed: 0 },
    habitats: { fire: 1 },
    questEggs: [],
    eggLuck: 0,
    owedEggs: [],
    bossEggsClaimed: [],
    stars: {},
    starMilestones: 0,
    tired: {},
    farmLevel: 1,
    plots: Array<null>(FARM_LEVELS[0].plots).fill(null),
    battle: null,
    victories: 0,
    rewardPending: false,
    inventory: initialInventory(),
    crafting: [],
    expeditions: [],
    expeditionProgress: {},
    daily: newDaily(now),
    cleared: [],
    construction: null,
    discovered: [],
    collectionMilestones: 0,
    lamps: 0,
    lampSpots: [],
    legend: { week: weekId(now), trials: 0 },
    tower: { week: weekId(now), floor: 0, claimed: [] },
    training: null,
  };
  // The first day's missions are drawn among those a newcomer can do.
  s.daily = newDaily(now, s);
  return s;
}
export const farmYield = (level: number, crop: CropId) =>
  Math.round(CROPS.find((c) => c.id === crop)!.food * FARM_LEVELS[level - 1].yield);
/** Food waiting in ready plots. */
export const farmReadyFood = (s: Save, now: number) =>
  s.plots.reduce((n, p) => n + (p && p.readyAt <= now ? farmYield(s.farmLevel, p.crop) : 0), 0);
/** When the next growing plot is ready, or null if nothing grows. */
export const farmNextAt = (s: Save) =>
  s.plots.reduce<number | null>((at, p) => (p && (at === null || p.readyAt < at) ? p.readyAt : at), null);
function harvestPlots(s: Save, now: number, indexes: number[]) {
  let food = 0;
  for (const i of indexes) {
    const p = s.plots[i];
    if (!p || p.readyAt > now) continue;
    food += farmYield(s.farmLevel, p.crop);
    s.plots[i] = null;
  }
  s.food += food;
  return food;
}
export const champion = (s: Save) => s.dinos.find((d) => d.id === s.champion) ?? null;
export const residents = (s: Save, realm: RealmId) => s.dinos.filter((d) => d.element === realm);
export const habitatCapacity = (s: Save, realm: RealmId) =>
  s.habitats[realm] ? HABITAT_LEVELS[s.habitats[realm]! - 1].capacity : 0;
/** A running gold boost also multiplies the habitats' gold storage by this. */
export const BOOST_CAP = 2;
/** Gold storage of all habitats together; with `now`, doubled while a boost runs. */
export const goldCap = (s: Pick<Save, 'habitats' | 'boostUntil'>, now?: number) =>
  (Object.values(s.habitats) as number[]).reduce((n, level) => n + HABITAT_LEVELS[level - 1].cap, 0) *
  (now !== undefined && s.boostUntil > now ? BOOST_CAP : 1);
/** Gold per hour of one dinosaur: by stage, earth ×1.25, times its habitat's level and the placed lamps. */
export const STAGE_INCOME: Record<Stage, number> = { baby: 3, juvenile: 8, adult: 15 };
export const dinoIncome = (s: Pick<Save, 'habitats' | 'lamps'>, d: Dino) =>
  STAGE_INCOME[d.stage] *
  (d.element === 'earth' ? 1.25 : 1) *
  HABITAT_LEVELS[(s.habitats[d.element] ?? 1) - 1].income *
  (1 + LAMP_BONUS * s.lamps);
/** Gold per hour of every dinosaur; with `now`, of those at home at that moment (a team away earns nothing). */
export const goldRate = (s: Save, now?: number) =>
  s.dinos.reduce((n, d) => n + (now !== undefined && awayAt(s, d.id, now) ? 0 : dinoIncome(s, d)), 0);
/** Whether a dinosaur is away on an expedition at `at`. */
const awayAt = (s: Pick<Save, 'expeditions'>, id: string, at: number) =>
  s.expeditions.some((x) => x.team.includes(id) && x.startedAt <= at && at < x.endsAt);
export const workshop = (s: Save) => WORKSHOP_LEVELS[s.workshopLevel - 1];
/** When each workshop lane is free again (never before `now`). */
const laneFree = (s: Save, lane: number, now: number) =>
  Math.max(now, ...s.crafting.filter((j) => (j.lane ?? 0) === lane).map((j) => j.endsAt));
export const incubating = (s: Save) => s.eggs.filter((e) => e.hatchAt !== null);
export const hatcherySlots = (s: Save) => HATCHERY_LEVELS[s.hatcheryLevel - 1].slots;
/** Expeditions that can be away at once. */
export const portalSlots = (s: Save) => (s.portalLevel ? PORTAL_LEVELS[s.portalLevel - 1].slots : 1);
/** The first expedition under way (see `expeditions` for all of them, one per portal slot). */
export const currentTrip = (s: Pick<Save, 'expeditions'>) => s.expeditions[0] ?? null;
/** Dinosaurs that cannot be used elsewhere: away on an expedition or in the current fight. */
export const busyDinos = (s: Pick<Save, 'expeditions' | 'battle'>) =>
  new Set([...s.expeditions.flatMap((x) => x.team), ...(s.battle ? s.battle.team.map((a) => a.dinoId) : [])]);
/** Whether a story goal gives an egg. */
export const storyEgg = (q: StoryStep): q is StoryStep & EggKind => !!q.species && !!q.element;
/**
 * Food for one level: 14 at level 1, 110 at 9, 600 at 24, 2318 at 49. Juvenile (level 10) takes about 480 in all,
 * adult (25) about 5,550 and level 50 about 40,500: food is what paces the regions and the arena (see BALANCE.md).
 */
export const feedCost = (level: number) => Math.round(10 + 3 * level + 0.9 * level * level);
/** The last level of each age: there a dinosaur must evolve before it can grow again. */
export const levelCap = (stage: Stage) => (stage === 'baby' ? 9 : stage === 'juvenile' ? 24 : 50);
/** Things to do while timers run: petting (food), free training (a level), and treasures lost on the island. */
export const PET = { perDay: 5, food: 10 };
export const TRAINING = { minutes: 30, perDay: 3 };
export const TREASURE = { perDay: 4, everyMs: 2 * 3_600_000 };
/** Whether a treasure waits on the island: up to TREASURE.perDay a day, TREASURE.everyMs apart. */
export const treasureReady = (s: Save, now: number) => {
  const day = dailyState(s, now);
  return s.dinos.length > 0 && day.treasures < TREASURE.perDay && now - day.treasureAt >= TREASURE.everyMs;
};
/** The `n`-th treasure of `day`: mostly gold or food, sometimes materials, rarely a diamond. */
export function treasureReward(day: string, n: number): DailyReward {
  const r = roll(`${day}:treasure:${n}`);
  if (r < 0.05) return { gems: 1 };
  if (r < 0.25) return { materials: { [(['wood', 'stone', 'fiber', 'crystal'] as ItemId[])[n % 4]]: 4 } };
  if (r < 0.6) return { food: 40 };
  return { gold: 80 };
}
/** Where today's next treasure lies: a free lawn cell, fixed by the day and how many were found. */
export function treasureSpot(s: Save, now: number) {
  const day = dailyState(s, now);
  const free = BUILDABLE_CELLS.filter(
    (c) => !s.buildings.some((b) => c.x >= b.x && c.x < b.x + 3 && c.y >= b.y && c.y < b.y + 3),
  );
  return free.length ? free[Math.floor(roll(`${day.day}:spot:${day.treasures}`) * free.length)] : null;
}
/**
 * Stat points: one per level above 1, plus 3 for each evolution reached. Every level grows hp, power and defense by
 * 0.03 on its own and each point adds POINT_GROWTH to its stat; an even spread (or no spending) gives today's 0.06.
 */
export const statPoints = (d: Pick<Dino, 'level' | 'stage'>) =>
  d.level - 1 + (d.stage === 'baby' ? 0 : 3) + (d.stage === 'adult' ? 3 : 0);
export const POINT_GROWTH = 0.09;
export const spentPoints = (d: Pick<Dino, 'points'>) =>
  d.points ? d.points.hp + d.points.power + d.points.defense : 0;
export const freePoints = (d: Pick<Dino, 'level' | 'stage' | 'points'>) => statPoints(d) - spentPoints(d);
export const RESET_COST = (d: Pick<Dino, 'level'>) => 50 * d.level;
export const stats = (
  level: number,
  stage: Stage,
  species: Species = 'trex',
  rarity: Rarity = 'common',
  points?: StatPoints,
) => {
  const base = 1 + 0.06 * (level - 10),
    m = SPECIES_STATS[species],
    avg = points ? (points.hp + points.power + points.defense) / 3 : 0,
    // Free points count as spread evenly, so only the gap from the average moves a stat.
    f = (stat: PointStat) =>
      (base + (points ? POINT_GROWTH * (points[stat] - avg) : 0)) *
      (stage === 'adult' ? 1.05 : 1) *
      RARITY_POWER[rarity];
  return {
    hp: Math.round(220 * m.hp * f('hp')),
    power: Math.round(40 * m.power * f('power')),
    defense: Math.round(20 * m.defense * f('defense')),
    speed: Math.round(25 * m.speed),
  };
};
/** A dinosaur's stats with the points its keeper spent. */
export const dinoStats = (d: Pick<Dino, 'level' | 'stage' | 'species' | 'rarity' | 'points'>) =>
  stats(d.level, d.stage, d.species, rarityOf(d), d.points);
/** Rolls the egg an encounter may drop, with the shared pity counter. Mutates `s.eggLuck`. */
function rollEgg(s: Save, encounter: Encounter, now: number): EggKind | undefined {
  const odds = eggOdds(encounter);
  if (!odds) return undefined;
  const seed = `${s.revision}:${now}:${encounter.id}`;
  if (s.eggLuck >= EGG_DROP.pity || roll(seed) < odds.chance) {
    const element = odds.elements[Math.floor(roll(`${seed}:element`) * odds.elements.length)];
    s.eggLuck = 0;
    return drawEgg(s, element, seed, rarityOdds(encounter));
  }
  s.eggLuck++;
  return undefined;
}
/**
 * The family and rarity of an egg of `element`, fixed by `seed`: a family still missing from the collection comes
 * first, most of the time (EGG_DROP.fresh). Undefined when the element has no playable family.
 */
function drawEgg(
  s: Pick<Save, 'discovered'>,
  element: RealmId,
  seed: string,
  chance: { rare: number; epic: number },
): EggKind | undefined {
  const all = playableSpecies(element),
    fresh = all.filter((species) => !s.discovered.includes(familyId({ species, element })));
  if (!all.length) return undefined;
  const species = fresh.length && roll(`${seed}:fresh`) < EGG_DROP.fresh ? fresh : all;
  const r = roll(`${seed}:rarity`);
  return {
    species: species[Math.floor(roll(`${seed}:species`) * species.length)],
    element,
    rarity: r < chance.epic ? 'epic' : r < chance.epic + chance.rare ? 'rare' : 'common',
  };
}
/**
 * Hands a won egg to the waiting list (the shelf takes it as soon as there is room). Boss and story eggs always
 * have room; a regular egg won while twenty already wait is sold at once, for twice its price, with a notice.
 */
function receiveEgg(s: Save, egg: EggKind) {
  const regular = egg.species !== 'boss' && !egg.story;
  if (
    !regular
      ? s.owedEggs.length < MAX_OWED_EGGS
      : s.owedEggs.filter((e) => e.species !== 'boss' && !e.story).length < MAX_OWED_REGULAR
  )
    s.owedEggs.push(egg);
  else if (regular) {
    const gold = 2 * eggSellPrice(egg);
    s.gold += gold;
    s.notice = { eggSold: (s.notice?.eggSold ?? 0) + gold };
  } else throw new Error('eggsFull');
  if (egg.species === 'boss' && !s.bossEggsClaimed.includes(egg.element)) s.bossEggsClaimed.push(egg.element);
}
/** Adds diamonds the player earned, and tells the player about them (see `Save.notice`). */
function earnGems(s: Save, gems: number) {
  if (gems <= 0) return;
  s.gems += gems;
  s.notice = { ...s.notice, gems: (s.notice?.gems ?? 0) + gems };
}
/** Worlds whose arena league is open: tickets won for "a world" go to one of them. */
export const ticketWorlds = (s: Pick<Save, 'habitats' | 'arenaLevel'>) =>
  ELEMENTS.map((e) => e.id).filter((e) => s.habitats[e] && (!GATE_LEAGUES.includes(e) || s.arenaLevel >= 2));
/** Arena tickets of a world drawn by `seed` among the open leagues, with a notice naming it. */
function grantTickets(s: Save, count: number, seed: string) {
  const open = ticketWorlds(s),
    realm = open[Math.floor(roll(seed) * open.length)] ?? 'fire';
  s.arenaTickets[realm] = Math.min(ARENA_TICKET_LIMIT, (s.arenaTickets[realm] ?? 0) + count);
  s.notice = { ...s.notice, tickets: { realm, count } };
}
/** A daily reward (mission, chest or wheel): gold, food, materials, diamonds and tickets. */
function grantReward(s: Save, reward: DailyReward, seed: string) {
  grantDailyReward(s, reward);
  if (reward.gems) earnGems(s, reward.gems);
  if (reward.tickets) grantTickets(s, reward.tickets, `${seed}:tickets`);
}
/**
 * Stars for a won fight, from the team's share of health left (all members together): half or more with nobody
 * fallen is three, a fifth or more two, anything less one.
 */
export function starsFor(hpLeft: number, maxHp: number, fallen = false) {
  const share = hpLeft / maxHp;
  return share >= 0.5 && !fallen ? 3 : share >= 0.2 ? 2 : 1;
}
/** Stars needed on a tier to open the next tier of its league. */
export const STARS_TO_ADVANCE = 2;
/** Rewards for the total of arena stars (90 at most: ten leagues, three tiers, three stars), diamonds included. */
export const STAR_MILESTONES: {
  stars: number;
  gold: number;
  food: number;
  gems: number;
  materials: Partial<Inventory>;
}[] = [
  { stars: 5, gold: 300, food: 150, gems: 2, materials: { crystal: 5 } },
  { stars: 12, gold: 600, food: 250, gems: 3, materials: { evolutionCrystal: 1 } },
  { stars: 20, gold: 1000, food: 400, gems: 3, materials: { crystal: 15, stone: 15 } },
  { stars: 30, gold: 1800, food: 600, gems: 5, materials: { evolutionCrystal: 2 } },
  { stars: 42, gold: 3000, food: 800, gems: 5, materials: { crystal: 25, wood: 25, stone: 25 } },
  { stars: 55, gold: 4500, food: 1000, gems: 5, materials: { evolutionCrystal: 3 } },
  { stars: 70, gold: 6500, food: 1500, gems: 7, materials: { crystal: 40, habitatKit: 1 } },
  { stars: 90, gold: 10000, food: 2500, gems: 10, materials: { evolutionCrystal: 5 } },
];
/** Rewards for the collection (families and bosses ever hatched, see `discovered`), each paid once. */
export const COLLECTION_MILESTONES: { count: number; gems: number; gold: number }[] = [
  { count: 5, gems: 3, gold: 200 },
  { count: 10, gems: 3, gold: 400 },
  { count: 15, gems: 4, gold: 600 },
  { count: 20, gems: 5, gold: 900 },
  { count: 25, gems: 5, gold: 1200 },
  { count: 30, gems: 10, gold: 2000 },
];
export const starTotal = (s: Pick<Save, 'stars'>) => Object.values(s.stars).reduce((a, b) => a + b, 0);
/**
 * Rest after an arena fight, in minutes: after a win, the members still standing rest by tier (2, 4 or 6) and the
 * fallen ones 10; after a defeat or a draw every member rests 20. A resting dinosaur cannot join the arena team
 * (it may still go on expeditions); diamonds wake it early (GEMS.rest, or GEMS.restTeam for the whole team).
 */
export const ARENA_REST = { win: [2, 4, 6], fallen: 10, defeat: 20 };
/** Whether the dinosaur is still resting from an arena fight. */
export const isTired = (s: Pick<Save, 'tired'>, dinoId: string, now: number) => (s.tired[dinoId] ?? 0) > now;
/** How hard every blow lands, against the defender's defense: `power × 100 / (100 + defense) × HIT`. */
export const HIT = 0.9;
const blow = (power: number, defense: number) => (power * 100 * HIT) / (100 + defense);
/** Damage the dinosaur's strike deals against `defense`, before element and guard; `defend` deals none. */
export function strikeDamage(
  d: Pick<Dino, 'level' | 'stage' | 'species' | 'rarity' | 'points'>,
  action: AllyMove,
  defense = 20,
) {
  if (action === 'defend') return 0;
  const st = dinoStats(d);
  return Math.max(1, Math.floor(blow(st.power * (action === 'ultimate' ? ULTIMATE_POWER : 1), defense)));
}
type Stand = Pick<Battle, 'round' | 'enemyEnergy' | 'foes' | 'foeIndex'> & Partial<Pick<Battle, 'hp' | 'maxHp'>>;
/** The opponent on stage. */
export const activeFoe = (b: Pick<Battle, 'foes' | 'foeIndex'>) => b.foes[b.foeIndex];
/** The opponent's move this round, fixed by the round and its bar, so the fight stays replayable. */
export function foeMove(b: Stand): FoeMove {
  // The guard comes first on its rounds, so it is seen even while the bar is full.
  if (b.round % 6 === 2) return 'defend';
  return b.enemyEnergy >= 100 && foeHasUltimate(activeFoe(b)) ? 'ultimate' : 'attack';
}
/**
 * Energy pacing: both bars fill fast enough for an ultimate about every third round, so they show all fight
 * long instead of once near the end. The dinosaur also charges when it is hit.
 */
export const ENERGY = { basic: 50, defend: 25, hit: 15, foe: 50 };
/** Power of either side's ultimate, against a basic strike. */
export const ULTIMATE_POWER = 1.3;
/** Extra power of an ultimate the player tapped in time (on top of ULTIMATE_POWER). */
export const TAP_BONUS = 1.15;
/** A guarding opponent takes half of the blow. */
export const FOE_GUARD = 0.5;
/** A guarding dinosaur takes this share of the blow. */
export const GUARD_TAKEN = 0.6;
/** Share of the incoming blow a guarding dinosaur turns back on its opponent. */
export const REFLECT = 0.25;
/** Chance to dodge an unguarded blow: faster species slip away more often (raptor about 9%, ankylosaur 1%); fast roles more. */
export function dodgeChance(d: Pick<Dino, 'level' | 'stage' | 'species' | 'rarity'>) {
  return (
    Math.min(0.12, Math.max(0.01, (stats(d.level, d.stage, d.species, rarityOf(d)).speed - 20) / 100)) +
    (SPECIES_ROLE[d.species] === 'fast' ? ROLE_EFFECTS.swiftAlly : 0)
  );
}
/**
 * The element wheel: each element beats exactly one and is beaten by exactly one. Fire burns nature, nature
 * overgrows earth, earth grounds lightning, lightning strikes water, water quenches fire; ice freezes wind, wind
 * scatters arcane sigils, arcane binds the dark, dark swallows light, light melts ice.
 */
export const ELEMENT_BEATS: Record<RealmId, RealmId[]> = {
  fire: ['nature'],
  nature: ['earth'],
  earth: ['lightning'],
  lightning: ['water'],
  water: ['fire'],
  ice: ['wind'],
  wind: ['arcane'],
  arcane: ['dark'],
  dark: ['light'],
  light: ['ice'],
};
/** 1 when `attacker` has the edge over `defender`, -1 when it is at a disadvantage, 0 when neutral. */
export function elementEdge(attacker: RealmId, defender: RealmId): -1 | 0 | 1 {
  if (ELEMENT_BEATS[attacker].includes(defender)) return 1;
  if (ELEMENT_BEATS[defender].includes(attacker)) return -1;
  return 0;
}
/** Damage multipliers from the edge: an advantage hits harder and softens the blows taken; a disadvantage, the reverse. */
export const EDGE_DEALT = { [1]: 1.3, [0]: 1, [-1]: 0.8 } as const;
export const EDGE_TAKEN = { [1]: 0.8, [0]: 1, [-1]: 1.3 } as const;
/** The opponent's element in an encounter: arena leagues fight with their own element. */
export const encounterElement = (encounterId: string) =>
  ENCOUNTERS.find((e) => e.id === encounterId)?.league as RealmId | undefined;
/** The dinosaur's edge in this encounter (neutral where the opponent has no element). */
export function battleEdge(encounterId: string, d: Pick<Dino, 'element'>): -1 | 0 | 1 {
  const foe = encounterElement(encounterId);
  return foe ? elementEdge(d.element, foe) : 0;
}
type Fighter = Pick<Dino, 'level' | 'stage' | 'species' | 'element' | 'rarity' | 'points'>;
/**
 * Levels above the opponent count on their own, beyond the stats they bring: each one adds `perLevel` to the
 * damage dealt and takes it off the damage taken, up to `max` levels. Without it a few extra levels would hardly
 * matter in the late leagues, where stats grow slowly.
 */
export const LEVEL_GAP = { perLevel: 0.04, max: 10 };
export const levelEdge = (gap: number) =>
  1 + LEVEL_GAP.perLevel * Math.max(-LEVEL_GAP.max, Math.min(LEVEL_GAP.max, gap));
type Side = { hp: number; maxHp?: number; species?: Species; shieldUsed?: true };
const hasRole = (x: { species?: Species } | undefined, role: Role) => !!x?.species && SPECIES_ROLE[x.species] === role;
const raging = (x: Side) => hasRole(x, 'attacker') && x.maxHp !== undefined && x.hp < x.maxHp * ROLE_EFFECTS.rageBelow;
const shielded = (x: Side | undefined) => hasRole(x, 'tank') && !x!.shieldUsed;
/** A living support of the side waits on the bench. */
const aura = (side: Side[] | undefined, active: number | undefined) =>
  !!side && side.some((m, i) => i !== active && m.hp > 0 && hasRole(m, 'support'));
type Board = Stand & Partial<Pick<Battle, 'team' | 'active'>>;
/** Role abilities that change the dinosaur's strike this round (rage on its side; shield and aura on the foe's). */
export function strikeAbilities(b: Board, d: Fighter): Ability[] {
  const foe = activeFoe(b),
    out: Ability[] = [];
  if (b.hp !== undefined && raging({ hp: b.hp, maxHp: b.maxHp, species: d.species }))
    out.push({ on: 'ally', kind: 'rage' });
  if (shielded(foe)) out.push({ on: 'enemy', kind: 'shield' });
  if (aura(b.foes, b.foeIndex)) out.push({ on: 'enemy', kind: 'aura' });
  return out;
}
/** Role abilities that change the opponent's blow this round (rage on its side; shield and aura on the team's). */
export function blowAbilities(b: Pick<Board, 'foes' | 'foeIndex' | 'team' | 'active'>, d: Fighter): Ability[] {
  const foe = activeFoe(b),
    ally = b.team?.[b.active ?? 0],
    out: Ability[] = [];
  if (raging(foe)) out.push({ on: 'enemy', kind: 'rage' });
  if (ally && shielded({ ...ally, species: d.species })) out.push({ on: 'ally', kind: 'shield' });
  if (aura(b.team, b.active)) out.push({ on: 'ally', kind: 'aura' });
  return out;
}
const abilityFactor = (list: Ability[]) =>
  list.reduce(
    (m, a) =>
      m *
      (a.kind === 'rage'
        ? a.on === 'enemy'
          ? ROLE_EFFECTS.foeRage
          : ROLE_EFFECTS.rage
        : a.kind === 'shield'
          ? ROLE_EFFECTS.shield
          : a.kind === 'aura'
            ? a.on === 'enemy'
              ? ROLE_EFFECTS.foeAura
              : ROLE_EFFECTS.aura
            : 1),
    1,
  );
/** Damage the dinosaur's strike deals to the opponent on stage this round, after its element, roles and guard. */
export function strikeAgainst(b: Board, d: Fighter, action: AllyMove) {
  if (action === 'defend') return 0;
  const foe = activeFoe(b),
    raw = Math.max(
      1,
      Math.floor(
        strikeDamage(d, action, foe.defense) *
          EDGE_DEALT[elementEdge(d.element, foe.element)] *
          levelEdge(d.level - foe.level) *
          abilityFactor(strikeAbilities(b, d)),
      ),
    );
  return foeMove(b) === 'defend' ? Math.max(1, Math.floor(raw * FOE_GUARD)) : raw;
}
/** Damage the opponent on stage deals back with a plain blow, after roles, reduced when the dinosaur defends. */
export function incomingDamage(
  b: Pick<Battle, 'foes' | 'foeIndex'> & Partial<Pick<Battle, 'team' | 'active'>>,
  d: Fighter,
  defending: boolean,
) {
  const foe = activeFoe(b),
    st = dinoStats(d);
  return Math.max(
    1,
    Math.floor(
      blow(foe.power, st.defense) *
        (defending ? GUARD_TAKEN : 1) *
        EDGE_TAKEN[elementEdge(d.element, foe.element)] *
        levelEdge(foe.level - d.level) *
        abilityFactor(blowAbilities(b, d)),
    ),
  );
}
/** Points the mirrored fields of a fight at the fighters on stage. */
function onStage(b: Battle) {
  const ally = b.team[b.active],
    foe = activeFoe(b);
  b.dinoId = ally.dinoId;
  b.hp = ally.hp;
  b.maxHp = ally.maxHp;
  b.enemy = foe.hp;
  b.enemyMax = foe.maxHp;
}
/** The arena team's dinosaurs, in order (members no longer owned are left out). */
export const teamDinos = (s: Pick<Save, 'team' | 'dinos'>) =>
  s.team.map((id) => s.dinos.find((d) => d.id === id)).filter((d): d is Dino => !!d);
/** Friendly fights against a friend's arena team: `friend:<their user id>`. No tickets, rest or rewards. */
export const FRIENDLY_PREFIX = 'friend:';
export const isFriendly = (encounterId: string) => encounterId.startsWith(FRIENDLY_PREFIX);
/**
 * A copy of `me` with a friendly fight under way against `rival`'s arena team (babies stay home), each foe with
 * the stats its dinosaur really has. The copy is only for the fight screen: the real save never holds it.
 */
export function friendlyBattle(me: Save, rival: Save, rivalId: string, now: number): Save {
  const s = advance(me, now);
  const defense = (rival.defense ?? [])
    .map((id) => rival.dinos.find((d) => d.id === id))
    .filter((d): d is Dino => !!d && d.stage !== 'baby');
  const team = teamDinos(s).filter((d) => d.stage !== 'baby'),
    foes: Foe[] = (defense.length ? defense : teamDinos(rival))
      .filter((d) => d.stage !== 'baby')
      .map((d) => {
        // The friend's own point allocation counts: how they built their team decides the fight.
        const st = dinoStats(d);
        return {
          species: d.species,
          element: d.element,
          stage: d.stage,
          level: d.level,
          rarity: rarityOf(d),
          hp: st.hp,
          maxHp: st.hp,
          power: st.power,
          defense: st.defense,
          speed: st.speed,
        };
      });
  if (!team.length) throw new Error('juvenile');
  if (!foes.length) throw new Error('rivalTeam');
  const b: Battle = {
    encounterId: `${FRIENDLY_PREFIX}${rivalId}`,
    team: team.map((d) => {
      const hp = dinoStats(d).hp;
      return { dinoId: d.id, hp, maxHp: hp, species: d.species };
    }),
    active: 0,
    foes,
    foeIndex: 0,
    reward: { gold: 0, food: 0, materials: {} },
    dinoId: '',
    hp: 0,
    maxHp: 0,
    energy: 0,
    enemy: 0,
    enemyMax: 0,
    enemyEnergy: 0,
    round: 1,
    result: null,
    log: 'start',
  };
  onStage(b);
  s.battle = b;
  s.rewardPending = false;
  return s;
}
/** The weekly tower: TOWER_FLOORS floors fought with the arena team, reset every Bucharest week. */
export const TOWER_FLOORS = 10;
export const TOWER_PREFIX = 'tower:';
export const isTower = (encounterId: string) => encounterId.startsWith(TOWER_PREFIX);
export const towerId = (week: string, floor: number) => `${TOWER_PREFIX}${week}:${floor}`;
/** The week and floor of a tower fight id, or null. */
export function parseTowerId(id: string) {
  const m = /^tower:(\d{4}-\d{2}-\d{2}):(\d{1,2})$/.exec(id),
    floor = m ? Number(m[2]) : 0;
  return m && floor >= 1 && floor <= TOWER_FLOORS ? { week: m[1], floor } : null;
}
/** A floor's twist: foes of one element, no support heals, dodging foes, or one foe with extra health. */
export type TowerRule = `element:${RealmId}` | 'noHeal' | 'swift' | 'giant';
export const TOWER_SWIFT = 0.12;
export const TOWER_GIANT = 1.5;
export type TowerRewardFloor = 3 | 6 | 10;
export const TOWER_REWARDS: Record<TowerRewardFloor, DailyReward & { egg?: { rare: number; epic: number } }> = {
  3: { gold: 1500, food: 1000 },
  6: { materials: { wood: 30, stone: 30, crystal: 10 }, tickets: 2 },
  10: { gems: 5, egg: { rare: 0.45, epic: 0.35 } },
};
const towerElements = () => ELEMENTS.map((e) => e.id).filter((e) => playableSpecies(e).length);
export function towerRule(week: string, floor: number): TowerRule {
  const seed = `${towerId(week, floor)}:rule`,
    r = roll(seed);
  if (r < 0.4) {
    const pool = towerElements();
    return `element:${pool[Math.floor(roll(`${seed}:element`) * pool.length)]}`;
  }
  return r < 0.6 ? 'noHeal' : r < 0.8 ? 'swift' : 'giant';
}
export const towerRuleElement = (rule: TowerRule) => (rule.startsWith('element:') ? (rule.slice(8) as RealmId) : null);
/** The level tower floors scale from: the team's best level, kept within 10 to 50. */
export const towerBase = (team: Pick<Dino, 'level'>[]) => Math.min(50, Math.max(10, ...team.map((d) => d.level)));
/** The foes' level on `floor`: a little under the team on the first floors, above it at the top. */
export const towerLevel = (base: number, floor: number) => base + floor - 4;
/** The top floor's boss league: one of the open leagues with a boss (any boss when none is open), fixed by the week. */
export function towerBossLeague(week: string, open: RealmId[]): RealmId {
  const bosses = Object.keys(ARENA_BOSSES) as RealmId[],
    pool = bosses.filter((e) => open.includes(e)),
    list = pool.length ? pool : bosses;
  return list[Math.floor(roll(`${TOWER_PREFIX}${week}:boss`) * list.length)];
}
/**
 * The foes of tower floor `floor` (1 to TOWER_FLOORS) in `week` at `towerLevel`: different families, rarer higher
 * up, a guardian boss on floor 5 and the boss on top. The same inputs always give the same foes.
 */
export function towerFoes(week: string, floor: number, base: number, bossLeague: RealmId): Foe[] {
  const seed = towerId(week, floor),
    rule = towerRule(week, floor),
    fixed = towerRuleElement(rule),
    level = towerLevel(base, floor),
    pool = towerElements();
  const count = floor === TOWER_FLOORS ? 2 : floor <= 2 ? 2 : 3,
    scale = 0.75 + 0.05 * floor,
    t = floor / TOWER_FLOORS;
  // Rarer foes higher up: about 1% legendary and 3% epic on floor 1, 10% and 30% on floor 10.
  const rarityFor = (i: number): Rarity => {
    const r = roll(`${seed}:${i}:rarity`);
    return r < 0.1 * t ? 'legendary' : r < 0.4 * t ? 'epic' : r < 0.7 * t + 0.2 ? 'rare' : 'common';
  };
  const make = (
    species: Species,
    element: RealmId,
    stage: Stage,
    rarity: Rarity,
    hp: number,
    power: number,
    boss?: true,
  ): Foe => {
    const st = stats(level, stage, species, rarity),
      maxHp = Math.max(1, Math.round(st.hp * hp));
    return {
      species,
      element,
      stage,
      level,
      rarity,
      hp: maxHp,
      maxHp,
      power: Math.max(1, Math.round(st.power * power)),
      defense: st.defense,
      speed: st.speed,
      ...(boss ? { boss } : {}),
    };
  };
  // Every foe of a floor is a different family, from any world unless the rule fixes the element.
  const candidates = (fixed ? [fixed] : pool)
    .flatMap((element) => playableSpecies(element).map((species) => ({ species, element })))
    .map((c) => ({ ...c, order: roll(`${seed}:pick:${c.element}:${c.species}`) }))
    .sort((a, b) => a.order - b.order);
  const picked: { species: Species; element: RealmId }[] = [];
  for (const c of candidates) if (picked.length < count && !picked.some((p) => p.species === c.species)) picked.push(c);
  // An element with fewer families than foes fields fewer, stronger foes instead of repeating one.
  const boost = 1 + 0.15 * (count - picked.length);
  // Mostly adults (with their ultimate), even below level 25; about one foe in four stays juvenile.
  const stageFor = (i: number): Stage => (level >= 25 || roll(`${seed}:${i}:stage`) < 0.75 ? 'adult' : 'juvenile');
  const foes = picked.map(({ species, element }, i) =>
    make(species, element, stageFor(i), rarityFor(i), scale * boost, scale * boost),
  );
  const bosses = Object.keys(ARENA_BOSSES) as RealmId[];
  // A guardian boss halfway up, a little weaker than the one at the top.
  if (floor === 5) {
    const league = fixed && ARENA_BOSSES[fixed] ? fixed : bosses[Math.floor(roll(`${seed}:guardian`) * bosses.length)];
    foes.push(make('boss', league, 'adult', 'epic', BOSS_STATS.hp * 0.8, BOSS_STATS.power * 0.85, true));
  }
  if (floor === TOWER_FLOORS) {
    const league = fixed && ARENA_BOSSES[fixed] ? fixed : bossLeague;
    foes.push(make('boss', league, 'adult', 'legendary', BOSS_STATS.hp, BOSS_STATS.power, true));
  }
  if (rule === 'giant') {
    const f = foes[Math.floor(roll(`${seed}:giant`) * foes.length)];
    f.maxHp = f.hp = Math.round(f.maxHp * TOWER_GIANT);
  }
  return foes;
}
/** The foes of the save's next tower floor for its arena team, as `towerFight` would start them. */
export const nextTowerFoes = (s: Save, floor = s.tower.floor + 1) =>
  towerFoes(s.tower.week, floor, towerBase(teamDinos(s)), towerBossLeague(s.tower.week, ticketWorlds(s)));
/** The season step a week with `wins` wins has reached (0 to ARENA_SEASON.length). */
export const seasonStep = (wins: number) => ARENA_SEASON.filter((x) => x.wins <= wins).length;
/**
 * Habitat gold from `a` to `b`: each dinosaur earns for the time it was home (a team away on an expedition earns
 * nothing until it is back, at `endsAt`, claimed or not); while a diamond boost runs, gold flows twice as fast and
 * the storage holds BOOST_CAP times as much.
 */
function earn(s: Save, a: number, b: number) {
  const boostEnd = Math.max(a, Math.min(b, s.boostUntil ?? 0));
  const gold = (from: number, to: number) => {
    let n = 0;
    for (const d of s.dinos) {
      const away = s.expeditions.filter((x) => x.team.includes(d.id));
      const home =
        to <= from
          ? 0
          : away.reduce((ms, x) => ms - Math.max(0, Math.min(to, x.endsAt) - Math.max(from, x.startedAt)), to - from);
      n += (dinoIncome(s, d) * home) / 3_600_000;
    }
    return n;
  };
  const cap = goldCap(s);
  if (boostEnd > a)
    s.storedGold = Math.max(s.storedGold, Math.min(cap * BOOST_CAP, s.storedGold + 2 * gold(a, boostEnd)));
  s.storedGold = Math.max(s.storedGold, Math.min(cap, s.storedGold + gold(boostEnd, b)));
}
export function advance(save: Save, now: number): Save {
  const s = structuredClone(save),
    elapsed = Math.min(Math.max(0, now - s.updatedAt), BALANCE.offlineCap),
    from = now - elapsed;
  // An upgrade finished in the meantime: the old level earns until it is done, the new one after.
  const built = s.construction && s.construction.endsAt <= now ? s.construction : null;
  if (built) {
    if (built.endsAt > from) earn(s, from, built.endsAt);
    completeConstruction(s);
    earn(s, Math.max(from, built.endsAt), now);
  } else earn(s, from, now);
  s.updatedAt = Math.max(s.updatedAt, now);
  s.daily = dailyState(s, now);
  const week = weekId(s.updatedAt);
  if (s.arena.week !== week) s.arena = { week, weekWins: 0, weekClaimed: 0 };
  if (s.legend.week !== week) s.legend = { week, trials: 0 };
  if (s.tower.week !== week) s.tower = { week, floor: 0, claimed: [] };
  // The team leads and the champion follows it (the players view reads `champion`). A save that only names a
  // champion fights with it alone.
  s.team = s.team.filter((id) => s.dinos.some((d) => d.id === id));
  if (!s.team.length && s.champion && s.dinos.some((d) => d.id === s.champion)) s.team = [s.champion];
  s.champion = s.team[0] ?? (s.dinos.some((d) => d.id === s.champion) ? s.champion : null);
  // Finished rests are forgotten.
  for (const [id, until] of Object.entries(s.tired)) if (until <= s.updatedAt) delete s.tired[id];
  return s;
}
/**
 * Friends collected the habitat gold at `times`: each collect empties the storage at that moment, so it fills again
 * after. A collect from before the save's last update simply collects what is stored now.
 */
export function friendCollect(save: Save, times: number[], now: number): Save {
  if (!times.length) return save;
  let s = save;
  for (const at of [...times].sort((a, b) => a - b)) {
    s = advance(s, Math.min(at, now));
    const gold = Math.floor(s.storedGold);
    s.gold += gold;
    s.storedGold -= gold;
  }
  s = advance(s, now);
  s.revision++;
  return s;
}
/** A 3×3 building fits when all nine cells are on the buildable lawn (see grid.ts) and none is taken. */
export function canPlace(s: Save, x: number, y: number, moving?: string) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    [0, 1, 2].every((dx) => [0, 1, 2].every((dy) => buildable(x + dx, y + dy))) &&
    !s.buildings.some((b) => b.id !== moving && x < b.x + 3 && x + 3 > b.x && y < b.y + 3 && y + 3 > b.y)
  );
}
/**
 * Where a new building (or a moved one) may go: like canPlace, but no side touches another building, so their art
 * and name labels do not stack. Corners may still meet. Saves with buildings side by side still load (canPlace).
 */
export function canBuild(s: Save, x: number, y: number, moving?: string) {
  return (
    canPlace(s, x, y, moving) &&
    !s.buildings.some((b) => {
      // Free rows between the two footprints along each axis (negative: they overlap on that axis).
      const gx = Math.abs(b.x - x) - 3,
        gy = Math.abs(b.y - y) - 3;
      return b.id !== moving && ((gx < 1 && gy < 0) || (gx < 0 && gy < 1));
    }) &&
    !s.lampSpots.some((l) => l.x >= x && l.x < x + 3 && l.y >= y && l.y < y + 3)
  );
}
/** A lamp takes one open cell, clear of buildings and other lamps (`moving`: the index of the lamp being moved). */
export function canLamp(s: Save, x: number, y: number, moving?: number) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    buildable(x, y) &&
    !s.buildings.some((b) => x >= b.x && x < b.x + 3 && y >= b.y && y < b.y + 3) &&
    !s.lampSpots.some((l, i) => i !== moving && l.x === x && l.y === y)
  );
}
const nicknameFor = (s: Save, species: Species, element: RealmId) =>
  species === 'trex' && element === 'fire' && !s.dinos.some((d) => d.nickname === 'Ignis')
    ? 'Ignis'
    : `${SPECIES_NAMES[species]} ${s.dinos.filter((d) => d.species === species).length + 1}`;
export function command(save: Save, c: Command, now: number): Save {
  const s = advance(save, now);
  delete s.notice;
  const require = (ok: unknown, message: string) => {
    if (!ok) throw new Error(message);
  };
  if (c.type === 'devSkip' || c.type === 'devResources' || c.type === 'devRarityEggs' || c.type === 'addGems')
    require(DEV_TOOLS, 'dev');
  const pay = (gold: number, materials: Partial<Record<ItemId, number>>) => {
    require(s.gold >= gold, 'gold');
    const costs = Object.entries(materials) as [ItemId, number][];
    require(costs.every(([id, count]) => s.inventory[id] >= count), 'materials');
    s.gold -= gold;
    costs.forEach(([id, count]) => (s.inventory[id] -= count));
  };
  /** Starts a building upgrade: one at a time (the single builder), paid now, done after its build time. */
  const startUpgrade = (target: BuildTarget) => {
    const level = targetLevel(s, target) + 1,
      step = upgradeStep(target, level);
    require(step, 'maxLevel');
    require(!s.construction, 'builderBusy');
    pay(step!.gold, step!.materials);
    s.construction = { target, level, startedAt: now, endsAt: now + step!.minutes * 60_000 };
    if (step!.minutes <= 0) completeConstruction(s);
  };
  /** The dinosaur a feed/evolve/crystal command targets: the given one, or the champion. */
  const target = (dinoId?: string) => {
    const d = s.dinos.find((x) => x.id === (dinoId ?? s.champion));
    require(d, 'dino');
    require(!s.battle || !s.battle.team.some((a) => a.dinoId === d!.id), 'unavailable');
    return d!;
  };
  switch (c.type) {
    case 'spinDaily':
    case 'gemSpin': {
      // The free spin comes first; each extra one costs diamonds and shows its prize on the wheel. The prize is
      // fixed by the save and the moment, so a command replays the same way.
      if (c.type === 'spinDaily') require(s.daily.spins === 0, 'dailyClaimed');
      else {
        require(s.daily.spins > 0, 'dailyFree');
        require(s.gems >= GEMS.spin, 'gems');
        s.gems -= GEMS.spin;
      }
      const seed = `${s.revision}:${now}:spin:${s.daily.day}:${s.daily.spins}`,
        prize = wheelPrize(roll(seed));
      s.daily.spin = prize;
      s.daily.spins++;
      grantReward(s, wheelPrizes(s)[prize].reward, seed);
      break;
    }
    case 'claimDailyQuest': {
      require(s.daily.quests.includes(c.quest), 'dailyQuest');
      require(!s.daily.claimed.includes(c.quest), 'dailyClaimed');
      require(s.daily.progress[c.quest] >= DAILY_QUESTS[c.quest].target, 'dailyIncomplete');
      grantReward(s, scaleDailyReward(DAILY_QUESTS[c.quest].reward, storyLevel(s)), '');
      s.daily.claimed.push(c.quest);
      break;
    }
    case 'claimDailyBonus':
      require(!s.daily.bonus, 'dailyClaimed');
      require(s.daily.quests.every((id) => s.daily.claimed.includes(id)), 'dailyIncomplete');
      grantReward(s, scaleDailyReward(DAILY_BONUS, storyLevel(s)), '');
      s.daily.bonus = true;
      break;
    case 'rerollDailyQuest': {
      // An unfinished mission makes way for another one the player can do now and does not have yet.
      require(s.daily.quests.includes(c.quest), 'dailyQuest');
      require(!s.daily.claimed.includes(c.quest) &&
        s.daily.progress[c.quest] < DAILY_QUESTS[c.quest].target, 'dailyReroll');
      const options = availableQuests(s).filter((id) => !s.daily.quests.includes(id));
      require(options.length, 'dailyReroll');
      if (s.daily.rerolls >= DAILY_REROLLS_FREE) {
        require(s.gems >= GEMS.reroll, 'gems');
        s.gems -= GEMS.reroll;
      }
      const next = options[Math.floor(roll(`${s.daily.day}:reroll:${s.daily.rerolls}:${c.quest}`) * options.length)];
      s.daily.quests = s.daily.quests.map((id) => (id === c.quest ? next : id));
      s.daily.rerolls++;
      break;
    }
    case 'incubate': {
      const egg = s.eggs.find((e) => (c.eggId ? e.id === c.eggId : e.hatchAt === null));
      require(egg && egg.hatchAt === null, 'egg');
      require(incubating(s).length < hatcherySlots(s), 'slots');
      egg!.hatchAt = now + egg!.seconds * 1000;
      break;
    }
    case 'hatch': {
      const egg = s.eggs.find((e) => (c.eggId ? e.id === c.eggId : e.hatchAt !== null && now >= e.hatchAt));
      require(egg && egg.hatchAt !== null && now >= egg.hatchAt, 'timer');
      if (!egg) break;
      require(s.habitats[egg.element], 'habitat');
      require(residents(s, egg.element).length < habitatCapacity(s, egg.element), 'habitatFull');
      require(s.dinos.length < BALANCE.maxDinos, 'habitatFull');
      // A boss egg hatches a young champion: juvenile, level 10, legendary.
      const boss = egg.species === 'boss';
      const dino: Dino = {
        id: egg.id === 'egg-ignis' ? 'ignis' : `dino-${s.revision + 1}`,
        species: egg.species,
        element: egg.element,
        level: boss ? 10 : 1,
        stage: boss ? 'juvenile' : 'baby',
        nickname: boss ? ARENA_BOSSES[egg.element].name : nicknameFor(s, egg.species, egg.element),
        rarity: boss ? 'legendary' : rarityOf(egg),
      };
      s.dinos.push(dino);
      s.eggs = s.eggs.filter((e) => e !== egg);
      if (!s.discovered.includes(familyId(dino))) s.discovered.push(familyId(dino));
      if (!s.champion) {
        s.champion = dino.id;
        s.team = [dino.id];
      }
      break;
    }
    case 'feed': {
      const d = target(c.dinoId),
        times = c.times ?? 1;
      require(Number.isInteger(times) && times >= 1 && times <= 10, 'feed');
      require(d.level < levelCap(d.stage), 'evolve');
      require(s.food >= feedCost(d.level), 'food');
      for (let i = 0; i < times && d.level < levelCap(d.stage) && s.food >= feedCost(d.level); i++) {
        s.food -= feedCost(d.level);
        d.level++;
      }
      break;
    }
    case 'evolve': {
      const d = target(c.dinoId);
      require(d.stage !== 'adult' && d.level === levelCap(d.stage), 'level');
      require(s.food >= feedCost(d.level), 'food');
      // Growing up to adult also takes an evolution crystal.
      require(d.stage === 'baby' || s.inventory.evolutionCrystal > 0, 'evolutionCrystal');
      s.food -= feedCost(d.level);
      if (d.stage === 'juvenile') s.inventory.evolutionCrystal--;
      d.level++;
      d.stage = d.stage === 'baby' ? 'juvenile' : 'adult';
      break;
    }
    case 'useCrystal': {
      const d = target(c.dinoId);
      require(s.inventory.evolutionCrystal > 0 && d.level < levelCap(d.stage), 'level');
      s.inventory.evolutionCrystal--;
      d.level++;
      break;
    }
    case 'setChampion': {
      const d = s.dinos.find((x) => x.id === c.dinoId);
      require(d, 'dino');
      require(!s.battle && !s.rewardPending, 'unavailable');
      require(d!.stage !== 'baby', 'juvenile');
      // A dinosaur away on an expedition cannot lead the arena team.
      const busy = busyDinos(s);
      require(!busy.has(c.dinoId), 'away');
      require(!isTired(s, c.dinoId, now), 'tired');
      // The other members stay while they could still be picked for the team; the last one makes room if needed.
      const others = s.team.filter((id) => {
        const m = s.dinos.find((x) => x.id === id);
        return id !== c.dinoId && !!m && m.stage !== 'baby' && !busy.has(id) && !isTired(s, id, now);
      });
      s.team = [c.dinoId, ...others.slice(0, 2)];
      s.champion = c.dinoId;
      break;
    }
    case 'setTeam': {
      const ids = c.dinoIds;
      require(Array.isArray(ids) && ids.length >= 1 && ids.length <= 3 && new Set(ids).size === ids.length, 'team');
      require(!s.battle && !s.rewardPending, 'unavailable');
      const busy = busyDinos(s);
      for (const id of ids) {
        const d = s.dinos.find((x) => x.id === id);
        require(d, 'dino');
        require(d!.stage !== 'baby', 'juvenile');
        require(!busy.has(id), 'away');
        require(!isTired(s, id, now), 'tired');
      }
      s.team = [...ids];
      s.champion = ids[0];
      break;
    }
    case 'releaseDino': {
      const d = s.dinos.find((x) => x.id === c.dinoId);
      require(d, 'dino');
      require(d!.species !== 'boss' && rarityOf(d!) !== 'legendary', 'boss');
      require(d!.id !== s.champion && !s.team.includes(d!.id), 'team');
      require(!busyDinos(s).has(d!.id), 'away');
      require(s.dinos.length > 1, 'lastDino');
      s.gold += releaseGold(d!);
      s.dinos = s.dinos.filter((x) => x !== d);
      s.defense = s.defense.filter((id) => id !== d!.id);
      delete s.tired[d!.id];
      if (s.training?.dinoId === d!.id) s.training = null;
      break;
    }
    case 'setDefense': {
      const ids = c.dinoIds;
      require(Array.isArray(ids) && ids.length <= 3 && new Set(ids).size === ids.length, 'team');
      for (const id of ids) {
        const d = s.dinos.find((x) => x.id === id);
        require(d, 'dino');
        require(d!.stage !== 'baby', 'juvenile');
      }
      s.defense = [...ids];
      break;
    }
    case 'allocate': {
      const d = target(c.dinoId),
        amount = c.amount ?? 1;
      require(POINT_STATS.includes(c.stat), 'stat');
      require(Number.isInteger(amount) && amount >= 1, 'points');
      require(freePoints(d) >= amount, 'points');
      d.points = { hp: 0, power: 0, defense: 0, ...d.points };
      d.points[c.stat] += amount;
      break;
    }
    case 'resetPoints': {
      const d = target(c.dinoId);
      require(spentPoints(d) > 0, 'points');
      require(s.gold >= RESET_COST(d), 'gold');
      s.gold -= RESET_COST(d);
      delete d.points;
      break;
    }
    case 'pet': {
      const d = s.dinos.find((x) => x.id === c.dinoId);
      require(d, 'dino');
      require(s.daily.pets < PET.perDay, 'petsDone');
      s.daily.pets++;
      s.food += PET.food;
      break;
    }
    case 'train': {
      const d = s.dinos.find((x) => x.id === c.dinoId);
      require(d, 'dino');
      require(!s.training, 'training');
      require(s.daily.trainings < TRAINING.perDay, 'trainingsDone');
      require(d!.level < levelCap(d!.stage), 'evolve');
      s.daily.trainings++;
      s.training = { dinoId: d!.id, endsAt: now + TRAINING.minutes * 60_000 };
      break;
    }
    case 'claimTraining': {
      const t = s.training;
      require(t && now >= t.endsAt, 'training');
      const d = s.dinos.find((x) => x.id === t!.dinoId);
      // Fed up to the evolution gate meanwhile: the level waits for nothing, it is simply not added.
      if (d && d.level < levelCap(d.stage)) d.level++;
      s.training = null;
      break;
    }
    case 'treasure': {
      require(treasureReady(s, now), 'treasure');
      const n = s.daily.treasures;
      grantReward(s, treasureReward(s.daily.day, n), `${s.daily.day}:treasure:${n}`);
      s.daily.treasures++;
      s.daily.treasureAt = now;
      break;
    }
    case 'buyEgg': {
      require(s.buildings.some((b) => b.kind === 'market'), 'building');
      require(c.species !== 'boss', 'fightEgg');
      require(isPlayableDinosaur(c.species, c.element), 'egg');
      require(s.habitats[c.element], 'habitat');
      require(MARKET_ELEMENTS.includes(c.element), 'fightEgg');
      require(s.eggs.length < BALANCE.maxEggs, 'eggsFull');
      pay(eggPrice(c.element), {});
      s.eggs.push({
        id: `egg-${s.revision + 1}`,
        species: c.species,
        element: c.element,
        seconds: EGG_SECONDS.market,
        hatchAt: null,
      });
      break;
    }
    case 'sellEgg': {
      const egg = s.eggs.find((e) => e.id === c.eggId);
      // The tutorial egg is the first dinosaur, so it cannot be sold.
      require(egg && egg.hatchAt === null && egg.id !== 'egg-ignis' && egg.species !== 'boss', 'egg');
      s.eggs = s.eggs.filter((e) => e !== egg);
      s.gold += eggSellPrice(egg!);
      break;
    }
    case 'claimQuestEgg': {
      // Story goals are claimed one at a time, in order, once done.
      const current = storyChapter(s)?.step;
      const quest = current?.id === c.questId && current.done(s) ? current : undefined;
      require(quest, 'locked');
      if (!quest) break;
      // With a full shelf the egg waits with the won ones; the story never stalls on it.
      if (quest.species && quest.element) {
        if (s.eggs.length < BALANCE.maxEggs)
          s.eggs.push({
            id: `egg-${quest.id}`,
            species: quest.species,
            element: quest.element,
            seconds: EGG_SECONDS.story,
            hatchAt: null,
          });
        else receiveEgg(s, { species: quest.species, element: quest.element, story: true });
      }
      s.gold += quest.gold;
      s.food += quest.food;
      // A chapter's finale also pays diamonds, once (the goal is claimed once).
      if (storyEgg(quest)) earnGems(s, GEM_SOURCES.chapter);
      s.questEggs.push(quest.id);
      break;
    }
    case 'unlockHabitat': {
      require(ELEMENTS.some((e) => e.id === c.realm) && !s.habitats[c.realm], 'habitat');
      const lock = worldLock(s, c.realm);
      require(!lock, lock?.reason === 'region' ? 'worldRegion' : 'worldOrder');
      pay(WORLD_UNLOCK[c.realm].gold, WORLD_UNLOCK[c.realm].materials);
      s.habitats[c.realm] = 1;
      break;
    }
    case 'upgradeHabitat':
      require(s.habitats[c.realm], 'habitat');
      startUpgrade(`habitat:${c.realm}`);
      break;
    case 'upgradePortal':
      require(s.portalLevel > 0, 'building');
      startUpgrade('portal');
      break;
    case 'upgradeWorkshop':
      require(s.buildings.some((b) => b.kind === 'workshop'), 'workshop');
      startUpgrade('workshop');
      break;
    case 'upgradeArena':
      require(s.buildings.some((b) => b.kind === 'arena'), 'building');
      startUpgrade('arena');
      break;
    case 'upgradeHatchery':
      startUpgrade('hatchery');
      break;
    case 'build': {
      const kind = c.kind ?? 'farm',
        spec = UTILITY_BUILDINGS[kind];
      require(spec && kind !== 'hatchery', 'building');
      require(s.gold >= spec.cost, 'gold');
      require(canBuild(s, c.x, c.y), 'placement');
      require(!s.buildings.some((b) => b.kind === kind), 'building');
      s.gold -= spec.cost;
      s.buildings.push({ id: kind, kind, x: c.x, y: c.y });
      if (kind === 'portal') s.portalLevel = 1;
      break;
    }
    case 'move': {
      const b = s.buildings.find((b) => b.id === c.id);
      require(b && canBuild(s, c.x, c.y, c.id), 'placement');
      if (b) {
        b.x = c.x;
        b.y = c.y;
      }
      break;
    }
    case 'plant': {
      require(s.buildings.some((b) => b.kind === 'farm'), 'farm');
      const crop = CROPS.find((x) => x.id === (c.crop ?? 'ferns'));
      require(crop, 'crop');
      if (!crop) break;
      require(crop.level <= s.farmLevel, 'locked');
      const i = c.plot ?? s.plots.findIndex((p) => !p);
      require(i >= 0 && i < s.plots.length && !s.plots[i], 'plots');
      require(s.gold >= crop.cost, 'gold');
      s.gold -= crop.cost;
      s.plots[i] = { crop: crop.id, readyAt: now + crop.seconds * 1000 };
      break;
    }
    case 'harvest': {
      const indexes = c.plot === undefined ? s.plots.map((_, i) => i) : [c.plot];
      require(harvestPlots(s, now, indexes) > 0, 'timer');
      break;
    }
    case 'upgradeFarm':
      require(s.buildings.some((b) => b.kind === 'farm'), 'farm');
      startUpgrade('farm');
      break;
    case 'collect': {
      const gold = Math.floor(s.storedGold);
      require(gold > 0, 'empty');
      s.gold += gold;
      s.storedGold -= gold;
      break;
    }
    case 'craft': {
      require(s.buildings.some((b) => b.kind === 'workshop'), 'workshop');
      const recipe = RECIPES.find((r) => r.id === c.recipeId);
      require(recipe, 'recipe');
      if (!recipe) break;
      const level = workshop(s);
      require(s.crafting.filter((j) => j.endsAt > now).length < level.slots && s.crafting.length < 20, 'queue');
      const costs = Object.entries(recipe.cost) as [ItemId, number][];
      require(costs.every(([id, count]) => s.inventory[id] >= count), 'materials');
      require(s.food >= recipeFoodCost(recipe), 'food');
      s.food -= recipeFoodCost(recipe);
      costs.forEach(([id, count]) => (s.inventory[id] -= count));
      // The new job joins whichever lane frees up first.
      const lane = Array.from({ length: level.lanes }, (_, l) => l).reduce((a, b) =>
        laneFree(s, b, now) < laneFree(s, a, now) ? b : a,
      );
      const startedAt = laneFree(s, lane, now);
      s.crafting.push({
        id: `craft-${s.revision + 1}`,
        recipeId: recipe.id,
        startedAt,
        endsAt: startedAt + Math.round(recipe.seconds * 1000 * level.speed),
        lane,
      });
      break;
    }
    case 'claimCraft': {
      const job = s.crafting.find((j) => j.id === c.jobId);
      require(job && now >= job.endsAt, 'timer');
      if (!job) break;
      const recipe = RECIPES.find((r) => r.id === job.recipeId)!;
      s.inventory[recipe.output] += recipe.quantity;
      s.crafting = s.crafting.filter((j) => j.id !== job.id);
      break;
    }
    case 'addGems':
      require(Number.isInteger(c.amount) && c.amount > 0 && c.amount <= GEMS.maxGrant, 'gems');
      s.gems += c.amount;
      break;
    case 'gemFinish': {
      const spend = (ms: number) => {
        const cost = gemsToFinish(ms);
        require(cost > 0, 'timer');
        require(s.gems >= cost, 'gems');
        s.gems -= cost;
      };
      if (c.target === 'construction') {
        const build = s.construction;
        require(build, 'construction');
        spend(build!.endsAt - now);
        completeConstruction(s);
      } else if (c.target === 'egg') {
        const egg = s.eggs.find((e) => e.id === c.id && e.hatchAt !== null);
        require(egg, 'egg');
        spend(egg!.hatchAt! - now);
        egg!.hatchAt = now;
      } else if (c.target === 'plot') {
        const plot = s.plots[c.plot ?? -1];
        require(plot && plot.readyAt > now, 'timer');
        spend(plot!.readyAt - now);
        plot!.readyAt = now;
      } else if (c.target === 'expedition') {
        const trip = c.id ? s.expeditions.find((x) => x.id === c.id) : currentTrip(s);
        require(trip, 'expedition');
        spend(trip!.endsAt - now);
        trip!.endsAt = now;
        trip!.rushed = true;
      } else {
        // Only a running job; the ones queued behind it in the same lane move up by the time saved.
        const job = s.crafting.find((j) => j.id === c.id && j.startedAt <= now);
        require(job, 'running');
        spend(job!.endsAt - now);
        const saved = job!.endsAt - now;
        job!.endsAt = now;
        job!.rushed = true;
        s.crafting
          .filter((j) => j !== job && (j.lane ?? 0) === (job!.lane ?? 0) && j.startedAt >= now)
          .forEach((j) => {
            j.startedAt -= saved;
            j.endsAt -= saved;
          });
      }
      break;
    }
    case 'gemBoost': {
      const cost = GEMS.boost[c.hours];
      require(cost, 'gems');
      require(s.gems >= cost, 'gems');
      s.gems -= cost;
      // A second boost extends the running one.
      s.boostUntil = Math.max(s.boostUntil, now) + c.hours * 3_600_000;
      break;
    }
    case 'legendTrial': {
      require(!storyChapter(s), 'legendLocked');
      require(s.legend.trials < LEGEND_TRIAL.perWeek, 'legendWeek');
      require(s.food >= LEGEND_TRIAL.food, 'food');
      pay(LEGEND_TRIAL.gold, {});
      s.food -= LEGEND_TRIAL.food;
      s.legend.trials++;
      earnGems(s, LEGEND_TRIAL.gems);
      const seed = `${s.revision}:${now}:legend`,
        worlds = ELEMENTS.map((e) => e.id).filter((e) => s.habitats[e] && playableSpecies(e).length),
        egg = drawEgg(s, worlds[Math.floor(roll(seed) * worlds.length)], seed, LEGEND_TRIAL.rarity);
      if (egg) receiveEgg(s, egg);
      break;
    }
    case 'towerFight': {
      const team = teamDinos(s);
      require(s.buildings.some((b) => b.kind === 'arena'), 'building');
      require(team.length &&
        team.length === s.team.length &&
        team.every((d) => d.stage !== 'baby') &&
        !s.battle &&
        !s.rewardPending, 'juvenile');
      require(team.every((d) => !busyDinos(s).has(d.id)), 'away');
      require(team.every((d) => !isTired(s, d.id, now)), 'tired');
      require(s.tower.floor < TOWER_FLOORS, 'towerDone');
      const b: Battle = {
        encounterId: towerId(s.tower.week, s.tower.floor + 1),
        team: team.map((d) => {
          const hp = dinoStats(d).hp;
          return { dinoId: d.id, hp, maxHp: hp, species: d.species };
        }),
        active: 0,
        foes: nextTowerFoes(s),
        foeIndex: 0,
        reward: { gold: 0, food: 0, materials: {} },
        dinoId: '',
        hp: 0,
        maxHp: 0,
        energy: 0,
        enemy: 0,
        enemyMax: 0,
        enemyEnergy: 0,
        round: 1,
        result: null,
        log: 'start',
      };
      onStage(b);
      s.battle = b;
      break;
    }
    case 'claimTower': {
      const reward = TOWER_REWARDS[c.floor];
      require(reward, 'towerReward');
      require(s.tower.floor >= c.floor, 'towerFloor');
      require(!s.tower.claimed.includes(c.floor), 'towerClaimed');
      const seed = `${towerId(s.tower.week, c.floor)}:reward`;
      grantReward(s, reward, seed);
      if (reward.egg) {
        const worlds = ELEMENTS.map((e) => e.id).filter((e) => s.habitats[e] && playableSpecies(e).length),
          egg = worlds.length && drawEgg(s, worlds[Math.floor(roll(seed) * worlds.length)], seed, reward.egg);
        if (egg) receiveEgg(s, egg);
      }
      s.tower.claimed.push(c.floor);
      break;
    }
    case 'gemRest': {
      // One dinosaur, or the whole arena team for at most GEMS.restTeam.
      const ids = c.team
        ? s.team.filter((id) => isTired(s, id, now))
        : [c.dinoId ?? s.champion ?? ''].filter((id) => isTired(s, id, now));
      require(ids.length, 'rested');
      const cost = c.team ? Math.min(GEMS.restTeam, GEMS.rest * ids.length) : GEMS.rest;
      require(s.gems >= cost, 'gems');
      s.gems -= cost;
      for (const id of ids) delete s.tired[id];
      break;
    }
    case 'cancelCraft': {
      const index = s.crafting.findIndex((j) => j.id === c.jobId),
        job = s.crafting[index];
      require(job && now < job.startedAt, 'running');
      if (!job) break;
      const recipe = RECIPES.find((r) => r.id === job.recipeId)!;
      (Object.entries(recipe.cost) as [ItemId, number][]).forEach(([id, count]) => (s.inventory[id] += count));
      s.food += recipeFoodCost(recipe);
      const duration = job.endsAt - job.startedAt;
      s.crafting.splice(index, 1);
      s.crafting
        .slice(index)
        .filter((j) => (j.lane ?? 0) === (job.lane ?? 0))
        .forEach((j) => {
          j.startedAt -= duration;
          j.endsAt -= duration;
        });
      break;
    }
    case 'collectAvailable': {
      const gold = Math.floor(s.storedGold);
      s.gold += gold;
      s.storedGold -= gold;
      harvestPlots(
        s,
        now,
        s.plots.map((_, i) => i),
      );
      for (const job of s.crafting.filter((j) => j.endsAt <= now)) {
        const recipe = RECIPES.find((r) => r.id === job.recipeId)!;
        s.inventory[recipe.output] += recipe.quantity;
      }
      s.crafting = s.crafting.filter((j) => j.endsAt > now);
      break;
    }
    case 'placeLamp': {
      require(s.lamps < MAX_LAMPS, 'maxLevel');
      require(s.inventory.lamp > 0, 'materials');
      const spot =
        c.x === undefined || c.y === undefined ? BUILDABLE_CELLS.find((p) => canLamp(s, p.x, p.y)) : { x: c.x, y: c.y };
      require(spot && canLamp(s, spot.x, spot.y), 'placement');
      if (!spot) break;
      s.inventory.lamp--;
      s.lamps++;
      s.lampSpots.push({ x: spot.x, y: spot.y });
      break;
    }
    case 'moveLamp': {
      const lamp = s.lampSpots[c.index];
      require(lamp && canLamp(s, c.x, c.y, c.index), 'placement');
      if (lamp) {
        lamp.x = c.x;
        lamp.y = c.y;
      }
      break;
    }
    // Test tools behind the "i" button.
    case 'devSkip': {
      for (const e of s.eggs) if (e.hatchAt !== null) e.hatchAt = Math.min(e.hatchAt, now);
      for (const p of s.plots) if (p) p.readyAt = Math.min(p.readyAt, now);
      completeConstruction(s);
      // Finished jobs keep their length and order in their lane, so the queue stays valid.
      for (const lane of new Set(s.crafting.map((j) => j.lane ?? 0))) {
        const jobs = s.crafting.filter((j) => (j.lane ?? 0) === lane);
        let t = now - jobs.reduce((n, j) => n + (j.endsAt - j.startedAt), 0);
        for (const j of jobs) {
          const length = j.endsAt - j.startedAt;
          j.startedAt = t;
          j.endsAt = t += length;
        }
      }
      s.storedGold = Math.max(s.storedGold, goldCap(s, now));
      break;
    }
    case 'devRarityEggs':
      // Test tool: a rare and an epic fire T-Rex egg, delivered like won eggs, to preview the rarity look.
      for (const rarity of ['rare', 'epic'] as const) receiveEgg(s, { species: 'trex', element: 'fire', rarity });
      break;
    case 'devResources':
      for (const e of ELEMENTS) s.arenaTickets[e.id] = Math.min(ARENA_TICKET_LIMIT, (s.arenaTickets[e.id] ?? 0) + 999);
      s.gold += 5000;
      s.food += 5000;
      for (const id of ['wood', 'stone', 'fiber', 'crystal'] as const) s.inventory[id] += 150;
      s.inventory.habitatKit += 3;
      s.inventory.evolutionCrystal += 3;
      break;
    case 'buyArenaTicket': {
      require(ELEMENTS.some((e) => e.id === c.realm), 'ticket');
      require(Number.isInteger(c.quantity) && c.quantity >= 1 && c.quantity <= 99, 'ticket');
      require(s.habitats[c.realm], 'locked');
      require(!GATE_LEAGUES.includes(c.realm) || s.arenaLevel >= 2, 'gate');
      const owned = s.arenaTickets[c.realm] ?? 0;
      require(owned + c.quantity <= ARENA_TICKET_LIMIT, 'ticketLimit');
      pay(arenaTicketPrice(c.realm) * c.quantity, {});
      s.arenaTickets[c.realm] = owned + c.quantity;
      break;
    }
    case 'battle': {
      // The arena team fights as a relay: every member must be juvenile or older, at home, rested and at the
      // tier's level.
      const team = teamDinos(s);
      require(team.length &&
        team.length === s.team.length &&
        team.every((d) => d.stage !== 'baby') &&
        !s.battle &&
        !s.rewardPending, 'juvenile');
      require(team.every((d) => !busyDinos(s).has(d.id)), 'away');
      const encounter = ENCOUNTERS.find((e) => e.id === c.encounterId);
      require(encounter, 'encounter');
      if (!encounter) break;
      // Expeditions are timed trips (see `expedition`); only arena fights are battles.
      require(encounter.mode === 'arena', 'timedExpedition');
      require(!encounter.requires || (s.stars[encounter.requires] ?? 0) >= STARS_TO_ADVANCE, 'stars');
      require(!encounter.league || !!s.habitats[encounter.league as RealmId], 'locked');
      require(team.every((d) => !isTired(s, d.id, now)), 'tired');
      require(!GATE_LEAGUES.includes(encounter.league ?? '') || s.arenaLevel >= 2, 'gate');
      require(team.every((d) => d.level >= encounter.level), 'level');
      require(s.buildings.some((b) => b.kind === 'arena'), 'building');
      const realm = encounter.league as RealmId;
      require((s.arenaTickets[realm] ?? 0) > 0, 'arenaTicket');
      s.arenaTickets[realm] = s.arenaTickets[realm]! - 1;
      const reward = rewardPreview(s, encounter.id, team.length)!;
      const b: Battle = {
        encounterId: encounter.id,
        team: team.map((d) => {
          const hp = dinoStats(d).hp;
          return { dinoId: d.id, hp, maxHp: hp, species: d.species };
        }),
        active: 0,
        foes: arenaFoes(encounter.id),
        foeIndex: 0,
        reward: { gold: reward.gold, food: reward.food, materials: reward.materials },
        dinoId: '',
        hp: 0,
        maxHp: 0,
        energy: 0,
        enemy: 0,
        enemyMax: 0,
        enemyEnergy: 0,
        round: 1,
        result: null,
        log: 'start',
      };
      onStage(b);
      s.battle = b;
      break;
    }
    case 'expedition': {
      const plan = regionById(c.regionId) && Array.isArray(c.team) ? expeditionPlan(s, c.regionId, c.team) : null;
      require(plan, 'encounter');
      if (!plan) break;
      require(!plan.blocker, plan.blocker ? blockerCode(plan.blocker, plan.failing) : '');
      s.inventory.provisions -= plan.supplies;
      // A region's last stage always brings one of its eggs, decided as the team leaves.
      const egg =
        plan.stage === REGION_STAGES - 1
          ? drawEgg(
              s,
              plan.region.element,
              `${s.revision}:${now}:${c.regionId}:finale`,
              rarityOdds({ id: c.regionId, mode: 'expedition' }),
            )
          : undefined;
      s.expeditions.push({
        id: `trip-${s.revision + 1}`,
        kind: 'stage',
        regionId: c.regionId,
        stage: plan.stage,
        team: [...c.team],
        startedAt: now,
        endsAt: now + plan.duration,
        reward: { ...plan.reward, ...(egg ? { egg } : {}) },
      });
      break;
    }
    case 'patrol': {
      const plan = regionById(c.regionId) && Array.isArray(c.team) ? patrolPlan(s, c.regionId, c.hours, c.team) : null;
      require(plan, 'encounter');
      if (!plan) break;
      require(!plan.blocker, plan.blocker ? blockerCode(plan.blocker, plan.failing) : '');
      s.inventory.provisions -= plan.supplies;
      // The egg is decided when the team leaves, so waiting never changes what it brings back.
      const seed = `${s.revision}:${now}:${c.regionId}:patrol`;
      const egg =
        roll(seed) < plan.eggChance
          ? drawEgg(s, plan.region.element, seed, rarityOdds({ id: c.regionId, mode: 'expedition' }))
          : undefined;
      s.expeditions.push({
        id: `trip-${s.revision + 1}`,
        kind: 'patrol',
        regionId: c.regionId,
        hours: c.hours,
        team: [...c.team],
        startedAt: now,
        endsAt: now + plan.duration,
        reward: { ...plan.reward, ...(egg ? { egg } : {}) },
      });
      break;
    }
    case 'claimExpedition': {
      const x = c.runId ? s.expeditions.find((r) => r.id === c.runId) : currentTrip(s);
      require(x && now >= x.endsAt, 'expedition');
      if (!x) break;
      const reward = x.reward,
        element = regionById(x.regionId)!.element;
      // The first patrols claimed each day pay half again.
      const extra = x.kind === 'patrol' && s.daily.patrols < PATROL.daily ? patrolDailyExtra(reward) : null;
      s.gold += reward.gold + (extra?.gold ?? 0);
      s.food += reward.food + (extra?.food ?? 0);
      for (const [id, count] of Object.entries(reward.materials) as [ItemId, number][])
        s.inventory[id] += count + (extra?.materials[id] ?? 0);
      if (reward.tickets)
        s.arenaTickets[element] = Math.min(ARENA_TICKET_LIMIT, (s.arenaTickets[element] ?? 0) + reward.tickets);
      if (reward.gems) earnGems(s, reward.gems);
      if (x.kind === 'patrol') s.daily.patrols++;
      else s.expeditionProgress[x.regionId] = Math.max(s.expeditionProgress[x.regionId] ?? 0, (x.stage ?? 0) + 1);
      if (reward.egg) receiveEgg(s, reward.egg);
      s.expeditions = s.expeditions.filter((r) => r !== x);
      break;
    }
    case 'action': {
      const b = s.battle,
        ally = b && b.team[b.active],
        d = ally && s.dinos.find((x) => x.id === ally.dinoId);
      require(b && ally && d && !b.result, 'battle');
      if (!b || !ally || !d) break;
      require(['basic', 'defend', 'ultimate'].includes(c.action), 'action');
      require(!c.tapped || c.action === 'ultimate', 'action');
      // A full bar unlocks the ultimate; it may also land as the finishing blow, which kills either way.
      require(c.action !== 'ultimate' ||
        (d.stage === 'adult' && (b.energy >= 100 || strikeAgainst(b, d, 'basic') >= b.enemy)), 'energy');
      const foe = activeFoe(b),
        move = foeMove(b),
        abilities: Ability[] = [];
      const strikes = c.action !== 'defend';
      // A fast opponent may slip an unguarded strike; on a swift tower floor every opponent may.
      const tower = parseTowerId(b.encounterId),
        rule = tower ? towerRule(tower.week, tower.floor) : null,
        slipChance =
          (SPECIES_ROLE[foe.species] === 'fast' ? ROLE_EFFECTS.swiftFoe : 0) + (rule === 'swift' ? TOWER_SWIFT : 0);
      const foeSlips =
        strikes &&
        move !== 'defend' &&
        slipChance > 0 &&
        roll(`${b.encounterId}:${b.round}:${b.foeIndex}:swift`) < slipChance;
      const dealt = foeSlips ? 0 : Math.floor(strikeAgainst(b, d, c.action) * (c.tapped ? TAP_BONUS : 1));
      if (foeSlips) abilities.push({ on: 'enemy', kind: 'swift' });
      else if (strikes) {
        abilities.push(...strikeAbilities(b, d));
        if (SPECIES_ROLE[foe.species] === 'tank') foe.shieldUsed = true;
      }
      foe.hp = Math.max(0, foe.hp - dealt);
      const enemyAfterStrike = foe.hp;
      b.energy = c.action === 'ultimate' ? 0 : Math.min(100, b.energy + ENERGY[c.action]);
      // The opponent answers: it guards, strikes, or unleashes its ultimate. A guard turns part of the blow
      // back; an unguarded blow may be dodged.
      let taken = 0,
        dodged = false,
        reflected = 0;
      const acts = foe.hp > 0;
      if (acts && move !== 'defend') {
        const guarding = c.action === 'defend',
          power = move === 'ultimate' ? ULTIMATE_POWER : 1,
          fired = blowAbilities(b, d);
        if (guarding) {
          taken = Math.floor(incomingDamage(b, d, true) * power);
          reflected = Math.floor(incomingDamage(b, d, false) * power * REFLECT);
          foe.hp = Math.max(0, foe.hp - reflected);
        } else if (roll(`${b.encounterId}:${b.round}:${d.id}:dodge`) < dodgeChance(d)) dodged = true;
        else taken = Math.floor(incomingDamage(b, d, false) * power);
        if (dodged) {
          if (SPECIES_ROLE[d.species] === 'fast') abilities.push({ on: 'ally', kind: 'swift' });
        } else {
          abilities.push(...fired);
          if (SPECIES_ROLE[d.species] === 'tank') ally.shieldUsed = true;
        }
        ally.hp = Math.max(0, ally.hp - taken);
      }
      if (acts) b.enemyEnergy = move === 'ultimate' ? 0 : Math.min(100, b.enemyEnergy + ENERGY.foe);
      if (taken > 0 && ally.hp > 0) b.energy = Math.min(100, b.energy + ENERGY.hit);
      // A support on stage heals once, as soon as a full heal's worth of health is missing.
      for (const [x, on, species] of [
        [ally, 'ally', d.species],
        [foe, 'enemy', foe.species],
      ] as const) {
        const amount = Math.round(x.maxHp * ROLE_EFFECTS.heal);
        if (rule === 'noHeal') continue;
        if (SPECIES_ROLE[species] !== 'support' || x.healed || amount < 1 || x.hp === 0 || x.hp > x.maxHp - amount)
          continue;
        x.hp += amount;
        x.healed = true;
        abilities.push({ on, kind: 'heal', amount });
      }
      b.report = {
        ally: c.action,
        foe: acts ? move : 'none',
        dealt,
        enemyAfterStrike,
        taken,
        dodged,
        reflected,
        hpAfter: ally.hp,
        enemyAfter: foe.hp,
        ...(abilities.length ? { abilities } : {}),
        ...(c.tapped ? { tapped: true as const } : {}),
      };
      if (dealt > (b.bestHit?.amount ?? 0)) b.bestHit = { amount: dealt, dinoId: d.id };
      if (dealt + reflected > 0) b.damage = { ...b.damage, [d.id]: (b.damage?.[d.id] ?? 0) + dealt + reflected };
      b.log = c.action;
      b.round++;
      // The relay: a fallen fighter is replaced by the next of its side, who steps in with an empty bar.
      const foesDown = b.foes.every((f) => f.hp === 0),
        teamDown = b.team.every((a) => a.hp === 0);
      // Nobody steps in once the fight is decided.
      const allyIn = !foesDown && ally.hp === 0 && b.active < b.team.length - 1,
        foeIn = !teamDown && foe.hp === 0 && b.foeIndex < b.foes.length - 1;
      if (allyIn) {
        b.active++;
        b.energy = 0;
      }
      if (foeIn) {
        b.foeIndex++;
        b.enemyEnergy = 0;
      }
      if (allyIn || foeIn) b.report.swap = allyIn && foeIn ? 'both' : allyIn ? 'ally' : 'enemy';
      onStage(b);
      b.result = foesDown ? 'victory' : teamDown ? 'defeat' : b.round > roundCap(b.foes.length) ? 'draw' : null;
      if (!b.result || isFriendly(b.encounterId)) break;
      if (isTower(b.encounterId)) {
        // A fight won after the week turned counts for nothing: the tower was reset.
        if (b.result === 'victory' && tower && tower.week === s.tower.week)
          s.tower.floor = Math.max(s.tower.floor, tower.floor);
        break;
      }
      const encounter = ENCOUNTERS.find((e) => e.id === b.encounterId)!,
        tier = arenaTier(encounter.id);
      // Every member rests: by tier after a win (longer if it fell), twenty minutes after a defeat or a draw.
      for (const a of b.team)
        s.tired[a.dinoId] =
          now +
          60_000 *
            (b.result !== 'victory' ? ARENA_REST.defeat : a.hp === 0 ? ARENA_REST.fallen : ARENA_REST.win[tier - 1]);
      // A draw gives the ticket back.
      if (b.result === 'draw') {
        const realm = encounter.league as RealmId;
        s.arenaTickets[realm] = Math.min(ARENA_TICKET_LIMIT, (s.arenaTickets[realm] ?? 0) + 1);
      }
      if (b.result === 'victory') {
        s.rewardPending = true;
        const left = b.team.reduce((n, a) => n + a.hp, 0),
          max = b.team.reduce((n, a) => n + a.maxHp, 0);
        b.stars = starsFor(
          left,
          max,
          b.team.some((a) => a.hp === 0),
        );
        // Milestones the new best reaches are paid with this fight's reward.
        const total = starTotal(s) - (s.stars[encounter.id] ?? 0) + Math.max(s.stars[encounter.id] ?? 0, b.stars);
        const reached = STAR_MILESTONES.slice(s.starMilestones).filter((m) => m.stars <= total);
        if (reached.length) {
          b.reward.milestones = reached.length;
          for (const m of reached) {
            b.reward.gold += m.gold;
            b.reward.food += m.food;
            for (const [id, n] of Object.entries(m.materials) as [ItemId, number][])
              b.reward.materials[id] = (b.reward.materials[id] ?? 0) + n;
          }
        }
        if (arenaBoss(encounter) && !s.bossEggsClaimed.includes(encounter.league as RealmId)) {
          b.reward.egg = { species: 'boss', element: encounter.league as RealmId, rarity: 'legendary' };
        } else {
          const egg = rollEgg(s, encounter, now);
          if (egg) b.reward.egg = egg;
        }
      }
      break;
    }
    case 'claim':
      require(s.battle?.result, 'battle');
      if (s.rewardPending) {
        s.gold += s.battle!.reward.gold;
        s.food += s.battle!.reward.food;
        (Object.entries(s.battle!.reward.materials) as [ItemId, number][]).forEach(
          ([id, count]) => (s.inventory[id] += count),
        );
        if (!s.cleared.includes(s.battle!.encounterId)) s.cleared.push(s.battle!.encounterId);
        if (s.battle!.reward.egg) receiveEgg(s, s.battle!.reward.egg);
        s.victories++;
        s.rewardPending = false;
        s.arena.weekWins++;
        const id = s.battle!.encounterId;
        if (s.battle!.stars) s.stars[id] = Math.max(s.stars[id] ?? 0, s.battle!.stars);
        // Star milestones reached by this win add their diamonds.
        const reached = STAR_MILESTONES.slice(s.starMilestones, s.starMilestones + (s.battle!.reward.milestones ?? 0));
        if (reached.length)
          earnGems(
            s,
            reached.reduce((n, m) => n + m.gems, 0),
          );
        s.starMilestones += reached.length;
        // The weekly season pays each step it reaches, once.
        for (const step of ARENA_SEASON.slice(s.arena.weekClaimed, seasonStep(s.arena.weekWins))) {
          s.gold += step.gold;
          if (step.gems) earnGems(s, step.gems);
          for (const [item, n] of Object.entries(step.materials) as [ItemId, number][]) s.inventory[item] += n;
          if (step.tickets) grantTickets(s, step.tickets, `${s.arena.week}:season:${step.wins}`);
          s.arena.weekClaimed++;
        }
      }
      s.battle = null;
      break;
    default:
      // A command this version does not know (an old client's, or a removed one like the diamond trade).
      throw new Error('command');
  }
  // Won eggs wait here while the shelf is full and move onto it as soon as there is room.
  while (s.owedEggs.length && s.eggs.length < BALANCE.maxEggs) {
    const owed = s.owedEggs.shift()!,
      { story: _, ...egg } = owed;
    s.eggs.push({ ...egg, id: `egg-${s.revision + 1}-${s.eggs.length}`, seconds: eggSeconds(owed), hatchAt: null });
  }
  if (c.type === 'feed')
    addDailyProgress(
      s,
      'feed',
      s.dinos.reduce((n, d) => n + d.level - (save.dinos.find((x) => x.id === d.id)?.level ?? d.level), 0),
    );
  if (c.type === 'evolve') addDailyProgress(s, 'feed');
  const harvested = save.plots.filter((p, i) => p && !s.plots[i]).length;
  if (harvested) addDailyProgress(s, 'harvest', harvested);
  const crafted = save.crafting.filter((j) => !s.crafting.some((next) => next.id === j.id) && j.endsAt <= now).length;
  if (crafted && (c.type === 'claimCraft' || c.type === 'collectAvailable')) addDailyProgress(s, 'craft', crafted);
  const towerFought = c.type === 'claim' && !!save.battle && isTower(save.battle.encounterId);
  if (c.type === 'claim' && save.battle?.result && !towerFought) addDailyProgress(s, 'battle');
  if (c.type === 'claimExpedition') {
    addDailyProgress(s, 'expedition');
    if (save.expeditions.find((x) => x.id === (c.runId ?? save.expeditions[0]?.id))?.kind === 'patrol')
      addDailyProgress(s, 'patrol');
  }
  if (c.type === 'claim' && save.battle?.result === 'victory' && !towerFought) addDailyProgress(s, 'win');
  if (c.type === 'plant') addDailyProgress(s, 'plant');
  if (c.type === 'craft') addDailyProgress(s, 'startCraft');
  if ((c.type === 'collect' || c.type === 'collectAvailable') && s.gold > save.gold) addDailyProgress(s, 'collect');
  // Collection milestones are paid once each, as soon as the collection reaches them.
  while (
    s.collectionMilestones < COLLECTION_MILESTONES.length &&
    s.discovered.length >= COLLECTION_MILESTONES[s.collectionMilestones].count
  ) {
    const m = COLLECTION_MILESTONES[s.collectionMilestones++];
    s.gold += m.gold;
    earnGems(s, m.gems);
  }
  s.revision++;
  return s;
}
/**
 * A save from before the current schema (v6, the reset of the economy). It is never migrated: the player starts
 * a new game (see cloud.ts and SignInGate).
 */
export class OutdatedSave extends Error {
  constructor(public schemaVersion: unknown) {
    super('Outdated save');
    this.name = 'OutdatedSave';
  }
}
export function parseSave(text: string): Save {
  const s = JSON.parse(text) as Save;
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw Error('Invalid save');
  if (s.schemaVersion !== 6) throw new OutdatedSave((s as { schemaVersion?: unknown }).schemaVersion);
  // Accept saves made while the discarded story-scene experiment was being tried.
  if (Array.isArray(s.questEggs)) {
    const experimental = s.questEggs.some((id) => id === 'c1-plant' || id === 'c1-harvest');
    s.questEggs = s.questEggs.filter((id) => id !== 'c1-plant' && id !== 'c1-harvest');
    if (experimental && s.questEggs.includes('c1-grow') && !s.questEggs.includes('w-earth-market'))
      s.questEggs.push('w-earth-market');
  }
  delete (s as Save & { narrative?: unknown }).narrative;
  if (Array.isArray(s.plots))
    for (const p of s.plots)
      if (p && typeof p.crop === 'string' && p.crop in RETIRED_CROPS) p.crop = RETIRED_CROPS[p.crop];
  // Fields added after the v6 reset that a save lacks take a new game's values (diamonds start from none); a
  // field that is present is still validated below.
  const fresh = newSave(Number.isFinite(s.updatedAt) && s.updatedAt >= 0 && s.updatedAt <= 1e14 ? s.updatedAt : 0),
    fields = s as unknown as Record<string, unknown>;
  const defaults: Partial<Save> = {
    gems: 0,
    boostUntil: 0,
    storedGold: 0,
    team: typeof s.champion === 'string' ? [s.champion] : [],
    defense: [],
    hatcheryLevel: 1,
    workshopLevel: 1,
    arenaLevel: 1,
    portalLevel: Array.isArray(s.buildings) && s.buildings.some((b) => b?.kind === 'portal') ? 1 : 0,
    arenaTickets: {},
    arena: fresh.arena,
    questEggs: [],
    eggLuck: 0,
    owedEggs: [],
    bossEggsClaimed: [],
    stars: {},
    starMilestones: 0,
    tired: {},
    battle: null,
    victories: 0,
    rewardPending: false,
    inventory: Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 0])) as Inventory,
    crafting: [],
    expeditions: [],
    expeditionProgress: {},
    daily: fresh.daily,
    cleared: [],
    construction: null,
    discovered: [],
    collectionMilestones: 0,
    lamps: 0,
    lampSpots: [],
    legend: fresh.legend,
    tower: fresh.tower,
    training: null,
  };
  for (const [key, value] of Object.entries(defaults)) if (fields[key] === undefined) fields[key] = value;
  if (s.inventory && typeof s.inventory === 'object')
    for (const id of Object.keys(ITEMS) as ItemId[]) s.inventory[id] ??= 0;
  // Later additions start empty here (`??=`), so they never need another reset.
  s.daily = normalizeDaily(s.daily);
  // Planks and blocks left the workshop: they fold back into the wood and stone they were cut from (10 for 2), and
  // their jobs, finished or not, give back what they cost.
  const RETIRED = { planks: 'wood', blocks: 'stone' } as const;
  const inventory = s.inventory as unknown as Record<string, number> | undefined;
  if (inventory && typeof inventory === 'object') {
    for (const [old, raw] of Object.entries(RETIRED))
      if (Number.isInteger(inventory[old]) && inventory[old] >= 0) {
        inventory[raw] += 5 * inventory[old];
        delete inventory[old];
      }
    if (Array.isArray(s.crafting))
      s.crafting = s.crafting.filter((j) => {
        const raw = RETIRED[j?.recipeId as keyof typeof RETIRED];
        if (raw) inventory[raw] += 10;
        return !raw;
      });
  }
  const finite = (n: unknown, max = 1e9): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const integer = (n: unknown, max = 1e9): n is number => finite(n, max) && Number.isInteger(n);
  const element = (id: unknown): id is RealmId => ELEMENTS.some((e) => e.id === id);
  const species = (id: unknown): id is Species => id === 'boss' || SPECIES.includes(id as (typeof SPECIES)[number]);
  if (
    !s ||
    !s.arenaTickets ||
    typeof s.arenaTickets !== 'object' ||
    Array.isArray(s.arenaTickets) ||
    Object.entries(s.arenaTickets).some(([id, n]) => !element(id) || !integer(n, ARENA_TICKET_LIMIT))
  )
    throw Error('Invalid arena tickets');
  if (
    s.contentVersion !== 1 ||
    !integer(s.revision) ||
    !finite(s.updatedAt, 1e14) ||
    !finite(s.gold) ||
    !finite(s.food) ||
    !integer(s.gems) ||
    !finite(s.boostUntil, 1e14) ||
    !integer(s.victories) ||
    typeof s.rewardPending !== 'boolean' ||
    !Array.isArray(s.buildings) ||
    s.buildings.length > Object.keys(UTILITY_BUILDINGS).length ||
    !integer(s.farmLevel, FARM_LEVELS.length) ||
    s.farmLevel < 1 ||
    !Array.isArray(s.plots) ||
    s.plots.length !== FARM_LEVELS[s.farmLevel - 1].plots ||
    s.plots.some((p) => p !== null && (!p || !CROPS.some((c) => c.id === p.crop) || !finite(p.readyAt, 1e14)))
  )
    throw Error('Invalid save');
  const ids = new Set<string>(),
    kinds = new Set<string>();
  for (const b of s.buildings) {
    if (
      !b ||
      !Object.hasOwn(UTILITY_BUILDINGS, b.kind) ||
      typeof b.id !== 'string' ||
      ids.has(b.id) ||
      kinds.has(b.kind) ||
      !canPlace({ ...s, buildings: s.buildings.filter((x) => x !== b) }, b.x, b.y)
    )
      throw Error('Invalid buildings');
    ids.add(b.id);
    kinds.add(b.kind);
  }
  if (!kinds.has('hatchery') || (s.plots.some((p) => p) && !kinds.has('farm'))) throw Error('Missing building');
  // Lamps lit before they had a place go on the first free cells.
  if (Array.isArray(s.lampSpots) && integer(s.lamps, MAX_LAMPS))
    while (s.lampSpots.length < s.lamps) {
      const free = BUILDABLE_CELLS.find((c) => canLamp(s, c.x, c.y));
      if (!free) break;
      s.lampSpots.push(free);
    }
  if (
    !s.habitats ||
    typeof s.habitats !== 'object' ||
    Object.entries(s.habitats).some(
      ([id, level]) => !element(id) || !integer(level, HABITAT_LEVELS.length) || level < 1,
    ) ||
    !finite(s.storedGold, goldCap(s) * BOOST_CAP) ||
    !integer(s.hatcheryLevel, HATCHERY_LEVELS.length) ||
    s.hatcheryLevel < 1 ||
    !integer(s.workshopLevel, WORKSHOP_LEVELS.length) ||
    s.workshopLevel < 1 ||
    !integer(s.arenaLevel, ARENA_LEVELS.length) ||
    s.arenaLevel < 1 ||
    !integer(s.portalLevel, PORTAL_LEVELS.length) ||
    s.portalLevel > 0 !== kinds.has('portal') ||
    !s.arena ||
    typeof s.arena !== 'object' ||
    typeof s.arena.week !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.arena.week) ||
    !integer(s.arena.weekWins, 10_000) ||
    !integer(s.arena.weekClaimed, 10) ||
    !s.legend ||
    typeof s.legend !== 'object' ||
    typeof s.legend.week !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.legend.week) ||
    !integer(s.legend.trials, LEGEND_TRIAL.perWeek) ||
    !s.tower ||
    typeof s.tower !== 'object' ||
    typeof s.tower.week !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.tower.week) ||
    !integer(s.tower.floor, TOWER_FLOORS) ||
    !Array.isArray(s.tower.claimed) ||
    new Set(s.tower.claimed).size !== s.tower.claimed.length ||
    s.tower.claimed.some((n) => !Object.hasOwn(TOWER_REWARDS, String(n)) || n > s.tower.floor) ||
    !Array.isArray(s.questEggs) ||
    new Set(s.questEggs).size !== s.questEggs.length ||
    s.questEggs.some((id) => !QUEST_EGGS.some((q) => q.id === id)) ||
    !integer(s.eggLuck, EGG_DROP.pity) ||
    !Array.isArray(s.owedEggs) ||
    s.owedEggs.length > MAX_OWED_EGGS ||
    !Array.isArray(s.bossEggsClaimed) ||
    !s.stars ||
    typeof s.stars !== 'object' ||
    Object.entries(s.stars).some(
      ([id, n]) => !ENCOUNTERS.some((e) => e.id === id && e.mode === 'arena') || !integer(n, 3) || n < 1,
    ) ||
    !integer(s.starMilestones, STAR_MILESTONES.length) ||
    !s.tired ||
    typeof s.tired !== 'object' ||
    Object.values(s.tired).some((t) => !integer(t, 1e14)) ||
    new Set(s.bossEggsClaimed).size !== s.bossEggsClaimed.length ||
    s.bossEggsClaimed.some((e) => !element(e)) ||
    s.owedEggs.some(
      (e) =>
        !e ||
        !species(e.species) ||
        !element(e.element) ||
        (e.rarity !== undefined && !RARITIES.includes(e.rarity)) ||
        !(e.story === undefined || e.story === true),
    )
  )
    throw Error('Invalid habitats');
  const dinoIds = new Set<string>();
  if (!Array.isArray(s.dinos) || s.dinos.length > BALANCE.maxDinos) throw Error('Invalid dinosaurs');
  for (const d of s.dinos)
    if (
      !d ||
      typeof d.id !== 'string' ||
      dinoIds.has(d.id) ||
      !species(d.species) ||
      !element(d.element) ||
      !integer(d.level, 50) ||
      d.level < 1 ||
      !['baby', 'juvenile', 'adult'].includes(d.stage) ||
      (d.species === 'boss' && d.stage === 'baby') ||
      (d.rarity !== undefined && !RARITIES.includes(d.rarity)) ||
      typeof d.nickname !== 'string' ||
      d.nickname.length > 40 ||
      (d.stage === 'baby' ? d.level > 9 : d.stage === 'juvenile' ? d.level < 10 || d.level > 24 : d.level < 25) ||
      (d.points !== undefined &&
        (!d.points ||
          typeof d.points !== 'object' ||
          !POINT_STATS.every((k) => integer(d.points![k], 999)) ||
          spentPoints(d) > statPoints(d)))
    )
      throw Error('Invalid dinosaur');
    else dinoIds.add(d.id);
  if (
    ELEMENTS.some((e) => residents(s, e.id).length > habitatCapacity(s, e.id)) ||
    !(s.champion === null ? s.dinos.length === 0 : dinoIds.has(s.champion)) ||
    !Array.isArray(s.team) ||
    s.team.length > 3 ||
    new Set(s.team).size !== s.team.length ||
    s.team.some((id) => !dinoIds.has(id)) ||
    !Array.isArray(s.defense) ||
    s.defense.length > 3 ||
    new Set(s.defense).size !== s.defense.length ||
    s.defense.some((id) => !dinoIds.has(id))
  )
    throw Error('Invalid dinosaur');
  const eggIds = new Set<string>();
  if (!Array.isArray(s.eggs) || s.eggs.length > BALANCE.maxEggs) throw Error('Invalid egg');
  for (const e of s.eggs)
    if (
      !e ||
      (e.rarity !== undefined && !RARITIES.includes(e.rarity)) ||
      typeof e.id !== 'string' ||
      eggIds.has(e.id) ||
      !species(e.species) ||
      !element(e.element) ||
      !integer(e.seconds, 86_400) ||
      !(e.hatchAt === null || finite(e.hatchAt, 1e14))
    )
      throw Error('Invalid egg');
    else eggIds.add(e.id);
  if (incubating(s).length > hatcherySlots(s)) throw Error('Invalid egg');
  if (
    !s.inventory ||
    Object.keys(s.inventory).length !== Object.keys(ITEMS).length ||
    !Object.keys(ITEMS).every((id) => integer(s.inventory[id as ItemId])) ||
    !integer(s.lamps, MAX_LAMPS) ||
    !Array.isArray(s.lampSpots) ||
    s.lampSpots.length !== s.lamps ||
    s.lampSpots.some((l) => !l || !Number.isInteger(l.x) || !Number.isInteger(l.y) || !buildable(l.x, l.y)) ||
    !(
      s.training === null ||
      (!!s.training &&
        typeof s.training === 'object' &&
        dinoIds.has(s.training.dinoId) &&
        finite(s.training.endsAt, 1e14))
    ) ||
    !Array.isArray(s.discovered) ||
    new Set(s.discovered).size !== s.discovered.length ||
    s.discovered.some((id) => !COLLECTION.includes(id)) ||
    !integer(s.collectionMilestones, COLLECTION_MILESTONES.length) ||
    !(
      s.notice === undefined ||
      (!!s.notice &&
        typeof s.notice === 'object' &&
        (s.notice.eggSold === undefined || integer(s.notice.eggSold)) &&
        (s.notice.gems === undefined || integer(s.notice.gems, 1000)) &&
        (s.notice.tickets === undefined ||
          (!!s.notice.tickets && element(s.notice.tickets.realm) && integer(s.notice.tickets.count, 100))))
    ) ||
    !Array.isArray(s.cleared) ||
    new Set(s.cleared).size !== s.cleared.length ||
    s.cleared.some((id) => !ENCOUNTERS.some((e) => e.id === id)) ||
    !Array.isArray(s.crafting) ||
    s.crafting.length > 20
  )
    throw Error('Invalid progression');
  const jobs = new Set<string>();
  for (const job of s.crafting) {
    const recipe = RECIPES.find((r) => r.id === job?.recipeId);
    if (
      !job ||
      !recipe ||
      typeof job.id !== 'string' ||
      jobs.has(job.id) ||
      !finite(job.startedAt, 1e14) ||
      !finite(job.endsAt, 1e14) ||
      // A job lasts exactly its recipe's time at some workshop level, unless diamonds finished it early.
      !(job.rushed === undefined || job.rushed === true) ||
      (job.rushed
        ? job.endsAt < job.startedAt || job.endsAt - job.startedAt > craftMs(recipe)
        : !WORKSHOP_LEVELS.some((l) => job.endsAt - job.startedAt === Math.round(recipe.seconds * 1000 * l.speed))) ||
      !(job.lane === undefined || integer(job.lane, Math.max(...WORKSHOP_LEVELS.map((l) => l.lanes)) - 1)) ||
      !kinds.has('workshop')
    )
      throw Error('Invalid crafting');
    jobs.add(job.id);
  }
  for (const lane of new Set(s.crafting.map((j) => j.lane ?? 0))) {
    const jobs = s.crafting.filter((j) => (j.lane ?? 0) === lane);
    if (jobs.some((j, i) => i > 0 && j.startedAt < jobs[i - 1].endsAt)) throw Error('Overlapping crafting jobs');
  }
  if (!validDaily(s.daily)) throw Error('Invalid daily rewards');
  if (
    !s.expeditionProgress ||
    typeof s.expeditionProgress !== 'object' ||
    Array.isArray(s.expeditionProgress) ||
    Object.entries(s.expeditionProgress).some(([id, progress]) => !regionById(id) || !integer(progress, REGION_STAGES))
  )
    throw Error('Invalid expedition progress');
  const away = new Set<string>(),
    runs = new Set<string>(),
    stageRuns = new Set<string>();
  if (!Array.isArray(s.expeditions) || s.expeditions.length > portalSlots(s)) throw Error('Invalid expedition');
  for (const x of s.expeditions) {
    const region = x && regionById(x.regionId);
    const progress = region ? (s.expeditionProgress[region.id] ?? 0) : 0;
    // A trip lasts exactly its stage's (or patrol's) time, unless diamonds brought it back early.
    const length = x && region ? tripMs(x) : 0;
    const reward = x?.reward;
    if (
      !x ||
      !region ||
      typeof x.id !== 'string' ||
      runs.has(x.id) ||
      !['stage', 'patrol'].includes(x.kind) ||
      !Array.isArray(x.team) ||
      x.team.length < 1 ||
      x.team.length > 3 ||
      x.team.some((id) => !dinoIds.has(id) || away.has(id)) ||
      new Set(x.team).size !== x.team.length ||
      !integer(x.startedAt, 1e14) ||
      !integer(x.endsAt, 1e14) ||
      !(length > 0) ||
      !(x.rushed === undefined || x.rushed === true) ||
      (x.rushed ? x.endsAt < x.startedAt || x.endsAt - x.startedAt > length : x.endsAt - x.startedAt !== length) ||
      (x.kind === 'stage'
        ? // Stages go in order, one run per region at a time, with the region's team size.
          x.hours !== undefined ||
          !integer(x.stage, REGION_STAGES - 1) ||
          x.stage !== progress ||
          stageRuns.has(region.id) ||
          x.team.length !== regionTeamSize(regionNumber(region.id))
        : x.stage !== undefined ||
          !(PATROL.hours as readonly number[]).includes(x.hours!) ||
          progress < PATROL.unlockStage) ||
      !reward ||
      !integer(reward.gold, 1_000_000) ||
      !integer(reward.food, 1_000_000) ||
      !reward.materials ||
      typeof reward.materials !== 'object' ||
      Object.entries(reward.materials).some(([id, n]) => !Object.hasOwn(ITEMS, id) || !integer(n, 100_000)) ||
      !(reward.tickets === undefined || integer(reward.tickets, 2)) ||
      !(
        reward.gems === undefined ||
        (x.kind === 'stage' && x.stage === REGION_STAGES - 1 && integer(reward.gems, 3))
      ) ||
      (reward.egg !== undefined &&
        (!isPlayableDinosaur(reward.egg.species, reward.egg.element) || reward.egg.element !== region.element))
    )
      throw Error('Invalid expedition');
    runs.add(x.id);
    if (x.kind === 'stage') stageRuns.add(region.id);
    x.team.forEach((id) => away.add(id));
  }
  // The upgrade being built: the next level of a standing building, lasting exactly its build time unless diamonds
  // finished part of it (then shorter).
  const build = s.construction,
    target = build?.target,
    targetOk =
      typeof target === 'string' &&
      (['farm', 'hatchery', 'workshop', 'portal', 'arena'].includes(target) ||
        (target.startsWith('habitat:') && element(target.slice(8)))),
    step = build && targetOk ? upgradeStep(build.target, build.level) : undefined,
    standing =
      !!target &&
      (target === 'portal'
        ? s.portalLevel > 0
        : target.startsWith('habitat:')
          ? !!s.habitats[target.slice(8) as RealmId]
          : kinds.has(target));
  if (
    build !== null &&
    (!build ||
      !targetOk ||
      !step ||
      !standing ||
      !integer(build.level, 10) ||
      build.level !== targetLevel(s, build.target) + 1 ||
      !integer(build.startedAt, 1e14) ||
      !integer(build.endsAt, 1e14) ||
      build.endsAt < build.startedAt ||
      !(build.rushed === undefined || build.rushed === true) ||
      (build.rushed
        ? build.endsAt - build.startedAt > step.minutes * 60_000
        : build.endsAt - build.startedAt !== step.minutes * 60_000))
  )
    throw Error('Invalid construction');
  if (s.battle !== null) {
    const b = s.battle;
    const tower = b && typeof b.encounterId === 'string' ? parseTowerId(b.encounterId) : null;
    // Tower foes are checked against the floor they claim: the base level and boss league come from the stored foes.
    const towerFoesOf = (t: { week: string; floor: number }) => {
      const first = Array.isArray(b?.foes) ? b.foes[0] : undefined,
        last = Array.isArray(b?.foes) ? b.foes[b.foes.length - 1] : undefined,
        base = first && integer(first.level, 100) ? first.level - towerLevel(0, t.floor) : 0;
      if (base < 10 || base > 50) return [];
      return towerFoes(t.week, t.floor, base, last?.boss && element(last.element) ? last.element : 'fire');
    };
    const expected = tower
      ? towerFoesOf(tower)
      : b && typeof b.encounterId === 'string'
        ? arenaFoes(b.encounterId)
        : [];
    const allies = Array.isArray(b?.team) ? b.team.map((a) => a && s.dinos.find((d) => d.id === a.dinoId)) : [];
    const sameFoe = (f: Foe, e: Foe) =>
      !!f &&
      f.species === e.species &&
      f.element === e.element &&
      f.stage === e.stage &&
      f.level === e.level &&
      f.rarity === e.rarity &&
      f.maxHp === e.maxHp &&
      f.power === e.power &&
      f.defense === e.defense &&
      f.speed === e.speed &&
      f.boss === e.boss &&
      (f.shieldUsed === undefined || f.shieldUsed === true) &&
      (f.healed === undefined || f.healed === true) &&
      integer(f.hp, f.maxHp);
    const report = b?.report;
    // The recap is cosmetic: a malformed one is dropped, not refused.
    if (
      b?.bestHit !== undefined &&
      !(b.bestHit && typeof b.bestHit.dinoId === 'string' && integer(b.bestHit.amount, 1e6))
    )
      delete b.bestHit;
    if (
      b?.damage !== undefined &&
      !(b.damage && typeof b.damage === 'object' && Object.values(b.damage).every((n) => integer(n, 1e8)))
    )
      delete b.damage;
    if (report && report.tapped !== undefined && report.tapped !== true) delete report.tapped;
    if (
      !b ||
      !expected.length ||
      !b.reward ||
      !integer(b.reward.gold) ||
      !integer(b.reward.food) ||
      !b.reward.materials ||
      Object.entries(b.reward.materials).some(([id, count]) => !Object.hasOwn(ITEMS, id) || !integer(count)) ||
      (b.reward.egg !== undefined && (!species(b.reward.egg?.species) || !element(b.reward.egg?.element))) ||
      !(b.reward.milestones === undefined || integer(b.reward.milestones, STAR_MILESTONES.length)) ||
      !Array.isArray(b.team) ||
      b.team.length < 1 ||
      b.team.length > 3 ||
      new Set(b.team.map((a) => a?.dinoId)).size !== b.team.length ||
      b.team.some(
        (a, i) =>
          !a ||
          !allies[i] ||
          allies[i]!.stage === 'baby' ||
          away.has(a.dinoId) ||
          !integer(a.maxHp, 100_000) ||
          a.maxHp < 1 ||
          !integer(a.hp, a.maxHp) ||
          !(a.species === undefined || a.species === allies[i]!.species) ||
          !(a.shieldUsed === undefined || a.shieldUsed === true) ||
          !(a.healed === undefined || a.healed === true),
      ) ||
      !integer(b.active, b.team.length - 1) ||
      b.team.some((a, i) => i < b.active && a.hp !== 0) ||
      !Array.isArray(b.foes) ||
      b.foes.length !== expected.length ||
      b.foes.some((f, i) => !sameFoe(f, expected[i])) ||
      !integer(b.foeIndex, b.foes.length - 1) ||
      b.foes.some((f, i) => i < b.foeIndex && f.hp !== 0) ||
      // The mirrored fields follow the fighters on stage.
      b.dinoId !== b.team[b.active].dinoId ||
      b.hp !== b.team[b.active].hp ||
      b.maxHp !== b.team[b.active].maxHp ||
      b.enemy !== b.foes[b.foeIndex].hp ||
      b.enemyMax !== b.foes[b.foeIndex].maxHp ||
      !integer(b.energy, 100) ||
      !integer(b.enemyEnergy, 100) ||
      !integer(b.round, roundCap(b.foes.length) + 1) ||
      b.round < 1 ||
      (report !== undefined &&
        (!report ||
          !['basic', 'defend', 'ultimate'].includes(report.ally) ||
          !['attack', 'defend', 'ultimate', 'none'].includes(report.foe) ||
          !integer(report.dealt, 100_000) ||
          !integer(report.enemyAfterStrike, 100_000) ||
          !integer(report.taken, 100_000) ||
          !integer(report.reflected, 100_000) ||
          !(report.hpAfter === undefined || integer(report.hpAfter, 100_000)) ||
          !(report.enemyAfter === undefined || integer(report.enemyAfter, 100_000)) ||
          !(report.swap === undefined || ['ally', 'enemy', 'both'].includes(report.swap)) ||
          !(
            report.abilities === undefined ||
            (Array.isArray(report.abilities) &&
              report.abilities.every(
                (x) =>
                  !!x &&
                  (x.on === 'ally' || x.on === 'enemy') &&
                  ABILITY_KINDS.includes(x.kind) &&
                  (x.amount === undefined || integer(x.amount, 100_000)),
              ))
          ) ||
          typeof report.dodged !== 'boolean')) ||
      ![null, 'victory', 'defeat', 'draw'].includes(b.result) ||
      (b.result === 'victory') !== b.foes.every((f) => f.hp === 0) ||
      (b.result === 'defeat' && b.team.some((a) => a.hp > 0)) ||
      !(b.stars === undefined || (b.result === 'victory' && integer(b.stars, 3) && b.stars >= 1)) ||
      !['start', 'basic', 'defend', 'ultimate'].includes(b.log) ||
      (s.rewardPending && b.result !== 'victory')
    )
      throw Error('Invalid battle');
  } else if (s.rewardPending) throw Error('Invalid reward');
  // Remove retired static-only families without resetting resources or progress.
  s.dinos = s.dinos.filter((d) => isPlayableDinosaur(d.species, d.element));
  s.eggs = s.eggs.filter((e) => isPlayableDinosaur(e.species, e.element));
  s.owedEggs = s.owedEggs.filter((e) => isPlayableDinosaur(e.species, e.element));
  s.team = s.team.filter((id) => s.dinos.some((d) => d.id === id));
  s.defense = s.defense.filter((id) => s.dinos.some((d) => d.id === id));
  if (!s.dinos.some((d) => d.id === s.champion)) s.champion = s.dinos[0]?.id ?? null;
  if (!s.team.length && s.champion) s.team = [s.champion];
  s.champion = s.team[0] ?? null;
  s.expeditions = s.expeditions.filter((x) => x.team.every((id) => s.dinos.some((d) => d.id === id)));
  if (s.battle && !s.battle.team.every((a) => s.dinos.some((d) => d.id === a.dinoId))) {
    s.battle = null;
    s.rewardPending = false;
  }
  if (s.battle?.reward.egg && !isPlayableDinosaur(s.battle.reward.egg.species, s.battle.reward.egg.element))
    delete s.battle.reward.egg;
  return s;
}
