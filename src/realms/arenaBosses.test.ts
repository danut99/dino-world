import { expect, it } from 'vitest';
import { ENCOUNTERS } from './content';
import { ELEMENTS, SPECIES } from './game';
import { ARENA_BOSSES, arenaBoss } from './arenaBosses';

it('assigns all ten animated bosses only to the champion encounter of their world', () => {
  expect(Object.values(ARENA_BOSSES).filter(b => b.animated)).toHaveLength(10);
  expect(ARENA_BOSSES.lightning.name).toBe('Zevoltus');
  expect(Object.values(ARENA_BOSSES).filter(b => b.animated).every(b => !b.art)).toBe(true);
  for (const [index, element] of ELEMENTS.entries()) {
    const boss = ARENA_BOSSES[element.id];
    expect(SPECIES).toContain(boss.species);
    for (let tier = 1; tier <= 3; tier++) {
      const encounter = ENCOUNTERS.find(e => e.id === `arena-${element.id}-${tier}`)!;
      expect(arenaBoss(encounter)).toEqual(tier === 3 ? boss : undefined);
    }
  }
  expect(ENCOUNTERS.filter(e => e.mode === 'expedition').every(e => !arenaBoss(e))).toBe(true);
});
