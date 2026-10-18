import { PLAYABLE_DINOSAURS, isPlayableDinosaur } from './playableDinosaurs';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ENCOUNTERS, ITEMS, RECIPES, type Encounter, type ItemId } from './content';
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
  workshop,
  SPECIES,
  SPECIES_NAMES,
  type Command,
  type RealmId,
  type Save,
  type Species,
} from './game';
import { DinosaurArt } from './DinosaurArt';
import { loadAnimation, loadBossAnimation, type Clip } from './animation';
import { entrance, exchange, fighter, rest, runMs, runStart, type BattleAction, type Fighter, type Step, type Unit } from './battleChoreography';
import { worldThumb } from './worldArt';
import { ArenaOpponent } from './ArenaOpponent';
import { arenaBoss } from './arenaBosses';
import { UpgradeCard } from './UpgradeCard';
import './gameplay.css';
import { Icon } from './ui/Icon';
export type GameplayView = 'expedition' | 'arena' | 'workshop';
/** Every fight has its own opponent: expeditions use their world's element; arena leagues are generated below. */
const OPPONENTS: Record<string, [Species, RealmId]> = {
  training: ['raptor', 'nature'],
  ruins: ['triceratops', 'earth'],
  canyon: ['ankylosaurus', 'fire'],
  frost: ['brachiosaurus', 'ice'],
  lagoon: ['raptor', 'water'],
  wind: ['triceratops', 'wind'],
  thunder: ['trex', 'lightning'],
  twilight: ['raptor', 'dark'],
  dawn: ['brachiosaurus', 'light'],
  sigils: ['ankylosaurus', 'arcane'],
};
export function opponentOf(encounter: Encounter) {
  const tier = Number(encounter.id.split('-')[2] ?? 1) - 1,
    league = ELEMENTS.findIndex((e) => e.id === encounter.league);
  // League opponents rotate through the five species; the champion tier is always an adult.
  const [species, element] =
    OPPONENTS[encounter.id] ??
    (league >= 0 ? [SPECIES[(league + tier * 2) % SPECIES.length], encounter.league as RealmId] : ['raptor', 'ice']);
  const animated = isPlayableDinosaur(species, element) ? { species, element }
    : PLAYABLE_DINOSAURS.find(d => d.element === element) ?? PLAYABLE_DINOSAURS[(Math.max(0, league) + tier) % PLAYABLE_DINOSAURS.length];
  return {
    species: animated.species,
    element: animated.element,
    stage: encounter.level >= 15 || tier === 2 ? ('adult' as const) : ('juvenile' as const),
    info: ELEMENTS.find((e) => e.id === animated.element)!,
  };
}
type Props = {
  save: Save;
  now: number;
  lang: number;
  run: (c: Command) => boolean;
  close: () => void;
  navigate: (v: GameplayView) => void;
  build: () => void;
};
const T = (lang: number, ro: string, en: string) => (lang ? en : ro);
const time = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
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
              <DinosaurArt species={hero.species} element={hero.element} stage={hero.stage} />
              <strong>
                {hero.nickname} · {hero.level}
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
          <b>🥚</b>
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
  const [selected, setSelected] = useState('training'),
    [recipeId, setRecipe] = useState('planks');
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
    setSelected(view === 'arena' ? 'arena-fire-1' : 'training');
    setLeague('fire');
  }, [view]);
  const gateOpen = (id: RealmId) => !GATE_LEAGUES.includes(id) || save.arenaLevel >= 2;
  const leagueOpen = (id: RealmId) => !!save.habitats[id] && gateOpen(id);
  const leagueEncounters = ENCOUNTERS.filter((e) => e.mode === 'arena' && e.league === league);
  const encounter = ENCOUNTERS.find((e) => e.id === selected) ?? ENCOUNTERS[0],
    repeat = save.cleared.includes(encounter.id);
  const hasBuilding = save.buildings.some(
    (b) => b.kind === (view === 'workshop' ? 'workshop' : view === 'arena' ? 'arena' : 'portal'),
  );
  const locked =
    (!!encounter.requires && !save.cleared.includes(encounter.requires)) ||
    (!!encounter.league && !leagueOpen(encounter.league as RealmId));
  const hero = champion(save);
  const canBattle =
    !!hero &&
    hero.stage !== 'baby' &&
    hero.level >= encounter.level &&
    !locked &&
    (encounter.id === 'training' || hasBuilding);
  const start = () => {
    if (save.battle || run({ type: 'battle', encounterId: encounter.id })) close();
  };
  const recipe = RECIPES.find((r) => r.id === recipeId)!;
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
      {view === 'workshop' ? (
        <div className="crafting-layout">
          <aside className="craft-inventory">
            <div className="gameplay-section-label">{tr('RESURSE', 'RESOURCES')}</div>
            <div className="craft-material-grid">
              {(Object.keys(ITEMS) as ItemId[]).map((id) => (
                <div key={id}>
                  <span style={{ color: ITEMS[id].color }}>{ITEMS[id].icon}</span>
                  <strong>{ready.inventory[id]}</strong>
                  <small>{ITEMS[id].name[lang]}</small>
                </div>
              ))}
            </div>
            <p className="gameplay-small">
              {tr(
                'Materialele vin din expediții și luptele din arenă.',
                'Materials come from expeditions and arena battles.',
              )}
            </p>
          </aside>
          <div className="craft-workspace">
            <div className="craft-recipe-tabs">
              {RECIPES.map((r) => (
                <button className={r.id === recipeId ? 'active' : ''} onClick={() => setRecipe(r.id)} key={r.id}>
                  {ITEMS[r.output].icon} {r.name[lang]}
                </button>
              ))}
            </div>
            <div className="craft-parchment">
              <span className="realm-eyebrow">{tr('REȚETĂ DE ATELIER', 'WORKSHOP RECIPE')}</span>
              <h2>{recipe.name[lang]}</h2>
              <div className="craft-transformation">
                <div className="craft-inputs">
                  {(Object.entries(recipe.cost) as [ItemId, number][]).map(([id, count]) => (
                    <div key={id}>
                      <span style={{ color: ITEMS[id].color }}>{ITEMS[id].icon}</span>
                      <strong className={save.inventory[id] < count ? 'missing' : ''}>
                        {save.inventory[id]} / {count}
                      </strong>
                      <small>{ITEMS[id].name[lang]}</small>
                    </div>
                  ))}
                </div>
                <span className="craft-arrow">→</span>
                <div className="craft-output">
                  <span style={{ color: ITEMS[recipe.output].color }}>{ITEMS[recipe.output].icon}</span>
                  <strong>×{recipe.quantity}</strong>
                  <small>{ITEMS[recipe.output].name[lang]}</small>
                </div>
              </div>
              <p>
                {time(Math.round(recipe.seconds * 1000 * workshop(save).speed))} ·{' '}
                {workshop(save).lanes > 1
                  ? tr(`${workshop(save).lanes} procese deodată`, `${workshop(save).lanes} jobs at once`)
                  : tr('Un proces activ', 'One active job')}{' '}
                + {workshop(save).slots - workshop(save).lanes} {tr('în așteptare', 'queued')}
              </p>
              <button
                className="realm-button"
                disabled={
                  !hasBuilding ||
                  activeJobs >= workshop(save).slots ||
                  !(Object.entries(recipe.cost) as [ItemId, number][]).every(
                    ([id, count]) => save.inventory[id] >= count,
                  )
                }
                onClick={() => run({ type: 'craft', recipeId: recipe.id })}
              >
                ⚒ {tr('Fabrică', 'Craft')}
              </button>
              {!hasBuilding && (
                <button className="realm-link" onClick={build}>
                  {tr('Construiește atelierul · 200 aur', 'Build the workshop · 200 gold')}
                </button>
              )}
            </div>
            <div className="craft-queue">
              <div className="gameplay-section-label">
                {tr('COADA ATELIERULUI', 'WORKSHOP QUEUE')}{' '}
                <small>
                  {activeJobs} / {workshop(save).slots} · {tr('Nv.', 'Lv.')} {save.workshopLevel}
                </small>
              </div>
              {save.crafting.length === 0 ? (
                <p className="gameplay-small">{tr('Alege o rețetă pentru a începe.', 'Choose a recipe to begin.')}</p>
              ) : (
                save.crafting.map((job) => {
                  const r = RECIPES.find((r) => r.id === job.recipeId)!;
                  const finished = now >= job.endsAt,
                    queued = now < job.startedAt;
                  return (
                    <div className="craft-job" key={job.id}>
                      <span>{ITEMS[r.output].icon}</span>
                      <div>
                        <strong>
                          {r.name[lang]} ×{r.quantity}
                        </strong>
                        <small>
                          {finished
                            ? tr('Gata de colectat', 'Ready to collect')
                            : queued
                              ? tr('În așteptare', 'Queued')
                              : time(job.endsAt - now)}
                        </small>
                        <i>
                          <b
                            style={{
                              width: `${Math.max(0, Math.min(100, ((now - job.startedAt) / (job.endsAt - job.startedAt)) * 100))}%`,
                            }}
                          />
                        </i>
                      </div>
                      {finished ? (
                        <button className="realm-button" onClick={() => run({ type: 'claimCraft', jobId: job.id })}>
                          {tr('Colectează', 'Collect')}
                        </button>
                      ) : queued ? (
                        <button className="realm-link" onClick={() => run({ type: 'cancelCraft', jobId: job.id })}>
                          {tr('Anulează', 'Cancel')}
                        </button>
                      ) : (
                        <small>{tr('În lucru', 'Working')}</small>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <aside className="craft-use">
            {hasBuilding && (
              <UpgradeCard
                save={save}
                lang={lang}
                level={save.workshopLevel}
                max={WORKSHOP_LEVELS.length}
                next={(() => {
                  const now = workshop(save),
                    next = WORKSHOP_LEVELS[save.workshopLevel];
                  if (!next) return [];
                  return [
                    next.slots > now.slots && (
                      <>
                        ⚒ {now.slots} → <b>{next.slots}</b> {tr('locuri în coadă', 'queue slots')}
                      </>
                    ),
                    next.speed < now.speed && (
                      <>
                        ⏱ <b>{Math.round((1 - next.speed) * 100)}%</b> {tr('mai rapid', 'faster crafting')}
                      </>
                    ),
                    next.lanes > now.lanes && (
                      <>
                        ⚙ <b>{next.lanes}</b> {tr('procese deodată', 'jobs at once')}
                      </>
                    ),
                  ].filter(Boolean);
                })()}
                gold={WORKSHOP_LEVELS[save.workshopLevel]?.gold ?? 0}
                materials={WORKSHOP_LEVELS[save.workshopLevel]?.materials ?? {}}
                upgrade={() => run({ type: 'upgradeWorkshop' })}
              />
            )}
            <div className="gameplay-section-label">{tr('OBIECTE UTILE', 'USE YOUR ITEMS')}</div>
            <p>{tr('Progres pentru lumi și eroi.', 'Progress for worlds and heroes.')}</p>
            {[
              {
                id: 'habitatKit' as const,
                action: { type: 'upgradeHabitat', realm: hero?.element ?? 'fire' } as Command,
                label: `${tr('+1 nivel habitat', '+1 habitat level')} · ${
                  ELEMENTS.find((e) => e.id === (hero?.element ?? 'fire'))!.name[lang]
                } (${HABITAT_LEVELS[save.habitats[hero?.element ?? 'fire'] ?? 0]?.gold ?? '—'} ●)`,
                disabled: (save.habitats[hero?.element ?? 'fire'] ?? HABITAT_LEVELS.length) >= HABITAT_LEVELS.length,
              },
              {
                id: 'evolutionCrystal' as const,
                action: { type: 'useCrystal' } as Command,
                label: `${tr('+1 nivel pentru', '+1 level for')} ${hero?.nickname ?? '—'}`,
                disabled: !hero || !!save.battle || hero.level >= 50 || [9, 24].includes(hero.level),
              },
              {
                id: 'lamp' as const,
                action: { type: 'placeLamp' } as Command,
                label: tr('Lampă pe insula principală', 'Lamp on your main island'),
                disabled: save.lanterns >= 4,
              },
            ].map((item) => (
              <div key={item.id}>
                <span>{ITEMS[item.id].icon}</span>
                <strong>
                  {ITEMS[item.id].name[lang]} · {save.inventory[item.id]}
                </strong>
                <p>{item.label}</p>
                <button
                  className="realm-button secondary"
                  disabled={item.disabled || save.inventory[item.id] === 0}
                  onClick={() => run(item.action)}
                >
                  {tr('Folosește', 'Use')}
                </button>
              </div>
            ))}
          </aside>
        </div>
      ) : (
        <div className="adventure-layout">
          <div
            ref={mapRef}
            className={view === 'arena' ? 'arena-lobby-scene' : 'adventure-map'}
            onPointerDown={(e) => {
              if (view !== 'expedition' || (e.target as HTMLElement).closest('button')) return;
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
            {view === 'expedition' ? (
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
                      onClick={() => setSelected(e.id)}
                      aria-label={e.name[lang]}
                    >
                      <span>
                        {save.cleared.includes(e.id) ? '✓' : ELEMENTS.find((el) => el.id === e.image)?.symbol}
                      </span>
                      <strong>
                        {ELEMENTS.find((el) => el.id === e.image)?.name[lang]}
                        <small>{e.name[lang]}</small>
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
                <ArenaOpponent
                  encounter={encounter}
                  key={encounter.id}
                  className="arena-lobby-enemy"
                  species={opponentOf(encounter).species}
                  element={opponentOf(encounter).element}
                  stage={opponentOf(encounter).stage}
                />
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
                      <span>{save.cleared.includes(e.id) ? '✓' : `0${i + 1}`}</span>
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
          <aside className="adventure-detail">
            <div
              className="destination-cover"
              style={{ backgroundImage: `url('${worldThumb(encounter.image as RealmId)}')` }}
            >
              <span>{encounter.name[lang]}</span>
            </div>
            <div className="adventure-detail-body">
              <div className="gameplay-section-label">
                {tr('RECOMPENSE', 'REWARDS')}{' '}
                <small>{repeat ? tr('REJUCARE', 'REPLAY') : tr('PRIMA VICTORIE', 'FIRST VICTORY')}</small>
              </div>
              <Rewards
                encounter={encounter}
                repeat={repeat}
                lang={lang}
                eggChance={save.eggLuck >= EGG_DROP.pity ? 1 : eggOdds(save, encounter, !repeat)?.chance}
                bonus={encounter.mode === 'arena' ? ARENA_LEVELS[save.arenaLevel - 1].bonus : 0}
              />
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
              <Team save={save} lang={lang} />
              <div className="encounter-condition">
                {opponentOf(encounter).info.symbol}{' '}
                {arenaBoss(encounter)
                  ? `BOSS ${arenaBoss(encounter)!.name} · ${SPECIES_NAMES[opponentOf(encounter).species]}`
                  : `${SPECIES_NAMES[opponentOf(encounter).species]} ${opponentOf(encounter).info.name[lang]}`}{' '}
                · {tr('Nivel recomandat', 'Recommended level')} {encounter.level}
                <br />
                {tr('Rol', 'Role')}: {opponentOf(encounter).info.role[lang]}
              </div>
              {locked && (
                <p className="gameplay-warning">
                  {tr('Câștigă mai întâi întâlnirea precedentă.', 'Win the previous encounter first.')}
                </p>
              )}
              {!hero || hero.stage === 'baby' ? (
                <p className="gameplay-warning">
                  {tr(
                    'Alege un campion juvenil sau adult (Dinozauri → Campion).',
                    'Pick a juvenile or adult champion (Dinosaurs → Champion).',
                  )}
                </p>
              ) : null}
              <button className="realm-button adventure-start" disabled={!save.battle && !canBattle} onClick={start}>
                {save.battle ? tr('Reia lupta', 'Resume battle') : tr('Începe aventura', 'Begin adventure')} →
              </button>
              {!hasBuilding && encounter.id !== 'training' && (
                <button className="realm-link" onClick={build}>
                  {view === 'arena'
                    ? tr('Construiește Poarta arenei', 'Build the Arena Gate')
                    : tr('Construiește Portalul de expediții', 'Build the Expedition Portal')}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </Frame>
  );
}
export function BattleScreen({ save, lang, run, close }: Pick<Props, 'save' | 'lang' | 'run' | 'close'>) {
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
  useEffect(() => {
    let active = true;
    Promise.all([
      loadAnimation(d.species, d.element, d.stage),
      boss ? loadBossAnimation(encounter.league as RealmId) : loadAnimation(foe.species, foe.element, foe.stage),
    ]).then(([a, e]) => {
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
    if (!['basic', 'skill', 'defend', 'ultimate'].includes(battle.log)) return;
    setSteps(exchange(battle.log as BattleAction, fighters.ally, fighters.enemy, alive));
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.round, fighters]);
  const step = steps[index],
    busy = !!step && Number.isFinite(step.ms);
  useEffect(() => {
    if (!step) return;
    if (step.reveal === 'enemy') setShown((s) => ({ ...s, enemy: battle.enemy }));
    if (step.reveal === 'ally') setShown((s) => ({ ...s, hp: battle.hp }));
    if (!Number.isFinite(step.ms)) {
      setShown({ hp: battle.hp, enemy: battle.enemy });
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), step.ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, index]);
  const pose = (unit: Unit) => ({
    clip: step?.[unit] ?? ('idle' as Clip),
    // Static artwork never changes with the clip, so it keeps one key and never flickers through remounts.
    key: fighters?.[unit].clips.size ? `${runStart(steps, index, unit)}-${step?.[unit] ?? 'idle'}` : 'static',
    style: { '--motion-ms': `${runMs(steps, index, unit) || 600}ms` } as CSSProperties,
  });
  const ally = pose('ally'),
    enemy = pose('enemy');
  const foeName = boss ? `BOSS ${boss.name}` : SPECIES_NAMES[foe.species];
  const action = (name: BattleAction) => {
    if (busy) return;
    run({ type: 'action', action: name });
  };
  const narration = !step
    ? ''
    : step.ally === 'walk' || step.enemy === 'walk'
      ? `${d.nickname} ${tr('intră în arenă.', 'enters the arena.')}`
      : busy && step.enemy === 'attack' && step.ally === 'defend'
        ? `${d.nickname} ${tr('se apără. Lovitura inamică este redusă.', 'guards. The incoming hit is reduced.')}`
        : busy && step.enemy === 'attack'
          ? `${foeName} ${tr('ripostează!', 'strikes back!')}`
          : busy && step.ally === 'ultimate'
            ? `${d.nickname} ${tr('dezlănțuie Erupția!', 'unleashes the Eruption!')}`
            : busy && step.ally === 'attack'
              ? `${d.nickname} ${tr('lovește!', 'strikes!')}`
              : busy
                ? ''
                : battle.log === 'start'
                  ? `${d.nickname} ${tr('este pregătit. Alege prima acțiune.', 'is ready. Choose your first action.')}`
                  : battle.log === 'defend'
                    ? `${d.nickname} ${tr('se apără. Lovitura inamică este redusă.', 'guards. The incoming hit is reduced.')}`
                    : tr(
                        'Lovitura a fost rezolvată. Adversarul răspunde dacă mai este în viață.',
                        'The strike resolves. The opponent responds if still alive.',
                      );
  const commands: BattleAction[] = d.stage === 'adult' ? ['basic', 'defend', 'ultimate'] : ['basic', 'defend'];
  return (
    <Frame title={encounter.name[lang]} view="battle" close={close} lang={lang}>
      <div className={`battle-environment ${busy ? 'battle-playing' : ''}`}>
        <div className="battle-round">
          <span>
            {tr('RUNDA', 'ROUND')} {Math.min(battle.round, 30)} / 30
          </span>
          <small>
            {d.nickname} → {foeName} · 1v1
          </small>
        </div>
        <div className="battle-unit ally" data-motion={ally.clip} style={ally.style}>
          <div className="battle-vitals">
            <strong>
              {el.symbol} {d.nickname} <small>Lv. {d.level}</small>
            </strong>
            <div className="realm-meter health">
              <i style={{ width: `${(shown.hp / battle.maxHp) * 100}%` }} />
            </div>
            <span>
              {shown.hp} / {battle.maxHp} HP
            </span>
            <div className="realm-meter energy">
              <i style={{ width: `${battle.energy}%` }} />
            </div>
            <small>ϟ {battle.energy} / 100</small>
          </div>
          <DinosaurArt key={ally.key} species={d.species} element={d.element} stage={d.stage} animation={ally.clip} />
        </div>
        <div className="battle-unit enemy" data-motion={enemy.clip} style={enemy.style}>
          <div className="battle-vitals">
            <strong>
              {foe.info.symbol} {boss?.name ?? `${SPECIES_NAMES[foe.species]} ${foe.info.name[lang]}`}{' '}
              <small>Lv. {encounter.level}</small>
            </strong>
            <div className="realm-meter health">
              <i style={{ width: `${(shown.enemy / battle.enemyMax) * 100}%` }} />
            </div>
            <span>
              {shown.enemy} / {battle.enemyMax} HP
            </span>
          </div>
          <ArenaOpponent
            key={enemy.key}
            encounter={encounter}
            species={foe.species}
            element={foe.element}
            stage={foe.stage}
            className="dinosaur-opponent"
            animation={enemy.clip}
          />
        </div>
        {step?.impact && (
          <div className={`battle-impact on-${step.impact.on} kind-${step.impact.kind}`} key={index} aria-hidden="true">
            {step.impact.kind === 'guard' ? '◇' : step.impact.kind === 'ultimate' ? '✹' : '╱'}
          </div>
        )}
        <div className="battle-narration" aria-live="polite">
          {narration}
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
          {save.rewardPending && (
            <>
              <p>
                +{battle.reward.gold} ● &nbsp; +{battle.reward.food} ❧
              </p>
              {battle.reward.egg && (
                <div className="result-egg">
                  <strong>
                    🥚 {tr('Ou găsit!', 'Egg found!')} {SPECIES_NAMES[battle.reward.egg.species]} ·{' '}
                    {ELEMENTS.find((e) => e.id === battle.reward.egg!.element)!.name[lang]}
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
      ) : (
        <div className="battle-command-bar">
          {/* Only moves with a matching clip: basic → attack, defend → defend, ultimate → adult-only ultimate. */}
          {commands.map((name) => (
            <button
              key={name}
              className={`battle-command ${name}`}
              disabled={busy || !!battle.result || (name === 'ultimate' && battle.energy < 100)}
              onClick={() => action(name)}
            >
              <span>{name === 'basic' ? '⚔' : name === 'defend' ? '◇' : '✹'}</span>
              <strong>
                {name === 'basic'
                  ? tr('Lovitură', 'Basic')
                  : name === 'defend'
                    ? tr('Apărare', 'Defend')
                    : tr('Erupție', 'Eruption')}
              </strong>
              <small>
                {name === 'ultimate' ? '100 ϟ' : name === 'defend' ? '−40% damage' : tr('+25 energie', '+25 energy')}
              </small>
            </button>
          ))}
        </div>
      )}
    </Frame>
  );
}
