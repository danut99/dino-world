import { describe, expect, it } from 'vitest';
import { ARENA_TICKET_LIMIT, arenaTicketPrice, command, ELEMENTS, newSave, parseSave, type Command, type Save } from './game';
import { autoPlay, predictFight } from './autoBattle';

function ready(): Save {
  const s = newSave(0);
  s.dinos = [{ id: 'hero', species: 'trex', element: 'fire', level: 25, stage: 'adult', nickname: 'Ignis' }];
  s.team = ['hero'];
  s.champion = 'hero';
  s.buildings.push({ id: 'arena', kind: 'arena', x: 6, y: 1 });
  return s;
}

describe('elemental arena tickets', () => {
  it('costs five times the league base level, from 50 (fire) to 230 (arcane)', () => {
    expect(ELEMENTS.map((e) => arenaTicketPrice(e.id))).toEqual([50, 70, 90, 110, 130, 150, 170, 190, 210, 230]);
  });
  it('buys a batch with gold and persists the elemental stock', () => {
    const s = ready();
    const bought = command(s, { type: 'buyArenaTicket', realm: 'fire', quantity: 5 }, 0);
    expect(bought.gold).toBe(s.gold - 50 * 5);
    expect(bought.arenaTickets).toEqual({ fire: 5 });
    expect(s.arenaTickets).toEqual({});
    expect(parseSave(JSON.stringify(bought))).toEqual(bought);
  });
  it('rejects invalid purchases, locked worlds, missing gold and excessive stock', () => {
    const s = ready();
    for (const quantity of [-1, 0, 1.5, 100, NaN])
      expect(() => command(s, { type: 'buyArenaTicket', realm: 'fire', quantity }, 0)).toThrow('ticket');
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'water', quantity: 1 }, 0)).toThrow('locked');
    s.habitats.lightning = 1;
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'lightning', quantity: 1 }, 0)).toThrow('gate');
    s.arenaLevel = 2;
    const lightning = command(s, { type: 'buyArenaTicket', realm: 'lightning', quantity: 1 }, 0);
    expect(lightning.arenaTickets.lightning).toBe(1);
    expect(lightning.gold).toBe(s.gold - 150);
    s.gold = 49;
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'fire', quantity: 1 }, 0)).toThrow('gold');
    s.gold = 1000;
    s.arenaTickets.fire = ARENA_TICKET_LIMIT;
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'fire', quantity: 1 }, 0)).toThrow('ticketLimit');
  });
  it('never sells tickets for diamonds and never refills them with time', () => {
    const s = ready();
    s.gems = 500;
    s.gold = 0;
    expect(() => command(s, { type: 'buyArenaTicket', realm: 'fire', quantity: 1 }, 0)).toThrow('gold');
    // Diamonds buy time only: there is no trade of diamonds for tickets (or anything else).
    expect(() => command(s, { type: 'gemTrade', offer: 'gold' } as unknown as Command, 0)).toThrow();
    const later = command(s, { type: 'collectAvailable' }, 7 * 24 * 3_600_000);
    expect(later.arenaTickets).toEqual({});
    expect(later.gems).toBe(500);
  });
  it('requires the league element and spends exactly one when the fight starts', () => {
    const s = ready();
    s.arenaTickets = { water: 2 };
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 0)).toThrow('arenaTicket');
    s.arenaTickets.fire = 2;
    const started = command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 0);
    expect(started.arenaTickets).toEqual({ fire: 1, water: 2 });
    const resumed = parseSave(JSON.stringify(started));
    expect(resumed).toEqual(started);
    expect(command(resumed, { type: 'action', action: 'basic' }, 0).arenaTickets).toEqual(started.arenaTickets);
    expect(() => command(started, { type: 'battle', encounterId: 'arena-fire-1' }, 0)).toThrow();
    // A lost fight keeps the ticket spent.
    const lost = autoPlay(command({ ...s, dinos: [{ ...s.dinos[0], element: 'nature', level: 14, stage: 'juvenile' }], stars: { 'arena-fire-1': 2, 'arena-fire-2': 2 } }, { type: 'battle', encounterId: 'arena-fire-3' }, 0), 0);
    expect(lost.battle!.result).toBe('defeat');
    expect(lost.arenaTickets.fire).toBe(1);
  });
  it('gives the ticket back on a draw', () => {
    const s = ready();
    s.arenaTickets.fire = 1;
    let fight = command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 0);
    // Guarding forever never ends the fight: it runs out of rounds (25 per opponent).
    while (!fight.battle!.result) fight = command(fight, { type: 'action', action: 'defend' }, 0);
    expect(fight.battle!.result).toBe('draw');
    expect(fight.arenaTickets.fire).toBe(1);
    expect(fight.rewardPending).toBe(false);
    expect(fight.tired.hero).toBe(20 * 60_000);
    const back = command(fight, { type: 'claim' }, 0);
    expect(back.battle).toBeNull();
    expect(back.arenaTickets.fire).toBe(1);
  });
  it('keeps tickets on rejected entry and leaves forecasts free', () => {
    const s = ready();
    s.arenaTickets.fire = 1;
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-2' }, 0)).toThrow('stars');
    expect(s.arenaTickets.fire).toBe(1);
    expect(() => command(s, { type: 'battle', encounterId: 'training' }, 0)).toThrow('encounter');
    s.arenaTickets = {};
    expect(predictFight(s, 'arena-fire-1', 0)).not.toBeNull();
    expect(s.arenaTickets).toEqual({});
  });
  it('rejects invalid stocks on load', () => {
    const s = ready();
    for (const stock of [null, [], { fire: -1 }, { fire: 0.1 }, { fire: ARENA_TICKET_LIMIT + 1 }, { unknown: 1 }])
      expect(() => parseSave(JSON.stringify({ ...s, arenaTickets: stock }))).toThrow('Invalid arena tickets');
  });
});
