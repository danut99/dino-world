import { t } from '../i18n';
// „Primii pași”: la primul joc, fără nicio lume deblocată. Un pui de foc așteaptă în incubator, o săgeată arată
// Caldera de jar, apoi butonul de deblocare. De acolo preiau obiectivele de pe hartă. Se poate sări oricând.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ELEMENTS,
  GOALS,
  WORLD_UNLOCK_COST,
  currentGoal,
  farmPlots,
  habitatCapacity,
  residents,
  pendingGold,
  buildingUpgradeCost,
  type GameState,
} from '@shared/game';
import { DinoThumb, formatNumber, formatTime } from './ui';
import { HABITAT_ISLANDS } from '../world/islands';

const KEY = 'dino-world:first-steps';
/** „Sari peste” din ghid (pașii de după deblocarea lumii). */
const GUIDE_KEY = 'dino-world:guide';
const FIRST = 'fire' as const;

export function firstStepsDone(): boolean {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return false;
  }
}
/** Pentru „Joc nou” din uneltele de dezvoltare: intro-ul apare din nou. */
export function resetFirstSteps() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(GUIDE_KEY);
  } catch {
    // fără stocare: intro-ul apare oricum la fiecare joc nou
  }
}
function finish() {
  try {
    localStorage.setItem(KEY, 'done');
  } catch {
    // vezi mai sus
  }
}

type Step = 'welcome' | 'island' | 'unlock';
type Rect = { x: number; y: number; w: number; h: number };

export function FirstSteps({ state, onShowWorlds }: { state: GameState; onShowWorlds: () => void }) {
  const hasWorld = state.buildings.some((b) => b.kind === 'habitat');
  const [step, setStep] = useState<Step | null>(() => (!hasWorld && !firstStepsDone() ? 'welcome' : null));

  // joc nou (din dev): pornește din nou
  useEffect(() => {
    if (!hasWorld && step === null && !firstStepsDone()) setStep('welcome');
  }, [hasWorld, step]);
  // lumea s-a deblocat (pe orice cale): rezumatul
  useEffect(() => {
    if (hasWorld && (step === 'island' || step === 'unlock')) {
      // de aici încolo, obiectivele de pe hartă arată pasul următor
      finish();
      setStep(null);
    }
  }, [hasWorld, step]);

  const target = step === 'island' ? `island-${FIRST}` : step === 'unlock' ? `unlock-${FIRST}` : null;
  const rect = useTarget(target, (found) => {
    // butonul de deblocare apare când camera se apropie de insulă și dispare dacă închizi panoul
    if (step === 'island' && document.querySelector(`[data-tour="unlock-${FIRST}"]`)) setStep('unlock');
    if (step === 'unlock' && !found) setStep('island');
  });

  if (!step) return null;
  const skip = () => {
    finish();
    stopGuide();
    setStep(null);
  };
  const pup = state.dinos[0];

  if (step === 'welcome')
    return (
      <div className="tour-backdrop">
        <section className="tour-card" role="dialog" aria-label={t('Bun venit')}>
          <Dots at={0} />
          <div className="tour-hero" style={{ '--el': ELEMENTS[FIRST].color } as React.CSSProperties}>
            {pup && <DinoThumb species={pup.species} tight className="tour-pup" />}
          </div>
          <h2>{t('Un pui de foc a eclozat!')}</h2>
          <p className="tour-line">
            <span className="chip">{t('🏠 Are nevoie de o casă')}</span>
          </p>
          <div className="tour-flow" aria-hidden="true">
            <span>🦖</span>
            <i>→</i>
            <span>{t(ELEMENTS[FIRST].icon)}</span>
            <i>→</i>
            <span>🪙</span>
          </div>
          <div className="tour-buttons">
            <button className="button ghost small" onClick={skip}>
              {t('Sari peste')}
            </button>
            <button
              className="button"
              onClick={() => {
                onShowWorlds();
                setStep('island');
              }}
            >
              {t('Găsește-i o casă →')}
            </button>
          </div>
        </section>
      </div>
    );

  // pașii cu săgeată: nu blochează nimic, doar arată unde să atingi
  const below = !!rect && rect.y + rect.h / 2 < window.innerHeight / 2;
  return (
    <div className="tour-layer" aria-live="polite">
      {rect && (
        <>
          <div
            className={`tour-pointer ${below ? 'below' : ''}`}
            style={{
              left: Math.max(
                Math.min(150, window.innerWidth / 2),
                Math.min(window.innerWidth - Math.min(150, window.innerWidth / 2), rect.x + rect.w / 2),
              ),
              top: below ? Math.min(window.innerHeight - 150, rect.y + rect.h) : rect.y,
            }}
          >
            <span className="tour-arrow" aria-hidden="true">
              {t(below ? '⬆' : '⬇')}
            </span>
            <div className="tour-bubble">
              <Dots at={step === 'island' ? 1 : 2} />
              {step === 'island' ? (
                <strong>
                  {t(ELEMENTS[FIRST].icon)} {t('Atinge ')}
                  {t(HABITAT_ISLANDS[FIRST].name)}
                </strong>
              ) : (
                <strong>
                  {t('🔓 Deblochează · 🪙 ')}
                  {t(formatNumber(WORLD_UNLOCK_COST[FIRST]))}
                </strong>
              )}
              <button className="tour-skip" onClick={skip}>
                {t('Sari peste')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Dots({ at }: { at: number }) {
  return (
    <span className="tour-dots" aria-label={t(`Pasul ${at + 1} din 3`)}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i === at ? 'on' : i < at ? 'done' : ''} />
      ))}
    </span>
  );
}

/** Dreptunghiul de pe ecran al elementului `[data-tour=id]`, urmărit la fiecare cadru (camera se mișcă). */
function useTarget(id: string | null, onFrame: (found: boolean) => void): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    if (!id) return setRect(null);
    let frame = 0;
    let last = '';
    let highlighted: Element | null = null;
    const tick = () => {
      const el = document.querySelector(`[data-tour="${id}"]`);
      if (el !== highlighted) {
        highlighted?.classList.remove('guide-target');
        el?.classList.add('guide-target');
        highlighted = el;
      }
      const r = el?.getBoundingClientRect();
      // ce iese din ecran se taie, ca săgeata să rămână vizibilă
      const next =
        r && r.width > 0
          ? (() => {
              const pad = 8;
              const x = Math.max(pad, r.left - pad);
              const y = Math.max(pad, r.top - pad);
              const w = Math.min(window.innerWidth - pad, r.right + pad) - x;
              const h = Math.min(window.innerHeight - pad, r.bottom + pad) - y;
              return w > 0 && h > 0 ? { x, y, w, h } : null;
            })()
          : null;
      const key = next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.w)},${Math.round(next.h)}` : '';
      if (key !== last) {
        last = key;
        setRect(next);
      }
      onFrame(!!el);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      highlighted?.classList.remove('guide-target');
    };
    // onFrame se schimbă la fiecare randare; pasul curent e în id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return rect;
}

function stopGuide() {
  try {
    localStorage.setItem(GUIDE_KEY, 'off');
  } catch {
    // fără stocare: ghidul se oprește până la reîncărcare
  }
}
const guideOff = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) === 'off';
  } catch {
    return false;
  }
};

const INTRO = GOALS.filter((g) => g.intro);
type Hint = { sel: string; text: string };
const tour = (id: string) => `[data-tour="${id}"]`;

/**
 * Unde arată săgeata pentru obiectivul curent din „Primii pași”, în ordinea preferinței: întâi butonul acțiunii
 * (dacă e pe ecran), altfel calea până la el (închide fereastra, apoi „Du-mă acolo” din cardul obiectivului).
 */
function guideHints(s: GameState, now: number): Hint[] | null {
  const goal = currentGoal(s);
  if (!goal?.intro || (goal.id === 'world' && !goal.done(s))) return null;
  if (goal.done(s)) return [{ sel: tour('goal-claim'), text: '🎁 Ia recompensa' }, ...way('')];
  const hints: Hint[] = [];
  if (goal.id === 'gold1') {
    const home = s.buildings.find((b) => b.kind === 'habitat');
    hints.push({
      sel: tour('collect'),
      text:
        home && pendingGold(s, home, now) < 1
          ? '⏱ Dinozaurii produc aur. Așteaptă puțin, apoi apasă Strânge.'
          : '🪙 Strânge aurul produs de dinozauri',
    });
  }
  if (goal.id === 'habitat2') {
    const home = s.buildings
      .filter((b) => b.kind === 'habitat')
      .sort((a, b) => residents(s, b.id).length - residents(s, a.id).length)[0];
    if (home && residents(s, home.id).length >= habitatCapacity(home)) {
      const cost = buildingUpgradeCost(home) ?? 0;
      hints.push(
        s.gold < cost
          ? { sel: tour('collect'), text: '🪙 Strânge aur pentru îmbunătățire' }
          : { sel: tour('upgrade'), text: '⬆️ Îmbunătățește habitatul pentru mai mult loc și aur' },
      );
    } else {
      hints.push(
        { sel: tour('hatch-home'), text: '🏠 Alege lumea pentru noul pui' },
        { sel: tour('hatch'), text: '🐣 Eclozează încă un pui ca să umpli habitatul' },
        { sel: tour('egg-wait'), text: '⏱ Așteptă să fie gata oul' },
        { sel: tour('egg-fire'), text: '🥚 Cumpără un ou ca să umpli habitatul' },
      );
    }
  }
  if (goal.id === 'feed1') hints.push({ sel: tour('feed'), text: '🍖 Hrănește puiul ca să crească' });
  if (goal.id === 'harvest') {
    const plots = s.buildings.filter((b) => b.kind === 'farm').flatMap((b) => farmPlots(b));
    const growing = plots.filter((p) => p && p.readyAt > now).map((p) => p!.readyAt - now);
    if (plots.some((p) => p && p.readyAt <= now)) hints.push({ sel: tour('harvest'), text: '🌿 Strânge recolta' });
    else if (growing.length)
      hints.push({ sel: tour('crop-wait'), text: `⏱ Crește… gata în ${formatTime(Math.min(...growing))}` });
    else hints.push({ sel: tour('crop-ferigi'), text: '🌱 Plantează Ferigi · gata în 30 s' });
  }
  if (goal.id === 'egg') {
    const ready = s.eggs.filter((e) => e.hatchAt <= now);
    if (ready.length)
      hints.push(
        { sel: tour('hatch-home'), text: '🏠 Alege lumea în care locuiește' },
        { sel: tour('hatch'), text: '🐣 Eclozează oul' },
      );
    else if (s.eggs.length)
      hints.push({
        sel: tour('egg-wait'),
        text: `⏱ Oul eclozează în ${formatTime(Math.min(...s.eggs.map((e) => e.hatchAt)) - now)}`,
      });
    else hints.push({ sel: tour('egg-fire'), text: '🥚 Cumpără un ou de foc' });
  }
  return [...hints, ...way(goal.title)];
}
/** Calea spre acțiune: din fereastra deschisă înapoi pe hartă, apoi „Du-mă acolo”. */
const way = (title: string): Hint[] => [
  { sel: '.stage-close', text: '✕ Înapoi la hartă' },
  { sel: '.modal .corner-button.close', text: '✕ Închide fereastra' },
  { sel: tour('goal-go'), text: title ? `👉 ${title}` : '👉 Du-mă acolo' },
  { sel: tour('goal-pill'), text: '👉 Deschide obiectivul' },
];

/** Ghidul de după deblocarea lumii: o săgeată prin hrănire, prima recoltă și primul ou, până la ultimul pas. */
export function Guide({ state, now }: { state: GameState; now: number }) {
  const [off, setOff] = useState(guideOff);
  const hasWorld = state.buildings.some((building) => building.kind === 'habitat');
  useEffect(() => {
    if (!hasWorld && !guideOff()) setOff(false);
  }, [hasWorld]);
  const hints = off ? null : guideHints(state, now);
  const found = useHintTarget(hints);
  if (!hints || !found) return null;
  const { rect, hint } = found;
  const goal = currentGoal(state)!;
  const below = rect.y + rect.h / 2 < window.innerHeight / 2;
  return (
    <div className="tour-layer guide" aria-live="polite">
      <div
        className={`tour-pointer ${below ? 'below' : ''}`}
        style={{
          left: Math.max(
            Math.min(150, window.innerWidth / 2),
            Math.min(window.innerWidth - Math.min(150, window.innerWidth / 2), rect.x + rect.w / 2),
          ),
          top: below ? Math.min(window.innerHeight - 150, rect.y + rect.h) : rect.y,
        }}
      >
        <span className="tour-arrow" aria-hidden="true">
          {t(below ? '⬆' : '⬇')}
        </span>
        <div className="tour-bubble">
          <span className="guide-step">
            {t('Primii pași · ')}
            {INTRO.indexOf(goal) + 1}/{INTRO.length}
          </span>
          <strong>{t(hint.text)}</strong>
          <button
            className="tour-skip"
            onClick={() => {
              stopGuide();
              setOff(true);
            }}
          >
            {t('Ascunde ghidul')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Primul indiciu al cărui element e pe ecran, cu dreptunghiul lui (urmărit la fiecare cadru). */
function useHintTarget(hints: Hint[] | null): { rect: Rect; hint: Hint } | null {
  const [found, setFound] = useState<{ rect: Rect; hint: Hint } | null>(null);
  const latest = useRef(hints);
  latest.current = hints;
  useLayoutEffect(() => {
    let frame = 0;
    let last = '';
    let scrolled: Element | null = null;
    let highlighted: Element | null = null;
    const tick = () => {
      let next: { rect: Rect; hint: Hint } | null = null;
      const blocked = document.querySelector('.reward-backdrop, .levelup, .tour-backdrop');
      for (const hint of blocked ? [] : (latest.current ?? [])) {
        const el = document.querySelector(hint.sel);
        // ce stă sub o fereastră deschisă nu se poate atinge: săgeata arată întâi închiderea ferestrei
        const modal = document.querySelector('.modal-backdrop, .dragon-stage-overlay');
        if (!el || (modal && !modal.contains(el))) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) {
          if (modal?.contains(el) && scrolled !== el) {
            scrolled = el;
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
          }
          continue;
        }
        if (highlighted !== el) {
          highlighted?.classList.remove('guide-target');
          el.classList.add('guide-target');
          highlighted = el;
        }
        const pad = 8;
        const x = Math.max(pad, r.left - pad);
        const y = Math.max(pad, r.top - pad);
        next = {
          hint,
          rect: {
            x,
            y,
            w: Math.min(window.innerWidth - pad, r.right + pad) - x,
            h: Math.min(window.innerHeight - pad, r.bottom + pad) - y,
          },
        };
        break;
      }
      if (!next) {
        highlighted?.classList.remove('guide-target');
        highlighted = null;
      }
      const key = next
        ? `${next.hint.sel}|${next.hint.text}|${Math.round(next.rect.x)},${Math.round(next.rect.y)},${Math.round(next.rect.w)},${Math.round(next.rect.h)}`
        : '';
      if (key !== last) {
        last = key;
        setFound(next);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      highlighted?.classList.remove('guide-target');
    };
  }, []);
  return hints ? found : null;
}
