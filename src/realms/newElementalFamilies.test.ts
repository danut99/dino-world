import { expect, it } from 'vitest';
import { command, MARKET_ELEMENTS, newSave, parseSave, type Species, type RealmId } from './game';
import { isPlayableDinosaur, playableSpecies } from './playableDinosaurs';

it('preserves all new families and their existing market or battle egg acquisition rules', () => {
  const now = 1_800_000_000_000;
  for (const [species, element] of [
    ['ignasaur', 'fire'], ['thalassaur', 'water'], ['terrasaur', 'earth'],
    ['therizinosaurus', 'ice'], ['quetzalcoatlus', 'wind'], ['dilophosaurus', 'dark'],
    ['ankylobiped', 'lightning'], ['solarraptor', 'light'], ['cryptoraptor', 'arcane'],
  ] as [Species, RealmId][]) {
    expect(isPlayableDinosaur(species, element)).toBe(true);
    expect(playableSpecies(element)).toContain(species);
    const save = newSave(now);
    save.gold = 100_000;
    save.buildings.push({ id: 'market', kind: 'market', x: 6, y: 1 });
    save.habitats.water = 1;
    save.habitats.earth = 1;
    save.habitats[element] = 1;
    const bought = MARKET_ELEMENTS.includes(element)
      ? command(save, { type: 'buyEgg', species, element }, now)
      : { ...save, eggs: [...save.eggs, { id: `reward-${species}`, species, element, seconds: 300, hatchAt: null }] };
    if (!MARKET_ELEMENTS.includes(element))
      expect(() => command(save, { type: 'buyEgg', species, element }, now)).toThrow('fightEgg');
    expect(bought.eggs.at(-1)).toMatchObject({ species, element });
    bought.dinos.push({ id: `new-${species}`, species, element, level: 25, stage: 'adult', nickname: species });
    bought.champion = `new-${species}`;
    const loaded = parseSave(JSON.stringify(bought));
    expect(loaded.eggs.at(-1)).toMatchObject({ species, element });
    expect(loaded.dinos.find(d => d.id === `new-${species}`)).toMatchObject({ species, element, stage: 'adult' });
  }
  expect(isPlayableDinosaur('ignasaur', 'water')).toBe(false);
  expect(isPlayableDinosaur('thalassaur', 'fire')).toBe(false);
});
