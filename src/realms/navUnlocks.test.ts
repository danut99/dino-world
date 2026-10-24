import { describe, expect, it } from 'vitest';
import { newSave, type Save } from './game';
import { NAV_KEYS, unlockedNav } from './navUnlocks';

const ignis = (stage: 'baby' | 'juvenile' = 'baby') =>
  ({ id: 'ignis', species: 'trex', element: 'fire', level: stage === 'baby' ? 1 : 10, stage, nickname: 'Ignis' }) as Save['dinos'][number];

describe('bottom bar unlocks', () => {
  it('starts with only the worlds, then opens one step at a time', () => {
    const s = newSave(0);
    expect([...unlockedNav(s)]).toEqual(['realms']);
    s.dinos = [ignis()];
    expect([...unlockedNav(s)].sort()).toEqual(['build', 'collect', 'dino', 'realms']);
    s.dinos = [ignis('juvenile')];
    expect(unlockedNav(s).has('expedition')).toBe(true);
    expect(unlockedNav(s).has('collection')).toBe(false);
    s.cleared = ['training'];
    expect(unlockedNav(s).has('collection')).toBe(true);
    expect(unlockedNav(s).has('arena')).toBe(false);
    s.buildings.push({ id: 'arena', kind: 'arena', x: 7, y: 7 });
    s.buildings.push({ id: 'workshop', kind: 'workshop', x: 6, y: 1 });
    expect([...unlockedNav(s)].sort()).toEqual([...NAV_KEYS].sort());
  });
  it('always shows the button the story card points to', () => {
    expect(unlockedNav(newSave(0), 'build').has('build')).toBe(true);
    expect([...unlockedNav(newSave(0), 'hatchery')]).toEqual(['realms']);
  });
});
