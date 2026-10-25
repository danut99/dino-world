import { useEffect, useState, type CSSProperties } from 'react';
import { AnimatedDinosaur } from './AnimatedDinosaur';
import { loadAnimation, loadBossAnimation, loadSpriteImage, type SpriteManifest } from './animation';
import { ARENA_BOSSES } from './arenaBosses';
import { entrance, exchange, fighter, runMs, runStart, type Step, type Unit } from './battleChoreography';
import { calloutText } from './battleCallouts';
import { SPECIES_NAMES, type Dino, type Stage } from './game';
import { DinosaurArt } from './DinosaurArt';
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
  // The boss's health tells the story at a glance: the first strike chips it, the shield holds, the ultimate ends it.
  const [bossHp, setBossHp] = useState(100);
  useEffect(() => {
    if (step?.impact?.on === 'enemy' && step.impact.kind !== 'guard') setBossHp(phase === 'blasting' ? 0 : 82);
  }, [step, phase]);
  const pose = (unit: Unit) => ({
    clip: step?.[unit] ?? 'idle',
    key: `${runStart(steps, index, unit)}-${step?.[unit] ?? 'idle'}`,
    style: { '--motion-ms': `${runMs(steps, index, unit) || 600}ms` } as CSSProperties,
  });
  const a = pose('ally'), e = pose('enemy');
  // One big title card per beat of the fight; the three beats show as chips under the arena.
  const banner: Record<Phase, [string, string]> = {
    arrival: [tr('VIZIUNE DIN VIITOR', 'A VISION OF THE FUTURE'), tr(`Așa va lupta ${dino.nickname} când va crește`, `This is how ${dino.nickname} will fight, all grown up`)],
    attacking: [tr('ATAC!', 'STRIKE!'), tr('Primul atac al unui viitor campion', 'The first strike of a future champion')],
    guarding: [tr('SCUT!', 'GUARD!'), tr('Scutul rezistă ultimatei boss-ului', "The shield holds against the boss's ultimate")],
    blasting: [tr('ULTIMATĂ!', 'ULTIMATE!'), tr('Lovitura supremă, deblocată la nivelul 25', 'The finishing blow, unlocked at level 25')],
    done: [tr('VICTORIE!', 'VICTORY!'), tr('Acest viitor începe acum, cu tine', 'That future starts now, with you')],
  };
  const [cardTitle, cardLine] = failed ? [tr('EROUL TĂU', 'YOUR HERO'), tr('Viziunea nu s-a putut încărca, dar eroul te așteaptă!', 'The vision could not load, but your hero is waiting!')] : banner[phase];
  const order: Phase[] = ['arrival', 'attacking', 'guarding', 'blasting', 'done'];
  const beats: [Phase, string][] = [['attacking', tr('Atac', 'Strike')], ['guarding', tr('Scut', 'Guard')], ['blasting', tr('Ultimată', 'Ultimate')]];
  const road: [Stage, string, string, string][] = [
    ['baby', tr('ACUM', 'NOW'), tr('Pui', 'Hatchling'), tr('Crește cu hrană', 'Grows on food')],
    ['juvenile', tr('NIVEL 10', 'LEVEL 10'), tr('Juvenil', 'Juvenile'), tr('Lupte și expediții', 'Battles and expeditions')],
    ['adult', tr('NIVEL 25', 'LEVEL 25'), tr('Adult', 'Adult'), tr('Ultimata din viziune', 'The ultimate you just saw')],
  ];
  return <section className="hero-vision" data-phase={phase} aria-label={tr('Viziunea eroului', 'Hero vision')}>
    <div className={`battle-environment hero-vision-arena ${step && Number.isFinite(step.ms) ? 'battle-playing' : ''} ${step?.ally === 'ultimate' || step?.enemy === 'ultimate' ? 'battle-ultimate' : ''}`}>
      <div className="battle-stage">
        <div className="hero-vision-names">
          <div className="hv-fighter">
            <strong>{dino.nickname}</strong>
            <small>{SPECIES_NAMES[dino.species]} · {tr('Adult', 'Adult')}</small>
            <i className="hv-hp ally"><b style={{ width: '100%' }} /></i>
          </div>
          <span>VS</span>
          <div className="hv-fighter foe">
            <strong>{enemyName}</strong>
            <small>BOSS</small>
            <i className="hv-hp"><b style={{ width: `${bossHp}%` }} /></i>
          </div>
        </div>
        {art && <>
          <div className="battle-unit ally" data-motion={a.clip} style={a.style}><AnimatedDinosaur key={a.key} manifest={art.ally} clip={a.clip} label={`${dino.nickname} adult`} /></div>
          <div className="battle-unit enemy" data-motion={e.clip} style={e.style}><AnimatedDinosaur key={e.key} manifest={art.enemy} clip={e.clip} label={enemyName} bossElement={opponentElement} className="dinosaur-opponent" /></div>
        </>}
        {step?.impact && <div key={`impact-${index}`} className={`battle-impact on-${step.impact.on} kind-${step.impact.kind}`} aria-hidden="true">{step.impact.kind === 'guard' ? '🛡' : '✹'}</div>}
        {step?.say?.map((c, i) => <div key={`${index}-${i}`} className={`battle-callout on-${c.on} kind-${c.kind}`} style={{ '--row': i } as CSSProperties}>{calloutText(c, lang)}</div>)}
        <div key={failed ? 'failed' : phase} className="hv-banner" role="status" aria-live="polite">
          <strong>{cardTitle}</strong>
          <span>{!art && !failed ? tr('Viziunea se formează…', 'The vision takes shape…') : cardLine}</span>
        </div>
      </div>
    </div>
    <ol className="hv-beats" aria-hidden="true">
      {beats.map(([id, label]) => (
        <li key={id} className={order.indexOf(phase) > order.indexOf(id) ? 'done' : phase === id ? 'current' : ''}>{label}</li>
      ))}
    </ol>
    <div className="hv-road">
      <p>{tr(`${dino.nickname} e acum un pui. Hrănește-l ca să devină eroul din viziune:`, `${dino.nickname} is a hatchling now. Feed them to become the hero of the vision:`)}</p>
      <ol>
        {road.map(([stage, when, name, what], i) => (
          <li key={stage} className={i === 0 ? 'now' : ''}>
            <span className="hv-road-art"><DinosaurArt species={dino.species} element={dino.element} stage={stage} paused frame={0} /></span>
            <small>{when}</small>
            <strong>{name}</strong>
            <em>{what}</em>
          </li>
        ))}
      </ol>
    </div>
    <div className="hero-vision-guide">
      {phase === 'done' || failed
        ? <button className="realm-button hero-vision-primary" onClick={finish}>{tr('Hrănește-l și ajută-l să crească', 'Feed your hero and help them grow')} →</button>
        : <button className="realm-link" onClick={finish}>{tr('Sari peste', 'Skip')}</button>}
    </div>
  </section>;
}
