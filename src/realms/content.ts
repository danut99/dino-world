import type { RealmId } from './game';
export const UTILITY_BUILDINGS = {
  hatchery: {
    name: ['Incubator', 'Hatchery'],
    cost: 0,
    icon: '◈',
    description: ['Eclozează primul tău erou.', 'Hatch your first hero.'],
  },
  farm: {
    name: ['Fermă', 'Farm'],
    cost: 100,
    icon: '❧',
    description: [
      'Cultivă hrană pe straturi. Îmbunătățește-o pentru mai multe straturi și recolte mai mari.',
      'Grow food on plots. Upgrade it for more plots and bigger harvests.',
    ],
  },
  workshop: {
    name: ['Atelier', 'Workshop'],
    cost: 300,
    icon: '⚒',
    description: ['Transformă materiale în obiecte utile.', 'Turn materials into useful items.'],
  },
  portal: {
    name: ['Portal de expediții', 'Expedition Portal'],
    cost: 500,
    icon: '◎',
    description: ['Explorează regiunile și câștigă materiale.', 'Explore regions and earn materials.'],
  },
  arena: {
    name: ['Poarta arenei', 'Arena Gate'],
    cost: 800,
    icon: '⚔',
    description: ['Înfruntă santinelele în arena PvE.', 'Challenge sentinels in the PvE arena.'],
  },
  market: {
    name: ['Piață', 'Market'],
    cost: 300,
    icon: '⚖',
    description: ['Cumpără ouă pentru lumile în care ai habitat.', 'Buy eggs for the worlds where you have a habitat.'],
  },
} as const;
export type UtilityKind = keyof typeof UTILITY_BUILDINGS;
export const ITEMS = {
  wood: { name: ['Lemn', 'Wood'], icon: '▰', color: '#bf905e' },
  stone: { name: ['Piatră', 'Stone'], icon: '◆', color: '#b6b7ad' },
  fiber: { name: ['Fibre', 'Fiber'], icon: '❧', color: '#a6c582' },
  crystal: { name: ['Cristale', 'Crystals'], icon: '♦', color: '#77d8e9' },
  habitatKit: { name: ['Kit de habitat', 'Habitat kit'], icon: '⌂', color: '#b8c58e' },
  evolutionCrystal: { name: ['Cristal de evoluție', 'Evolution crystal'], icon: '✧', color: '#bca4ed' },
  lamp: { name: ['Lampă ornamentală', 'Ornamental lamp'], icon: '☼', color: '#e2bf76' },
  scarecrow: { name: ['Sperietoare', 'Scarecrow'], icon: '¥', color: '#d9b45a' },
  signpost: { name: ['Indicator', 'Signpost'], icon: '➚', color: '#bf905e' },
  provisions: { name: ['Provizii de expediție', 'Expedition supplies'], icon: '◈', color: '#dfbc78' },
} as const;
export type ItemId = keyof typeof ITEMS;
/** What each crafted item is for, in one plain sentence. */
export const ITEM_USE: Partial<Record<ItemId, readonly [string, string]>> = {
  provisions: [
    'Hrana echipei: unele expediții și patrulele o cer.',
    'Food for the team: some expeditions and patrols need it.',
  ],
  habitatKit: ['Mărește o lume ca să încapă mai mulți dinozauri.', 'Grows a world so more dinosaurs fit in it.'],
  evolutionCrystal: [
    'Face un dinozaur tânăr adult sau îi dă +1 nivel.',
    'Evolves a juvenile into an adult, or gives +1 level.',
  ],
  lamp: ['Se pune pe insulă: lumile tale dau mai mult aur.', 'Goes on your island: your worlds give more gold.'],
  scarecrow: ['Se pune pe insulă: ferma dă recolte mai mari.', 'Goes on your island: your farm gives bigger harvests.'],
  signpost: [
    'Se pune pe insulă: expedițiile și patrulele durează mai puțin.',
    'Goes on your island: expeditions and patrols take less time.',
  ],
};
export type Inventory = Record<ItemId, number>;
export const initialInventory = (): Inventory => ({
  wood: 30,
  stone: 30,
  fiber: 20,
  crystal: 15,
  habitatKit: 0,
  evolutionCrystal: 0,
  lamp: 0,
  scarecrow: 0,
  signpost: 0,
  provisions: 0,
});
/**
 * Farm levels, as in Dino World: each level unlocks one more plot and multiplies the food of every harvest.
 * `gold` and `materials` are the price of reaching that level (level 1 comes with the building); `minutes` is how
 * long that upgrade takes to build.
 */
export const FARM_LEVELS: {
  plots: number;
  yield: number;
  gold: number;
  materials: Partial<Record<ItemId, number>>;
  minutes: number;
}[] = [
  { plots: 2, yield: 1, gold: 0, materials: {}, minutes: 0 },
  { plots: 3, yield: 1.25, gold: 400, materials: {}, minutes: 5 },
  { plots: 4, yield: 1.5, gold: 1500, materials: { wood: 30 }, minutes: 60 },
  { plots: 5, yield: 2, gold: 5000, materials: { wood: 60, stone: 40 }, minutes: 240 },
  { plots: 6, yield: 2.5, gold: 12000, materials: { wood: 100, stone: 80, crystal: 10 }, minutes: 480 },
];
/**
 * Crops: all three make the same food and are open from the start; they differ only in how long you are away (now,
 * a break, overnight). Farm levels add plots and multiply every harvest.
 */
export const CROPS = [
  { id: 'ferns', name: ['Ferigi', 'Ferns'], icon: '🌿', cost: 0, seconds: 5 * 60, food: 10, level: 1 },
  { id: 'cicadas', name: ['Cicade', 'Cicadas'], icon: '🦗', cost: 5, seconds: 3600, food: 60, level: 1 },
  { id: 'feast', name: ['Ospăț', 'Feast'], icon: '🍖', cost: 25, seconds: 8 * 3600, food: 350, level: 1 },
] as const;
/** Crops from older saves, mapped to the current crop closest in length. */
export const RETIRED_CROPS: Record<string, CropId> = { ginkgo: 'cicadas', meat: 'cicadas', amber: 'feast' };
export type CropId = (typeof CROPS)[number]['id'];
export const RECIPES = [
  {
    id: 'provisions',
    name: ['Pachet de provizii', 'Supply pack'],
    cost: { wood: 2, fiber: 1 },
    food: 30,
    seconds: 3 * 60,
    output: 'provisions',
    quantity: 1,
  },
  {
    id: 'kit',
    name: ['Kit de habitat', 'Habitat kit'],
    cost: { wood: 20, stone: 20, fiber: 6 },
    seconds: 20 * 60,
    output: 'habitatKit',
    quantity: 1,
  },
  {
    id: 'evolution',
    name: ['Cristal de evoluție', 'Evolution crystal'],
    cost: { crystal: 8, fiber: 6 },
    seconds: 30 * 60,
    output: 'evolutionCrystal',
    quantity: 1,
  },
  {
    id: 'lamp',
    name: ['Lampă ornamentală', 'Ornamental lamp'],
    cost: { stone: 20, crystal: 6 },
    seconds: 20 * 60,
    output: 'lamp',
    quantity: 1,
  },
  {
    id: 'scarecrow',
    name: ['Sperietoare', 'Scarecrow'],
    cost: { wood: 20, fiber: 10 },
    seconds: 20 * 60,
    output: 'scarecrow',
    quantity: 1,
  },
  {
    id: 'signpost',
    name: ['Indicator', 'Signpost'],
    cost: { wood: 25, stone: 10 },
    seconds: 20 * 60,
    output: 'signpost',
    quantity: 1,
  },
] satisfies {
  id: string;
  name: string[];
  cost: Partial<Inventory>;
  seconds: number;
  output: ItemId;
  quantity: number;
  food?: number;
}[];
export const recipeFoodCost = (recipe: { id: string; food?: number }) => recipe.food ?? 0;
export interface Encounter {
  id: string;
  name: [string, string];
  /** Every encounter is an arena fight; expeditions are timed trips into the REGIONS below. */
  mode: 'arena';
  /** The tier's level: its opponents fight at it, and every team member needs it. */
  level: number;
  requires?: string;
  /** First-win rewards for a single dinosaur, before the team and Arena Gate bonuses (see `rewardPreview`). */
  gold: number;
  food: number;
  materials: Partial<Inventory>;
  x: number;
  y: number;
  image: string;
  /** Arena league: the element world that opens it. */
  league?: string;
}
export const ENCOUNTERS: Encounter[] = [];
/**
 * Expedition regions, one per element world and in the worlds' unlock order (fire first). Each has five stages,
 * crossed once each by a team (see expeditionRules.ts); `materials` is the pair its stages and patrols bring back,
 * `minutes` the length of each stage, `x`/`y` the island on the expedition map (percent).
 */
export interface Region {
  id: string;
  name: readonly [string, string];
  element: RealmId;
  materials: readonly [ItemId, ItemId];
  minutes: readonly [number, number, number, number, number];
  x: number;
  y: number;
}
export const REGIONS: readonly Region[] = [
  {
    id: 'training',
    name: ['Pasul de jar', 'Ember pass'],
    element: 'fire',
    materials: ['wood', 'stone'],
    // Short on purpose: the whole first region fits in a first session (about 24 minutes).
    minutes: [1, 2, 4, 7, 10],
    x: 78,
    y: 23,
  },
  {
    id: 'ruins',
    name: ['Reciful de safir', 'Sapphire reef'],
    element: 'water',
    materials: ['wood', 'crystal'],
    minutes: [30, 45, 60, 90, 120],
    x: 65,
    y: 75,
  },
  {
    id: 'canyon',
    name: ['Ruinele canionului', 'Canyon ruins'],
    element: 'earth',
    materials: ['stone', 'crystal'],
    minutes: [90, 120, 150, 180, 240],
    x: 37,
    y: 62,
  },
  {
    id: 'frost',
    name: ['Poiana ferigilor', 'Fern glade'],
    element: 'nature',
    materials: ['wood', 'fiber'],
    minutes: [120, 150, 180, 240, 300],
    x: 20,
    y: 75,
  },
  {
    id: 'lagoon',
    name: ['Coroana de gheață', 'The frozen crown'],
    element: 'ice',
    materials: ['stone', 'crystal'],
    minutes: [150, 180, 240, 300, 360],
    x: 20,
    y: 18,
  },
  {
    id: 'wind',
    name: ['Turnul furtunii', 'Storm spire'],
    element: 'lightning',
    materials: ['crystal', 'fiber'],
    minutes: [180, 240, 300, 360, 420],
    x: 86,
    y: 44,
  },
  {
    id: 'thunder',
    name: ['Arcurile cerului', 'Sky arches'],
    element: 'wind',
    materials: ['fiber', 'wood'],
    minutes: [240, 300, 360, 420, 480],
    x: 45,
    y: 20,
  },
  {
    id: 'twilight',
    name: ['Pădurea șoaptelor', 'Whispering wood'],
    element: 'dark',
    materials: ['crystal', 'stone'],
    minutes: [270, 330, 390, 450, 510],
    x: 14,
    y: 48,
  },
  {
    id: 'dawn',
    name: ['Templul zorilor', 'Temple of dawn'],
    element: 'light',
    materials: ['crystal', 'stone'],
    minutes: [300, 360, 420, 480, 540],
    x: 49,
    y: 85,
  },
  {
    id: 'sigils',
    name: ['Sanctuarul runelor', 'Rune sanctuary'],
    element: 'arcane',
    materials: ['crystal', 'fiber'],
    minutes: [360, 420, 480, 540, 600],
    x: 64,
    y: 45,
  },
];
/** Stages in every region. */
export const REGION_STAGES = 5;
/** A region's place in the chain, 1 to 10 (0 for an unknown id). */
export const regionNumber = (id: string) => REGIONS.findIndex((r) => r.id === id) + 1;
/** Level every team member needs for stage `stage` (1 to 5) of region `region` (1 to 10): 10 up to 50. */
export const stageLevel = (region: number, stage: number) => 10 + 4 * (region - 1) + (stage - 1);
/** Team members a region's stages take: one in the first two regions, two up to the fifth, then three. */
export const regionTeamSize = (region: number) => (region <= 2 ? 1 : region <= 5 ? 2 : 3);
/**
 * Arena leagues follow the worlds' unlock order: fire (open from the start), water, earth, nature, ice, lightning,
 * wind, dark, light, arcane. Each league opens with its world and has three tiers. League `r` (1 to 10) starts at
 * level `10 + 4(r − 1)` and its tiers fight at B, B+2 and B+4: fire 10/12/14 up to the arcane champion at 50.
 * `materials` is what a first win in its first tier brings.
 */
const LEAGUES: [string, [string, string], Partial<Inventory>][] = [
  ['fire', ['Liga jarului', 'Ember league'], { wood: 15, stone: 10 }],
  ['water', ['Liga mareelor', 'Tide league'], { fiber: 15, crystal: 5 }],
  ['earth', ['Liga stâncilor', 'Stone league'], { stone: 25 }],
  ['nature', ['Liga junglei', 'Jungle league'], { wood: 20, fiber: 15 }],
  ['ice', ['Liga gheții', 'Frost league'], { stone: 15, crystal: 10 }],
  ['lightning', ['Liga tunetului', 'Thunder league'], { crystal: 15, wood: 10 }],
  ['wind', ['Liga vânturilor', 'Gale league'], { fiber: 20, wood: 10 }],
  ['dark', ['Liga umbrelor', 'Shadow league'], { crystal: 20, stone: 10 }],
  ['light', ['Liga zorilor', 'Dawn league'], { crystal: 20, wood: 15, stone: 15 }],
  ['arcane', ['Liga sigiliilor', 'Sigil league'], { crystal: 30, stone: 20 }],
];
/** The base level of a league (1 to 10): 10, 14, 18 … 46. */
export const leagueBaseLevel = (league: number) => 10 + 4 * (league - 1);
/** A league's place in the chain, 1 to 10 (0 for an unknown element). */
export const leagueNumber = (element: string) => LEAGUES.findIndex(([id]) => id === element) + 1;
const TIERS: [string, string][] = [
  ['Ucenic', 'Apprentice'],
  ['Veteran', 'Veteran'],
  ['Campion', 'Champion'],
];
/** Each tier pays half again as much as the one before it: ×1, ×1.5, ×2. */
export const tierRewardScale = (tier: number) => 1 + 0.5 * (tier - 1);
ENCOUNTERS.push(
  ...LEAGUES.flatMap(([league, name, materials], r) =>
    TIERS.map((tier, t): Encounter => {
      const level = leagueBaseLevel(r + 1) + t * 2,
        scale = tierRewardScale(t + 1);
      return {
        id: `arena-${league}-${t + 1}`,
        name: [`${name[0]} · ${tier[0]}`, `${name[1]} · ${tier[1]}`],
        mode: 'arena',
        league,
        level,
        ...(t ? { requires: `arena-${league}-${t}` } : {}),
        gold: Math.round(20 * level * scale),
        food: Math.round(8 * level * scale),
        materials: Object.fromEntries(Object.entries(materials).map(([id, n]) => [id, Math.round(n! * scale)])),
        x: 0,
        y: 0,
        image: league,
      };
    }),
  ),
);
