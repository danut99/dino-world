import { arenaBoss, ARENA_BOSSES } from './arenaBosses';
import { isPlayableDinosaur, playableSpecies } from './playableDinosaurs';
import {
  CROPS,
  ENCOUNTERS,
  FARM_LEVELS,
  ITEMS,
  RECIPES,
  UTILITY_BUILDINGS,
  initialInventory,
  recipeFoodCost,
  type CropId,
  type Encounter,
  type Inventory,
  type ItemId,
  type UtilityKind,
} from './content';
import { buildable } from './grid';
import { newDaily, dailyState, dailyQuests, DAILY_QUESTS, DAILY_BONUS, WHEEL_PRIZES, wheelPrize, grantDailyReward, addDailyProgress, validDaily, type DailyState, type DailyQuestId } from './daily';
import { expeditionMs, expeditionPlan, expeditionStageCount } from './expeditionRules';
export { expeditionMs } from './expeditionRules';
export const SAVE_KEY = 'dino-realms-save-v1';
export const BALANCE = {
  /** The tutorial fire egg; every other egg uses `eggSeconds`. */
  incubation: 30_000,
  eggSeconds: 300,
  offlineCap: 8 * 3_600_000,
  maxEggs: 12,
  maxDinos: 60,
};
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
export const SPECIES = ['trex', 'raptor', 'triceratops', 'ankylosaurus', 'brachiosaurus', 'ignasaur', 'thalassaur', 'terrasaur'] as const;
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
  boss: { hp: 1.15, power: 1.1, defense: 1.1, speed: 0.9 },
};
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
}
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
export function rarityOdds(encounter: Pick<Encounter, 'id' | 'mode'>): { rare: number; epic: number } {
  if (encounter.mode !== 'arena') return { rare: 0.2, epic: 0.04 };
  const tier = Number(encounter.id.split('-')[2] ?? 1);
  return tier >= 3 ? { rare: 0.25, epic: 0.12 } : tier === 2 ? { rare: 0.22, epic: 0.08 } : { rare: 0.2, epic: 0.05 };
}
export const rarityOf = (x: { rarity?: Rarity }): Rarity => x.rarity ?? 'common';
export interface Battle {
  encounterId: string;
  dinoId: string;
  /** `egg` is rolled when the fight is won (see `eggOdds`); `milestones` counts star milestones it pays out. */
  reward: { gold: number; food: number; materials: Partial<Inventory>; egg?: EggKind; milestones?: number };
  /** Stars earned when the fight was won, from the health left (see `starsFor`). */
  stars?: number;
  hp: number;
  enemy: number;
  maxHp: number;
  enemyMax: number;
  energy: number;
  cooldown: number;
  burn: number;
  round: number;
  result: 'victory' | 'defeat' | 'draw' | null;
  log: string;
  /** The opponent's bar: +50 a round, its ultimate fires when full (see `foeMove`). Missing in older saves. */
  enemyEnergy?: number;
  /** What happened in the last round, for the replay and the on-screen callouts. */
  report?: RoundReport;
}
export type FoeMove = 'attack' | 'defend' | 'ultimate';
/** A timed expedition: the dinosaur leaves, and its rewards wait until it is back (`endsAt`). */
export interface Expedition {
  encounterId: string;
  dinoId: string;
  startedAt: number;
  endsAt: number;
  /** Absent only on trips started before staged expeditions. */
  stage?: number;
  reward: { gold: number; food: number; materials: Partial<Inventory>; egg?: EggKind };
}
export interface RoundReport {
  ally: 'basic' | 'skill' | 'defend' | 'ultimate';
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
}
export interface Save {
  schemaVersion: 5;
  contentVersion: 1;
  revision: number;
  updatedAt: number;
  gold: number;
  food: number;
  /** Gold produced by all habitats, waiting to be collected. */
  storedGold: number;
  buildings: Building[];
  dinos: Dino[];
  /** The dinosaur that fights and that the HUD follows. */
  champion: string | null;
  eggs: Egg[];
  hatcheryLevel: number;
  /** Workshop and Arena Gate levels (see WORKSHOP_LEVELS, ARENA_LEVELS). */
  workshopLevel: number;
  arenaLevel: number;
  /** Habitat level per element world; a missing world has no habitat yet. */
  habitats: Partial<Record<RealmId, number>>;
  /** Story eggs already claimed (see QUEST_EGGS). */
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
  rewardedTutorial: boolean;
  inventory: Inventory;
  crafting: CraftJob[];
  /** The dinosaur away on a timed expedition, and what it brings back. Null when nobody is out. */
  expedition: Expedition | null;
  expeditionProgress: Partial<Record<string, number>>;
  daily: DailyState;
  cleared: string[];
  lanterns: number;
}
export interface CraftJob {
  id: string;
  recipeId: string;
  startedAt: number;
  endsAt: number;
  /** Which of the workshop's parallel jobs runs it; older saves have none (lane 0). */
  lane?: number;
}

/** Hatchery: eggs incubating at the same time, per level. */
export const HATCHERY_LEVELS: { slots: number; gold: number; materials: Partial<Record<ItemId, number>> }[] = [
  { slots: 1, gold: 0, materials: {} },
  { slots: 3, gold: 400, materials: { planks: 4 } },
  { slots: 5, gold: 1000, materials: { planks: 6, blocks: 6 } },
];
/**
 * Workshop: `slots` jobs running or waiting, `lanes` of them running at once, `speed` multiplies crafting time.
 * Each level costs gold and materials, like the farm.
 */
export const WORKSHOP_LEVELS: {
  slots: number;
  lanes: number;
  speed: number;
  gold: number;
  materials: Partial<Record<ItemId, number>>;
}[] = [
  { slots: 3, lanes: 1, speed: 1, gold: 0, materials: {} },
  { slots: 5, lanes: 2, speed: 0.75, gold: 600, materials: { planks: 6, blocks: 6 } },
  { slots: 6, lanes: 3, speed: 0.75, gold: 1500, materials: { planks: 10, blocks: 10, crystal: 10 } },
];
/** Arena Gate: level 2 adds 25% to arena rewards and opens the last five leagues. */
export const ARENA_LEVELS: { bonus: number; gold: number; materials: Partial<Record<ItemId, number>> }[] = [
  { bonus: 0, gold: 0, materials: {} },
  { bonus: 0.25, gold: 1200, materials: { blocks: 8, crystal: 15 } },
];
export const GATE_LEAGUES = ['lightning', 'wind', 'dark', 'light', 'arcane'];
/** Habitat per element world: residents, gold storage, income bonus. Each upgrade costs gold and one habitat kit. */
export const HABITAT_LEVELS = [
  { capacity: 2, cap: 600, gold: 0 },
  { capacity: 3, cap: 750, gold: 150 },
  { capacity: 3, cap: 900, gold: 300 },
  { capacity: 4, cap: 1100, gold: 500 },
  { capacity: 4, cap: 1300, gold: 800 },
  { capacity: 5, cap: 1500, gold: 1200 },
];
/**
 * Opening another element world (and its first habitat) costs gold and materials, rising world by world like
 * the original game's unlock costs. The fire world comes with the tutorial.
 */
export const WORLD_UNLOCK: Record<RealmId, { gold: number; materials: Partial<Record<ItemId, number>> }> = {
  fire: { gold: 0, materials: {} },
  water: { gold: 300, materials: { wood: 10 } },
  earth: { gold: 500, materials: { stone: 15 } },
  nature: { gold: 750, materials: { wood: 10, fiber: 15 } },
  ice: { gold: 1000, materials: { stone: 10, crystal: 10 } },
  lightning: { gold: 1500, materials: { crystal: 15, planks: 4 } },
  wind: { gold: 2000, materials: { fiber: 20, planks: 6 } },
  dark: { gold: 2600, materials: { crystal: 20, blocks: 6 } },
  light: { gold: 3300, materials: { planks: 8, blocks: 8 } },
  arcane: { gold: 4000, materials: { crystal: 30, planks: 10, blocks: 10 } },
};
/** The five MVP elements sell cheaper eggs at the market. */
const MVP_ELEMENTS: RealmId[] = ['fire', 'water', 'earth', 'ice', 'wind'];
export const eggPrice = (element: RealmId) => (MVP_ELEMENTS.includes(element) ? 250 : 500);
/** The Market sells only these eggs; every other element is won in fights. */
export const MARKET_ELEMENTS: RealmId[] = ['fire', 'water', 'earth'];
/** What a waiting egg sells back for: rare, fight-only elements are worth more. */
export const eggSellPrice = (element: RealmId) => (MARKET_ELEMENTS.includes(element) ? 100 : 300);
/**
 * Egg drops. League fights drop their own element (a boss always does the first time), expeditions any unlocked
 * fight-only element. After `pity` drop-eligible wins without an egg, the next one always drops.
 */
export const EGG_DROP = { league: 0.1, boss: 0.2, expedition: 0.05, pity: 8 };
const MAX_OWED_EGGS = 30;
/** The chance and elements of the egg a win can drop, or null when this fight never drops one. */
export function eggOdds(s: Save, encounter: Encounter, firstWin: boolean) {
  if (encounter.id === 'training') return null;
  if (encounter.mode === 'arena') {
    const league = encounter.league as RealmId | undefined;
    if (!league || MARKET_ELEMENTS.includes(league) || !playableSpecies(league).length) return null;
    const boss = encounter.id === `arena-${league}-3`;
    return { chance: boss ? (firstWin ? 1 : EGG_DROP.boss) : EGG_DROP.league, elements: [league] };
  }
  const elements = ELEMENTS.map((e) => e.id).filter((id) => s.habitats[id] && !MARKET_ELEMENTS.includes(id) && playableSpecies(id).length > 0);
  return elements.length ? { chance: EGG_DROP.expedition, elements } : null;
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
const bossesBeaten = (s: Save) => s.cleared.filter((id) => /^arena-[a-z]+-3$/.test(id)).length;
const worldsOpen = (s: Save) => Object.keys(s.habitats).length;
/**
 * Story rewards. Chapter I gives the four MVP egg variants (plan section 5). From chapter II on, the story card
 * follows five goals per chapter, one at a time: each pays gold and food, and the chapter's last one adds an egg.
 */
/** A quest goal naming an expedition by its current title, so renaming or reordering never leaves it stale. */
const clearTask = (id: string): [string, string] => {
  const name = ENCOUNTERS.find((e) => e.id === id)!.name;
  return [`Termină expediția ${name[0]}`, `Finish the ${name[1]} expedition`];
};
export const QUEST_EGGS: {
  id: string;
  /** The egg this step gives; most chapter steps pay only gold and food. */
  species?: Species;
  element?: RealmId;
  gold?: number;
  food?: number;
  task: readonly [string, string];
  done: (s: Save) => boolean;
  chapter?: 2 | 3;
  /** Progress toward the goal as [now, needed], shown on the story card. */
  progress?: (s: Save) => [number, number];
  /** The panel where the player works on it. */
  panel?: 'dino' | 'habitat' | 'arena' | 'farm' | 'market' | 'workshop';
}[] = [
  {
    id: 'raptor_fire',
    species: 'raptor',
    element: 'earth',
    task: ['Termină prima expediție', 'Finish your first expedition'],
    done: (s) => s.cleared.includes('training'),
  },
  {
    id: 'triceratops_earth',
    species: 'triceratops',
    element: 'nature',
    task: ['Construiește o fermă', 'Build a farm'],
    done: (s) => s.buildings.some((b) => b.kind === 'farm'),
  },
  {
    id: 'ankylosaurus_nature',
    species: 'triceratops',
    element: 'nature',
    task: clearTask('ruins'),
    done: (s) => s.cleared.includes('ruins'),
  },
  {
    id: 'brachiosaurus_water',
    species: 'raptor',
    element: 'water',
    task: clearTask('lagoon'),
    done: (s) => s.cleared.includes('lagoon'),
  },
  {
    id: 'ch2_adult',
    chapter: 2,
    gold: 300,
    food: 150,
    task: ['Crește un dinozaur până la adult', 'Raise a dinosaur to adult'],
    done: (s) => s.dinos.some((d) => d.stage === 'adult'),
    progress: (s) => [s.dinos.filter((d) => d.stage === 'adult').length, 1],
    panel: 'dino',
  },
  {
    id: 'ch2_worlds4',
    chapter: 2,
    gold: 500,
    food: 200,
    task: ['Deblochează 4 lumi', 'Unlock 4 worlds'],
    done: (s) => worldsOpen(s) >= 4,
    progress: (s) => [worldsOpen(s), 4],
    panel: 'habitat',
  },
  {
    id: 'ch2_ember_boss',
    chapter: 2,
    gold: 600,
    food: 250,
    task: ['Învinge bossul Ligii jarului', 'Beat the Ember league boss'],
    done: (s) => s.cleared.includes('arena-fire-3'),
    progress: (s) => [s.cleared.filter((id) => id.startsWith('arena-fire-')).length, 3],
    panel: 'arena',
  },
  {
    id: 'ch2_farm3',
    chapter: 2,
    gold: 700,
    food: 300,
    task: ['Îmbunătățește ferma la nivelul 3', 'Upgrade the farm to level 3'],
    done: (s) => s.farmLevel >= 3,
    progress: (s) => [Math.min(s.farmLevel, 3), 3],
    panel: 'farm',
  },
  {
    id: 'ch2_dinos8',
    chapter: 2,
    species: 'triceratops',
    element: 'nature',
    gold: 900,
    food: 350,
    task: ['Adună 8 dinozauri', 'Own 8 dinosaurs'],
    done: (s) => s.dinos.length >= 8,
    progress: (s) => [Math.min(s.dinos.length, 8), 8],
    panel: 'market',
  },
  {
    id: 'ch2_gate',
    chapter: 3,
    gold: 1000,
    food: 400,
    task: ['Îmbunătățește Poarta arenei', 'Upgrade the Arena Gate'],
    done: (s) => s.arenaLevel >= 2,
    progress: (s) => [s.arenaLevel - 1, 1],
    panel: 'arena',
  },
  {
    id: 'ch3_workshop3',
    chapter: 3,
    gold: 1100,
    food: 450,
    task: ['Îmbunătățește atelierul la nivelul 3', 'Upgrade the workshop to level 3'],
    done: (s) => s.workshopLevel >= 3,
    progress: (s) => [s.workshopLevel, 3],
    panel: 'workshop',
  },
  {
    id: 'ch2_bosses3',
    chapter: 3,
    gold: 1200,
    food: 500,
    task: ['Învinge 3 bossi de ligă', 'Beat 3 league bosses'],
    done: (s) => bossesBeaten(s) >= 3,
    progress: (s) => [Math.min(bossesBeaten(s), 3), 3],
    panel: 'arena',
  },
  {
    id: 'ch3_bosses5',
    chapter: 3,
    gold: 1400,
    food: 550,
    task: ['Învinge 5 bossi de ligă', 'Beat 5 league bosses'],
    done: (s) => bossesBeaten(s) >= 5,
    progress: (s) => [Math.min(bossesBeaten(s), 5), 5],
    panel: 'arena',
  },
  {
    id: 'ch2_worlds10',
    chapter: 3,
    species: 'raptor',
    element: 'dark',
    gold: 1500,
    food: 600,
    task: ['Deblochează toate cele 10 lumi', 'Unlock all 10 worlds'],
    done: (s) => worldsOpen(s) >= 10,
    progress: (s) => [worldsOpen(s), 10],
    panel: 'habitat',
  },
];
/** Chapters after the tutorial: a rank and title for the header badge, and five goals in story order. */
export const STORY_CHAPTERS = [
  {
    number: 2,
    rank: ['Îmblânzitor', 'Tamer'] as const,
    title: ['Stăpânul tărâmurilor', 'Master of the realms'] as const,
    steps: QUEST_EGGS.filter((q) => q.chapter === 2),
  },
  {
    number: 3,
    rank: ['Campion', 'Champion'] as const,
    title: ['Legenda arenei', 'Legend of the arena'] as const,
    steps: QUEST_EGGS.filter((q) => q.chapter === 3),
  },
];
/** Chapter II goals, in story order. */
export const CHAPTER_TWO = STORY_CHAPTERS[0].steps;
/** The chapter being played after the tutorial and its next unclaimed goal; null once every chapter is done. */
export function storyChapter(s: Save) {
  const chapter = STORY_CHAPTERS.find((c) => c.steps.some((q) => !s.questEggs.includes(q.id)));
  if (!chapter) return null;
  const step = chapter.steps.find((q) => !s.questEggs.includes(q.id))!;
  return { chapter, step, index: chapter.steps.indexOf(step) };
}

export type Command =
  | { type: 'spinDaily' | 'claimDailyBonus' }
  | { type: 'claimDailyQuest'; quest: DailyQuestId }
  | { type: 'incubate' | 'hatch'; eggId?: string }
  | { type: 'feed' | 'evolve' | 'useCrystal'; dinoId?: string }
  | {
      type:
        | 'collect'
        | 'claim'
        | 'collectAvailable'
        | 'placeLamp'
        | 'upgradeFarm'
        | 'upgradeHatchery'
        | 'upgradeWorkshop'
        | 'upgradeArena'
        | 'devSkip'
        | 'devResources'
        | 'devRarityEggs';
    }
  | { type: 'setChampion'; dinoId: string }
  | { type: 'buyEgg'; species: Species; element: RealmId }
  | { type: 'sellEgg'; eggId: string }
  | { type: 'claimQuestEgg'; questId: string }
  | { type: 'unlockHabitat' | 'upgradeHabitat'; realm: RealmId }
  | { type: 'plant'; crop?: CropId; plot?: number }
  | { type: 'harvest'; plot?: number }
  | { type: 'battle'; encounterId?: string }
  | { type: 'expedition'; encounterId: string }
  | { type: 'claimExpedition' }
  | { type: 'build'; x: number; y: number; kind?: UtilityKind }
  | { type: 'craft'; recipeId: string }
  | { type: 'claimCraft' | 'cancelCraft'; jobId: string }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'action'; action: 'basic' | 'skill' | 'defend' | 'ultimate' };
export function newSave(now: number): Save {
  return {
    schemaVersion: 5,
    contentVersion: 1,
    revision: 0,
    updatedAt: now,
    gold: 1200,
    food: 300,
    storedGold: 0,
    buildings: [{ id: 'nest', kind: 'hatchery', x: 2, y: 4 }],
    dinos: [],
    champion: null,
    eggs: [{ id: 'egg-ignis', species: 'trex', element: 'fire', seconds: BALANCE.incubation / 1000, hatchAt: null }],
    hatcheryLevel: 1,
    workshopLevel: 1,
    arenaLevel: 1,
    habitats: { fire: 1 },
    questEggs: [],
    eggLuck: 0,
    owedEggs: [],
    bossEggsClaimed: [],
    stars: {},
    starMilestones: 0,
    tired: {},
    farmLevel: 1,
    plots: [null],
    battle: null,
    victories: 0,
    rewardPending: false,
    rewardedTutorial: false,
    inventory: initialInventory(),
    crafting: [],
    expedition: null,
    expeditionProgress: {},
    daily: newDaily(now),
    cleared: [],
    lanterns: 0,
  };
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
/** Gold storage of all habitats together. */
export const goldCap = (s: Save) =>
  (Object.values(s.habitats) as number[]).reduce((n, level) => n + HABITAT_LEVELS[level - 1].cap, 0);
/** Gold per hour of one dinosaur: by stage, earth ×1.25, +10% per habitat level above 1. */
const STAGE_INCOME: Record<Stage, number> = { baby: 10, juvenile: 30, adult: 60 };
export const dinoIncome = (s: Save, d: Dino) =>
  STAGE_INCOME[d.stage] * (d.element === 'earth' ? 1.25 : 1) * (1 + 0.1 * ((s.habitats[d.element] ?? 1) - 1));
export const goldRate = (s: Save) => s.dinos.reduce((n, d) => n + dinoIncome(s, d), 0);
export const workshop = (s: Save) => WORKSHOP_LEVELS[s.workshopLevel - 1];
/** When each workshop lane is free again (never before `now`). */
const laneFree = (s: Save, lane: number, now: number) =>
  Math.max(now, ...s.crafting.filter((j) => (j.lane ?? 0) === lane).map((j) => j.endsAt));
export const incubating = (s: Save) => s.eggs.filter((e) => e.hatchAt !== null);
export const hatcherySlots = (s: Save) => HATCHERY_LEVELS[s.hatcheryLevel - 1].slots;
/** Story steps whose task is done but whose reward was not claimed yet. */
export const questEggsReady = (s: Save) => QUEST_EGGS.filter((q) => q.done(s) && !s.questEggs.includes(q.id));
type StoryStep = (typeof QUEST_EGGS)[number];
/** Whether a story step gives an egg. */
export const storyEgg = (q: StoryStep): q is StoryStep & EggKind => !!q.species && !!q.element;
/** Chapter I story eggs ready in the hatchery; chapter II is claimed from the story card. */
export const hatcheryStoryEggs = (s: Save) =>
  questEggsReady(s)
    .filter((q) => !q.chapter)
    .filter(storyEgg);
export const feedCost = (level: number) => 10 + 5 * (level - 1);
export const stats = (level: number, stage: Stage, species: Species = 'trex', rarity: Rarity = 'common') => {
  const factor = (1 + 0.05 * (level - 10)) * (stage === 'adult' ? 1.15 : 1) * RARITY_POWER[rarity],
    m = SPECIES_STATS[species];
  return {
    hp: Math.round(220 * m.hp * factor),
    power: Math.round(40 * m.power * factor),
    defense: Math.round(20 * m.defense * factor),
    speed: Math.round(25 * m.speed),
  };
};
/** Rolls the egg an encounter may drop, with the shared pity counter. Mutates `s.eggLuck`. */
function rollEgg(s: Save, encounter: Encounter, now: number): EggKind | undefined {
  const odds = eggOdds(s, encounter, !s.cleared.includes(encounter.id));
  if (!odds) return undefined;
  const seed = `${s.revision}:${now}:${encounter.id}`;
  if (s.eggLuck >= EGG_DROP.pity || roll(seed) < odds.chance) {
    const element = odds.elements[Math.floor(roll(`${seed}:element`) * odds.elements.length)];
    const species = playableSpecies(element);
    const chance = rarityOdds(encounter),
      r = roll(`${seed}:rarity`);
    s.eggLuck = 0;
    return {
      species: species[Math.floor(roll(`${seed}:species`) * species.length)],
      element,
      rarity: r < chance.epic ? 'epic' : r < chance.epic + chance.rare ? 'rare' : 'common',
    };
  }
  s.eggLuck++;
  return undefined;
}
/** Hands a won egg to the waiting list (the shelf takes it as soon as there is room). */
function receiveEgg(s: Save, egg: EggKind) {
  // Twenty regular waiting eggs plus ten reserved slots for the unique boss rewards.
  if (egg.species === 'boss') {
    if (s.owedEggs.length >= MAX_OWED_EGGS) throw new Error('eggsFull');
    s.owedEggs.push(egg);
  } else if (s.owedEggs.length < MAX_OWED_EGGS && s.owedEggs.filter(e => e.species !== 'boss').length < 20) {
    s.owedEggs.push(egg);
  }
  if (egg.species === 'boss' && !s.bossEggsClaimed.includes(egg.element)) s.bossEggsClaimed.push(egg.element);
}
/** Stars for a won fight, from the share of health left: half or more is three, a fifth or more two. */
export function starsFor(hpLeft: number, maxHp: number) {
  const share = hpLeft / maxHp;
  return share >= 0.5 ? 3 : share >= 0.2 ? 2 : 1;
}
/** Stars needed on a tier to open the next tier of its league. */
export const STARS_TO_ADVANCE = 2;
/** Rewards for the total of arena stars (90 at most: ten leagues, three tiers, three stars). */
export const STAR_MILESTONES: { stars: number; gold: number; food: number; materials: Partial<Inventory> }[] = [
  { stars: 5, gold: 300, food: 150, materials: { crystal: 5 } },
  { stars: 12, gold: 500, food: 250, materials: { evolutionCrystal: 1 } },
  { stars: 20, gold: 800, food: 400, materials: { crystal: 15, blocks: 3 } },
  { stars: 30, gold: 1200, food: 600, materials: { evolutionCrystal: 2 } },
  { stars: 42, gold: 1800, food: 800, materials: { crystal: 25, planks: 5, blocks: 5 } },
  { stars: 55, gold: 2500, food: 1000, materials: { evolutionCrystal: 3 } },
  { stars: 70, gold: 3500, food: 1500, materials: { crystal: 40, habitatKit: 1 } },
  { stars: 90, gold: 6000, food: 2500, materials: { evolutionCrystal: 5 } },
];
export const starTotal = (s: Pick<Save, 'stars'>) => Object.values(s.stars).reduce((a, b) => a + b, 0);
/** How long a dinosaur rests after losing a fight. */
export const TIRED_MS = 3 * 60_000;
/** Whether the dinosaur is still resting from a lost fight. */
export const isTired = (s: Pick<Save, 'tired'>, dinoId: string, now: number) => (s.tired[dinoId] ?? 0) > now;
/** Damage the dinosaur's strike deals; `defend` deals none. Shared by the reducer and the auto-battle planner. */
export function strikeDamage(d: Pick<Dino, 'level' | 'stage' | 'species' | 'rarity'>, action: 'basic' | 'skill' | 'defend' | 'ultimate') {
  if (action === 'defend') return 0;
  const st = stats(d.level, d.stage, d.species, rarityOf(d)),
    coefficient = action === 'skill' ? 1.2 : action === 'ultimate' ? 1.3 : 1;
  return Math.max(1, Math.floor(((st.power * coefficient * 100) / 115) * 1.25));
}
/** Arena ages follow tier, independently of level; expeditions retain their level-based progression. */
export function opponentAdult(e: Pick<Encounter, 'id' | 'level'>) {
  const arenaTier = /^arena-[a-z]+-([123])$/.exec(e.id);
  return arenaTier ? Number(arenaTier[1]) >= 2 : e.level >= 15;
}
/** Only adults and champions own an ultimate clip, so only they may unleash one. */
export function foeHasUltimate(encounterId: string) {
  const e = ENCOUNTERS.find((x) => x.id === encounterId);
  return !!e && (!!arenaBoss(e) || opponentAdult(e));
}
/** The opponent's move this round, fixed by the round and its bar, so the fight stays replayable. */
export function foeMove(b: Pick<Battle, 'encounterId' | 'round' | 'enemyEnergy'>): FoeMove {
  // The guard comes first on its rounds, so it is seen even while the bar is full.
  if (b.round % 6 === 2) return 'defend';
  return (b.enemyEnergy ?? 0) >= 100 && foeHasUltimate(b.encounterId) ? 'ultimate' : 'attack';
}
/**
 * Energy pacing: both bars fill fast enough for an ultimate about every third round, so they show all fight
 * long instead of once near the end. The dinosaur also charges when it is hit.
 */
export const ENERGY = { basic: 50, skill: 20, defend: 25, hit: 15, foe: 50 };
/** Power of either side's ultimate, against a basic strike. */
export const ULTIMATE_POWER = 1.3;
/** A guarding opponent takes half of the blow. */
export const FOE_GUARD = 0.5;
/** Share of the incoming blow a guarding dinosaur turns back on its opponent. */
export const REFLECT = 0.25;
/** Chance to dodge an unguarded blow: faster species slip away more often (raptor about 9%, ankylosaur 1%). */
export function dodgeChance(d: Pick<Dino, 'level' | 'stage' | 'species' | 'rarity'>) {
  return Math.min(0.12, Math.max(0.01, (stats(d.level, d.stage, d.species, rarityOf(d)).speed - 20) / 100));
}
/** Damage the dinosaur's strike would deal this round, after the opponent's guard. */
/**
 * The element wheel: each element beats the next one in its cycle. Fire burns nature, nature overgrows earth,
 * earth grounds lightning, lightning strikes water, water quenches fire; ice freezes wind, wind scatters arcane
 * sigils, arcane cracks ice; light and dark beat each other.
 */
export const ELEMENT_BEATS: Record<RealmId, RealmId[]> = {
  fire: ['nature'],
  nature: ['earth'],
  earth: ['lightning'],
  lightning: ['water'],
  water: ['fire'],
  ice: ['wind'],
  wind: ['arcane'],
  arcane: ['ice'],
  light: ['dark'],
  dark: ['light'],
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
export const encounterElement = (encounterId: string) => ENCOUNTERS.find((e) => e.id === encounterId)?.league as RealmId | undefined;
/** The dinosaur's edge in this encounter (neutral where the opponent has no element). */
export function battleEdge(encounterId: string, d: Pick<Dino, 'element'>): -1 | 0 | 1 {
  const foe = encounterElement(encounterId);
  return foe ? elementEdge(d.element, foe) : 0;
}
export function strikeAgainst(b: Pick<Battle, 'encounterId' | 'round' | 'enemyEnergy'>, d: Pick<Dino, 'level' | 'stage' | 'species' | 'element' | 'rarity'>, action: 'basic' | 'skill' | 'defend' | 'ultimate') {
  if (action === 'defend') return 0;
  const raw = Math.max(1, Math.floor(strikeDamage(d, action) * EDGE_DEALT[battleEdge(b.encounterId, d)]));
  return foeMove(b) === 'defend' ? Math.max(1, Math.floor(raw * FOE_GUARD)) : raw;
}
/** Damage the opponent deals back in a round, reduced when the dinosaur defends. */
export function incomingDamage(b: Pick<Battle, 'encounterId'>, d: Pick<Dino, 'level' | 'stage' | 'species' | 'element' | 'rarity'>, defending: boolean) {
  const st = stats(d.level, d.stage, d.species, rarityOf(d));
  return Math.max(
    1,
    Math.floor(
      (((ENCOUNTERS.find((e) => e.id === b.encounterId)?.power ?? 30) * 100) / (100 + st.defense)) *
        0.8 *
        (defending ? 0.6 : 1) *
        EDGE_TAKEN[battleEdge(b.encounterId, d)],
    ),
  );
}
export function advance(save: Save, now: number): Save {
  const s = structuredClone(save),
    elapsed = Math.min(Math.max(0, now - s.updatedAt), BALANCE.offlineCap);
  s.storedGold = Math.max(s.storedGold, Math.min(goldCap(s), s.storedGold + (elapsed / 3_600_000) * goldRate(s)));
  s.updatedAt = Math.max(s.updatedAt, now);
  s.daily = dailyState(s, now);
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
const nicknameFor = (s: Save, species: Species, element: RealmId) =>
  species === 'trex' && element === 'fire' && !s.dinos.some((d) => d.nickname === 'Ignis')
    ? 'Ignis'
    : `${SPECIES_NAMES[species]} ${s.dinos.filter((d) => d.species === species).length + 1}`;
export function command(save: Save, c: Command, now: number): Save {
  const s = advance(save, now);
  const require = (ok: unknown, message: string) => {
    if (!ok) throw new Error(message);
  };
  const pay = (gold: number, materials: Partial<Record<ItemId, number>>) => {
    require(s.gold >= gold, 'gold');
    const costs = Object.entries(materials) as [ItemId, number][];
    require(costs.every(([id, count]) => s.inventory[id] >= count), 'materials');
    s.gold -= gold;
    costs.forEach(([id, count]) => (s.inventory[id] -= count));
  };
  /** The dinosaur a feed/evolve/crystal command targets: the given one, or the champion. */
  const target = (dinoId?: string) => {
    const d = s.dinos.find((x) => x.id === (dinoId ?? s.champion));
    require(d, 'dino');
    require(!s.battle || s.battle.dinoId !== d!.id, 'unavailable');
    return d!;
  };
  switch (c.type) {
    case 'spinDaily': {
      require(s.daily.spin === null, 'dailyClaimed');
      const prize = wheelPrize(Math.random());
      s.daily.spin = prize;
      grantDailyReward(s, WHEEL_PRIZES[prize].reward);
      break;
    }
    case 'claimDailyQuest': {
      require(dailyQuests(s.daily.day).includes(c.quest), 'dailyQuest');
      require(!s.daily.claimed.includes(c.quest), 'dailyClaimed');
      require(s.daily.progress[c.quest] >= DAILY_QUESTS[c.quest].target, 'dailyIncomplete');
      grantDailyReward(s, DAILY_QUESTS[c.quest].reward);
      s.daily.claimed.push(c.quest);
      break;
    }
    case 'claimDailyBonus':
      require(!s.daily.bonus, 'dailyClaimed');
      require(dailyQuests(s.daily.day).every(id => s.daily.claimed.includes(id)), 'dailyIncomplete');
      grantDailyReward(s, DAILY_BONUS);
      s.daily.bonus = true;
      break;
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
      const dino: Dino = {
        id: egg.id === 'egg-ignis' ? 'ignis' : `dino-${s.revision + 1}`,
        species: egg.species,
        element: egg.element,
        level: egg.species === 'boss' ? 25 : 1,
        stage: egg.species === 'boss' ? 'adult' : 'baby',
        nickname: egg.species === 'boss' ? ARENA_BOSSES[egg.element].name : nicknameFor(s, egg.species, egg.element),
        rarity: egg.species === 'boss' ? 'legendary' : rarityOf(egg),
      };
      s.dinos.push(dino);
      s.eggs = s.eggs.filter((e) => e !== egg);
      s.champion ??= dino.id;
      break;
    }
    case 'feed': {
      const d = target(c.dinoId);
      require(d.level < (d.stage === 'baby' ? 9 : d.stage === 'juvenile' ? 24 : 50), 'evolve');
      require(s.food >= feedCost(d.level), 'food');
      s.food -= feedCost(d.level);
      d.level++;
      break;
    }
    case 'evolve': {
      const d = target(c.dinoId);
      require((d.stage === 'baby' && d.level === 9) || (d.stage === 'juvenile' && d.level === 24), 'level');
      require(s.food >= feedCost(d.level), 'food');
      s.food -= feedCost(d.level);
      d.level++;
      d.stage = d.stage === 'baby' ? 'juvenile' : 'adult';
      break;
    }
    case 'useCrystal': {
      const d = target(c.dinoId);
      require(s.inventory.evolutionCrystal > 0 && d.level < 50 && d.level !== 9 && d.level !== 24, 'level');
      s.inventory.evolutionCrystal--;
      d.level++;
      break;
    }
    case 'setChampion':
      require(s.dinos.some((d) => d.id === c.dinoId), 'dino');
      require(!s.battle, 'unavailable');
      s.champion = c.dinoId;
      break;
    case 'buyEgg': {
      require(s.buildings.some((b) => b.kind === 'market'), 'building');
      require(c.species !== 'boss' && isPlayableDinosaur(c.species, c.element), 'egg');
      require(s.habitats[c.element], 'habitat');
      require(MARKET_ELEMENTS.includes(c.element), 'fightEgg');
      require(s.eggs.length < BALANCE.maxEggs, 'eggsFull');
      pay(eggPrice(c.element), {});
      s.eggs.push({
        id: `egg-${s.revision + 1}`,
        species: c.species,
        element: c.element,
        seconds: BALANCE.eggSeconds,
        hatchAt: null,
      });
      break;
    }
    case 'sellEgg': {
      const egg = s.eggs.find((e) => e.id === c.eggId);
      // The tutorial egg is the first dinosaur, so it cannot be sold.
      require(egg && egg.hatchAt === null && egg.id !== 'egg-ignis' && egg.species !== 'boss', 'egg');
      s.eggs = s.eggs.filter((e) => e !== egg);
      s.gold += eggSellPrice(egg!.element);
      break;
    }
    case 'claimQuestEgg': {
      const quest = questEggsReady(s).find((q) => q.id === c.questId);
      require(quest, 'locked');
      if (!quest) break;
      if (quest.species && quest.element) {
        require(s.eggs.length < BALANCE.maxEggs, 'eggsFull');
        s.eggs.push({
          id: `egg-${quest.id}`,
          species: quest.species,
          element: quest.element,
          seconds: BALANCE.eggSeconds,
          hatchAt: null,
        });
      }
      s.gold += quest.gold ?? 0;
      s.food += quest.food ?? 0;
      s.questEggs.push(quest.id);
      break;
    }
    case 'unlockHabitat':
      require(ELEMENTS.some((e) => e.id === c.realm) && !s.habitats[c.realm], 'habitat');
      pay(WORLD_UNLOCK[c.realm].gold, WORLD_UNLOCK[c.realm].materials);
      s.habitats[c.realm] = 1;
      break;
    case 'upgradeHabitat': {
      const level = s.habitats[c.realm];
      require(level, 'habitat');
      const next = HABITAT_LEVELS[level!];
      require(next, 'maxLevel');
      pay(next.gold, { habitatKit: 1 });
      s.habitats[c.realm] = level! + 1;
      break;
    }
    case 'upgradeWorkshop': {
      require(s.buildings.some((b) => b.kind === 'workshop'), 'workshop');
      const next = WORKSHOP_LEVELS[s.workshopLevel];
      require(next, 'maxLevel');
      pay(next.gold, next.materials);
      s.workshopLevel++;
      break;
    }
    case 'upgradeArena': {
      require(s.buildings.some((b) => b.kind === 'arena'), 'building');
      const next = ARENA_LEVELS[s.arenaLevel];
      require(next, 'maxLevel');
      pay(next.gold, next.materials);
      s.arenaLevel++;
      break;
    }
    case 'upgradeHatchery': {
      const next = HATCHERY_LEVELS[s.hatcheryLevel];
      require(next, 'maxLevel');
      pay(next.gold, next.materials);
      s.hatcheryLevel++;
      break;
    }
    case 'build': {
      const kind = c.kind ?? 'farm',
        spec = UTILITY_BUILDINGS[kind];
      require(spec && kind !== 'hatchery', 'building');
      require(s.gold >= spec.cost, 'gold');
      require(canPlace(s, c.x, c.y), 'placement');
      require(!s.buildings.some((b) => b.kind === kind), 'building');
      s.gold -= spec.cost;
      s.buildings.push({ id: kind, kind, x: c.x, y: c.y });
      break;
    }
    case 'move': {
      const b = s.buildings.find((b) => b.id === c.id);
      require(b && canPlace(s, c.x, c.y, c.id), 'placement');
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
    case 'upgradeFarm': {
      require(s.buildings.some((b) => b.kind === 'farm'), 'farm');
      const next = FARM_LEVELS[s.farmLevel];
      require(next, 'maxLevel');
      if (!next) break;
      pay(next.gold, next.materials);
      s.farmLevel++;
      s.plots.push(...Array<null>(next.plots - s.plots.length).fill(null));
      break;
    }
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
    case 'placeLamp':
      require(s.inventory.lamp > 0 && s.lanterns < 4, 'materials');
      s.inventory.lamp--;
      s.lanterns++;
      break;
    // Test tools behind the "i" button.
    case 'devSkip': {
      for (const e of s.eggs) if (e.hatchAt !== null) e.hatchAt = Math.min(e.hatchAt, now);
      for (const p of s.plots) if (p) p.readyAt = Math.min(p.readyAt, now);
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
      s.storedGold = Math.max(s.storedGold, goldCap(s));
      break;
    }
    case 'devRarityEggs':
      // Test tool: a rare and an epic fire T-Rex egg, delivered like won eggs, to preview the rarity look.
      for (const rarity of ['rare', 'epic'] as const) receiveEgg(s, { species: 'trex', element: 'fire', rarity });
      break;
    case 'devResources':
      s.gold += 5000;
      s.food += 5000;
      for (const id of ['wood', 'stone', 'fiber', 'crystal'] as const) s.inventory[id] += 50;
      s.inventory.planks += 20;
      s.inventory.blocks += 20;
      s.inventory.habitatKit += 3;
      s.inventory.evolutionCrystal += 3;
      break;
    case 'battle': {
      const d = champion(s);
      require(d && d.stage !== 'baby' && !s.battle && !s.rewardPending, 'juvenile');
      if (!d) break;
      require(s.expedition?.dinoId !== d.id, 'away');
      const encounter = ENCOUNTERS.find((e) => e.id === (c.encounterId ?? 'training'));
      require(encounter, 'encounter');
      if (!encounter) break;
      require(encounter.mode === 'arena' || encounter.id === 'training', 'timedExpedition');
      require(
        !encounter.requires ||
          (encounter.mode === 'arena' ? (s.stars[encounter.requires] ?? 0) >= STARS_TO_ADVANCE : s.cleared.includes(encounter.requires)),
        encounter.mode === 'arena' ? 'stars' : 'locked',
      );
      require(!encounter.league || !!s.habitats[encounter.league as RealmId], 'locked');
      require(!isTired(s, d.id, now), 'tired');
      require(!GATE_LEAGUES.includes(encounter.league ?? '') || s.arenaLevel >= 2, 'gate');
      require(d.level >= encounter.level, 'level');
      require(encounter.id === 'training' ||
        s.buildings.some((b) => b.kind === (encounter.mode === 'arena' ? 'arena' : 'portal')), 'building');
      const repeat = s.cleared.includes(encounter.id);
      const st = stats(d.level, d.stage, d.species, rarityOf(d));
      // The upgraded Arena Gate adds its bonus to arena rewards.
      const boost = (n: number) =>
        encounter.mode === 'arena' ? Math.round(n * (1 + ARENA_LEVELS[s.arenaLevel - 1].bonus)) : n;
      s.battle = {
        encounterId: encounter.id,
        dinoId: d.id,
        reward: {
          gold: boost(repeat ? 50 : encounter.gold),
          food: boost(repeat ? 25 : encounter.food),
          materials: Object.fromEntries(
            Object.entries(encounter.materials).map(([id, count]) => [
              id,
              boost(repeat ? Math.max(1, Math.floor(count! / 4)) : count!),
            ]),
          ),
        },
        hp: st.hp,
        maxHp: st.hp,
        enemy: encounter.hp,
        enemyMax: encounter.hp,
        energy: 0,
        cooldown: 0,
        burn: 0,
        round: 1,
        result: null,
        log: 'start',
      };
      break;
    }
    case 'expedition': {
      const d = champion(s);
      require(d && d.stage !== 'baby', 'juvenile');
      require(!s.expedition, 'busy');
      if (!d) break;
      require(s.battle?.dinoId !== d.id, 'busy');
      const encounter = ENCOUNTERS.find((e) => e.id === c.encounterId && e.mode === 'expedition');
      require(encounter, 'encounter');
      if (!encounter) break;
      require(!encounter.requires || s.cleared.includes(encounter.requires), 'locked');
      const plan = expeditionPlan(s, encounter.id);
      require(d.level >= plan.level, 'level');
      require(encounter.id === 'training' || s.buildings.some((b) => b.kind === 'portal'), 'building');
      require(plan.stocked, 'provisions');
      s.inventory.provisions -= plan.supplies;
      const repeat = s.cleared.includes(encounter.id);
      // The egg is decided when the dinosaur leaves, so waiting never changes what it brings back.
      const finalStage = plan.stage === plan.total - 1;
      const egg = finalStage ? rollEgg(s, encounter, now) : undefined;
      const portion = (n: number) => Math.max(1, Math.floor(n / plan.total));
      s.expedition = {
        encounterId: encounter.id,
        dinoId: d.id,
        startedAt: now,
        endsAt: now + plan.duration,
        stage: plan.stage,
        reward: {
          gold: repeat ? 50 : portion(encounter.gold),
          food: repeat ? 25 : portion(encounter.food),
          materials: Object.fromEntries(
            Object.entries(encounter.materials).map(([id, count]) => [id, repeat ? Math.max(1, Math.floor(count! / 4)) : portion(count!)]),
          ),
          ...(egg ? { egg } : {}),
        },
      };
      break;
    }
    case 'claimExpedition': {
      const x = s.expedition;
      require(x && now >= x.endsAt, 'expedition');
      if (!x) break;
      s.gold += x.reward.gold;
      s.food += x.reward.food;
      (Object.entries(x.reward.materials) as [ItemId, number][]).forEach(([id, count]) => (s.inventory[id] += count));
      const total = expeditionStageCount(x.encounterId);
      const completed = x.stage === undefined ? total : x.stage + 1;
      s.expeditionProgress[x.encounterId] = Math.max(s.expeditionProgress[x.encounterId] ?? 0, completed);
      if (completed >= total && !s.cleared.includes(x.encounterId)) s.cleared.push(x.encounterId);
      if (x.reward.egg) receiveEgg(s, x.reward.egg);
      if (x.encounterId === 'training') s.rewardedTutorial = true;
      s.expedition = null;
      break;
    }
    case 'action': {
      const b = s.battle,
        d = b && s.dinos.find((x) => x.id === b.dinoId);
      require(b && d && !b.result, 'battle');
      if (!b || !d) break;
      // A full bar unlocks the ultimate; it may also land as the finishing blow, which kills either way.
      require(c.action !== 'ultimate' || (d.stage === 'adult' && (b.energy >= 100 || strikeAgainst(b, d, 'basic') >= b.enemy)), 'energy');
      require(c.action !== 'skill' || b.cooldown === 0, 'cooldown');
      const foe = foeMove(b);
      const dealt = c.action === 'defend' ? 0 : strikeAgainst(b, d, c.action);
      b.enemy = Math.max(0, b.enemy - dealt);
      const enemyAfterStrike = b.enemy;
      b.cooldown = Math.max(0, b.cooldown - 1);
      if (c.action === 'skill') {
        b.cooldown = 2;
        b.burn = 2;
      }
      b.energy =
        c.action === 'ultimate'
          ? 0
          : Math.min(100, b.energy + ENERGY[c.action]);
      if (b.enemy > 0 && b.burn > 0) {
        b.enemy = Math.max(0, b.enemy - Math.floor(b.enemyMax * 0.05));
        b.burn--;
      }
      // The opponent answers: it guards, strikes, or unleashes its ultimate. A guard turns part of the blow
      // back; an unguarded blow may be dodged.
      let taken = 0,
        dodged = false,
        reflected = 0;
      const acts = b.enemy > 0;
      if (acts && foe !== 'defend') {
        const guarding = c.action === 'defend',
          power = foe === 'ultimate' ? ULTIMATE_POWER : 1;
        if (guarding) {
          taken = Math.floor(incomingDamage(b, d, true) * power);
          reflected = Math.floor(incomingDamage(b, d, false) * power * REFLECT);
          b.enemy = Math.max(0, b.enemy - reflected);
        } else if (roll(`${b.encounterId}:${b.round}:${d.id}:dodge`) < dodgeChance(d)) dodged = true;
        else taken = Math.floor(incomingDamage(b, d, false) * power);
        b.hp = Math.max(0, b.hp - taken);
      }
      if (acts) b.enemyEnergy = foe === 'ultimate' ? 0 : Math.min(100, (b.enemyEnergy ?? 0) + ENERGY.foe);
      if (taken > 0 && b.hp > 0) b.energy = Math.min(100, b.energy + ENERGY.hit);
      b.report = { ally: c.action, foe: acts ? foe : 'none', dealt, enemyAfterStrike, taken, dodged, reflected };
      b.log = c.action;
      b.round++;
      b.result = b.enemy === 0 ? 'victory' : b.hp === 0 ? 'defeat' : b.round > 30 ? 'draw' : null;
      if (b.result === 'victory') {
        s.rewardPending = true;
        const encounter = ENCOUNTERS.find((e) => e.id === b.encounterId)!;
        if (encounter.mode === 'arena') {
          b.stars = starsFor(b.hp, b.maxHp);
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
        if (s.battle!.encounterId === 'training') s.rewardedTutorial = true;
        const id = s.battle!.encounterId;
        if (s.battle!.stars) s.stars[id] = Math.max(s.stars[id] ?? 0, s.battle!.stars);
        s.starMilestones += s.battle!.reward.milestones ?? 0;
      } else if (s.battle!.result === 'defeat') {
        s.tired[s.battle!.dinoId] = now + TIRED_MS;
      }
      s.battle = null;
      break;
  }
  // Won eggs wait here while the shelf is full and move onto it as soon as there is room.
  while (s.owedEggs.length && s.eggs.length < BALANCE.maxEggs)
    s.eggs.push({
      ...s.owedEggs.shift()!,
      id: `egg-${s.revision + 1}-${s.eggs.length}`,
      seconds: BALANCE.eggSeconds,
      hatchAt: null,
    });
  if (c.type === 'feed' || c.type === 'evolve') addDailyProgress(s, 'feed');
  const harvested = save.plots.filter((p, i) => p && !s.plots[i]).length;
  if (harvested) addDailyProgress(s, 'harvest', harvested);
  const crafted = save.crafting.filter(j => !s.crafting.some(next => next.id === j.id) && j.endsAt <= now).length;
  if (crafted && (c.type === 'claimCraft' || c.type === 'collectAvailable')) addDailyProgress(s, 'craft', crafted);
  if (c.type === 'claim' && save.battle?.result) addDailyProgress(s, 'battle');
  if (c.type === 'claimExpedition') addDailyProgress(s, 'expedition');
  s.revision++;
  return s;
}
type LegacySave = Record<string, unknown> & { schemaVersion: number };
/** Brings v1–v4 previews up to v5 without losing progress. */
function migrate(raw: LegacySave): LegacySave {
  let s = raw;
  // The first review put a habitat building on home. Preserve progress while moving its resident to the fire world.
  if (s.schemaVersion === 1)
    s = {
      ...s,
      schemaVersion: 2,
      buildings: (s.buildings as Building[]).filter((b) => b.kind !== 'habitat'),
      dino: s.dino ? { ...(s.dino as object), realm: 'fire' } : null,
    };
  if (s.schemaVersion === 2) {
    s = {
      ...s,
      schemaVersion: 3,
      inventory: initialInventory(),
      crafting: [],
      cleared: s.rewardedTutorial ? ['training'] : [],
      worldIncomeBonus: 0,
      lanterns: 0,
    };
    if (s.battle)
      s.battle = {
        ...(s.battle as object),
        encounterId: 'training',
        reward: { gold: s.rewardedTutorial ? 50 : 250, food: s.rewardedTutorial ? 25 : 150, materials: {} },
      };
  }
  // v4: the farm got levels and several plots. A crop that was growing becomes ferns on the first plot.
  if (s.schemaVersion === 3) {
    const { farmAt, ...rest } = s;
    s = {
      ...rest,
      schemaVersion: 4,
      farmLevel: 1,
      plots: [typeof farmAt === 'number' ? { crop: 'ferns', readyAt: farmAt } : null],
    };
  }
  // v5: many dinosaurs and eggs. Ignis and the tutorial egg keep their state; the world bonus becomes fire habitat levels.
  if (s.schemaVersion === 4) {
    const { egg, hatchAt, dino, worldIncomeBonus, ...rest } = s;
    const old = dino as { level: number; stage: Stage; nickname: string } | null;
    s = {
      ...rest,
      schemaVersion: 5,
      dinos: old
        ? [
            {
              id: 'ignis',
              species: 'trex',
              element: 'fire',
              level: old.level,
              stage: old.stage,
              nickname: old.nickname,
            },
          ]
        : [],
      champion: old ? 'ignis' : null,
      eggs:
        egg === 'hatched'
          ? []
          : [
              {
                id: 'egg-ignis',
                species: 'trex',
                element: 'fire',
                seconds: BALANCE.incubation / 1000,
                hatchAt: egg === 'incubating' ? hatchAt : null,
              },
            ],
      hatcheryLevel: 1,
      habitats: { fire: 1 + (typeof worldIncomeBonus === 'number' ? worldIncomeBonus : 0) },
      questEggs: [],
      battle: s.battle && old ? { ...(s.battle as object), dinoId: 'ignis' } : s.battle,
    };
  }
  return s;
}
export function parseSave(text: string): Save {
  const raw = JSON.parse(text) as LegacySave;
  const s = (raw && typeof raw.schemaVersion === 'number' ? migrate(raw) : raw) as unknown as Save;
  if (s && typeof s === 'object') {
    s.workshopLevel ??= 1;
    s.expedition ??= null;
    s.expeditionProgress ??= {};
    s.daily ??= newDaily(s.updatedAt);
    if (s.inventory && typeof s.inventory === 'object') s.inventory.provisions ??= 0;
    s.arenaLevel ??= 1;
    s.eggLuck ??= 0;
    s.owedEggs ??= [];
    s.bossEggsClaimed ??= [];
    // Saves from before rarity: champions hatched from a boss egg are legendary; everything else stays common.
    for (const d of Array.isArray(s.dinos) ? s.dinos : []) if (d && d.species === 'boss') d.rarity ??= 'legendary';
    // Saves from before stars: every arena fight already won counts as two stars, so no tier closes again.
    s.stars ??= Object.fromEntries(
      (s.cleared ?? []).filter((id) => ENCOUNTERS.some((e) => e.id === id && e.mode === 'arena')).map((id) => [id, STARS_TO_ADVANCE]),
    );
    s.starMilestones ??= STAR_MILESTONES.filter((m) => m.stars <= starTotal(s)).length;
    s.tired ??= {};
    // The five farm levels became three; keep every planted crop and unlocked plot.
    if (
      Number.isInteger(s.farmLevel) && s.farmLevel >= 1 && s.farmLevel <= 5 &&
      Array.isArray(s.plots) && s.plots.length === s.farmLevel
    ) {
      s.farmLevel = Math.min(s.farmLevel, FARM_LEVELS.length);
      const slots = FARM_LEVELS[s.farmLevel - 1].plots;
      s.plots.push(...Array<null>(slots - s.plots.length).fill(null));
    }
    // Story eggs moved to worlds players reach early (wind → fire, ice → nature); claimed ones stay claimed.
    const STORY_RENAMED: Record<string, string> = {
      raptor_wind: 'raptor_fire',
      ankylosaurus_ice: 'ankylosaurus_nature',
    };
    if (Array.isArray(s.questEggs)) s.questEggs = s.questEggs.map((id) => STORY_RENAMED[id] ?? id);
  }
  // The first arena ladder (arena1-3) became the fire league, the first one players open.
  const renamed = (id: unknown) => (typeof id === 'string' && /^arena[123]$/.test(id) ? `arena-fire-${id[5]}` : id);
  if (s && Array.isArray(s.cleared)) s.cleared = s.cleared.map(renamed) as string[];
  if (s?.battle) s.battle.encounterId = renamed(s.battle.encounterId) as string;
  const finite = (n: unknown, max = 1e9): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const integer = (n: unknown, max = 1e9): n is number => finite(n, max) && Number.isInteger(n);
  const element = (id: unknown): id is RealmId => ELEMENTS.some((e) => e.id === id);
  const species = (id: unknown): id is Species => (id === 'boss' || SPECIES.includes(id as (typeof SPECIES)[number]));
  if (
    !s ||
    s.schemaVersion !== 5 ||
    s.contentVersion !== 1 ||
    !integer(s.revision) ||
    !finite(s.updatedAt, 1e14) ||
    !finite(s.gold) ||
    !finite(s.food) ||
    !integer(s.victories) ||
    typeof s.rewardPending !== 'boolean' ||
    typeof s.rewardedTutorial !== 'boolean' ||
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
  if (
    !s.habitats ||
    typeof s.habitats !== 'object' ||
    Object.entries(s.habitats).some(
      ([id, level]) => !element(id) || !integer(level, HABITAT_LEVELS.length) || level < 1,
    ) ||
    !finite(s.storedGold, goldCap(s)) ||
    !integer(s.hatcheryLevel, HATCHERY_LEVELS.length) ||
    s.hatcheryLevel < 1 ||
    !integer(s.workshopLevel, WORKSHOP_LEVELS.length) ||
    s.workshopLevel < 1 ||
    !integer(s.arenaLevel, ARENA_LEVELS.length) ||
    s.arenaLevel < 1 ||
    !Array.isArray(s.questEggs) ||
    new Set(s.questEggs).size !== s.questEggs.length ||
    s.questEggs.some((id) => !QUEST_EGGS.some((q) => q.id === id)) ||
    !integer(s.eggLuck, EGG_DROP.pity) ||
    !Array.isArray(s.owedEggs) ||
    s.owedEggs.length > MAX_OWED_EGGS ||
    !Array.isArray(s.bossEggsClaimed) ||
    !s.stars ||
    typeof s.stars !== 'object' ||
    Object.entries(s.stars).some(([id, n]) => !ENCOUNTERS.some((e) => e.id === id && e.mode === 'arena') || !integer(n, 3) || n < 1) ||
    !integer(s.starMilestones, STAR_MILESTONES.length) ||
    !s.tired ||
    typeof s.tired !== 'object' ||
    Object.values(s.tired).some((t) => !integer(t)) ||
    new Set(s.bossEggsClaimed).size !== s.bossEggsClaimed.length ||
    s.bossEggsClaimed.some(e => !element(e)) ||
    s.owedEggs.some((e) => !e || !species(e.species) || !element(e.element))
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
      (d.species === 'boss' && d.stage !== 'adult') ||
      (d.rarity !== undefined && !RARITIES.includes(d.rarity)) ||
      typeof d.nickname !== 'string' ||
      d.nickname.length > 40 ||
      (d.stage === 'baby' ? d.level > 9 : d.stage === 'juvenile' ? d.level < 10 || d.level > 24 : d.level < 25)
    )
      throw Error('Invalid dinosaur');
    else dinoIds.add(d.id);
  if (
    ELEMENTS.some((e) => residents(s, e.id).length > habitatCapacity(s, e.id)) ||
    !(s.champion === null ? s.dinos.length === 0 : dinoIds.has(s.champion))
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
    !integer(s.lanterns, 4) ||
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
      !WORKSHOP_LEVELS.some((l) => job.endsAt - job.startedAt === Math.round(recipe.seconds * 1000 * l.speed)) ||
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
  if (!s.expeditionProgress || typeof s.expeditionProgress !== 'object' || Array.isArray(s.expeditionProgress) ||
    Object.entries(s.expeditionProgress).some(([id, progress]) =>
      !ENCOUNTERS.some(e => e.id === id && e.mode === 'expedition') || !integer(progress, expeditionStageCount(id))))
    throw Error('Invalid expedition progress');
  if (s.expedition !== null) {
    const x = s.expedition,
      encounter = x && ENCOUNTERS.find((e) => e.id === x.encounterId && e.mode === 'expedition');
    if (
      !x ||
      !encounter ||
      !s.dinos.some((d) => d.id === x.dinoId) ||
      !integer(x.startedAt, 1e14) ||
      !integer(x.endsAt, 1e14) ||
      (x.stage === undefined
        ? x.endsAt - x.startedAt !== (x.encounterId === 'training' ? 30_000 :
          (ENCOUNTERS.filter(e => e.mode === 'expedition').findIndex(e => e.id === x.encounterId) + 1) * 60_000)
        : !integer(x.stage, expeditionStageCount(x.encounterId) - 1) ||
          x.stage !== Math.min(s.cleared.includes(x.encounterId) ? expeditionStageCount(x.encounterId) : s.expeditionProgress[x.encounterId] ?? 0, expeditionStageCount(x.encounterId) - 1) ||
          x.endsAt - x.startedAt !== expeditionMs(x.encounterId, x.stage)) ||
      !integer(x.reward.gold, 100000) ||
      !integer(x.reward.food, 100000) ||
      Object.entries(x.reward.materials).some(([id, n]) => !(id in s.inventory) || !integer(n, 100000)) ||
      (x.reward.egg !== undefined && !isPlayableDinosaur(x.reward.egg.species, x.reward.egg.element))
    )
      throw Error('Invalid expedition');
  }
  if (s.battle !== null) {
    const b = s.battle,
      d = b && s.dinos.find((x) => x.id === b.dinoId);
    if (
      !b ||
      !ENCOUNTERS.some((e) => e.id === b.encounterId) ||
      !b.reward ||
      !integer(b.reward.gold) ||
      !integer(b.reward.food) ||
      !b.reward.materials ||
      Object.entries(b.reward.materials).some(([id, count]) => !Object.hasOwn(ITEMS, id) || !integer(count)) ||
      (b.reward.egg !== undefined && (!species(b.reward.egg?.species) || !element(b.reward.egg?.element))) ||
      !d ||
      d.stage === 'baby' ||
      !integer(b.hp, b.maxHp) ||
      !integer(b.maxHp, 10000) ||
      b.maxHp < 1 ||
      !integer(b.enemy, b.enemyMax) ||
      !integer(b.enemyMax, 10000) ||
      b.enemyMax < 1 ||
      !integer(b.energy, 100) ||
      !integer(b.cooldown, 2) ||
      !integer(b.burn, 2) ||
      !integer(b.round, 31) ||
      (b.enemyEnergy !== undefined && !integer(b.enemyEnergy, 100)) ||
      (b.report !== undefined &&
        (!['basic', 'skill', 'defend', 'ultimate'].includes(b.report.ally) ||
          !['attack', 'defend', 'ultimate', 'none'].includes(b.report.foe) ||
          !integer(b.report.dealt, 10000) ||
          !integer(b.report.enemyAfterStrike, b.enemyMax) ||
          !integer(b.report.taken, 10000) ||
          !integer(b.report.reflected, 10000) ||
          typeof b.report.dodged !== 'boolean')) ||
      b.round < 1 ||
      ![null, 'victory', 'defeat', 'draw'].includes(b.result) ||
      !['start', 'basic', 'skill', 'defend', 'ultimate'].includes(b.log) ||
      (s.rewardPending && b.result !== 'victory')
    )
      throw Error('Invalid battle');
  } else if (s.rewardPending) throw Error('Invalid reward');
  // Remove retired static-only families without resetting resources or progress.
  s.dinos = s.dinos.filter(d => isPlayableDinosaur(d.species, d.element));
  s.eggs = s.eggs.filter(e => isPlayableDinosaur(e.species, e.element));
  s.owedEggs = s.owedEggs.filter(e => isPlayableDinosaur(e.species, e.element));
  if (!s.dinos.some(d => d.id === s.champion)) s.champion = s.dinos[0]?.id ?? null;
  if (s.battle && !s.dinos.some(d => d.id === s.battle!.dinoId)) {
    s.battle = null;
    s.rewardPending = false;
  }
  if (s.battle?.reward.egg && !isPlayableDinosaur(s.battle.reward.egg.species, s.battle.reward.egg.element))
    delete s.battle.reward.egg;
  return s;
}
