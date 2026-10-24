import { useEffect, useRef, useState, type ReactNode } from 'react';
import World from './World';
import { RealmsWiki } from './RealmsWiki';
import { worldThumb } from './worldArt';
import { Hero } from './Hero';
import { DinosaurCollection } from './DinosaurCollection';
import { DinosaurArt } from './DinosaurArt';
import { AnimationViewer } from './AnimationViewer';
import { SPECIES_NAMES, type Species } from './dinosaurs';
import { BuildingSprite } from './BuildingSprite';
import { GameplayScreen, BattleScreen, type GameplayView } from './GameplayScreens';
import { ITEMS, UTILITY_BUILDINGS, RECIPES, type ItemId, type UtilityKind } from './content';
import { FarmPanel } from './FarmPanel';
import { DailyPanel } from './DailyPanel';
import { dailyState, dailyQuests, DAILY_QUESTS } from './daily';
import { DevPanel, DinoPanel, EggArt, HabitatsPanel, HatcheryPanel, MarketPanel } from './DinoPanels';
import {
  advance,
  champion,
  command,
  ELEMENTS,
  HABITAT_LEVELS,
  habitatCapacity,
  farmReadyFood,
  incubating,
  storyChapter,
  hatcheryStoryEggs,
  storyEgg,
  REALM_NAMES,
  newSave,
  parseSave,
  SAVE_KEY,
  WORLD_UNLOCK,
  type Command,
  type Save,
  type RealmId,
} from './game';
import './realms.css';
import './pixel-theme.css';
import { Icon, type IconName } from './ui/Icon';
import { playSound, setSoundEnabled, soundEnabled, type SoundId } from './sound';

/** The sound a successful command makes. Battle actions are voiced by the battle replay instead. */
const COMMAND_SOUNDS: Partial<Record<Command['type'], SoundId>> = {
  collect: 'coin',
  collectAvailable: 'coin',
  claim: 'coin',
  harvest: 'coin',
  claimCraft: 'coin',
  claimExpedition: 'coin',
  claimDailyQuest: 'coin',
  claimDailyBonus: 'coin',
  claimQuestEgg: 'coin',
  sellEgg: 'coin',
  hatch: 'hatch',
  evolve: 'evolve',
  useCrystal: 'evolve',
  build: 'build',
  placeLamp: 'build',
  unlockHabitat: 'build',
  upgradeHabitat: 'build',
  upgradeFarm: 'build',
  upgradeHatchery: 'build',
  upgradeWorkshop: 'build',
  upgradeArena: 'build',
  spinDaily: 'spin',
  incubate: 'pop',
  feed: 'pop',
  buyEgg: 'pop',
  plant: 'pop',
  craft: 'pop',
  move: 'pop',
};

type Panel =
  | 'daily'
  | 'dino'
  | 'hatchery'
  | 'habitat'
  | 'farm'
  | 'build'
  | 'collection'
  | 'realms'
  | 'expedition'
  | 'settings'
  | 'assets'
  | 'workshop'
  | 'arena'
  | 'market'
  | 'wiki'
  | null;
const text = (lang: number, ro: string, en: string) => (lang ? en : ro);
function load(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        if (JSON.parse(raw).schemaVersion < 3) localStorage.setItem(`${SAVE_KEY}-before-worlds`, raw);
        return advance(parseSave(raw), Date.now());
      } catch {
        localStorage.setItem(`${SAVE_KEY}-recovery-${Date.now()}`, raw);
      }
    }
  } catch {
    /* Storage may be disabled; gameplay still works. */
  }
  return newSave(Date.now());
}
function Window({
  title,
  eyebrow,
  children,
  close,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => before?.focus();
  }, []);
  return (
    <div
      className="realm-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`realm-window ${wide ? 'wide' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Tab') {
            const nodes = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), a[href], input, select, [tabindex="0"]',
              ) ?? [],
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          {eyebrow && <span className="realm-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
          <button className="realm-close" onClick={close} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="realm-window-body">{children}</div>
      </div>
    </div>
  );
}

export default function RealmsApp() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [save, setSave] = useState(load),
    [now, setNow] = useState(Date.now()),
    [panel, setPanel] = useState<Panel>(() => save.battle?.encounterId.startsWith('arena') ? 'arena' : null);
  const [realm, setRealm] = useState<'home' | RealmId>(() => {
    try {
      const last = localStorage.getItem('dino-realms-current-world');
      return ELEMENTS.some((el) => el.id === last) ? (last as RealmId) : 'home';
    } catch {
      return 'home';
    }
  });
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('dino-realms-language') === 'en' ? 1 : 0;
    } catch {
      return 0;
    }
  });
  const [sound, setSound] = useState(soundEnabled);
  // Every button answers with a soft click; actions add their own sound on top (see COMMAND_SOUNDS).
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.('button');
      if (button && !button.disabled) playSound('click');
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);
  const [placing, setPlacing] = useState(false),
    [moving, setMoving] = useState<string | null>(null),
    [message, setMessage] = useState('');
  const [expeditionPreparation, setExpeditionPreparation] = useState(false);
  const [workshopRecipe, setWorkshopRecipe] = useState('planks');
  // The bottom bar can fold down to just the Collect button; phones start folded, where it covers more island.
  const [navOpen, setNavOpen] = useState(() => {
    if (window.matchMedia('(max-width: 760px), (max-height: 500px) and (orientation: landscape)').matches) return false;
    try {
      const saved = localStorage.getItem('dino-realms-nav');
      if (saved) return saved === 'open';
    } catch {
      /* Optional preference. */
    }
    return window.innerWidth > 760;
  });
  const toggleNav = () =>
    setNavOpen((open) => {
      try {
        localStorage.setItem('dino-realms-nav', open ? 'closed' : 'open');
      } catch {
        /* Optional preference. */
      }
      return !open;
    });
  // The story card folds to its header, remembered like the bottom bar; phones start folded.
  const [storyOpen, setStoryOpen] = useState(() => {
    if (window.matchMedia('(max-width: 760px), (max-height: 500px) and (orientation: landscape)').matches) return false;
    try {
      const saved = localStorage.getItem('dino-realms-story');
      if (saved) return saved === 'open';
    } catch {
      /* Optional preference. */
    }
    return window.innerWidth > 760;
  });
  const toggleStory = () =>
    setStoryOpen((open) => {
      try {
        localStorage.setItem('dino-realms-story', open ? 'closed' : 'open');
      } catch {
        /* Optional preference. */
      }
      return !open;
    });
  // The boot screen from index.html stays until the first view's artwork has loaded, showing its progress.
  const bootProgress = (done: number, total: number) => {
    const loader = document.getElementById('boot-loader');
    if (!loader) return;
    const percent = total ? Math.round((done / total) * 100) : 100;
    const bar = loader.querySelector<HTMLElement>('.bar'),
      label = loader.querySelector('small');
    if (bar) bar.style.background = `linear-gradient(90deg, #d6b970 ${percent}%, #142219 ${percent}%)`;
    if (label) label.textContent = `${percent}%`;
    if (done >= total) loader.remove();
  };
  // Never leave the player behind the boot screen if an image hangs.
  useEffect(() => {
    const id = window.setTimeout(() => document.getElementById('boot-loader')?.remove(), 20_000);
    return () => window.clearTimeout(id);
  }, []);
  const [selectedDino, setSelectedDino] = useState<string | null>(null),
    [devOpen, setDevOpen] = useState(false);
  /** When the dinosaur window was opened from a world, the habitat it shows; null shows every dinosaur. */
  const [dinoRealm, setDinoRealm] = useState<RealmId | null>(null);
  const [dinoFromHatchery, setDinoFromHatchery] = useState(false);
  // The habitat filter belongs to one opening of the window: closing it, or opening anything else, clears it.
  useEffect(() => {
    if (panel !== 'dino') {
      setDinoRealm(null);
      setDinoFromHatchery(false);
    }
  }, [panel]);
  const [storageError, setStorageError] = useState(false);
  const [placementKind, setPlacementKind] = useState<UtilityKind>('farm');
  const [offline, setOffline] = useState(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const old = parseSave(raw),
        current = advance(old, Date.now());
      const elapsed = Date.now() - old.updatedAt;
      return elapsed >= 60_000
        ? {
            elapsed,
            gold: Math.floor(current.storedGold),
            food: farmReadyFood(old, Date.now()),
            jobs: old.crafting.filter((j) => j.endsAt <= Date.now()).length,
          }
        : null;
    } catch {
      return null;
    }
  });
  const gameplayView: GameplayView | null =
    panel === 'expedition' || panel === 'arena' || panel === 'workshop' ? panel : null;
  const saveRef = useRef(save);
  saveRef.current = save;
  const tr = (ro: string, en: string) => text(lang, ro, en);
  const today = dailyState(save, now);
  const dailyReady = today.spin === null || dailyQuests(today.day).some(id => !today.claimed.includes(id) && today.progress[id] >= DAILY_QUESTS[id].target) || (!today.bonus && dailyQuests(today.day).every(id => today.claimed.includes(id)));
  const dailyOpened = useRef<string | null>(null);
  useEffect(() => {
    if (panel || placing || save.battle || dailyOpened.current === today.day) return;
    try {
      if (localStorage.getItem('dino-realms-daily-opened') === today.day) return;
      localStorage.setItem('dino-realms-daily-opened', today.day);
    } catch {
      // The in-memory marker also works when storage is unavailable.
    }
    dailyOpened.current = today.day;
    setPanel('daily');
  }, [today.day, panel, placing, save.battle]);
  const activeElement = ELEMENTS.find((el) => el.id === realm);
  /** Locked worlds open the world list instead, where they can be unlocked. */
  const visitRealm = (next: 'home' | RealmId) => {
    if (next !== 'home' && !saveRef.current.habitats[next]) {
      setMessage(
        text(
          lang,
          'Lumea e blocată. Deblocheaz-o cu aur și materiale.',
          'This world is locked. Unlock it with gold and materials.',
        ),
      );
      setPanel('realms');
      return;
    }
    setRealm(next);
    setPanel(null);
    setPlacing(false);
    setMoving(null);
  };
  useEffect(() => {
    if (realm !== 'home' && !save.habitats[realm]) setRealm('home');
  }, [realm, save.habitats]);
  useEffect(() => {
    try {
      localStorage.setItem('dino-realms-current-world', realm);
    } catch {
      /* Optional camera location. */
    }
  }, [realm]);
  useEffect(() => {
    let hiddenAt = document.hidden ? Date.now() : null;
    const id = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 1000);
    const wake = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      const returnedAt = Date.now();
      if (hiddenAt !== null && returnedAt - hiddenAt >= 60_000) {
        const current = advance(saveRef.current, returnedAt);
        setOffline({
          elapsed: returnedAt - hiddenAt,
          gold: Math.floor(current.storedGold),
          food: farmReadyFood(current, returnedAt),
          jobs: current.crafting.filter(j => j.endsAt <= returnedAt).length,
        });
      }
      hiddenAt = null;
      setNow(returnedAt);
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [save]);
  useEffect(() => {
    document.title = 'Dino Realms · Collect. Build. Belong.';
    document.documentElement.lang = lang ? 'en' : 'ro';
    try {
      localStorage.setItem('dino-realms-language', lang ? 'en' : 'ro');
    } catch {
      /* optional preference */
    }
  }, [lang]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(id);
  }, [message]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanel(null);
        setPlacing(false);
        setMoving(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const run = (c: Command) => {
    try {
      const next = command(saveRef.current, c, Date.now());
      saveRef.current = next;
      setSave(next);
      const sound = COMMAND_SOUNDS[c.type];
      if (sound) playSound(sound);
      return true;
    } catch (e) {
      const code = (e as Error).message;
      if (c.type !== 'action') playSound('error');
      setMessage(
        (
          {
            materials: tr('Materiale insuficiente.', 'Not enough materials.'),
            queue: tr('Coada atelierului este plină.', 'The workshop queue is full.'),
            food: tr('Hrană insuficientă. Cultivă la fermă.', 'Not enough food. Grow more at your farm.'),
            placement: tr('Alege o zonă liberă de 3 × 3.', 'Choose an empty 3 × 3 area.'),
            juvenile: tr('Evoluează-l pe Ignis la juvenil pentru luptă.', 'Evolve Ignis to juvenile to enter battle.'),
            empty: tr('Aurul se acumulează în habitat.', 'Gold is accumulating in the habitat.'),
            gold: tr('Aur insuficient.', 'Not enough gold.'),
            plots: tr('Toate straturile sunt ocupate.', 'All plots are busy.'),
            timer: tr('Încă nu e gata.', 'Not ready yet.'),
            locked: tr('Încă nu e deblocat.', 'Not unlocked yet.'),
            maxLevel: tr('Clădirea e la nivelul maxim.', 'The building is at max level.'),
            gate: tr('Îmbunătățește Poarta arenei la nivelul 2.', 'Upgrade the Arena Gate to level 2.'),
            away: tr('Campionul e plecat în expediție.', 'Your champion is away on an expedition.'),
            stars: tr('Ai nevoie de 2★ la treapta precedentă.', 'You need 2★ on the previous tier.'),
            tired: tr('Campionul se odihnește după înfrângere. Alege alt dinozaur sau așteaptă.', 'Your champion is resting after the defeat. Pick another dinosaur or wait.'),
            busy: tr('Un dinozaur e deja plecat în expediție.', 'A dinosaur is already away on an expedition.'),
            expedition: tr('Expediția nu s-a terminat încă.', 'The expedition is not over yet.'),
            dailyClaimed: tr('Premiul a fost deja colectat azi.', 'This reward was already claimed today.'),
            dailyIncomplete: tr('Termină misiunea înainte de colectare.', 'Finish the mission before claiming.'),
            provisions: tr('Pregătește provizii în Atelier înainte de plecare.', 'Prepare supplies in the Workshop before departing.'),
            level: tr('Crește campionul până la nivelul cerut pentru această etapă.', 'Raise your champion to the level required for this stage.'),
            timedExpedition: tr('Pornește această călătorie din Expediții.', 'Start this trip from Expeditions.'),
            fightEgg: tr(
              'Ouăle acestui element se câștigă în lupte, nu din Piață.',
              "This element's eggs are won in fights, not bought.",
            ),
            workshop: tr('Construiește mai întâi atelierul.', 'Build the workshop first.'),
          } as Record<string, string>
        )[code] ?? tr('Acțiunea nu este disponibilă acum.', 'That action is not available yet.'),
      );
      return false;
    }
  };
  const d = champion(save),
    live = advance(save, now),
    hatching = incubating(save),
    storyEggs = hatcheryStoryEggs(save);
  const quest =
    !save.dinos.length && !hatching.length
      ? 0
      : !save.dinos.length
        ? 1
        : d?.stage === 'baby'
          ? 2
          : !save.rewardedTutorial
            ? 3
            : !save.buildings.some((b) => b.kind === 'farm')
              ? 4
              : !save.dinos.some((x) => x.stage === 'adult')
                ? 5
                : 6;
  // Step 6 means chapter I is finished; the card then follows the next chapters, one goal at a time.
  const chapterDone = quest === 6;
  const current = storyChapter(save),
    steps = current?.chapter.steps ?? [],
    story = current?.step,
    storyIndex = current?.index ?? 0,
    storyReady = !!story && story.done(save);
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  // The header badge follows the chapter: its numeral, rank, title and how far into it the player is.
  const badge = !chapterDone
    ? {
        numeral: 'I',
        rank: tr('Explorator', 'Explorer'),
        title: tr('Început de legendă', 'A legend begins'),
        progress: quest / 5,
      }
    : current
      ? {
          numeral: ROMAN[current.chapter.number],
          rank: current.chapter.rank[lang],
          title: current.chapter.title[lang],
          progress: storyIndex / steps.length,
        }
      : { numeral: '★', rank: tr('Legendă', 'Legend'), title: tr('Toate tărâmurile', 'All the realms'), progress: 1 };
  const quests = [
    tr('Un început înflăcărat', 'A fiery beginning'),
    tr('Viață într-un ou', 'Life inside an egg'),
    tr('Un erou în devenire', 'A hero in the making'),
    tr('Prima aventură', 'The first adventure'),
    tr('Rădăcini pentru viitor', 'Room to grow'),
    tr('Micul tău tărâm', 'Your little realm'),
    tr('Capitol încheiat!', 'Chapter complete!'),
  ];
  const questDetails = [
    tr(
      'Pune oul de foc în incubator. Aventura lui Ignis începe aici.',
      'Place the fire egg in the hatchery. Ignis’s adventure starts here.',
    ),
    tr(
      'Așteaptă eclozarea, apoi întâmpină primul tău T-Rex.',
      'Wait for the egg to hatch, then welcome your first T-Rex.',
    ),
    tr(
      'Hrănește-l până la nivelul 9, apoi evoluează-l în juvenil.',
      'Feed Ignis to level 9, then evolve him into a juvenile.',
    ),
    tr('Trimite-l în prima expediție, în tărâmul focului.', 'Send him on his first expedition, into the fire realm.'),
    tr('Construiește o fermă pentru o sursă constantă de hrană.', 'Build a farm for a steady supply of food.'),
    tr(
      'Cultivă, strânge aur și crește-l pe Ignis până la adult.',
      'Grow food, collect gold, and raise Ignis to adulthood.',
    ),
    tr(
      'Ai un dinozaur adult. Acum urcă prin ligile arenei, câștigă ouă rare și deblochează lumi noi.',
      'You raised an adult dinosaur. Now climb the arena leagues, win rare eggs and unlock new worlds.',
    ),
  ];
  const openBuilding = (id: string) => {
    if (id === 'collection') return setPanel('collection');
    if (id === 'income') return setPanel('habitat');
    if (id === 'dino') {
      setDinoRealm(null);
      return setPanel('dino');
    }
    // A click on a world opens its habitat: the residents, with the one clicked selected.
    if (id === 'habitat' || id.startsWith('dino:')) {
      setDinoRealm(realm === 'home' ? null : realm);
      if (id.startsWith('dino:')) setSelectedDino(id.slice(5));
      return setPanel('dino');
    }
    const b = save.buildings.find((b) => b.id === id);
    if (b) setPanel(b.kind === 'portal' ? 'expedition' : b.kind);
  };
  const startPlacement = (id: string | null = null, kind: UtilityKind = 'farm') => {
    setPlacementKind(kind);
    setRealm('home');
    setPanel(null);
    setMoving(id);
    setPlacing(true);
  };
  // Tell the player once when a dinosaur is back from its expedition, wherever they are in the game.
  const announcedTrip = useRef<number | null>(null);
  useEffect(() => {
    const trip = save.expedition;
    if (!trip || now < trip.endsAt || announcedTrip.current === trip.startedAt) return;
    announcedTrip.current = trip.startedAt;
    const who = save.dinos.find((x) => x.id === trip.dinoId)?.nickname ?? '';
    setMessage(tr(`${who} s-a întors din expediție! Colectează recompensa.`, `${who} is back from the expedition! Collect the reward.`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, save.expedition]);
  const exportSave = () => {
    const blob = new Blob([JSON.stringify(advance(saveRef.current, Date.now()), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'dino-realms-save.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="realms-app">
      <World
        save={save}
        realm={realm}
        lang={lang}
        placing={placing}
        moving={moving}
        placementKind={placementKind}
        now={now}
        covered={!!panel}
        onPlace={(x, y) => {
          if (run(moving ? { type: 'move', id: moving, x, y } : { type: 'build', x, y, kind: placementKind })) {
            setPlacing(false);
            setMoving(null);
            setMessage(tr('Clădire amplasată!', 'Building placed!'));
          }
        }}
        onMove={(id, x, y) => {
          if (run({ type: 'move', id, x, y })) setMessage(tr('Clădire mutată!', 'Building moved!'));
        }}
        onSelect={openBuilding}
        onProgress={bootProgress}
        cameraAction={!panel && !placing && !save.battle && (
          <button className="realm-daily-access" onClick={() => setPanel('daily')} aria-label={tr('Premii și misiuni zilnice', 'Daily rewards and missions')} title={tr('Zilnic', 'Daily')}>
            <span className="realm-daily-wheel" aria-hidden="true"><span>★</span></span>
            {dailyReady && <b aria-hidden="true">!</b>}
          </button>
        )}
      />
      <div className="realm-mobile-profile">
        <button
          className="realm-avatar"
          aria-label={tr('Resurse', 'Resources')}
          aria-expanded={profileOpen}
          aria-controls="realm-mobile-stats"
          onClick={() => setProfileOpen((open) => !open)}
        >
          <Hero stage={d?.stage ?? 'baby'} />
          <span>{d?.level ?? 1}</span>
        </button>
        {profileOpen && (
          <>
            <button className="realm-profile-dismiss" aria-label="Close resources" onClick={() => setProfileOpen(false)} />
            <section className="realm-profile-card" id="realm-mobile-stats" aria-label={tr('Resurse', 'Resources')} onKeyDown={(event) => { if (event.key === 'Escape') setProfileOpen(false); }}>
              <header><strong>{badge.title}</strong><button aria-label="Close resources" onClick={() => setProfileOpen(false)}>×</button></header>
              <div className="realm-profile-stats">
                <Resource icon="gold" value={Math.floor(save.gold)} label={tr('Aur', 'Gold')} color="gold" />
                <Resource icon="food" value={save.food} label={tr('Hrană', 'Food')} color="food" />
                <Resource icon="star" value={d?.level ?? 1} label={tr('Nivel', 'Level')} color="gold" />
              </div>
              <footer>
                <button onClick={() => { setProfileOpen(false); setDinoRealm(null); setPanel('dino'); }}>{tr('Dinozauri', 'Dinosaurs')}</button>
                <button onClick={() => { setProfileOpen(false); setPanel('settings'); }}>{tr('Setări', 'Settings')}</button>
                <button onClick={() => { setProfileOpen(false); setPanel('wiki'); }}>Wikipedia</button>
              </footer>
            </section>
          </>
        )}
      </div>
      <header className="realm-hud">
        <a
          className="realm-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPanel(null);
          }}
        >
          <span className="realm-brand-mark"><Icon name="egg" scale={3} /></span>
          <span>
            DINO <b>REALMS</b>
            <small>COLLECT · BUILD · BELONG</small>
          </span>
        </a>
        <div className="realm-resources">
          <Resource icon="gold" value={Math.floor(save.gold)} label={tr('Aur', 'Gold')} color="gold" />
          <Resource icon="food" value={save.food} label={tr('Hrană', 'Food')} color="food" />
          <div className="realm-account">
            <span>{badge.numeral}</span>
            <div>
              <small>{badge.rank}</small>
              <strong>{badge.title}</strong>
              <i>
                <b style={{ width: `${Math.min(100, badge.progress * 100)}%` }} />
              </i>
            </div>
          </div>
        </div>
        <button
          className="realm-square realm-info"
          onClick={() => setDevOpen((v) => !v)}
          aria-label={tr('Unelte de test', 'Test tools')}
          aria-expanded={devOpen}
        >
          <Icon name="clock" />
        </button>
        <button className="realm-square" onClick={() => setPanel('wiki')} aria-label="Wikipedia" title="Wikipedia">
          <Icon name="wiki" />
        </button>
        <button className="realm-square" onClick={() => setPanel('settings')} aria-label={tr('Setări', 'Settings')}>
          <Icon name="settings" />
        </button>
      </header>
      {devOpen && (
        <DevPanel
          lang={lang}
          run={(c) => {
            const ok = run(c);
            if (ok)
              setMessage(
                c.type === 'devSkip'
                  ? tr('Toți timpii au fost săriți.', 'All timers skipped.')
                  : tr('Resurse adăugate.', 'Resources added.'),
              );
            return ok;
          }}
          close={() => setDevOpen(false)}
        />
      )}
      <aside className="realm-location">
        <span className="realm-eyebrow">
          {realm === 'home'
            ? tr('INSULA PRINCIPALĂ', 'MAIN ISLAND')
            : `${activeElement?.symbol} ${activeElement?.name[lang]} · ${tr('LUME-HABITAT', 'HABITAT WORLD')}`}
        </span>
        <h1>{realm === 'home' ? tr('Insula începuturilor', 'The First Haven') : REALM_NAMES[realm][lang]}</h1>
        <p>
          {realm === 'home'
            ? tr(
                'Clădiri și producție. Eroii locuiesc în lumile lor.',
                'Buildings and production. Heroes live in their own worlds.',
              )
            : activeElement?.role[lang]}
        </p>
        {realm !== 'home' && (
          <button className="realm-return" onClick={() => visitRealm('home')}>
            ← {tr('Insula principală', 'Main island')}
          </button>
        )}
      </aside>
      <aside className={`realm-quest${storyOpen ? '' : ' collapsed'}`}>
        <button
          className="realm-quest-top"
          onClick={toggleStory}
          aria-expanded={storyOpen}
          aria-label={storyOpen ? tr('Restrânge povestea', 'Collapse the story') : tr('Arată povestea', 'Show the story')}
          title={storyOpen ? tr('Restrânge povestea', 'Collapse the story') : tr('Arată povestea', 'Show the story')}
        >
          <span>✦</span>
          <span className="realm-quest-label">{tr('POVESTEA TA', 'YOUR STORY')}</span>
          {!storyOpen && (storyReady || storyEggs.length > 0) && (
            <b className="realm-quest-alert" aria-label={tr('Recompensă disponibilă', 'Reward ready')}>
              !
            </b>
          )}
          <small>
            {!chapterDone ? `${Math.min(quest + 1, 5)} / 5` : story ? `${storyIndex + 1} / ${steps.length}` : '✓'}
          </small>
          <i className="realm-quest-chevron" aria-hidden />
        </button>
        {chapterDone ? (
          <div className="realm-quest-body">
            <span className="realm-eyebrow">
              {current
                ? `${tr('CAPITOLUL', 'CHAPTER')} ${badge.numeral} · ${current.chapter.title[lang].toUpperCase()}`
                : tr('TOATE CAPITOLELE', 'ALL CHAPTERS')}
            </span>
            {story ? (
              <>
                <h2>{story.task[lang]}</h2>
                <p className="realm-quest-reward">
                  {storyEgg(story) && <EggArt species={story.species} realm={story.element} size={30} />}
                  <span>
                    {tr('Recompensă', 'Reward')}: <b>+{story.gold ?? 0} ●</b> · <b>+{story.food ?? 0} ❧</b>
                    {storyEgg(story) && (
                      <em>
                        + <Icon name="egg" scale={1} /> {SPECIES_NAMES[story.species]} · {ELEMENTS.find((e) => e.id === story.element)!.name[lang]}{' '}
                        ({tr('final de capitol', 'chapter finale')})
                      </em>
                    )}
                    {story.progress && !storyReady && (
                      <small>
                        {tr('Progres', 'Progress')}: {Math.min(...story.progress(save))} / {story.progress(save)[1]}
                      </small>
                    )}
                  </span>
                </p>
                <div className="realm-quest-progress">
                  {steps.map((q, i) => (
                    <i key={q.id} className={i < storyIndex ? 'done' : i === storyIndex ? 'current' : ''} />
                  ))}
                </div>
                {storyReady ? (
                  <button className="realm-button" onClick={() => run({ type: 'claimQuestEgg', questId: story.id })}>
                    {storyEgg(story) ? <Icon name="egg" scale={1} /> : <Icon name="star" scale={1} />}{' '}
                    {tr('Primește recompensa', 'Claim reward')} <span>→</span>
                  </button>
                ) : (
                  <button className="realm-button" onClick={() => setPanel(story.panel ?? 'arena')}>
                    {tr('Continuă povestea', 'Continue the story')} <span>→</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <h2>{tr('Povestea e completă!', 'Story complete!')}</h2>
                <p>
                  {tr(
                    'Ai terminat toate poveștile. Ouăle rare se câștigă în continuare în arenă și în expediții.',
                    'You finished every story. Rare eggs keep dropping in the arena and on expeditions.',
                  )}
                </p>
                <button className="realm-button" onClick={() => setPanel('arena')}>
                  {tr('Spre arenă', 'To the arena')} <span>→</span>
                </button>
              </>
            )}
            {storyEggs.some((q) => q.id !== story?.id) && (
              <button className="realm-button secondary realm-story-egg" onClick={() => setPanel('hatchery')}>
                <Icon name="egg" scale={1} /> {tr('Ou nou din poveste!', 'New story egg!')} ({storyEggs.filter((q) => q.id !== story?.id).length}){' '}
                <span>→</span>
              </button>
            )}
          </div>
        ) : (
          <div className="realm-quest-body">
            <span className="realm-eyebrow">{tr('CAPITOLUL I · PRIMA SCÂNTEIE', 'CHAPTER I · THE FIRST SPARK')}</span>
            <h2>{quests[quest]}</h2>
            <p>{questDetails[quest]}</p>
            <div className="realm-quest-progress">
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} className={i < quest ? 'done' : i === quest ? 'current' : ''} />
              ))}
            </div>
            <button
              className="realm-button"
              onClick={() =>
                setPanel(
                  quest < 2
                    ? 'hatchery'
                    : quest === 2
                      ? 'dino'
                      : quest === 3
                        ? 'expedition'
                        : quest === 4
                          ? 'build'
                          : quest === 5
                            ? 'farm'
                            : 'arena',
                )
              }
            >
              {chapterDone ? tr('Spre arenă', 'To the arena') : tr('Continuă povestea', 'Continue the story')}{' '}
              <span>→</span>
            </button>
            {storyEggs.length > 0 && (
              <button className="realm-button secondary realm-story-egg" onClick={() => setPanel('hatchery')}>
                <Icon name="egg" scale={1} /> {tr('Ou nou din poveste!', 'New story egg!')} ({storyEggs.length}) <span>→</span>
              </button>
            )}
          </div>
        )}
      </aside>
      {placing ? (
        <div className="realm-placement">
          <div>
            <strong>
              {moving
                ? tr('Mută clădirea', 'Move building')
                : `${tr('Amplasează', 'Place')}: ${UTILITY_BUILDINGS[placementKind].name[lang]}`}
            </strong>
            <small>
              {tr(
                'Alege o zonă liberă · verde = valid · roșu = ocupat',
                'Choose open ground · green = valid · red = occupied',
              )}
            </small>
          </div>
          <button
            className="realm-button secondary"
            onClick={() => {
              setPlacing(false);
              setMoving(null);
            }}
          >
            {tr('Anulează', 'Cancel')}
          </button>
        </div>
      ) : (
        <nav className={`realm-nav ${navOpen ? '' : 'collapsed'}`} aria-label={tr('Meniu principal', 'Main menu')}>
          <button
            className="realm-nav-toggle"
            onClick={toggleNav}
            aria-expanded={navOpen}
            aria-label={navOpen ? tr('Restrânge meniul', 'Collapse menu') : tr('Extinde meniul', 'Expand menu')}
            title={navOpen ? tr('Restrânge meniul', 'Collapse menu') : tr('Extinde meniul', 'Expand menu')}
          >
            <span className="realm-nav-chevron" aria-hidden />
            <span className="realm-nav-toggle-label">{tr('Meniu', 'Menu')}</span>
          </button>
          <Nav icon="build" label={tr('Construiește', 'Build')} onClick={() => setPanel('build')} />
          <Nav icon="dino" label={tr('Dinozauri', 'Dinosaurs')} onClick={() => { setDinoRealm(null); setPanel('dino'); }} />
          <Nav icon="collection" label={tr('Colecție', 'Collection')} onClick={() => setPanel('collection')} />
          <Nav icon="realms" label={tr('Tărâmuri', 'Realms')} onClick={() => setPanel('realms')} />
          <Nav
            icon="expedition"
            label={
              save.expedition
                ? now >= save.expedition.endsAt
                  ? tr('Expediție gata ✓', 'Expedition back ✓')
                  : tr('În expediție…', 'On expedition…')
                : tr('Expediții', 'Expeditions')
            }
            onClick={() => setPanel('expedition')}
            featured
          />
          <Nav icon="arena" label={tr('Arena PvE', 'PvE Arena')} onClick={() => setPanel('arena')} />
          <Nav icon="workshop" label={tr('Atelier', 'Workshop')} onClick={() => setPanel('workshop')} />
          <button
            className={`realm-collect${Math.floor(live.storedGold) > 0 ? '' : ' empty'}`}
            aria-label={tr('Colectează', 'Collect')}
            title={tr('Colectează', 'Collect')}
            onClick={() => {
              if (run({ type: 'collectAvailable' })) setMessage(tr('Resurse colectate!', 'Resources collected!'));
            }}
          >
            <span aria-hidden="true">
              <Icon name="gold" />
            </span>
            <div>
              <strong>{tr('Colectează', 'Collect')}</strong>
              <small>
                {Math.floor(live.storedGold) > 0
                  ? `${Math.floor(live.storedGold)} ${tr('aur disponibil', 'gold available')}`
                  : tr('Nimic încă', 'Nothing yet')}
              </small>
            </div>
          </button>
        </nav>
      )}
      {storageError && (
        <div className="realm-storage" role="alert">
          {tr(
            'Salvarea locală nu este disponibilă. Exportă progresul din Setări.',
            'Local saving unavailable. Export your progress in Settings.',
          )}
        </div>
      )}
      {message && (
        <div className="realm-toast" role="status">
          {message}
        </div>
      )}

      {panel && !gameplayView && (
        <Window
          title={
            {
              dino: dinoRealm ? `${tr('Habitat', 'Habitat')} · ${REALM_NAMES[dinoRealm][lang]}` : tr('Dinozaurii tăi', 'Your dinosaurs'),
              hatchery: tr('Incubatorul', 'The hatchery'),
              habitat: tr('Habitate', 'Habitats'),
              daily: tr('Premii și misiuni zilnice', 'Daily rewards and missions'),
              market: tr('Piața', 'The market'),
              wiki: 'Wikipedia · Dino Realms',
              farm: tr('Ferma', 'The farm'),
              build: tr('Fă loc poveștii tale', 'Make room for your story'),
              collection: tr('Cartea eroilor', 'The hero collection'),
              realms: tr('Dincolo de orizont', 'Beyond the horizon'),
              expedition: tr('Prima aventură', 'The first adventure'),
              settings: tr('Setări', 'Settings'),
              assets: tr('Atelierul vizual', 'The visual workshop'),
              workshop: tr('Atelier', 'Workshop'),
              arena: tr('Arena PvE', 'PvE Arena'),
            }[panel]
          }
          eyebrow="DINO REALMS"
          close={() => setPanel(null)}
          wide={['daily', 'collection', 'realms', 'assets', 'build', 'dino', 'hatchery', 'market', 'habitat', 'wiki'].includes(
            panel,
          )}
        >
          {expeditionPreparation && (
            <button className="realm-button secondary realm-back-to-hatchery" onClick={() => { setExpeditionPreparation(false); setPanel('expedition'); }}>
              ← {tr('Înapoi la expediție', 'Back to expedition')}
            </button>
          )}
          {panel === 'daily' && <DailyPanel save={save} now={now} lang={lang} run={run} navigate={setPanel} />}
          {panel === 'hatchery' && (
            <HatcheryPanel
              save={save}
              now={now}
              lang={lang}
              run={run}
              move={() => startPlacement('nest', 'hatchery')}
              openMarket={() => setPanel('market')}
              onHatched={() => {
                const born = saveRef.current.dinos.at(-1)!;
                setMessage(`${tr('Bun venit', 'Welcome')}, ${born.nickname}!`);
                setRealm(born.element);
                setSelectedDino(born.id);
                setDinoRealm(born.element);
                setDinoFromHatchery(true);
                setPanel('dino');
              }}
            />
          )}
          {panel === 'market' && (
            <MarketPanel
              save={save}
              lang={lang}
              run={(c) => {
                const ok = run(c);
                if (ok)
                  setMessage(tr('Ou cumpărat! Incubează-l în incubator.', 'Egg bought! Incubate it in the hatchery.'));
                return ok;
              }}
              build={() => setPanel('build')}
              openHabitats={() => setPanel('habitat')}
            />
          )}
          {panel === 'dino' && (
            <DinoPanel
              save={save}
              lang={lang}
              run={run}
              selected={selectedDino}
              select={setSelectedDino}
              openHatchery={() => setPanel('hatchery')}
              realm={dinoRealm}
              openHabitats={() => setPanel('habitat')}
              fromHatchery={dinoFromHatchery}
            />
          )}
          {panel === 'habitat' && (
            <HabitatsPanel
              save={live}
              lang={lang}
              run={run}
              visit={visitRealm}
              openWorkshop={() => setPanel('workshop')}
            />
          )}
          {panel === 'farm' && (
            <FarmPanel
              save={save}
              now={now}
              lang={lang}
              run={run}
              build={() => setPanel('build')}
              move={() => startPlacement('farm')}
            />
          )}
          {panel === 'build' && (
            <>
              <p className="realm-intro">
                {tr(
                  'Clădiri utilitare pentru insula principală. Habitatele sunt lumi separate.',
                  'Utility buildings for the main island. Habitats are separate worlds.',
                )}
              </p>
              <div className="realm-build-grid">
                {(Object.keys(UTILITY_BUILDINGS) as UtilityKind[]).map((kind) => {
                  const spec = UTILITY_BUILDINGS[kind],
                    existing = save.buildings.find((b) => b.kind === kind);
                  return (
                    <div className="realm-build-card" key={kind}>
                      <BuildingSprite kind={kind} save={save} />
                      <div>
                        <span className="realm-eyebrow">3 × 3 · {tr('UTILITAR', 'UTILITY')}</span>
                        <h3>{spec.name[lang]}</h3>
                        <p>{spec.description[lang]}</p>
                      </div>
                      {existing ? (
                        <div className="realm-build-actions">
                          <button
                            className="realm-button secondary"
                            onClick={() => {
                              if (kind === 'portal') setPanel('expedition');
                              else setPanel(kind);
                            }}
                          >
                            {tr('Deschide', 'Open')}
                          </button>
                          <button className="realm-link" onClick={() => startPlacement(existing.id, kind)}>
                            {tr('Mută', 'Move')}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="realm-button"
                          disabled={save.gold < spec.cost}
                          onClick={() => startPlacement(null, kind)}
                        >
                          {spec.cost} ●
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {panel === 'collection' && (
            <DinosaurCollection
              lang={lang}
              dinos={save.dinos}
              initialElement={realm === 'home' ? 'fire' : realm}
              openOwned={(id) => openBuilding(`dino:${id}`)}
              openMarket={() => setPanel('market')}
            />
          )}
          {panel === 'realms' && (
            <>
              <p className="realm-intro">
                {tr(
                  'Fiecare habitat este o lume separată. Clădirile utilitare rămân pe insula principală.',
                  'Each habitat is its own world. Utility buildings stay on the main island.',
                )}
              </p>
              <button className="realm-button secondary realm-home-choice" onClick={() => visitRealm('home')}>
                ⌂ {tr('Insula principală', 'Main island')} · {tr('Clădiri utilitare', 'Utility buildings')}
              </button>
              <div className="realm-realms-grid">
                {ELEMENTS.map((el) => {
                  const open = !!save.habitats[el.id],
                    level = save.habitats[el.id] ?? 0,
                    next = open ? HABITAT_LEVELS[level] : undefined,
                    cost = WORLD_UNLOCK[el.id],
                    affordable =
                      save.gold >= cost.gold &&
                      Object.entries(cost.materials).every(([id, n]) => save.inventory[id as ItemId] >= n!);
                  return (
                    <article
                      key={el.id}
                      className={`realm-realm-card ${realm === el.id ? 'active' : ''} ${open ? '' : 'locked'}`}
                      style={{ '--realm-color': el.color } as React.CSSProperties}
                    >
                    <button
                      className="realm-world-entry"
                      onClick={() =>
                        open
                          ? visitRealm(el.id)
                          : affordable &&
                            run({ type: 'unlockHabitat', realm: el.id }) &&
                            setMessage(`${tr('Lume deblocată', 'World unlocked')}: ${el.name[lang]}!`)
                      }
                      disabled={!open && !affordable}
                      aria-label={`${open ? tr('Intră în lumea', 'Enter world') : tr('Deblochează lumea', 'Unlock world')}: ${el.name[lang]}`}
                    >
                      <div
                        className="realm-world-thumbnail"
                        style={{ backgroundImage: `url('${worldThumb(el.id)}')` }}
                      />
                      <h3>
                        {el.symbol} {el.name[lang]}
                      </h3>
                      <p>{REALM_NAMES[el.id][lang]}</p>
                      {open ? (
                        <small>
                          {tr('Nivel', 'Level')} {level} · 🦖 {save.dinos.filter((x) => x.element === el.id).length}/{habitatCapacity(save, el.id)}
                          <span className="realm-world-enter-label">{tr('Intră în tărâm', 'Enter world')} →</span>
                        </small>
                      ) : (
                        <small className="realm-world-cost">
                          🔒 {cost.gold} ●
                          {Object.entries(cost.materials).map(([id, n]) => (
                            <span key={id} className={save.inventory[id as ItemId] >= n! ? '' : 'short'}>
                              {' '}
                              · {ITEMS[id as ItemId].icon} {n}
                            </span>
                          ))}
                        </small>
                      )}
                    </button>
                    {open && (
                      <div className="realm-world-upgrade">
                        {next ? (
                          <>
                            <strong>{tr('Nivel', 'Level')} {level + 1} · {next.capacity} {tr('locuri', 'spots')}</strong>
                            {next.capacity === habitatCapacity(save, el.id) && (
                              <small>{tr('Crește depozitul și venitul', 'More storage and income')}</small>
                            )}
                            <span>{next.gold.toLocaleString(lang ? 'en-US' : 'ro-RO')} {tr('aur', 'gold')} + 1 {tr('kit habitat', 'habitat kit')}</span>
                            <button
                              className="realm-button secondary"
                              disabled={save.gold < next.gold || save.inventory.habitatKit < 1}
                              onClick={() => run({ type: 'upgradeHabitat', realm: el.id })}
                              aria-label={`${tr('Îmbunătățește', 'Upgrade')}: ${el.name[lang]}`}
                            >
                              {tr('Îmbunătățește', 'Upgrade')}
                            </button>
                            {save.inventory.habitatKit < 1 && (
                              <button className="realm-link" onClick={() => setPanel('workshop')}>
                                {tr('Fă un kit în Atelier', 'Make a kit in the Workshop')} →
                              </button>
                            )}
                          </>
                        ) : <strong>{tr('Nivel maxim', 'Max level')}</strong>}
                      </div>
                    )}
                    </article>
                  );
                })}
              </div>
              <p className="realm-note">
                {tr(
                  'Lumile sunt blocate până le deblochezi cu aur și materiale. Apoi cumpără ouă din Piață sau primește-le din poveste.',
                  'Worlds stay locked until you unlock them with gold and materials. Then buy eggs at the Market or earn them from the story.',
                )}
              </p>
            </>
          )}
          {panel === 'wiki' && <RealmsWiki lang={lang} />}
          {panel === 'settings' && (
            <div className="realm-settings">
              <button className="realm-button secondary" onClick={() => setPanel('wiki')}>
                📖 Wikipedia
              </button>
              <label>
                {tr('Limbă', 'Language')}
                <select value={lang} onChange={(e) => setLang(Number(e.target.value))}>
                  <option value={0}>Română</option>
                  <option value={1}>English</option>
                </select>
              </label>
              <div className="realm-setting-row">
                <span>{tr('Sunete', 'Sounds')}</span>
                <button
                  className="realm-button secondary"
                  aria-pressed={sound}
                  onClick={() => {
                    setSoundEnabled(!sound);
                    setSound(!sound);
                    if (!sound) playSound('coin');
                  }}
                >
                  {sound ? tr('Pornite', 'On') : tr('Oprite', 'Off')}
                </button>
              </div>
              <div className="realm-setting-row">
                <span>
                  {tr('Salvare locală · schemă v5', 'Local save · schema v5')}
                  <small>
                    {tr('Progresul Dino World este păstrat separat.', 'Dino World progress is stored separately.')}
                  </small>
                </span>
                <button className="realm-button secondary" onClick={exportSave}>
                  {tr('Exportă', 'Export')}
                </button>
              </div>
              <label className="realm-import">
                {tr('Importă o salvare JSON', 'Import a JSON save')}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      if (file.size > 1_000_000) throw Error('large');
                      const imported = parseSave(await file.text());
                      localStorage.setItem(`${SAVE_KEY}-before-import`, JSON.stringify(saveRef.current));
                      const next = advance(imported, Date.now());
                      saveRef.current = next;
                      setSave(next);
                      setMessage(tr('Salvare importată.', 'Save imported.'));
                    } catch {
                      setMessage(
                        tr(
                          'Fișier invalid. Progresul curent este păstrat.',
                          'Invalid file. Current progress is preserved.',
                        ),
                      );
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <a className="realm-button secondary" href="?mode=classic">
                {tr('Deschide Dino World clasic', 'Open classic Dino World')} ↗
              </a>
              <button className="realm-link" onClick={() => setPanel('assets')}>
                {tr('Status artă & referințe', 'Art & reference status')}
              </button>
              <a className="realm-link" href="?mode=preview" target="_blank" rel="noreferrer">
                {tr('Previzualizare animații în arenă și habitat', 'Preview animations in the arena and habitat')} ↗
              </a>
              <p className="realm-note">
                {tr(
                  'Prototip local fără audio. Animațiile finale și performanța mobilă nu sunt încă validate.',
                  'Local prototype without audio. Final animations and mobile performance are not yet validated.',
                )}
              </p>
            </div>
          )}
          {panel === 'assets' && <AnimationViewer lang={lang} />}
        </Window>
      )}
      {gameplayView && (
        <GameplayScreen
          view={gameplayView}
          save={save}
          now={now}
          lang={lang}
          run={run}
          close={() => setPanel(null)}
          navigate={(next) => {
            if (gameplayView === 'expedition' && ['farm', 'dino', 'workshop'].includes(next)) setExpeditionPreparation(true);
            setPanel(next);
          }}
          build={() => { setExpeditionPreparation(gameplayView === 'expedition'); setPanel('build'); }}
          prepareSupplies={() => { setWorkshopRecipe('provisions'); setExpeditionPreparation(true); setPanel('workshop'); }}
          initialRecipe={workshopRecipe}
          returnToExpeditions={expeditionPreparation ? () => { setExpeditionPreparation(false); setPanel('expedition'); } : undefined}
        />
      )}
      {save.battle && !panel && !save.battle.encounterId.startsWith('arena') && (
        <BattleScreen
          save={save}
          lang={lang}
          run={run}
          close={() => setPanel(save.battle?.encounterId.startsWith('arena') ? 'arena' : 'expedition')}
        />
      )}
      {offline && !panel && !save.battle && !placing && (
        <div className="realm-offline-strip" role="status">
          <div>
            <strong>{tr('Cât timp ai fost plecat', 'While you were away')}</strong>
            <small>
              {tr('Disponibil de colectat', 'Available to collect')} · {Math.floor(offline.elapsed / 60_000)} min
            </small>
          </div>
          <span>● {Math.floor(live.storedGold)}</span>
          <span>❧ {farmReadyFood(save, now)}</span>
          <span>⚒ {save.crafting.filter((j) => j.endsAt <= now).length}</span>
          <button
            className="realm-button"
            onClick={() => {
              if (run({ type: 'collectAvailable' })) setOffline(null);
            }}
          >
            {tr('Colectează disponibil', 'Collect available')}
          </button>
          <button onClick={() => setOffline(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </main>
  );
}
function Resource({ icon, value, label, color }: { icon: IconName; value: number; label: string; color: string }) {
  return (
    <div className={`realm-resource ${color}`}>
      <span>
        <Icon name={icon} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value.toLocaleString('en-GB')}</strong>
      </div>
    </div>
  );
}
function Nav({
  icon,
  label,
  onClick,
  featured = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button className={featured ? 'featured' : ''} onClick={onClick} aria-label={label} title={label}>
      <span>
        <Icon name={icon} scale={2} />
      </span>
      <strong>{label}</strong>
    </button>
  );
}
