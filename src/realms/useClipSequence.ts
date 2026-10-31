import { useEffect, useState } from 'react';
import { loadAnimation, loadSpriteImage, type Clip } from './animation';
import type { Species } from './dinosaurs';
import type { RealmId, Stage } from './game';

/** How long a looping clip (walk, idle) holds its place in a sequence. */
export const LOOP_MS = 1400;

/**
 * Plays `sequence` (clips the age lacks are skipped) and then rests on `rest`, or starts over with `repeat`.
 * Every sheet is loaded before the first move, so no move waits on a download; a new `play` value replays it.
 */
export function useClipSequence(
  species: Species,
  element: RealmId,
  stage: Stage,
  sequence: readonly Clip[],
  { rest = 'idle', repeat = false, play = 0 }: { rest?: Clip; repeat?: boolean; play?: number } = {},
) {
  const id = `${species}_${element}_${stage}`,
    order = sequence.join();
  const [loaded, setLoaded] = useState<{ id: string; ms: Partial<Record<Clip, number>> } | null>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    let active = true;
    void loadAnimation(species, element, stage).then(async (m) => {
      const clips = m?.clips.se;
      if (!clips) return;
      const used = [...new Set([...sequence, rest])].filter((c) => clips[c]);
      await Promise.all(used.map((c) => loadSpriteImage(clips[c]!.sheet).catch(() => null)));
      if (!active) return;
      setLoaded({
        id,
        ms: Object.fromEntries(
          used.map((c) => [c, clips[c]!.loop ? LOOP_MS : clips[c]!.durationsMs.reduce((a, b) => a + b, 0) + 150]),
        ),
      });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, order, rest]);
  useEffect(() => setStep(0), [id, order, play]);
  const ready = loaded?.id === id,
    steps = ready ? sequence.filter((c) => loaded.ms[c]) : [],
    done = !steps.length || (!repeat && step >= steps.length),
    clip: Clip = done ? rest : steps[step % steps.length];
  useEffect(() => {
    if (done || !loaded) return;
    const t = window.setTimeout(() => setStep((s) => (repeat ? (s + 1) % steps.length : s + 1)), loaded.ms[clip]);
    return () => window.clearTimeout(t);
  }, [done, loaded, clip, step, repeat, steps.length]);
  return { clip, ready, done };
}
