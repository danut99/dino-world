import { describe, expect, it } from 'vitest';
import { newSave, STORY_CHAPTERS, command, parseSave, feedCost, type Command } from './game';
import { REGIONS } from './content';
import { stageMs, stageReward } from './expeditionRules';
import { collectionTargets, nextStoryStep } from './journey';

describe('guided discovery', () => {
  it('loads progress saved during the discarded story scenes without replaying completed opening goals', () => {
    const s = newSave(0);
    s.questEggs = ['c1-hatch', 'c1-farm', 'c1-plant', 'c1-harvest', 'c1-grow'];
    const loaded = parseSave(JSON.stringify({ ...s, narrative: { seen: ['island'], planted: true, harvested: true } }));
    expect(loaded.questEggs).toContain('w-earth-market');
    expect(loaded.questEggs).not.toContain('c1-plant');
    expect(loaded.questEggs).not.toContain('c1-harvest');
    expect(loaded.gold).toBe(s.gold);
    expect(loaded.food).toBe(s.food);
    expect('narrative' in loaded).toBe(false);
  });
  it('suggests open-world families and routes an existing egg to the hatchery', () => {
    const s = newSave(0);
    const targets = collectionTargets(s);
    expect(targets.every((t) => t.element === 'fire')).toBe(true);
    expect(targets.find((t) => t.species === 'trex')?.route).toBe('hatchery');
    expect(targets.find((t) => t.species === 'ignasaur')?.route).toBe('journey');
    s.discovered = ['trex_fire', 'ignasaur_fire'];
    expect(collectionTargets(s)).toEqual([]);
  });
  it('keeps chapter boundaries and skips already claimed goals in older saves', () => {
    const s = newSave(0);
    s.questEggs = ['w-earth-market'];
    expect(nextStoryStep(s)?.id).toBe('c1-farm');
    s.questEggs = STORY_CHAPTERS[0].steps.slice(0, -1).map((q) => q.id);
    expect(nextStoryStep(s)?.id).toBe('w-water-open');
    s.questEggs = STORY_CHAPTERS.flatMap((c) => c.steps.map((q) => q.id));
    expect(nextStoryStep(s)).toBeUndefined();
  });
  it('speeds up the first region without reducing its one-time rewards', () => {
    expect(REGIONS[0].minutes.reduce((a, b) => a + b, 0)).toBe(24);
    expect(stageMs('training', 1)).toBe(2 * 60_000);
    expect(stageReward('training', 1)).toMatchObject({ gold: 25, food: 10 });
  });
  it('reaches the first expedition from a new save with earned resources, no dev commands or egg purchase', () => {
    let now = 0;
    let s = newSave(now);
    const run = (c: Command) => {
      s = command(s, c, now);
    };
    run({ type: 'incubate' });
    now = 30_000;
    run({ type: 'hatch' });
    run({ type: 'claimQuestEgg', questId: 'c1-hatch' });
    run({ type: 'build', kind: 'farm', x: 5, y: 8 });
    run({ type: 'claimQuestEgg', questId: 'c1-farm' });
    run({ type: 'build', kind: 'market', x: 6, y: 1 });
    run({ type: 'claimQuestEgg', questId: 'w-earth-market' });
    const dino = s.dinos[0].id;
    while (s.dinos[0].level < 9) run({ type: 'feed', dinoId: dino });
    expect(s.food).toBeGreaterThanOrEqual(feedCost(9));
    run({ type: 'evolve', dinoId: dino });
    run({ type: 'claimQuestEgg', questId: 'c1-grow' });
    run({ type: 'build', kind: 'portal', x: 8, y: 5 });
    run({ type: 'claimQuestEgg', questId: 'c1-portal' });
    run({ type: 'expedition', regionId: 'training', team: [dino] });
    expect(s.expeditions[0].endsAt).toBe(now + 60_000);
    now += 60_000;
    run({ type: 'claimExpedition' });
    expect(s.expeditionProgress.training).toBe(1);
    expect(s.gold).toBeGreaterThanOrEqual(0);
    expect(s.food).toBeGreaterThanOrEqual(0);
    expect(s.eggs).toHaveLength(0);
    expect(parseSave(JSON.stringify(s)).expeditionProgress.training).toBe(1);
  });
});
