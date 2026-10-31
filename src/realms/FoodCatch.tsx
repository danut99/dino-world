import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { DinosaurArt } from './DinosaurArt';
import { CATCH, catchGold, type Save } from './game';
import { playSound, type SoundId } from './sound';
import { Icon, type IconName } from './ui/Icon';
import './food-catch.css';

type Kind = 'food' | 'gold' | 'amber' | 'heart' | 'star' | 'stone';
/** What falls: points, how often (rocks grow more common as the clock runs down), and the icon. */
const DROPS: Record<Kind, { icon: IconName; points: number; weight: number }> = {
  food: { icon: 'food', points: 1, weight: 52 },
  gold: { icon: 'gold', points: 3, weight: 18 },
  amber: { icon: 'amber', points: 10, weight: 3 },
  heart: { icon: 'heart', points: 0, weight: 2 },
  star: { icon: 'star', points: 0, weight: 3 },
  stone: { icon: 'stone', points: 0, weight: 20 },
};
const KINDS = Object.keys(DROPS) as Kind[];
const LIVES = 3;
/** Positions are percents of the field. The dinosaur's feet sit on GROUND. */
const GROUND = 90;
const CATCH_HALF = 7;
const DINO_SPEED = 88;
const DOUBLE_SECONDS = 6;

type Drop = { id: number; kind: Kind; x: number; y: number; speed: number; spin: number };
type Pop = { id: number; x: number; y: number; text: string; bad?: true; born: number };
type Game = {
  phase: 'ready' | 'play' | 'over';
  time: number;
  score: number;
  lives: number;
  x: number;
  target: number;
  flip: boolean;
  moving: boolean;
  hurtUntil: number;
  doubleUntil: number;
  spawnIn: number;
  drops: Drop[];
  pops: Pop[];
  nextId: number;
  sounds: SoundId[];
};
const newGame = (): Game => ({
  phase: 'ready',
  time: 0,
  score: 0,
  lives: LIVES,
  x: 50,
  target: 50,
  flip: false,
  moving: false,
  hurtUntil: 0,
  doubleUntil: 0,
  spawnIn: 0.6,
  drops: [],
  pops: [],
  nextId: 1,
  sounds: [],
});

function pick(progress: number): Kind {
  const weight = (k: Kind) => (k === 'stone' ? DROPS.stone.weight * (1 + 2 * progress) : DROPS[k].weight);
  let roll = Math.random() * KINDS.reduce((sum, k) => sum + weight(k), 0);
  for (const k of KINDS) if ((roll -= weight(k)) < 0) return k;
  return 'food';
}

function step(g: Game, dt: number) {
  if (g.phase !== 'play') return;
  g.time += dt;
  const t = g.time,
    progress = Math.min(1, t / CATCH.seconds);
  // The dinosaur runs toward where the player points, a little slower while hurt.
  const dx = g.target - g.x,
    move = Math.min(Math.abs(dx), DINO_SPEED * (t < g.hurtUntil ? 0.5 : 1) * dt);
  g.moving = Math.abs(dx) > 0.5;
  if (g.moving) {
    g.x += Math.sign(dx) * move;
    g.flip = dx < 0;
  }
  g.spawnIn -= dt;
  if (g.spawnIn <= 0) {
    g.spawnIn = 0.65 - 0.4 * progress;
    g.drops.push({ id: g.nextId++, kind: pick(progress), x: 6 + Math.random() * 88, y: -8, speed: 32 + 48 * progress + Math.random() * 12, spin: Math.random() * 360 });
  }
  g.drops = g.drops.filter((d) => {
    d.y += d.speed * dt;
    if (d.y >= GROUND - 14 && d.y <= GROUND + 2 && Math.abs(d.x - g.x) < CATCH_HALF) {
      const pop = (text: string, bad?: true) => g.pops.push({ id: g.nextId++, x: d.x, y: GROUND - 22, text, bad, born: t });
      if (d.kind === 'stone') {
        g.lives--;
        g.hurtUntil = t + 0.7;
        g.sounds.push('heavy');
        pop('-1 ❤', true);
        if (!g.lives) g.phase = 'over';
      } else if (d.kind === 'heart') {
        g.lives = Math.min(LIVES, g.lives + 1);
        g.sounds.push('hatch');
        pop('+1 ❤');
      } else if (d.kind === 'star') {
        g.doubleUntil = t + DOUBLE_SECONDS;
        g.sounds.push('evolve');
        pop('×2!');
      } else {
        const points = DROPS[d.kind].points * (t < g.doubleUntil ? 2 : 1);
        g.score += points;
        g.sounds.push(d.kind === 'food' ? 'pop' : 'coin');
        pop(`+${points}`);
      }
      return false;
    }
    return d.y < 108;
  });
  g.pops = g.pops.filter((p) => t - p.born < 0.8);
  if (t >= CATCH.seconds && g.phase === 'play') g.phase = 'over';
}

/** Food Catch: the starter dinosaur runs along the island's edge catching food and gold, and dodges falling rocks. */
export function FoodCatch({
  save,
  lang,
  gamesLeft,
  gemWon,
  close,
  reward,
}: {
  save: Save;
  lang: number;
  /** Games that still pay gold today. */
  gamesLeft: number;
  /** Today's high-score diamond is already won. */
  gemWon: boolean;
  close: () => void;
  /** Pays the game's reward; false when it could not. */
  reward: (score: number) => boolean;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  // The starter dinosaur from the tutorial egg plays, never a boss.
  const dino = save.dinos.find((d) => d.id === 'ignis') ?? save.dinos.find((d) => d.species !== 'boss') ?? save.dinos[0];
  const game = useRef<Game>(newGame());
  const field = useRef<HTMLDivElement>(null);
  const [, setFrame] = useState(0);
  const [result, setResult] = useState<{ score: number; gold: number; gem: boolean } | null>(null);
  const paid = useRef({ reward, gamesLeft, gemWon });
  paid.current = { reward, gamesLeft, gemWon };

  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const held = new Set<string>();
    const keys: Record<string, number> = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
    const down = (e: KeyboardEvent) => {
      if (!(e.code in keys)) return;
      held.add(e.code);
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const frame = (now: number) => {
      const g = game.current,
        dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (held.size) {
        const dir = [...held].reduce((sum, k) => sum + keys[k], 0);
        g.target = Math.max(6, Math.min(94, g.x + dir * 12));
      }
      if (!document.hidden) step(g, dt);
      for (const s of g.sounds.splice(0)) playSound(s);
      if (g.phase === 'over' && !result) {
        const { reward: pay, gamesLeft: left, gemWon: hadGem } = paid.current,
          ok = g.score > 0 && left > 0 && pay(g.score);
        playSound(g.lives ? 'victory' : 'defeat');
        setResult({ score: g.score, gold: ok ? catchGold(g.score) : 0, gem: ok && !hadGem && g.score >= CATCH.gemScore });
        return;
      }
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [result]);

  const aim = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.buttons === 0 && e.type !== 'pointermove') return;
    const r = field.current!.getBoundingClientRect();
    game.current.target = Math.max(6, Math.min(94, ((e.clientX - r.left) / r.width) * 100));
  };
  const start = () => {
    game.current = { ...newGame(), phase: 'play' };
    setResult(null);
    playSound('click');
  };

  const g = game.current,
    hurt = g.time < g.hurtUntil,
    double = g.time < g.doubleUntil,
    left = Math.max(0, Math.ceil(CATCH.seconds - g.time));
  return (
    <div className="catch-overlay" role="dialog" aria-modal="true" aria-label={tr('Prinde mâncarea', 'Food Catch')}>
      <div
        ref={field}
        className={`catch-field${g.phase === 'play' ? ' playing' : ''}${hurt ? ' hurt' : ''}${double ? ' double' : ''}`}
        onPointerMove={g.phase === 'play' ? aim : undefined}
        onPointerDown={g.phase === 'play' ? aim : undefined}
      >
        <header className="catch-hud">
          <button type="button" className="catch-close" onClick={close} aria-label={tr('Închide', 'Close')}>
            ✕
          </button>
          <span className="catch-lives" aria-label={`${g.lives}/${LIVES}`}>
            {Array.from({ length: LIVES }, (_, i) => (
              <span key={i} className={i < g.lives ? '' : 'lost'}>
                <Icon name="heart" scale={2} />
              </span>
            ))}
          </span>
          <span className="catch-score">
            <Icon name="star" scale={2} /> {g.score}
            {double && <b>×2</b>}
          </span>
          <span className="catch-time">
            <Icon name="clock" scale={2} /> {left}s
          </span>
        </header>
        <div className="catch-timebar" aria-hidden="true">
          <i style={{ width: `${(left / CATCH.seconds) * 100}%` }} />
        </div>
        {g.drops.map((d) => (
          <span
            key={d.id}
            className={`catch-drop ${d.kind}`}
            style={{ left: `${d.x}%`, top: `${d.y}%`, rotate: d.kind === 'stone' ? `${d.spin + g.time * 220}deg` : undefined }}
          >
            <Icon name={DROPS[d.kind].icon} scale={3} />
          </span>
        ))}
        {dino && (
          <div className={`catch-dino stage-${dino.stage}`} style={{ left: `${g.x}%`, top: `${GROUND}%`, scale: g.flip ? '-1 1' : undefined }}>
            <DinosaurArt
              species={dino.species}
              element={dino.element}
              stage={dino.stage}
              animation={hurt ? 'hurt' : g.moving && g.phase === 'play' ? 'walk' : 'idle'}
            />
          </div>
        )}
        {g.pops.map((p) => (
          <span key={p.id} className={`catch-pop${p.bad ? ' bad' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            {p.text}
          </span>
        ))}
        {g.phase === 'ready' && (
          <div className="catch-card">
            <h2>{tr('Prinde mâncarea!', 'Food Catch!')}</h2>
            <ul className="catch-legend">
              <li>
                <Icon name="food" scale={2} /> +1
              </li>
              <li>
                <Icon name="gold" scale={2} /> +3
              </li>
              <li>
                <Icon name="amber" scale={2} /> +10
              </li>
              <li>
                <Icon name="star" scale={2} /> ×2
              </li>
              <li>
                <Icon name="heart" scale={2} /> +1 ❤
              </li>
              <li className="bad">
                <Icon name="stone" scale={2} /> −1 ❤
              </li>
            </ul>
            <p>
              {tr(
                `Mută dinozaurul cu degetul, mouse-ul sau A / D. Ai ${CATCH.seconds} de secunde și ${LIVES} vieți.`,
                `Move your dinosaur with your finger, the mouse or A / D. You have ${CATCH.seconds} seconds and ${LIVES} lives.`,
              )}
            </p>
            <p className="catch-pay">
              {gamesLeft > 0
                ? tr(
                    `${gamesLeft} ${gamesLeft === 1 ? 'joc plătit' : 'jocuri plătite'} azi: ${CATCH.goldPerPoint} aur pe punct, până la ${CATCH.maxGold}.`,
                    `${gamesLeft} paid ${gamesLeft === 1 ? 'game' : 'games'} left today: ${CATCH.goldPerPoint} gold per point, up to ${CATCH.maxGold}.`,
                  )
                : tr('Ai jucat toate jocurile de azi. Revino mâine!', "You've played all of today's games. Come back tomorrow!")}
              {!gemWon && gamesLeft > 0 && (
                <>
                  {' '}
                  {tr(`💎 la ${CATCH.gemScore} de puncte.`, `💎 at ${CATCH.gemScore} points.`)}
                </>
              )}
            </p>
            <button type="button" className="realm-button" onClick={start} disabled={gamesLeft <= 0}>
              {tr('Joacă', 'Play')} →
            </button>
          </div>
        )}
        {result && (
          <div className="catch-card" role="alert">
            <h2>{g.lives ? tr('Timpul a expirat!', "Time's up!") : tr('Au, pietre!', 'Ouch, rocks!')}</h2>
            <p className="catch-final">
              <Icon name="star" scale={3} /> {result.score}
            </p>
            {result.gold > 0 ? (
              <p className="catch-won">
                <Icon name="gold" scale={2} /> +{result.gold}
                {result.gem && <span> · 💎 +1</span>}
              </p>
            ) : (
              <p className="catch-pay">
                {result.score
                  ? tr('Fără aur: jocurile de azi s-au terminat.', "No gold: today's games are used up.")
                  : tr('Prinde măcar ceva ca să câștigi aur.', 'Catch something to earn gold.')}
              </p>
            )}
            {gamesLeft <= 0 && (
              <p className="catch-pay">{tr('Ai jucat toate jocurile de azi. Revino mâine!', "That was today's last game. Come back tomorrow!")}</p>
            )}
            <div className="catch-actions">
              {gamesLeft > 0 && (
                <button type="button" className="realm-button" onClick={start}>
                  {tr('Încă o dată', 'Again')}
                </button>
              )}
              <button type="button" className="realm-button secondary" onClick={close}>
                {tr('Gata', 'Done')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
