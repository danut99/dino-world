import { ResourceHelpContext } from './ResourceHelp';
import { RealmsPanel } from './RealmsPanel';
import { BuildPanel } from './BuildPanel';
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
import { WorkshopPanel } from './WorkshopPanel';
import { GemShop } from './GemShop';
import { unlockedNav, type NavKey } from './navUnlocks';
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
import { useCloudSync } from './useCloudSync';
import { fetchCloudSave, guestName, signOut, type PlayerSummary } from './cloud';
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
  addGems: 'coin',
  gemFinish: 'pop',
  gemBoost: 'build',
  gemTrade: 'coin',
  gemRest: 'evolve',
  gemSpin: 'spin',
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
  | 'account'
  | 'players'
  | 'shop'
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
export function Window({
  title,
  eyebrow,
  children,
  close,
  wide = false,
  closable = true,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  /** False for a choice the player must make: no close button, Escape and the backdrop do nothing. */
  closable?: boolean;
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
        className={`realm-window ${wide ? 'wide' : ''}`}
        onKeyDown={(e) => {
          if (closable && e.key === 'Escape') close();
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

/**
 * The game. With accounts (`account`), it starts from the save the sign-in gate loaded from the cloud and keeps it
 * only there. Without accounts configured (local development), it keeps the save in this browser as before.
 */
export default function RealmsApp({ initialSave, account, guest = false }: { initialSave?: Save; account?: SignedIn; guest?: boolean } = {}) {
  const [profileOpen, setProfileOpen] = useState(false);
  /** Another player's world being looked at (read only), and which of its worlds is shown. */
  const [visit, setVisit] = useState<{ name: string; save: Save } | null>(null);
  const [visitView, setVisitView] = useState<'home' | RealmId>('home');
  const [save, setSave] = useState(() => (initialSave ? advance(initialSave, Date.now()) : load())),
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
  const [helpRealm, setHelpRealm] = useState<RealmId | undefined>();
  const [helpBuilding, setHelpBuilding] = useState<UtilityKind>('farm');
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
  const gameplayView: GameplayView | null =
    panel === 'expedition' || panel === 'arena' ? panel : null;
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
    () => setMessage(tr('Am adus progresul de pe celălalt dispozitiv.', 'Brought in your progress from your other device.')),
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
    save.cleared.includes('training'),
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
  const dailyReady = today.spin === null || dailyQuests(today.day).some(id => !today.claimed.includes(id) && today.progress[id] >= DAILY_QUESTS[id].target) || (!today.bonus && dailyQuests(today.day).every(id => today.claimed.includes(id)));
  const dailyOpened = useRef<string | null>(null);
  useEffect(() => {
    if (panel || placing || save.battle || save.dinos.length === 0 || dailyOpened.current === today.day) return;
    try {
      if (localStorage.getItem('dino-realms-daily-opened') === today.day) return;
      localStorage.setItem('dino-realms-daily-opened', today.day);
    } catch {
      // The in-memory marker also works when storage is unavailable.
    }
    dailyOpened.current = today.day;
    setPanel('daily');
  }, [today.day, panel, placing, save.battle, save.dinos.length]);
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
    // Signed in, the save lives in the cloud only (useCloudSync).
    if (account) return;
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
        setVisit(null);
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
            gems: tr('Nu ai destule diamante. Vezi Magazinul.', 'Not enough diamonds. Visit the Shop.'),
            rested: tr('Campionul e deja odihnit.', 'Your champion is already rested.'),
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
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  // The header badge follows the chapter: its numeral, rank, title and how far into it the player is.
  const badge = current
    ? {
        numeral: ROMAN[current.chapter.number],
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
  /** Loads another player's save from the cloud and shows their world. */
  const openVisit = async (player: PlayerSummary) => {
    try {
      const remote = await fetchCloudSave(player.user_id);
      if (!remote) {
        setMessage(tr(`${player.name} încă nu și-a construit lumea.`, `${player.name} has not built a world yet.`));
        return;
      }
      setPanel(null);
      setProfileOpen(false);
      setVisitView('home');
      setVisit({ name: player.name, save: advance(remote.save, Date.now()) });
    } catch {
      setMessage(tr('Lumea nu s-a putut încărca. Mai încearcă.', 'That world could not load. Try again.'));
    }
  };

  /** The champion's own portrait (the T-Rex hero before the first hatch). */
  const championArt = d ? <DinosaurArt species={d.species} element={d.element} stage={d.stage} /> : <Hero stage="baby" />;
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
        aria-label={desk ? tr('Profil și setări', 'Profile and settings') : tr('Resurse', 'Resources')}
        aria-expanded={profileOpen}
        aria-controls={id}
        onClick={() => setProfileOpen((open) => !open)}
      >
        {championArt}
        <span>{d?.level ?? 1}</span>
        {guest && <b className="realm-guest-alert" title={tr('Progresul nu e salvat în cont', 'Progress is not saved to an account')}>!</b>}
      </button>
      {profileOpen && (
        <>
          <button className="realm-profile-dismiss" aria-label={tr('Închide', 'Close')} onClick={() => setProfileOpen(false)} />
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
                <button className="realm-hud-menu-shop" onClick={closeThen(() => setPanel('shop'))}>
                  <span className="realm-hud-menu-gem" aria-hidden="true">💎</span>
                  <span>
                    {tr('Magazin', 'Shop')} · {save.gems}
                    <small>{tr('Diamante pentru a avansa mai repede', 'Diamonds to move faster')}</small>
                  </span>
                  <em aria-hidden="true">›</em>
                </button>
                {account && (
                  <button onClick={closeThen(() => setPanel('players'))}>
                    <Icon name="trophy" />
                    <span>
                      {tr('Jucători', 'Players')}
                      <small>{tr('Vizitează lumile altora', "Visit other players' worlds")}</small>
                    </span>
                    <em aria-hidden="true">›</em>
                  </button>
                )}
                <button className={guest ? 'realm-hud-menu-guest' : undefined} onClick={closeThen(() => setPanel('account'))}>
                  <Icon name="shield" />
                  <span>
                    {guest ? tr('Creează cont', 'Create account') : tr('Cont', 'Account')}
                    <small>{guest ? tr('Salvează progresul în cloud', 'Save your progress in the cloud') : tr('Nume, parolă și salvare', 'Name, password and saving')}</small>
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
            <section className="realm-profile-card" id={id} aria-label={tr('Resurse', 'Resources')} onKeyDown={(event) => { if (event.key === 'Escape') setProfileOpen(false); }}>
              <header><strong>{badge.title}</strong><button aria-label={tr('Închide', 'Close')} onClick={() => setProfileOpen(false)}>×</button></header>
              {sync.user?.email && <p className="realm-profile-email">{sync.user.email}</p>}
              <div className="realm-profile-stats">
                <Resource icon="gold" value={Math.floor(save.gold)} label={tr('Aur', 'Gold')} color="gold" />
                <Resource icon="food" value={save.food} label={tr('Hrană', 'Food')} color="food" />
                <Resource icon="star" value={d?.level ?? 1} label={tr('Nivel', 'Level')} color="gold" />
              </div>
              <footer>
                <button onClick={closeThen(() => setPanel('shop'))}>💎 {save.gems} · {tr('Magazin', 'Shop')}</button>
                <button onClick={closeThen(() => { setDinoRealm(null); setPanel('dino'); })}>{tr('Dinozauri', 'Dinosaurs')}</button>
                {account && <button onClick={closeThen(() => setPanel('players'))}>{tr('Jucători', 'Players')}</button>}
                <button onClick={closeThen(() => setPanel('account'))}>{guest ? tr('Creează cont', 'Create account') : tr('Cont', 'Account')}</button>
                <button onClick={closeThen(() => setPanel('settings'))}>{tr('Setări', 'Settings')}</button>
                <button onClick={closeThen(() => setPanel('wiki'))}>Wikipedia</button>
              </footer>
            </section>
          )}
        </>
      )}
    </>
  );
  if (visit) {
    const worlds = ELEMENTS.filter((el) => visit.save.habitats[el.id]);
    return (
      <main className="realms-app realm-visiting">
        {/* The same island renderer as at home, with every action switched off. */}
        <World save={visit.save} realm={visitView} lang={lang} placing={false} moving={null} now={now} onPlace={() => {}} onSelect={() => {}} />
        <section className="realm-visit-bar" aria-label={tr('Vizită', 'Visit')}>
          <div>
            <span className="realm-eyebrow">{tr('ÎN VIZITĂ', 'VISITING')}</span>
            <strong>{tr(`Lumea lui ${visit.name}`, `${visit.name}'s world`)}</strong>
            <small>
              {visitView === 'home' ? tr('Insula principală', 'Main island') : REALM_NAMES[visitView][lang]} · 🦖 {visit.save.dinos.length}
            </small>
          </div>
          <nav aria-label={tr('Lumile lui', 'Their worlds')}>
            <button aria-pressed={visitView === 'home'} onClick={() => setVisitView('home')}>
              🏝 {tr('Insula', 'Island')}
            </button>
            {worlds.map((el) => (
              <button key={el.id} aria-pressed={visitView === el.id} onClick={() => setVisitView(el.id)} title={el.name[lang]}>
                {el.symbol} {el.name[lang]}
              </button>
            ))}
          </nav>
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
    <ResourceHelpContext.Provider value={route => {
      if (route.recipe) setWorkshopRecipe(route.recipe);
      if (route.realm && ELEMENTS.some(e => e.id === route.realm)) setHelpRealm(route.realm as RealmId);
      if (route.building) setHelpBuilding(route.building);
      if (route.panel === 'workshop' && !save.buildings.some(b => b.kind === 'workshop')) { setPanel('build'); return; }
      if (route.panel === 'farm' && !save.buildings.some(b => b.kind === 'farm')) { setPanel('build'); return; }
      setPanel(route.panel);
    }}><main className="realms-app">
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
        cameraAction={!panel && !placing && !save.battle && save.dinos.length > 0 && (
          <button className="realm-daily-access" onClick={() => setPanel('daily')} aria-label={tr('Premii și misiuni zilnice', 'Daily rewards and missions')} title={tr('Zilnic', 'Daily')}>
            <span className="realm-daily-wheel" aria-hidden="true"><span>★</span></span>
            {dailyReady && <b aria-hidden="true">!</b>}
          </button>
        )}
      />
      <div className="realm-mobile-profile">{profileMenu('realm-mobile-stats')}</div>
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
          <button className="realm-resource gems realm-gems-chip" onClick={() => setPanel('shop')} title={tr('Magazin de diamante', 'Diamond shop')}>
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
        <div className="realm-hud-profile">{profileMenu('realm-hud-menu', true)}</div>
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
              <p className="realm-quest-hint">{storyReady ? tr('Gata! Ia-ți recompensa.', 'Done! Take your reward.') : story.hint[lang]}</p>
              {storyProgress && !storyReady && (
                <div className="realm-quest-bar" role="progressbar" aria-valuemin={0} aria-valuemax={storyProgress[1]} aria-valuenow={storyProgress[0]}>
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
                  <li className="egg" title={`${SPECIES_NAMES[story.species]} · ${ELEMENTS.find((e) => e.id === story.element)!.name[lang]}`}>
                    <EggArt species={story.species} realm={story.element} size={22} /> {tr('Ou', 'Egg')}
                  </li>
                )}
              </ul>
              <div className="realm-quest-progress" aria-label={`${storyIndex}/${steps.length}`}>
                {steps.map((q, i) => (
                  <i key={q.id} className={i < storyIndex ? 'done' : i === storyIndex ? 'current' : ''} />
                ))}
              </div>
              {storyReady ? (
                <button className="realm-button" onClick={() => run({ type: 'claimQuestEgg', questId: story.id })}>
                  <Icon name={storyEgg(story) ? 'egg' : 'star'} scale={1} /> {tr('Ia premiul', 'Claim')} <span>→</span>
                </button>
              ) : (
                <button className="realm-button" onClick={() => setPanel(story.panel)}>
                  {tr('Mergi', 'Go')} <span>→</span>
                </button>
              )}
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
          {(() => {
            // Realms is the hub: always there, in the middle; the other unlocked buttons share the two sides.
            const side = ([
              ['build', <Nav key="build" icon="build" label={tr('Construiește', 'Build')} onClick={() => setPanel('build')} {...navItem('build')} />],
              ['dino', <Nav key="dino" icon="dino" label={tr('Dinozauri', 'Dinosaurs')} onClick={() => { setDinoRealm(null); setPanel('dino'); }} {...navItem('dino')} />],
              ['collection', <Nav key="collection" icon="collection" label={tr('Colecție', 'Collection')} onClick={() => setPanel('collection')} {...navItem('collection')} />],
              ['expedition', <Nav
                key="expedition"
                icon="expedition"
                label={
                  save.expedition
                    ? now >= save.expedition.endsAt
                      ? tr('Expediție gata ✓', 'Expedition back ✓')
                      : tr('În expediție…', 'On expedition…')
                    : tr('Expediții', 'Expeditions')
                }
                onClick={() => setPanel('expedition')}
                {...navItem('expedition')}
              />],
              ['arena', <Nav key="arena" icon="arena" label={tr('Arena PvE', 'PvE Arena')} onClick={() => setPanel('arena')} {...navItem('arena')} />],
              ['workshop', <Nav key="workshop" icon="workshop" label={tr('Atelier', 'Workshop')} onClick={() => setPanel('workshop')} {...navItem('workshop')} />],
              ['collect', <button
                key="collect"
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
              </button>],
            ] as [NavKey, ReactNode][]).filter(([key]) => navKeys.has(key)).map(([, el]) => el);
            const half = Math.ceil(side.length / 2);
            return (
              <>
                {side.slice(0, half)}
                <Nav key="realms" icon="realms" label={tr('Tărâmuri', 'Realms')} onClick={() => setPanel('realms')} hub {...navItem('realms')} />
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

      {askAccount && !panel && (
        <Window
          title={askAccount === 'return' ? tr('Bine ai revenit!', 'Welcome back!') : tr('Salvează-ți progresul', 'Save your progress')}
          eyebrow="DINO REALMS"
          close={() => setAskAccount(false)}
        >
          <p className="realm-save-invite">
            {askAccount === 'return'
              ? tr(
                  `Ai ${save.dinos.length} ${save.dinos.length === 1 ? 'dinozaur' : 'dinozauri'}, dar progresul e doar pe acest dispozitiv. Dacă ștergi datele browserului sau schimbi telefonul, se pierde. Creează un cont ca să-l păstrezi.`,
                  `You have ${save.dinos.length} ${save.dinos.length === 1 ? 'dinosaur' : 'dinosaurs'}, but your progress lives on this device only. Clearing browser data or switching phones loses it. Create an account to keep it.`,
                )
              : tr(
                  'Progresul tău e acum doar pe acest dispozitiv. Creează un cont ca să nu-l pierzi și să-l continui pe orice telefon sau calculator.',
                  'Your progress lives on this device only. Create an account to keep it and continue on any phone or computer.',
                )}
          </p>
          <AccountPanel lang={lang} sync={sync} startWith="signup" intro={false} />
          <button className="realm-link realm-gate-guest" onClick={() => setAskAccount(false)}>
            {tr('Mai târziu', 'Later')}
          </button>
        </Window>
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
          wide={['farm', 'daily', 'collection', 'realms', 'assets', 'build', 'dino', 'hatchery', 'market', 'habitat', 'wiki', 'workshop', 'shop'].includes(
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
          {panel === 'build' && <BuildPanel initialKind={helpBuilding} save={save} lang={lang} place={startPlacement} open={kind => setPanel(kind === 'portal' ? 'expedition' : kind)} />}
          {panel === 'collection' && (
            <DinosaurCollection
              lang={lang}
              dinos={save.dinos}
              initialElement={realm === 'home' ? 'fire' : realm}
              openExpeditions={() => setPanel('expedition')}
              openOwned={(id) => openBuilding(`dino:${id}`)}
              openMarket={() => setPanel('market')}
            />
          )}
          {panel === 'realms' && <RealmsPanel key={helpRealm} initialRealm={helpRealm} save={save} lang={lang} current={realm} visit={visitRealm} run={run} workshop={() => setPanel('workshop')} />}
          {panel === 'wiki' && <RealmsWiki lang={lang} />}
          {panel === 'account' && <AccountPanel lang={lang} sync={sync} startWith={guest ? 'signup' : 'signin'} />}
          {panel === 'players' && account && <PlayersPanel lang={lang} selfId={account.user.id} onVisit={(p) => void openVisit(p)} />}
          {panel === 'settings' && (
            <div className="realm-settings">
              <div className="realm-setting-row">
                <span>
                  {tr('Cont', 'Account')}
                  <small>{sync.user?.email ?? statusText(sync.status, lang)}</small>
                </span>
                <button className="realm-button secondary" onClick={() => setPanel('account')}>
                  {guest ? tr('Creează cont', 'Create account') : sync.user ? tr('Detalii', 'Details') : tr('Conectează-te', 'Sign in')}
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
    </main></ResourceHelpContext.Provider>
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
