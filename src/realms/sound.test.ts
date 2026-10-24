import { describe, expect, it } from 'vitest';
import { SOUND_IDS, SOUNDS, playSound } from './sound';

describe('sound effects', () => {
  it('defines audible, short voices for every sound', () => {
    for (const id of SOUND_IDS) {
      expect(SOUNDS[id].length, id).toBeGreaterThan(0);
      for (const v of SOUNDS[id]) {
        expect(v.from, id).toBeGreaterThan(0);
        expect(v.to ?? 1, id).toBeGreaterThan(0);
        expect(v.ms, id).toBeGreaterThan(0);
        expect((v.delay ?? 0) + v.ms, id).toBeLessThanOrEqual(1000);
      }
    }
  });
  it('is silent rather than failing where Web Audio is missing', () => {
    expect(() => playSound('hit')).not.toThrow();
  });
});
