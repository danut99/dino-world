import { useEffect, useState, type ReactNode } from 'react';
import { Window } from './RealmsApp';
import { AccountPanel } from './AccountPanel';
import { DinosaurArt } from './DinosaurArt';
import { PLAYABLE_DINOSAURS } from './playableDinosaurs';
import { ELEMENTS, SPECIES_NAMES, type RealmId, type Species, type Stage } from './game';
import { loadAnimation, loadSpriteImage, type Clip } from './animation';
import { useClipSequence } from './useClipSequence';
import './landing.css';

/** What each age plays, over and over: a few steps between moves (babies have no fight moves drawn). */
const ROUTINE: Record<Stage, Clip[]> = {
  baby: ['walk', 'idle'],
  juvenile: ['walk', 'attack', 'walk', 'defend'],
  adult: ['walk', 'attack', 'walk', 'ultimate', 'walk', 'defend'],
};
/** How long the looping clips (walk, idle) last in the routine. */
const LOOP_MS = 1400;

/** The fire T-Rex at the age the visitor picks, walking and fighting in an endless routine. */
function Showcase({ lang }: { lang: number }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [stage, setStage] = useState<Stage>('adult');
  // The age on screen changes only once every sheet of its routine is loaded, so no move ever waits on a download.
  const [shown, setShown] = useState<{ stage: Stage; lengths: Partial<Record<Clip, number>> } | null>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    let active = true;
    void loadAnimation('trex', 'fire', stage).then(async (m) => {
      const clips = m?.clips.se;
      if (!clips) return;
      const used = [...new Set(ROUTINE[stage])].filter((c) => clips[c]);
      await Promise.all(used.map((c) => loadSpriteImage(clips[c]!.sheet).catch(() => null)));
      if (!active) return;
      setShown({
        stage,
        lengths: Object.fromEntries(used.map((c) => [c, clips[c]!.durationsMs.reduce((a, b) => a + b, 0)])),
      });
      setStep(0);
    });
    return () => {
      active = false;
    };
  }, [stage]);
  const routine = shown ? ROUTINE[shown.stage].filter((c) => shown.lengths[c]) : [];
  const move = routine[step % Math.max(1, routine.length)] ?? 'idle';
  useEffect(() => {
    if (!shown || !routine.length) return;
    const ms = move === 'walk' || move === 'idle' ? LOOP_MS : (shown.lengths[move] ?? 1000) + 150;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % routine.length), ms);
    return () => window.clearTimeout(id);
  }, [shown, step, move, routine.length]);
  const ages: [Stage, string, string][] = [
    ['baby', tr('Pui', 'Baby'), tr('Nv. 1–9', 'Lv. 1–9')],
    ['juvenile', tr('Juvenil', 'Juvenile'), tr('Nv. 10–24', 'Lv. 10–24')],
    ['adult', tr('Adult', 'Adult'), tr('Nv. 25–50', 'Lv. 25–50')],
  ];
  return (
    <div className="landing-showcase">
      <div className={`landing-arena stage-${shown?.stage ?? stage} move-${move}`} aria-hidden="true">
        <span className="landing-glow" />
        <span className="landing-dino">
          {shown && <DinosaurArt species="trex" element="fire" stage={shown.stage} animation={move} />}
        </span>
      </div>
      <div className="landing-picker" role="group" aria-label={tr('Vârsta', 'Age')}>
        {ages.map(([id, label, levels]) => (
          <button key={id} aria-pressed={stage === id} onClick={() => setStage(id)}>
            {label}
            <small>{levels}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The first family of an element that has every age drawn, for the feature cards. */
const familyOf = (element: RealmId) => PLAYABLE_DINOSAURS.find((d) => d.element === element)?.species ?? 'trex';

/** The adult the moves section shows off. */
const FEATURED = { species: 'ignasaur', element: 'fire' } as const;
const MOVES: { clip: Clip; name: [string, string]; text: [string, string] }[] = [
  {
    clip: 'walk',
    name: ['Explorează', 'Explore'],
    text: ['Cutreieră insula și pleacă în expediții.', 'Roams your island and sets out on expeditions.'],
  },
  {
    clip: 'attack',
    name: ['Atacă', 'Attack'],
    text: ['Lovește adversarii în arenă și în dueluri.', 'Strikes rivals in the arena and in duels.'],
  },
  {
    clip: 'defend',
    name: ['Apără', 'Defend'],
    text: ['Blochează loviturile ca să-și apere echipa.', 'Blocks blows to keep its team standing.'],
  },
  {
    clip: 'ultimate',
    name: ['Lovitura supremă', 'Ultimate'],
    text: ['Doar adulții o au: cea mai puternică mișcare.', 'Only adults have it: their mightiest move.'],
  },
];

/** One move on a loop: walking without end, or the move, a breath of idle, and again. */
function MoveCard({ move, lang }: { move: (typeof MOVES)[number]; lang: number }) {
  const { clip } = useClipSequence(
    FEATURED.species,
    FEATURED.element,
    'adult',
    move.clip === 'walk' ? ['walk'] : [move.clip, 'idle'],
    { repeat: true },
  );
  return (
    <article className={`move-card move-${move.clip}`}>
      <span className="move-card-stage" aria-hidden="true">
        <span className="move-card-dino">
          <DinosaurArt species={FEATURED.species} element={FEATURED.element} stage="adult" animation={clip} />
        </span>
      </span>
      <h3>{move.name[lang]}</h3>
      <p>{move.text[lang]}</p>
    </article>
  );
}

/** The moves section: one adult dinosaur, each of its moves in its own card. */
function Moves({ lang }: { lang: number }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  return (
    <section className="landing-moves-section" aria-labelledby="moves-title">
      <header>
        <span className="landing-kicker">{tr('În luptă', 'In battle')}</span>
        <h2 id="moves-title">{tr('Fiecare dinozaur are mișcările lui', 'Every dinosaur has its own moves')}</h2>
        <p>
          {tr(
            `${SPECIES_NAMES[FEATURED.species]}, adult de foc: așa arată când explorează, atacă, se apără și dezlănțuie lovitura supremă.`,
            `${SPECIES_NAMES[FEATURED.species]}, a fire adult: here it is exploring, attacking, defending and unleashing its ultimate.`,
          )}
        </p>
      </header>
      <div className="move-cards">
        {MOVES.map((m) => (
          <MoveCard key={m.clip} move={m} lang={lang} />
        ))}
      </div>
    </section>
  );
}

/**
 * The page a signed-out visitor lands on: what the game is, in a few seconds, over the real home island; the
 * account form opens in a window from the calls to action.
 */
export function Landing({
  lang,
  island,
  returning,
  endRecovery,
  setLang,
}: {
  lang: number;
  setLang: (lang: number) => void;
  /** The still home island drawn behind the page. */
  island: ReactNode;
  /** Someone who already signed in on this device: the main button signs in. */
  returning: boolean;
  endRecovery: () => void;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [auth, setAuth] = useState<null | 'signin' | 'signup'>(null);
  const features: { species: Species; element: RealmId; stage: Stage; title: string; text: string }[] = [
    {
      species: 'trex',
      element: 'fire',
      stage: 'baby',
      title: tr('Eclozează și crește', 'Hatch & raise'),
      text: tr(
        'Un ou de foc devine pui, juvenil, apoi adult. Hrănește-l, antrenează-l, alege-i puterile.',
        'A fire egg becomes a baby, a juvenile, then an adult. Feed it, train it, shape its strengths.',
      ),
    },
    {
      species: familyOf('ice'),
      element: 'ice',
      stage: 'juvenile',
      title: tr('10 lumi elementale', '10 elemental worlds'),
      text: tr(
        'Foc, apă, gheață, fulger, întuneric, lumină… fiecare lume aduce familii noi de dinozauri.',
        'Fire, water, ice, lightning, dark, light… every world brings new dinosaur families.',
      ),
    },
    {
      species: 'boss',
      element: 'fire',
      stage: 'adult',
      title: tr('Expediții și boși', 'Expeditions & bosses'),
      text: tr(
        'Trimite echipe de până la 3 în expediții, urcă ligile arenei și învinge boșii elementali.',
        'Send teams of up to 3 on expeditions, climb the arena leagues and beat elemental bosses.',
      ),
    },
    {
      species: familyOf('lightning'),
      element: 'lightning',
      stage: 'adult',
      title: tr('Dueluri și ligi', 'Duels & leagues'),
      text: tr(
        'Provoacă-ți prietenii. Primii 3 din fiecare ligă câștigă diamante și ouă rare în fiecare săptămână.',
        'Challenge your friends. The top 3 of every league win diamonds and rare eggs each week.',
      ),
    },
  ];

  return (
    <main className="realms-app landing">
      <div className="landing-bg" aria-hidden="true">
        {island}
      </div>
      <nav className="landing-nav">
        <span className="landing-logo">
          DINO <b>REALMS</b>
          <small>BETA</small>
        </span>
        <span className="landing-nav-actions">
          <button
            className="landing-lang"
            onClick={() => setLang(lang ? 0 : 1)}
            aria-label={lang ? 'Schimbă în română' : 'Switch to English'}
          >
            {lang ? 'RO' : 'EN'}
          </button>
          <button className="landing-signin" onClick={() => setAuth('signin')}>
            {tr('Intră în cont', 'Sign in')}
          </button>
        </span>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-kicker">{tr('Joc gratuit · în browser', 'Free game · in your browser')}</span>
          <h1>
            {tr('Dintr-un ou,', 'From one egg')}
            <br />
            {tr('o ', 'to a ')}
            <em>{tr('legendă', 'legend')}</em>.
          </h1>
          <p>
            {tr(
              'Eclozează dinozauri, construiește-ți insula plutitoare și explorează zece lumi elementale. Câteva minute pe zi sunt de ajuns.',
              'Hatch dinosaurs, build your floating island and explore ten elemental worlds. A few minutes a day is all it takes.',
            )}
          </p>
          <div className="landing-ctas">
            <button className="landing-cta" onClick={() => setAuth(returning ? 'signin' : 'signup')}>
              {returning ? tr('Continuă jocul', 'Continue playing') : tr('Joacă gratuit', 'Play free')}
            </button>
            <button className="landing-ghost" onClick={() => setAuth(returning ? 'signup' : 'signin')}>
              {returning ? tr('Cont nou', 'New account') : tr('Am deja cont', 'I have an account')}
            </button>
          </div>
          <ul className="landing-facts">
            <li>{tr('Fără descărcare', 'No download')}</li>
            <li>{tr('Telefon și calculator', 'Phone & desktop')}</li>
            <li>{tr('Progres salvat în cloud', 'Progress saved in the cloud')}</li>
          </ul>
        </div>
        <Showcase lang={lang} />
      </section>

      <Moves lang={lang} />

      <section className="landing-moves-section" aria-labelledby="features-title">
        <header>
          <span className="landing-kicker">{tr('În joc', 'In the game')}</span>
          <h2 id="features-title">{tr('Ce te așteaptă', 'What awaits you')}</h2>
          <p>
            {tr(
              'De la primul ou până la boss-ul ultimei lumi, câteva minute pe zi.',
              "From your first egg to the last world's boss, a few minutes a day.",
            )}
          </p>
        </header>
        <div className="move-cards">
          {features.map((f) => (
            <article
              key={f.title}
              className={`move-card feature-card stage-${f.stage}`}
              style={{ '--el': ELEMENTS.find((e) => e.id === f.element)!.color } as React.CSSProperties}
            >
              <span className="move-card-stage" aria-hidden="true">
                <span className="move-card-dino">
                  <DinosaurArt species={f.species} element={f.element} stage={f.stage} />
                </span>
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <button className="landing-cta" onClick={() => setAuth(returning ? 'signin' : 'signup')}>
          {tr('Eclozează primul dinozaur', 'Hatch your first dino')}
        </button>
        <small>
          {tr(
            'Beta: echilibrul și premiile se pot schimba. Spune-ne ce crezi!',
            'Beta: balance and rewards may still change. Tell us what you think!',
          )}
        </small>
      </footer>

      {auth && (
        <Window
          title={
            auth === 'signup' ? tr('Creează-ți contul', 'Create your account') : tr('Bine ai revenit', 'Welcome back')
          }
          eyebrow="DINO REALMS"
          close={() => setAuth(null)}
        >
          <AccountPanel
            key={auth}
            lang={lang}
            intro={false}
            startWith={auth}
            sync={{ user: null, status: 'signedOut', recovering: false, endRecovery }}
          />
        </Window>
      )}
    </main>
  );
}
