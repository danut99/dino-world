import { describe, expect, it } from 'vitest';
import { weekStart, weekId } from './daily';
import { command, friendlyBattle, newSave, parseSave, type Command, type Dino, type Save, type Stage } from './game';

const now = 1_800_000_000_000;
const run = (s: Save, ...cs: Command[]) => cs.reduce((x, c) => command(x, c, now), s);
/** Ignis hatched at `level`, plus extra copies with the given ids and stages. */
function save(level = 12, stage: Stage = 'juvenile', extra: [string, Stage, number][] = []): Save {
  const s = run(newSave(now), { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' });
  Object.assign(s.dinos[0], { level, stage });
  for (const [id, st, lv] of extra) s.dinos.push({ ...s.dinos[0], id, stage: st, level: lv } as Dino);
  return s;
}

describe('defense team', () => {
  it('starts empty and old saves get an empty one', () => {
    expect(newSave(now).defense).toEqual([]);
    const s = save() as Partial<Save>;
    delete s.defense;
    expect(parseSave(JSON.stringify(s)).defense).toEqual([]);
  });

  it('sets 0 to 3 different juvenile or older dinosaurs', () => {
    const s = save(12, 'juvenile', [
      ['b', 'juvenile', 15],
      ['c', 'adult', 30],
      ['d', 'juvenile', 11],
      ['baby', 'baby', 3],
    ]);
    const id = s.dinos[0].id;
    expect(run(s, { type: 'setDefense', dinoIds: [id, 'b', 'c'] }).defense).toEqual([id, 'b', 'c']);
    expect(run(s, { type: 'setDefense', dinoIds: [] }).defense).toEqual([]);
    expect(() => run(s, { type: 'setDefense', dinoIds: [id, 'b', 'c', 'd'] })).toThrow('team');
    expect(() => run(s, { type: 'setDefense', dinoIds: ['b', 'b'] })).toThrow('team');
    expect(() => run(s, { type: 'setDefense', dinoIds: ['ghost'] })).toThrow('dino');
    expect(() => run(s, { type: 'setDefense', dinoIds: ['baby'] })).toThrow('juvenile');
  });

  it('refuses invalid defense teams on load', () => {
    const s = save();
    s.defense = ['ghost'];
    expect(() => parseSave(JSON.stringify(s))).toThrow();
    s.defense = [s.dinos[0].id, s.dinos[0].id];
    expect(() => parseSave(JSON.stringify(s))).toThrow();
    s.defense = [s.dinos[0].id];
    expect(parseSave(JSON.stringify(s)).defense).toEqual([s.dinos[0].id]);
  });

  it('drops a released dinosaur from the defense', () => {
    const s = run(save(12, 'juvenile', [['b', 'juvenile', 15]]), { type: 'setDefense', dinoIds: ['b'] });
    expect(run(s, { type: 'releaseDino', dinoId: 'b' }).defense).toEqual([]);
  });

  it('friendly fights meet the defense team instead of the arena team', () => {
    const me = save(),
      rival = save(12, 'juvenile', [
        ['tank', 'adult', 40],
        ['young', 'baby', 2],
      ]);
    expect(friendlyBattle(me, rival, 'r', now).battle!.foes.map((f) => f.level)).toEqual([12]);
    rival.defense = ['tank', 'young'];
    expect(friendlyBattle(me, rival, 'r', now).battle!.foes.map((f) => f.level)).toEqual([40]);
    // Only babies or missing dinosaurs: the arena team fights.
    rival.defense = ['young', 'gone'];
    expect(friendlyBattle(me, rival, 'r', now).battle!.foes.map((f) => f.level)).toEqual([12]);
  });

  it('starts the week on Monday midnight in Bucharest', () => {
    const start = weekStart(now);
    expect(start).toBeLessThanOrEqual(now);
    expect(weekId(start)).toBe(weekId(now));
    expect(weekId(start - 1)).not.toBe(weekId(now));
  });
});
