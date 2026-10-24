import { useEffect, useState, type CSSProperties } from 'react';
import { AnimatedDinosaur } from './AnimatedDinosaur';
import { loadAnimation, loadBossAnimation, loadSpriteImage, type SpriteManifest } from './animation';
import { ARENA_BOSSES } from './arenaBosses';
import { entrance, exchange, fighter, runMs, runStart, type Step, type Unit } from './battleChoreography';
import { calloutText } from './battleCallouts';
import { SPECIES_NAMES, type Dino } from './game';
import { playSound } from './sound';
import './gameplay.css';
import './hero-vision.css';

type Phase = 'arrival' | 'attacking' | 'guarding' | 'blasting' | 'done';

/** A cinematic rehearsal: never creates a battle or changes the player's dinosaur/resources. */
export function HeroVision({ dino, lang, finish }: { dino: Dino; lang: number; finish: () => void }) {
  const tr = (ro: string, en: string) => lang ? en : ro;
  const [art, setArt] = useState<{ ally: SpriteManifest; enemy: SpriteManifest } | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('arrival');
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const opponentElement = 'fire';
  const enemyName = ARENA_BOSSES[opponentElement].name;
  useEffect(() => {
    let active = true;
    (async () => {
      const [ally, enemy] = await Promise.all([
        loadAnimation(dino.species, dino.element, 'adult'),
        loadBossAnimation(opponentElement),
      ]);
      if (!ally || !enemy) throw Error('Missing vision artwork');
      await Promise.all([ally, enemy].flatMap(m => Object.values(m.clips.se ?? {}).map(c => loadSpriteImage(c.sheet))));
      if (!active) return;
      setArt({ ally, enemy });
      setSteps(entrance(fighter(ally), fighter(enemy), { ally: true, enemy: true }));
    })().catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [dino.species, dino.element, opponentElement]);
  const step = steps[index];
  useEffect(() => {
    if (!step) return;
    if (!Number.isFinite(step.ms)) {
      if (!art || phase === 'done') return;
      const timer = setTimeout(() => {
        if (phase === 'blasting') { setPhase('done'); playSound('victory'); return; }
        const action = phase === 'arrival' ? 'basic' : phase === 'attacking' ? 'defend' : 'ultimate';
        setPhase(action === 'basic' ? 'attacking' : action === 'defend' ? 'guarding' : 'blasting');
        setSteps(exchange({
          ally: action, foe: action === 'defend' ? 'ultimate' : 'none',
          dealt: action === 'ultimate' ? 82 : action === 'basic' ? 18 : 0,
          enemyAfterStrike: action === 'ultimate' ? 0 : 82,
          taken: 0, dodged: false, reflected: 0,
        }, fighter(art.ally), fighter(art.enemy), { ally: true, enemy: action !== 'ultimate' }));
        setIndex(0);
      }, 650);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setIndex(i => i + 1), step.ms);
    return () => clearTimeout(timer);
  }, [step, phase, art]);
  useEffect(() => {
    if (!step) return;
    const before = steps[index - 1];
    if (((step.ally === 'ultimate' || step.ally === 'attack') && before?.ally !== step.ally) ||
        ((step.enemy === 'attack' || step.enemy === 'ultimate') && before?.enemy !== step.enemy)) playSound('swing');
    if (step.impact) playSound(step.impact.kind === 'ultimate' ? 'heavy' : step.impact.kind === 'hit' ? 'hit' : 'block');
  }, [step, steps, index]);
  const pose = (unit: Unit) => ({
    clip: step?.[unit] ?? 'idle',
    key: `${runStart(steps, index, unit)}-${step?.[unit] ?? 'idle'}`,
    style: { '--motion-ms': `${runMs(steps, index, unit) || 600}ms` } as CSSProperties,
  });
  const a = pose('ally'), e = pose('enemy');
  const guidance = failed ? tr('Viziunea nu s-a putut încărca. Eroul tău te așteaptă!', 'The vision could not load. Your hero is waiting!')
    : !art ? tr('Pregătim arena…', 'Preparing the arena…')
    : phase === 'attacking' ? tr('Primul atac: curajul unui viitor campion!', 'The first strike: the courage of a future champion!')
    : phase === 'guarding' ? tr('Scutul rezistă ultimatei de foc!', 'The shield withstands the fire ultimate!')
    : phase === 'blasting' ? tr('Aceasta este puterea pe care o poate descoperi!', 'This is the power your hero can discover!')
    : phase === 'done' ? tr('Aventura lui începe acum.', 'Your hero’s adventure starts now.')
    : tr('Un erou se ascunde în acest pui. Descoperă-i puterea!', 'A hero is hiding in this hatchling. Discover their power!');
  return <section className="hero-vision" data-phase={phase} aria-label={tr('Viziunea eroului', 'Hero vision')}>
    <div className="hero-vision-intro"><span className="realm-eyebrow">{tr('VIZIUNE DIN VIITOR', 'A VISION OF THE FUTURE')}</span>
      <h3>{dino.nickname} · {tr('potențialul unui erou', 'a hero’s potential')}</h3>
      <p>{tr('O demonstrație cu versiunea adultă. Puiul tău rămâne în siguranță în habitat.', 'A demonstration with the adult version. Your hatchling stays safe in its habitat.')}</p>
    </div>
    <div className={`battle-environment hero-vision-arena ${step && Number.isFinite(step.ms) ? 'battle-playing' : ''} ${step?.ally === 'ultimate' || step?.enemy === 'ultimate' ? 'battle-ultimate' : ''}`}>
      <div className="battle-stage">
        <div className="hero-vision-names"><strong>{dino.nickname}<small>{SPECIES_NAMES[dino.species]} · {tr('Adult', 'Adult')}</small></strong><span>VS</span><strong>{enemyName}<small>{tr('BOSS · Viziune', 'BOSS · Vision')}</small></strong></div>
        {art && <>
          <div className="battle-unit ally" data-motion={a.clip} style={a.style}><AnimatedDinosaur key={a.key} manifest={art.ally} clip={a.clip} label={`${dino.nickname} adult`} /></div>
          <div className="battle-unit enemy" data-motion={e.clip} style={e.style}><AnimatedDinosaur key={e.key} manifest={art.enemy} clip={e.clip} label={enemyName} bossElement={opponentElement} className="dinosaur-opponent" /></div>
        </>}
        {step?.impact && <div key={`impact-${index}`} className={`battle-impact on-${step.impact.on} kind-${step.impact.kind}`} aria-hidden="true">{step.impact.kind === 'guard' ? '🛡' : '✹'}</div>}
        {step?.say?.map((c, i) => <div key={`${index}-${i}`} className={`battle-callout on-${c.on} kind-${c.kind}`} style={{ '--row': i } as CSSProperties}>{calloutText(c, c.on === 'ally' ? dino.nickname : enemyName, lang)}</div>)}
      </div>
    </div>
    <div className="hero-vision-guide">
      <p role="status" aria-live="polite">{guidance}</p>
      {(phase === 'done' || failed) && <button className="realm-button hero-vision-primary" onClick={finish}>{tr('Hrănește-l și ajută-l să crească', 'Feed your hero and help them grow')} →</button>}
      <small>{tr('Nivel 10: evoluție și primele lupte · Nivel 25: adult și ultimată', 'Level 10: evolution and first battles · Level 25: adult and ultimate')}</small>
      {phase !== 'done' && <button className="realm-link" onClick={finish}>{tr('Sari peste', 'Skip')}</button>}
    </div>
  </section>;
}
