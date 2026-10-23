import { command, foeMove, incomingDamage, strikeAgainst, ULTIMATE_POWER, type Battle, type Dino, type Save } from './game';
import type { BattleAction } from './battleChoreography';

/**
 * Fights play themselves. The planner picks each round's move so that every fight shows the dinosaur's whole
 * repertoire: it opens with an attack, guards once, and an adult spends its ultimate every time the bar is full
 * (about every third round) and, if it is still unseen, as the finishing blow. It reads the opponent's move (fixed by the round, see
 * `foeMove`): it braces for the opponent's ultimate and never wastes its own into a raised shield.
 * `shown` lists the moves already played in this fight.
 */
export function autoAction(
  b: Pick<Battle, 'encounterId' | 'energy' | 'enemy' | 'hp' | 'round' | 'enemyEnergy'>,
  d: Pick<Dino, 'level' | 'stage' | 'species' | 'element'>,
  shown: ReadonlySet<BattleAction>,
): BattleAction {
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
 * Plays the fight in advance with the same rules and planner, so the arena can tell how hard it will be.
 * Returns null when the champion cannot enter it now (locked, resting, no building...).
 */
export function predictFight(save: Save, encounterId: string, now: number): { win: boolean; stars: number; hpLeft: number } | null {
  let s: Save;
  try {
    s = command({ ...save, battle: null, rewardPending: false }, { type: 'battle', encounterId }, now);
  } catch {
    return null;
  }
  const d = s.dinos.find((x) => x.id === s.battle!.dinoId)!;
  const shown = new Set<BattleAction>();
  while (s.battle && !s.battle.result) {
    const a = autoAction(s.battle, d, shown);
    shown.add(a);
    s = command(s, { type: 'action', action: a }, now);
  }
  const b = s.battle!;
  return { win: b.result === 'victory', stars: b.stars ?? 0, hpLeft: b.hp / b.maxHp };
}
