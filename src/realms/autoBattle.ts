import { command, ELEMENTS, foeMove, incomingDamage, strikeAgainst, ULTIMATE_POWER, type Battle, type Dino, type Save } from './game';
import type { BattleAction } from './battleChoreography';

type Board = Pick<Battle, 'energy' | 'enemy' | 'hp' | 'round' | 'enemyEnergy' | 'foes' | 'foeIndex'>;

/**
 * Fights play themselves. The planner picks each round's move for the dinosaur on stage (`d`, the team's active
 * fighter, against the active opponent) so that every fight shows the dinosaur's whole repertoire: it opens with
 * an attack, guards once, and an adult spends its ultimate every time the bar is full (about every third round)
 * and, if it is still unseen, as the finishing blow. It reads the opponent's move (fixed by the round, see
 * `foeMove`): it braces for the opponent's ultimate and never wastes its own into a raised shield.
 * `shown` lists the moves this fighter already played; a fighter stepping in after a relay starts a new list.
 */
export function autoAction(b: Board, d: Pick<Dino, 'level' | 'stage' | 'species' | 'element' | 'rarity'>, shown: ReadonlySet<BattleAction>): BattleAction {
  const adult = d.stage === 'adult';
  const foe = foeMove(b);
  const power = foe === 'ultimate' ? ULTIMATE_POWER : 1;
  const lethal = strikeAgainst(b, d, 'basic') >= b.enemy;
  // Guarding only matters against a blow, and delays the kill by that blow: never when it could end the fight.
  const canGuard = foe !== 'defend' && b.hp > Math.floor(incomingDamage(b, d, true) * power);
  if (lethal) {
    if (adult && !shown.has('ultimate')) return 'ultimate';
    if (!shown.has('defend') && canGuard) return 'defend';
    return 'basic';
  }
  if (!shown.has('basic')) return 'basic';
  if (!shown.has('defend') && canGuard) return 'defend';
  // A full bar is spent at once: the ultimate shows every few rounds, not only near the end.
  if (adult && b.energy >= 100 && foe !== 'defend') return 'ultimate';
  if (foe === 'ultimate' && canGuard) return 'defend';
  // Under heavy pressure, raise the guard again from time to time.
  if (canGuard && b.energy < 100 && b.hp <= Math.floor(incomingDamage(b, d, false) * power) * 2) return 'defend';
  return 'basic';
}

/**
 * Remembers the moves each team member has shown, so the planner restarts its repertoire when a new fighter
 * steps in. One per fight.
 */
export function movesMemory() {
  const byFighter = new Map<string, Set<BattleAction>>();
  return (dinoId: string) => {
    let shown = byFighter.get(dinoId);
    if (!shown) byFighter.set(dinoId, (shown = new Set()));
    return shown;
  };
}

/** The planner's next move in a running fight, for its active fighter; null when the fight is over. */
export function nextMove(s: Save, memory: ReturnType<typeof movesMemory>): BattleAction | null {
  const b = s.battle;
  if (!b || b.result) return null;
  const d = s.dinos.find((x) => x.id === b.dinoId)!;
  const shown = memory(d.id);
  const move = autoAction(b, d, shown);
  shown.add(move);
  return move;
}

/** Plays a running fight to its end with the planner, through the same commands. */
export function autoPlay(s: Save, now: number, memory = movesMemory()): Save {
  for (let move = nextMove(s, memory); move; move = nextMove(s, memory)) s = command(s, { type: 'action', action: move }, now);
  return s;
}

export type Forecast = {
  win: boolean;
  result: 'victory' | 'defeat' | 'draw';
  stars: number;
  /** The team's share of health left, all members together. */
  hpLeft: number;
  /** Team members who would fall. */
  fallen: number;
};
/**
 * Plays the fight in advance with the same rules and planner, for the current arena team, so the arena can tell
 * how hard it will be. Returns null when the team cannot enter it now (locked, resting, no building...).
 */
export function predictFight(save: Save, encounterId: string, now: number): Forecast | null {
  let s: Save;
  try {
    // Forecast combat strength even before the player buys entry; the copy pays the ticket.
    s = command(
      { ...save, battle: null, rewardPending: false, arenaTickets: Object.fromEntries(ELEMENTS.map((e) => [e.id, 1])) },
      { type: 'battle', encounterId },
      now,
    );
  } catch {
    return null;
  }
  const b = autoPlay(s, now).battle!;
  const left = b.team.reduce((n, a) => n + a.hp, 0),
    max = b.team.reduce((n, a) => n + a.maxHp, 0);
  return {
    win: b.result === 'victory',
    result: b.result!,
    stars: b.stars ?? 0,
    hpLeft: left / max,
    fallen: b.team.filter((a) => a.hp === 0).length,
  };
}
