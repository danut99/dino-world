import { describe, expect, it } from 'vitest';
import {
  advance,
  CHAPTER_TWO,
  command,
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

  it('gives the four MVP eggs through story tasks, each once, with their habitat', () => {
    let s = run(newSave(now), { type: 'build', kind: 'farm', x: 5, y: 8 });
    expect(() => run(s, { type: 'claimQuestEgg', questId: 'raptor_fire' })).toThrow('locked');
    s = run(s, { type: 'claimQuestEgg', questId: 'triceratops_earth' });
    expect(s.eggs.at(-1)).toMatchObject({ species: 'triceratops', element: 'nature', seconds: 300 });
    // The egg waits: its world stays locked until it is bought with gold and materials.
    expect(s.habitats.nature).toBeUndefined();
    s = run(s, { type: 'incubate', eggId: s.eggs.at(-1)!.id });
    expect(() => command(s, { type: 'hatch' }, now + 300_000)).toThrow('habitat');
    s = run(s, { type: 'unlockHabitat', realm: 'nature' });
    expect(s).toMatchObject({ gold: 1100 - 750, habitats: { nature: 1 } });
    expect(s.inventory.fiber).toBeLessThan(30);
    expect(() => run(s, { type: 'claimQuestEgg', questId: 'triceratops_earth' })).toThrow('locked');
    expect(() => command(s, { type: 'hatch' }, now + 299_999)).toThrow('timer');
    s = command(s, { type: 'hatch' }, now + 300_000);
    expect(s.dinos).toMatchObject([{ species: 'triceratops', element: 'nature', stage: 'baby' }]);
    s.cleared = ['training'];
    expect(run(s, { type: 'claimQuestEgg', questId: 'raptor_fire' }).eggs.at(-1)?.element).toBe('earth');
    // Saves that claimed the old wind story egg keep it claimed under its new id.
    expect(parseSave(JSON.stringify({ ...s, questEggs: ['raptor_wind'] })).questEggs).toEqual(['raptor_fire']);
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
    expect(() => run(s, { type: 'battle', encounterId: 'arena-fire-2' })).toThrow('locked');
    s = run(s, { type: 'unlockHabitat', realm: 'water' });
    expect(run(s, { type: 'battle', encounterId: 'arena-water-1' }).battle?.encounterId).toBe('arena-water-1');
    expect(() => run(s, { type: 'battle', encounterId: 'arena-ice-1' })).toThrow('locked');
  });
  it('moves progress from the old ice ladder to the fire league', () => {
    const s = rich();
    const old = parseSave(JSON.stringify({ ...s, cleared: ['training', 'arena1', 'arena2'] }));
    expect(old.cleared).toEqual(['training', 'arena-fire-1', 'arena-fire-2']);
  });

  it('splits the story into chapters of five goals, with gold and food per goal and an egg at each finale', () => {
    for (const c of STORY_CHAPTERS) {
      expect(c.steps).toHaveLength(5);
      expect(c.steps.filter((q) => q.species).map((q) => q.id)).toEqual([c.steps.at(-1)!.id]);
    }
    let s = rich();
    const [first, second] = CHAPTER_TWO;
    expect(storyChapter(s)).toMatchObject({ chapter: { number: 2 }, index: 0 });
    expect(() => run(s, { type: 'claimQuestEgg', questId: first.id })).toThrow('locked');
    s.dinos[0] = { ...s.dinos[0], level: 25, stage: 'adult' };
    const { gold, food, eggs } = s;
    s = run(s, { type: 'claimQuestEgg', questId: first.id });
    expect(s).toMatchObject({ gold: gold + first.gold!, food: food + first.food! });
    expect(s.eggs).toHaveLength(eggs.length);
    expect(storyChapter(s)).toMatchObject({ chapter: { number: 2 }, index: 1 });
    // Finishing chapter II hands over its egg and moves the story to chapter III.
    const last = CHAPTER_TWO.at(-1)!;
    const done = {
      ...s,
      questEggs: CHAPTER_TWO.slice(0, -1).map((q) => q.id),
      dinos: Array.from({ length: 8 }, (_, i) => ({ ...s.dinos[0], id: `d${i}`, element: 'fire' as const })),
      habitats: { fire: 6 },
    };
    const finale = run(done, { type: 'claimQuestEgg', questId: last.id });
    expect(finale.eggs.at(-1)).toMatchObject({ species: last.species, element: last.element });
    expect(storyChapter(finale)).toMatchObject({ chapter: { number: 3 }, index: 0 });
    expect(storyChapter({ ...finale, questEggs: STORY_CHAPTERS.flatMap((c) => c.steps.map((q) => q.id)) })).toBeNull();
    expect(second.progress!(s)).toEqual([1, 4]);
    s = run(
      s,
      { type: 'unlockHabitat', realm: 'water' },
      { type: 'unlockHabitat', realm: 'earth' },
      { type: 'unlockHabitat', realm: 'nature' },
    );
    expect(second.done(s)).toBe(true);
    s = run(s, { type: 'claimQuestEgg', questId: second.id });
    expect(() => run(s, { type: 'claimQuestEgg', questId: second.id })).toThrow('locked');
    roundTrip(s);
  });
});
