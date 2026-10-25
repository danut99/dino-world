import { useEffect, useState, type CSSProperties } from 'react';
import { AnimatedDinosaur } from './AnimatedDinosaur';
import { loadAnimation, loadBossAnimation, loadSpriteImage, type SpriteManifest } from './animation';
import { ARENA_BOSSES } from './arenaBosses';
import { entrance, exchange, fighter, runMs, runStart, type Step, type Unit } from './battleChoreography';
import { SPECIES_NAMES, type Dino, type Stage } from './game';
import { DinosaurArt } from './DinosaurArt';
import { playSound } from './sound';
import { useReducedMotion } from './useMotion';
import './gameplay.css';
import './hero-vision.css';

type Phase = 'bonding' | 'growing' | 'arrival' | 'attacking' | 'guarding' | 'blasting' | 'done';

/** A cinematic rehearsal: never creates a battle or changes the player's dinosaur/resources. */
export function HeroVision({ dino, lang, finish }: { dino: Dino; lang: number; finish: () => void }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [art, setArt] = useState<{ ally: SpriteManifest; enemy: SpriteManifest } | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('bonding');
  const reducedMotion = useReducedMotion();
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const opponentElement = 'fire';
  const enemyName = ARENA_BOSSES[opponentElement].name;
  useEffect(() => {
    let active = true;
    // A stalled asset must not leave the player waiting indefinitely.
    const loadingTimeout = setTimeout(() => {
      if (active) setFailed(true);
    }, 12_000);
    (async () => {
      const [ally, enemy] = await Promise.all([
        loadAnimation(dino.species, dino.element, 'adult'),
        loadBossAnimation(opponentElement),
      ]);
      if (!ally || !enemy) throw Error('Missing vision artwork');
      // Only fetch the clips this rehearsal uses, rather than every available animation.
      const used = [
        ...entrance(fighter(ally), fighter(enemy), { ally: true, enemy: true }),
        ...(['basic', 'defend', 'ultimate'] as const).flatMap((action) =>
          exchange(
            {
              ally: action,
              foe: action === 'defend' ? 'ultimate' : 'none',
              dealt: action === 'ultimate' ? 82 : action === 'basic' ? 18 : 0,
              enemyAfterStrike: action === 'ultimate' ? 0 : 82,
              taken: action === 'defend' ? 18 : 0,
              dodged: false,
              reflected: 0,
            },
            fighter(ally),
            fighter(enemy),
            { ally: true, enemy: action !== 'ultimate' },
          ),
        ),
      ];
      const sheets = new Set(
        used
          .flatMap((step) => [ally.clips.se?.[step.ally]?.sheet, enemy.clips.se?.[step.enemy]?.sheet])
          .filter((src): src is string => !!src),
      );
      if (ally.clips.se?.idle) sheets.add(ally.clips.se.idle.sheet);
      await Promise.all(
        [...sheets].map(async (src) => {
          const image = await loadSpriteImage(src);
          // Decode before the transition, so the first adult frame does not stall canvas rendering.
          await image.decode();
        }),
      );
      if (!active) return;
      clearTimeout(loadingTimeout);
      setFailed(false);
      setArt({ ally, enemy });
    })().catch(() => {
      clearTimeout(loadingTimeout);
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      clearTimeout(loadingTimeout);
    };
  }, [dino.species, dino.element, opponentElement]);
  // Meet the actual companion first, then reveal the same dinosaur's possible adult form.
  useEffect(() => {
    if (!art || failed || (phase !== 'bonding' && phase !== 'growing')) return;
    const timer = setTimeout(
      () => {
        if (phase === 'bonding') setPhase('growing');
        else {
          setPhase('arrival');
          setSteps(entrance(fighter(art.ally), fighter(art.enemy), { ally: true, enemy: true }));
          setIndex(0);
        }
      },
      reducedMotion ? 250 : phase === 'bonding' ? 900 : 650,
    );
    return () => clearTimeout(timer);
  }, [art, failed, phase, reducedMotion]);
  const step = steps[index];
  useEffect(() => {
    if (!step) return;
    if (!Number.isFinite(step.ms)) {
      if (!art || phase === 'done') return;
      const timer = setTimeout(() => {
        if (phase === 'blasting') {
          setPhase('done');
          playSound('victory');
          return;
        }
        const action = phase === 'arrival' ? 'basic' : phase === 'attacking' ? 'defend' : 'ultimate';
        setPhase(action === 'basic' ? 'attacking' : action === 'defend' ? 'guarding' : 'blasting');
        setSteps(
          exchange(
            {
              ally: action,
              foe: action === 'defend' ? 'ultimate' : 'none',
              dealt: action === 'ultimate' ? 82 : action === 'basic' ? 18 : 0,
              enemyAfterStrike: action === 'ultimate' ? 0 : 82,
              taken: action === 'defend' ? 18 : 0,
              dodged: false,
              reflected: 0,
            },
            fighter(art.ally),
            fighter(art.enemy),
            { ally: true, enemy: action !== 'ultimate' },
          ),
        );
        setIndex(0);
      }, 650);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), step.ms);
    return () => clearTimeout(timer);
  }, [step, phase, art]);
  useEffect(() => {
    if (!step) return;
    const before = steps[index - 1];
    if (
      ((step.ally === 'ultimate' || step.ally === 'attack') && before?.ally !== step.ally) ||
      ((step.enemy === 'attack' || step.enemy === 'ultimate') && before?.enemy !== step.enemy)
    )
      playSound('swing');
    if (step.impact)
      playSound(step.impact.kind === 'ultimate' ? 'heavy' : step.impact.kind === 'hit' ? 'hit' : 'block');
  }, [step, steps, index]);
  // The boss's health tells the story at a glance: the first strike chips it, the shield holds, the ultimate ends it.
  const [bossHp, setBossHp] = useState(100);
  const [allyHp, setAllyHp] = useState(100);
  useEffect(() => {
    if (step?.impact?.on === 'ally') setAllyHp(82);
    if (step?.impact?.on === 'enemy' && step.impact.kind !== 'guard') setBossHp(phase === 'blasting' ? 0 : 82);
  }, [step, phase]);
  const pose = (unit: Unit) => ({
    clip: step?.[unit] ?? 'idle',
    key: `${runStart(steps, index, unit)}-${step?.[unit] ?? 'idle'}`,
    style: { '--motion-ms': `${runMs(steps, index, unit) || 600}ms` } as CSSProperties,
  });
  const a = pose('ally'),
    e = pose('enemy');
  const intro = phase === 'bonding' || phase === 'growing';
  const targetLevel = dino.stage === 'baby' ? 10 : dino.stage === 'juvenile' ? 25 : 50;
  const road: [Stage, string, string, string][] = [
    ['baby', tr('NIVEL 1', 'LEVEL 1'), tr('Pui', 'Hatchling'), tr('Crește cu hrană', 'Grows on food')],
    [
      'juvenile',
      tr('NIVEL 10', 'LEVEL 10'),
      tr('Juvenil', 'Juvenile'),
      tr('Lupte și expediții', 'Battles and expeditions'),
    ],
    [
      'adult',
      tr('NIVEL 25', 'LEVEL 25'),
      tr('Adult', 'Adult'),
      tr('Ultimata din viziune', 'The ultimate you just saw'),
    ],
  ];
  return (
    <section className="hero-vision" data-phase={phase} aria-label={tr('Viziunea eroului', 'Hero vision')}>
      <div
        className={`battle-environment hero-vision-arena ${step && Number.isFinite(step.ms) ? 'battle-playing' : ''} ${step?.ally === 'ultimate' || step?.enemy === 'ultimate' ? 'battle-ultimate' : ''}`}
      >
        <div className="battle-stage">
          <p className="hv-caption" role="status">
            {failed
              ? tr('Companionul tău te așteaptă', 'Your companion is waiting')
              : !art
                ? tr('Se pregătește lupta…', 'Preparing the fight…')
                : intro
                  ? tr('De aici pornește aventura', 'Your adventure starts here')
                  : tr('Un viitor posibil', 'A possible future')}
          </p>
          {intro && (
            <div
              className="hv-origin"
              aria-label={tr('Companionul tău de acum și forma sa adultă', 'Your companion now and their adult form')}
            >
              <div className="hv-origin-now">
                <DinosaurArt species={dino.species} element={dino.element} stage={dino.stage} paused={reducedMotion} />
              </div>
              <div className="hv-origin-future">
                {art && (
                  <AnimatedDinosaur
                    manifest={art.ally}
                    clip="idle"
                    paused={reducedMotion}
                    label={`${dino.nickname} adult`}
                  />
                )}
              </div>
              <span>
                {phase === 'bonding'
                  ? tr(`Acum · nivel ${dino.level}`, `Now · level ${dino.level}`)
                  : tr('Forma adultă · de la nivelul 25', 'Adult form · from level 25')}
              </span>
            </div>
          )}
          <div className="hero-vision-names">
            <div className="hv-fighter">
              <strong>{dino.nickname}</strong>
              <small>
                {SPECIES_NAMES[dino.species]} · {tr('Adult', 'Adult')}
              </small>
              <i className="hv-hp ally">
                <b style={{ width: `${allyHp}%` }} />
              </i>
            </div>
            <span>VS</span>
            <div className="hv-fighter foe">
              <strong>{enemyName}</strong>
              <small>BOSS</small>
              <i className="hv-hp">
                <b style={{ width: `${bossHp}%` }} />
              </i>
            </div>
          </div>
          {art && !intro && (
            <>
              <div className="battle-unit ally" data-motion={a.clip} style={a.style}>
                <AnimatedDinosaur key={a.key} manifest={art.ally} clip={a.clip} label={`${dino.nickname} adult`} />
              </div>
              <div className="battle-unit enemy" data-motion={e.clip} style={e.style}>
                <AnimatedDinosaur
                  key={e.key}
                  manifest={art.enemy}
                  clip={e.clip}
                  label={enemyName}
                  bossElement={opponentElement}
                  className="dinosaur-opponent"
                />
              </div>
            </>
          )}
          {step?.impact && (
            <div
              key={`impact-${index}`}
              className={`battle-impact on-${step.impact.on} kind-${step.impact.kind}`}
              aria-hidden="true"
            >
              {step.impact.kind === 'guard' ? '🛡' : '✹'}
            </div>
          )}
        </div>
      </div>
      {(phase === 'done' || failed) && (
        <div className="hv-road">
          <p>
            {tr('Companionul tău, pas cu pas spre forma adultă.', 'Your companion, growing toward their adult form.')}
          </p>
          <ol>
            {road.map(([stage, when, name, what]) => (
              <li key={stage} className={stage === dino.stage ? 'now' : ''}>
                <span className="hv-road-art">
                  <DinosaurArt species={dino.species} element={dino.element} stage={stage} paused frame={0} />
                </span>
                <small>{stage === dino.stage ? tr('ACUM', 'NOW') : when}</small>
                <strong>{name}</strong>
                <em>{what}</em>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="hero-vision-guide">
        {phase === 'done' || failed ? (
          <>
            <div className="hv-next-goal">
              <strong>
                {dino.level >= 50
                  ? tr('Aventura voastră continuă', 'Your adventure continues')
                  : tr(
                      `${dino.stage === 'baby' ? 'Primul obiectiv' : 'Următorul obiectiv'}: nivelul ${targetLevel}`,
                      `${dino.stage === 'baby' ? 'Our first goal' : 'Our next goal'}: level ${targetLevel}`,
                    )}
              </strong>
              <span>
                {dino.stage === 'baby'
                  ? tr('Hrănește-l, evoluează-l, apoi explorați împreună.', 'Feed, evolve, then explore together.')
                  : dino.stage === 'juvenile'
                    ? tr('Evoluează-l pentru a debloca ultimata.', 'Evolve to unlock the ultimate.')
                    : tr('Pregătește echipa pentru următoarea aventură.', 'Prepare your team for the next adventure.')}
              </span>
            </div>
            <button className="realm-button hero-vision-primary" onClick={finish}>
              {dino.level >= 50
                ? tr('Continuă aventura', 'Continue adventure')
                : tr('Începe antrenamentul', 'Start training')}{' '}
              →
            </button>
          </>
        ) : (
          <button className="realm-link" onClick={finish}>
            {tr('Sari peste', 'Skip')}
          </button>
        )}
      </div>
    </section>
  );
}
