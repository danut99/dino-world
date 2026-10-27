import { describe, expect, it } from 'vitest';
import {
  command,
  dinoStats,
  freePoints,
  newSave,
  parseSave,
  RARITY_POWER,
  RESET_COST,
  statPoints,
  stats,
  SPECIES,
  RARITIES,
  type Command,
  type Save,
  type Stage,
} from './game';

const now = 1_800_000_000_000;
const run = (s: Save, ...cs: Command[]) => cs.reduce((x, c) => command(x, c, now), s);
/** Ignis hatched and grown to `level`. */
function withIgnis(level: number, stage: Stage): Save {
  const s = run(newSave(now), { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' });
  Object.assign(s.dinos[0], { level, stage });
  s.gold = 10_000;
  return s;
}
const stageOf = (level: number): Stage => (level < 10 ? 'baby' : level < 25 ? 'juvenile' : 'adult');
/** The T-Rex before stat points: 6% a level on every stat. */
function oldTrex(level: number, stage: Stage, rarity: (typeof RARITIES)[number]) {
  const f = (1 + 0.06 * (level - 10)) * (stage === 'adult' ? 1.05 : 1) * RARITY_POWER[rarity];
  return {
    hp: Math.round(220 * f),
    power: Math.round(40 * 1.1 * f),
    defense: Math.round(20 * f),
    speed: Math.round(25 * 0.9),
  };
}

describe('stat points', () => {
  it('counts one point a level above 1 and three per evolution', () => {
    expect(statPoints({ level: 1, stage: 'baby' })).toBe(0);
    expect(statPoints({ level: 9, stage: 'baby' })).toBe(8);
    expect(statPoints({ level: 10, stage: 'juvenile' })).toBe(12);
    expect(statPoints({ level: 25, stage: 'adult' })).toBe(30);
    expect(statPoints({ level: 50, stage: 'adult' })).toBe(55);
  });

  it('gives an even spread (or no spending) exactly the old stats', () => {
    for (const species of SPECIES)
      for (const rarity of RARITIES)
        for (let level = 1; level <= 50; level++) {
          const stage = stageOf(level),
            third = Math.floor(statPoints({ level, stage }) / 3),
            even = { hp: third, power: third, defense: third },
            plain = stats(level, stage, species, rarity);
          if (species === 'trex') expect(plain).toEqual(oldTrex(level, stage, rarity));
          expect(stats(level, stage, species, rarity, even)).toEqual(plain);
        }
    expect(stats(20, 'juvenile').hp).toBe(Math.round(220 * 1.6));
    expect(stats(10, 'juvenile', 'trex', 'common', { hp: 4, power: 4, defense: 4 })).toEqual(stats(10, 'juvenile'));
  });

  it('moves stats between health, power and defense when specialised', () => {
    const plain = stats(20, 'juvenile'),
      tank = stats(20, 'juvenile', 'trex', 'common', { hp: 22, power: 0, defense: 0 });
    expect(tank.hp).toBeGreaterThan(plain.hp);
    expect(tank.power).toBeLessThan(plain.power);
    expect(tank.defense).toBeLessThan(plain.defense);
    expect(tank.speed).toBe(plain.speed);
    // Each point is worth 9% of the level-10 base on its stat.
    expect(tank.hp).toBe(Math.round(220 * (1.6 + 0.09 * (22 - 22 / 3))));
  });

  it('allocates free points and resets them for gold', () => {
    let s = withIgnis(12, 'juvenile');
    const d = () => s.dinos[0];
    expect(freePoints(d())).toBe(14);
    s = run(s, { type: 'allocate', dinoId: 'ignis', stat: 'power', amount: 10 });
    s = run(s, { type: 'allocate', dinoId: 'ignis', stat: 'hp' });
    expect(d().points).toEqual({ hp: 1, power: 10, defense: 0 });
    expect(freePoints(d())).toBe(3);
    expect(dinoStats(d()).power).toBeGreaterThan(stats(12, 'juvenile').power);
    expect(() => run(s, { type: 'allocate', dinoId: 'ignis', stat: 'defense', amount: 4 })).toThrow('points');
    expect(() => run(s, { type: 'allocate', dinoId: 'ignis', stat: 'defense', amount: 0 })).toThrow('points');
    const gold = s.gold;
    s = run(s, { type: 'resetPoints', dinoId: 'ignis' });
    expect(d().points).toBeUndefined();
    expect(s.gold).toBe(gold - RESET_COST(d()));
    expect(() => run(s, { type: 'resetPoints', dinoId: 'ignis' })).toThrow('points');
    s = run(s, { type: 'allocate', dinoId: 'ignis', stat: 'hp' });
    s.gold = 0;
    expect(() => run(s, { type: 'resetPoints', dinoId: 'ignis' })).toThrow('gold');
  });

  it('accepts old saves without points and rejects over-allocation', () => {
    const s = withIgnis(12, 'juvenile');
    expect(parseSave(JSON.stringify(s)).dinos[0].points).toBeUndefined();
    s.dinos[0].points = { hp: 14, power: 0, defense: 0 };
    expect(parseSave(JSON.stringify(s)).dinos[0].points).toEqual({ hp: 14, power: 0, defense: 0 });
    s.dinos[0].points = { hp: 14, power: 1, defense: 0 };
    expect(() => parseSave(JSON.stringify(s))).toThrow();
    s.dinos[0].points = { hp: -1, power: 1, defense: 0 };
    expect(() => parseSave(JSON.stringify(s))).toThrow();
    s.dinos[0].points = { hp: 1.5, power: 1, defense: 0 };
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
});
