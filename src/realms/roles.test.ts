import { describe, expect, it } from 'vitest';
import { arenaFoes, type Foe } from './arenaTeams';
import { calloutText } from './battleCallouts';
import { exchange, fighter } from './battleChoreography';
import {
  ARENA_LEVELS,
  ELEMENTS,
  ROLE_EFFECTS,
  ROLE_ICONS,
  ROLE_INFO,
  ROLE_NAMES,
  SPECIES,
  SPECIES_ROLE,
  command,
  incomingDamage,
  newSave,
  strikeAgainst,
  type Battle,
  type Dino,
  type Save,
  type Species,
} from './game';
import { ENCOUNTERS } from './content';

const ENCOUNTER = 'arena-fire-2';
function ready(species: Species[], level = 30): Save {
  const s = newSave(0);
  s.arenaTickets = Object.fromEntries(ELEMENTS.map((e) => [e.id, 100]));
  s.dinos = species.map(
    (sp, i): Dino => ({ id: `d${i}`, species: sp, element: 'water', level, stage: 'adult', nickname: `T${i}` }),
  );
  s.team = s.dinos.map((d) => d.id);
  s.champion = 'd0';
  s.habitats = Object.fromEntries(ELEMENTS.map((e) => [e.id, 1]));
  s.arenaLevel = ARENA_LEVELS.length;
  s.cleared = ENCOUNTERS.map((e) => e.id);
  s.stars = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, 3]));
  s.buildings = [{ id: 'a', kind: 'arena', x: 0, y: 0 }];
  return s;
}
const start = (species: Species[]) => command(ready(species), { type: 'battle', encounterId: ENCOUNTER }, 0);
/** A foe of the encounter's first slot, recast as another species with the same stats. */
const withFoe = (s: Save, species: Species, patch: Partial<Foe> = {}) => {
  const b = s.battle!;
  b.foes[0] = { ...b.foes[0], species, ...patch };
  return s;
};
const d = (s: Save, i = 0) => s.dinos[i];

describe('species roles', () => {
  it('gives every species a role with a name, an icon and a description', () => {
    for (const sp of [...SPECIES, 'boss' as const]) {
      const role = SPECIES_ROLE[sp];
      expect(role, sp).toBeDefined();
      expect(ROLE_NAMES[role]).toHaveLength(2);
      expect(ROLE_ICONS[role]).toBeTruthy();
      expect(ROLE_INFO[role]).toHaveLength(2);
    }
    expect(SPECIES_ROLE.boss).toBe('attacker');
  });

  it('halves only the first blow a tank takes on stage', () => {
    const s = start(['ankylosaurus']);
    const b = s.battle!;
    const shielded = incomingDamage(b, d(s), false);
    b.team[0].shieldUsed = true;
    const plain = incomingDamage(b, d(s), false);
    expect(shielded).toBeLessThan(plain);
    expect(Math.abs(shielded - plain * ROLE_EFFECTS.shield)).toBeLessThanOrEqual(1);
    // Through the reducer: round 1 the foe attacks and the shield fires once, round 3 the blow is whole.
    let t = start(['ankylosaurus']);
    t = command(t, { type: 'action', action: 'basic' }, 0);
    expect(t.battle!.report!.abilities).toContainEqual({ on: 'ally', kind: 'shield' });
    expect(t.battle!.team[0].shieldUsed).toBe(true);
    t = command(t, { type: 'action', action: 'basic' }, 0);
    t = command(t, { type: 'action', action: 'basic' }, 0);
    expect(t.battle!.report!.abilities ?? []).not.toContainEqual({ on: 'ally', kind: 'shield' });
  });

  it('shields a foe tank against the first strike only', () => {
    const s = withFoe(start(['trex']), 'triceratops');
    const first = strikeAgainst(s.battle!, d(s), 'basic');
    const t = command(s, { type: 'action', action: 'basic' }, 0);
    expect(t.battle!.report!.dealt).toBe(first);
    expect(t.battle!.report!.abilities).toContainEqual({ on: 'enemy', kind: 'shield' });
    expect(strikeAgainst({ ...t.battle!, round: 1 }, d(t), 'basic')).toBeGreaterThan(first);
  });

  it('lets an attacker strike 20% harder below half health', () => {
    const s = withFoe(start(['trex']), 'raptor');
    const b: Battle = s.battle!;
    const healthy = strikeAgainst(b, d(s), 'basic');
    const raging = strikeAgainst({ ...b, hp: Math.floor(b.maxHp * 0.49) }, d(s), 'basic');
    expect(Math.abs(raging - healthy * ROLE_EFFECTS.rage)).toBeLessThanOrEqual(1);
    expect(raging).toBeGreaterThan(healthy);
    expect(strikeAgainst({ ...b, hp: Math.ceil(b.maxHp * 0.5) }, d(s), 'basic')).toBe(healthy);
  });

  it('softens blows while a support waits on the bench, and not once it has fallen', () => {
    const s = start(['trex', 'brachiosaurus']);
    const b = s.battle!;
    const aura = incomingDamage(b, d(s), false);
    const alone = incomingDamage({ ...b, team: [b.team[0], { ...b.team[1], hp: 0 }] }, d(s), false);
    expect(aura).toBeLessThan(alone);
    expect(Math.abs(aura - alone * ROLE_EFFECTS.aura)).toBeLessThanOrEqual(1);
    const t = command(s, { type: 'action', action: 'basic' }, 0);
    expect(t.battle!.report!.abilities).toContainEqual({ on: 'ally', kind: 'aura' });
  });

  it('heals a support on stage once, as soon as a heal is missing', () => {
    let s = start(['thalassaur']);
    const b = s.battle!,
      amount = Math.round(b.maxHp * ROLE_EFFECTS.heal);
    b.team[0].hp = b.hp = b.maxHp - amount - 50;
    s = command(s, { type: 'action', action: 'defend' }, 0);
    const r = s.battle!.report!;
    expect(r.abilities).toContainEqual({ on: 'ally', kind: 'heal', amount });
    expect(s.battle!.team[0].healed).toBe(true);
    expect(r.hpAfter).toBe(b.maxHp - amount - 50 - r.taken + amount);
    // Never twice.
    s.battle!.team[0].hp = s.battle!.hp = 100;
    s = command(s, { type: 'action', action: 'basic' }, 0);
    expect((s.battle!.report!.abilities ?? []).some((a) => a.kind === 'heal')).toBe(false);
  });

  it('keeps fights replayable and calls the abilities out', () => {
    const play = () => {
      let s = start(['brachiosaurus', 'raptor', 'ankylosaurus']);
      while (!s.battle!.result) s = command(s, { type: 'action', action: 'basic' }, 0);
      return s.battle!;
    };
    expect(play()).toEqual(play());
    const steps = exchange(
      {
        ally: 'basic',
        foe: 'attack',
        dealt: 0,
        enemyAfterStrike: 100,
        taken: 10,
        dodged: false,
        reflected: 0,
        hpAfter: 90,
        enemyAfter: 100,
        abilities: [
          { on: 'enemy', kind: 'swift' },
          { on: 'ally', kind: 'shield' },
          { on: 'ally', kind: 'heal', amount: 15 },
        ],
      },
      fighter(null),
      fighter(null),
      { ally: true, enemy: true },
    );
    const said = steps.flatMap((x) => x.say ?? []);
    expect(said).toContainEqual({ on: 'enemy', kind: 'swift' });
    expect(said).toContainEqual({ on: 'ally', kind: 'shield' });
    expect(steps.some((x) => x.dodge === 'enemy')).toBe(true);
    // The blow reveals the health before the heal, the heal beat the final health.
    expect(steps.find((x) => x.reveal === 'ally' && x.say?.some((c) => c.kind === 'damage'))!.revealHp).toBe(75);
    expect(steps.find((x) => x.say?.some((c) => c.kind === 'heal'))!.revealHp).toBe(90);
    expect(calloutText({ on: 'ally', kind: 'heal', amount: 15 }, 0)).toBe('VINDECARE +15');
    expect(calloutText({ on: 'ally', kind: 'rage' }, 1)).toBe('RAGE!');
    expect(arenaFoes(ENCOUNTER).length).toBeGreaterThan(0);
  });
});
