import { expect, it } from 'vitest';
import { ENCOUNTERS } from './content';
import { opponentOf } from './GameplayScreens';
import { arenaBoss } from './arenaBosses';
import { isPlayableDinosaur } from './playableDinosaurs';
import { foeHasUltimate, opponentAdult } from './game';

it('uses a juvenile first and adults second and third in every arena league', () => {
  for (const e of ENCOUNTERS.filter(e => e.mode === 'arena')) {
    const adult = !e.id.endsWith('-1');
    expect(opponentAdult(e), e.id).toBe(adult);
    expect(opponentOf(e).stage, e.id).toBe(adult ? 'adult' : 'juvenile');
    expect(foeHasUltimate(e.id), e.id).toBe(adult);
  }
  expect(opponentAdult({ id: 'training', level: 1 })).toBe(false);
  expect(opponentAdult({ id: 'sigils', level: 25 })).toBe(true);
});

it('starts the nature arena with the juvenile nature Triceratops', () => {
  const e = ENCOUNTERS.find(e => e.id === 'arena-nature-1')!;
  expect(opponentOf(e)).toMatchObject({ species: 'triceratops', element: 'nature', stage: 'juvenile' });
});

it('uses two distinct playable dinosaurs then the boss in water and earth arenas', () => {
  for (const [realm, first, second, boss] of [
    ['water', 'raptor', 'thalassaur', 'Thalassion'],
    ['earth', 'raptor', 'terrasaur', 'Terragor'],
  ]) {
    const encounters = [1, 2, 3].map(t => ENCOUNTERS.find(e => e.id === `arena-${realm}-${t}`)!);
    expect(encounters.slice(0, 2).map(e => opponentOf(e).species)).toEqual([first, second]);
    for (const e of encounters.slice(0, 2)) {
      const d = opponentOf(e);
      expect(d.element).toBe(realm);
      expect(isPlayableDinosaur(d.species, d.element)).toBe(true);
      expect(arenaBoss(e)).toBeUndefined();
    }
    expect(arenaBoss(encounters[2])?.name).toBe(boss);
  }
});
