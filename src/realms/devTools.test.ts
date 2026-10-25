import { describe, expect, it, vi } from 'vitest';
import { command, newSave } from './game';

// A production build: the test tools are off.
vi.mock('./devTools', () => ({ DEV_TOOLS: false }));

describe('test tools in a production build', () => {
  it('refuse every free resource, timer skip and diamond grant', () => {
    const s = newSave(1_800_000_000_000);
    for (const c of [{ type: 'devSkip' }, { type: 'devResources' }, { type: 'devRarityEggs' }, { type: 'addGems', amount: 100 }] as const)
      expect(() => command(s, c, 1_800_000_000_000), c.type).toThrow('dev');
    // Everything else still works.
    expect(command(s, { type: 'incubate' }, 1_800_000_000_000).eggs[0].hatchAt).not.toBeNull();
  });
});
