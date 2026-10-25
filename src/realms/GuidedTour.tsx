import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './ui/Icon';
import './guided-tour.css';

/**
 * One step of the first-time guide. `target` is a CSS selector, or several in order of preference (the first one on
 * screen is lit); without one the step is a card in the middle of the screen. `prepare` runs first (opening a folded
 * card or bar). A missing target skips its step, unless the step `wait`s for it: the bubble then floats on its own
 * and the screen stays free until the target shows up. A `click` step moves on when the player presses the first
 * target (the others only light the way there). A step with `until` and no target leaves the whole screen free (placing
 * a building on the island) and moves on by itself once `until()` holds.
 */
export type TourStep = {
  target?: string | string[];
  title: readonly [string, string];
  body: readonly [string, string];
  prepare?: () => void;
  click?: boolean;
  wait?: boolean;
  until?: () => boolean;
};

type Box = { x: number; y: number; w: number; h: number };
const PAD = 6;

const visible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
const targets = (step: TourStep) => (step.target === undefined ? [] : Array.isArray(step.target) ? step.target : [step.target]);
const find = (step: TourStep) => targets(step).map(visible).find(Boolean);

/**
 * A spotlight over the screen that walks through `steps`, then calls `done` (also when skipped). While `paused` it
 * hides but keeps its place, so a window it cannot speak over (a cutscene) does not lose the step.
 */
export function GuidedTour({ steps, lang, paused = false, done }: { steps: TourStep[]; lang: number; paused?: boolean; done: () => void }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  // Whether the lit element is the one to press (not one that only lights the way to it).
  const [primary, setPrimary] = useState(true);
  const step = steps[index];
  const last = index === steps.length - 1;
  const stepRef = useRef(step);
  stepRef.current = step;
  // Moving on from this step only: a click and an `until` landing together never skip the step after it.
  const next = () => (last ? done() : setIndex((i) => (i === index ? i + 1 : i)));
  const nextRef = useRef(next);
  nextRef.current = next;

  // Prepare the step, give the screen a moment to open what it needs, then find the target (or skip the step).
  useLayoutEffect(() => {
    if (paused) return;
    setReady(false);
    setBox(null);
    step.prepare?.();
    if (!step.target || step.wait) return setReady(true);
    const wait = window.setTimeout(() => (find(stepRef.current) ? setReady(true) : nextRef.current()), 260);
    return () => window.clearTimeout(wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused]);

  // Follow the target while the step is shown: the island moves, cards fold, windows open, eggs become ready.
  useEffect(() => {
    if (paused || !ready || !step.target) return;
    let frame = 0;
    const measure = () => {
      const r = find(stepRef.current)?.getBoundingClientRect();
      const first = targets(stepRef.current)[0];
      setPrimary(!!first && !!visible(first));
      setBox((b) =>
        !r ? null : b && b.x === r.left && b.y === r.top && b.w === r.width && b.h === r.height ? b : { x: r.left, y: r.top, w: r.width, h: r.height },
      );
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, index, paused]);

  // A click step moves on when the player presses the real button (which still does its own job).
  useEffect(() => {
    if (paused || !ready || !step.click) return;
    const press = (e: MouseEvent) => {
      const goal = visible(targets(stepRef.current)[0]);
      if (goal && e.target instanceof Node && goal.contains(e.target)) window.setTimeout(() => nextRef.current(), 0);
    };
    document.addEventListener('click', press, true);
    return () => document.removeEventListener('click', press, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, index, paused]);

  // An `until` step watches the game and moves on as soon as its goal is met.
  useEffect(() => {
    if (paused || !ready || !step.until) return;
    const watch = window.setInterval(() => stepRef.current.until?.() && nextRef.current(), 250);
    return () => window.clearInterval(watch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, index, paused]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !paused && done();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [done, paused]);

  if (paused) return null;
  const free = !step.target && !!step.until;
  const floating = (!!step.target && !!step.wait && !box) || free;
  if (!ready || (step.target && !box && !floating))
    return (
      <div className="tour">
        <div className="tour-shade tour-full" />
      </div>
    );

  const hole = box && { x: box.x - PAD, y: box.y - PAD, w: box.w + PAD * 2, h: box.h + PAD * 2 };
  const vw = window.innerWidth,
    vh = window.innerHeight;
  // The bubble sits below the target when there is room, above it otherwise; centred without a target, and at the
  // bottom of the screen while it waits for one.
  const below = hole ? hole.y + hole.h + 200 < vh || hole.y < vh - hole.y - hole.h : true;
  const width = Math.min(320, vw - 24),
    gap = step.click ? 40 : 12;
  const bubble = hole
    ? {
        left: Math.max(12, Math.min(vw - width - 12, hole.x + hole.w / 2 - width / 2)),
        ...(below ? { top: Math.min(vh - 12, hole.y + hole.h + gap) } : { bottom: Math.max(12, vh - hole.y + gap) }),
        width,
      }
    : free
      ? { left: (vw - width) / 2, top: 72, width }
      : floating
      ? { left: (vw - width) / 2, bottom: 24, width }
      : { left: (vw - width) / 2, top: vh / 2, transform: 'translateY(-50%)', width };

  return (
    <div className="tour" role="dialog" aria-modal={!floating} aria-label={tr('Ghid de start', 'Getting started')}>
      {hole ? (
        <>
          {/* Four shades around the hole block the rest of the screen; the hole lets a click step through. */}
          <div className="tour-shade" style={{ left: 0, top: 0, width: vw, height: Math.max(0, hole.y) }} />
          <div className="tour-shade" style={{ left: 0, top: hole.y + hole.h, width: vw, height: Math.max(0, vh - hole.y - hole.h) }} />
          <div className="tour-shade" style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
          <div className="tour-shade" style={{ left: hole.x + hole.w, top: hole.y, width: Math.max(0, vw - hole.x - hole.w), height: hole.h }} />
          {!step.click && <div className="tour-block" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
          <div className={`tour-ring${step.click && primary ? ' pulse' : ''}`} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
          {step.click && primary && (
            <div className={`tour-pointer${below ? '' : ' up'}`} style={{ left: hole.x + hole.w / 2, top: below ? hole.y + hole.h : hole.y }} aria-hidden="true">
              {below ? '▲' : '▼'}
            </div>
          )}
        </>
      ) : (
        !floating && <div className="tour-shade tour-full" />
      )}
      <section className="tour-bubble" style={bubble}>
        <header>
          <span className="tour-badge" aria-hidden="true">
            <Icon name="egg" scale={1} />
          </span>
          <h2>{step.title[lang]}</h2>
          <button className="tour-x" onClick={done} aria-label={tr('Închide ghidul', 'Close the guide')} title={tr('Sari peste ghid', 'Skip the guide')}>
            ×
          </button>
        </header>
        <p>{step.body[lang]}</p>
        <footer>
          <span className="tour-dots" aria-label={`${index + 1} / ${steps.length}`}>
            {steps.map((_, i) => (
              <i key={i} className={i < index ? 'done' : i === index ? 'current' : ''} />
            ))}
          </span>
          {index > 0 && !step.click && !free && (
            <button className="realm-button secondary tour-back" onClick={() => setIndex((i) => i - 1)} aria-label={tr('Înapoi', 'Back')}>
              ←
            </button>
          )}
          {free ? (
            <span className="tour-cue">{tr('Te aștept…', 'Waiting for you…')}</span>
          ) : step.click ? (
            <span className="tour-cue">{floating ? tr('Așteaptă puțin…', 'Hold on…') : primary ? tr('Apasă pe butonul care clipește', 'Tap the glowing button') : tr('Urmărește…', 'Watch…')}</span>
          ) : (
            <button className="realm-button tour-next" onClick={next}>
              {last ? tr('Am înțeles', 'Got it') : tr('Mai departe', 'Next')}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
