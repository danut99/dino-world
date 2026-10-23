import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ELEMENTS } from './game';

it('provides a thirteen-frame 64px hatching strip for every realm', () => {
  for (const { id } of ELEMENTS) {
    const png = readFileSync(new URL(`../../public/realms/eggs/${id}-hatch.png`, import.meta.url));
    expect(png.subarray(1, 4).toString(), id).toBe('PNG');
    expect(png.readUInt32BE(16), id).toBe(64 * 13);
    expect(png.readUInt32BE(20), id).toBe(64);
  }
});
