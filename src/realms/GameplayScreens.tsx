import { WorkshopPanel, time } from './WorkshopPanel';
import { ArenaTicketShop } from './ArenaTicketShop';
import { RarityBadge, rarityClass } from './Rarity';
import { ARENA_BOSSES } from './arenaBosses';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ENCOUNTERS, ITEMS, REGIONS, REGION_STAGES, type Encounter, type ItemId } from './content';
import { ExpeditionGuide } from './ExpeditionGuide';
import { recommendedElement, regionById, regionProgress } from './expeditionRules';
import {
  ARENA_LEVELS,
  ARENA_REST,
  ARENA_SEASON,
  arenaTicketPrice,
  BALANCE,
  busyDinos,
  command,
  currentTrip,
  elementEdge,
  ELEMENTS,
  GATE_LEAGUES,
  GEMS,
  isTired,
  rarityOf,
  REALM_NAMES,
  rewardPreview,
  seasonStep,
  SPECIES_NAMES,
  STARS_TO_ADVANCE,
  storyChapter,
  battleEdge,
  teamDinos,
  type Command,
  type Dino,
  type RealmId,
  type RoundReport,
  type Save,
} from './game';
import { arenaFoes, arenaTier, foeHasUltimate, roundCap, teamReward } from './arenaTeams';
import { DinosaurArt } from './DinosaurArt';
import { loadAnimation, loadBossAnimation, loadSpriteImage, type Clip } from './animation';
import {
  entrance,
  exchange,
  fighter,
  rest,
  runMs,
  swapEntrance,
  type Fighter,
  type Step,
  type Unit,
} from './battleChoreography';
import { useReducedMotion } from './useMotion';
import { playSound } from './sound';
import { worldThumb } from './worldArt';
import { ArenaOpponent } from './ArenaOpponent';
import { movesMemory, nextMove, predictFight } from './autoBattle';
import { calloutText } from './battleCallouts';
import { UpgradeCard } from './UpgradeCard';
import { TeamPicker } from './TeamPicker';
import { Tabs, TabPanel } from './ui/Tabs';
import { CompactCard } from './ui/CompactCard';
import './gameplay.css';
import { Icon, elementIcon } from './ui/Icon';
export type GameplayView = 'expedition' | 'arena' | 'workshop';
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
function StarRow({ n }: { n: number }) {
  // Three stars, the earned ones lit (the pixel font draws ☆ like ★, so the empty ones are dimmed instead).
  return (
    <span className="star-row" aria-label={`${n} / 3`}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < n ? 'on' : ''}>
          ★
        </i>
      ))}
    </span>
  );
}
/** The element edge as a short badge: an arrow and a word. */
function EdgeBadge({ edge, lang }: { edge: -1 | 0 | 1; lang: number }) {
  return (
    <span className={`edge-badge edge-${edge > 0 ? 'up' : edge < 0 ? 'down' : 'even'}`}>
      {edge > 0
        ? `▲ ${T(lang, 'Avantaj', 'Advantage')}`
        : edge < 0
          ? `▼ ${T(lang, 'Dezavantaj', 'Disadvantage')}`
          : `● ${T(lang, 'Neutru', 'Neutral')}`}
    </span>
  );
}
function Frame({
  title,
  view,
  children,
  close,
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
      {(view === 'workshop' || view === 'battle') && (
        <button type="button" onClick={close} className="gameplay-close gameplay-floating-close"
          aria-label={T(lang, 'Înapoi pe insulă', 'Back to island')}>
          <Icon name="close" />
        </button>
      )}
      {children}
    </section>
  );
}
export function GameplayScreen(props: Props & { view: GameplayView }) {
  const { view, save, now, lang, run, close, navigate, build } = props;
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const [selected, setSelected] = useState('training'),
    [recipeId, setRecipe] = useState('planks');
  const detailRef = useRef<HTMLElement>(null);
  const selectDestination = (id: string) => {
    setSelected(id);
    if (window.matchMedia('(max-width: 760px)').matches)
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    try {
      localStorage.setItem('dino-expedition-destination', id);
    } catch {
      /* Optional navigation memory. */
    }
  };
  useEffect(() => {
    if (view === 'workshop') setRecipe(props.initialRecipe ?? 'planks');
  }, [view, props.initialRecipe]);
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
    if (view !== 'expedition') return;
    let id = currentTrip(save)?.regionId ?? frontierRegion(save).id;
    try {
      const remembered = localStorage.getItem('dino-expedition-destination');
      if (regionById(remembered ?? '')) id = remembered!;
    } catch {
      /* Optional navigation memory. */
    }
    setSelected(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const region = regionById(selected) ?? REGIONS[0];
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
      {view === 'workshop' ? (
        <WorkshopPanel
          save={save}
          now={now}
          lang={lang}
          run={run}
          build={build}
          recipeId={recipeId}
          returnToExpeditions={props.returnToExpeditions}
        />
      ) : view === 'arena' ? (
        <ArenaView save={save} now={now} lang={lang} run={run} close={close} navigate={navigate} build={build} />
      ) : (
        <div className="adventure-layout">
          <div
            ref={mapRef}
            className="adventure-map"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              if (
                window.matchMedia(
                  '(max-width: 760px), (max-height: 500px) and (orientation: landscape) and (max-width: 1050px)',
                ).matches
              )
                return;
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
            <div
              className="adventure-map-plane"
              data-map-zoom={mapZoom}
              style={{ transform: `translate(${mapPosition.x}px, ${mapPosition.y}px) scale(${mapZoom})` }}
            >
              <RegionRoute save={save} />
              {REGIONS.map((r) => {
                const progress = regionProgress(save, r.id),
                  element = ELEMENTS.find((el) => el.id === r.element)!,
                  away = save.expeditions.some((x) => x.regionId === r.id);
                return (
                  <button
                    key={r.id}
                    className={`adventure-node ${r.id === selected ? 'selected' : ''} ${progress >= REGION_STAGES ? 'cleared' : ''} ${regionLocked(save, r.id) ? 'locked' : ''} ${away ? 'away' : ''}`}
                    style={{ left: `${r.x}%`, top: `${r.y}%` }}
                    onClick={() => selectDestination(r.id)}
                    aria-label={`${r.name[lang]} · ${progress}/${REGION_STAGES}`}
                  >
                    <span>{progress >= REGION_STAGES ? '✓' : element.symbol}</span>
                    <strong>
                      {element.name[lang]}{' '}
                      <em>
                        {progress}/{REGION_STAGES}
                        {away ? ' ⏳' : ''}
                      </em>
                      <small>{r.name[lang]}</small>
                    </strong>
                  </button>
                );
              })}
            </div>
            <MapCaption save={save} lang={lang} />
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
          </div>
          <aside ref={detailRef} className="adventure-detail expedition-detail">
            <button type="button" onClick={close} className="gameplay-close expedition-panel-close"
              aria-label={tr('Înapoi pe insulă', 'Back to island')}>
              <Icon name="close" />
            </button>
            <div className="destination-cover" style={{ backgroundImage: `url('${worldThumb(region.element)}')` }}>
              <span>{region.name[lang]}</span>
              <em>
                {ELEMENTS.find((e) => e.id === region.element)?.symbol} {REALM_NAMES[region.element]?.[lang]}
                {' · '}
                {tr('recomandat', 'best')} {ELEMENTS.find((e) => e.id === recommendedElement(region.element))?.symbol}
              </em>
            </div>
            <div className="adventure-detail-body">
              <ExpeditionGuide
                save={save}
                now={now}
                lang={lang}
                destination={region.id}
                select={selectDestination}
                run={run}
                navigate={navigate}
                build={build}
                prepareSupplies={props.prepareSupplies ?? (() => navigate('workshop'))}
              />
              <button
                className="realm-button secondary mobile-destination-picker"
                onClick={() => mapRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
              >
                ↓ {tr('Toate destinațiile', 'All destinations')}
              </button>
            </div>
          </aside>
        </div>
      )}
    </Frame>
  );
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** A region not open yet: its world is still locked, or the region before it is not crossed. */
const regionLocked = (save: Save, id: string) => {
  const i = REGIONS.findIndex((r) => r.id === id);
  return !save.habitats[REGIONS[i].element] || (i > 0 && regionProgress(save, REGIONS[i - 1].id) < REGION_STAGES);
};
/** The region the player is working on: the first one not crossed yet (the last one once all are). */
const frontierRegion = (save: Save) =>
  REGIONS.find((r) => regionProgress(save, r.id) < REGION_STAGES) ?? REGIONS[REGIONS.length - 1];
/**
 * The route between the regions, drawn from their positions in chain order: solid up to the last region crossed,
 * dashed beyond. Each leg bends a little so the line does not run straight through the islands.
 */
function RegionRoute({ save }: { save: Save }) {
  const legs = REGIONS.slice(1).map((to, i) => {
    const from = REGIONS[i],
      mx = (from.x + to.x) / 2,
      my = (from.y + to.y) / 2,
      dx = to.x - from.x,
      dy = to.y - from.y,
      bend = 0.12;
    return {
      id: to.id,
      d: `M${from.x} ${from.y} Q${(mx - dy * bend).toFixed(1)} ${(my + dx * bend).toFixed(1)} ${to.x} ${to.y}`,
      done: regionProgress(save, to.id) >= REGION_STAGES,
    };
  });
  return (
    <svg className="adventure-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {legs.map((l) => (
        <path key={l.id} d={l.d} className={l.done ? 'done' : ''} />
      ))}
    </svg>
  );
}
/** The map's title card: the story chapter, the region being worked on, and how far the expedition chain goes. */
function MapCaption({ save, lang }: { save: Save; lang: number }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const chapter = storyChapter(save)?.chapter.number;
  const region = frontierRegion(save),
    n = REGIONS.indexOf(region) + 1;
  const crossed = REGIONS.filter((r) => regionProgress(save, r.id) >= REGION_STAGES).length,
    stages = REGIONS.reduce((sum, r) => sum + regionProgress(save, r.id), 0);
  return (
    <div className="map-caption">
      <span className="realm-eyebrow">
        {chapter ? `${tr('CAPITOLUL', 'CHAPTER')} ${ROMAN[chapter]} · ` : ''}
        {tr('REGIUNEA', 'REGION')} {n}/10
      </span>
      <h2>
        {region.name[lang]} · {regionProgress(save, region.id)}/{REGION_STAGES}
      </h2>
      <p>
        {crossed}/10 {tr('regiuni traversate', 'regions crossed')} · {stages}/{REGIONS.length * REGION_STAGES}{' '}
        {tr('etape', 'stages')}
      </p>
    </div>
  );
}
/** The encounter the arena opens on: the fight under way, the last one picked, or the first open one not won yet. */
function startingEncounter(save: Save) {
  const arena = ENCOUNTERS.filter((e) => e.mode === 'arena');
  if (save.battle) return save.battle.encounterId;
  try {
    const remembered = localStorage.getItem('dino-arena-encounter');
    if (arena.some((e) => e.id === remembered)) return remembered!;
  } catch {
    /* Optional navigation memory. */
  }
  const open = arena.filter((e) => leagueOpen(save, e.league as RealmId) && !tierLocked(save, e));
  return (open.find((e) => !save.cleared.includes(e.id)) ?? open.at(-1) ?? arena[0]).id;
}
const gateOpen = (save: Save, id: RealmId) => !GATE_LEAGUES.includes(id) || save.arenaLevel >= 2;
const leagueOpen = (save: Save, id: RealmId) => !!save.habitats[id] && gateOpen(save, id);
const tierLocked = (save: Save, e: Encounter) => !!e.requires && (save.stars[e.requires] ?? 0) < STARS_TO_ADVANCE;
type Blocker = 'building' | 'noTeam' | 'baby' | 'away' | 'world' | 'gate' | 'stars' | 'tired' | 'level' | 'ticket';
/** The first reason the team cannot start this fight now (the same checks as the `battle` command), or null. */
function arenaBlocker(save: Save, e: Encounter, now: number): Blocker | null {
  const team = teamDinos(save),
    league = e.league as RealmId;
  if (!save.buildings.some((b) => b.kind === 'arena')) return 'building';
  if (!team.length) return 'noTeam';
  if (team.some((d) => d.stage === 'baby')) return 'baby';
  if (team.some((d) => busyDinos(save).has(d.id))) return 'away';
  if (!save.habitats[league]) return 'world';
  if (!gateOpen(save, league)) return 'gate';
  if (tierLocked(save, e)) return 'stars';
  if (team.some((d) => isTired(save, d.id, now))) return 'tired';
  if (team.some((d) => d.level < e.level)) return 'level';
  if (!(save.arenaTickets[league] ?? 0)) return 'ticket';
  return null;
}
type ArenaProps = Pick<Props, 'save' | 'now' | 'lang' | 'run' | 'close' | 'navigate' | 'build'>;
type ArenaTab = 'fight' | 'team' | 'gate';

/**
 * The arena: league and tier chips over the opposing team on the left; on the right three tabs — Fight (rewards,
 * opponents, forecast, ticket and start), Team (pick one to three dinosaurs, wake the resting ones) and Gate (the
 * upgrade and the weekly season). A fight in progress takes the whole screen.
 */
function ArenaView({ save, now, lang, run, close, navigate, build }: ArenaProps) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const [selected, setSelected] = useState(() => startingEncounter(save));
  const [tab, setTab] = useState<ArenaTab>('fight');
  const [shop, setShop] = useState(false);
  const encounter = ENCOUNTERS.find((e) => e.id === selected) ?? ENCOUNTERS[0],
    league = encounter.league as RealmId;
  const pick = (id: string) => {
    setSelected(id);
    try {
      localStorage.setItem('dino-arena-encounter', id);
    } catch {
      /* Optional navigation memory. */
    }
  };
  if (save.battle)
    return (
      <div className="adventure-layout battle-focus">
        <button type="button" className="gameplay-close arena-battle-close" onClick={close} aria-label={tr('Înapoi pe insulă', 'Back to island')}><Icon name="close" /></button>
        <div className="arena-lobby-scene">
          <BattleScreen save={save} lang={lang} run={run} close={close} embedded />
        </div>
      </div>
    );
  const foes = arenaFoes(encounter.id),
    boss = foes.find((f) => f.boss),
    element = ELEMENTS.find((e) => e.id === league)!;
  const leagueEncounters = ENCOUNTERS.filter((e) => e.league === league);
  const step = seasonStep(save.arena.weekWins),
    nextSeason = ARENA_SEASON[step];
  const idBase = 'arena-tabs';
  return (
    <div className="arena-view">
      {shop && <ArenaTicketShop save={save} lang={lang} run={run} back={() => setShop(false)} focus={league} />}
      <div className="arena-stage-pane">
        <div className="arena-league-chips" role="group" aria-label={tr('Ligi', 'Leagues')}>
          {ELEMENTS.map((e) => {
            const open = leagueOpen(save, e.id),
              stars = ENCOUNTERS.filter((x) => x.league === e.id).reduce((n, x) => n + (save.stars[x.id] ?? 0), 0);
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={league === e.id}
                className={`arena-league-chip${open ? '' : ' locked'}`}
                style={{ '--league-color': e.color } as CSSProperties}
                title={
                  open
                    ? `${e.name[lang]} · ${tr('nivel', 'level')} ${ENCOUNTERS.find((x) => x.id === `arena-${e.id}-1`)!.level}+`
                    : !save.habitats[e.id]
                      ? tr(
                          `Deblochează lumea ${e.name[0]} ca să deschizi liga`,
                          `Unlock the ${e.name[1]} world to open this league`,
                        )
                      : tr('Îmbunătățește Poarta arenei la nivelul 2', 'Upgrade the Arena Gate to level 2')
                }
                onClick={() => pick(`arena-${e.id}-1`)}
              >
                {open ? <Icon name={elementIcon(e.id)} scale={1} /> : <span aria-hidden="true">🔒</span>}
                <span className="arena-league-name">{e.name[lang]}</span>
                <small>{stars}★</small>
              </button>
            );
          })}
        </div>
        <div className="arena-preview">
          <div className="arena-preview-title">
            <span className="realm-eyebrow">
              {element.name[lang].toUpperCase()} · {tr('NIVEL', 'LEVEL')} {encounter.level}
            </span>
            <h2>{encounter.name[lang]}</h2>
            {boss && <strong className="arena-boss-name">BOSS {ARENA_BOSSES[league].name}</strong>}
          </div>
          <div className={`arena-foe-lineup foes-${foes.length}`}>
            {foes.map((f, i) => (
              <div key={`${encounter.id}-${i}`} className={`arena-foe-figure${f.boss ? ' boss' : ''}`}>
                <ArenaOpponent foe={f} className="dinosaur-opponent" />
              </div>
            ))}
          </div>
          <div
            className="arena-season-chip"
            title={tr(
              'Sezonul săptămânal: victorii în arenă de luni până duminică',
              'Weekly season: arena wins from Monday to Sunday',
            )}
          >
            <Icon name="trophy" scale={1} />
            {nextSeason ? (
              <span>
                {tr('Sezon', 'Season')}{' '}
                <b>
                  {save.arena.weekWins}/{nextSeason.wins}
                </b>{' '}
                · {seasonPrize(nextSeason, lang)}
              </span>
            ) : (
              <span>
                {tr('Sezon complet', 'Season complete')} · <b>{save.arena.weekWins}</b> {tr('victorii', 'wins')}
              </span>
            )}
          </div>
        </div>
        <div className="arena-tier-chips" role="group" aria-label={tr('Trepte', 'Tiers')}>
          {leagueEncounters.map((e, i) => {
            const locked = tierLocked(save, e) || !leagueOpen(save, league);
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={selected === e.id}
                className={`arena-tier-chip${locked ? ' locked' : ''}`}
                onClick={() => pick(e.id)}
              >
                <span className="arena-tier-stars" aria-label={`${save.stars[e.id] ?? 0} / 3`}>
                  {locked ? '🔒' : <StarRow n={save.stars[e.id] ?? 0} />}
                </span>
                <strong>
                  {e.name[lang].split(' · ')[1]}
                  {i === 2 && <em className="arena-boss-tag"> · BOSS</em>}
                </strong>
                <small>
                  {tr('Nv.', 'Lv.')} {e.level} · {arenaFoes(e.id).length} {tr('adversari', 'foes')}
                </small>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="arena-side">
        <div className="arena-side-toolbar">
        <Tabs
          idBase={idBase}
          label={tr('Secțiuni arenă', 'Arena sections')}
          className="arena-tabs"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'fight', label: tr('Luptă', 'Fight') },
            {
              id: 'team',
              label: tr('Echipă', 'Team'),
              badge: save.team.filter((id) => isTired(save, id, now)).length ? '💤' : undefined,
            },
            { id: 'gate', label: tr('Poartă', 'Gate') },
          ]}
        />
        <button type="button" className="gameplay-close" onClick={close} aria-label={tr('Înapoi pe insulă', 'Back to island')} title={tr('Înapoi pe insulă', 'Back to island')}><Icon name="close" /></button>
        </div>
        {tab === 'fight' && (
          <TabPanel idBase={idBase} id="fight" className="arena-tab">
            <ArenaFight
              save={save}
              now={now}
              lang={lang}
              run={run}
              encounter={encounter}
              openShop={() => setShop(true)}
              openTeam={() => setTab('team')}
              navigate={navigate}
              build={build}
            />
          </TabPanel>
        )}
        {tab === 'team' && (
          <TabPanel idBase={idBase} id="team" className="arena-tab">
            <ArenaTeam save={save} now={now} lang={lang} run={run} league={league} />
          </TabPanel>
        )}
        {tab === 'gate' && (
          <TabPanel idBase={idBase} id="gate" className="arena-tab">
            <ArenaGate save={save} now={now} lang={lang} run={run} build={build} />
          </TabPanel>
        )}
      </aside>
    </div>
  );
}
/** A season step's prize in a few symbols. */
function seasonPrize(step: (typeof ARENA_SEASON)[number], lang: number) {
  return [
    step.gems && `${step.gems}💎`,
    step.gold && `${step.gold}●`,
    ...(Object.entries(step.materials) as [ItemId, number][]).map(
      ([id, n]) => `${n} ${ITEMS[id].name[lang].toLowerCase()}`,
    ),
    step.tickets && `${step.tickets} ${lang ? 'tickets' : 'bilete'}`,
  ]
    .filter(Boolean)
    .join(' + ');
}
/** A small still portrait of a fighter. */
function Face({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`arena-face ${className}`}>{children}</span>;
}

function ArenaFight({
  save,
  now,
  lang,
  run,
  encounter,
  openShop,
  openTeam,
  navigate,
  build,
}: Pick<ArenaProps, 'save' | 'now' | 'lang' | 'run' | 'navigate' | 'build'> & {
  encounter: Encounter;
  openShop: () => void;
  openTeam: () => void;
}) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const league = encounter.league as RealmId,
    element = ELEMENTS.find((e) => e.id === league)!;
  const team = teamDinos(save),
    foes = arenaFoes(encounter.id),
    reward = rewardPreview(save, encounter.id, Math.max(1, team.length))!,
    tickets = save.arenaTickets[league] ?? 0,
    blocker = arenaBlocker(save, encounter, now);
  const restKey = team.map((d) => `${d.id}:${d.level}:${d.stage}:${isTired(save, d.id, now)}`).join(',');
  const forecast = useMemo(
    () => (blocker === 'tired' ? null : predictFight(save, encounter.id, now)),
    // The forecast depends on the team and the fight, not on the ticking clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [encounter.id, restKey, save.stars, save.buildings.length, save.arenaLevel, blocker === 'tired'],
  );
  // A fight the forecast says is lost needs a second click.
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(false), [encounter.id, restKey]);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);
  const verdict = !forecast
    ? null
    : !forecast.win
      ? {
          cls: 'hard',
          text:
            forecast.result === 'draw'
              ? tr('Foarte greu · remiză', 'Very hard · a draw')
              : tr('Foarte greu · ar pierde acum', 'Very hard · would lose now'),
        }
      : forecast.stars === 3
        ? { cls: 'easy', text: tr('Ușor', 'Easy') }
        : forecast.stars === 2
          ? { cls: 'even', text: tr('Echilibrat', 'Balanced') }
          : { cls: 'tough', text: tr('Greu · la limită', 'Tough · a close call') };
  const edges = team.map((d) => battleEdge(encounter.id, d));
  const risky = !!forecast && !forecast.win;
  const start = () => {
    if (risky && !armed) return setArmed(true);
    setArmed(false);
    run({ type: 'battle', encounterId: encounter.id });
  };
  const restLeft = Math.max(0, ...team.map((d) => (save.tired[d.id] ?? 0) - now));
  const blockerText: Record<Blocker, [string, ReactNode?]> = {
    building: [
      tr('Construiește Poarta arenei pe insulă ca să lupți aici.', 'Build the Arena Gate on the island to fight here.'),
      <button key="b" type="button" className="realm-button secondary" onClick={build}>
        {tr('Construiește', 'Build')}
      </button>,
    ],
    noTeam: [tr('Eclozează un dinozaur ca să ai cu cine lupta.', 'Hatch a dinosaur to have someone to fight with.')],
    baby: [
      tr(
        'Puii nu luptă: crește-l până la juvenil sau alege altă echipă.',
        'Babies do not fight: raise it to juvenile or pick another team.',
      ),
      <button key="b" type="button" className="realm-button secondary" onClick={() => navigate('dino')}>
        {tr('Crește-l', 'Raise it')}
      </button>,
    ],
    away: [
      tr('Un membru al echipei e plecat în expediție.', 'A team member is away on an expedition.'),
      <button key="b" type="button" className="realm-button secondary" onClick={openTeam}>
        {tr('Echipă', 'Team')}
      </button>,
    ],
    world: [
      tr(
        `Deblochează lumea ${element.name[0]} ca să deschizi liga.`,
        `Unlock the ${element.name[1]} world to open this league.`,
      ),
    ],
    gate: [tr('Ligile 6–10 cer Poarta arenei nivel 2.', 'Leagues 6–10 need Arena Gate level 2.')],
    stars: [
      tr(
        `Ai nevoie de ${STARS_TO_ADVANCE}★ la treapta precedentă.`,
        `You need ${STARS_TO_ADVANCE}★ on the previous tier.`,
      ),
    ],
    tired: [
      tr(`Echipa se odihnește încă ${time(restLeft)}.`, `The team rests for another ${time(restLeft)}.`),
      <button key="b" type="button" className="realm-button secondary" onClick={openTeam}>
        {tr('Trezește', 'Wake')}
      </button>,
    ],
    level: [
      tr(`Fiecare membru are nevoie de nivelul ${encounter.level}.`, `Every member needs level ${encounter.level}.`),
      <button key="b" type="button" className="realm-button secondary" onClick={openTeam}>
        {tr('Echipă', 'Team')}
      </button>,
    ],
    ticket: [
      tr(
        `Ai nevoie de un bilet ${element.name[0].toLowerCase()}.`,
        `You need a ${element.name[1].toLowerCase()} ticket.`,
      ),
    ],
  };
  return (
    <div className="arena-fight">
      <div className="gameplay-section-label">
        {tr('RECOMPENSE', 'REWARDS')}
        <small>
          {reward.repeat ? tr('REJUCARE', 'REPLAY') : tr('PRIMA VICTORIE', 'FIRST WIN')}
          {team.length > 1 && ` · ${tr('echipă', 'team')} ×${teamReward(team.length)}`}
        </small>
      </div>
      <div className="gameplay-rewards arena-rewards">
        <span title={tr('Aur', 'Gold')}>
          <Icon name="gold" scale={1} />
          {reward.gold}
        </span>
        <span title={tr('Hrană', 'Food')}>
          <Icon name="food" scale={1} />
          {reward.food}
        </span>
        {(Object.entries(reward.materials) as [ItemId, number][]).map(([id, n]) => (
          <span key={id} title={ITEMS[id].name[lang]}>
            <b style={{ color: ITEMS[id].color }}>{ITEMS[id].icon}</b>
            {n}
          </span>
        ))}
        {reward.bossEgg ? (
          <span
            className="reward-egg boss"
            title={tr('Prima victorie aduce oul bossului', 'The first win brings the boss egg')}
          >
            <Icon name="egg" scale={1} />
            {tr('Ou de boss', 'Boss egg')}
          </span>
        ) : (
          reward.eggChance !== undefined && (
            <span className="reward-egg" title={tr('Șansă de ou', 'Egg chance')}>
              <Icon name="egg" scale={1} />
              {Math.round(reward.eggChance * 100)}%
            </span>
          )
        )}
      </div>
      <div className="arena-versus">
        <div className="arena-faces" aria-label={tr('Echipa ta', 'Your team')}>
          {team.length ? (
            team.map((d, i) => (
              <Face key={d.id} className={edges[i] > 0 ? 'edge-up' : edges[i] < 0 ? 'edge-down' : ''}>
                <DinosaurArt
                  species={d.species}
                  element={d.element}
                  stage={d.stage}
                  paused
                  frame={0}
                  className={rarityClass(d.rarity)}
                />
                <small>{d.level}</small>
              </Face>
            ))
          ) : (
            <button type="button" className="realm-button secondary" onClick={openTeam}>
              {tr('Alege echipa', 'Pick a team')}
            </button>
          )}
        </div>
        <b className="arena-vs">VS</b>
        <div className="arena-faces foes" aria-label={tr('Adversari', 'Opponents')}>
          {foes.map((f, i) => (
            <Face key={i} className={f.boss ? 'boss' : ''}>
              <ArenaOpponent foe={f} paused />
              <small>{f.boss ? 'BOSS' : f.level}</small>
            </Face>
          ))}
        </div>
      </div>
      {verdict && (
        <div className={`arena-forecast forecast-${verdict.cls}`}>
          <strong>{verdict.text}</strong>
          <small>
            {forecast!.win && <StarRow n={forecast!.stars} />}
            {edges.some((e) => e > 0) && <span className="edge-up"> ▲{edges.filter((e) => e > 0).length}</span>}
            {edges.some((e) => e < 0) && <span className="edge-down"> ▼{edges.filter((e) => e < 0).length}</span>}
          </small>
        </div>
      )}
      {blocker && blocker !== 'ticket' && (
        <p className="arena-blocker">
          <span>{blockerText[blocker][0]}</span>
          {blockerText[blocker][1]}
        </p>
      )}
      <div className={`arena-ticket-line${tickets ? '' : ' empty'}`}>
        <span>
          🎟 {tr('Bilete', 'Tickets')} {element.name[lang].toLowerCase()}: <b>{tickets}</b>
          {!tickets && ` · ${tr('trebuie 1', 'need 1')}`}
        </span>
        <button type="button" className="realm-button secondary" onClick={openShop}>
          {tr('Cumpără', 'Buy')} · {arenaTicketPrice(league)}●
        </button>
      </div>
      <button
        type="button"
        className={`realm-button adventure-start${risky ? ' risky' : ''}${armed ? ' armed' : ''}`}
        disabled={!!blocker}
        onClick={start}
      >
        {armed
          ? tr('Sigur? Apasă din nou', 'Sure? Tap again')
          : risky
            ? tr('Luptă oricum', 'Fight anyway')
            : tr('Începe lupta', 'Start battle')}{' '}
        →
      </button>
    </div>
  );
}

/** The arena team: one to three dinosaurs picked from the roster, and the ones resting after a fight. */
function ArenaTeam({
  save,
  now,
  lang,
  run,
  league,
}: Pick<ArenaProps, 'save' | 'now' | 'lang' | 'run'> & { league: RealmId }) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const busy = busyDinos(save);
  const minute = Math.floor(now / 60_000);
  const isEligible = useCallback(
    (d: Dino) =>
      d.stage === 'baby'
        ? tr('Pui', 'Baby')
        : busy.has(d.id)
          ? tr('Plecat', 'Away')
          : isTired(save, d.id, now)
            ? `💤 ${time((save.tired[d.id] ?? 0) - now)}`
            : null,
    // Re-checked every minute and whenever who is away or resting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, minute, save.tired, save.expeditions, save.dinos],
  );
  const resting = save.team
    .filter((id) => isTired(save, id, now))
    .map((id) => save.dinos.find((d) => d.id === id)!)
    .filter(Boolean);
  const beats = ELEMENTS.find((e) => elementEdge(e.id, league) === 1)?.id;
  return (
    <div className="arena-team">
      <TeamPicker
        dinos={save.dinos}
        selected={save.team}
        max={3}
        lang={lang}
        recommended={beats}
        label={tr('Echipa de arenă', 'Arena team')}
        isEligible={isEligible}
        onChange={(next) => {
          // Only able dinosaurs are kept: a resting one leaves the team when it is edited.
          const able = next.filter((id) => {
            const d = save.dinos.find((x) => x.id === id);
            return d && !isEligible(d);
          });
          if (able.length) run({ type: 'setTeam', dinoIds: able });
        }}
      />
      <p className="arena-team-hint">
        {tr(
          'Luptă pe rând, primul deschide. Mai mulți membri = recompensă mai mare (×1.1 / ×1.2).',
          'They fight in turn, the first one opens. More members = a bigger reward (×1.1 / ×1.2).',
        )}
      </p>
      {resting.length > 0 && (
        <div className="arena-resting">
          {resting.map((d) => (
            <CompactCard
              key={d.id}
              art={<DinosaurArt species={d.species} element={d.element} stage={d.stage} paused frame={0} />}
              title={d.nickname}
              subtitle={`💤 ${time((save.tired[d.id] ?? 0) - now)}`}
              action={
                <button
                  type="button"
                  className="realm-button"
                  disabled={save.gems < GEMS.rest}
                  onClick={() => run({ type: 'gemRest', dinoId: d.id })}
                >
                  {GEMS.rest} 💎
                </button>
              }
            />
          ))}
          {resting.length > 1 && (
            <button
              type="button"
              className="realm-button arena-wake-all"
              disabled={save.gems < Math.min(GEMS.restTeam, GEMS.rest * resting.length)}
              onClick={() => run({ type: 'gemRest', team: true })}
            >
              {tr('Trezește echipa', 'Wake the team')} · {Math.min(GEMS.restTeam, GEMS.rest * resting.length)} 💎
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The Arena Gate's upgrade and the weekly season's steps. */
function ArenaGate({ save, now, lang, run, build }: Pick<ArenaProps, 'save' | 'now' | 'lang' | 'run' | 'build'>) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const hasGate = save.buildings.some((b) => b.kind === 'arena');
  return (
    <div className="arena-gate" data-scroll>
      {hasGate ? (
        <UpgradeCard
          save={save}
          now={now}
          lang={lang}
          run={run}
          target="arena"
          level={save.arenaLevel}
          max={ARENA_LEVELS.length}
          next={[
            <>
              ● <b>+{Math.round((ARENA_LEVELS[save.arenaLevel]?.bonus ?? 0) * 100)}%</b>{' '}
              {tr('aur, hrană și materiale din arenă', 'arena gold, food and materials')}
            </>,
            <>
              ♜ {tr('Deschide ligile 6–10', 'Opens leagues 6–10')} (
              {GATE_LEAGUES.map((id) => ELEMENTS.find((e) => e.id === id)!.symbol).join(' ')})
            </>,
          ]}
          gold={ARENA_LEVELS[save.arenaLevel]?.gold ?? 0}
          materials={ARENA_LEVELS[save.arenaLevel]?.materials ?? {}}
        />
      ) : (
        <button type="button" className="realm-button" onClick={build}>
          {tr('Construiește Poarta arenei', 'Build the Arena Gate')}
        </button>
      )}
      <div className="arena-season">
        <div className="gameplay-section-label">
          {tr('SEZONUL SĂPTĂMÂNII', 'WEEKLY SEASON')}
          <small>
            {save.arena.weekWins} {tr('victorii', 'wins')}
          </small>
        </div>
        <ol>
          {ARENA_SEASON.map((step, i) => (
            <li key={step.wins} className={i < save.arena.weekClaimed ? 'done' : ''}>
              <b>{step.wins}</b>
              <span>{seasonPrize(step, lang)}</span>
              <i className="realm-meter">
                <i style={{ width: `${Math.min(100, (save.arena.weekWins / step.wins) * 100)}%` }} />
              </i>
            </li>
          ))}
        </ol>
        <small>{tr('Se reia în fiecare luni (ora României).', 'Restarts every Monday (Romania time).')}</small>
      </div>
    </div>
  );
}

/** One pip per member of a side: the fighter on stage is lit, the fallen are crossed out. */
function Pips({ states, side }: { states: ('active' | 'waiting' | 'fallen')[]; side: Unit }) {
  if (states.length < 2) return null;
  return (
    <span
      className={`battle-pips ${side}`}
      aria-label={`${states.filter((s) => s !== 'fallen').length} / ${states.length}`}
    >
      {states.map((s, i) => (
        <i key={i} className={s} />
      ))}
    </span>
  );
}

export function BattleScreen({
  save,
  lang,
  run,
  close,
  embedded = false,
}: Pick<Props, 'save' | 'lang' | 'run' | 'close'> & { embedded?: boolean }) {
  const battle = save.battle!,
    encounter = ENCOUNTERS.find((e) => e.id === battle.encounterId)!;
  const tr = (ro: string, en: string) => T(lang, ro, en);
  // The pair on stage. It follows the fight's active pair, but only once a fallen fighter's round has been told.
  const [view, setView] = useState({ ally: battle.active, foe: battle.foeIndex });
  const allyState = battle.team[view.ally],
    d = save.dinos.find((x) => x.id === allyState.dinoId)!,
    el = ELEMENTS.find((e) => e.id === d.element)!,
    foe = battle.foes[view.foe],
    foeInfo = ELEMENTS.find((e) => e.id === foe.element)!,
    bossInfo = foe.boss ? ARENA_BOSSES[foe.element] : undefined;
  // The reducer resolves a round instantly; the screen replays it beat by beat with the clips each fighter owns.
  const [fighters, setFighters] = useState<{ ally: Fighter; enemy: Fighter } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState({ hp: allyState.hp, enemy: foe.hp });
  const seenRound = useRef(battle.round);
  const firstLoad = useRef(true);
  /** A relay swap waiting for the round's replay to end, then for the newcomer's sprites. */
  const swap = useRef<RoundReport['swap']>(undefined);
  const memory = useRef(movesMemory());
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
      foe.boss ? loadBossAnimation(foe.element) : loadAnimation(foe.species, foe.element, foe.stage),
    ]).then(async ([a, e]) => {
      await Promise.allSettled(
        [a, e].flatMap((manifest) =>
          Object.values(manifest?.clips.se ?? {}).map((clip) => loadSpriteImage(clip.sheet)),
        ),
      );
      if (!active) return;
      const ally = fighter(a),
        enemy = fighter(e);
      const alive = { ally: battle.team[view.ally].hp > 0, enemy: battle.foes[view.foe].hp > 0 };
      setFighters({ ally, enemy });
      if (swap.current) setSteps(swapEntrance(swap.current, ally, enemy, alive));
      else setSteps(firstLoad.current && battle.log === 'start' ? entrance(ally, enemy, alive) : [rest(alive)]);
      swap.current = undefined;
      firstLoad.current = false;
      setIndex(0);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id, d.stage, foe.species, foe.element, foe.stage, !!foe.boss, view.ally, view.foe]);
  useEffect(() => {
    if (battle.round === seenRound.current || !fighters || !battle.report) return;
    seenRound.current = battle.round;
    const r = battle.report;
    swap.current = r.swap;
    setSteps(
      exchange(r, fighters.ally, fighters.enemy, {
        ally: (r.hpAfter ?? battle.hp) > 0,
        enemy: (r.enemyAfter ?? battle.enemy) > 0,
      }),
    );
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.round, fighters]);
  const step = steps[index],
    busy = !!step && Number.isFinite(step.ms);
  useEffect(() => {
    if (!step) return;
    if (step.reveal === 'enemy') setShown((s) => ({ ...s, enemy: step.revealHp ?? battle.foes[view.foe].hp }));
    if (step.reveal === 'ally') setShown((s) => ({ ...s, hp: step.revealHp ?? battle.team[view.ally].hp }));
    if (!Number.isFinite(step.ms)) {
      setShown({ hp: battle.team[view.ally].hp, enemy: battle.foes[view.foe].hp });
      // The round is told: the next fighter of the fallen side steps in.
      if (swap.current && (view.ally !== battle.active || view.foe !== battle.foeIndex)) {
        setFighters(null);
        setSteps([]);
        setShown({ hp: battle.team[battle.active].hp, enemy: battle.foes[battle.foeIndex].hp });
        setView({ ally: battle.active, foe: battle.foeIndex });
      }
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
  const foeName = bossInfo ? `BOSS ${bossInfo.name}` : SPECIES_NAMES[foe.species];
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
    if (step.impact)
      playSound(step.impact.kind === 'ultimate' ? 'heavy' : step.impact.kind === 'hit' ? 'hit' : 'block');
    if (step.dodge) playSound('dodge');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, index]);
  const told = !busy && !!fighters && view.ally === battle.active && view.foe === battle.foeIndex;
  useEffect(() => {
    if (!battle.result || !told) return;
    if (battle.result === 'victory') playSound('victory');
    else playSound('defeat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.result, told]);
  const ultimate = step?.ally === 'ultimate' || step?.enemy === 'ultimate';
  // The fight plays itself: after each beat settles, the planner picks the next move for the fighter on stage.
  useEffect(() => {
    if (!told || battle.result) return;
    const timer = setTimeout(
      () => {
        const next = nextMove(save, memory.current);
        if (next) run({ type: 'action', action: next });
      },
      (battle.round === 1 ? 900 : 650) / speed,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [told, battle.result, battle.round]);
  /**
   * Skip: the planner plays every remaining round at once, through the same commands, and the screen jumps to
   * the closing pose and the result.
   */
  const skip = () => {
    if (!fighters || battle.result) return;
    let s = save;
    for (let next = nextMove(s, memory.current); next; next = nextMove(s, memory.current)) {
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
    swap.current = undefined;
    setShown({ hp: end.team[end.active].hp, enemy: end.foes[end.foeIndex].hp });
    if (view.ally !== end.active || view.foe !== end.foeIndex) {
      setFighters(null);
      setView({ ally: end.active, foe: end.foeIndex });
    }
    setSteps([rest({ ally: end.team[end.active].hp > 0, enemy: end.foes[end.foeIndex].hp > 0 })]);
    setIndex(0);
  };
  const pips = (side: Unit) =>
    side === 'ally'
      ? battle.team.map(
          (a, i) =>
            ((i === view.ally ? shown.hp : a.hp) === 0 ? 'fallen' : i === view.ally ? 'active' : 'waiting') as
              'active' | 'waiting' | 'fallen',
        )
      : battle.foes.map(
          (f, i) =>
            ((i === view.foe ? shown.enemy : f.hp) === 0 ? 'fallen' : i === view.foe ? 'active' : 'waiting') as
              'active' | 'waiting' | 'fallen',
        );
  const cap = roundCap(battle.foes.length);
  const tier = arenaTier(encounter.id);
  const restMinutes = battle.result === 'victory' ? ARENA_REST.win[tier - 1] : ARENA_REST.defeat;
  const nextSeason = ARENA_SEASON[seasonStep(save.arena.weekWins)];
  const seasonReached = battle.result === 'victory' && !!nextSeason && save.arena.weekWins + 1 >= nextSeason.wins;
  const content = (
    <>
      <div
        className={`battle-environment ${busy ? 'battle-playing' : ''} ${ultimate ? 'battle-ultimate' : ''}`}
        style={{ '--battle-speed': speed } as CSSProperties}
      >
        {!battle.result && (
          <div className="battle-controls">
            <button
              type="button"
              className={speed === 2 ? 'active' : ''}
              aria-pressed={speed === 2}
              onClick={toggleSpeed}
              title={tr('Viteză dublă', 'Double speed')}
            >
              ×2
            </button>
            <button
              type="button"
              onClick={skip}
              disabled={!fighters}
              title={tr('Sari la rezultat', 'Skip to the result')}
            >
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
            maxHp={allyState.maxHp}
            energy={view.ally === battle.active ? battle.energy : 0}
            pips={<Pips side="ally" states={pips('ally')} />}
            portrait={<DinosaurArt species={d.species} element={d.element} stage={d.stage} paused frame={0} />}
          >
            <EdgeBadge edge={elementEdge(d.element, foe.element)} lang={lang} />
          </BattleHud>
          <div className="battle-round battle-round-badge">
            <strong>VS</strong>
            <span>
              {tr('RUNDA', 'ROUND')} {Math.min(battle.round, cap)}/{cap}
            </span>
          </div>
          <BattleHud
            side="enemy"
            color={foeInfo.color}
            name={`${foeInfo.symbol} ${bossInfo?.name ?? `${SPECIES_NAMES[foe.species]} ${foeInfo.name[lang]}`}`}
            badge={bossInfo && <em className="arena-boss-tag">BOSS</em>}
            level={foe.level}
            hp={shown.enemy}
            maxHp={foe.maxHp}
            energy={foeHasUltimate(foe) ? (view.foe === battle.foeIndex ? battle.enemyEnergy : 0) : undefined}
            pips={<Pips side="enemy" states={pips('enemy')} />}
            portrait={<ArenaOpponent foe={foe} paused />}
          />
          <div
            className="battle-unit ally"
            data-motion={ally.clip}
            data-dodge={step?.dodge === 'ally' || undefined}
            style={ally.style}
          >
            <DinosaurArt
              species={d.species}
              element={d.element}
              stage={d.stage}
              animation={ally.clip}
              speed={speed}
              className={rarityClass(d.rarity)}
            />
          </div>
          <div className="battle-unit enemy" data-motion={enemy.clip} style={enemy.style}>
            <ArenaOpponent foe={foe} className="dinosaur-opponent" animation={enemy.clip} speed={speed} />
          </div>
          {step?.say?.map((c, i) => (
            <div
              key={`${index}-${i}`}
              className={`battle-callout on-${c.on} kind-${c.kind}`}
              style={{ '--row': i } as CSSProperties}
            >
              {calloutText(c, lang)}
            </div>
          ))}
          {step?.enter && (
            <div
              key={`enter-${view.ally}-${view.foe}`}
              className={`battle-callout on-${step.enter === 'enemy' ? 'enemy' : 'ally'} kind-enter`}
            >
              {tr('INTRĂ', 'IN')}: {step.enter === 'enemy' ? foeName : d.nickname}
            </div>
          )}
        </div>
      </div>
      {battle.result && told ? (
        <div className="battle-result">
          <span className="realm-eyebrow">{tr('REZULTAT', 'RESULT')}</span>
          <h2>
            {battle.result === 'victory'
              ? tr('Victorie!', 'Victory!')
              : battle.result === 'draw'
                ? tr('Remiză', 'Draw')
                : tr('Înfrângere', 'Defeat')}
          </h2>
          {battle.result === 'victory' && battle.stars && (
            <div className="result-stars" aria-label={`${battle.stars} / 3`}>
              <StarRow n={battle.stars} />
            </div>
          )}
          <div className="result-team">
            {battle.team.map((a) => {
              const m = save.dinos.find((x) => x.id === a.dinoId)!;
              return (
                <span
                  key={a.dinoId}
                  className={a.hp === 0 ? 'fallen' : ''}
                  title={`${m.nickname} · ${a.hp}/${a.maxHp}`}
                >
                  <DinosaurArt species={m.species} element={m.element} stage={m.stage} paused frame={0} />
                  <i style={{ width: `${(a.hp / a.maxHp) * 100}%` }} />
                </span>
              );
            })}
          </div>
          <p className="result-rest">
            {battle.result === 'victory'
              ? tr(
                  `Odihnă: ${restMinutes} min${battle.team.some((a) => a.hp === 0) ? `, căzuții ${ARENA_REST.fallen} min` : ''}.`,
                  `Rest: ${restMinutes} min${battle.team.some((a) => a.hp === 0) ? `, the fallen ${ARENA_REST.fallen} min` : ''}.`,
                )
              : battle.result === 'draw'
                ? tr(
                    `Biletul ți-a fost returnat. Echipa se odihnește ${restMinutes} min.`,
                    `Your ticket was returned. The team rests ${restMinutes} min.`,
                  )
                : tr(
                    `Echipa se întoarce în siguranță și se odihnește ${restMinutes} min. Încearcă un element mai potrivit sau niveluri mai mari.`,
                    `The team returns safely and rests ${restMinutes} min. Try a better-suited element or higher levels.`,
                  )}
          </p>
          {save.rewardPending && (
            <>
              {!!battle.reward.milestones && (
                <p className="result-milestone">★ {tr('Recompensă pentru stele inclusă!', 'Star reward included!')}</p>
              )}
              <p className="result-loot">
                +{battle.reward.gold} ● &nbsp; +{battle.reward.food} ❧
                {(Object.entries(battle.reward.materials) as [ItemId, number][]).map(([id, count]) => (
                  <small key={id}>
                    {' '}
                    · {ITEMS[id].icon} +{count}
                  </small>
                ))}
              </p>
              {battle.reward.egg && (
                <div className="result-egg">
                  <strong>
                    <Icon name="egg" scale={1} /> {tr('Ou găsit!', 'Egg found!')}{' '}
                    {battle.reward.egg.species === 'boss'
                      ? `BOSS ${ARENA_BOSSES[battle.reward.egg.element].name}`
                      : SPECIES_NAMES[battle.reward.egg.species]}{' '}
                    · {ELEMENTS.find((e) => e.id === battle.reward.egg!.element)!.name[lang]}
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
              <p className="result-season">
                <Icon name="trophy" scale={1} /> {tr('Sezon', 'Season')} {save.arena.weekWins + 1}
                {nextSeason && `/${nextSeason.wins}`}
                {seasonReached && ` · ${tr('recompensă', 'reward')}: ${seasonPrize(nextSeason!, lang)}!`}
              </p>
            </>
          )}
          <button className="realm-button" onClick={() => run({ type: 'claim' })}>
            {save.rewardPending
              ? tr('Colectează recompensa', 'Claim reward')
              : tr('Înapoi în arenă', 'Back to the arena')}
          </button>
        </div>
      ) : null}
    </>
  );
  return embedded ? (
    <div className="arena-embedded-battle">{content}</div>
  ) : (
    <Frame title={encounter.name[lang]} view="battle" close={close} lang={lang}>
      {content}
    </Frame>
  );
}

/**
 * A fighter's corner of the arena: portrait, name, health and energy, and a pip per team member. The amber strip
 * behind the health bar is the damage just taken; it drains after a short pause.
 */
function BattleHud({
  side,
  color,
  name,
  badge,
  level,
  hp,
  maxHp,
  energy,
  portrait,
  pips,
  children,
}: {
  side: Unit;
  color: string;
  name: string;
  badge?: ReactNode;
  level: number;
  hp: number;
  maxHp: number;
  energy?: number;
  portrait: ReactNode;
  pips?: ReactNode;
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
        <div
          className="battle-hud-bar health"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={maxHp}
          aria-valuenow={hp}
          aria-label="HP"
        >
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
        {pips}
        {children}
      </div>
    </div>
  );
}
