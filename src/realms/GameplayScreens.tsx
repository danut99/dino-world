import { ResourceHelp, RequirementLink } from './ResourceHelp';
import { WorkshopPanel, time } from './WorkshopPanel';
import { ArenaTicketShop } from './ArenaTicketShop';
import { RarityBadge, rarityClass } from './Rarity';
import { ARENA_BOSSES } from './arenaBosses';
import { PLAYABLE_DINOSAURS, isPlayableDinosaur } from './playableDinosaurs';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ENCOUNTERS, ITEMS, RECIPES, recipeFoodCost, type Encounter, type ItemId } from './content';
import { ExpeditionGuide } from './ExpeditionGuide';
import { expeditionPlan } from './expeditionRules';
import {
  advance,
  ARENA_LEVELS,
  BALANCE,
  champion,
  EGG_DROP,
  eggOdds,
  ELEMENTS,
  GATE_LEAGUES,
  HABITAT_LEVELS,
  WORKSHOP_LEVELS,
  rarityOf,
  STARS_TO_ADVANCE,
  TIRED_MS,
  STAR_MILESTONES,
  battleEdge,
  isTired,
  starTotal,
  command,
  opponentAdult,
  foeHasUltimate,
  workshop,
  SPECIES_NAMES,
  REALM_NAMES,
  type Command,
  type RealmId,
  type Save,
  type Species,
} from './game';
import { DinosaurArt } from './DinosaurArt';
import { loadAnimation, loadBossAnimation, loadSpriteImage, type Clip } from './animation';
import { entrance, exchange, fighter, rest, runMs, type BattleAction, type Fighter, type Step, type Unit } from './battleChoreography';
import { useReducedMotion } from './useMotion';
import { playSound } from './sound';
import { worldThumb } from './worldArt';
import { ArenaOpponent } from './ArenaOpponent';
import { arenaBoss } from './arenaBosses';
import { autoAction, predictFight } from './autoBattle';
import { calloutText } from './battleCallouts';
import { UpgradeCard } from './UpgradeCard';
import './gameplay.css';
import { Icon } from './ui/Icon';
import { AnimatedWorkshopSprite } from './AnimatedWorkshopSprite';
import { WORKSHOP_STATES } from './workshopTiers';
export type GameplayView = 'expedition' | 'arena' | 'workshop';
/** Every fight has its own opponent: expeditions use their world's element; arena leagues are generated below. */
/** Each expedition's resident, by the destination's element (the chain follows the realms, fire first). */
const OPPONENTS: Record<string, [Species, RealmId]> = {
  training: ['ankylosaurus', 'fire'],
  'arena-water-1': ['raptor', 'water'],
  'arena-water-2': ['thalassaur', 'water'],
  'arena-earth-1': ['raptor', 'earth'],
  'arena-earth-2': ['terrasaur', 'earth'],
  'arena-nature-1': ['triceratops', 'nature'],
  ruins: ['raptor', 'water'],
  canyon: ['triceratops', 'earth'],
  frost: ['raptor', 'nature'],
  lagoon: ['brachiosaurus', 'ice'],
  wind: ['trex', 'lightning'],
  thunder: ['triceratops', 'wind'],
  twilight: ['raptor', 'dark'],
  dawn: ['brachiosaurus', 'light'],
  sigils: ['ankylosaurus', 'arcane'],
};
export function opponentOf(encounter: Encounter) {
  const tier = Number(encounter.id.split('-')[2] ?? 1) - 1,
    league = ELEMENTS.findIndex((e) => e.id === encounter.league);
  // Keep existing league rotations stable when adding the new earth family.
  const rotation: Species[] = ['trex', 'raptor', 'triceratops', 'ankylosaurus', 'brachiosaurus', 'ignasaur', 'thalassaur'];
  const [species, element] =
    OPPONENTS[encounter.id] ??
    (league >= 0 ? [rotation[(league + tier * 2) % rotation.length], encounter.league as RealmId] : ['raptor', 'ice']);
  const animated = isPlayableDinosaur(species, element) ? { species, element }
    : PLAYABLE_DINOSAURS.find(d => d.element === element) ?? PLAYABLE_DINOSAURS[(Math.max(0, league) + tier) % PLAYABLE_DINOSAURS.length];
  return {
    species: animated.species,
    element: animated.element,
    stage: opponentAdult(encounter) ? ('adult' as const) : ('juvenile' as const),
    info: ELEMENTS.find((e) => e.id === animated.element)!,
  };
}
type Props = {
  save: Save;
  now: number;
  lang: number;
  run: (c: Command) => boolean;
  close: () => void;
  navigate: (v: GameplayView | 'dino' | 'farm') => void;
  build: () => void;
  prepareSupplies?: () => void;
  initialRecipe?: string;
  returnToExpeditions?: () => void;
};
const T = (lang: number, ro: string, en: string) => (lang ? en : ro);
/** Three star slots, the earned ones filled. */
const starRow = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
/** The element edge as a short badge: an arrow and a word. */
function EdgeBadge({ edge, lang }: { edge: -1 | 0 | 1; lang: number }) {
  return (
    <span className={`edge-badge edge-${edge > 0 ? 'up' : edge < 0 ? 'down' : 'even'}`}>
      {edge > 0 ? `▲ ${T(lang, 'Avantaj', 'Advantage')}` : edge < 0 ? `▼ ${T(lang, 'Dezavantaj', 'Disadvantage')}` : `● ${T(lang, 'Neutru', 'Neutral')}`}
    </span>
  );
}
function Frame({
  title,
  view,
  children,
  close,
  navigate,
  lang,
}: {
  title: string;
  view: GameplayView | 'battle';
  children: ReactNode;
  close: () => void;
  navigate?: Props['navigate'];
  lang: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => before?.focus();
  }, []);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`gameplay-screen gameplay-${view}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') {
          const list = [
              ...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,a[href]') ?? []),
            ],
            first = list[0],
            last = list.at(-1);
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
      <header className="gameplay-header">
        <button onClick={close} className="gameplay-back">
          ← <span>{T(lang, 'Insula', 'Island')}</span>
        </button>
        <div>
          <span className="realm-eyebrow">DINO REALMS</span>
          <h1>{title}</h1>
        </div>
        {navigate && (
          <nav>
            {(['expedition', 'arena', 'workshop'] as const).map((v, i) => (
              <button
                className={view === v ? 'active' : ''}
                key={v}
                onClick={() => navigate(v)}
                aria-label={
                  [
                    T(lang, 'Expediții', 'Expeditions'),
                    T(lang, 'Arena PvE', 'PvE Arena'),
                    T(lang, 'Atelier', 'Workshop'),
                  ][i]
                }
              >
                {['⌘', '⚔', '⚒'][i]}{' '}
                <span>
                  {
                    [
                      T(lang, 'Expediții', 'Expeditions'),
                      T(lang, 'Arena PvE', 'PvE Arena'),
                      T(lang, 'Atelier', 'Workshop'),
                    ][i]
                  }
                </span>
              </button>
            ))}
          </nav>
        )}
        <button onClick={close} className="gameplay-close" aria-label="Close">
          <Icon name="close" />
        </button>
      </header>
      {children}
    </section>
  );
}
function Team({ save, lang }: Pick<Props, 'save' | 'lang'>) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const hero = champion(save);
  return (
    <div className="gameplay-team">
      <div className="gameplay-section-label">
        {tr('ECHIPA TA', 'YOUR TEAM')} <small>{hero ? '1' : '0'} / 3</small>
      </div>
      <div className="gameplay-team-slots">
        <div className={hero ? 'occupied' : ''}>
          {hero ? (
            <>
              <DinosaurArt species={hero.species} element={hero.element} stage={hero.stage} className={rarityClass(hero.rarity)} />
              <strong>
                {hero.nickname} · {hero.level}
                <RarityBadge rarity={rarityOf(hero)} lang={lang} short />
              </strong>
              <i />
            </>
          ) : (
            <span>＋</span>
          )}
        </div>
        {[1, 2].map((i) => (
          <div key={i}>
            <span>＋</span>
            <small>{tr('Nerecrutat', 'Not recruited')}</small>
          </div>
        ))}
      </div>
      <p className="gameplay-small">
        {tr(
          'Traseu solo 1v1. Celelalte familii de eroi sunt în lucru.',
          'Solo 1v1 path. Other hero families are in development.',
        )}
      </p>
    </div>
  );
}
function Rewards({
  encounter,
  repeat,
  lang,
  bonus = 0,
  eggChance,
}: {
  encounter: Encounter;
  repeat: boolean;
  lang: number;
  bonus?: number;
  /** Chance that a win drops an egg; undefined when this fight never drops one. */
  eggChance?: number;
}) {
  const boost = (n: number) => Math.round(n * (1 + bonus));
  return (
    <div className="gameplay-rewards">
      <span>
        <b className="gold">●</b>
        {boost(repeat ? 50 : encounter.gold)}
        <small>{T(lang, 'Aur', 'Gold')}</small>
      </span>
      <span>
        <b className="food">❧</b>
        {boost(repeat ? 25 : encounter.food)}
        <small>{T(lang, 'Hrană', 'Food')}</small>
      </span>
      {(Object.entries(encounter.materials) as [ItemId, number][]).map(([id, count]) => (
        <span key={id}>
          <b style={{ color: ITEMS[id].color }}>{ITEMS[id].icon}</b>
          {boost(repeat ? Math.max(1, Math.floor(count / 4)) : count)}
          <small>{ITEMS[id].name[lang]}</small>
        </span>
      ))}
      {eggChance !== undefined && (
        <span className="reward-egg">
          <b><Icon name="egg" scale={1} /></b>
          {Math.round(eggChance * 100)}%<small>{T(lang, 'Șansă de ou', 'Egg chance')}</small>
        </span>
      )}
    </div>
  );
}
export function GameplayScreen(props: Props & { view: GameplayView }) {
  const { view, save, now, lang, run, close, navigate, build } = props;
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const [league, setLeague] = useState<RealmId>('fire');
  const [ticketShop, setTicketShop] = useState(false);
  const [selected, setSelected] = useState('training'),
    [recipeId, setRecipe] = useState('planks');
  const detailRef = useRef<HTMLElement>(null);
  const selectDestination = (id: string) => {
    setSelected(id);
    if (window.matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    try { localStorage.setItem('dino-expedition-destination', id); } catch { /* Optional navigation memory. */ }
  };
  useEffect(() => {
    if (view === 'workshop') setRecipe(props.initialRecipe ?? 'planks');
  }, [view, props.initialRecipe]);
  useEffect(() => {
    if (view !== 'workshop') return;
    const frame = requestAnimationFrame(() => document.querySelector('.craft-card.focus')?.scrollIntoView({ block: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [view, recipeId]);
  const mapRef = useRef<HTMLDivElement>(null),
    mapDrag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(1),
    [mapPan, setMapPan] = useState({ x: 0, y: 0 }),
    [mapSize, setMapSize] = useState({ width: 1, height: 1 });
  const mapPosition = {
    x: Math.max((-mapSize.width * (mapZoom - 1)) / 2, Math.min((mapSize.width * (mapZoom - 1)) / 2, mapPan.x)),
    y: Math.max((-mapSize.height * (mapZoom - 1)) / 2, Math.min((mapSize.height * (mapZoom - 1)) / 2, mapPan.y)),
  };
  useEffect(() => {
    const map = mapRef.current;
    if (!map || view !== 'expedition') return;
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
    const observer = new ResizeObserver(() => setMapSize({ width: map.clientWidth, height: map.clientHeight }));
    observer.observe(map);
    return () => observer.disconnect();
  }, [view]);
  useEffect(() => {
    setTicketShop(false);
    if (view === 'expedition') {
      let id = save.expedition?.encounterId ?? ENCOUNTERS.find(e => e.mode === 'expedition' && !save.cleared.includes(e.id))?.id ?? 'training';
      try {
        const remembered = localStorage.getItem('dino-expedition-destination');
        if (ENCOUNTERS.some(e => e.mode === 'expedition' && e.id === remembered)) id = remembered!;
      } catch { /* Optional navigation memory. */ }
      setSelected(id);
      return;
    }
    const ongoing = view === 'arena' ? ENCOUNTERS.find(e => e.id === save.battle?.encounterId && e.mode === 'arena') : undefined;
    setSelected(ongoing?.id ?? (view === 'arena' ? 'arena-fire-1' : 'training'));
    setLeague((ongoing?.league ?? 'fire') as RealmId);
  }, [view]);
  const gateOpen = (id: RealmId) => !GATE_LEAGUES.includes(id) || save.arenaLevel >= 2;
  const leagueOpen = (id: RealmId) => !!save.habitats[id] && gateOpen(id);
  const leagueEncounters = ENCOUNTERS.filter((e) => e.mode === 'arena' && e.league === league);
  const encounter = ENCOUNTERS.find((e) => e.id === selected && e.mode === view)
      ?? ENCOUNTERS.find((e) => e.mode === (view === 'arena' ? 'arena' : 'expedition'))!,
    repeat = save.cleared.includes(encounter.id);
  const expedition = view === 'expedition' ? expeditionPlan(save, encounter.id) : null;
  const hasBuilding = save.buildings.some(
    (b) => b.kind === (view === 'workshop' ? 'workshop' : view === 'arena' ? 'arena' : 'portal'),
  );
  const starsLocked = encounter.mode === 'arena' && !!encounter.requires && (save.stars[encounter.requires] ?? 0) < STARS_TO_ADVANCE;
  const locked =
    (encounter.mode !== 'arena' && !!encounter.requires && !save.cleared.includes(encounter.requires)) ||
    starsLocked ||
    (!!encounter.league && !leagueOpen(encounter.league as RealmId));
  const hero = champion(save);
  const canBattle =
    !!hero &&
    hero.stage !== 'baby' &&
    hero.level >= encounter.level &&
    !locked &&
    (encounter.id === 'training' || hasBuilding) &&
    (encounter.mode !== 'arena' || (save.arenaTickets[encounter.league as RealmId] ?? 0) > 0);
  const arenaBattle = view === 'arena' && !!save.battle?.encounterId.startsWith('arena');
  const rewards = (
    <>
      <div className="gameplay-section-label">
        {tr('RECOMPENSE', 'REWARDS')}{' '}
        <small>{repeat ? tr('REJUCARE', 'REPLAY') : expedition ? tr('ACEASTĂ ETAPĂ', 'THIS STAGE') : tr('PRIMA VICTORIE', 'FIRST VICTORY')}</small>
      </div>
      <Rewards
        encounter={expedition && !repeat ? { ...encounter,
          gold: Math.max(1, Math.floor(encounter.gold / expedition.total)),
          food: Math.max(1, Math.floor(encounter.food / expedition.total)),
          materials: Object.fromEntries(Object.entries(encounter.materials).map(([id, n]) => [id, Math.max(1, Math.floor(n! / expedition.total))])),
        } : encounter}
        repeat={repeat}
        lang={lang}
        eggChance={expedition && expedition.stage < expedition.total - 1 ? undefined : save.eggLuck >= EGG_DROP.pity ? 1 : eggOdds(save, encounter, !repeat)?.chance}
        bonus={encounter.mode === 'arena' ? ARENA_LEVELS[save.arenaLevel - 1].bonus : 0}
      />
    </>
  );
  const start = () => {
    if (save.battle || run({ type: 'battle', encounterId: encounter.id })) {
      if (view !== 'arena' || (save.battle && !arenaBattle)) close();
    }
  };
  // Expeditions are timed trips: the champion leaves, and its rewards are collected when it is back.
  const ready = advance(save, now);
  const activeJobs = save.crafting.filter((j) => j.endsAt > now).length;
  return (
    <Frame
      title={
        view === 'expedition'
          ? tr('Expediții', 'Expeditions')
          : view === 'arena'
            ? tr('Arena PvE', 'PvE Arena')
            : tr('Atelierul', 'The workshop')
      }
      view={view}
      close={close}
      navigate={navigate}
      lang={lang}
    >
      {view === 'arena' && !arenaBattle && !ticketShop && <div className="arena-access-bar">
        <span>🎟 {ELEMENTS.find(e => e.id === league)!.name[lang]} · {tr('Tichete', 'Tickets')}: <b>{save.arenaTickets[league] ?? 0}</b></span>
        <button className="realm-button" onClick={() => setTicketShop(true)}>{tr('Cumpără tichete', 'Buy tickets')}</button>
      </div>}
      {view === 'arena' && ticketShop && !arenaBattle ? <ArenaTicketShop save={save} lang={lang} run={run} back={() => setTicketShop(false)} /> : view === 'workshop' ? (
        <WorkshopPanel
          save={save}
          now={now}
          lang={lang}
          run={run}
          build={build}
          recipeId={recipeId}
          returnToExpeditions={props.returnToExpeditions}
        />
      ) : (
        <div className={`adventure-layout ${arenaBattle ? 'battle-focus' : ''}`}>
          <div
            ref={mapRef}
            className={view === 'arena' ? 'arena-lobby-scene' : 'adventure-map'}
            onPointerDown={(e) => {
              if (view !== 'expedition' || (e.target as HTMLElement).closest('button')) return;
              if (window.matchMedia('(max-width: 760px), (max-height: 500px) and (orientation: landscape) and (max-width: 1050px)').matches) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              mapDrag.current = { x: e.clientX, y: e.clientY, px: mapPosition.x, py: mapPosition.y };
            }}
            onPointerMove={(e) => {
              const drag = mapDrag.current;
              if (drag) setMapPan({ x: drag.px + e.clientX - drag.x, y: drag.py + e.clientY - drag.y });
            }}
            onPointerUp={() => {
              mapDrag.current = null;
            }}
            onPointerCancel={() => {
              mapDrag.current = null;
            }}
          >
            {arenaBattle ? (
              <BattleScreen save={save} lang={lang} run={run} close={close} embedded />
            ) : view === 'expedition' ? (
              <>
                <div
                  className="adventure-map-plane"
                  data-map-zoom={mapZoom}
                  style={{ transform: `translate(${mapPosition.x}px, ${mapPosition.y}px) scale(${mapZoom})` }}
                >
                  <svg className="adventure-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M20 75 Q25 65 37 62 Q50 65 65 75 L49 85 L64 45 M37 62 L78 23 L86 44 M37 62 L45 20 L20 18 M37 62 L14 48" />
                  </svg>
                  {ENCOUNTERS.filter((e) => e.mode === 'expedition').map((e, i) => (
                    <button
                      key={e.id}
                      className={`adventure-node ${e.id === selected ? 'selected' : ''} ${save.cleared.includes(e.id) ? 'cleared' : ''} ${e.requires && !save.cleared.includes(e.requires) ? 'locked' : ''}`}
                      style={{ left: `${e.x}%`, top: `${e.y}%` }}
                      onClick={() => {
                        selectDestination(e.id);
                        if (window.matchMedia('(max-width: 760px), (max-height: 500px) and (orientation: landscape) and (max-width: 1050px)').matches) {
                          mapRef.current?.nextElementSibling?.scrollIntoView({ block: 'start' });
                        }
                      }}
                      aria-label={e.name[lang]}
                    >
                      <span>
                        {save.cleared.includes(e.id) ? '✓' : ELEMENTS.find((el) => el.id === e.image)?.symbol}
                      </span>
                      <strong>
                        {ELEMENTS.find((el) => el.id === e.image)?.name[lang]}
                        <small>{e.name[lang]} · {save.cleared.includes(e.id) ? '✓' : `${save.expeditionProgress[e.id] ?? 0}/${e.id === 'training' ? 1 : 3}`}</small>
                      </strong>
                    </button>
                  ))}
                </div>
                <div className="map-caption">
                  <span className="realm-eyebrow">{tr('CAPITOLUL I', 'CHAPTER I')}</span>
                  <h2>{tr('Zece lumi. O singură aventură.', 'Ten worlds. One adventure.')}</h2>
                  <p>
                    {save.cleared.filter((id) => ENCOUNTERS.find((e) => e.id === id)?.mode === 'expedition').length} /
                    10 {tr('regiuni explorate', 'regions explored')}
                  </p>
                </div>
                <div className="adventure-map-controls">
                  <button
                    onClick={() => setMapZoom((z) => Math.min(3, z + 1))}
                    disabled={mapZoom === 3}
                    aria-label="Zoom map in"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setMapZoom((z) => Math.max(1, z - 1))}
                    disabled={mapZoom === 1}
                    aria-label="Zoom map out"
                  >
                    −
                  </button>
                  <button
                    onClick={() => {
                      setMapZoom(1);
                      setMapPan({ x: 0, y: 0 });
                    }}
                    aria-label="Show all worlds"
                  >
                    ⌖
                  </button>
                  <span>{tr('Mărește și trage pentru explorare', 'Zoom and drag to explore')}</span>
                </div>
              </>
            ) : (
              <>
                <div className="arena-challenge-title">
                  <span className="realm-eyebrow">PVE · {tr('PROVOCARE SOLO', 'SOLO CHALLENGE')}</span>
                  <h2>{encounter.name[lang]}</h2>
                  {arenaBoss(encounter) && (
                    <strong className="arena-boss-name">{arenaBoss(encounter)!.name} · BOSS</strong>
                  )}
                  <p>{tr('Fără pierderea permanentă a eroilor', 'Your heroes always return safely')}</p>
                </div>
                <div className="battle-stage arena-preview-stage">
                <ArenaOpponent
                  encounter={encounter}
                  key={encounter.id}
                  className="arena-lobby-enemy"
                  species={opponentOf(encounter).species}
                  element={opponentOf(encounter).element}
                  stage={opponentOf(encounter).stage}
                />
                </div>
                <div className="arena-leagues" aria-label={tr('Ligi', 'Leagues')}>
                  {ELEMENTS.map((e) => (
                    <button
                      key={e.id}
                      aria-pressed={league === e.id}
                      disabled={!leagueOpen(e.id)}
                      title={
                        leagueOpen(e.id)
                          ? e.name[lang]
                          : !save.habitats[e.id]
                            ? tr('Deblochează lumea ca să deschizi liga', 'Unlock the world to open this league')
                            : tr('Îmbunătățește Poarta arenei la nivelul 2', 'Upgrade the Arena Gate to level 2')
                      }
                      style={{ '--league-color': e.color } as React.CSSProperties}
                      onClick={() => {
                        setLeague(e.id);
                        setSelected(ENCOUNTERS.find((x) => x.mode === 'arena' && x.league === e.id)!.id);
                      }}
                    >
                      {leagueOpen(e.id) ? e.symbol : '🔒'} {e.name[lang]}
                      <small>
                        {
                          ENCOUNTERS.filter(
                            (x) => x.mode === 'arena' && x.league === e.id && save.cleared.includes(x.id),
                          ).length
                        }
                        /3
                      </small>
                    </button>
                  ))}
                </div>
                <div className="arena-ladder">
                  {leagueEncounters.map((e, i) => (
                    <button
                      onClick={() => setSelected(e.id)}
                      className={selected === e.id ? 'selected' : ''}
                      key={e.id}
                    >
                      <span className="arena-tier-stars" title={`${save.stars[e.id] ?? 0} / 3`}>
                        {save.stars[e.id] ? starRow(save.stars[e.id]) : `0${i + 1}`}
                      </span>
                      <strong>
                        {e.name[lang]}
                        {arenaBoss(e) && <em className="arena-boss-tag"> · BOSS</em>}
                      </strong>
                      <small>
                        {tr('Nivel', 'Level')} {e.level}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside ref={detailRef} className={`adventure-detail${view === 'expedition' ? ' expedition-detail' : ''}`}>
            <div
              className="destination-cover"
              style={{ backgroundImage: `url('${worldThumb(encounter.image as RealmId)}')` }}
            >
              <span>{encounter.name[lang]}</span>
              {view === 'expedition' && (
                <em>
                  {ELEMENTS.find((e) => e.id === encounter.image)?.symbol} {REALM_NAMES[encounter.image as RealmId]?.[lang]}
                </em>
              )}
            </div>
            <div className="adventure-detail-body">
              {view === 'expedition' && <ExpeditionGuide
                save={save} now={now} lang={lang} destination={encounter.id}
                select={selectDestination} run={run} navigate={navigate} build={build}
                prepareSupplies={props.prepareSupplies ?? (() => navigate('workshop'))}
                rewards={rewards}
              />}
              {view === 'expedition' && (
                <button className="realm-button secondary mobile-destination-picker" onClick={() => mapRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
                  ↓ {tr('Toate destinațiile', 'All destinations')}
                </button>
              )}
              {view !== 'expedition' && rewards}
              {view !== 'expedition' && <Team save={save} lang={lang} />}
              {view !== 'expedition' && (
              <div className="encounter-condition">
                {opponentOf(encounter).info.symbol}{' '}
                {arenaBoss(encounter)
                  ? `BOSS ${arenaBoss(encounter)!.name} · ${SPECIES_NAMES[opponentOf(encounter).species]}`
                  : `${SPECIES_NAMES[opponentOf(encounter).species]} ${opponentOf(encounter).info.name[lang]}`}{' '}
                · {tr('Nivel recomandat', 'Recommended level')} {encounter.level}
                <br />
                {tr('Rol', 'Role')}: {opponentOf(encounter).info.role[lang]}
              </div>
              )}
              {view !== 'expedition' && locked && (
                <p className="gameplay-warning">
                  {starsLocked
                    ? tr(`Ai nevoie de ${STARS_TO_ADVANCE}★ la treapta precedentă.`, `You need ${STARS_TO_ADVANCE}★ on the previous tier.`)
                    : tr('Câștigă mai întâi întâlnirea precedentă.', 'Win the previous encounter first.')}
                </p>
              )}
              {view === 'arena' && hero && (
                <ArenaOutlook save={save} encounterId={encounter.id} now={now} lang={lang} />
              )}
              {view !== 'expedition' && (!hero || hero.stage === 'baby') ? (
                <p className="gameplay-warning">
                  {hero
                    ? tr(
                        `${hero.nickname} e încă pui. Hrănește-l până la nivelul 9 și evoluează-l în juvenil ca să lupte.`,
                        `${hero.nickname} is still a baby. Feed him to level 9 and evolve him into a juvenile to fight.`,
                      )
                    : tr('Eclozează primul ou ca să ai un luptător.', 'Hatch your first egg to get a fighter.')}
                  {hero && (
                    <button className="realm-button secondary gameplay-warning-action" onClick={() => navigate('dino')}>
                      {tr('Crește-l acum', 'Raise him now')} →
                    </button>
                  )}
                </p>
              ) : null}
              {view !== 'expedition' && !hasBuilding && encounter.id !== 'training' && (
                <p className="gameplay-warning">
                  {view === 'arena'
                    ? tr('Construiește Poarta arenei pe insula principală ca să lupți aici.', 'Build the Arena Gate on the main island to fight here.')
                    : tr('Construiește Portalul de expediții pe insula principală.', 'Build the Expedition Portal on the main island.')}
                </p>
              )}
              {view !== 'expedition' && (
                <>
                {!hero && <RequirementLink title={tr('Ai nevoie de un campion', 'A champion is required')} detail={tr('Eclozează un dinozaur în Incubator.', 'Hatch a dinosaur in the Hatchery.')} route={{ panel: 'hatchery' }} />}
                {hero && hero.level < encounter.level && <RequirementLink title={tr(`Nivel necesar: ${encounter.level}`, `Required level: ${encounter.level}`)} detail={tr('Hrănește și evoluează campionul.', 'Feed and evolve your champion.')} route={{ panel: 'dino' }} />}
                {hero && (save.tired[hero.id] ?? 0) > now && <RequirementLink title={tr('Campionul se odihnește', 'Champion is resting')} detail={tr('Alege alt campion sau așteaptă terminarea odihnei.', 'Choose another champion or wait for recovery.')} route={{ panel: 'dino' }} />}
                {view === 'arena' && !save.battle && <div className="arena-entry-ticket">
                  <span>🎟 {tr('Acces', 'Entry')}: 1 {tr('tichet', 'ticket')} {ELEMENTS.find(e => e.id === league)!.name[lang]} · {tr('Deținute', 'Owned')}: {save.arenaTickets[league] ?? 0}</span>
                  {(save.arenaTickets[league] ?? 0) === 0 && <button className="realm-button secondary" onClick={() => setTicketShop(true)}>{tr('Ai nevoie de un tichet · Cumpără', 'A ticket is required · Buy')}</button>}
                </div>}
              <button className="realm-button adventure-start" disabled={arenaBattle || (!save.battle && !canBattle)} onClick={start}>
                  {arenaBattle ? tr('Luptă în desfășurare', 'Battle in progress') : save.battle ? tr('Reia lupta', 'Resume battle') : tr('Începe aventura', 'Begin adventure')} →
                </button>
                </>
              )}
              {view !== 'expedition' && !hasBuilding && encounter.id !== 'training' && (
                <button className="realm-link" onClick={build}>
                  {view === 'arena'
                    ? tr('Construiește Poarta arenei', 'Build the Arena Gate')
                    : tr('Construiește Portalul de expediții', 'Build the Expedition Portal')}
                </button>
              )}
              {view === 'arena' && hasBuilding && (
                <UpgradeCard
                  save={save}
                  lang={lang}
                  level={save.arenaLevel}
                  max={ARENA_LEVELS.length}
                  next={[
                    <>
                      ● <b>+{Math.round((ARENA_LEVELS[save.arenaLevel]?.bonus ?? 0) * 100)}%</b>{' '}
                      {tr('aur, hrană și materiale din arenă', 'arena gold, food and materials')}
                    </>,
                    <>
                      ♜ {tr('Deschide ultimele 5 ligi', 'Opens the last 5 leagues')} (
                      {GATE_LEAGUES.map((id) => ELEMENTS.find((e) => e.id === id)!.symbol).join(' ')})
                    </>,
                  ]}
                  gold={ARENA_LEVELS[save.arenaLevel]?.gold ?? 0}
                  materials={ARENA_LEVELS[save.arenaLevel]?.materials ?? {}}
                  upgrade={() => run({ type: 'upgradeArena' })}
                />
              )}
            </div>
          </aside>
        </div>
      )}
    </Frame>
  );
}
/**
 * What the champion can expect in this arena fight: its element edge, how hard the fight will be (played in
 * advance by the same rules), the stars it holds, and how long it still rests after a defeat.
 */
function ArenaOutlook({ save, encounterId, now, lang }: { save: Save; encounterId: string; now: number; lang: number }) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const hero = champion(save)!;
  const edge = battleEdge(encounterId, hero);
  const tiredFor = (save.tired[hero.id] ?? 0) - now;
  const forecast = useMemo(
    () => (tiredFor > 0 ? null : predictFight(save, encounterId, now)),
    // The forecast depends on the champion and the fight, not on the ticking clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [encounterId, hero.id, hero.level, hero.stage, tiredFor > 0, save.stars],
  );
  const total = starTotal(save);
  const next = STAR_MILESTONES[save.starMilestones];
  const verdict = !forecast
    ? null
    : !forecast.win
      ? { cls: 'hard', text: tr('Foarte greu · ar pierde acum', 'Very hard · would lose now') }
      : forecast.stars === 3
        ? { cls: 'easy', text: tr('Ușor', 'Easy') }
        : forecast.stars === 2
          ? { cls: 'even', text: tr('Echilibrat', 'Balanced') }
          : { cls: 'tough', text: tr('Greu · la limită', 'Tough · a close call') };
  return (
    <div className="arena-outlook">
      <div className="arena-outlook-row">
        <span>
          {hero.nickname} · {ELEMENTS.find((e) => e.id === hero.element)!.symbol}
        </span>
        <EdgeBadge edge={edge} lang={lang} />
      </div>
      {tiredFor > 0 ? (
        <p className="gameplay-warning">
          {tr(`${hero.nickname} se odihnește după înfrângere încă`, `${hero.nickname} is resting after the defeat for`)} {time(tiredFor)}.{' '}
          {tr('Poți alege alt campion.', 'You can pick another champion.')}
        </p>
      ) : (
        verdict && (
          <div className={`arena-forecast forecast-${verdict.cls}`}>
            <strong>{verdict.text}</strong>
            {forecast!.win && <small>{tr('Estimare', 'Forecast')}: {starRow(forecast!.stars)}</small>}
          </div>
        )
      )}
      {edge < 0 && (
        <small className="arena-outlook-hint">
          {tr('Un dinozaur de alt element s-ar descurca mai bine aici.', 'A dinosaur of another element would fare better here.')}
        </small>
      )}
      <small className="arena-outlook-stars">
        ★ {total} / 90
        {next && ` · ${tr('următoarea recompensă la', 'next reward at')} ${next.stars}★`}
        {save.stars[encounterId] ? ` · ${tr('aici', 'here')} ${starRow(save.stars[encounterId])}` : ''}
      </small>
    </div>
  );
}
export function BattleScreen({ save, lang, run, close, embedded = false }: Pick<Props, 'save' | 'lang' | 'run' | 'close'> & { embedded?: boolean }) {
  const battle = save.battle!,
    d = save.dinos.find((x) => x.id === battle.dinoId)!,
    el = ELEMENTS.find((e) => e.id === d.element)!,
    encounter = ENCOUNTERS.find((e) => e.id === battle.encounterId)!,
    foe = opponentOf(encounter),
    boss = arenaBoss(encounter);
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const alive = { ally: battle.hp > 0, enemy: battle.enemy > 0 };
  // The reducer resolves a round instantly; the screen replays it beat by beat with the clips each fighter owns.
  const [fighters, setFighters] = useState<{ ally: Fighter; enemy: Fighter } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState({ hp: battle.hp, enemy: battle.enemy });
  const seenRound = useRef(battle.round);
  // ×2 speeds up every layer of the replay (beats, body motion, sprite frames, callouts); remembered per player.
  const [speed, setSpeed] = useState<1 | 2>(() => {
    try {
      return localStorage.getItem('dino-realms-battle-speed') === '2' ? 2 : 1;
    } catch {
      return 1;
    }
  });
  const toggleSpeed = () =>
    setSpeed((v) => {
      const next = v === 2 ? 1 : 2;
      try {
        localStorage.setItem('dino-realms-battle-speed', String(next));
      } catch {
        /* Optional preference. */
      }
      return next;
    });
  useEffect(() => {
    let active = true;
    Promise.all([
      loadAnimation(d.species, d.element, d.stage),
      boss ? loadBossAnimation(encounter.league as RealmId) : loadAnimation(foe.species, foe.element, foe.stage),
    ]).then(async ([a, e]) => {
      await Promise.allSettled([a, e].flatMap(manifest =>
        Object.values(manifest?.clips.se ?? {}).map(clip => loadSpriteImage(clip.sheet)),
      ));
      if (!active) return;
      const ally = fighter(a),
        enemy = fighter(e);
      setFighters({ ally, enemy });
      setSteps(battle.log === 'start' ? entrance(ally, enemy, alive) : [rest(alive)]);
      setIndex(0);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.species, d.element, d.stage, foe.species, foe.element, foe.stage, encounter.league, !!boss]);
  useEffect(() => {
    if (battle.round === seenRound.current || !fighters) return;
    seenRound.current = battle.round;
    if (!battle.report) return;
    setSteps(exchange(battle.report, fighters.ally, fighters.enemy, alive));
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.round, fighters]);
  const step = steps[index],
    busy = !!step && Number.isFinite(step.ms);
  useEffect(() => {
    if (!step) return;
    if (step.reveal === 'enemy') setShown((s) => ({ ...s, enemy: step.revealHp ?? battle.enemy }));
    if (step.reveal === 'ally') setShown((s) => ({ ...s, hp: step.revealHp ?? battle.hp }));
    if (!Number.isFinite(step.ms)) {
      setShown({ hp: battle.hp, enemy: battle.enemy });
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), step.ms / speed);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, index]);
  const pose = (unit: Unit) => ({
    clip: step?.[unit] ?? ('idle' as Clip),
    style: { '--motion-ms': `${(runMs(steps, index, unit) || 600) / speed}ms` } as CSSProperties,
  });
  const ally = pose('ally'),
    enemy = pose('enemy');
  const foeName = boss ? `BOSS ${boss.name}` : SPECIES_NAMES[foe.species];
  /**
   * A landed blow shakes the arena and knocks the fighter back; an ultimate shakes harder. Unguarded, the fighter
   * flashes white; guarded (its sprite shows the shield), it only slides a little.
   */
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const impact = step?.impact,
      stage = stageRef.current;
    if (!impact || !stage || reduced) return;
    const heavy = impact.kind === 'ultimate',
      guard = impact.kind === 'guard',
      a = heavy ? 14 : guard ? 4 : 7;
    const unit = stage.querySelector<HTMLElement>(`.battle-unit.${impact.on}`);
    // Units are centred with `translate: -50% 0`; the knock-back slides them away from the striker.
    const away = (impact.on === 'enemy' ? 1 : -1) * (heavy ? 14 : guard ? 5 : 9);
    unit?.animate([{ translate: '-50% 0' }, { translate: `${-50 + away}% 0`, offset: 0.25 }, { translate: '-50% 0' }], {
      duration: 380 / speed,
      easing: 'ease-out',
    });
    if (!guard)
      unit
        ?.querySelector(':scope > :is(canvas, img)')
        ?.animate([{ filter: 'brightness(3) saturate(0)' }, { filter: 'none' }], { duration: 200 / speed });
    stage.animate(
      [
        { transform: 'scale(1.03)' },
        { transform: `scale(1.03) translate(${-a}px, ${a / 2}px)` },
        { transform: `scale(1.03) translate(${a * 0.7}px, ${-a / 3}px)` },
        { transform: `scale(1.03) translate(${-a / 3}px, 0)` },
        { transform: 'scale(1)' },
      ],
      { duration: (heavy ? 420 : 260) / speed, easing: 'ease-out' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, index]);
  // Sounds follow the replay, not the reducer: a swing as an attack starts, then the blow where it lands.
  useEffect(() => {
    if (!step) return;
    const before = steps[index - 1];
    const swings = (u: Unit) => (step[u] === 'attack' || step[u] === 'ultimate') && before?.[u] !== step[u];
    if (!step.impact && (swings('ally') || swings('enemy'))) playSound('swing');
    if (step.impact) playSound(step.impact.kind === 'ultimate' ? 'heavy' : step.impact.kind === 'hit' ? 'hit' : 'block');
    if (step.dodge) playSound('dodge');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, index]);
  useEffect(() => {
    if (!battle.result || busy) return;
    if (battle.result === 'victory') playSound('victory');
    else if (battle.result === 'defeat') playSound('defeat');
  }, [battle.result, busy]);
  const ultimate = step?.ally === 'ultimate' || step?.enemy === 'ultimate';
  // The fight plays itself: after each beat settles, the planner picks the next move (see autoBattle.ts).
  const usedMoves = useRef(new Set<BattleAction>());
  useEffect(() => {
    if (battle.round === 1) usedMoves.current = new Set();
  }, [battle.encounterId, battle.round]);
  useEffect(() => {
    if (!fighters || busy || battle.result) return;
    const timer = setTimeout(() => {
      const next = autoAction(battle, d, usedMoves.current);
      usedMoves.current.add(next);
      run({ type: 'action', action: next });
    }, (battle.round === 1 ? 900 : 650) / speed);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighters, busy, battle.result, battle.round]);
  /**
   * Skip: the planner plays every remaining round at once, through the same commands, and the screen jumps to
   * the closing pose and the result.
   */
  const skip = () => {
    if (!fighters || battle.result) return;
    let s = save;
    while (s.battle && !s.battle.result) {
      const next = autoAction(s.battle, d, usedMoves.current);
      usedMoves.current.add(next);
      try {
        s = command(s, { type: 'action', action: next }, Date.now());
      } catch {
        break;
      }
      if (!run({ type: 'action', action: next })) break;
    }
    const end = s.battle;
    if (!end) return;
    seenRound.current = end.round;
    setShown({ hp: end.hp, enemy: end.enemy });
    setSteps([rest({ ally: end.hp > 0, enemy: end.enemy > 0 })]);
    setIndex(0);
  };
  const content = (
    <>
      <div className={`battle-environment ${busy ? 'battle-playing' : ''} ${ultimate ? 'battle-ultimate' : ''}`} style={{ '--battle-speed': speed } as CSSProperties}>
        {!battle.result && (
          <div className="battle-controls">
            <button type="button" className={speed === 2 ? 'active' : ''} aria-pressed={speed === 2} onClick={toggleSpeed} title={tr('Viteză dublă', 'Double speed')}>
              ×2
            </button>
            <button type="button" onClick={skip} disabled={!fighters} title={tr('Sari la rezultat', 'Skip to the result')}>
              {tr('Sari peste', 'Skip')} ⏭
            </button>
          </div>
        )}
        <div className="battle-stage" ref={stageRef}>
          <BattleHud
            side="ally"
            color={el.color}
            name={`${el.symbol} ${d.nickname}`}
            badge={<RarityBadge rarity={rarityOf(d)} lang={lang} short />}
            level={d.level}
            hp={shown.hp}
            maxHp={battle.maxHp}
            energy={battle.energy}
            portrait={<DinosaurArt species={d.species} element={d.element} stage={d.stage} paused frame={0} />}
          >
            {encounter.mode === 'arena' && <EdgeBadge edge={battleEdge(encounter.id, d)} lang={lang} />}
          </BattleHud>
          <div className="battle-round battle-round-badge">
            <strong>VS</strong>
            <span>
              {tr('RUNDA', 'ROUND')} {Math.min(battle.round, 30)}/30
            </span>
          </div>
          <BattleHud
            side="enemy"
            color={foe.info.color}
            name={`${foe.info.symbol} ${boss?.name ?? `${SPECIES_NAMES[foe.species]} ${foe.info.name[lang]}`}`}
            badge={boss && <em className="arena-boss-tag">BOSS</em>}
            level={encounter.level}
            hp={shown.enemy}
            maxHp={battle.enemyMax}
            energy={foeHasUltimate(encounter.id) ? battle.enemyEnergy ?? 0 : undefined}
            portrait={<ArenaOpponent encounter={encounter} species={foe.species} element={foe.element} stage={foe.stage} paused />}
          />
        <div className="battle-unit ally" data-motion={ally.clip} data-dodge={step?.dodge === 'ally' || undefined} style={ally.style}>
          <DinosaurArt species={d.species} element={d.element} stage={d.stage} animation={ally.clip} speed={speed} className={rarityClass(d.rarity)} />
        </div>
        <div className="battle-unit enemy" data-motion={enemy.clip} style={enemy.style}>
          <ArenaOpponent
            encounter={encounter}
            species={foe.species}
            element={foe.element}
            stage={foe.stage}
            className="dinosaur-opponent"
            animation={enemy.clip}
            speed={speed}
          />
        </div>
        {step?.say?.map((c, i) => (
          <div key={`${index}-${i}`} className={`battle-callout on-${c.on} kind-${c.kind}`} style={{ '--row': i } as CSSProperties}>
            {calloutText(c, c.on === 'ally' ? d.nickname : foeName, lang)}
          </div>
        ))}
        </div>
      </div>
      {battle.result && !busy ? (
        <div className="battle-result">
          <span className="realm-eyebrow">{tr('REZULTAT', 'RESULT')}</span>
          <h2>
            {battle.result === 'victory'
              ? tr('Victorie!', 'Victory!')
              : battle.result === 'draw'
                ? tr('Remiză', 'Draw')
                : `${d.nickname} ${tr('se întoarce în siguranță', 'returns safely')}`}
          </h2>
          {battle.result === 'victory' && battle.stars && (
            <div className="result-stars" aria-label={`${battle.stars} / 3`}>
              {starRow(battle.stars)}
            </div>
          )}
          {battle.result === 'defeat' && (
            <p className="result-rest">
              {tr(`${d.nickname} se va odihni ${TIRED_MS / 60_000} minute. Crește-l sau încearcă un element mai potrivit.`, `${d.nickname} will rest for ${TIRED_MS / 60_000} minutes. Raise him or try a better-suited element.`)}
            </p>
          )}
          {save.rewardPending && (
            <>
              {!!battle.reward.milestones && (
                <p className="result-milestone">
                  ★ {tr('Recompensă pentru stele inclusă!', 'Star reward included!')}
                </p>
              )}
              <p>
                +{battle.reward.gold} ● &nbsp; +{battle.reward.food} ❧
              </p>
              {battle.reward.egg && (
                <div className="result-egg">
                  <strong>
                    <Icon name="egg" scale={1} /> {tr('Ou găsit!', 'Egg found!')} {(battle.reward.egg.species === 'boss' ? `BOSS ${ARENA_BOSSES[battle.reward.egg.element].name}` : SPECIES_NAMES[battle.reward.egg.species])} ·{' '}
                    {ELEMENTS.find((e) => e.id === battle.reward.egg!.element)!.name[lang]}
                    <RarityBadge rarity={rarityOf(battle.reward.egg)} lang={lang} />
                  </strong>
                  {save.eggs.length >= BALANCE.maxEggs && (
                    <small>
                      {tr(
                        'Raftul e plin — oul e păstrat și apare când faci loc.',
                        'Shelf full — the egg is saved and arrives when you make room.',
                      )}
                    </small>
                  )}
                </div>
              )}
              <div className="result-materials">
                {(Object.entries(battle.reward.materials) as [ItemId, number][]).map(([id, count]) => (
                  <span key={id}>
                    {ITEMS[id].icon} +{count} {ITEMS[id].name[lang]}
                  </span>
                ))}
              </div>
            </>
          )}
          <button className="realm-button" onClick={() => run({ type: 'claim' })}>
            {save.rewardPending ? tr('Colectează recompensa', 'Claim reward') : tr('Înapoi acasă', 'Return home')}
          </button>
        </div>
      ) : null}
    </>
  );
  return embedded
    ? <div className="arena-embedded-battle">{content}</div>
    : <Frame title={encounter.name[lang]} view="battle" close={close} lang={lang}>{content}</Frame>;
}

/**
 * A fighter's corner of the arena: portrait, name, health and energy. The amber strip behind the health bar is the
 * damage just taken; it drains after a short pause.
 */
function BattleHud({ side, color, name, badge, level, hp, maxHp, energy, portrait, children }: {
  side: Unit;
  color: string;
  name: string;
  badge?: ReactNode;
  level: number;
  hp: number;
  maxHp: number;
  energy?: number;
  portrait: ReactNode;
  children?: ReactNode;
}) {
  const health = `${Math.max(0, (hp / maxHp) * 100)}%`;
  return (
    <div className={`battle-vitals battle-hud ${side}`} style={{ '--hud-color': color } as CSSProperties}>
      <div className="battle-hud-portrait" aria-hidden="true">
        <span>{portrait}</span>
      </div>
      <div className="battle-hud-body">
        <strong>
          {name} {badge}
        </strong>
        <div className="battle-hud-bar health" role="meter" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp} aria-label="HP">
          <i className="trail" style={{ width: health }} />
          <i style={{ width: health }} />
        </div>
        {energy !== undefined && (
          <div className="battle-hud-bar energy">
            <i style={{ width: `${energy}%` }} />
          </div>
        )}
        <small>
          <b>Lv. {level}</b> · {hp} / {maxHp} HP{energy !== undefined && ` · ϟ ${energy}`}
        </small>
        {children}
      </div>
    </div>
  );
}
