import { describe, expect, it } from 'vitest';
import { COLLECTION, command, familyId, newSave, parseSave, type Save } from './game';
import { PLAYABLE_DINOSAURS } from './playableDinosaurs';

const now = 1_800_000_000_000;
/** A team ready for the last stage of the nature region (Fern glade), which always brings a nature egg. */
function explorer(discovered: string[]): Save {
  const s = newSave(now);
  s.dinos = [
    { id: 'd', species: 'trex', element: 'fire', level: 30, stage: 'adult', nickname: 'T' },
    { id: 'i', species: 'ignasaur', element: 'fire', level: 30, stage: 'adult', nickname: 'I' },
  ];
  s.champion = 'd';
  s.team = ['d'];
  s.habitats = { fire: 1, nature: 1 };
  s.expeditionProgress = { training: 5, ruins: 5, canyon: 5, frost: 4 };
  s.buildings.push({ id: 'p', kind: 'portal', x: 6, y: 1 });
  s.portalLevel = 1;
  s.discovered = discovered;
  return s;
}
/** Share of nature eggs that are brachiosaurs, over many departures. */
function brachioShare(discovered: string[]) {
  let brachio = 0,
    eggs = 0;
  for (let i = 0; i < 400; i++) {
    const s = explorer(discovered);
    s.revision = i;
    s.inventory.provisions = 9;
    const egg = command(s, { type: 'expedition', regionId: 'frost', team: ['d', 'i'] }, now + i * 1000).expeditions[0].reward.egg!;
    expect(egg.element).toBe('nature');
    eggs++;
    if (egg.species === 'brachiosaurus') brachio++;
  }
  return brachio / eggs;
}

describe('collection', () => {
  it('counts thirty entries: twenty families and ten bosses', () => {
    expect(PLAYABLE_DINOSAURS).toHaveLength(20);
    expect(COLLECTION).toHaveLength(30);
    expect(new Set(COLLECTION).size).toBe(30);
    expect(COLLECTION.filter((id) => id.startsWith('boss_'))).toHaveLength(10);
    expect(COLLECTION).toContain(familyId({ species: 'trex', element: 'fire' }));
  });
  it('records every family hatched and keeps it after the dinosaur is released', () => {
    let s = command(newSave(now), { type: 'incubate' }, now);
    s = command(s, { type: 'hatch' }, now + 30_000);
    s.eggs.push({ id: 'e', species: 'ignasaur', element: 'fire', seconds: 600, hatchAt: null });
    s = command(s, { type: 'incubate', eggId: 'e' }, now + 30_000);
    s = command(s, { type: 'hatch', eggId: 'e' }, now + 630_000);
    expect(s.discovered).toEqual(['trex_fire', 'ignasaur_fire']);
    s = command(s, { type: 'releaseDino', dinoId: s.dinos[1].id }, now + 630_000);
    expect(s.dinos).toHaveLength(1);
    expect(s.discovered).toEqual(['trex_fire', 'ignasaur_fire']);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    expect(() => parseSave(JSON.stringify({ ...s, discovered: ['trex_fire', 'trex_fire'] }))).toThrow();
  });
  it('drops a family still missing from the collection about three times in four', () => {
    // Nature has two families: with the triceratops known, the brachiosaur comes 75% + 25% × ½ of the time.
    expect(brachioShare(['triceratops_nature'])).toBeGreaterThan(0.8);
    expect(brachioShare(['brachiosaurus_nature'])).toBeLessThan(0.2);
    // With nothing (or everything) new, either family is as likely.
    const even = brachioShare(['triceratops_nature', 'brachiosaurus_nature']);
    expect(even).toBeGreaterThan(0.35);
    expect(even).toBeLessThan(0.65);
  });
});
