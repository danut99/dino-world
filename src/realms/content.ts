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
    cost: 200,
    icon: '⚒',
    description: ['Transformă materiale în obiecte utile.', 'Turn materials into useful items.'],
  },
  portal: {
    name: ['Portal de expediții', 'Expedition Portal'],
    cost: 250,
    icon: '◎',
    description: ['Explorează regiunile și câștigă materiale.', 'Explore regions and earn materials.'],
  },
  arena: {
    name: ['Poarta arenei', 'Arena Gate'],
    cost: 300,
    icon: '⚔',
    description: ['Înfruntă santinelele în arena PvE.', 'Challenge sentinels in the PvE arena.'],
  },
  market: {
    name: ['Piață', 'Market'],
    cost: 350,
    icon: '⚖',
    description: [
      'Cumpără ouă pentru lumile în care ai habitat.',
      'Buy eggs for the worlds where you have a habitat.',
    ],
  },
} as const;
export type UtilityKind = keyof typeof UTILITY_BUILDINGS;
export const ITEMS = {
  wood: { name: ['Lemn', 'Wood'], icon: '▰', color: '#bf905e' },
  stone: { name: ['Piatră', 'Stone'], icon: '◆', color: '#b6b7ad' },
  fiber: { name: ['Fibre', 'Fiber'], icon: '❧', color: '#a6c582' },
  crystal: { name: ['Cristale', 'Crystals'], icon: '♦', color: '#77d8e9' },
  planks: { name: ['Plăci', 'Planks'], icon: '▤', color: '#c79b65' },
  blocks: { name: ['Blocuri', 'Blocks'], icon: '▦', color: '#b7b3a6' },
  habitatKit: { name: ['Kit de habitat', 'Habitat kit'], icon: '⌂', color: '#b8c58e' },
  evolutionCrystal: { name: ['Cristal de evoluție', 'Evolution crystal'], icon: '✧', color: '#bca4ed' },
  lamp: { name: ['Lampă ornamentală', 'Ornamental lamp'], icon: '☼', color: '#e2bf76' },
} as const;
export type ItemId = keyof typeof ITEMS;
export type Inventory = Record<ItemId, number>;
export const initialInventory = (): Inventory => ({
  wood: 30,
  stone: 30,
  fiber: 20,
  crystal: 15,
  planks: 0,
  blocks: 0,
  habitatKit: 0,
  evolutionCrystal: 0,
  lamp: 0,
});
/**
 * Farm levels, as in Dino World: each level unlocks one more plot and multiplies the food of every harvest.
 * `gold` and `materials` are the price of reaching that level (level 1 comes with the building).
 */
export const FARM_LEVELS: {
  plots: number;
  yield: number;
  gold: number;
  materials: Partial<Record<ItemId, number>>;
}[] = [
  { plots: 1, yield: 1, gold: 0, materials: {} },
  { plots: 2, yield: 1.2, gold: 250, materials: {} },
  { plots: 3, yield: 1.4, gold: 600, materials: { planks: 4 } },
  { plots: 4, yield: 1.7, gold: 1200, materials: { planks: 6, blocks: 6 } },
  { plots: 5, yield: 2, gold: 2500, materials: { planks: 10, blocks: 10, crystal: 10 } },
];
/** Crops: more food costs more gold and takes longer. Better crops unlock at higher farm levels. */
export const CROPS = [
  { id: 'ferns', name: ['Ferigi', 'Ferns'], icon: '🌿', cost: 0, seconds: 60, food: 25, level: 1 },
  { id: 'cicadas', name: ['Cicade', 'Cicadas'], icon: '🦗', cost: 20, seconds: 5 * 60, food: 90, level: 1 },
  { id: 'ginkgo', name: ['Ginkgo', 'Ginkgo'], icon: '🍃', cost: 60, seconds: 20 * 60, food: 260, level: 2 },
  { id: 'meat', name: ['Carne afumată', 'Smoked meat'], icon: '🍖', cost: 150, seconds: 3600, food: 650, level: 3 },
  {
    id: 'amber',
    name: ['Fructe de chihlimbar', 'Amber fruit'],
    icon: '🍊',
    cost: 350,
    seconds: 3 * 3600,
    food: 1500,
    level: 4,
  },
  {
    id: 'feast',
    name: ['Ospăț preistoric', 'Primeval feast'],
    icon: '🥩',
    cost: 800,
    seconds: 8 * 3600,
    food: 3200,
    level: 5,
  },
] as const;
export type CropId = (typeof CROPS)[number]['id'];
export const RECIPES = [
  {
    id: 'planks',
    name: ['Plăci de construcție', 'Building planks'],
    cost: { wood: 10 },
    seconds: 30,
    output: 'planks',
    quantity: 2,
  },
  {
    id: 'blocks',
    name: ['Blocuri de piatră', 'Stone blocks'],
    cost: { stone: 10 },
    seconds: 30,
    output: 'blocks',
    quantity: 2,
  },
  {
    id: 'kit',
    name: ['Kit de habitat', 'Habitat kit'],
    cost: { planks: 4, blocks: 4, fiber: 5 },
    seconds: 120,
    output: 'habitatKit',
    quantity: 1,
  },
  {
    id: 'evolution',
    name: ['Cristal de evoluție', 'Evolution crystal'],
    cost: { crystal: 10, fiber: 10 },
    seconds: 300,
    output: 'evolutionCrystal',
    quantity: 1,
  },
  {
    id: 'lamp',
    name: ['Lampă ornamentală', 'Ornamental lamp'],
    cost: { blocks: 2, crystal: 2 },
    seconds: 60,
    output: 'lamp',
    quantity: 1,
  },
] satisfies {
  id: string;
  name: string[];
  cost: Partial<Inventory>;
  seconds: number;
  output: ItemId;
  quantity: number;
}[];
export interface Encounter {
  id: string;
  name: [string, string];
  mode: 'expedition' | 'arena';
  level: number;
  hp: number;
  power: number;
  requires?: string;
  gold: number;
  food: number;
  materials: Partial<Inventory>;
  x: number;
  y: number;
  image: string;
  /** Arena league: the element world that opens it. */
  league?: string;
}
export const ENCOUNTERS: Encounter[] = [
  {
    id: 'training',
    name: ['Poiana de antrenament', 'The training glade'],
    mode: 'expedition',
    level: 10,
    hp: 180,
    power: 30,
    gold: 250,
    food: 150,
    materials: { wood: 15, stone: 10, fiber: 5 },
    x: 20,
    y: 75,
    image: 'nature',
  },
  {
    id: 'ruins',
    name: ['Ruinele străvechi', 'Ancient ruins'],
    mode: 'expedition',
    level: 10,
    hp: 230,
    power: 34,
    requires: 'training',
    gold: 200,
    food: 100,
    materials: { wood: 20, stone: 15, crystal: 5 },
    x: 37,
    y: 62,
    image: 'earth',
  },
  {
    id: 'canyon',
    name: ['Pasul canionului', 'Canyon crossing'],
    mode: 'expedition',
    level: 12,
    hp: 300,
    power: 38,
    requires: 'ruins',
    gold: 275,
    food: 125,
    materials: { stone: 25, fiber: 15, crystal: 8 },
    x: 78,
    y: 23,
    image: 'fire',
  },
  {
    id: 'frost',
    name: ['Coroana de gheață', 'The frozen crown'],
    mode: 'expedition',
    level: 15,
    hp: 380,
    power: 42,
    requires: 'canyon',
    gold: 350,
    food: 175,
    materials: { crystal: 20, fiber: 20 },
    x: 20,
    y: 18,
    image: 'ice',
  },
  {
    id: 'lagoon',
    name: ['Reciful de safir', 'Sapphire reef'],
    mode: 'expedition',
    level: 11,
    hp: 260,
    power: 34,
    requires: 'ruins',
    gold: 220,
    food: 100,
    materials: { crystal: 10, fiber: 15 },
    x: 65,
    y: 75,
    image: 'water',
  },
  {
    id: 'wind',
    name: ['Arcurile cerului', 'Sky arches'],
    mode: 'expedition',
    level: 12,
    hp: 290,
    power: 36,
    requires: 'ruins',
    gold: 250,
    food: 125,
    materials: { wood: 20, fiber: 20 },
    x: 45,
    y: 20,
    image: 'wind',
  },
  {
    id: 'thunder',
    name: ['Turnul furtunii', 'Storm spire'],
    mode: 'expedition',
    level: 16,
    hp: 390,
    power: 43,
    requires: 'canyon',
    gold: 375,
    food: 175,
    materials: { crystal: 25, stone: 20 },
    x: 86,
    y: 44,
    image: 'lightning',
  },
  {
    id: 'twilight',
    name: ['Pădurea șoaptelor', 'Whispering forest'],
    mode: 'expedition',
    level: 14,
    hp: 340,
    power: 39,
    requires: 'ruins',
    gold: 300,
    food: 150,
    materials: { wood: 25, fiber: 25 },
    x: 14,
    y: 48,
    image: 'dark',
  },
  {
    id: 'dawn',
    name: ['Templul zorilor', 'Temple of dawn'],
    mode: 'expedition',
    level: 17,
    hp: 420,
    power: 44,
    requires: 'lagoon',
    gold: 400,
    food: 200,
    materials: { crystal: 25, stone: 25 },
    x: 49,
    y: 85,
    image: 'light',
  },
  {
    id: 'sigils',
    name: ['Sanctuarul runelor', 'Rune sanctuary'],
    mode: 'expedition',
    level: 20,
    hp: 500,
    power: 48,
    requires: 'dawn',
    gold: 500,
    food: 250,
    materials: { crystal: 30, fiber: 25 },
    x: 64,
    y: 45,
    image: 'arcane',
  },
];
/**
 * Arena leagues follow the worlds' unlock order: fire (open from the start), water, earth, nature, ice, lightning,
 * wind, dark, light, arcane. Each league opens with its world and has three tiers, harder league by league.
 */
const LEAGUES: [string, [string, string], number, Partial<Inventory>][] = [
  ['fire', ['Liga jarului', 'Ember league'], 10, { wood: 15, stone: 10 }],
  ['water', ['Liga mareelor', 'Tide league'], 11, { fiber: 15, crystal: 5 }],
  ['earth', ['Liga stâncilor', 'Stone league'], 12, { stone: 25 }],
  ['nature', ['Liga junglei', 'Jungle league'], 13, { wood: 20, fiber: 15 }],
  ['ice', ['Liga gheții', 'Frost league'], 15, { stone: 15, crystal: 10 }],
  ['lightning', ['Liga tunetului', 'Thunder league'], 16, { crystal: 15, planks: 2 }],
  ['wind', ['Liga vânturilor', 'Gale league'], 17, { fiber: 20, planks: 2 }],
  ['dark', ['Liga umbrelor', 'Shadow league'], 19, { crystal: 20, blocks: 2 }],
  ['light', ['Liga zorilor', 'Dawn league'], 21, { crystal: 20, planks: 3, blocks: 3 }],
  ['arcane', ['Liga sigiliilor', 'Sigil league'], 23, { crystal: 30, blocks: 4 }],
];
const TIERS: [string, string][] = [
  ['Ucenic', 'Apprentice'],
  ['Veteran', 'Veteran'],
  ['Campion', 'Champion'],
];
ENCOUNTERS.push(
  ...LEAGUES.flatMap(([league, name, base, materials]) =>
    TIERS.map((tier, t): Encounter => {
      const level = base + t * 2;
      return {
        id: `arena-${league}-${t + 1}`,
        name: [`${name[0]} · ${tier[0]}`, `${name[1]} · ${tier[1]}`],
        mode: 'arena',
        league,
        level,
        hp: 180 + level * 14 + t * 40,
        power: Math.round(24 + level * 1.3 + t * 2),
        ...(t ? { requires: `arena-${league}-${t}` } : {}),
        gold: 120 + level * 12 + t * 60,
        food: 60 + level * 6 + t * 20,
        materials: Object.fromEntries(
          Object.entries(materials).map(([id, n]) => [id, Math.round(n! * (1 + t * 0.5))]),
        ),
        x: 0,
        y: 0,
        image: league,
      };
    }),
  ),
);
