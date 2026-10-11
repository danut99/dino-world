import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { atlasPageNames } from './atlas-pages';

it('reads atlas textures with Windows and Unix line endings', () => {
  for (const newline of ['\n', '\r\n']) {
    const atlas = ['rig-map.webp', 'size: 1024,434', 'body', '  path: ignored.png', '', 'second.png'].join(newline);
    expect(atlasPageNames(atlas)).toEqual(['rig-map.webp', 'second.png']);
  }
});

it('finds the texture in the shipped Ignisaur map atlas', () => {
  const atlas = readFileSync('public/dinosaurs/ignisaur-pui/rig-map.atlas', 'utf8');
  expect(atlasPageNames(atlas)).toEqual(['rig-map.webp']);
});
