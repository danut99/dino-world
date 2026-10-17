import { expect, it } from 'vitest';
import { BUILDABLE_CELLS, buildable } from './grid';

it('extends the buildable lawn beyond the original 12×12 square without losing any of it', () => {
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) expect(buildable(x, y)).toBe(true);
  expect(BUILDABLE_CELLS.length).toBeGreaterThan(144 + 60);
  // Wider on the left and right of the island, but never off its edges.
  expect(buildable(14, 0)).toBe(true);
  expect(buildable(-3, 10)).toBe(true);
  expect(buildable(-3, -3)).toBe(false);
  expect(buildable(14, 14)).toBe(false);
});
