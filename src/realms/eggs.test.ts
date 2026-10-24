import { describe, expect, it } from 'vitest';
import {
  advance,
  command,
  QUEST_EGGS,
  STORY_CHAPTERS,
  storyChapter,
  goldRate,
  newSave,
  parseSave,
  stats,
  type Command,
  type Save,
} from './game';
import { legacy } from './test-fixtures';

const now = 1_800_000_000_000;
const run = (s: Save, ...cs: Command[]) => cs.reduce((x, c) => command(x, c, now), s);
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);
/** A save with Ignis hatched, a market and plenty of resources. */
function rich(): Save {
  let s = run(newSave(now), { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' }, { type: 'devResources' });
  s = run(s, { type: 'build', kind: 'market', x: 6, y: 1 });
  return s;
}

describe('eggs, hatchery, market and habitats', () => {
  it('hatches the tutorial egg into Ignis, the first champion', () => {
    let s = command(newSave(now), { type: 'incubate' }, now);
    expect(() => command(s, { type: 'hatch' }, now + 29_999)).toThrow('timer');
    s = command(s, { type: 'hatch' }, now + 30_000);
    expect(s.dinos).toMatchObject([{ id: 'ignis', nickname: 'Ignis', species: 'trex', element: 'fire' }]);
    expect(s).toMatchObject({ champion: 'ignis', eggs: [] });
    expect(() => command(s, { type: 'hatch' }, now + 30_000)).toThrow();
    roundTrip(s);
  });

  it('keeps an egg of a locked world waiting until that world is unlocked', () => {
    let s = run(newSave(now), { type: 'build', kind: 'farm', x: 5, y: 8 });
    s.eggs.push({ id: 'egg-test', species: 'triceratops', element: 'nature', seconds: 300, hatchAt: null });
    // The egg waits: its world stays locked until it is bought with gold and materials.
    expect(s.habitats.nature).toBeUndefined();
    s = run(s, { type: 'incubate', eggId: s.eggs.at(-1)!.id });
    expect(() => command(s, { type: 'hatch' }, now + 300_000)).toThrow('habitat');
    s = run(s, { type: 'unlockHabitat', realm: 'nature' });
    expect(s).toMatchObject({ gold: 1100 - 750, habitats: { nature: 1 } });
    expect(s.inventory.fiber).toBeLessThan(30);
    expect(() => command(s, { type: 'hatch' }, now + 299_999)).toThrow('timer');
    s = command(s, { type: 'hatch' }, now + 300_000);
    expect(s.dinos).toMatchObject([{ species: 'triceratops', element: 'nature', stage: 'baby' }]);
    roundTrip(s);
  });

  it('sells eggs only with a market and a habitat in that world', () => {
    expect(() => run(newSave(now), { type: 'buyEgg', species: 'trex', element: 'fire' })).toThrow('building');
    let s = rich();
    expect(() => run(s, { type: 'buyEgg', species: 'raptor', element: 'dark' })).toThrow('habitat');
    const gold = s.gold;
    s = run(s, { type: 'buyEgg', species: 'trex', element: 'fire' });
    expect(s.gold).toBe(gold - 250);
    s = run(s, { type: 'unlockHabitat', realm: 'dark' });
    expect(() => run(s, { type: 'buyEgg', species: 'raptor', element: 'dark' })).toThrow('fightEgg');
    s = run(s, { type: 'unlockHabitat', realm: 'water' }, { type: 'buyEgg', species: 'raptor', element: 'water' });
    expect(s.gold).toBe(gold - 250 - 2600 - 300 - 250);
    expect(() =>
      run({ ...s, gold: 1e6, inventory: { ...s.inventory, blocks: 0 } }, { type: 'unlockHabitat', realm: 'light' }),
    ).toThrow('materials');
    expect(s.eggs.map((e) => e.element)).toEqual(['fire', 'water']);
    roundTrip(s);
  });

  it('limits incubation to the hatchery slots and upgrades them', () => {
    let s = run(
      rich(),
      { type: 'buyEgg', species: 'trex', element: 'fire' },
      { type: 'buyEgg', species: 'trex', element: 'fire' },
    );
    s = run(s, { type: 'incubate', eggId: s.eggs[0].id });
    expect(() => run(s, { type: 'incubate', eggId: s.eggs[1].id })).toThrow('slots');
    s = run(s, { type: 'upgradeHatchery' }, { type: 'incubate', eggId: s.eggs[1].id });
    expect(s.hatcheryLevel).toBe(2);
    expect(s.eggs.every((e) => e.hatchAt !== null)).toBe(true);
    roundTrip(s);
  });

  it('keeps a ready egg waiting while the habitat is full, until the habitat grows', () => {
    let s = rich();
    for (const species of ['trex', 'trex'] as const) s = run(s, { type: 'buyEgg', species, element: 'fire' });
    s = run(s, { type: 'upgradeHatchery' }, { type: 'incubate' }, { type: 'incubate' }, { type: 'devSkip' });
    s = run(s, { type: 'hatch' });
    expect(s.dinos).toHaveLength(2);
    expect(() => run(s, { type: 'hatch' })).toThrow('habitatFull');
    expect(s.eggs).toHaveLength(1);
    s = run(s, { type: 'upgradeHabitat', realm: 'fire' }, { type: 'hatch' });
    expect(s.dinos.map((d) => d.species)).toEqual(['trex', 'trex', 'trex']);
    expect(s.dinos[2].nickname).toBe('T-Rex 3');
    roundTrip(s);
  });

  it('pays every dinosaur, with earth at ×1.25 and habitat levels adding 10%', () => {
    let s = rich();
    s.dinos.push({ id: 'rock', species: 'raptor', element: 'earth', level: 1, stage: 'baby', nickname: 'Rock' });
    s.habitats.earth = 1;
    expect(goldRate(s)).toBe(10 + 12.5);
    s.storedGold = 0;
    s.updatedAt = now;
    expect(advance(s, now + 3_600_000).storedGold).toBe(22.5);
    s = run(s, { type: 'upgradeHabitat', realm: 'earth' });
    expect(goldRate(s)).toBeCloseTo(10 + 12.5 * 1.1);
  });

  it('fights with the champion, applies species stats, and locks the champion during battle', () => {
    let s = rich();
    s.dinos.push({ id: 'zip', species: 'raptor', element: 'earth', level: 12, stage: 'juvenile', nickname: 'Zip' });
    s.habitats.earth = 1;
    expect(() => run(s, { type: 'battle' })).toThrow('juvenile');
    s = run(s, { type: 'setChampion', dinoId: 'zip' }, { type: 'battle' });
    expect(s.battle).toMatchObject({ dinoId: 'zip', maxHp: stats(12, 'juvenile', 'raptor').hp });
    expect(stats(12, 'juvenile', 'raptor').speed).toBeGreaterThan(stats(12, 'juvenile', 'trex').speed);
    expect(() => run(s, { type: 'setChampion', dinoId: 'ignis' })).toThrow('unavailable');
    expect(() => run(s, { type: 'feed', dinoId: 'zip' })).toThrow('unavailable');
    expect(run(s, { type: 'feed', dinoId: 'ignis' }).dinos[0].level).toBe(2);
    roundTrip(s);
  });

  it('test tools finish every timer validly and add resources', () => {
    let s = run(rich(), { type: 'build', kind: 'farm', x: 5, y: 8 }, { type: 'build', kind: 'workshop', x: 1, y: 8 });
    s = run(
      s,
      { type: 'buyEgg', species: 'trex', element: 'fire' },
      { type: 'incubate' },
      { type: 'plant', crop: 'cicadas' },
    );
    for (let i = 0; i < 3; i++) s = run(s, { type: 'craft', recipeId: 'planks' });
    const gold = s.gold;
    s = run(s, { type: 'devSkip' });
    expect(s.eggs[0].hatchAt).toBeLessThanOrEqual(now);
    expect(s.plots[0]!.readyAt).toBeLessThanOrEqual(now);
    expect(s.crafting.every((j) => j.endsAt <= now)).toBe(true);
    expect(s.storedGold).toBe(600);
    roundTrip(s);
    s = run(s, { type: 'collectAvailable' }, { type: 'hatch' }, { type: 'devResources' });
    expect(s.gold).toBe(gold + 600 + 5000);
    expect(s.dinos).toHaveLength(2);
    roundTrip(s);
  });

  it('migrates a v4 save with an incubating egg and a live battle', () => {
    let s = run(newSave(now), { type: 'incubate' });
    const incubatingV4 = { ...legacy(s, 4), egg: 'incubating', hatchAt: now + 30_000 };
    s = parseSave(JSON.stringify(incubatingV4));
    expect(s).toMatchObject({ dinos: [], champion: null, habitats: { fire: 1 } });
    expect(s.eggs).toMatchObject([{ id: 'egg-ignis', hatchAt: now + 30_000 }]);
    expect(command(s, { type: 'hatch' }, now + 30_000).dinos[0].id).toBe('ignis');
    const fighting = run(rich(), { type: 'useCrystal' });
    fighting.dinos[0] = { ...fighting.dinos[0], level: 10, stage: 'juvenile' };
    const battle = run(fighting, { type: 'battle' });
    const v4 = { ...legacy(battle, 4), worldIncomeBonus: 3 };
    const migrated = parseSave(JSON.stringify(v4));
    expect(migrated.habitats.fire).toBe(4);
    expect(migrated.battle?.dinoId).toBe('ignis');
    expect(migrated.storedGold).toBe(battle.storedGold);
  });
});

describe('arena leagues', () => {
  it('opens a three-tier league per unlocked world, in order', async () => {
    const { ENCOUNTERS } = await import('./content');
    const fire = ENCOUNTERS.filter((e) => e.league === 'fire');
    expect(fire.map((e) => e.id)).toEqual(['arena-fire-1', 'arena-fire-2', 'arena-fire-3']);
    expect(ENCOUNTERS.filter((e) => e.mode === 'arena')).toHaveLength(10 * 3);
    // Leagues follow the worlds' unlock order, starting with fire.
    expect([...new Set(ENCOUNTERS.filter((e) => e.mode === 'arena').map((e) => e.league))].slice(0, 5)).toEqual([
      'fire',
      'water',
      'earth',
      'nature',
      'ice',
    ]);
    let s = rich();
    s.dinos[0] = { ...s.dinos[0], level: 25, stage: 'adult' };
    s = run(s, { type: 'build', kind: 'arena', x: 1, y: 8 });
    expect(() => run(s, { type: 'battle', encounterId: 'arena-water-1' })).toThrow('locked');
    expect(run(s, { type: 'battle', encounterId: 'arena-fire-1' }).battle?.encounterId).toBe('arena-fire-1');
    // The next tier opens with two stars on the previous one.
    expect(() => run(s, { type: 'battle', encounterId: 'arena-fire-2' })).toThrow('stars');
    s = run(s, { type: 'unlockHabitat', realm: 'water' });
    expect(run(s, { type: 'battle', encounterId: 'arena-water-1' }).battle?.encounterId).toBe('arena-water-1');
    expect(() => run(s, { type: 'battle', encounterId: 'arena-ice-1' })).toThrow('locked');
  });
  it('moves progress from the old ice ladder to the fire league', () => {
    const s = rich();
    const old = parseSave(JSON.stringify({ ...s, cleared: ['training', 'arena1', 'arena2'] }));
    expect(old.cleared).toEqual(['training', 'arena-fire-1', 'arena-fire-2']);
  });

  it('tells the story in ten chapters: one opening chapter, then one per world in unlock order', () => {
    expect(STORY_CHAPTERS.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(STORY_CHAPTERS.map((c) => c.world)).toEqual([null, 'water', 'earth', 'nature', 'ice', 'lightning', 'wind', 'dark', 'light', 'arcane']);
    expect(new Set(QUEST_EGGS.map((q) => q.id)).size).toBe(QUEST_EGGS.length);
    for (const c of STORY_CHAPTERS) {
      expect(c.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.steps.length).toBeLessThanOrEqual(4);
      // Every goal pays gold and food; only the last one of a chapter adds an egg, of that chapter's world.
      for (const q of c.steps) expect(q.gold > 0 && q.food > 0).toBe(true);
      expect(c.steps.filter((q) => q.species).map((q) => q.id)).toEqual([c.steps.at(-1)!.id]);
      expect(c.steps.at(-1)!.element).toBe(c.world ?? 'fire');
    }
  });

  it('pays each goal once, in order, and opens the next chapter after the finale egg', () => {
    let s = newSave(now);
    const [hatch, farm, , trip] = STORY_CHAPTERS[0].steps;
    expect(storyChapter(s)).toMatchObject({ chapter: { number: 1 }, index: 0 });
    expect(() => run(s, { type: 'claimQuestEgg', questId: hatch.id })).toThrow('locked');
    s = run(s, { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' });
    const { gold, food } = s;
    s = run(s, { type: 'claimQuestEgg', questId: hatch.id });
    expect(s).toMatchObject({ gold: gold + hatch.gold, food: food + hatch.food });
    expect(() => run(s, { type: 'claimQuestEgg', questId: hatch.id })).toThrow('locked');
    // Goals are taken one at a time: a later one stays locked even when it is reached.
    s.cleared = ['training'];
    expect(() => run(s, { type: 'claimQuestEgg', questId: trip.id })).toThrow('locked');
    s = run(s, { type: 'build', kind: 'farm', x: 5, y: 8 }, { type: 'claimQuestEgg', questId: farm.id });
    s.dinos[0] = { ...s.dinos[0], level: 10, stage: 'juvenile' };
    s = run(s, { type: 'claimQuestEgg', questId: STORY_CHAPTERS[0].steps[2].id });
    const eggs = s.eggs.length;
    s = run(s, { type: 'claimQuestEgg', questId: trip.id });
    expect(s.eggs).toHaveLength(eggs + 1);
    expect(s.eggs.at(-1)).toMatchObject({ species: trip.species, element: 'fire' });
    expect(storyChapter(s)).toMatchObject({ chapter: { number: 2, world: 'water' }, index: 0 });
    expect(storyChapter({ ...s, questEggs: QUEST_EGGS.map((q) => q.id) })).toBeNull();
    roundTrip(s);
  });

  it('ticks the goals an older save already reached, without paying them again', () => {
    const s = rich();
    s.cleared = ['training'];
    s.dinos[0] = { ...s.dinos[0], level: 12, stage: 'juvenile' };
    s.buildings.push({ id: 'farm-1', kind: 'farm', x: 5, y: 8 });
    const old = JSON.parse(JSON.stringify({ ...s, questEggs: ['raptor_fire', 'ch2_adult'] }));
    delete old.storyVersion;
    const loaded = parseSave(JSON.stringify(old));
    expect(loaded.questEggs).toEqual(STORY_CHAPTERS[0].steps.map((q) => q.id));
    expect(loaded).toMatchObject({ gold: s.gold, food: s.food, storyVersion: 2 });
    expect(storyChapter(loaded)).toMatchObject({ chapter: { number: 2 }, index: 0 });
  });
});
