import { ENCOUNTERS, leagueNumber } from './content';
import { ARENA_BOSSES } from './arenaBosses';
import { playableSpecies, PLAYABLE_DINOSAURS } from './playableDinosaurs';
import { stats, type Rarity, type RealmId, type Species, type Stage } from './game';

/**
 * One opponent of an arena team, with its stats fixed when the fight starts. Foes use the same `stats()` as the
 * player's dinosaurs, scaled by their tier (see FOE_TIERS). `hp` is what is left of `maxHp`.
 */
export interface Foe {
  species: Species;
  element: RealmId;
  stage: Stage;
  level: number;
  rarity: Rarity;
  hp: number;
  maxHp: number;
  power: number;
  defense: number;
  speed: number;
  /** The league boss: always last, and always legendary. */
  boss?: true;
  /** A tank's half-damage first blow is spent. */
  shieldUsed?: true;
  /** A support's one heal is spent. */
  healed?: true;
}

/**
 * The opposing team of each tier, tuned by `arenaBalance.test.ts`:
 * - Apprentice: two foes, juvenile until level 25;
 * - Veteran: three adult foes;
 * - Champion: two adult foes, then the league boss (legendary, much tougher).
 * `hp` and `power` multiply the stats every foe would have at the tier's level.
 */
export const FOE_TIERS: { count: number; hp: number; power: number; adult: boolean }[] = [
  { count: 2, hp: 0.85, power: 0.85, adult: false },
  { count: 3, hp: 1.08, power: 1.08, adult: true },
  { count: 2, hp: 0.85, power: 0.85, adult: true },
];
/** The boss closing a Champion tier: its stats at the tier's level (legendary, boss species), times these. */
export const BOSS_STATS = { hp: 1.2, power: 1.05 };
/** Fights end in a draw after this many rounds per opponent. */
export const ROUNDS_PER_FOE = 25;
/** Rewards grow with the team that fought: one, two or three dinosaurs. */
export const TEAM_REWARD = [1, 1.1, 1.2] as const;
export const teamReward = (size: number) => TEAM_REWARD[Math.min(3, Math.max(1, Math.round(size))) - 1];
/** An arena encounter's tier (1 to 3), or 0 when the id is not an arena fight. */
export const arenaTier = (encounterId: string) => Number(/^arena-[a-z]+-([123])$/.exec(encounterId)?.[1] ?? 0);
/** The most rounds a fight against `foes` opponents can last before it is a draw. */
export const roundCap = (foes: number) => ROUNDS_PER_FOE * foes;

/** The species of the `i`-th regular foe of a league: its world's two playable families, in turn. */
function foeSpecies(league: RealmId, tier: number, i: number): Species {
  const own = playableSpecies(league);
  const pool = own.length ? own : PLAYABLE_DINOSAURS.map((d) => d.species);
  return pool[(i + tier - 1) % pool.length];
}

/**
 * The opponents of an arena encounter, in the order they enter. Empty for an unknown id. The result is the same
 * every time for the same id, so a saved fight can be checked against it.
 */
export function arenaFoes(encounterId: string): Foe[] {
  const encounter = ENCOUNTERS.find((e) => e.id === encounterId),
    tier = arenaTier(encounterId);
  if (!encounter || !tier || !leagueNumber(encounter.league ?? '')) return [];
  const league = encounter.league as RealmId,
    spec = FOE_TIERS[tier - 1],
    level = encounter.level;
  const make = (species: Species, stage: Stage, rarity: Rarity, hp: number, power: number, boss?: true): Foe => {
    const st = stats(level, stage, species, rarity),
      maxHp = Math.max(1, Math.round(st.hp * hp));
    return {
      species,
      element: league,
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
  const stage: Stage = spec.adult || level >= 25 ? 'adult' : 'juvenile';
  const foes = Array.from({ length: spec.count }, (_, i) =>
    make(foeSpecies(league, tier, i), stage, 'common', spec.hp, spec.power),
  );
  if (tier === 3 && ARENA_BOSSES[league])
    foes.push(make('boss', 'adult', 'legendary', BOSS_STATS.hp, BOSS_STATS.power, true));
  return foes;
}
/** Whether a foe owns an ultimate: adults and bosses do. */
export const foeHasUltimate = (foe: Pick<Foe, 'stage' | 'boss'>) => foe.stage === 'adult' || !!foe.boss;
