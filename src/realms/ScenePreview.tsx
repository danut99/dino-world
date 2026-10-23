import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import World from './World';
import { DinosaurArt } from './DinosaurArt';
import { AnimatedBoss } from './AnimatedBoss';
import { loadAnimation, loadBossAnimation, STAGE_CLIPS, type Clip, type SpriteManifest } from './animation';
import {
  entrance,
  exchange,
  fighter,
  rest,
  runMs,
  runStart,
  type BattleAction,
  type Fighter,
  type Step,
  type Unit,
} from './battleChoreography';
import { ELEMENTS, REALM_NAMES, SPECIES_NAMES, type RealmId } from './game';
import {
  BOSSES,
  FAMILIES,
  ROSTER,
  STAGES,
  combatant,
  combatantElement,
  combatantId,
  combatantName,
  combatantStage,
  defaultOpponent,
  habitatResidents,
  previewSave,
  rosterEntry,
  stageLabel,
  type Combatant,
  type RosterEntry,
} from './scenePreviewRoster';
import './realms.css';
import './pixel-theme.css';
import './gameplay.css';
import './scene-preview.css';

type Scene = 'arena' | 'habitat';
const element = (id: RealmId) => ELEMENTS.find((e) => e.id === id)!;
const params = () => new URLSearchParams(window.location.search);

/** The sprite of either side of the arena, as the real battle screen draws it. */
function CombatantArt({ who, clip, className, paused }: { who: Combatant; clip: Clip; className?: string; paused?: boolean }) {
  return who.kind === 'boss' ? (
    <AnimatedBoss element={who.element} name={who.name} animation={clip} className={className ?? ''} paused={paused} />
  ) : (
    <DinosaurArt species={who.entry.species} element={who.entry.element} stage={who.entry.stage} animation={clip} className={className} paused={paused} />
  );
}

/**
 * Developer page (`?mode=preview`): every animated dinosaur and champion, dropped into the real arena
 * choreography and the real world renderer, so a sprite can be judged in context before it ships.
 */
export default function ScenePreview() {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('dino-realms-language') === 'en' ? 1 : 0;
    } catch {
      return 0;
    }
  });
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [selected, setSelected] = useState<Combatant>(
    () => combatant(params().get('dino')) ?? combatant('trex_fire_adult') ?? { kind: 'dino', entry: ROSTER[0] },
  );
  const [scene, setScene] = useState<Scene>(() => (params().get('scene') === 'habitat' ? 'habitat' : 'arena'));
  const [foe, setFoe] = useState<Combatant>(() => combatant(params().get('foe')) ?? defaultOpponent(selected));
  const [animateThumbs, setAnimateThumbs] = useState(false);
  const [allStages, setAllStages] = useState(false);
  const [allFamilies, setAllFamilies] = useState(false);
  useEffect(() => {
    document.getElementById('boot-loader')?.remove();
    document.title = 'Dino Realms · Scene preview';
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'preview');
    url.searchParams.set('dino', combatantId(selected));
    url.searchParams.set('scene', scene);
    url.searchParams.set('foe', combatantId(foe));
    window.history.replaceState(null, '', url);
  }, [selected, scene, foe]);
  const choose = (next: Combatant) => {
    setSelected(next);
    // A matching-stage partner keeps the two sides at comparable sizes; a boss partner is kept as chosen.
    if (combatantId(foe) === combatantId(next) || (foe.kind === 'dino' && foe.entry.stage !== combatantStage(next)))
      setFoe(defaultOpponent(next));
  };
  const swap = () => {
    const previous = selected;
    setSelected(foe);
    setFoe(previous);
  };
  const tab = (s: Scene, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={scene === s}
      className={`realm-button${scene === s ? '' : ' secondary'}`}
      onClick={() => setScene(s)}
    >
      {label}
    </button>
  );
  const selectedEl = element(combatantElement(selected));
  const card = (who: Combatant, label: string) => {
    const id = combatantId(who),
      active = id === combatantId(selected);
    return (
      <button key={id} type="button" className={`scene-preview-stage${active ? ' selected' : ''}`} aria-pressed={active} onClick={() => choose(who)}>
        <CombatantArt who={who} clip="idle" paused={!animateThumbs} />
        <span>{label}</span>
      </button>
    );
  };
  return (
    <main className="realms-app scene-preview" lang={lang ? 'en' : 'ro'}>
      <aside className="scene-preview-roster" aria-label={tr('Toți dinozaurii animați', 'All animated dinosaurs')}>
        <header>
          <span className="realm-eyebrow">DINO REALMS</span>
          <h1>{tr('Previzualizare scene', 'Scene preview')}</h1>
          <p className="realm-note">
            {ROSTER.length} {tr('modele animate', 'animated models')} · {FAMILIES.length} {tr('familii', 'families')} · {BOSSES.length}{' '}
            {tr('campioni', 'champions')}
          </p>
          <label className="scene-preview-check">
            <input type="checkbox" checked={animateThumbs} onChange={(e) => setAnimateThumbs(e.target.checked)} />
            {tr('Animă miniaturile', 'Animate thumbnails')}
          </label>
        </header>
        {FAMILIES.map((family) => {
          const el = element(family.element);
          return (
            <section key={family.id} className="scene-preview-family">
              <h3 style={{ color: el.color }}>
                {el.symbol} {SPECIES_NAMES[family.species]} · {el.name[lang]}
              </h3>
              <div className="scene-preview-stages">
                {STAGES.map((stage) => {
                  const entry = rosterEntry(`${family.id}_${stage}`)!;
                  return card({ kind: 'dino', entry }, stageLabel(stage, lang));
                })}
              </div>
            </section>
          );
        })}
        <section className="scene-preview-family scene-preview-bosses">
          <h3>✹ {tr('Campionii arenei (boss)', 'Arena champions (boss)')}</h3>
          <div className="scene-preview-stages">
            {BOSSES.map((b) => card({ kind: 'boss', element: b.element, name: b.name }, `${element(b.element).symbol} ${b.name}`))}
          </div>
        </section>
        <footer>
          <a className="realm-link" href="/">
            ← {tr('Înapoi la joc', 'Back to the game')}
          </a>
          <label>
            {tr('Limbă', 'Language')}
            <select
              value={lang}
              onChange={(e) => {
                const next = Number(e.target.value);
                setLang(next);
                try {
                  localStorage.setItem('dino-realms-language', next ? 'en' : 'ro');
                } catch {
                  /* Optional preference. */
                }
              }}
            >
              <option value={0}>Română</option>
              <option value={1}>English</option>
            </select>
          </label>
        </footer>
      </aside>
      <section className="scene-preview-main">
        <div className="scene-preview-head">
          <div>
            <span className="realm-eyebrow" style={{ color: selectedEl.color }}>
              {selectedEl.symbol} {selectedEl.name[lang]} · {REALM_NAMES[selectedEl.id][lang]}
            </span>
            <h2>{combatantName(selected, lang)}</h2>
          </div>
          <div className="scene-preview-tabs" role="tablist">
            {tab('arena', tr('Arenă', 'Arena'))}
            {tab('habitat', tr('Habitat', 'Habitat'))}
          </div>
        </div>
        {scene === 'arena' ? (
          <ArenaScene key={`${combatantId(selected)}-${combatantId(foe)}`} ally={selected} foe={foe} setFoe={setFoe} swap={swap} lang={lang} />
        ) : selected.kind === 'boss' ? (
          <p className="realm-note">
            {tr(
              'Campionii trăiesc doar în arenă: nu au habitat. Alege un dinozaur din listă ca să vezi insula.',
              'Champions live only in the arena: they have no habitat. Pick a dinosaur from the list to see the island.',
            )}
          </p>
        ) : (
          <>
            <div className="realm-animation-toolbar">
              <label>
                <input type="checkbox" checked={allStages} onChange={(e) => setAllStages(e.target.checked)} />
                {tr('Toate stadiile familiei', 'All stages of the family')}
              </label>
              <label>
                <input type="checkbox" checked={allFamilies} onChange={(e) => setAllFamilies(e.target.checked)} />
                {tr('Toate familiile tărâmului', 'All families of the realm')}
              </label>
            </div>
            <HabitatScene entry={selected.entry} allStages={allStages} allFamilies={allFamilies} lang={lang} />
            <p className="realm-note">
              {tr(
                'Aceeași randare ca în joc: dinozaurii stau pe locurile insulei, se plimbă și se întorc. Trage ca să te miști, rotița pentru zoom.',
                'The same rendering as in the game: dinosaurs stand on the island spots, wander and return. Drag to move, wheel to zoom.',
              )}
            </p>
          </>
        )}
      </section>
    </main>
  );
}

const loadCombatant = (c: Combatant) =>
  c.kind === 'boss' ? loadBossAnimation(c.element) : loadAnimation(c.entry.species, c.entry.element, c.entry.stage);

/** The arena, with the real beat-by-beat choreography of a fight, driven by buttons instead of a reducer. */
function ArenaScene({
  ally,
  foe,
  setFoe,
  swap,
  lang,
}: {
  ally: Combatant;
  foe: Combatant;
  setFoe: (c: Combatant) => void;
  swap: () => void;
  lang: number;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [fighters, setFighters] = useState<{ ally: Fighter; enemy: Fighter; manifest: SpriteManifest | null } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [alive, setAlive] = useState({ ally: true, enemy: true });
  const [hp, setHp] = useState({ ally: 100, enemy: 100 });
  useEffect(() => {
    let active = true;
    Promise.all([loadCombatant(ally), loadCombatant(foe)]).then(([a, e]) => {
      if (!active) return;
      const next = { ally: fighter(a), enemy: fighter(e), manifest: a };
      setFighters(next);
      setAlive({ ally: true, enemy: true });
      setHp({ ally: 100, enemy: 100 });
      setSteps(entrance(next.ally, next.enemy, { ally: true, enemy: true }));
      setIndex(0);
    });
    return () => {
      active = false;
    };
  }, [ally, foe]);
  const step = steps[index],
    busy = !!step && Number.isFinite(step.ms);
  useEffect(() => {
    if (!step) return;
    if (step.reveal) {
      const unit = step.reveal;
      const fallen = step[unit] === 'death';
      setHp((h) => ({ ...h, [unit]: fallen ? 0 : Math.max(5, h[unit] - (step.impact?.kind === 'guard' ? 8 : step.impact?.kind === 'ultimate' ? 35 : 18)) }));
    }
    if (!Number.isFinite(step.ms)) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), step.ms);
    return () => clearTimeout(timer);
  }, [steps, index, step]);
  const play = (sequence: Step[], next = alive) => {
    setAlive(next);
    setSteps(sequence);
    setIndex(0);
  };
  const reset = () => {
    if (!fighters) return;
    setHp({ ally: 100, enemy: 100 });
    play(entrance(fighters.ally, fighters.enemy, { ally: true, enemy: true }), { ally: true, enemy: true });
  };
  const round = (action: BattleAction, next = alive) => fighters && play(exchange(action, fighters.ally, fighters.enemy, next), next);
  const solo = (clip: Clip) => {
    if (!fighters) return;
    const next = { ally: clip !== 'death', enemy: alive.enemy };
    play([{ ally: clip, enemy: 'idle', ms: clip === 'idle' ? Infinity : fighters.ally.ms(clip) }, rest(next)], next);
  };
  const pose = (unit: Unit) => ({
    clip: step?.[unit] ?? ('idle' as Clip),
    key: fighters?.[unit].clips.size ? `${runStart(steps, index, unit)}-${step?.[unit] ?? 'idle'}` : 'static',
    style: { '--motion-ms': `${runMs(steps, index, unit) || 600}ms` } as CSSProperties,
  });
  const a = pose('ally'),
    e = pose('enemy');
  const allyEl = element(combatantElement(ally)),
    foeEl = element(combatantElement(foe));
  const allyName = combatantName(ally, lang),
    foeName = combatantName(foe, lang);
  const level = (c: Combatant) => (c.kind === 'boss' ? 30 : c.entry.stage === 'baby' ? 1 : c.entry.stage === 'juvenile' ? 8 : 20);
  const stage = combatantStage(ally);
  const describe = (s: Step | undefined) =>
    !s ? tr('Se încarcă…', 'Loading…') : Number.isFinite(s.ms) ? `${allyName}: ${s.ally} · ${foeName}: ${s.enemy} · ${Math.round(s.ms)} ms` : `${tr('Repaus', 'Idle')} · ${s.ally} / ${s.enemy}`;
  const commands: BattleAction[] = stage === 'adult' ? ['basic', 'defend', 'ultimate'] : ['basic', 'defend'];
  const opponentOption = (c: Combatant, label: string) => (
    <option key={combatantId(c)} value={combatantId(c)} disabled={combatantId(c) === combatantId(ally)}>
      {label}
    </option>
  );
  return (
    <>
      <div className="gameplay-screen gameplay-battle scene-arena">
        <div className={`battle-environment ${busy ? 'battle-playing' : ''}`}>
          <div className="battle-round">
            <span>{tr('PREVIZUALIZARE', 'PREVIEW')}</span>
            <small>
              {allyName} → {foeName} · 1v1
            </small>
          </div>
          <div className="battle-unit ally" data-motion={a.clip} style={a.style}>
            <div className="battle-vitals">
              <strong>
                {allyEl.symbol} {allyName} <small>Lv. {level(ally)}</small>
              </strong>
              <div className="realm-meter health">
                <i style={{ width: `${hp.ally}%` }} />
              </div>
              <span>{hp.ally} / 100 HP</span>
              <div className="realm-meter energy">
                <i style={{ width: '100%' }} />
              </div>
              <small>ϟ 100 / 100</small>
            </div>
            <CombatantArt key={a.key} who={ally} clip={a.clip} />
          </div>
          <div className="battle-unit enemy" data-motion={e.clip} style={e.style}>
            <div className="battle-vitals">
              <strong>
                {foeEl.symbol} {foeName} <small>Lv. {level(foe)}</small>
              </strong>
              <div className="realm-meter health">
                <i style={{ width: `${hp.enemy}%` }} />
              </div>
              <span>{hp.enemy} / 100 HP</span>
            </div>
            <CombatantArt key={e.key} who={foe} clip={e.clip} className="dinosaur-opponent" />
          </div>
          {step?.impact && (
            <div className={`battle-impact on-${step.impact.on} kind-${step.impact.kind}`} key={index} aria-hidden="true">
              {step.impact.kind === 'guard' ? '◇' : step.impact.kind === 'ultimate' ? '✹' : '╱'}
            </div>
          )}
          <div className="battle-narration" aria-live="polite">
            {describe(step)}
          </div>
        </div>
        <div className="battle-command-bar">
          {commands.map((name) => (
            <button
              key={name}
              type="button"
              className={`battle-command ${name}`}
              disabled={!fighters || busy || !alive.ally || !alive.enemy}
              onClick={() => round(name)}
            >
              <span>{name === 'basic' ? '⚔' : name === 'defend' ? '◇' : '✹'}</span>
              <strong>{name === 'basic' ? tr('Lovitură', 'Basic') : name === 'defend' ? tr('Apărare', 'Defend') : tr('Erupție', 'Eruption')}</strong>
              <small>{name === 'ultimate' ? '100 ϟ' : name === 'defend' ? '−40% damage' : tr('+25 energie', '+25 energy')}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="realm-animation-toolbar">
        <button type="button" disabled={!fighters || busy} onClick={reset}>
          {tr('Intrare în arenă', 'Arena entrance')}
        </button>
        <button type="button" disabled={!fighters || busy || !alive.enemy} onClick={() => round('basic', { ally: true, enemy: false })}>
          {tr('Inamicul cade', 'Enemy falls')}
        </button>
        <button type="button" disabled={!fighters || busy || !alive.ally || !alive.enemy} onClick={() => round('basic', { ally: false, enemy: true })}>
          {tr('Aliatul cade', 'Ally falls')}
        </button>
        <label>
          {tr('Clip direct', 'Play clip')}
          <select
            aria-label={tr('Clip direct', 'Play clip')}
            disabled={!fighters || busy}
            value=""
            onChange={(ev) => ev.target.value && solo(ev.target.value as Clip)}
          >
            <option value="">—</option>
            {STAGE_CLIPS[stage].map((clip) => (
              <option key={clip} value={clip} disabled={!fighters?.ally.clips.has(clip)}>
                {clip}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr('Adversar', 'Opponent')}
          <select
            aria-label={tr('Adversar', 'Opponent')}
            value={combatantId(foe)}
            onChange={(ev) => {
              const next = combatant(ev.target.value);
              if (next) setFoe(next);
            }}
          >
            <optgroup label={tr('Campioni (boss)', 'Champions (boss)')}>
              {BOSSES.map((b) => opponentOption({ kind: 'boss', element: b.element, name: b.name }, `${b.name} · ${element(b.element).name[lang]}`))}
            </optgroup>
            <optgroup label={tr('Dinozauri', 'Dinosaurs')}>
              {ROSTER.map((entry) =>
                opponentOption({ kind: 'dino', entry }, `${SPECIES_NAMES[entry.species]} · ${element(entry.element).name[lang]} · ${stageLabel(entry.stage, lang)}`),
              )}
            </optgroup>
          </select>
        </label>
        <button type="button" disabled={busy} onClick={swap}>
          {tr('Schimbă locurile', 'Swap sides')} ⇄
        </button>
      </div>
      <p className="realm-animation-status" role="status">
        {fighters
          ? `${fighters.manifest?.status ?? 'static'} · ${tr('clipuri', 'clips')}: ${[...fighters.ally.clips].join(', ') || '—'}`
          : tr('Se încarcă manifestele…', 'Loading manifests…')}
      </p>
    </>
  );
}

/** The world renderer with a synthetic save: only the previewed residents live on the island. */
function HabitatScene({
  entry,
  allStages,
  allFamilies,
  lang,
}: {
  entry: RosterEntry;
  allStages: boolean;
  allFamilies: boolean;
  lang: number;
}) {
  const dinos = useMemo(() => habitatResidents(entry, { allStages, allFamilies }, lang), [entry, allStages, allFamilies, lang]);
  const save = useMemo(() => previewSave(dinos), [dinos]);
  const [now] = useState(() => Date.now());
  return (
    <div className="scene-habitat">
      <World
        key={entry.element}
        save={save}
        realm={entry.element}
        lang={lang}
        placing={false}
        moving={null}
        onPlace={() => {}}
        onSelect={() => {}}
        now={now}
      />
    </div>
  );
}
