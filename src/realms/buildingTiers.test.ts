import { expect, it } from 'vitest';
import { buildingLevel, tierArt } from './buildingTiers';
import { hatcherySlots, newSave } from './game';

const px = (name: string) => `/realms/buildings/px/${name}.png`;

it('changes building art at milestone levels only', () => {
  const s = newSave(0);
  const farm = (level: number) => tierArt({ ...s, farmLevel: level }, 'farm');
  const farmState = (level: number) => `/realms/buildings/farm-states/level-${level}.webp`;
  expect([1, 2, 3].map(farm)).toEqual([farmState(1), farmState(2), farmState(3)]);
  expect([1, 2, 3].map((level) => tierArt({ ...s, hatcheryLevel: level }, 'hatchery'))).toEqual([
    '/realms/buildings/hatchery-states/level-1.png',
    '/realms/buildings/hatchery-states/level-2.png',
    '/realms/buildings/hatchery-states/level-3.png',
  ]);
  expect(tierArt(s, 'workshop')).toBe('/realms/buildings/workshop-states/level-1.webp');
  expect(tierArt({ ...s, workshopLevel: 3 }, 'workshop')).toBe('/realms/buildings/workshop-states/level-3.webp');
  expect(tierArt({ ...s, arenaLevel: 2 }, 'arena')).toBe(px('arena-2'));
  expect(tierArt(s, 'market')).toBe(px('market-1'));
  // Portalul își păstrează animația proprie (animatedPortal.ts).
  expect(tierArt(s, 'portal')).toBeNull();
  expect(buildingLevel(s, 'farm')).toEqual({ level: 1, max: 3 });
  expect(buildingLevel(s, 'arena')).toEqual({ level: 1, max: 2 });
  expect(buildingLevel(s, 'workshop')).toEqual({ level: 1, max: 3 });
  expect(buildingLevel(s, 'portal')).toBeNull();
  expect([1, 2, 3].map(hatcheryLevel => hatcherySlots({ ...s, hatcheryLevel }))).toEqual([1, 3, 5]);
});
