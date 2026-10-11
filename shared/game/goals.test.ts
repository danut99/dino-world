import { expect, it } from 'vitest';
import { ATLAS_REWARD, GOALS, currentGoal, newGame, runCommand, speciesOf, type GameState } from './index';

const NOW = 1000;
function ok(state: GameState, cmd: Parameters<typeof runCommand>[1]) {
  const r = runCommand(state, cmd, NOW);
  expect(r.ok, r.ok ? '' : r.error).toBe(true);
  return r;
}

it('walks the goals in order and pays each reward once', () => {
  let s = newGame(NOW, 1);
  expect(currentGoal(s)?.id).toBe(GOALS[0].id);
  expect(runCommand(s, { type: 'claimGoal', goalId: 'world' }, NOW).ok).toBe(false);
  s = ok(s, { type: 'unlockWorld', element: 'fire' }).state;
  const gold = s.gold;
  const r = ok(s, { type: 'claimGoal', goalId: 'world' });
  expect(r.state.gold).toBe(gold + GOALS[0].reward.gold!);
  expect(r.ok ? r.events : []).toContainEqual(expect.objectContaining({ type: 'reward' }));
  expect(currentGoal(r.state)?.id).toBe(GOALS[1].id);
  expect(runCommand(r.state, { type: 'claimGoal', goalId: 'world' }, NOW).ok).toBe(false);
});

it('pays gems for a complete atlas line, by rarity, once', () => {
  let s = newGame(NOW, 1);
  const species = s.dinos[0].species;
  expect(runCommand(s, { type: 'claimAtlas', species }, NOW).ok).toBe(false);
  s.dinos[0].level = 10;
  const gems = s.gems;
  s = ok(s, { type: 'claimAtlas', species }).state;
  expect(s.gems).toBe(gems + ATLAS_REWARD[speciesOf(species).rarity]);
  expect(runCommand(s, { type: 'claimAtlas', species }, NOW).ok).toBe(false);
});

it('guides a new player through gold, hatching, feeding, harvesting and upgrading', () => {
  expect(GOALS.filter((g) => g.intro).map((g) => g.id)).toEqual([
    'world',
    'gold1',
    'egg',
    'feed1',
    'harvest',
    'habitat2',
  ]);
  let s = newGame(NOW, 1);
  s = ok(s, { type: 'unlockWorld', element: 'fire' }).state;
  s = ok(s, { type: 'claimGoal', goalId: 'world' }).state;
  expect(currentGoal(s)?.id).toBe('gold1');
  const home = s.buildings.find((b) => b.kind === 'habitat')!;
  s = ok(s, { type: 'collect', buildingId: home.id }).state;
  expect(currentGoal(s)?.done(s)).toBe(false);
  const collected = runCommand(s, { type: 'collectAll' }, NOW + 60_000);
  expect(collected.ok).toBe(true);
  s = ok(collected.state, { type: 'claimGoal', goalId: 'gold1' }).state;
  expect(currentGoal(s)?.id).toBe('egg');
  s = ok(s, { type: 'buyHabitatEgg', element: 'fire' }).state;
  const egg = s.eggs[0];
  expect(runCommand(s, { type: 'hatch', eggId: egg.id, habitatId: home.id }, NOW).ok).toBe(false);
  const hatched = runCommand(s, { type: 'hatch', eggId: egg.id, habitatId: home.id }, egg.hatchAt);
  expect(hatched.ok).toBe(true);
  s = ok(hatched.state, { type: 'claimGoal', goalId: 'egg' }).state;
  expect(currentGoal(s)?.id).toBe('feed1');
  s = ok(s, { type: 'feed', dinoId: s.dinos[0].id }).state;
  s = ok(s, { type: 'claimGoal', goalId: 'feed1' }).state;
  expect(currentGoal(s)?.id).toBe('harvest');
  const farm = s.buildings.find((b) => b.kind === 'farm')!;
  s = ok(s, { type: 'plant', farmId: farm.id, cropId: 'ferigi' }).state;
  const later = runCommand(s, { type: 'collectAll' }, NOW + 60_000);
  expect(later.ok).toBe(true);
  if (!later.ok) return;
  expect(later.events).toContainEqual({ type: 'harvested', food: 10 });
  s = ok(later.state, { type: 'claimGoal', goalId: 'harvest' }).state;
  expect(currentGoal(s)?.id).toBe('habitat2');
  expect(currentGoal(s)?.done(s)).toBe(false);
  const savings = runCommand(s, { type: 'collectAll' }, egg.hatchAt + 3_600_000);
  expect(savings.ok).toBe(true);
  s = ok(savings.state, { type: 'upgrade', buildingId: home.id }).state;
  s = ok(s, { type: 'claimGoal', goalId: 'habitat2' }).state;
  expect(currentGoal(s)?.id).toBe('feed');
});

it('preserves progress for existing players who already claimed the egg goal', () => {
  const s = newGame(NOW, 1);
  s.goalsClaimed = ['world', 'egg'];
  expect(currentGoal(s)?.id).toBe('gold1');
  expect(currentGoal(s)?.done(s)).toBe(true);
});
