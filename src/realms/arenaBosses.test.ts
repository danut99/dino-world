import { expect, it } from 'vitest';
import { ENCOUNTERS } from './content';
import { ELEMENTS, SPECIES } from './game';
import { ARENA_BOSSES, arenaBoss } from './arenaBosses';

it('assigns all ten bosses only to the champion encounter of their world', () => {
  expect(Object.values(ARENA_BOSSES)).toHaveLength(10);
  expect(ARENA_BOSSES.lightning.name).toBe('Zevoltus');
  for (const element of ELEMENTS) {
    const boss = ARENA_BOSSES[element.id];
    expect(SPECIES).toContain(boss.species);
    for (let tier = 1; tier <= 3; tier++) {
      const encounter = ENCOUNTERS.find(e => e.id === `arena-${element.id}-${tier}`)!;
      expect(arenaBoss(encounter)).toEqual(tier === 3 ? boss : undefined);
    }
  }
  expect(ENCOUNTERS.every(e => e.mode === 'arena')).toBe(true);
});

it('sends the boss in last, after the two regular champions-tier foes', async () => {
  const { arenaFoes } = await import('./arenaTeams');
  for (const element of ELEMENTS) {
    const foes = arenaFoes(`arena-${element.id}-3`);
    expect(foes.map((f) => !!f.boss)).toEqual([false, false, true]);
    expect(foes.at(-1)!.element).toBe(element.id);
    expect(arenaFoes(`arena-${element.id}-1`).some((f) => f.boss)).toBe(false);
    expect(arenaFoes(`arena-${element.id}-2`).some((f) => f.boss)).toBe(false);
  }
});
