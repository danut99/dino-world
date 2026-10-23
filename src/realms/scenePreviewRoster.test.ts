import { describe, expect, it } from 'vitest';
import inventory from './animation-inventory.json';
import { PLAYABLE_DINOSAURS } from './playableDinosaurs';
import { ANIMATED_BOSS_ELEMENTS } from './animation';
import {
  BOSSES,
  ROSTER,
  combatant,
  combatantId,
  combatantName,
  combatantStage,
  defaultOpponent,
  habitatResidents,
  previewSave,
  rosterEntry,
} from './scenePreviewRoster';

describe('scene preview roster', () => {
  it('lists every playable family at all three stages, each backed by a produced animation', () => {
    expect(ROSTER).toHaveLength(PLAYABLE_DINOSAURS.length * 3);
    expect(new Set(ROSTER.map((e) => e.id)).size).toBe(ROSTER.length);
    for (const entry of ROSTER) expect(inventory).toContain(entry.id);
  });
  it('lists every animated champion, fighting as an adult', () => {
    expect(BOSSES.map((b) => b.element)).toEqual([...ANIMATED_BOSS_ELEMENTS]);
    for (const b of BOSSES) {
      const c = combatant(b.id)!;
      expect(combatantStage(c)).toBe('adult');
      expect(combatantName(c, 0)).toBe(`BOSS ${b.name}`);
    }
  });
  it('resolves ids from the URL for dinosaurs and bosses, and rejects unknown ones', () => {
    expect(rosterEntry('trex_fire_adult')).toMatchObject({ species: 'trex', element: 'fire', stage: 'adult' });
    expect(rosterEntry('trex_fire_elder')).toBeUndefined();
    expect(combatant('boss_fire')).toMatchObject({ kind: 'boss', element: 'fire' });
    expect(combatant('boss_lava')).toBeUndefined();
    expect(BOSSES.every((b) => combatantId(combatant(b.id)!) === b.id)).toBe(true);
  });
  it('picks a sparring partner from another family at the same stage', () => {
    const ally = combatant('trex_fire_juvenile')!;
    const foe = defaultOpponent(ally);
    expect(foe.kind).toBe('dino');
    if (foe.kind === 'dino') {
      expect(foe.entry.stage).toBe('juvenile');
      expect(foe.entry.id).not.toBe(combatantId(ally));
    }
    const sparring = defaultOpponent(combatant('boss_water')!);
    expect(sparring.kind === 'dino' && sparring.entry.stage).toBe('adult');
  });
});

describe('habitat preview save', () => {
  const entry = rosterEntry('triceratops_nature_adult')!;
  it('shows only the chosen dinosaur by default', () => {
    expect(habitatResidents(entry, {}, 0)).toEqual([
      expect.objectContaining({ species: 'triceratops', element: 'nature', stage: 'adult', nickname: 'Adult' }),
    ]);
  });
  it('can add the siblings and the realm neighbours, all living in the previewed realm', () => {
    const all = habitatResidents(entry, { allStages: true, allFamilies: true }, 1);
    expect(all.length).toBe(3 * PLAYABLE_DINOSAURS.filter((d) => d.element === 'nature').length);
    expect(all.every((d) => d.element === 'nature')).toBe(true);
    expect(new Set(all.map((d) => d.id)).size).toBe(all.length);
  });
  it('builds a bare save: no buildings or eggs, the residents as the only dinosaurs', () => {
    const save = previewSave(habitatResidents(entry, { allStages: true }, 0));
    expect(save.buildings).toEqual([]);
    expect(save.eggs).toEqual([]);
    expect(save.habitats).toEqual({});
    expect(save.dinos.map((d) => d.stage)).toEqual(['baby', 'juvenile', 'adult']);
    expect(save.champion).toBe(save.dinos[0].id);
  });
});
