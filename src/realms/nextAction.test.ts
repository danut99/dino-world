import { describe, expect, it } from 'vitest';
import { nextAction } from './nextAction';
import { command, newSave, type Command, type Save } from './game';

describe('what to do now', () => {
  const start = () => {
    let s: Save = newSave(0);
    const run = (c: Command, now = 0) => (s = command(s, c, now));
    run({ type: 'incubate' });
    run({ type: 'hatch' }, 30_000);
    return { get: () => s, run };
  };

  it('says nothing before the first dinosaur (the guide leads there)', () => {
    expect(nextAction(newSave(0), 0)).toBeNull();
  });

  it('puts a finished story step first', () => {
    const { get } = start();
    expect(nextAction(get(), 30_000)?.id).toBe('story-claim');
  });

  it('always offers something or says what it waits for', () => {
    const { get, run } = start();
    run({ type: 'claimQuestEgg', questId: 'c1-hatch' }, 30_000);
    const next = nextAction(get(), 30_000);
    expect(next).not.toBeNull();
    expect(next!.text[0].length).toBeGreaterThan(0);
    expect(next!.why[0].length).toBeGreaterThan(0);
  });
});
