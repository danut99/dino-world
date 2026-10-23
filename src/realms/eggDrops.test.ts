import { describe, expect, it } from 'vitest';
import { BALANCE, command, EGG_DROP, newSave, parseSave, type Command, type Save } from './game';

const now = 1_800_000_000_000;
const run = (s: Save, ...cs: Command[]) => cs.reduce((x, c) => command(x, c, now), s);
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);

/** Ignis at max level, a market and an arena, rich, with the nature world open. */
function arena(): Save {
  let s = run(newSave(now), { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' });
  for (let i = 0; i < 3; i++) s = run(s, { type: 'devResources' });
  s = run(s, { type: 'build', kind: 'market', x: 6, y: 1 });
  for (let x = 0; x < 12 && !s.buildings.some((b) => b.kind === 'arena'); x++)
    for (let y = 0; y < 12; y++)
      try {
        s = run(s, { type: 'build', kind: 'arena', x, y });
        break;
      } catch {
        /* Cell taken; try the next one. */
      }
  s = run(s, { type: 'unlockHabitat', realm: 'nature' });
  s.dinos[0] = { ...s.dinos[0], level: 50, stage: 'adult' };
  return s;
}
/** Fights an encounter to victory and returns the save with the reward still waiting. */
function win(s: Save, encounterId: string, at = now) {
  s = command(s, { type: 'battle', encounterId }, at);
  while (!s.battle?.result) s = command(s, { type: 'action', action: 'basic' }, at);
  expect(s.battle.result).toBe('victory');
  return s;
}

describe('egg drops and selling', () => {
  it('awards the defeated boss once, including previously cleared leagues, and hatches an adult', () => {
    let s = arena();
    s.cleared = ['arena-fire-1', 'arena-fire-2', 'arena-fire-3'];
    s = win(s, 'arena-fire-3');
    expect(s.battle?.reward.egg).toEqual({ species: 'boss', element: 'fire' });
    roundTrip(s);
    s = run(s, { type: 'claim' });
    const egg = s.eggs.at(-1)!;
    expect(egg.species).toBe('boss');
    expect(s.bossEggsClaimed).toEqual(['fire']);
    expect(() => run(s, { type: 'sellEgg', eggId: egg.id })).toThrow('egg');
    expect(() => run(s, { type: 'buyEgg', species: 'boss', element: 'fire' })).toThrow('egg');
    s = run(s, { type: 'incubate', eggId: egg.id });
    s = command(s, { type: 'hatch', eggId: egg.id }, now + egg.seconds * 1000);
    const boss = s.dinos.find(d => d.species === 'boss')!;
    expect(boss).toMatchObject({ element: 'fire', stage: 'adult', level: 25, nickname: 'Ignaroth' });
    roundTrip(s);
    s = command(s, { type: 'setChampion', dinoId: boss.id }, now + egg.seconds * 1000);
    expect(s.champion).toBe(boss.id);
    s.champion = s.dinos[0].id;
    s = win(s, 'arena-fire-3', now + egg.seconds * 1000);
    expect(s.battle?.reward.egg?.species).not.toBe('boss');
  });
  it('reserves boss rewards while both the egg shelf and normal waiting queue are full', () => {
    let s = arena();
    s.cleared = ['arena-nature-1', 'arena-nature-2'];
    while (s.eggs.length < BALANCE.maxEggs) s = run(s, { type: 'buyEgg', species: 'trex', element: 'fire' });
    s.owedEggs = Array.from({ length: 20 }, () => ({ species: 'triceratops' as const, element: 'nature' as const }));
    s = run(win(s, 'arena-nature-3'), { type: 'claim' });
    expect(s.owedEggs).toHaveLength(21);
    expect(s.owedEggs.at(-1)).toEqual({ species: 'boss', element: 'nature' });
    roundTrip(s);
  });
  it('loads old saves without marking bosses as already rewarded and rejects a baby boss', () => {
    const s = arena();
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.bossEggsClaimed;
    expect(parseSave(JSON.stringify(raw)).bossEggsClaimed).toEqual([]);
    raw.dinos.push({ id: 'invalid-boss', species: 'boss', element: 'fire', level: 1, stage: 'baby', nickname: 'Boss' });
    expect(() => parseSave(JSON.stringify(raw))).toThrow('Invalid dinosaur');
  });
  it('sells only fire, water and earth eggs at the market', () => {
    const s = arena();
    expect(() => run(s, { type: 'buyEgg', species: 'triceratops', element: 'nature' })).toThrow('fightEgg');
    expect(run(s, { type: 'buyEgg', species: 'trex', element: 'fire' }).eggs.at(-1)?.element).toBe('fire');
  });

  it('always drops an egg of its element from a boss the first time', () => {
    let s = arena();
    s.cleared = ['arena-nature-1', 'arena-nature-2'];
    s = win(s, 'arena-nature-3');
    expect(s.battle?.reward.egg?.element).toBe('nature');
    roundTrip(s);
    const eggs = s.eggs.length;
    s = run(s, { type: 'claim' });
    expect(s.eggs).toHaveLength(eggs + 1);
    expect(s.eggs.at(-1)).toMatchObject({ element: 'nature', hatchAt: null });
    roundTrip(s);
  });

  it('never drops from market-element leagues, and guarantees an egg after a dry streak', () => {
    let s = win(arena(), 'arena-fire-1');
    expect(s.battle?.reward.egg).toBeUndefined();
    expect(s.eggLuck).toBe(0);
    s = run(s, { type: 'claim' });
    s.eggLuck = EGG_DROP.pity;
    s = win(s, 'arena-nature-1');
    expect(s.battle?.reward.egg?.element).toBe('nature');
    expect(s.eggLuck).toBe(0);
  });

  it('counts dry wins and drops at roughly the league chance', () => {
    let drops = 0,
      s = arena();
    for (let i = 0; i < 200; i++) {
      s.eggLuck = 0;
      s = win(s, 'arena-nature-1', now + i * 1000);
      if (s.battle?.reward.egg) drops++;
      else expect(s.eggLuck).toBe(1);
      s = command(s, { type: 'claim' }, now + i * 1000);
      s.eggs = [];
      s.owedEggs = [];
    }
    expect(drops).toBeGreaterThan(5);
    expect(drops).toBeLessThan(45);
  });

  it('keeps an egg won with a full shelf and delivers it when there is room', () => {
    let s = arena();
    while (s.eggs.length < BALANCE.maxEggs) s = run(s, { type: 'buyEgg', species: 'trex', element: 'fire' });
    s.eggLuck = EGG_DROP.pity;
    s = run(win(s, 'arena-nature-1'), { type: 'claim' });
    expect(s.eggs).toHaveLength(BALANCE.maxEggs);
    expect(s.owedEggs).toMatchObject([{ element: 'nature' }]);
    roundTrip(s);
    s = run(s, { type: 'sellEgg', eggId: s.eggs[0].id });
    expect(s.owedEggs).toEqual([]);
    expect(s.eggs.at(-1)).toMatchObject({ element: 'nature', hatchAt: null });
    expect(new Set(s.eggs.map((e) => e.id)).size).toBe(s.eggs.length);
    roundTrip(s);
  });

  it('sells waiting eggs, but not incubating ones or the tutorial egg', () => {
    expect(() => run(newSave(now), { type: 'sellEgg', eggId: 'egg-ignis' })).toThrow('egg');
    let s = run(arena(), { type: 'buyEgg', species: 'trex', element: 'fire' });
    const egg = s.eggs.at(-1)!.id,
      gold = s.gold;
    expect(() => run(run(s, { type: 'incubate', eggId: egg }), { type: 'sellEgg', eggId: egg })).toThrow('egg');
    s = run(s, { type: 'sellEgg', eggId: egg });
    expect(s.gold).toBe(gold + 100);
    expect(s.eggs.some((e) => e.id === egg)).toBe(false);
    s.eggs.push({ id: 'egg-x', species: 'triceratops', element: 'nature', seconds: 300, hatchAt: null });
    expect(run(s, { type: 'sellEgg', eggId: 'egg-x' }).gold).toBe(gold + 400);
  });

  it('loads saves from before egg drops', () => {
    const s = arena() as Partial<Save>;
    delete s.eggLuck;
    delete s.owedEggs;
    expect(parseSave(JSON.stringify(s))).toMatchObject({ eggLuck: 0, owedEggs: [] });
  });
});
