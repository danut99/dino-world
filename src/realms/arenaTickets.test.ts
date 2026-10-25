import { describe, expect, it } from 'vitest';
import { ARENA_TICKET_LIMIT, ARENA_TICKET_PRICE, command, newSave, parseSave, type Save } from './game';
import { predictFight } from './autoBattle';

function ready(): Save {
  const s = newSave(0);
  s.dinos = [{ id: 'hero', species: 'trex', element: 'fire', level: 25, stage: 'adult', nickname: 'Ignis' }];
  s.champion = 'hero';
  s.buildings.push({ id: 'arena', kind: 'arena', x: 6, y: 1 });
  return s;
}

describe('elemental arena tickets', () => {
  it('buys a batch with gold and persists the elemental stock', () => {
    const s = ready();
    const bought = command(s, { type: 'buyArenaTicket', realm: 'fire', quantity: 5 }, 0);
    expect(bought.gold).toBe(s.gold - ARENA_TICKET_PRICE * 5);
    expect(bought.arenaTickets).toEqual({ fire: 5 });
    expect(s.arenaTickets).toEqual({});
    expect(parseSave(JSON.stringify(bought))).toEqual(bought);
  });
  it('rejects invalid purchases, locked leagues, missing gold and excessive stock', () => {
    const s = ready();
    for (const quantity of [-1, 0, 1.5, 100, NaN])
      expect(() => command(s, { type: 'buyArenaTicket', realm: 'fire', quantity }, 0)).toThrow('ticket');
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'water', quantity: 1 }, 0)).toThrow('locked');
    s.habitats.lightning = 1;
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'lightning', quantity: 1 }, 0)).toThrow('gate');
    s.arenaLevel = 2;
    expect(command(s, { type: 'buyArenaTicket', realm: 'lightning', quantity: 1 }, 0).arenaTickets.lightning).toBe(1);
    s.gold = 0;
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'fire', quantity: 1 }, 0)).toThrow('gold');
    s.arenaTickets.fire = ARENA_TICKET_LIMIT;
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'fire', quantity: 1 }, 0)).toThrow('ticketLimit');
  });
  it('requires the correct element and consumes exactly one on a successful start', () => {
    const s = ready(); s.arenaTickets = { water: 2 };
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 0)).toThrow('arenaTicket');
    s.arenaTickets.fire = 2;
    const started = command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 0);
    expect(started.arenaTickets).toEqual({ fire: 1, water: 2 });
    const resumed = parseSave(JSON.stringify(started));
    expect(resumed.arenaTickets).toEqual(started.arenaTickets);
    expect(command(resumed, { type: 'action', action: 'basic' }, 0).arenaTickets).toEqual(started.arenaTickets);
    expect(() => command(started, { type: 'battle', encounterId: 'arena-fire-1' }, 0)).toThrow();
    expect(s.arenaTickets.fire).toBe(2);
  });
  it('keeps tickets on rejected entry and leaves training and forecasts free', () => {
    const s = ready(); s.arenaTickets.fire = 1;
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-2' }, 0)).toThrow('stars');
    expect(s.arenaTickets.fire).toBe(1);
    expect(command(s, { type: 'battle', encounterId: 'training' }, 0).arenaTickets.fire).toBe(1);
    s.arenaTickets = {};
    expect(predictFight(s, 'arena-fire-1', 0)).not.toBeNull();
    expect(s.arenaTickets).toEqual({});
  });
  it('loads older saves and ongoing fights without charging a retroactive ticket', () => {
    const s = ready(); s.arenaTickets.fire = 1;
    const started = command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 0);
    const { arenaTickets: _, ...old } = started;
    const loaded = parseSave(JSON.stringify(old));
    expect(loaded.arenaTickets).toEqual({});
    expect(loaded.battle).toEqual(started.battle);
    for (const stock of [null, [], { fire: -1 }, { fire: 0.1 }, { fire: ARENA_TICKET_LIMIT + 1 }, { unknown: 1 }])
      expect(() => parseSave(JSON.stringify({ ...s, arenaTickets: stock }))).toThrow('Invalid arena tickets');
  });
});
