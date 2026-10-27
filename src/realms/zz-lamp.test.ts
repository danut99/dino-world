import { it } from 'vitest';
import { newSave, command, parseSave } from './game';
it('dbg', () => {
  const now = Date.now();
  let s = newSave(now);
  s.inventory.lamp = 2;
  s = command(s, { type: 'placeLamp' }, now);
  console.log('SPOTS', JSON.stringify(s.lampSpots), s.lamps);
  const j = JSON.parse(JSON.stringify(s));
  console.log('PARSED', JSON.stringify(j.lampSpots));
  parseSave(JSON.stringify(s));
});
