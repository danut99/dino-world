import { describe, expect, it } from 'vitest';
import { command, newSave, parseSave, type Command, type Save } from './game';

const now = 1_800_000_000_000;
const run = (s: Save, ...cs: Command[]) => cs.reduce((x, c) => command(x, c, now), s);
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);
function rich(): Save {
  let s = run(newSave(now), { type: 'devResources' }, { type: 'devResources' });
  s = run(s, { type: 'build', kind: 'workshop', x: 6, y: 1 }, { type: 'build', kind: 'arena', x: 1, y: 8 });
  return s;
}

describe('workshop and arena gate upgrades', () => {
  it('workshop levels add queue slots, 25% speed, then a second job running at once', () => {
    let s = rich();
    for (let i = 0; i < 3; i++) s = run(s, { type: 'craft', recipeId: 'planks' });
    expect(() => run(s, { type: 'craft', recipeId: 'planks' })).toThrow('queue');
    s = run(s, { type: 'upgradeWorkshop' }, { type: 'craft', recipeId: 'planks' });
    const fast = s.crafting.at(-1)!;
    expect(fast.endsAt - fast.startedAt).toBe(22_500);
    s = run(s, { type: 'craft', recipeId: 'blocks' });
    expect(() => run(s, { type: 'craft', recipeId: 'blocks' })).toThrow('queue');
    roundTrip(s);
    // Level 3: the next job starts right away on the free second lane, beside the running one.
    s = run(newSave(now), { type: 'devResources' }, { type: 'devResources' }, { type: 'build', kind: 'workshop', x: 6, y: 1 });
    s = run(s, { type: 'upgradeWorkshop' }, { type: 'upgradeWorkshop' });
    s = run(s, { type: 'craft', recipeId: 'planks' }, { type: 'craft', recipeId: 'blocks' }, { type: 'craft', recipeId: 'planks' });
    expect(s.crafting.map((j) => [j.lane, j.startedAt - now])).toEqual([
      [0, 0],
      [1, 0],
      [0, 22_500],
    ]);
    // Cancelling a queued job only moves the later jobs of its own lane.
    s = run(s, { type: 'craft', recipeId: 'blocks' }, { type: 'cancelCraft', jobId: s.crafting[2].id });
    expect(s.crafting.map((j) => [j.lane, j.startedAt - now])).toEqual([
      [0, 0],
      [1, 0],
      [1, 22_500],
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
    s = run(s, { type: 'upgradeArena' });
    expect(s.arenaLevel).toBe(2);
    expect(run(s, { type: 'battle', encounterId: 'arena-fire-1' }).battle!.reward.gold).toBe(Math.round(base * 1.25));
    expect(run(s, { type: 'battle', encounterId: 'arena-lightning-1' }).battle?.encounterId).toBe('arena-lightning-1');
    // Expeditions are not boosted by the gate.
    expect(run(s, { type: 'battle' }).battle!.reward.gold).toBe(250);
    expect(() => run(s, { type: 'upgradeArena' })).toThrow('maxLevel');
    roundTrip(s);
  });

  it('older saves start the workshop and gate at level 1', () => {
    const { workshopLevel, arenaLevel, ...old } = rich();
    void [workshopLevel, arenaLevel];
    expect(parseSave(JSON.stringify(old))).toMatchObject({ workshopLevel: 1, arenaLevel: 1 });
  });
});
