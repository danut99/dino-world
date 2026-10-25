import { describe, expect, it } from 'vitest';
import { command, newSave, parseSave, portalSlots, type Command, type Save } from './game';

const now = 1_800_000_000_000;
const run = (s: Save, ...cs: Command[]) => cs.reduce((x, c) => command(x, c, now), s);
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);
/** Starts an upgrade and finishes it at once with diamonds (upgrades take time to build, see construction.test). */
const upgrade = (s: Save, c: Command) => run(s, c, { type: 'addGems', amount: 100 }, { type: 'gemFinish', target: 'construction' });
function rich(): Save {
  let s = run(newSave(now), { type: 'devResources' }, { type: 'devResources' });
  s = run(s, { type: 'build', kind: 'workshop', x: 6, y: 1 }, { type: 'build', kind: 'arena', x: 1, y: 8 });
  return s;
}

describe('workshop and arena gate upgrades', () => {
  it('workshop levels add queue slots, speed and one, two then three parallel jobs', () => {
    let s = rich();
    for (let i = 0; i < 3; i++) s = run(s, { type: 'craft', recipeId: 'planks' });
    expect(() => run(s, { type: 'craft', recipeId: 'planks' })).toThrow('queue');
    s = run(upgrade(s, { type: 'upgradeWorkshop' }), { type: 'craft', recipeId: 'planks' });
    const fast = s.crafting.at(-1)!;
    expect(fast.lane).toBe(1);
    expect(fast.startedAt).toBe(now);
    expect(fast.endsAt - fast.startedAt).toBe(240_000);
    s = run(s, { type: 'craft', recipeId: 'blocks' });
    expect(() => run(s, { type: 'craft', recipeId: 'blocks' })).toThrow('queue');
    roundTrip(s);
    // Level 3 starts the first three jobs immediately on distinct lanes.
    s = run(newSave(now), { type: 'devResources' }, { type: 'devResources' }, { type: 'build', kind: 'workshop', x: 6, y: 1 });
    s = upgrade(upgrade(s, { type: 'upgradeWorkshop' }), { type: 'upgradeWorkshop' });
    s = run(s, { type: 'craft', recipeId: 'planks' }, { type: 'craft', recipeId: 'blocks' }, { type: 'craft', recipeId: 'planks' });
    // Level 3 crafts at 0.6 of the time: planks take 3 minutes instead of 5.
    expect(s.workshopLevel).toBe(3);
    expect(s.crafting.map((j) => j.endsAt - j.startedAt)).toEqual([180_000, 180_000, 180_000]);
    expect(s.crafting.map((j) => [j.lane, j.startedAt - now])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    // Cancelling a queued job only moves the later jobs of its own lane.
    s = run(s, { type: 'craft', recipeId: 'blocks' }, { type: 'craft', recipeId: 'blocks' });
    s = run(s, { type: 'cancelCraft', jobId: s.crafting[3].id });
    expect(s.crafting.map((j) => [j.lane, j.startedAt - now])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 180_000],
    ]);
    roundTrip(s);
    s = run(s, { type: 'devSkip' });
    expect(s.crafting.every((j) => j.endsAt <= now)).toBe(true);
    roundTrip(s);
  });

  it('the arena gate adds 25% to arena rewards and opens the last five leagues', () => {
    let s = rich();
    s.dinos = [{ id: 'ignis', species: 'trex', element: 'fire', level: 30, stage: 'adult', nickname: 'Ignis' }];
    s.champion = 'ignis';
    s.eggs = [];
    s.habitats.lightning = 1;
    const base = run(s, { type: 'battle', encounterId: 'arena-fire-1' }).battle!.reward.gold;
    expect(() => run(s, { type: 'battle', encounterId: 'arena-lightning-1' })).toThrow('gate');
    s = upgrade(s, { type: 'upgradeArena' });
    expect(s.arenaLevel).toBe(2);
    expect(run(s, { type: 'battle', encounterId: 'arena-fire-1' }).battle!.reward.gold).toBe(Math.round(base * 1.25));
    expect(run(s, { type: 'battle', encounterId: 'arena-lightning-1' }).battle?.encounterId).toBe('arena-lightning-1');
    expect(() => run(s, { type: 'upgradeArena' })).toThrow('maxLevel');
    roundTrip(s);
  });

  it('the portal starts at level 1 when built and grows to three expedition slots', () => {
    let s = rich();
    expect(s.portalLevel).toBe(0);
    expect(() => run(s, { type: 'upgradePortal' })).toThrow('building');
    s = run(s, { type: 'build', kind: 'portal', x: 8, y: 5 });
    expect(s.portalLevel).toBe(1);
    const gold = s.gold;
    s = upgrade(s, { type: 'upgradePortal' });
    expect(s).toMatchObject({ portalLevel: 2, gold: gold - 3000, inventory: { planks: 30, blocks: 30 } });
    expect(portalSlots(s)).toBe(2);
    s.gold += 10_000;
    s = upgrade(s, { type: 'upgradePortal' });
    expect(s.portalLevel).toBe(3);
    expect(portalSlots(s)).toBe(3);
    expect(() => run(s, { type: 'upgradePortal' })).toThrow('maxLevel');
    roundTrip(s);
  });
});
