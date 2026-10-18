import { expect, it } from 'vitest';
import { BUILDABLE_CELLS, buildable } from './grid';

it('extends the buildable lawn beyond the original 12×12 square without losing any of it', () => {
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) expect(buildable(x, y)).toBe(true);
  // Insula mare (PixelLab, extinsă) are de peste trei ori suprafața blocului vechi, dar nu iese de pe platou.
  expect(BUILDABLE_CELLS.length).toBeGreaterThan(144 * 3);
  expect(buildable(-3, 10)).toBe(true);
  expect(buildable(-14, -14)).toBe(false);
  expect(buildable(26, 26)).toBe(false);
});
