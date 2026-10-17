import { expect, it } from 'vitest';
import { buildingLevel, tierArt } from './buildingTiers';
import { newSave } from './game';

it('changes building art at milestone levels only', () => {
  const s = newSave(0);
  const farm = (level: number) => tierArt({ ...s, farmLevel: level }, 'farm');
  expect([1, 2, 3, 4, 5].map(farm)).toEqual([
    null,
    null,
    '/realms/buildings/farm-2.webp',
    '/realms/buildings/farm-2.webp',
    '/realms/buildings/farm-3.webp',
  ]);
  expect([1, 2, 3].map((level) => tierArt({ ...s, hatcheryLevel: level }, 'hatchery'))).toEqual([
    null,
    '/realms/buildings/hatchery-2.webp',
    '/realms/buildings/hatchery-3.webp',
  ]);
  expect(tierArt(s, 'workshop')).toBeNull();
  expect(tierArt(s, 'portal')).toBeNull();
  expect(buildingLevel(s, 'farm')).toEqual({ level: 1, max: 5 });
  expect(buildingLevel(s, 'arena')).toEqual({ level: 1, max: 2 });
  expect(buildingLevel(s, 'workshop')).toEqual({ level: 1, max: 3 });
  expect(buildingLevel(s, 'portal')).toBeNull();
  expect(tierArt({ ...s, workshopLevel: 3 }, 'workshop')).toBe('/realms/buildings/workshop-3.webp');
  expect(tierArt({ ...s, arenaLevel: 2 }, 'arena')).toBe('/realms/buildings/arena-2.webp');
});
