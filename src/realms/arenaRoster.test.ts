import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from './content';
import { arenaFoes, arenaTier, foeHasUltimate, roundCap, teamReward } from './arenaTeams';
import { ARENA_BOSSES } from './arenaBosses';
import { isPlayableDinosaur } from './playableDinosaurs';
import { stats } from './game';

describe('arena opponents', () => {
  it('fields two apprentices, three adult veterans, then two adults and the boss', () => {
    for (const e of ENCOUNTERS) {
      const foes = arenaFoes(e.id),
        tier = arenaTier(e.id);
      expect(foes.length, e.id).toBe(tier === 2 ? 3 : tier === 3 ? 3 : 2);
      for (const f of foes) {
        expect(f.element, e.id).toBe(e.league);
        expect(f.level, e.id).toBe(e.level);
        expect(f.hp).toBe(f.maxHp);
        if (!f.boss) expect(isPlayableDinosaur(f.species, f.element), `${e.id} ${f.species}`).toBe(true);
      }
      // Apprentices are juveniles until level 25; every other tier fights with adults.
      const regular = foes.filter((f) => !f.boss);
      expect(regular.every((f) => f.stage === (tier === 1 && e.level < 25 ? 'juvenile' : 'adult')), e.id).toBe(true);
      expect(foes.every((f) => foeHasUltimate(f) === (f.stage === 'adult' || !!f.boss))).toBe(true);
    }
  });
  it('builds every foe with the same stats as the player, scaled by its tier', () => {
    const [a] = arenaFoes('arena-fire-1');
    const base = stats(10, 'juvenile', a.species, 'common');
    expect(a.maxHp).toBe(Math.round(base.hp * 0.85));
    expect(a.power).toBe(Math.round(base.power * 0.85));
    expect(a.defense).toBe(base.defense);
    // The same encounter always fields the same team, so a saved fight can be checked against it.
    expect(arenaFoes('arena-fire-1')).toEqual(arenaFoes('arena-fire-1'));
    expect(arenaFoes('training')).toEqual([]);
  });
  it('uses both families of the league in turn', () => {
    expect(arenaFoes('arena-nature-1').map((f) => f.species)).toEqual(['brachiosaurus', 'triceratops']);
    expect(new Set(arenaFoes('arena-water-2').map((f) => f.species))).toEqual(new Set(['raptor', 'thalassaur']));
  });
  it('caps a fight at 25 rounds per opponent and pays more for bigger teams', () => {
    expect(roundCap(2)).toBe(50);
    expect(roundCap(3)).toBe(75);
    expect([1, 2, 3].map(teamReward)).toEqual([1, 1.1, 1.2]);
  });
  it('closes every champion tier with its league boss, legendary and tougher than the rest', () => {
    for (const e of ENCOUNTERS.filter((x) => x.id.endsWith('-3'))) {
      const foes = arenaFoes(e.id),
        boss = foes.at(-1)!;
      expect(boss.boss, e.id).toBe(true);
      expect(foes.filter((f) => f.boss)).toHaveLength(1);
      expect(boss).toMatchObject({ species: 'boss', rarity: 'legendary', stage: 'adult', element: e.league });
      expect(ARENA_BOSSES[boss.element]).toBeDefined();
      expect(boss.maxHp).toBeGreaterThan(foes[0].maxHp);
      expect(boss.power).toBeGreaterThan(foes[0].power);
    }
  });
});
