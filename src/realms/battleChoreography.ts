import type { Clip, SpriteManifest } from './animation';

/** Actions the battle reducer understands; `skill` has no clip and is no longer offered in the UI. */
export type BattleAction = 'basic' | 'skill' | 'defend' | 'ultimate';
export type Unit = 'ally' | 'enemy';
export type Impact = { on: Unit; kind: 'hit' | 'guard' | 'ultimate' };
/** One beat of the fight. `ms` is Infinity for the resting pose that closes a sequence. */
export type Step = { ally: Clip; enemy: Clip; ms: number; reveal?: Unit; impact?: Impact };
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
 * One resolved round, told in order: the ally strikes (or raises a guard), the blow lands, then the
 * surviving enemy answers and its hit lands. HP is revealed on the beat where the hit connects.
 */
export function exchange(
  action: BattleAction,
  ally: Fighter,
  enemy: Fighter,
  alive: { ally: boolean; enemy: boolean },
): Step[] {
  const steps: Step[] = [];
  if (action !== 'defend') {
    const strike: Clip = action === 'ultimate' && ally.clips.has('ultimate') ? 'ultimate' : 'attack';
    const windup = ally.impactMs(strike),
      landing: Clip = alive.enemy ? 'hurt' : 'death',
      landingMs = enemy.ms(landing);
    steps.push({ ally: strike, enemy: 'idle', ms: windup });
    steps.push({
      ally: strike,
      enemy: landing,
      ms: Math.max(ally.ms(strike) - windup, landingMs, MIN_BEAT_MS),
      reveal: 'enemy',
      impact: { on: 'enemy', kind: action === 'ultimate' ? 'ultimate' : 'hit' },
    });
  }
  if (alive.enemy) {
    const guard = action === 'defend',
      stance: Clip = guard ? 'defend' : 'idle',
      windup = enemy.impactMs('attack'),
      landing: Clip = !alive.ally ? 'death' : guard ? stance : 'hurt',
      landingMs = !alive.ally ? ally.ms('death') : guard ? MIN_BEAT_MS : ally.ms('hurt');
    // A short breather so the riposte reads as an answer rather than one blur.
    if (action !== 'defend') steps.push({ ally: 'idle', enemy: 'idle', ms: 250 });
    steps.push({ ally: stance, enemy: 'attack', ms: windup });
    steps.push({
      ally: landing,
      enemy: 'attack',
      ms: Math.max(enemy.ms('attack') - windup, landingMs, MIN_BEAT_MS),
      reveal: 'ally',
      impact: { on: 'ally', kind: guard ? 'guard' : 'hit' },
    });
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
