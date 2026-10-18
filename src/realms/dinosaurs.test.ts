import { describe, expect, it } from 'vitest';
import { DINOSAURS, STAGES, worldResidents } from './dinosaurs';
import { isPlayableDinosaur } from './playableDinosaurs';
import inventory from './animation-inventory.json';
import { command, newSave, parseSave, QUEST_EGGS } from './game';
import { ENCOUNTERS } from './content';
import { opponentOf } from './GameplayScreens';

describe('animated dinosaur catalog', () => {
  it('exposes only families with an animation manifest for every age', () => {
    expect(DINOSAURS.length).toBeGreaterThan(0);
    expect(new Set(DINOSAURS.map(d => d.id)).size).toBe(DINOSAURS.length);
    for (const d of DINOSAURS) {
      for (const stage of STAGES) expect(inventory).toContain(`${d.id}_${stage}`);
      expect(worldResidents(d.element)).toContain(d);
    }
    expect(isPlayableDinosaur('ankylosaurus', 'fire')).toBe(false);
    for (const q of QUEST_EGGS) if (q.species && q.element)
      expect(isPlayableDinosaur(q.species, q.element)).toBe(true);
  });
  it('removes retired dinosaurs and eggs from valid old saves while preserving progress', () => {
    const s = newSave(1_800_000_000_000);
    s.dinos = [
      { id: 'old', species: 'ankylosaurus', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Old' },
      { id: 'kept', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' },
    ];
    s.champion = 'old';
    s.eggs.push({ id: 'old-egg', species: 'brachiosaurus', element: 'fire', seconds: 300, hatchAt: null });
    s.owedEggs = [{ species: 'ankylosaurus', element: 'fire' }];
    const loaded = parseSave(JSON.stringify(s));
    expect(loaded.dinos.map(d => d.id)).toEqual(['kept']);
    expect(loaded.champion).toBe('kept');
    expect(loaded.eggs.map(e => e.id)).toEqual(['egg-ignis']);
    expect(loaded.owedEggs).toEqual([]);
    expect(loaded.gold).toBe(s.gold);
    expect(loaded.food).toBe(s.food);
    expect(parseSave(JSON.stringify(loaded))).toEqual(loaded);
  });
  it('uses animated opponents and refuses purchases of retired families', () => {
    for (const encounter of ENCOUNTERS) {
      const d = opponentOf(encounter);
      expect(isPlayableDinosaur(d.species, d.element)).toBe(true);
    }
    const now = 1_800_000_000_000;
    let s = command(newSave(now), { type: 'devResources' }, now);
    s = command(s, { type: 'build', kind: 'market', x: 6, y: 1 }, now);
    expect(() => command(s, { type: 'buyEgg', species: 'ankylosaurus', element: 'fire' }, now)).toThrow('egg');
    expect(command(s, { type: 'buyEgg', species: 'trex', element: 'fire' }, now).eggs.at(-1)?.species).toBe('trex');
  });
  it('clears a live battle when its retired champion is removed', () => {
    const now = 1_800_000_000_000;
    const s = newSave(now);
    s.eggs = [];
    s.dinos = [{ id: 'old', species: 'ankylosaurus', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Old' }];
    s.champion = 'old';
    const fighting = command(s, { type: 'battle' }, now);
    const loaded = parseSave(JSON.stringify(fighting));
    expect(loaded.dinos).toEqual([]);
    expect(loaded.champion).toBeNull();
    expect(loaded.battle).toBeNull();
    expect(loaded.rewardPending).toBe(false);
    expect(() => parseSave(JSON.stringify(loaded))).not.toThrow();
  });
});
