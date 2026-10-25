import type { Clip, SpriteManifest } from './animation';
import type { AllyMove, RoundReport } from './game';

/** Actions the battle reducer understands. */
export type BattleAction = AllyMove;
export type Unit = 'ally' | 'enemy';
export type Impact = { on: Unit; kind: 'hit' | 'guard' | 'ultimate' | 'reflect' };
/** An on-screen announcement over one fighter: what just happened to it, with the damage when there is some. */
export type Callout = { on: Unit; kind: 'damage' | 'guard' | 'blocked' | 'dodge' | 'reflect' | 'ultimate' | 'ko'; amount?: number };
/**
 * One beat of the fight. `ms` is Infinity for the resting pose that closes a sequence. `reveal` shows the unit's
 * HP on this beat (`revealHp` when it is not yet the round's final value); `dodge` makes the unit leap aside.
 */
export type Step = {
  ally: Clip;
  enemy: Clip;
  ms: number;
  reveal?: Unit;
  revealHp?: number;
  impact?: Impact;
  say?: Callout[];
  dodge?: Unit;
  /** A relay entrance: the new fighter of this side walks in. */
  enter?: Unit | 'both';
};
export type Fighter = { clips: Set<Clip>; ms: (clip: Clip) => number; impactMs: (clip: Clip) => number };

const FALLBACK_MS = 600;
const MAX_MS = 6000;

/** Timing helper for one combatant. Static artwork (no manifest) still gets believable beats. */
export function fighter(manifest: SpriteManifest | null | undefined): Fighter {
  const se = manifest?.clips.se ?? {};
  const total = (clip: Clip) => se[clip]?.durationsMs.reduce((a, b) => a + b, 0);
  return {
    clips: new Set((Object.keys(se) as Clip[]).filter((clip) => se[clip])),
    ms: (clip) => Math.min(total(clip) ?? FALLBACK_MS, MAX_MS),
    impactMs: (clip) => {
      const c = se[clip];
      if (!c) return Math.round(FALLBACK_MS * 0.55);
      const frame = c.impactFrame ?? Math.floor(c.durationsMs.length * 0.55);
      return Math.min(c.durationsMs.slice(0, frame).reduce((a, b) => a + b, 0), MAX_MS);
    },
  };
}
const MIN_BEAT_MS = 450;
const restPose = (alive: boolean): Clip => (alive ? 'idle' : 'death');

/** Final pose held until the next command: idle for the living, the defeat pose for the fallen. */
export function rest(alive: { ally: boolean; enemy: boolean }): Step {
  return { ally: restPose(alive.ally), enemy: restPose(alive.enemy), ms: Infinity };
}

/**
 * Both fighters walk into the arena. Clip names are kept even when a fighter lacks the sprite: the
 * renderer falls back to its idle pose while the CSS body motion and narration still tell the beat.
 */
export function entrance(ally: Fighter, enemy: Fighter, alive: { ally: boolean; enemy: boolean }): Step[] {
  const ms = Math.max(ally.clips.has('walk') ? ally.ms('walk') : 900, enemy.clips.has('walk') ? enemy.ms('walk') : 900);
  return [{ ally: 'walk', enemy: 'walk', ms: Math.min(ms, 1600) }, rest(alive)];
}

/**
 * The relay: the next fighter of `side` (or of both sides) walks in while the other holds its ground. Played after
 * a round whose report has a `swap`, once the newcomer's sprite is loaded.
 */
export function swapEntrance(side: Unit | 'both', ally: Fighter, enemy: Fighter, alive: { ally: boolean; enemy: boolean }): Step[] {
  const walks = (unit: Unit) => side === 'both' || side === unit;
  const ms = Math.max(
    walks('ally') ? (ally.clips.has('walk') ? ally.ms('walk') : 900) : 0,
    walks('enemy') ? (enemy.clips.has('walk') ? enemy.ms('walk') : 900) : 0,
  );
  return [{ ally: walks('ally') ? 'walk' : 'idle', enemy: walks('enemy') ? 'walk' : 'idle', ms: Math.min(ms, 1600), enter: side }, rest(alive)];
}

/**
 * One resolved round, told in order from the reducer's report: the ally strikes (into the opponent's guard, if
 * it raised one) or raises its own guard; the surviving opponent answers with its attack or ultimate, which the
 * ally takes, blocks (turning part of it back) or dodges. HP is revealed on the beat where each blow connects.
 */
export function exchange(r: RoundReport, ally: Fighter, enemy: Fighter, alive: { ally: boolean; enemy: boolean }): Step[] {
  const steps: Step[] = [];
  const foeGuards = r.foe === 'defend';
  const fellToStrike = r.enemyAfterStrike === 0;
  if (r.ally !== 'defend') {
    const ult = r.ally === 'ultimate';
    const strike: Clip = ult && ally.clips.has('ultimate') ? 'ultimate' : 'attack';
    const windup = ally.impactMs(strike);
    const landing: Clip = foeGuards ? 'defend' : fellToStrike ? 'death' : 'hurt';
    steps.push({
      ally: strike,
      enemy: foeGuards ? 'defend' : 'idle',
      ms: windup,
      say: ult ? [{ on: 'ally', kind: 'ultimate' }] : foeGuards ? [{ on: 'enemy', kind: 'guard' }] : undefined,
    });
    steps.push({
      ally: strike,
      enemy: landing,
      ms: Math.max(ally.ms(strike) - windup, enemy.ms(landing), MIN_BEAT_MS),
      reveal: 'enemy',
      revealHp: r.enemyAfterStrike,
      impact: { on: 'enemy', kind: foeGuards ? 'guard' : ult ? 'ultimate' : 'hit' },
      say: [
        { on: 'enemy', kind: foeGuards ? 'blocked' : 'damage', amount: r.dealt },
        ...(fellToStrike ? [{ on: 'enemy', kind: 'ko' } as Callout] : []),
      ],
    });
  } else if (foeGuards) {
    // Both raise their guard: a tense standoff, nobody strikes.
    steps.push({
      ally: 'defend',
      enemy: 'defend',
      ms: Math.max(ally.ms('defend'), enemy.ms('defend'), MIN_BEAT_MS),
      say: [{ on: 'ally', kind: 'guard' }, { on: 'enemy', kind: 'guard' }],
    });
  }
  if (r.foe === 'attack' || r.foe === 'ultimate') {
    const guard = r.ally === 'defend';
    const foeUlt = r.foe === 'ultimate';
    const blow: Clip = foeUlt && enemy.clips.has('ultimate') ? 'ultimate' : 'attack';
    const stance: Clip = guard ? 'defend' : 'idle';
    const windup = enemy.impactMs(blow);
    const landing: Clip = !alive.ally ? 'death' : guard ? 'defend' : r.dodged ? 'idle' : 'hurt';
    // A short breather so the riposte reads as an answer rather than one blur.
    if (r.ally !== 'defend') steps.push({ ally: 'idle', enemy: 'idle', ms: 250 });
    steps.push({
      ally: stance,
      enemy: blow,
      ms: windup,
      say: foeUlt ? [{ on: 'enemy', kind: 'ultimate' }] : guard ? [{ on: 'ally', kind: 'guard' }] : undefined,
    });
    steps.push({
      ally: landing,
      enemy: blow,
      ms: Math.max(enemy.ms(blow) - windup, !alive.ally ? ally.ms('death') : guard || r.dodged ? MIN_BEAT_MS : ally.ms('hurt'), MIN_BEAT_MS),
      reveal: 'ally',
      revealHp: r.hpAfter,
      impact: r.dodged ? undefined : { on: 'ally', kind: guard ? 'guard' : foeUlt ? 'ultimate' : 'hit' },
      dodge: r.dodged ? 'ally' : undefined,
      say: r.dodged
        ? [{ on: 'ally', kind: 'dodge' }]
        : [
            { on: 'ally', kind: guard ? 'blocked' : 'damage', amount: r.taken },
            ...(!alive.ally ? [{ on: 'ally', kind: 'ko' } as Callout] : []),
          ],
    });
    if (r.reflected > 0) {
      const hit: Clip = alive.enemy ? 'hurt' : 'death';
      steps.push({
        ally: alive.ally ? 'defend' : 'death',
        enemy: hit,
        ms: Math.max(enemy.ms(hit), MIN_BEAT_MS),
        reveal: 'enemy',
        revealHp: r.enemyAfter,
        impact: { on: 'enemy', kind: 'reflect' },
        say: [{ on: 'enemy', kind: 'reflect', amount: r.reflected }, ...(!alive.enemy ? [{ on: 'enemy', kind: 'ko' } as Callout] : [])],
      });
    }
  }
  steps.push(rest(alive));
  return steps;
}

/** Index of the step where the unit's current clip began, so a clip that spans beats is not restarted. */
export function runStart(steps: Step[], index: number, unit: Unit) {
  if (!steps.length) return 0;
  let start = Math.max(0, Math.min(index, steps.length - 1));
  while (start > 0 && steps[start - 1][unit] === steps[start][unit]) start--;
  return start;
}
/** Total finite duration of the unit's current clip run, used to time the CSS motion. */
export function runMs(steps: Step[], index: number, unit: Unit) {
  if (!steps.length) return 0;
  const start = runStart(steps, index, unit);
  let ms = 0;
  for (let i = start; i < steps.length && steps[i][unit] === steps[start][unit]; i++)
    if (Number.isFinite(steps[i].ms)) ms += steps[i].ms;
  return ms;
}
