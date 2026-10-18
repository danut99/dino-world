import { expect, it } from 'vitest';
import { ENCOUNTERS } from './content';
import { ELEMENTS, SPECIES } from './game';
import { ARENA_BOSSES, arenaBoss } from './arenaBosses';

it('assigns released bosses to their champions and keeps unreleased encounters unchanged', () => {
  expect(Object.values(ARENA_BOSSES).filter(b => b.animated)).toHaveLength(5);
  expect(ARENA_BOSSES.lightning.name).toBe('Zevoltus');
  expect(Object.values(ARENA_BOSSES).filter(b => b.animated).every(b => !b.art)).toBe(true);
  for (const [index, element] of ELEMENTS.entries()) {
    const boss = ARENA_BOSSES[element.id];
    expect(boss.species).toBe(SPECIES[(index + 4) % SPECIES.length]);
    for (let tier = 1; tier <= 3; tier++) {
      const encounter = ENCOUNTERS.find(e => e.id === `arena-${element.id}-${tier}`)!;
      expect(arenaBoss(encounter)).toEqual(tier === 3 && index < 6 ? boss : undefined);
    }
  }
  expect(ENCOUNTERS.filter(e => e.mode === 'expedition').every(e => !arenaBoss(e))).toBe(true);
});
