import { describe, expect, it } from 'vitest';
import {
  advance,
  BALANCE,
  COLLECTION,
  command,
  EGG_SECONDS,
  QUEST_EGGS,
  STORY_CHAPTERS,
  storyChapter,
  goldRate,
  newSave,
  parseSave,
  releaseGold,
  stats,
  type Command,
  type Save,
} from './game';

const now = 1_800_000_000_000;
const run = (s: Save, ...cs: Command[]) => cs.reduce((x, c) => command(x, c, now), s);
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);
/** Finishes the upgrade being built at once, with diamonds. */
const finishBuild: Command[] = [{ type: 'addGems', amount: 100 }, { type: 'gemFinish', target: 'construction' }];
/** A save with Ignis hatched, a market and plenty of resources. */
function rich(): Save {
  let s = run(newSave(now), { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' }, { type: 'devResources' });
  s = run(s, { type: 'build', kind: 'market', x: 6, y: 1 });
  return s;
}

describe('eggs, hatchery, market and habitats', () => {
  it('hatches the tutorial egg into Ignis, the first champion', () => {
    let s = command(newSave(now), { type: 'incubate' }, now);
    expect(s.eggs[0].seconds).toBe(EGG_SECONDS.tutorial);
    expect(() => command(s, { type: 'hatch' }, now + 29_999)).toThrow('timer');
    s = command(s, { type: 'hatch' }, now + 30_000);
    expect(s.dinos).toMatchObject([{ id: 'ignis', nickname: 'Ignis', species: 'trex', element: 'fire' }]);
    expect(s).toMatchObject({ champion: 'ignis', team: ['ignis'], eggs: [] });
    expect(() => command(s, { type: 'hatch' }, now + 30_000)).toThrow();
    roundTrip(s);
  });

  it('keeps an egg of a locked world waiting until that world is unlocked, in order', () => {
    let s = run(newSave(now), { type: 'build', kind: 'farm', x: 5, y: 8 });
    s.eggs.push({ id: 'egg-test', species: 'thalassaur', element: 'water', seconds: 600, hatchAt: null });
    expect(s.habitats.water).toBeUndefined();
    s = run(s, { type: 'incubate', eggId: s.eggs.at(-1)!.id });
    expect(() => command(s, { type: 'hatch' }, now + 600_000)).toThrow('habitat');
    // Worlds open one after another, each after the previous world's expedition.
    expect(() => run(s, { type: 'unlockHabitat', realm: 'earth' })).toThrow('worldOrder');
    expect(() => run(s, { type: 'unlockHabitat', realm: 'water' })).toThrow('worldRegion');
    s.expeditionProgress = { training: 3 };
    s = run(s, { type: 'unlockHabitat', realm: 'water' });
    expect(s).toMatchObject({ gold: 900 - 600, habitats: { water: 1 }, inventory: { wood: 15 } });
    expect(() => command(s, { type: 'hatch' }, now + 599_999)).toThrow('timer');
    s = command(s, { type: 'hatch' }, now + 600_000);
    expect(s.dinos).toMatchObject([{ species: 'thalassaur', element: 'water', stage: 'baby' }]);
    expect(s.discovered).toEqual(['thalassaur_water']);
    roundTrip(s);
  });

  it('sells eggs only with a market and a habitat in that world, at rising prices', () => {
    expect(() => run(newSave(now), { type: 'buyEgg', species: 'trex', element: 'fire' })).toThrow('building');
    let s = rich();
    expect(() => run(s, { type: 'buyEgg', species: 'raptor', element: 'water' })).toThrow('habitat');
    const gold = s.gold;
    s = run(s, { type: 'buyEgg', species: 'trex', element: 'fire' });
    expect(s.gold).toBe(gold - 300);
    expect(s.eggs.at(-1)!.seconds).toBe(EGG_SECONDS.market);
    s.habitats.dark = 1;
    expect(() => run(s, { type: 'buyEgg', species: 'raptor', element: 'dark' })).toThrow('fightEgg');
    s.habitats.water = 1;
    s.habitats.earth = 1;
    s = run(s, { type: 'buyEgg', species: 'raptor', element: 'water' }, { type: 'buyEgg', species: 'terrasaur', element: 'earth' });
    expect(s.gold).toBe(gold - 300 - 600 - 1000);
    expect(s.eggs.map((e) => e.element)).toEqual(['fire', 'water', 'earth']);
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
    const gold = s.gold;
    s = run(s, { type: 'upgradeHatchery' });
    // The hatchery keeps one nest until its second level is built.
    expect(() => run(s, { type: 'incubate', eggId: s.eggs[1].id })).toThrow('slots');
    s = run(s, ...finishBuild, { type: 'incubate', eggId: s.eggs[1].id });
    expect(s).toMatchObject({ hatcheryLevel: 2, gold: gold - 800 });
    expect(s.eggs.every((e) => e.hatchAt !== null)).toBe(true);
    roundTrip(s);
  });

  it('keeps a ready egg waiting while the habitat is full, until the habitat grows', () => {
    let s = rich();
    for (const species of ['trex', 'trex'] as const) s = run(s, { type: 'buyEgg', species, element: 'fire' });
    s = run(s, { type: 'upgradeHatchery' }, ...finishBuild, { type: 'incubate' }, { type: 'incubate' }, { type: 'devSkip' });
    s = run(s, { type: 'hatch' });
    expect(s.dinos).toHaveLength(2);
    expect(() => run(s, { type: 'hatch' })).toThrow('habitatFull');
    expect(s.eggs).toHaveLength(1);
    s = run(s, { type: 'upgradeHabitat', realm: 'fire' }, ...finishBuild, { type: 'hatch' });
    expect(s.dinos.map((d) => d.species)).toEqual(['trex', 'trex', 'trex']);
    expect(s.dinos[2].nickname).toBe('T-Rex 3');
    roundTrip(s);
  });

  it('pays every dinosaur by age, with earth at ×1.25 and habitat levels multiplying it', () => {
    let s = rich();
    s.dinos.push({ id: 'rock', species: 'raptor', element: 'earth', level: 1, stage: 'baby', nickname: 'Rock' });
    s.habitats.earth = 1;
    expect(goldRate(s)).toBe(3 + 3.75);
    s.storedGold = 0;
    s.updatedAt = now;
    expect(advance(s, now + 3_600_000).storedGold).toBe(6.75);
    s = run(s, { type: 'upgradeHabitat', realm: 'earth' }, ...finishBuild);
    expect(goldRate(s)).toBeCloseTo(3 + 3.75 * 1.15);
    s.dinos.push({ id: 'big', species: 'raptor', element: 'earth', level: 25, stage: 'adult', nickname: 'Big' });
    expect(goldRate(s)).toBeCloseTo(3 + (3.75 + 15 * 1.25) * 1.15);
  });

  it('fights with the champion, applies species stats, and locks the champion during battle', () => {
    let s = run(rich(), { type: 'build', kind: 'arena', x: 1, y: 8 });
    s.dinos.push({ id: 'zip', species: 'raptor', element: 'earth', level: 12, stage: 'juvenile', nickname: 'Zip' });
    s.habitats.earth = 1;
    expect(() => run(s, { type: 'battle', encounterId: 'arena-fire-1' })).toThrow('juvenile');
    // Ignis is still a baby: the leader alone is not enough, the whole team must be able to fight.
    expect(run(s, { type: 'setChampion', dinoId: 'zip' }).team).toEqual(['zip', 'ignis']);
    expect(() => run(s, { type: 'setTeam', dinoIds: ['zip', 'ignis'] })).toThrow('juvenile');
    s = run(s, { type: 'setTeam', dinoIds: ['zip'] }, { type: 'battle', encounterId: 'arena-fire-1' });
    expect(s.team).toEqual(['zip']);
    expect(s.champion).toBe('zip');
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
    for (let i = 0; i < 3; i++) s = run(s, { type: 'craft', recipeId: 'provisions' });
    const gold = s.gold;
    s = run(s, { type: 'devSkip' });
    expect(s.eggs[0].hatchAt).toBeLessThanOrEqual(now);
    expect(s.plots[0]!.readyAt).toBeLessThanOrEqual(now);
    expect(s.crafting.every((j) => j.endsAt <= now)).toBe(true);
    expect(s.storedGold).toBe(500);
    roundTrip(s);
    s = run(s, { type: 'collectAvailable' }, { type: 'hatch' }, { type: 'devResources' });
    expect(s.gold).toBe(gold + 500 + 5000);
    expect(s.dinos).toHaveLength(2);
    roundTrip(s);
  });

  it('releases a dinosaur for gold by age and rarity, never a boss, the team or the last one', () => {
    let s = rich();
    expect(() => run(s, { type: 'releaseDino', dinoId: 'ignis' })).toThrow('team');
    s.dinos.push(
      { id: 'b', species: 'ignasaur', element: 'fire', level: 3, stage: 'baby', nickname: 'B' },
      { id: 'j', species: 'ignasaur', element: 'fire', level: 12, stage: 'juvenile', nickname: 'J', rarity: 'rare' },
      { id: 'a', species: 'ignasaur', element: 'fire', level: 30, stage: 'adult', nickname: 'A', rarity: 'epic' },
      { id: 'boss', species: 'boss', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignaroth', rarity: 'legendary' },
    );
    s.habitats.fire = 5;
    s.discovered = ['trex_fire', 'ignasaur_fire', 'boss_fire'];
    expect([s.dinos[1], s.dinos[2], s.dinos[3]].map(releaseGold)).toEqual([50, 300, 1200]);
    expect(() => run(s, { type: 'releaseDino', dinoId: 'boss' })).toThrow('boss');
    const gold = s.gold;
    s = run(s, { type: 'releaseDino', dinoId: 'j' }, { type: 'releaseDino', dinoId: 'a' });
    expect(s.gold).toBe(gold + 300 + 1200);
    expect(s.dinos.map((d) => d.id)).toEqual(['ignis', 'b', 'boss']);
    // The family stays in the collection.
    expect(s.discovered).toContain('ignasaur_fire');
    expect(() => run(s, { type: 'releaseDino', dinoId: 'nobody' })).toThrow('dino');
    roundTrip(s);
    const alone = rich();
    alone.dinos.push({ id: 'b', species: 'ignasaur', element: 'fire', level: 3, stage: 'baby', nickname: 'B' });
    alone.champion = 'b';
    alone.team = ['b'];
    expect(() => run(alone, { type: 'releaseDino', dinoId: 'ignis' })).not.toThrow();
    alone.dinos = alone.dinos.filter((d) => d.id === 'b');
    expect(() => run(alone, { type: 'releaseDino', dinoId: 'b' })).toThrow('team');
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
    s.arenaTickets = { fire: 5, water: 5 };
    s = run(s, { type: 'build', kind: 'arena', x: 1, y: 8 });
    expect(() => run(s, { type: 'battle', encounterId: 'arena-water-1' })).toThrow('locked');
    expect(run(s, { type: 'battle', encounterId: 'arena-fire-1' }).battle?.encounterId).toBe('arena-fire-1');
    // The next tier opens with two stars on the previous one.
    expect(() => run(s, { type: 'battle', encounterId: 'arena-fire-2' })).toThrow('stars');
    s.expeditionProgress = { training: 3 };
    s = run(s, { type: 'unlockHabitat', realm: 'water' });
    expect(run(s, { type: 'battle', encounterId: 'arena-water-1' }).battle?.encounterId).toBe('arena-water-1');
    expect(() => run(s, { type: 'battle', encounterId: 'arena-ice-1' })).toThrow('locked');
  });

  it('tells the story in ten chapters: one opening chapter, then one per world in unlock order', () => {
    expect(STORY_CHAPTERS.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(STORY_CHAPTERS.map((c) => c.world)).toEqual([null, 'water', 'earth', 'nature', 'ice', 'lightning', 'wind', 'dark', 'light', 'arcane']);
    expect(new Set(QUEST_EGGS.map((q) => q.id)).size).toBe(QUEST_EGGS.length);
    for (const c of STORY_CHAPTERS) {
      expect(c.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.steps.length).toBeLessThanOrEqual(c.number === 1 ? 6 : 5);
      // Every goal pays gold and food; one goal of a chapter adds an egg of that chapter's world: the last one, but in
      // the last chapter the boss (its final goal, the full collection, would come too late for the egg to count).
      for (const q of c.steps) expect(q.gold > 0 && q.food > 0).toBe(true);
      const eggStep = c.number === 10 ? c.steps.find((q) => q.id === 'w-arcane-boss')! : c.steps.at(-1)!;
      expect(c.steps.filter((q) => q.species).map((q) => q.id)).toEqual([eggStep.id]);
      expect(eggStep.element).toBe(c.world ?? 'fire');
    }
  });

  it('pays each goal once, in order, and opens the next chapter after the finale egg', () => {
    let s = newSave(now);
    const [hatch, farm, market, grow, portal, trip] = STORY_CHAPTERS[0].steps;
    expect(storyChapter(s)).toMatchObject({ chapter: { number: 1 }, index: 0 });
    expect(() => run(s, { type: 'claimQuestEgg', questId: hatch.id })).toThrow('locked');
    s = run(s, { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' });
    const { gold, food } = s;
    s = run(s, { type: 'claimQuestEgg', questId: hatch.id });
    expect(s).toMatchObject({ gold: gold + hatch.gold, food: food + hatch.food });
    expect(() => run(s, { type: 'claimQuestEgg', questId: hatch.id })).toThrow('locked');
    // Goals are taken one at a time: a later one stays locked even when it is reached.
    s.expeditionProgress = { training: 5 };
    expect(() => run(s, { type: 'claimQuestEgg', questId: trip.id })).toThrow('locked');
    s = run(s, { type: 'build', kind: 'farm', x: 5, y: 8 }, { type: 'claimQuestEgg', questId: farm.id });
    expect(() => run(s, { type: 'claimQuestEgg', questId: market.id })).toThrow('locked');
    s = run(s, { type: 'build', kind: 'market', x: 6, y: 1 }, { type: 'claimQuestEgg', questId: market.id });
    s.dinos[0] = { ...s.dinos[0], level: 10, stage: 'juvenile' };
    s = run(s, { type: 'claimQuestEgg', questId: grow.id });
    expect(() => run(s, { type: 'claimQuestEgg', questId: portal.id })).toThrow('locked');
    // This story-order test supplies gold instead of waiting for habitat income.
    s.gold += 1000;
    s = run(s, { type: 'build', kind: 'portal', x: 8, y: 5 }, { type: 'claimQuestEgg', questId: portal.id });
    const eggs = s.eggs.length;
    s = run(s, { type: 'claimQuestEgg', questId: trip.id });
    expect(s.eggs).toHaveLength(eggs + 1);
    expect(s.eggs.at(-1)).toMatchObject({ species: trip.species, element: 'fire', seconds: EGG_SECONDS.story });
    expect(storyChapter(s)).toMatchObject({ chapter: { number: 2, world: 'water' }, index: 0 });
    expect(storyChapter({ ...s, questEggs: QUEST_EGGS.map((q) => q.id) })).toBeNull();
    roundTrip(s);
  });

  it('keeps a story egg waiting when the shelf is full instead of stalling the story', () => {
    let s = newSave(now);
    s.dinos = [{ id: 'ignis', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' }];
    s.champion = 'ignis';
    s.team = ['ignis'];
    s.eggs = Array.from({ length: BALANCE.maxEggs }, (_, i) => ({ id: `e${i}`, species: 'trex' as const, element: 'fire' as const, seconds: 600, hatchAt: null }));
    s.expeditionProgress = { training: 5 };
    s.buildings.push({ id: 'farm', kind: 'farm', x: 5, y: 8 });
    s.questEggs = STORY_CHAPTERS[0].steps.slice(0, -1).map((q) => q.id);
    const trip = STORY_CHAPTERS[0].steps.at(-1)!;
    s = run(s, { type: 'claimQuestEgg', questId: trip.id });
    expect(s.questEggs).toContain(trip.id);
    expect(s.owedEggs).toEqual([{ species: trip.species, element: 'fire', story: true }]);
    roundTrip(s);
    // It moves to the shelf as soon as there is room, still incubating like a story egg.
    s = run(s, { type: 'sellEgg', eggId: 'e0' });
    expect(s.owedEggs).toEqual([]);
    expect(s.eggs.at(-1)).toMatchObject({ species: trip.species, element: 'fire', seconds: EGG_SECONDS.story });
    expect('story' in s.eggs.at(-1)!).toBe(false);
    roundTrip(s);
  });
});

describe('the reordered story', () => {
  it('follows the plan: each world asks for the buildings its next steps need', () => {
    expect(STORY_CHAPTERS.map((c) => c.steps.map((q) => q.id))).toEqual([
      ['c1-hatch', 'c1-farm', 'w-earth-market', 'c1-grow', 'c1-portal', 'c1-trip'],
      ['w-water-open', 'w-water-workshop', 'w-water-gate', 'w-water-trip', 'w-water-league'],
      ['w-earth-open', 'w-earth-hatchery', 'w-earth-trip', 'w-earth-league'],
      ['w-nature-open', 'w-nature-farm', 'w-nature-habitat', 'w-nature-trip', 'w-nature-league'],
      ['w-ice-open', 'w-ice-portal', 'w-ice-boss', 'w-ice-trip', 'w-ice-league'],
      ['w-lightning-open', 'w-lightning-gate', 'w-lightning-trip', 'w-lightning-league'],
      ['w-wind-open', 'w-wind-farm', 'w-wind-families', 'w-wind-trip', 'w-wind-league'],
      ['w-dark-open', 'w-dark-portal', 'w-dark-bosses', 'w-dark-trip', 'w-dark-league'],
      ['w-light-open', 'w-light-builder', 'w-light-trip', 'w-light-league'],
      ['w-arcane-open', 'w-arcane-trip', 'w-arcane-boss', 'w-arcane-collection'],
    ]);
    // Goals pay 80·ch + 40 gold and 50·ch + 30 food.
    for (const c of STORY_CHAPTERS) for (const q of c.steps) expect([q.gold, q.food]).toEqual([80 * c.number + 40, 50 * c.number + 30]);
  });

  it('is playable in order: every world opens after the previous region is crossed, gated leagues after the gate', () => {
    const ids = QUEST_EGGS.map((q) => q.id);
    for (const [i, c] of STORY_CHAPTERS.entries()) {
      if (!c.world) continue;
      // The previous chapter crossed the previous region to 5/5, more than the 3 stages opening this world asks.
      const previousTrip = STORY_CHAPTERS[i - 1].steps.find((q) => q.id.endsWith('-trip'))!;
      expect(ids.indexOf(previousTrip.id)).toBeLessThan(ids.indexOf(`w-${c.world}-open`));
      expect(ids.indexOf(`w-${c.world}-open`)).toBeLessThan(ids.indexOf(`w-${c.world}-trip`));
    }
    // Supplies are needed from the second region on: the workshop comes first.
    expect(ids.indexOf('w-water-workshop')).toBeLessThan(ids.indexOf('w-water-trip'));
    expect(ids.indexOf('w-water-gate')).toBeLessThan(ids.indexOf('w-water-league'));
    // The lightning league is behind the Arena Gate level 2.
    expect(ids.indexOf('w-lightning-gate')).toBeLessThan(ids.indexOf('w-lightning-league'));
    // Upgrades come one level at a time: farm 3 before 4 before 5, portal 2 before 3.
    expect(ids.indexOf('w-nature-farm')).toBeLessThan(ids.indexOf('w-wind-farm'));
    expect(ids.indexOf('w-wind-farm')).toBeLessThan(ids.indexOf('w-light-builder'));
    expect(ids.indexOf('w-ice-portal')).toBeLessThan(ids.indexOf('w-dark-portal'));
  });

  it('checks each new goal and names its real level and price', () => {
    const step = (id: string) => QUEST_EGGS.find((q) => q.id === id)!;
    const s = newSave(now);
    expect(step('w-earth-hatchery').done({ ...s, hatcheryLevel: 2 })).toBe(true);
    expect(step('w-nature-farm').done({ ...s, farmLevel: 2 })).toBe(false);
    expect(step('w-nature-farm').done({ ...s, farmLevel: 3 })).toBe(true);
    expect(step('w-nature-farm').hint[0]).toContain('Nivelul 3: 1.500 aur, 30 lemn · 1 h');
    expect(step('w-nature-farm').hint[1]).toContain('Level 3: 1,500 gold, 30 wood · 1 h');
    expect(step('w-nature-habitat').done({ ...s, habitats: { fire: 1, water: 2 } })).toBe(true);
    expect(step('w-ice-portal').hint[0]).toContain('3.000 aur, 50 lemn, 50 piatră · 2 h');
    expect(step('w-ice-boss').done({ ...s, cleared: ['arena-fire-1', 'arena-fire-2'] })).toBe(false);
    expect(step('w-ice-boss').done({ ...s, cleared: ['arena-fire-3'] })).toBe(true);
    expect(step('w-lightning-gate').hint[0]).toContain('6.000 aur, 60 piatră, 20 cristale · 4 h');
    expect(step('w-wind-farm').hint[0]).toContain('Nivelul 4');
    const families = COLLECTION.filter((id) => !id.startsWith('boss_'));
    expect(step('w-wind-families').done({ ...s, discovered: [...families.slice(0, 11), 'boss_fire'] })).toBe(false);
    expect(step('w-wind-families').progress!({ ...s, discovered: families.slice(0, 12) })).toEqual([12, 12]);
    expect(step('w-dark-bosses').done({ ...s, cleared: ['arena-fire-3', 'arena-water-3', 'arena-earth-3'] })).toBe(true);
    expect(step('w-light-builder').done({ ...s, farmLevel: 5, workshopLevel: 2 })).toBe(false);
    expect(step('w-light-builder').done({ ...s, farmLevel: 5, workshopLevel: 3 })).toBe(true);
    expect(step('w-arcane-boss').hint[1]).toContain('level 50');
    expect(step('w-arcane-collection').done({ ...s, discovered: COLLECTION.slice(0, 29) })).toBe(false);
    expect(step('w-arcane-collection').done({ ...s, discovered: [...COLLECTION] })).toBe(true);
    // The last chapter's egg comes with the boss, while the collection can still use it; the final goal pays no egg.
    expect(step('w-arcane-boss')).toMatchObject({ species: 'cryptoraptor', element: 'arcane' });
    expect(step('w-arcane-collection').species).toBeUndefined();
    expect(step('w-water-league').hint[0]).toContain('nivel 14+');
  });
});
