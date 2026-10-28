import { ResourceHelpContext } from './ResourceHelp';
import { RealmsPanel } from './RealmsPanel';
import { BuildPanel } from './BuildPanel';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import World from './World';
import { RealmsWiki } from './RealmsWiki';
import { Hero } from './Hero';
import { DinosaurCollection } from './DinosaurCollection';
import { DinosaurArt } from './DinosaurArt';
import { HeroVision } from './HeroVision';
import { AnimationViewer } from './AnimationViewer';
import { SPECIES_NAMES } from './dinosaurs';
import { GameplayScreen, BattleScreen, type DuelOutcome, type GameplayView } from './GameplayScreens';
import { WorkshopPanel } from './WorkshopPanel';
import { GemShop } from './GemShop';
import { unlockedNav, type NavKey } from './navUnlocks';
import { DEV_TOOLS } from './devTools';
import { ITEMS, UTILITY_BUILDINGS, type UtilityKind } from './content';
import { FarmPanel } from './FarmPanel';
import { DailyPanel } from './DailyPanel';
import { GuidedTour, type TourStep } from './GuidedTour';
import { AdventureJournal } from './AdventureJournal';
import { goalPurpose } from './journey';
import { dailyState, DAILY_QUESTS, weekStart } from './daily';
import { DevPanel, DinoPanel, EggArt, HabitatsPanel, HatcheryPanel, MarketPanel } from './DinoPanels';
import {
  advance,
  friendCollect,
  friendlyBattle,
  DUEL,
  DUEL_SEASON_PRIZES,
  duelLeague,
  lastWeekId,
  isTower,
  champion,
  command,
  currentTrip,
  ELEMENTS,
  farmReadyFood,
  eggPrice,
  storyChapter,
  storyEgg,
  targetName,
  GEM_SOURCES,
  REALM_NAMES,
  newSave,
  parseSave,
  SAVE_KEY,
  type Command,
  type Save,
  type RealmId,
  type Dino,
} from './game';
import { compact, roman } from './format';
import './realms.css';
import './pixel-theme.css';
import './panel-kit.css';
import './mobile-layout.css';
import { Icon, type IconName } from './ui/Icon';
import { playSound, setSoundEnabled, soundEnabled, type SoundId } from './sound';
import { useCloudSync } from './useCloudSync';
import {
  clearFriendHelps,
  fetchCloudSave,
  fetchFriendHelps,
  duelBlock,
  fetchDefenses,
  fetchFriendNews,
  fetchLeagueRanking,
  guestName,
  helpFriend,
  recordFriendBattle,
  signOut,
  writeBackup,
} from './cloud';
import { PlayersPanel } from './PlayersPanel';
import type { User } from '@supabase/supabase-js';

/** The signed-in player handed over by the sign-in gate (SignInGate), with where their cloud save stood. */
export type SignedIn = {
  user: User;
  /** The public player name chosen at sign-up. */
  name: string;
  /** Cloud time of the save the game starts from; null when the account has no save row yet. */
  marker: string | null;
  /** True when the starting save is not in the cloud yet (a new game, or progress moved in from this device). */
  unsaved: boolean;
  recovering: boolean;
  endRecovery: () => void;
};
import { AccountPanel, statusText } from './AccountPanel';

/** The sound a successful command makes. Battle actions are voiced by the battle replay instead. */
const COMMAND_SOUNDS: Partial<Record<Command['type'], SoundId>> = {
  buyArenaTicket: 'coin',
  collect: 'coin',
  collectAvailable: 'coin',
  claim: 'coin',
  harvest: 'coin',
  claimCraft: 'coin',
  claimExpedition: 'coin',
  claimDailyQuest: 'coin',
  claimDailyBonus: 'coin',
  claimQuestEgg: 'coin',
  treasure: 'coin',
  claimTraining: 'evolve',
  pet: 'pop',
  train: 'pop',
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
  upgradePortal: 'build',
  spinDaily: 'spin',
  incubate: 'pop',
  feed: 'pop',
  buyEgg: 'pop',
  plant: 'pop',
  craft: 'pop',
  move: 'pop',
  addGems: 'coin',
  gemFinish: 'pop',
  gemBoost: 'build',
  rerollDailyQuest: 'pop',
  gemRest: 'evolve',
  gemSpin: 'spin',
};

type Panel =
  | 'journey'
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
  | 'account'
  | 'players'
  | 'shop'
  | null;
const text = (lang: number, ro: string, en: string) => (lang ? en : ro);
const TOUR_STEP_KEY = 'dino-realms-tour-step';
/** What a command did on its own (see Save.notice): an egg sold for lack of room, diamonds and tickets won. */
function noticeText(s: Save, lang: number) {
  const n = s.notice;
  if (!n) return '';
  return [
    n.worldEgg
      ? text(
          lang,
          `Lumea ${ELEMENTS.find((e) => e.id === n.worldEgg)!.name[0]} e deschisă! Ai primit un ou: îl găsești la Incubator.`,
          `The ${ELEMENTS.find((e) => e.id === n.worldEgg)!.name[1]} world is open! You got an egg: it waits at the Hatchery.`,
        )
      : '',
    n.gems ? text(lang, `+${n.gems} 💎 diamante câștigate!`, `+${n.gems} 💎 diamonds earned!`) : '',
    n.tickets
      ? text(
          lang,
          `+${n.tickets.count} bilete de arenă: ${ELEMENTS.find((e) => e.id === n.tickets!.realm)!.name[0].toLowerCase()}.`,
          `+${n.tickets.count} ${ELEMENTS.find((e) => e.id === n.tickets!.realm)!.name[1].toLowerCase()} arena tickets.`,
        )
      : '',
    n.eggSold
      ? text(
          lang,
          `Lista ouălor în așteptare e plină: oul câștigat a fost vândut pentru ${n.eggSold} aur.`,
          `The waiting egg list is full: the egg you won was sold for ${n.eggSold} gold.`,
        )
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}
/** Set by load() when the local save could not be read and was moved aside; the app tells the player once. */
let saveRecovered = false;
function load(): Save {
  saveRecovered = false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        return advance(parseSave(raw), Date.now());
      } catch {
        // An older schema or a broken save: keep a copy aside and start a new game.
        localStorage.setItem(`${SAVE_KEY}-recovery-${Date.now()}`, raw);
        saveRecovered = true;
      }
    }
  } catch {
    /* Storage may be disabled; gameplay still works. */
  }
  return newSave(Date.now());
}
/** Panels that fit their window without scrolling (see Window `fit`). */
const FIT_PANELS: string[] = [
  'dino',
  'hatchery',
  'market',
  'habitat',
  'farm',
  'build',
  'collection',
  'realms',
  'shop',
  'workshop',
  'daily',
];
export function Window({
  title,
  eyebrow,
  children,
  close,
  wide = false,
  closable = true,
  fit = false,
  tabs,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  /** False for a choice the player must make: no close button, Escape and the backdrop do nothing. */
  closable?: boolean;
  /**
   * A fixed-height window whose body never scrolls: the panel inside (a `.fit-panel`) fills it and pages its own
   * content; only areas marked `[data-scroll]` may scroll.
   */
  fit?: boolean;
  /** Tabs (or another compact control) shown in the header, beside the title. */
  tabs?: ReactNode;
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
        if (closable && e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`realm-window${wide ? ' wide' : ''}${fit ? ' fit' : ''}`}
        onKeyDown={(e) => {
          if (closable && e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
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
          {tabs && <div className="realm-window-tabs">{tabs}</div>}
          {closable && (
            <button className="realm-close" onClick={close} aria-label="Close">
              <Icon name="close" />
            </button>
          )}
        </header>
        <div className="realm-window-body">{children}</div>
      </div>
    </div>
  );
}
/** Arena and tower fights play inside the arena panel. */
const arenaFight = (id: string) => id.startsWith('arena') || isTower(id);

/**
 * The game. With accounts (`account`), it starts from the save the sign-in gate loaded from the cloud and keeps it
 * only there. Without accounts configured (local development), it keeps the save in this browser as before.
 */
export default function RealmsApp({
  initialSave,
  account,
  guest = false,
}: { initialSave?: Save; account?: SignedIn; guest?: boolean } = {}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [heroVision, setHeroVision] = useState<Dino | null>(null);
  const [trainAfterVision, setTrainAfterVision] = useState(false);
  /** Another player's world being looked at (read only), and which of its worlds is shown. */
  const [visit, setVisit] = useState<{ id: string; name: string; save: Save; canHelp: boolean } | null>(null);
  /** A friendly fight against a friend's team, played on a copy of the save that is thrown away afterwards. */
  const [friendFight, setFriendFight] = useState<{
    id: string;
    name: string;
    save: Save;
    outcome?: DuelOutcome;
  } | null>(null);
  const friendRef = useRef(friendFight);
  friendRef.current = friendFight;
  const [visitView, setVisitView] = useState<'home' | RealmId>('home');
  const [save, setSave] = useState(() => (initialSave ? advance(initialSave, Date.now()) : load())),
    [now, setNow] = useState(Date.now()),
    [panel, setPanel] = useState<Panel>(() => (save.battle && arenaFight(save.battle.encounterId) ? 'arena' : null));
  useEffect(() => {
    if (panel !== 'dino') setTrainAfterVision(false);
  }, [panel]);
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
      return localStorage.getItem('dino-realms-language') === 'ro' ? 0 : 1;
    } catch {
      return 1;
    }
  });
  const [sound, setSound] = useState(soundEnabled);
  // Phones can hide the browser bars: the Fullscreen API where it exists (Android), never when installed as an app.
  const fullscreenTarget = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  const canFullscreen =
    (document.fullscreenEnabled || !!fullscreenTarget.webkitRequestFullscreen) &&
    !window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('webkitfullscreenchange', change);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('webkitfullscreenchange', change);
    };
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else if (fullscreenTarget.requestFullscreen)
      void fullscreenTarget.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else fullscreenTarget.webkitRequestFullscreen?.();
  };
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
    [placingLamp, setPlacingLamp] = useState(false),
    [moving, setMoving] = useState<string | null>(null),
    [message, setMessage] = useState(() =>
      saveRecovered
        ? text(
            lang,
            'Salvarea de pe acest dispozitiv nu a putut fi citită: am păstrat-o deoparte și am început un joc nou.',
            'The save on this device could not be read: it was kept aside and a new game started.',
          )
        : '',
    );
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const [expeditionPreparation, setExpeditionPreparation] = useState(false);
  const [workshopRecipe, setWorkshopRecipe] = useState('provisions');
  const [helpRealm, setHelpRealm] = useState<RealmId | undefined>();
  const [helpBuilding, setHelpBuilding] = useState<UtilityKind>('farm');
  // The bottom bar can fold down to just the Collect button; phones start folded, where it covers more island.
  const [navOpen, setNavOpen] = useState(() => {
    // Same query as the phone layout in realms.css.
    if (
      window.matchMedia('(max-width: 760px), (max-height: 500px) and (orientation: landscape) and (max-width: 1050px)')
        .matches
    )
      return false;
    try {
      return localStorage.getItem('dino-realms-nav') !== 'closed';
    } catch {
      return true;
    }
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
    if (done >= total) {
      loader.remove();
      // index.html skips the loading screen next time while this build stays cached.
      try {
        const scripts = document.querySelectorAll('script[type="module"][src]');
        const version = scripts.length ? scripts[scripts.length - 1].getAttribute('src')!.split('?')[0] : '';
        if (version) localStorage.setItem('dino-world-warm', version);
      } catch {
        /* Optional. */
      }
    }
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
      const raw = initialSave ? null : localStorage.getItem(SAVE_KEY);
      const old = initialSave ?? (raw ? parseSave(raw) : null);
      if (!old) return null;
      const current = advance(old, Date.now());
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
  const gameplayView: GameplayView | null = panel === 'expedition' || panel === 'arena' ? panel : null;
  const saveRef = useRef(save);
  saveRef.current = save;
  // Progress made on another tab or device replaces this view; like a save loaded at start, it catches up on time.
  const cloudSync = useCloudSync(
    account?.user.id ?? null,
    account?.marker ?? null,
    account?.unsaved ?? false,
    save,
    (cloudSave) => {
      const next = advance(cloudSave, Date.now());
      saveRef.current = next;
      setSave(next);
    },
    () =>
      setMessage(
        tr('Am adus progresul de pe celălalt dispozitiv.', 'Brought in your progress from your other device.'),
      ),
  );
  // Guests play under a random name until they pick their own with an account.
  const [playerName, setPlayerName] = useState(() => account?.name ?? (guest ? guestName() : ''));
  const sync = {
    ...cloudSync,
    name: playerName || undefined,
    onRename: setPlayerName,
    // Before a guest signs into an existing account, its progress is left on the device for that account to adopt.
    stash: () => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveRef.current));
      } catch {
        /* Nothing to carry over then. */
      }
    },
    user: account?.user ?? null,
    recovering: account?.recovering ?? false,
    endRecovery: account?.endRecovery ?? (() => {}),
  };
  useEffect(() => {
    if (sync.recovering) setPanel('account');
  }, [sync.recovering]);
  /**
   * A guest is invited to keep the progress in an account at each milestone, once per milestone: the first hatch,
   * the first juvenile, the first expedition, three dinosaurs. "Later" waits for the next one.
   */
  const [askAccount, setAskAccount] = useState<false | 'milestone' | 'return'>(false);
  // Coming back to the game (a new day) also reminds a guest with progress, once a day.
  useEffect(() => {
    if (!guest || save.dinos.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const last = localStorage.getItem('dino-realms-save-reminder');
      localStorage.setItem('dino-realms-save-reminder', today);
      if (last && last !== today) setAskAccount((a) => a || 'return');
    } catch {
      /* Optional reminder. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const milestones = [
    save.dinos.length > 0,
    save.dinos.some((x) => x.stage !== 'baby'),
    Object.values(save.expeditionProgress).some((n) => (n ?? 0) > 0),
    save.dinos.length >= 3,
  ].filter(Boolean).length;
  useEffect(() => {
    if (!guest || milestones === 0) return;
    try {
      if (Number(localStorage.getItem('dino-realms-save-prompt') ?? 0) >= milestones) return;
      localStorage.setItem('dino-realms-save-prompt', String(milestones));
    } catch {
      /* Without storage it asks again on the next visit. */
    }
    setAskAccount('milestone');
  }, [guest, milestones]);
  const tr = (ro: string, en: string) => text(lang, ro, en);
  const today = dailyState(save, now);
  const dailyReady =
    today.spin === null ||
    today.quests.some((id) => !today.claimed.includes(id) && today.progress[id] >= DAILY_QUESTS[id].target) ||
    (!today.bonus && today.quests.every((id) => today.claimed.includes(id)));
  // The first-time guide shows once on this device (and again from the profile menu); the daily panel waits for it.
  // Browser checks (navigator.webdriver) start without it unless they ask with dino-realms-tour = 'show'.
  // A 'fresh' guide (no dinosaur yet) walks through hatching the first egg; a 'replay' only tours the screen.
  const tourKind = (s: Save) => (s.dinos.length ? 'replay' : 'fresh') as 'fresh' | 'replay';
  // A first guide cut short by a reload picks up where it was (see TOUR_STEP_KEY).
  const [tourStart, setTourStart] = useState(() => {
    try {
      return Number(localStorage.getItem(TOUR_STEP_KEY) ?? 0) || 0;
    } catch {
      return 0;
    }
  });
  const [tour, setTour] = useState<false | 'fresh' | 'replay'>(() => {
    try {
      const kept = localStorage.getItem('dino-realms-tour');
      const resuming = localStorage.getItem(TOUR_STEP_KEY) !== null;
      return (kept === 'show' || (kept !== 'done' && !navigator.webdriver)) && (resuming ? 'fresh' : tourKind(save));
    } catch {
      return false;
    }
  });
  const replayTour = () => {
    setTourStart(0);
    setTour(tourKind(save));
  };
  // What the guide checks so a step already done (after a reload, or by another route) moves on by itself.
  const tourHatched = () => saveRef.current.dinos.length > 0;
  const tourSpun = () => dailyState(saveRef.current, Date.now()).spin !== null;
  const tourBuilt = (kind: string) => saveRef.current.buildings.some((b) => b.kind === kind);
  const endTour = () => {
    setTour(false);
    try {
      localStorage.setItem('dino-realms-tour', 'done');
      localStorage.removeItem(TOUR_STEP_KEY);
    } catch {
      /* Optional: the guide then only shows again on the next visit. */
    }
  };
  const dailyOpened = useRef<string | null>(null);
  useEffect(() => {
    if (
      tour ||
      heroVision ||
      panel ||
      placing ||
      save.battle ||
      save.dinos.length === 0 ||
      dailyOpened.current === today.day
    )
      return;
    try {
      if (localStorage.getItem('dino-realms-daily-opened') === today.day) return;
      localStorage.setItem('dino-realms-daily-opened', today.day);
    } catch {
      // The in-memory marker also works when storage is unavailable.
    }
    dailyOpened.current = today.day;
    setPanel('daily');
  }, [today.day, panel, placing, save.battle, save.dinos.length, heroVision, tour]);
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
      setHelpRealm(next);
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
          jobs: current.crafting.filter((j) => j.endsAt <= returnedAt).length,
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
    // Signed in, the cloud holds the save (useCloudSync); this device keeps a backup in case an upload is lost.
    if (account) return writeBackup(account.user.id, save, playerName);
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
        if (heroVision) return; // The vision's dialog returns to the hero sheet itself.
        setVisit(null);
        setPanel(null);
        setPlacing(false);
        setMoving(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [heroVision]);
  // An upgrade whose build time has run out is put in place right away (the building shows its new level).
  const buildingDone = !!save.construction && now >= save.construction.endsAt;
  useEffect(() => {
    if (!buildingDone) return;
    const built = saveRef.current.construction;
    if (!built) return;
    const next = advance(saveRef.current, Date.now());
    saveRef.current = next;
    setSave(next);
    playSound('build');
    setMessage(
      text(
        lang,
        `Construcție gata: ${targetName(built.target, 0)}, nivelul ${built.level}.`,
        `Upgrade done: ${targetName(built.target, 1)}, level ${built.level}.`,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingDone]);
  const run = (c: Command) => {
    try {
      const next = command(saveRef.current, c, Date.now());
      saveRef.current = next;
      setSave(next);
      const sound = COMMAND_SOUNDS[c.type];
      if (sound) playSound(sound);
      const notes = noticeText(next, lang);
      if (notes) setMessage(notes);
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
            placement: tr(
              'Alege o zonă liberă de 3 × 3, cu un rând liber față de alte clădiri.',
              'Choose an empty 3 × 3 area, one free row away from other buildings.',
            ),
            juvenile: tr(
              'Puii nu pot lupta: crește dinozaurul până la juvenil.',
              'Babies cannot fight: raise the dinosaur to juvenile first.',
            ),
            empty: tr('Aurul se acumulează în habitat.', 'Gold is accumulating in the habitat.'),
            gold: tr('Aur insuficient.', 'Not enough gold.'),
            plots: tr('Toate straturile sunt ocupate.', 'All plots are busy.'),
            timer: tr('Încă nu e gata.', 'Not ready yet.'),
            locked: tr('Încă nu e deblocat.', 'Not unlocked yet.'),
            maxLevel: tr('Clădirea e la nivelul maxim.', 'The building is at max level.'),
            gate: tr('Îmbunătățește Poarta arenei la nivelul 2.', 'Upgrade the Arena Gate to level 2.'),
            away: tr('Dinozaurul e plecat în expediție.', 'That dinosaur is away on an expedition.'),
            stars: tr('Ai nevoie de 2★ la treapta precedentă.', 'You need 2★ on the previous tier.'),
            tired: tr(
              'Dinozaurul se odihnește după luptă. Alege altul sau așteaptă.',
              'That dinosaur is resting after a fight. Pick another one or wait.',
            ),
            habitatFull: tr(
              'Habitatul e plin. Îmbunătățește-l sau eliberează un dinozaur.',
              'The habitat is full. Upgrade it or release a dinosaur.',
            ),
            habitat: tr('Deblochează mai întâi lumea acestui element.', "Unlock this element's world first."),
            egg: tr('Oul nu mai e disponibil.', 'That egg is no longer available.'),
            evolve: tr(
              'Dinozaurul a atins nivelul maxim al etapei. Evoluează-l.',
              'This dinosaur reached its stage cap. Evolve it.',
            ),
            dino: tr('Dinozaurul nu mai e disponibil.', 'That dinosaur is no longer available.'),
            unavailable: tr(
              'Nu se poate în timpul unei lupte sau cu un premiu necolectat.',
              'Not possible during a fight or with an unclaimed reward.',
            ),
            building: tr('Construiește mai întâi clădirea necesară.', 'Build the required building first.'),
            farm: tr('Construiește mai întâi ferma.', 'Build the farm first.'),
            recipe: tr('Rețeta nu e disponibilă.', 'That recipe is not available.'),
            running: tr('Lucrarea nu mai e în coadă.', 'That job is no longer queued.'),
            encounter: tr('Lupta nu e disponibilă acum.', 'That fight is not available right now.'),
            ticket: tr('Alege între 1 și 99 de tichete.', 'Choose between 1 and 99 tickets.'),
            dailyFree: tr('Folosește mai întâi rotirea gratuită de azi.', "Use today's free spin first."),
            feed: tr('Poți hrăni de 1 până la 10 ori odată.', 'You can feed 1 to 10 times at once.'),
            crop: tr('Cultura nu e disponibilă.', 'That crop is not available.'),
            battle: tr('Nicio luptă în desfășurare.', 'No fight is in progress.'),
            action: tr('Mutare necunoscută.', 'Unknown move.'),
            energy: tr(
              'Lovitura supremă cere un adult și energie plină.',
              'The ultimate needs an adult and full energy.',
            ),
            busy: tr('Un dinozaur din echipă e deja plecat sau ocupat.', 'A team member is already away or busy.'),
            slots: tr(
              'Toate sloturile portalului sunt ocupate. Îmbunătățește portalul pentru mai multe.',
              'Every portal slot is busy. Upgrade the portal for more.',
            ),
            teamSize: tr(
              'Alege numărul de dinozauri cerut de această expediție.',
              'Pick the number of dinosaurs this expedition takes.',
            ),
            patrolLocked: tr(
              'Patrulele se deschid după etapa 3 a regiunii.',
              "Patrols open after the region's stage 3.",
            ),
            done: tr(
              'Regiunea e deja traversată. Trimite o patrulă.',
              'This region is already crossed. Send a patrol.',
            ),
            expedition: tr('Expediția nu s-a terminat încă.', 'The expedition is not over yet.'),
            dailyClaimed: tr('Premiul a fost deja colectat azi.', 'This reward was already claimed today.'),
            dailyIncomplete: tr('Termină misiunea înainte de colectare.', 'Finish the mission before claiming.'),
            provisions: tr(
              'Pregătește provizii în Atelier înainte de plecare.',
              'Prepare supplies in the Workshop before departing.',
            ),
            level: tr(
              'Fiecare membru al echipei are nevoie de nivelul cerut.',
              'Every team member needs the required level.',
            ),
            timedExpedition: tr('Pornește această călătorie din Expediții.', 'Start this trip from Expeditions.'),
            fightEgg: tr(
              'Ouăle acestui element se câștigă în lupte, nu din Piață.',
              "This element's eggs are won in fights, not bought.",
            ),
            workshop: tr('Construiește mai întâi atelierul.', 'Build the workshop first.'),
            gems: tr('Nu ai destule diamante. Vezi Magazinul.', 'Not enough diamonds. Visit the Shop.'),
            arenaTicket: tr(
              'Ai nevoie de un tichet al acestui element. Cumpără-l din Arena.',
              'You need a ticket for this element. Buy one in the Arena.',
            ),
            ticketLimit: tr(
              'Ai atins limita de tichete pentru acest element.',
              'You have reached the ticket limit for this element.',
            ),
            rested: tr('Campionul e deja odihnit.', 'Your champion is already rested.'),
            worldOrder: tr(
              'Lumile se deschid pe rând: deblochează mai întâi lumea precedentă.',
              'Worlds open in order: unlock the previous world first.',
            ),
            worldRegion: tr(
              'Ajungi mai întâi la etapa 3 în regiunea lumii precedente.',
              "Reach stage 3 in the previous world's region first.",
            ),
            evolutionCrystal: tr(
              'Evoluția la adult cere un cristal de evoluție. Fabrică-l în Atelier.',
              'Evolving to adult takes an evolution crystal. Craft one in the Workshop.',
            ),
            boss: tr('Campionii legendari nu pot fi eliberați.', 'Legendary champions cannot be released.'),
            team: tr('Scoate-l mai întâi din echipă.', 'Take it out of the team first.'),
            lastDino: tr('Nu-ți poți elibera ultimul dinozaur.', 'You cannot release your last dinosaur.'),
            points: tr('Nu ai puncte de statistică pentru asta.', 'Not enough stat points for that.'),
            stat: tr('Statistică necunoscută.', 'Unknown stat.'),
            petsDone: tr('L-ai mângâiat destul azi. Revino mâine!', 'Enough petting for today. Come back tomorrow!'),
            trainingsDone: tr('Gata cu antrenamentele pe azi.', 'No more training today.'),
            training: tr('Un dinozaur se antrenează deja.', 'A dinosaur is already training.'),
            treasure: tr('Comoara a dispărut. Caut-o mai târziu.', 'The treasure is gone. Look again later.'),
            eggsFull: tr(
              'Nu mai e loc pentru ouă. Incubează sau vinde din Incubator.',
              'No room for more eggs. Incubate or sell some in the Hatchery.',
            ),
            dev: tr('Uneltele de test nu sunt disponibile.', 'Test tools are not available.'),
            builderBusy: tr(
              'Constructorul lucrează deja la o clădire. Așteaptă sau termină acum cu diamante.',
              'The builder is already on another upgrade. Wait, or finish it now with diamonds.',
            ),
            construction: tr('Nu se construiește nimic acum.', 'Nothing is being built right now.'),
            dailyReroll: tr(
              'Misiunea nu se mai poate schimba: e gata sau nu mai sunt altele disponibile.',
              'This mission cannot be swapped: it is done or no other mission is available.',
            ),
            dailyQuest: tr('Misiunea nu e printre cele de azi.', "That mission is not one of today's."),
            legendLocked: tr(
              'Proba legendei se deschide după ce termini povestea.',
              'The Legend trial opens once you finish the story.',
            ),
            legendWeek: tr(
              'Ai făcut toate probele legendei săptămâna asta. Revino luni.',
              'You did every Legend trial this week. Come back on Monday.',
            ),
            towerDone: tr('Ai urcat tot turnul săptămâna asta.', 'You climbed the whole tower this week.'),
            towerFloor: tr(
              'Urcă mai sus în turn ca să deschizi cufărul.',
              'Climb higher in the tower to open this chest.',
            ),
            towerClaimed: tr('Cufărul turnului e deja deschis.', 'This tower chest is already open.'),
          } as Record<string, string>
        )[code] ?? tr('Acțiunea nu este disponibilă acum.', 'That action is not available yet.'),
      );
      return false;
    }
  };
  const d = champion(save),
    live = advance(save, now);
  // The story card follows one goal at a time through ten chapters (see STORY_CHAPTERS).
  const current = storyChapter(save),
    steps = current?.chapter.steps ?? [],
    story = current?.step,
    storyIndex = current?.index ?? 0,
    storyReady = !!story && story.done(save),
    navKeys = unlockedNav(save, story?.panel),
    storyProgress = story?.progress?.(save);
  // The header badge follows the chapter: its numeral, rank, title and how far into it the player is.
  const badge = current
    ? {
        numeral: roman(current.chapter.number),
        rank: current.chapter.rank[lang],
        title: current.chapter.title[lang],
        progress: storyIndex / steps.length,
      }
    : { numeral: '★', rank: tr('Legendă', 'Legend'), title: tr('Toate tărâmurile', 'All the realms'), progress: 1 };
  // Buttons seen at least once; one unlocked since shows "NOU" until clicked. Existing players start with all seen.
  const [seenNav, setSeenNav] = useState<Set<string>>(() => {
    try {
      const kept = localStorage.getItem('dino-realms-nav-seen');
      if (kept) return new Set(JSON.parse(kept) as string[]);
    } catch {
      /* Fall through to what is open now. */
    }
    const now = [...unlockedNav(save)];
    try {
      localStorage.setItem('dino-realms-nav-seen', JSON.stringify(now));
    } catch {
      /* Optional. */
    }
    return new Set(now);
  });
  const navItem = (key: NavKey) => ({
    fresh: !seenNav.has(key),
    featured: story?.panel === key,
    seen: () =>
      setSeenNav((seen) => {
        if (seen.has(key)) return seen;
        const next = new Set(seen).add(key);
        try {
          localStorage.setItem('dino-realms-nav-seen', JSON.stringify([...next]));
        } catch {
          /* Optional. */
        }
        return next;
      }),
  });
  const openBuilding = (id: string) => {
    if (id === 'collection') return setPanel('collection');
    if (id === 'treasure') {
      const before = saveRef.current;
      if (run({ type: 'treasure' })) {
        const after = saveRef.current;
        const found = [
          after.gold > before.gold && `+${Math.floor(after.gold - before.gold)} ${tr('aur', 'gold')}`,
          after.food > before.food && `+${Math.floor(after.food - before.food)} ${tr('hrană', 'food')}`,
          after.gems > before.gems && `+${after.gems - before.gems} 💎`,
          ...(Object.keys(after.inventory) as (keyof typeof after.inventory)[])
            .filter((k) => after.inventory[k] > before.inventory[k])
            .map((k) => `+${after.inventory[k] - before.inventory[k]} ${ITEMS[k].name[lang]}`),
        ].filter(Boolean);
        setMessage(tr(`Comoară găsită! ${found.join(', ')}`, `Treasure found! ${found.join(', ')}`));
      }
      return;
    }
    if (id === 'income') {
      if (Math.floor(live.storedGold) < 1) {
        setMessage(tr('Nu ai aur de colectat încă.', 'No gold to collect yet.'));
      } else if (run({ type: 'collect' })) {
        setMessage(tr('Aur colectat!', 'Gold collected!'));
      }
      return;
    }
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
    setPlacingLamp(false);
    setRealm('home');
    setPanel(null);
    setMoving(id);
    setPlacing(true);
  };
  const startLampPlacement = () => {
    startPlacement();
    setPlacingLamp(true);
  };
  // Tell the player once when a dinosaur is back from its expedition, wherever they are in the game.
  const announcedTrip = useRef<number | null>(null);
  useEffect(() => {
    const trip = save.expeditions.find((x) => now >= x.endsAt) ?? currentTrip(save);
    if (!trip || now < trip.endsAt || announcedTrip.current === trip.startedAt) return;
    announcedTrip.current = trip.startedAt;
    const who = save.dinos.find((x) => x.id === trip.team[0])?.nickname ?? '';
    setMessage(
      tr(
        `${who} s-a întors din expediție! Colectează recompensa.`,
        `${who} is back from the expedition! Collect the reward.`,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, save.expeditions]);
  /** Loads another player's save from the cloud and shows their world. */
  const openVisit = async (player: { user_id: string; name: string }, canHelp: boolean) => {
    try {
      const remote = await fetchCloudSave(player.user_id);
      if (!remote || remote.outdated) {
        setMessage(tr(`${player.name} încă nu și-a construit lumea.`, `${player.name} has not built a world yet.`));
        return;
      }
      setPanel(null);
      setProfileOpen(false);
      setVisitView('home');
      setVisit({ id: player.user_id, name: player.name, save: advance(remote.save, Date.now()), canHelp });
    } catch {
      setMessage(tr('Lumea nu s-a putut încărca. Mai încearcă.', 'That world could not load. Try again.'));
    }
  };
  /** Collects the visited friend's habitat gold for them; their game moves it into their purse. */
  const helpVisited = async () => {
    if (!visit) return;
    const gold = Math.floor(advance(visit.save, Date.now()).storedGold);
    const problem = await helpFriend(visit.id);
    if (problem) {
      playSound('error');
      setMessage(
        {
          not_friends: tr('Nu mai sunteți prieteni.', 'You are no longer friends.'),
          help_off: tr(`${visit.name} nu acceptă ajutor acum.`, `${visit.name} does not accept help right now.`),
          too_soon: tr('Cineva i-a colectat deja în ultima oră.', 'Someone already collected for them this hour.'),
          network: tr('Nu s-a putut trimite. Verifică internetul.', 'Could not send. Check your connection.'),
        }[problem],
      );
      if (problem !== 'network') setVisit({ ...visit, canHelp: false });
      return;
    }
    playSound('coin');
    setMessage(tr(`Ai colectat ${gold} aur pentru ${visit.name}!`, `You collected ${gold} gold for ${visit.name}!`));
    setVisit({ ...visit, save: { ...visit.save, storedGold: 0, updatedAt: Date.now() }, canHelp: false });
  };
  /** Starts a friendly fight: your arena team against theirs, as they are saved in the cloud. */
  const challenge = async (player: { user_id: string; name: string }) => {
    // Tell the limits before the fight rather than after it (record_duel, 0011).
    const block = account ? await duelBlock(account.user.id, player.user_id).catch(() => null) : null;
    if (block) {
      playSound('error');
      setMessage(
        block.code === 'too_soon'
          ? tr(`Următorul duel peste ${block.wait} secunde.`, `Next duel in ${block.wait} seconds.`)
          : tr(
              `Ai jucat deja 3 dueluri în ultimele 24 de ore cu ${player.name}. Mai poți peste ${block.wait}, sau provoacă pe altcineva.`,
              `You already had 3 duels with ${player.name} in the last 24 hours. Try again in ${block.wait}, or challenge someone else.`,
            ),
      );
      return;
    }
    try {
      const remote = await fetchCloudSave(player.user_id);
      if (!remote || remote.outdated) throw new Error('rivalTeam');
      const sandbox = friendlyBattle(saveRef.current, advance(remote.save, Date.now()), player.user_id, Date.now());
      setPanel(null);
      setProfileOpen(false);
      setVisit(null);
      setFriendFight({ id: player.user_id, name: player.name, save: sandbox });
    } catch (e) {
      playSound('error');
      const code = (e as Error).message;
      setMessage(
        code === 'juvenile'
          ? tr(
              'Echipa ta de arenă are nevoie de un dinozaur juvenil sau adult.',
              'Your arena team needs a juvenile or adult dinosaur.',
            )
          : code === 'rivalTeam'
            ? tr(`${player.name} nu are încă o echipă de arenă.`, `${player.name} has no arena team yet.`)
            : tr('Lupta nu a putut începe. Mai încearcă.', 'The fight could not start. Try again.'),
      );
    }
  };
  const runFriendFight = (c: Command) => {
    const fight = friendRef.current;
    if (!fight) return false;
    try {
      const next = command(fight.save, c, Date.now());
      const result = next.battle?.result;
      let outcome = fight.outcome;
      if (result && !fight.save.battle?.result) {
        const before = saveRef.current.daily.duels,
          again = saveRef.current.daily.duelRivals.includes(fight.id);
        run({ type: 'duelReward', result, rival: fight.id });
        outcome = { paid: saveRef.current.daily.duels > before, again, count: saveRef.current.daily.duels };
        if (account)
          recordFriendBattle(account.user.id, fight.id, result).catch((e) => {
            console.error('Duel result not saved', e);
            const code = (e as Error).message;
            setMessage(
              code === 'too_soon'
                ? tr('Duelul nu intră în clasament: maxim un duel pe minut.', 'Not ranked: one duel a minute at most.')
                : code === 'daily_limit'
                  ? tr(
                      `Ai jucat deja 3 dueluri azi cu ${fight.name}. Revino mâine sau provoacă pe altcineva.`,
                      `You already had 3 duels with ${fight.name} today. Come back tomorrow or challenge someone else.`,
                    )
                  : code === 'no_profile'
                    ? tr(
                        'Alege-ți un nume de jucător ca duelurile să intre în clasament.',
                        'Pick a player name so duels get ranked.',
                      )
                    : tr(
                        'Rezultatul nu s-a putut salva în clasament. Mai încearcă.',
                        'The result could not be saved to the leaderboard. Try again.',
                      ),
            );
          });
      }
      friendRef.current = { ...fight, save: next, outcome };
      setFriendFight(friendRef.current);
      return true;
    } catch {
      return false;
    }
  };
  // Friends' collects wait in the cloud until this game applies them. Right after loading, they are replayed on the
  // save as it was before catching up on time, so each one empties the storage when the friend pressed the button.
  const initialRef = useRef(initialSave ?? null);
  useEffect(() => {
    if (!account) return;
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const helps = await fetchFriendHelps(account.user.id);
        if (!helps.length) return;
        const start = initialRef.current,
          base = start && start.revision === saveRef.current.revision ? start : saveRef.current;
        initialRef.current = null;
        const before = Math.floor(base.gold);
        const next = friendCollect(
          base,
          helps.map((h) => h.at),
          Date.now(),
        );
        saveRef.current = next;
        setSave(next);
        await clearFriendHelps(helps.map((h) => h.id));
        const names = [...new Set(helps.map((h) => h.name))].join(', ');
        setMessage(
          tr(
            `${names} ți-a colectat aurul: +${Math.floor(next.gold) - before}.`,
            `${names} collected your gold: +${Math.floor(next.gold) - before}.`,
          ),
        );
      } catch {
        /* Offline: they stay in the cloud for next time. */
      } finally {
        busy = false;
      }
    };
    void check();
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.user.id]);

  // Friend requests waiting for an answer (a badge until answered) and friendly fights against us (told once).
  const [friendRequests, setFriendRequests] = useState(0);
  // Duels against our defense since the Players window was last opened: a badge until it is.
  const [unreadDuels, setUnreadDuels] = useState(0);
  const duelsReadKey = account ? `dino-realms-duels-read-${account.user.id}` : '';
  useEffect(() => {
    if (panel !== 'players' || !duelsReadKey) return;
    try {
      localStorage.setItem(duelsReadKey, new Date().toISOString());
    } catch {
      /* The badge then comes back next time. */
    }
    setUnreadDuels(0);
  }, [panel, duelsReadKey]);
  const playersBadge = friendRequests + unreadDuels;
  const checkNewsRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!account) return;
    const uid = account.user.id;
    const seenKey = `dino-realms-friend-news-${uid}`;
    const read = () => {
      try {
        return JSON.parse(localStorage.getItem(seenKey) ?? 'null') as { requests: string[]; since: string } | null;
      } catch {
        return null;
      }
    };
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const seen = read() ?? { requests: [], since: new Date(0).toISOString() };
        const news = await fetchFriendNews(uid, seen.since);
        let readAt = new Date(0).toISOString();
        try {
          readAt = localStorage.getItem(`dino-realms-duels-read-${uid}`) ?? readAt;
        } catch {
          /* Everything counts as unread. */
        }
        fetchDefenses(uid, readAt).then(
          (d) => setUnreadDuels(d.length),
          () => {},
        );
        setFriendRequests(news.requests.length);
        const fresh = news.requests.filter((r) => !seen.requests.includes(r.id));
        // One line for the latest attack on our defense team, the others only counted.
        const last = news.battles.at(-1),
          more = news.battles.length - 1;
        const lines = [
          ...fresh.map((r) => tr(`${r.name} vrea să fiți prieteni.`, `${r.name} wants to be friends.`)),
          ...(last
            ? [
                (last.result === 'draw'
                  ? tr(`${last.attackerName} te-a atacat: egalitate.`, `${last.attackerName} attacked you: a draw.`)
                  : last.result === 'victory'
                    ? tr(
                        `${last.attackerName} te-a atacat și a câștigat.`,
                        `${last.attackerName} attacked you and won.`,
                      )
                    : tr(
                        `${last.attackerName} te-a atacat și a pierdut!`,
                        `${last.attackerName} attacked you and lost!`,
                      )) +
                  (more > 0
                    ? tr(
                        ` (+${more} ${more === 1 ? 'altă luptă' : 'alte lupte'})`,
                        ` (+${more} more ${more === 1 ? 'fight' : 'fights'})`,
                      )
                    : ''),
              ]
            : []),
        ];
        try {
          localStorage.setItem(
            seenKey,
            JSON.stringify({
              requests: news.requests.map((r) => r.id),
              since: news.battles.at(-1)?.at ?? seen.since,
            }),
          );
        } catch {
          /* Without storage the same news shows again next time. */
        }
        if (lines.length) {
          playSound('pop');
          setMessage(lines.join(' '));
        }
      } catch {
        /* Offline: checked again later. */
      } finally {
        busy = false;
      }
    };
    checkNewsRef.current = () => void check();
    void check();
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.user.id]);

  // Last week's duel season: a top-three place in the player's league pays once (see DUEL_SEASON_PRIZES).
  useEffect(() => {
    if (!account) return;
    const uid = account.user.id,
      week = lastWeekId(Date.now()),
      key = `dino-realms-season-${uid}`;
    if (saveRef.current.duelSeason === week) return;
    try {
      if (localStorage.getItem(key) === week) return;
    } catch {
      /* Checked again next time. */
    }
    const level = saveRef.current.dinos.find((x) => x.id === saveRef.current.champion)?.level ?? 0,
      league = duelLeague(level),
      until = weekStart(Date.now());
    fetchLeagueRanking(new Date(weekStart(until - 1)), new Date(until), league, false).then(
      (rows) => {
        try {
          localStorage.setItem(key, week);
        } catch {
          /* The command refuses a second claim anyway. */
        }
        const mine = rows.find((r) => r.userId === uid);
        const rank = mine && mine.wins > 0 ? rows.findIndex((r) => r.wins === mine.wins) + 1 : 0;
        const prize = DUEL_SEASON_PRIZES[rank - 1];
        if (!prize || !run({ type: 'duelSeason', week, rank })) return;
        playSound('victory');
        setMessage(
          tr(
            `Sezonul de dueluri s-a încheiat: locul ${rank} în ${league.name[0]}! +${prize.gems} 💎 și un ou ${prize.rarity === 'epic' ? 'epic' : 'rar'} la Incubator.`,
            `The duel season is over: place ${rank} in the ${league.name[1]}! +${prize.gems} 💎 and a ${prize.rarity} egg at the Hatchery.`,
          ),
        );
      },
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.user.id]);

  /** The champion's own portrait (the T-Rex hero before the first hatch). */
  const championArt = d ? (
    <DinosaurArt species={d.species} element={d.element} stage={d.stage} />
  ) : (
    <Hero stage="baby" />
  );
  const closeThen = (next: () => void) => () => {
    setProfileOpen(false);
    next();
  };
  /**
   * The champion avatar and its menu: top-left on phones, with resources and shortcuts (phones have no HUD); top-right
   * in the desktop HUD (`desk`), where resources already show: who is playing, then players, account and settings.
   */
  const profileMenu = (id: string, desk = false) => (
    <>
      <button
        className="realm-avatar"
        aria-label={desk ? tr('Profil și setări', 'Profile and settings') : tr('Profil', 'Profile')}
        aria-expanded={profileOpen}
        aria-controls={id}
        onClick={() => setProfileOpen((open) => !open)}
      >
        {championArt}
        <span>{d?.level ?? 1}</span>
        {guest && (
          <b
            className="realm-guest-alert"
            title={tr('Progresul nu e salvat în cont', 'Progress is not saved to an account')}
          >
            !
          </b>
        )}
      </button>
      {profileOpen && (
        <>
          <button
            className="realm-profile-dismiss"
            aria-label={tr('Închide', 'Close')}
            onClick={() => setProfileOpen(false)}
          />
          {desk ? (
            <section
              className="realm-profile-card realm-hud-menu"
              id={id}
              aria-label={tr('Profil și setări', 'Profile and settings')}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setProfileOpen(false);
              }}
            >
              <header>
                <span className="realm-hud-menu-portrait" aria-hidden="true">
                  {championArt}
                </span>
                <div>
                  <strong>{sync.name ?? d?.nickname ?? tr('Explorator', 'Explorer')}</strong>
                  <small>
                    {badge.rank} · {badge.title}
                  </small>
                  <i className="realm-hud-menu-rank" aria-hidden="true">
                    <b style={{ width: `${Math.min(100, badge.progress * 100)}%` }} />
                  </i>
                </div>
              </header>
              {sync.user?.email && <p className="realm-hud-menu-email">{sync.user.email}</p>}
              <nav>
                <button
                  className={guest ? 'realm-hud-menu-guest' : undefined}
                  onClick={closeThen(() => setPanel('account'))}
                >
                  <Icon name="shield" />
                  <span>
                    {guest ? tr('Creează cont', 'Create account') : tr('Cont', 'Account')}
                    <small>
                      {guest
                        ? tr('Salvează progresul în cloud', 'Save your progress in the cloud')
                        : tr('Nume, parolă și salvare', 'Name, password and saving')}
                    </small>
                  </span>
                  <em aria-hidden="true">›</em>
                </button>
                <button onClick={closeThen(() => setPanel('settings'))}>
                  <Icon name="settings" />
                  <span>
                    {tr('Setări', 'Settings')}
                    <small>{tr('Limbă și sunete', 'Language and sounds')}</small>
                  </span>
                  <em aria-hidden="true">›</em>
                </button>
                <button onClick={closeThen(replayTour)}>
                  <Icon name="star" />
                  <span>
                    {tr('Ghid de start', 'Getting started')}
                    <small>{tr('Arată-mi din nou pașii', 'Show me the steps again')}</small>
                  </span>
                  <em aria-hidden="true">›</em>
                </button>
              </nav>
              {/* An anonymous guest has nothing to sign back into: signing out would lose the progress. */}
              {account && !guest && (
                <footer>
                  <button
                    className="realm-hud-menu-signout"
                    onClick={closeThen(() => {
                      void cloudSync.flush().finally(() => void signOut());
                    })}
                  >
                    {tr('Ieși din cont', 'Sign out')}
                  </button>
                </footer>
              )}
            </section>
          ) : (
            <section
              className="realm-profile-card"
              id={id}
              aria-label={tr('Resurse', 'Resources')}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setProfileOpen(false);
              }}
            >
              <header>
                <div>
                  <strong>{sync.name ?? d?.nickname ?? tr('Explorator', 'Explorer')}</strong>
                  <small>
                    {badge.rank} · {badge.title}
                  </small>
                </div>
                <button aria-label={tr('Închide', 'Close')} onClick={() => setProfileOpen(false)}>
                  ×
                </button>
              </header>
              {sync.user?.email && <p className="realm-profile-email">{sync.user.email}</p>}
              <footer>
                <button onClick={closeThen(() => setPanel('account'))}>
                  {guest ? tr('Creează cont', 'Create account') : tr('Cont', 'Account')}
                </button>
                <button onClick={closeThen(() => setPanel('settings'))}>{tr('Setări', 'Settings')}</button>
                <button onClick={closeThen(replayTour)}>{tr('Ghid de start', 'Getting started')}</button>
                {account && !guest && (
                  <button
                    className="realm-profile-signout"
                    onClick={closeThen(() => {
                      void cloudSync.flush().finally(() => void signOut());
                    })}
                  >
                    {tr('Ieși din cont', 'Sign out')}
                  </button>
                )}
              </footer>
            </section>
          )}
        </>
      )}
    </>
  );
  if (friendFight?.save.battle) {
    return (
      <main className="realms-app">
        <BattleScreen
          save={friendFight.save}
          lang={lang}
          run={runFriendFight}
          close={() => setFriendFight(null)}
          friendly={friendFight.name}
          duel={friendFight.outcome}
        />
        {message && (
          <div className="realm-toast" role="status">
            {message}
          </div>
        )}
      </main>
    );
  }
  if (visit) {
    const worlds = ELEMENTS.filter((el) => visit.save.habitats[el.id]);
    return (
      <main className="realms-app realm-visiting">
        {/* The same island renderer as at home, with every action switched off. */}
        <World
          save={visit.save}
          realm={visitView}
          lang={lang}
          placing={false}
          moving={null}
          now={now}
          onPlace={() => {}}
          onSelect={() => {}}
        />
        <section className="realm-visit-bar" aria-label={tr('Vizită', 'Visit')}>
          <div>
            <span className="realm-eyebrow">{tr('ÎN VIZITĂ', 'VISITING')}</span>
            <strong>{tr(`Lumea lui ${visit.name}`, `${visit.name}'s world`)}</strong>
            <small>
              {visitView === 'home' ? tr('Insula principală', 'Main island') : REALM_NAMES[visitView][lang]} · 🦖{' '}
              {visit.save.dinos.length}
            </small>
          </div>
          <nav aria-label={tr('Lumile lui', 'Their worlds')}>
            <button aria-pressed={visitView === 'home'} onClick={() => setVisitView('home')}>
              🏝 {tr('Insula', 'Island')}
            </button>
            {worlds.map((el) => (
              <button
                key={el.id}
                aria-pressed={visitView === el.id}
                onClick={() => setVisitView(el.id)}
                title={el.name[lang]}
              >
                {el.symbol} {el.name[lang]}
              </button>
            ))}
          </nav>
          {visit.canHelp && (
            <button className="realm-button" onClick={() => void helpVisited()}>
              🪙 {tr('Colectează pentru el', 'Collect for them')} ({Math.floor(advance(visit.save, now).storedGold)})
            </button>
          )}
          <button className="realm-button" onClick={() => setVisit(null)}>
            ← {tr('Înapoi acasă', 'Back home')}
          </button>
        </section>
        {message && (
          <div className="realm-toast" role="status">
            {message}
          </div>
        )}
      </main>
    );
  }
  return (
    <ResourceHelpContext.Provider
      value={(route) => {
        if (route.recipe) setWorkshopRecipe(route.recipe);
        if (route.realm && ELEMENTS.some((e) => e.id === route.realm)) setHelpRealm(route.realm as RealmId);
        if (route.building) setHelpBuilding(route.building);
        if (route.panel === 'workshop' && !save.buildings.some((b) => b.kind === 'workshop')) {
          setPanel('build');
          return;
        }
        if (route.panel === 'farm' && !save.buildings.some((b) => b.kind === 'farm')) {
          setPanel('build');
          return;
        }
        setPanel(route.panel);
      }}
    >
      <main className="realms-app">
        <World
          save={save}
          realm={realm}
          lang={lang}
          placing={placing}
          moving={moving}
          placementKind={placementKind}
          lampMode={placing && placingLamp}
          now={now}
          covered={!!panel}
          onPlace={(x, y) => {
            if (placingLamp) {
              if (run({ type: 'placeLamp', x, y })) {
                setPlacing(false);
                setPlacingLamp(false);
                setMessage(tr('Lampă aprinsă!', 'Lamp lit!'));
              }
              return;
            }
            if (run(moving ? { type: 'move', id: moving, x, y } : { type: 'build', x, y, kind: placementKind })) {
              setPlacing(false);
              setMoving(null);
              setMessage(tr('Clădire amplasată!', 'Building placed!'));
            }
          }}
          onMove={(id, x, y) => {
            if (id.startsWith('lamp:')) {
              if (run({ type: 'moveLamp', index: Number(id.slice(5)), x, y }))
                setMessage(tr('Lampă mutată!', 'Lamp moved!'));
              return;
            }
            if (run({ type: 'move', id, x, y })) setMessage(tr('Clădire mutată!', 'Building moved!'));
          }}
          onSelect={openBuilding}
          treasures
          onProgress={bootProgress}
          neighbors={
            placing || moving
              ? undefined
              : {
                  order: ['home', ...ELEMENTS.map((el) => el.id)],
                  locked: ELEMENTS.filter((el) => !save.habitats[el.id]).map((el) => el.id),
                }
          }
          onNavigate={visitRealm}
          cameraAction={
            !panel &&
            !placing &&
            !save.battle &&
            save.dinos.length > 0 && (
              <button
                className="realm-daily-access"
                onClick={() => setPanel('daily')}
                aria-label={tr('Premii și misiuni zilnice', 'Daily rewards and missions')}
                title={tr('Zilnic', 'Daily')}
              >
                <span className="realm-daily-wheel" aria-hidden="true">
                  <span>★</span>
                </span>
                <span className="realm-daily-label" aria-hidden="true">
                  {tr('Zilnic', 'Daily')}
                </span>
                {dailyReady && <b aria-hidden="true">!</b>}
              </button>
            )
          }
        />
        <div className="realm-mobile-profile">{profileMenu('realm-mobile-stats')}</div>
        {/* Phones hide the HUD; gold, food and diamonds stay in sight beside the avatar. */}
        <div className="realm-mobile-wallet">
          <span title={`${tr('Aur', 'Gold')}: ${Math.floor(save.gold).toLocaleString(lang ? 'en-US' : 'ro-RO')}`}>
            <Icon name="gold" scale={1} /> {compact(save.gold)}
          </span>
          <span title={`${tr('Hrană', 'Food')}: ${save.food.toLocaleString(lang ? 'en-US' : 'ro-RO')}`}>
            <Icon name="food" scale={1} /> {compact(save.food)}
          </span>
          <button
            onClick={() => setPanel('shop')}
            aria-label={`${tr('Diamante', 'Diamonds')}: ${save.gems} · ${tr('magazin', 'shop')}`}
          >
            💎 {compact(save.gems)} <b aria-hidden="true">+</b>
          </button>
          {account && (
            <button
              className="realm-players-chip"
              onClick={() => setPanel('players')}
              aria-label={tr('Jucători', 'Players')}
            >
              ⚔{playersBadge > 0 && <i className="realm-friend-alert">{playersBadge}</i>}
            </button>
          )}
          {canFullscreen && (
            <button
              className="realm-fullscreen"
              onClick={toggleFullscreen}
              aria-pressed={fullscreen}
              aria-label={
                fullscreen ? tr('Ieși din ecran complet', 'Exit full screen') : tr('Ecran complet', 'Full screen')
              }
              title={fullscreen ? tr('Ieși din ecran complet', 'Exit full screen') : tr('Ecran complet', 'Full screen')}
            >
              {fullscreen ? '✕' : '⛶'}
            </button>
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
            <span className="realm-brand-mark">
              <Icon name="egg" scale={3} />
            </span>
            <span>
              DINO <b>REALMS</b>
              <small>COLLECT · BUILD · BELONG</small>
            </span>
          </a>
          <div className="realm-resources">
            <Resource icon="gold" value={Math.floor(save.gold)} label={tr('Aur', 'Gold')} color="gold" />
            <Resource icon="food" value={save.food} label={tr('Hrană', 'Food')} color="food" />
            <button
              className="realm-resource gems realm-gems-chip"
              onClick={() => setPanel('shop')}
              title={tr('Magazin de diamante', 'Diamond shop')}
            >
              <span aria-hidden="true">💎</span>
              <div>
                <small>{tr('Diamante', 'Diamonds')}</small>
                <strong>{save.gems.toLocaleString('en-GB')}</strong>
              </div>
            </button>
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
          {DEV_TOOLS && (
            <button
              className="realm-square realm-info"
              onClick={() => setDevOpen((v) => !v)}
              aria-label={tr('Unelte de test', 'Test tools')}
              aria-expanded={devOpen}
            >
              <Icon name="clock" />
            </button>
          )}
          <button className="realm-square" onClick={() => setPanel('wiki')} aria-label="Wikipedia" title="Wikipedia">
            <Icon name="wiki" />
          </button>
          {account && (
            <button
              className="realm-square realm-players-button"
              onClick={() => setPanel('players')}
              aria-label={tr('Jucători', 'Players')}
              title={tr('Jucători · prieteni, dueluri, clasament', 'Players · friends, duels, leaderboard')}
            >
              <Icon name="trophy" />
              {playersBadge > 0 && <b className="realm-friend-alert">{playersBadge}</b>}
            </button>
          )}
          <div className="realm-hud-profile">{profileMenu('realm-hud-menu', true)}</div>
        </header>
        {DEV_TOOLS && devOpen && (
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
            <button className="realm-button secondary realm-return" onClick={() => visitRealm('home')}>
              ← {tr('Insula principală', 'Main island')}
            </button>
          )}
        </aside>
        <aside className={`realm-quest${storyOpen ? '' : ' collapsed'}`}>
          <button
            className="realm-quest-top"
            onClick={toggleStory}
            aria-expanded={storyOpen}
            aria-label={
              storyOpen ? tr('Restrânge povestea', 'Collapse the story') : tr('Arată povestea', 'Show the story')
            }
            title={storyOpen ? tr('Restrânge povestea', 'Collapse the story') : tr('Arată povestea', 'Show the story')}
          >
            <span>✦</span>
            <span className="realm-quest-label">{tr('POVESTEA TA', 'YOUR STORY')}</span>
            {!storyOpen && storyReady && (
              <b className="realm-quest-alert" aria-label={tr('Recompensă disponibilă', 'Reward ready')}>
                !
              </b>
            )}
            <small>{current ? `${badge.numeral} · ${storyIndex + 1}/${steps.length}` : '★'}</small>
            <i className="realm-quest-chevron" aria-hidden />
          </button>
          <div className="realm-quest-body">
            {current && story ? (
              <>
                <span className="realm-eyebrow">
                  {tr('CAPITOLUL', 'CHAPTER')} {badge.numeral} · {current.chapter.title[lang].toUpperCase()}
                </span>
                <h2>{story.task[lang]}</h2>
                <p className="realm-quest-hint">
                  {storyReady ? tr('Gata! Ia-ți recompensa.', 'Done! Take your reward.') : story.hint[lang]}
                </p>
                {!storyReady && <p className="realm-quest-purpose">{goalPurpose(story)[lang]}</p>}
                {storyProgress && !storyReady && (
                  <div
                    className="realm-quest-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={storyProgress[1]}
                    aria-valuenow={storyProgress[0]}
                  >
                    <i style={{ width: `${Math.min(100, (storyProgress[0] / storyProgress[1]) * 100)}%` }} />
                    <span>
                      {Math.min(...storyProgress)} / {storyProgress[1]}
                    </span>
                  </div>
                )}
                <ul className="realm-quest-rewards" aria-label={tr('Recompensă', 'Reward')}>
                  <li>
                    <Icon name="gold" scale={1} /> +{story.gold}
                  </li>
                  <li>
                    <Icon name="food" scale={1} /> +{story.food}
                  </li>
                  {storyEgg(story) && (
                    <li
                      className="egg"
                      title={`${SPECIES_NAMES[story.species]} · ${ELEMENTS.find((e) => e.id === story.element)!.name[lang]}`}
                    >
                      <EggArt species={story.species} realm={story.element} size={22} /> {tr('Ou', 'Egg')}
                    </li>
                  )}
                  {storyEgg(story) && <li className="gem">💎 +{GEM_SOURCES.chapter}</li>}
                </ul>
                <div className="realm-quest-progress" aria-label={`${storyIndex}/${steps.length}`}>
                  {steps.map((q, i) => (
                    <i key={q.id} className={i < storyIndex ? 'done' : i === storyIndex ? 'current' : ''} />
                  ))}
                </div>
                {storyReady ? (
                  <button className="realm-button" onClick={() => run({ type: 'claimQuestEgg', questId: story.id })}>
                    <Icon name={storyEgg(story) ? 'egg' : 'star'} scale={1} /> {tr('Ia premiul', 'Claim')}{' '}
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    className="realm-button"
                    onClick={() => {
                      if (story.building) setHelpBuilding(story.building);
                      setPanel(story.panel);
                    }}
                  >
                    {tr('Mergi', 'Go')} <span>→</span>
                  </button>
                )}
                <button type="button" className="realm-link realm-journey-link" onClick={() => setPanel('journey')}>
                  {tr('Vezi traseul și următoarea descoperire', 'See your path and next discovery')} →
                </button>
              </>
            ) : (
              <>
                <span className="realm-eyebrow">{tr('TOATE CAPITOLELE', 'ALL CHAPTERS')}</span>
                <h2>{tr('Povestea e completă!', 'Story complete!')}</h2>
                <p className="realm-quest-hint">
                  {tr(
                    'Ai trecut prin toate cele zece lumi. Ouăle rare se câștigă în continuare în arenă și în expediții.',
                    'You crossed all ten worlds. Rare eggs keep dropping in the arena and on expeditions.',
                  )}
                </p>
                <button className="realm-button" onClick={() => setPanel('arena')}>
                  {tr('Spre arenă', 'To the arena')} <span>→</span>
                </button>
              </>
            )}
          </div>
        </aside>
        {placing ? (
          <div className="realm-placement">
            <div>
              <strong>
                {placingLamp
                  ? tr('Pune lampa', 'Place the lamp')
                  : moving
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
              <svg
                className="realm-nav-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d={navOpen ? 'm16 5-7 7 7 7' : 'm8 5 7 7-7 7'} />
              </svg>
              <span className="realm-nav-toggle-label">
                {navOpen ? tr('Restrânge', 'Collapse') : tr('Meniu', 'Menu')}
              </span>
            </button>
            {(() => {
              // Realms is the hub: always there, in the middle; the other unlocked buttons share the two sides.
              const side = (
                [
                  [
                    'build',
                    <Nav
                      key="build"
                      icon="build"
                      label={tr('Construiește', 'Build')}
                      onClick={() => setPanel('build')}
                      {...navItem('build')}
                    />,
                  ],
                  [
                    'dino',
                    <Nav
                      key="dino"
                      icon="dino"
                      label={tr('Dinozauri', 'Dinosaurs')}
                      onClick={() => {
                        setDinoRealm(null);
                        setPanel('dino');
                      }}
                      {...navItem('dino')}
                    />,
                  ],
                  [
                    'collection',
                    <Nav
                      key="collection"
                      icon="collection"
                      label={tr('Colecție', 'Collection')}
                      onClick={() => setPanel('collection')}
                      {...navItem('collection')}
                    />,
                  ],
                  [
                    'expedition',
                    <Nav
                      key="expedition"
                      icon="expedition"
                      label={
                        currentTrip(save)
                          ? save.expeditions.some((x) => now >= x.endsAt)
                            ? tr('Expediție gata ✓', 'Expedition back ✓')
                            : tr('În expediție…', 'On expedition…')
                          : tr('Expediții', 'Expeditions')
                      }
                      onClick={() => setPanel('expedition')}
                      {...navItem('expedition')}
                    />,
                  ],
                  [
                    'arena',
                    <Nav
                      key="arena"
                      icon="arena"
                      label={tr('Arena PvE', 'PvE Arena')}
                      onClick={() => setPanel('arena')}
                      {...navItem('arena')}
                    />,
                  ],
                  [
                    'workshop',
                    <Nav
                      key="workshop"
                      icon="workshop"
                      label={tr('Atelier', 'Workshop')}
                      onClick={() => setPanel('workshop')}
                      {...navItem('workshop')}
                    />,
                  ],
                  [
                    'collect',
                    <button
                      key="collect"
                      className={`realm-collect${Math.floor(live.storedGold) > 0 ? '' : ' empty'}`}
                      aria-label={tr('Colectează', 'Collect')}
                      title={tr('Colectează', 'Collect')}
                      onClick={() => {
                        if (run({ type: 'collectAvailable' }))
                          setMessage(tr('Resurse colectate!', 'Resources collected!'));
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
                    </button>,
                  ],
                ] as [NavKey, ReactNode][]
              )
                .filter(([key]) => navKeys.has(key))
                .map(([, el]) => el);
              const half = Math.ceil(side.length / 2);
              return (
                <>
                  {side.slice(0, half)}
                  <Nav
                    key="realms"
                    icon="realms"
                    label={tr('Tărâmuri', 'Realms')}
                    onClick={() => setPanel('realms')}
                    hub
                    {...navItem('realms')}
                  />
                  {side.slice(half)}
                </>
              );
            })()}
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

        {/* The save invitation waits for the first-time guide to finish. */}
        {askAccount && !tour && !panel && !heroVision && (
          <Window
            title={
              askAccount === 'return'
                ? tr('Bine ai revenit!', 'Welcome back!')
                : tr('Salvează-ți progresul', 'Save your progress')
            }
            eyebrow="DINO REALMS"
            close={() => setAskAccount(false)}
          >
            <p className="realm-save-invite">
              {askAccount === 'return'
                ? tr(
                    `Ai ${save.dinos.length} ${save.dinos.length === 1 ? 'dinozaur' : 'dinozauri'}, dar progresul e legat doar de acest browser. Dacă ștergi datele browserului sau schimbi telefonul, se pierde. Creează un cont ca să-l păstrezi.`,
                    `You have ${save.dinos.length} ${save.dinos.length === 1 ? 'dinosaur' : 'dinosaurs'}, but your progress is tied to this browser only. Clearing browser data or switching phones loses it. Create an account to keep it.`,
                  )
                : tr(
                    'Progresul tău e legat doar de acest browser. Creează un cont ca să nu-l pierzi și să-l continui pe orice telefon sau calculator.',
                    'Your progress is tied to this browser only. Create an account to keep it and continue on any phone or computer.',
                  )}
            </p>
            <AccountPanel lang={lang} sync={sync} startWith="signup" intro={false} />
            <button className="realm-link realm-gate-guest" onClick={() => setAskAccount(false)}>
              {tr('Mai târziu', 'Later')}
            </button>
          </Window>
        )}
        {panel && !gameplayView && !heroVision && (
          <Window
            title={
              {
                journey: tr('Jurnalul aventurii', 'Adventure journal'),
                dino: dinoRealm
                  ? `${tr('Habitat', 'Habitat')} · ${REALM_NAMES[dinoRealm][lang]}`
                  : tr('Dinozaurii tăi', 'Your dinosaurs'),
                hatchery: tr('Incubatorul', 'The hatchery'),
                habitat: tr('Habitate', 'Habitats'),
                daily: tr('Premii și misiuni zilnice', 'Daily rewards and missions'),
                market: tr('Piața', 'The market'),
                wiki: 'Wikipedia · Dino Realms',
                farm: tr('Ferma', 'The farm'),
                // Each window is named like the button that opens it, so players know where they are.
                build: tr('Construiește', 'Build'),
                collection: tr('Colecție', 'Collection'),
                realms: tr('Tărâmuri · lumile tale', 'Realms · your worlds'),
                expedition: tr('Prima aventură', 'The first adventure'),
                settings: tr('Setări', 'Settings'),
                account: tr('Cont', 'Account'),
                players: tr('Jucători', 'Players'),
                shop: tr('Magazin', 'Shop'),
                assets: tr('Atelierul vizual', 'The visual workshop'),
                workshop: tr('Atelier', 'Workshop'),
                arena: tr('Arena PvE', 'PvE Arena'),
              }[panel]
            }
            eyebrow="DINO REALMS"
            close={() => setPanel(null)}
            wide={[
              'journey',
              'farm',
              'daily',
              'collection',
              'realms',
              'assets',
              'build',
              'dino',
              'hatchery',
              'market',
              'habitat',
              'wiki',
              'workshop',
              'shop',
            ].includes(panel)}
            fit={panel === 'journey' || FIT_PANELS.includes(panel)}
          >
            {panel === 'journey' && (
              <AdventureJournal
                save={save}
                now={now}
                lang={lang}
                run={run}
                navigate={(route) => {
                  if (route === 'build' && current?.step.building) setHelpBuilding(current.step.building);
                  setPanel(route);
                }}
              />
            )}
            {expeditionPreparation && (
              <button
                className="realm-button secondary realm-back-to-hatchery"
                onClick={() => {
                  setExpeditionPreparation(false);
                  setPanel('expedition');
                }}
              >
                ← {tr('Înapoi la expediție', 'Back to expedition')}
              </button>
            )}
            {panel === 'daily' && (
              <DailyPanel save={save} now={now} lang={lang} run={run} navigate={setPanel} duels={!!account} />
            )}
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
                  if (save.dinos.length === 0) setHeroVision(born);
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
                    setMessage(
                      tr('Ou cumpărat! Incubează-l în incubator.', 'Egg bought! Incubate it in the hatchery.'),
                    );
                  return ok;
                }}
                build={() => {
                  setHelpBuilding('market');
                  setPanel('build');
                }}
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
                previewHero={(dino) => setHeroVision(dino)}
                initialTab={trainAfterVision ? 'grow' : undefined}
                realm={dinoRealm}
                openHabitats={() => setPanel('habitat')}
                fromHatchery={dinoFromHatchery}
              />
            )}
            {panel === 'habitat' && (
              <HabitatsPanel
                save={live}
                now={now}
                lang={lang}
                run={run}
                visit={visitRealm}
                openWorkshop={() => setPanel('workshop')}
                placeLamp={startLampPlacement}
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
              <BuildPanel
                initialKind={helpBuilding}
                save={save}
                lang={lang}
                run={run}
                place={startPlacement}
                placeLamp={startLampPlacement}
                open={(kind) => setPanel(kind === 'portal' ? 'expedition' : kind)}
              />
            )}
            {panel === 'collection' && (
              <DinosaurCollection
                save={save}
                navigate={setPanel}
                lang={lang}
                dinos={save.dinos}
                discovered={save.discovered}
                initialElement={realm === 'home' ? undefined : realm}
                openExpeditions={() => setPanel('expedition')}
                openOwned={(id) => openBuilding(`dino:${id}`)}
                openMarket={() => setPanel('market')}
              />
            )}
            {panel === 'realms' && (
              <RealmsPanel
                key={helpRealm}
                initialRealm={helpRealm}
                save={save}
                now={now}
                lang={lang}
                current={realm}
                visit={visitRealm}
                run={run}
                workshop={() => setPanel('workshop')}
              />
            )}
            {panel === 'wiki' && <RealmsWiki lang={lang} />}
            {panel === 'account' && <AccountPanel lang={lang} sync={sync} startWith={guest ? 'signup' : 'signin'} />}
            {panel === 'players' && account && (
              <PlayersPanel
                lang={lang}
                selfId={account.user.id}
                save={save}
                run={run}
                onVisit={(p, canHelp) => void openVisit(p, canHelp)}
                onChallenge={(p) => void challenge(p)}
                onFriendsChange={() => checkNewsRef.current()}
              />
            )}
            {panel === 'settings' && (
              <div className="realm-settings">
                <div className="realm-setting-row">
                  <span>
                    {tr('Cont', 'Account')}
                    <small>{sync.user?.email ?? statusText(sync.status, lang)}</small>
                  </span>
                  <button className="realm-button secondary" onClick={() => setPanel('account')}>
                    {guest
                      ? tr('Creează cont', 'Create account')
                      : sync.user
                        ? tr('Detalii', 'Details')
                        : tr('Conectează-te', 'Sign in')}
                  </button>
                </div>
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
              </div>
            )}
            {panel === 'shop' && <GemShop save={save} now={now} lang={lang} run={run} />}
            {panel === 'workshop' && (
              <WorkshopPanel
                save={save}
                now={now}
                lang={lang}
                run={run}
                build={() => setPanel('build')}
                recipeId={workshopRecipe}
              />
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
              if (gameplayView === 'expedition' && ['farm', 'dino', 'workshop'].includes(next))
                setExpeditionPreparation(true);
              setPanel(next);
            }}
            build={() => {
              setExpeditionPreparation(gameplayView === 'expedition');
              setPanel('build');
            }}
            prepareSupplies={() => {
              setWorkshopRecipe('provisions');
              setExpeditionPreparation(true);
              setPanel('workshop');
            }}
            initialRecipe={workshopRecipe}
            returnToExpeditions={
              expeditionPreparation
                ? () => {
                    setExpeditionPreparation(false);
                    setPanel('expedition');
                  }
                : undefined
            }
          />
        )}
        {save.battle && !panel && !arenaFight(save.battle.encounterId) && (
          <BattleScreen
            save={save}
            lang={lang}
            run={run}
            close={() => setPanel(save.battle && arenaFight(save.battle.encounterId) ? 'arena' : 'expedition')}
          />
        )}
        {offline &&
          (offline.gold > 0 || offline.food > 0 || offline.jobs > 0) &&
          !panel &&
          !save.battle &&
          !placing && (
            <div className="realm-offline-strip" role="status">
              <div className="offline-head">
                <strong>{tr('Cât timp ai fost plecat', 'While you were away')}</strong>
                <small>{Math.floor(offline.elapsed / 60_000)} min</small>
                <button className="realm-close" onClick={() => setOffline(null)} aria-label={tr('Închide', 'Dismiss')}>
                  <Icon name="close" />
                </button>
              </div>
              <ul className="pk-costs offline-loot">
                <li className="pk-cost" title={tr('Aur', 'Gold')}>
                  <Icon name="gold" scale={1} /> {Math.floor(live.storedGold)}
                </li>
                <li className="pk-cost" title={tr('Hrană', 'Food')}>
                  <Icon name="food" scale={1} /> {farmReadyFood(save, now)}
                </li>
                <li className="pk-cost" title={tr('Atelier', 'Workshop')}>
                  <Icon name="workshop" scale={1} /> {save.crafting.filter((j) => j.endsAt <= now).length}
                </li>
              </ul>
              <button
                className="realm-button"
                onClick={() => {
                  if (run({ type: 'collectAvailable' })) setOffline(null);
                }}
              >
                {tr('Colectează disponibil', 'Collect available')}
              </button>
            </div>
          )}
        {heroVision && (
          <Window
            title={tr('Un erou se trezește', 'A hero awakens')}
            eyebrow="DINO REALMS"
            wide
            close={() => {
              setSelectedDino(heroVision.id);
              setDinoRealm(heroVision.element);
              setHeroVision(null);
              setPanel('dino');
            }}
          >
            <HeroVision
              dino={heroVision}
              lang={lang}
              finish={() => {
                setTrainAfterVision(heroVision.level < 50);
                setSelectedDino(heroVision.id);
                setDinoRealm(heroVision.element);
                setHeroVision(null);
                setPanel('dino');
              }}
            />
          </Window>
        )}
        {tour && (
          <GuidedTour
            key={tour}
            lang={lang}
            done={endTour}
            paused={!!save.battle}
            start={tour === 'fresh' ? tourStart : 0}
            onStep={(i) => {
              if (tour !== 'fresh') return;
              try {
                localStorage.setItem(TOUR_STEP_KEY, String(i));
              } catch {
                /* Optional: a reload then starts the guide over. */
              }
            }}
            steps={[
              {
                title: ['Bun venit în Dino Realms!', 'Welcome to Dino Realms!'],
                body: [
                  tour === 'fresh'
                    ? 'Te ajut să-ți eclozezi primul dinozaur. Urmează pașii și apasă unde clipește. Îl poți închide de la × și relua din meniul profilului.'
                    : 'Un tur scurt al ecranului. Îl poți închide oricând de la ×.',
                  tour === 'fresh'
                    ? "Let's hatch your first dinosaur together. Follow the steps and tap what glows. Close it with × and replay it from the profile menu."
                    : 'A quick tour of the screen. Close it any time with ×.',
                ],
              },
              ...(tour === 'fresh'
                ? ([
                    {
                      target: '.realm-quest .realm-button',
                      prepare: () => setStoryOpen(true),
                      click: true,
                      until: () => tourHatched() || !!document.querySelector('.hatch-shelf, .hatch-nest'),
                      title: ['Hai să începem!', "Let's begin!"],
                      body: ['Apasă „Mergi” ca să deschizi Incubatorul.', 'Tap "Go" to open the Hatchery.'],
                    },
                    {
                      target: '.hatch-shelf .realm-button',
                      prepare: () => setPanel('hatchery'),
                      wait: true,
                      click: true,
                      until: () => tourHatched() || saveRef.current.eggs.some((e) => e.hatchAt !== null),
                      title: ['Oul tău de foc', 'Your fire egg'],
                      body: ['Apasă „Incubează” ca să pui oul la cald.', 'Tap "Incubate" to keep the egg warm.'],
                    },
                    {
                      target: ['.hatch-nest.ready .realm-button', '.hatch-nest.warming .realm-gem-finish'],
                      prepare: () => setPanel('hatchery'),
                      wait: true,
                      click: true,
                      until: tourHatched,
                      title: ['Crapă coaja!', 'Crack the shell!'],
                      body: [
                        'Oul are nevoie de 30 de secunde: așteaptă sau apasă ⚡ ca să-l termini cu un diamant de start, apoi „Eclozează”.',
                        'The egg needs 30 seconds: wait, or tap ⚡ to finish it with a starter diamond, then "Hatch".',
                      ],
                    },
                    {
                      target: ['.hero-vision-primary', '.realm-window:has(.hero-vision)'],
                      wait: true,
                      click: true,
                      // Skipping or closing the vision moves on too.
                      until: () => saveRef.current.dinos.length > 0 && !document.querySelector('.hero-vision'),
                      title: ['O viziune din viitor', 'A vision of the future'],
                      body: [
                        'O luptă dintr-un viitor posibil. Poți sări peste ea. Apoi apasă „Începe antrenamentul”.',
                        'A battle from a possible future. You can skip it. Then tap "Start training".',
                      ],
                    },
                    {
                      target: '.dino-feed-main',
                      prepare: () => setPanel('dino'),
                      wait: true,
                      click: true,
                      until: () => saveRef.current.dinos.some((x) => x.level > 1),
                      title: ['Primul tău dinozaur!', 'Your first dinosaur!'],
                      body: [
                        'Dinozaurii cresc cu hrană. Apasă „Hrănește” ca să urce un nivel.',
                        'Dinosaurs grow on food. Tap "Feed" to raise a level.',
                      ],
                    },
                    {
                      target: '.realm-quest .realm-button',
                      prepare: () => {
                        setPanel(null);
                        setStoryOpen(true);
                      },
                      wait: true,
                      click: true,
                      until: () => saveRef.current.questEggs.includes('c1-hatch'),
                      title: ['Ia-ți premiul', 'Take your reward'],
                      body: [
                        'Aici, în „Povestea ta”, vezi mereu pasul următor. L-ai terminat pe primul: apasă „Ia premiul”.',
                        '"Your story" always shows the next step. You finished the first one: tap "Claim".',
                      ],
                    },
                    {
                      target: '.realm-quest .realm-button',
                      prepare: () => {
                        setPanel(null);
                        setStoryOpen(true);
                        setHelpBuilding('farm');
                      },
                      wait: true,
                      click: true,
                      until: () =>
                        tourBuilt('farm') || placingRef.current || !!document.querySelector('.build-buttons'),
                      title: ['Construiește ferma', 'Build the farm'],
                      body: [
                        'Următorul pas: ferma, care crește hrana dinozaurilor. Apasă „Mergi”.',
                        'Next up: the farm, which grows food for your dinosaurs. Tap "Go".',
                      ],
                    },
                    {
                      target: '.build-buttons .realm-button:not(.secondary)',
                      wait: true,
                      click: true,
                      until: () => tourBuilt('farm') || placingRef.current,
                      rewind: { when: () => !document.querySelector('.realm-window') && !placingRef.current, by: 1 },
                      title: ['Ferma', 'The farm'],
                      body: [
                        'Ferma e deja aleasă. Apasă „Amplasează pe insulă”.',
                        'The farm is already picked. Tap "Place on island".',
                      ],
                    },
                    {
                      until: () => tourBuilt('farm'),
                      rewind: { when: () => !placingRef.current, by: 2 },
                      title: ['Alege un loc pe insulă', 'Pick a spot on the island'],
                      body: [
                        'Apasă pe un loc liber de pe insulă. Verde înseamnă că încape, roșu că e ocupat.',
                        'Tap a free spot on the island. Green means it fits, red means it is taken.',
                      ],
                    },
                    {
                      title: ['Aventura continuă!', 'Your adventure continues!'],
                      body: [
                        'Ferma e gata! De aici te conduce „Povestea ta”: crește-ți companionul până la juvenil și pornește în prima expediție. Steluța „Zilnic” are în fiecare zi roata, misiuni și comori, iar butoanele noi din meniu apar marcate cu „NOU”.',
                        'The farm is up! From here "Your story" leads the way: raise your companion to juvenile and start your first expedition. The "Daily" star has the wheel, missions and treasures every day, and new menu buttons show up marked "NEW".',
                      ],
                    },
                  ] satisfies TourStep[])
                : ([
                    {
                      target: ['.realm-resources', '.realm-mobile-wallet'],
                      title: ['Resursele tale', 'Your resources'],
                      body: [
                        'Aurul construiește, hrana îți crește dinozaurii, iar diamantele termină orice instant. Le vezi mereu sus.',
                        'Gold builds, food grows your dinosaurs, and diamonds finish anything instantly. They are always at the top.',
                      ],
                    },
                    {
                      target: '.realm-nav',
                      prepare: () => setNavOpen(true),
                      title: ['Meniul de jos', 'The bottom menu'],
                      body: [
                        'Clădiri, dinozauri și lumi. Pe măsură ce avansezi apar butoane noi aici, marcate cu „NOU”.',
                        'Buildings, dinosaurs and worlds. More buttons appear here as you progress, marked "NEW".',
                      ],
                    },
                    {
                      target: '.realm-daily-access',
                      title: ['Misiuni zilnice', 'Daily missions'],
                      body: [
                        'În fiecare zi: roata, 3 misiuni, comori și dueluri, toate în „Azi”. Semnul „!” înseamnă un premiu de luat.',
                        'Every day: the wheel, 3 missions, treasures and duels, all under "Today". A "!" means a reward is waiting.',
                      ],
                    },
                    {
                      target: '.realm-quest .realm-button',
                      prepare: () => setStoryOpen(true),
                      title: ['Urmează povestea', 'Follow the story'],
                      body: [
                        'Butonul din „Povestea ta” te duce mereu la pasul următor. Spor la aventură!',
                        'The button in "Your story" always takes you to the next step. Enjoy the adventure!',
                      ],
                    },
                  ] satisfies TourStep[])),
            ]}
          />
        )}
      </main>
    </ResourceHelpContext.Provider>
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
  fresh = false,
  hub = false,
  seen,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  /** The button the story card points to. */
  featured?: boolean;
  /** Unlocked since the player last looked: shows "NOU" until clicked. */
  fresh?: boolean;
  /** The central, always-visible button (the worlds). */
  hub?: boolean;
  seen?: () => void;
}) {
  return (
    <button
      className={`${featured ? 'featured' : ''}${fresh ? ' fresh' : ''}${hub ? ' realm-nav-hub' : ''}`}
      onClick={() => {
        seen?.();
        onClick();
      }}
      aria-label={label}
      title={label}
    >
      <span>
        <Icon name={icon} scale={2} />
      </span>
      <strong>{label}</strong>
      {fresh && <em className="realm-nav-new">NOU</em>}
    </button>
  );
}
