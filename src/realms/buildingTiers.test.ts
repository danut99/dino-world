import { expect, it } from 'vitest';
import { buildingLevel, tierArt } from './buildingTiers';
import { newSave } from './game';

const px = (name: string) => `/realms/buildings/px/${name}.png`;

it('changes building art at milestone levels only', () => {
  const s = newSave(0);
  const farm = (level: number) => tierArt({ ...s, farmLevel: level }, 'farm');
  const farmState = (level: number) => `/realms/buildings/farm-states/level-${level}.png`;
  expect([1, 2, 3].map(farm)).toEqual([farmState(1), farmState(2), farmState(3)]);
  expect([1, 2, 3].map((level) => tierArt({ ...s, hatcheryLevel: level }, 'hatchery'))).toEqual([
    px('hatchery-1'),
    px('hatchery-2'),
    px('hatchery-3'),
  ]);
  expect(tierArt(s, 'workshop')).toBe(px('workshop-1'));
  expect(tierArt({ ...s, workshopLevel: 3 }, 'workshop')).toBe(px('workshop-3'));
  expect(tierArt({ ...s, arenaLevel: 2 }, 'arena')).toBe(px('arena-2'));
  expect(tierArt(s, 'market')).toBe(px('market-1'));
  // Portalul își păstrează animația proprie (animatedPortal.ts).
  expect(tierArt(s, 'portal')).toBeNull();
  expect(buildingLevel(s, 'farm')).toEqual({ level: 1, max: 3 });
  expect(buildingLevel(s, 'arena')).toEqual({ level: 1, max: 2 });
  expect(buildingLevel(s, 'workshop')).toEqual({ level: 1, max: 3 });
  expect(buildingLevel(s, 'portal')).toBeNull();
});
