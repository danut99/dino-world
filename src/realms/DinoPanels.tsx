import { ResourceHelp, RequirementLink } from './ResourceHelp';
import { RarityBadge, rarityClass } from './Rarity';
import { ARENA_BOSSES } from './arenaBosses';
import { playableSpecies } from './playableDinosaurs';
import { useState, type CSSProperties } from 'react';
import { Icon } from './ui/Icon';
import { DinosaurArt } from './DinosaurArt';
import './dino-sheet.css';
import { duration } from './FarmPanel';
import { ITEMS, type ItemId } from './content';
import {
  BALANCE,
  ELEMENTS,
  HABITAT_LEVELS,
  HATCHERY_LEVELS,
  MARKET_ELEMENTS,
  REALM_NAMES,
  SPECIES_NAMES,
  WORLD_UNLOCK,
  dinoIncome,
  eggPrice,
  eggSellPrice,
  feedCost,
  goldCap,
  goldRate,
  habitatCapacity,
  hatcherySlots,
  incubating,
  residents,
  stats,
  type Command,
  type Dino,
  type RealmId,
  type Save,
  type Species,
  type Stage,
} from './game';
import { rarityOf, gemsToFinish, type Rarity } from './game';

type Run = (c: Command) => boolean;
const tr = (lang: number, ro: string, en: string) => (lang ? en : ro);
const element = (id: RealmId) => ELEMENTS.find((e) => e.id === id)!;
/** First and last level of each age; evolving happens at the last level of baby and juvenile. */
const STAGE_LEVELS: Record<Stage, [number, number]> = { baby: [1, 9], juvenile: [10, 24], adult: [25, 50] };
/** The four battle stats, with their icon and name. */
const STAT_ROWS = [
  ['hp', 'heart', 'Viață', 'Health'],
  ['power', 'sword', 'Putere', 'Power'],
  ['defense', 'shield', 'Apărare', 'Defense'],
  ['speed', 'energy', 'Viteză', 'Speed'],
] as const;
const stageName = (s: Stage, lang: number) =>
  ({ baby: ['Copil', 'Baby'], juvenile: ['Juvenil', 'Juvenile'], adult: ['Adult', 'Adult'] })[s][lang];
/** Un ou PixelLab pe tărâm (64 px), comun tuturor speciilor acelui element; eclozarea are animația lui. */
export const eggSrc = (realm: RealmId) => `/realms/eggs/${realm}.png`;
export const hatchSrc = (realm: RealmId) => `/realms/eggs/${realm}-hatch.png`;
export function EggArt({ realm, species, size = 64, hatching = false, rarity }: { species?: Species; realm: RealmId; size?: number; hatching?: boolean; rarity?: Rarity }) {
  return (
    <span className={`realm-egg${hatching ? ' hatching' : ''} ${rarityClass(rarity)}`} style={{ width: size, height: size, '--egg-size': `${size}px`, '--hatch-sheet': `url('${hatchSrc(realm)}')` } as React.CSSProperties}>
      <img src={eggSrc(realm)} alt={species === 'boss' ? `BOSS ${ARENA_BOSSES[realm].name}` : ''} width={size} height={size} draggable={false} />
      {species === 'boss' && <span aria-hidden="true" style={{ position: 'absolute', right: 0, top: 0, color: '#ffe098', fontSize: Math.max(12, size / 4), textShadow: '1px 1px #241832' }}>?</span>}
    </span>
  );
}

function Costs({ save, gold, materials }: { save: Save; gold: number; materials: Partial<Record<ItemId, number>> }) {
  return (
    <div className="realm-farm-costs">
      <span className={save.gold >= gold ? '' : 'short'}>{gold} ●</span>
      {(Object.entries(materials) as [ItemId, number][]).map(([id, n]) => (
        <span key={id} className={save.inventory[id] >= n ? '' : 'short'}>
          {ITEMS[id].icon} {save.inventory[id]}/{n}
        </span>
      ))}
    </div>
  );
}

export function HatcheryPanel({
  save,
  now,
  lang,
  run,
  onHatched,
  openMarket,
  move,
}: {
  save: Save;
  now: number;
  lang: number;
  run: Run;
  /** Called after a hatch succeeds; the new dinosaur is the last one in `dinos`. */
  onHatched: () => void;
  openMarket: () => void;
  move: () => void;
}) {
  const [hatchingId, setHatchingId] = useState<string | null>(null);
  const busy = incubating(save).length,
    slots = hatcherySlots(save),
    next = HATCHERY_LEVELS[save.hatcheryLevel];
  const hatching = incubating(save),
    waiting = save.eggs.filter((e) => e.hatchAt === null);
  // Selling takes a second click on the same egg, so a stray click never loses one.
  const [selling, setSelling] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const allNests = HATCHERY_LEVELS[HATCHERY_LEVELS.length - 1].slots;
  const eggName = (egg: { species: Species; element: RealmId }) =>
    egg.species === 'boss' ? `BOSS ${ARENA_BOSSES[egg.element].name}` : SPECIES_NAMES[egg.species];
  return (
    <div className="realm-dino-panel hatch2">
      {/* Level, eggs owned, and the upgrade folded into one button. */}
      <header className="hatch2-head">
        <span className="realm-farm-level">
          <small>{tr(lang, 'NIVEL', 'LEVEL')}</small>
          {save.hatcheryLevel}
          <small>/ {HATCHERY_LEVELS.length}</small>
        </span>
        <div>
          <strong>
            {busy}/{slots} {tr(lang, 'cuiburi ocupate', 'nests in use')}
          </strong>
          <small>
            {save.eggs.length}/{BALANCE.maxEggs} {tr(lang, 'ouă deținute', 'eggs owned')}
            {save.owedEggs.length > 0 && ` · +${save.owedEggs.length} ${tr(lang, 'așteaptă loc', 'waiting for room')}`}
          </small>
        </div>
        {next ? (
          <button className={`hatch2-upgrade-toggle${showUpgrade ? ' open' : ''}`} aria-expanded={showUpgrade} onClick={() => setShowUpgrade((v) => !v)}>
            ⬆ {tr(lang, 'Nivel', 'Level')} {save.hatcheryLevel + 1} · {next.gold} ●
          </button>
        ) : (
          <span className="hatch2-max">★ {tr(lang, 'Nivel maxim', 'Max level')}</span>
        )}
        <button className="realm-link" onClick={move}>
          {tr(lang, 'Mută', 'Move')}
        </button>
      </header>
      {next && showUpgrade && (
        <div className="realm-farm-upgrade hatch2-upgrade">
          <div>
            <ul>
              <li>
                <Icon name="egg" scale={1} /> {slots} → <b>{next.slots}</b> {tr(lang, 'cuiburi', 'nests')}
              </li>
            </ul>
            <Costs save={save} gold={next.gold} materials={next.materials} />
            <ResourceHelp save={save} lang={lang} gold={next.gold} materials={next.materials} />
          </div>
          <button
            className="realm-button"
            disabled={save.gold < next.gold || Object.entries(next.materials).some(([id, n]) => save.inventory[id as ItemId] < n!)}
            onClick={() => run({ type: 'upgradeHatchery' })}
          >
            {tr(lang, 'Îmbunătățește', 'Upgrade')}
          </button>
        </div>
      )}

      {/* Every nest on one shelf: warming, ready, free or still locked. */}
      <h4 className="realm-farm-title">{tr(lang, 'Cuiburi', 'Nests')}</h4>
      <div className="hatch2-nests realm-nests">
        {Array.from({ length: allNests }, (_, i) => {
          if (i >= slots)
            return (
              <div key={i} className="hatch2-nest locked" title={tr(lang, 'Se deblochează la nivelul', 'Unlocks at level') + ` ${HATCHERY_LEVELS.findIndex((l) => l.slots > i) + 1}`}>
                <span>🔒</span>
                <small>
                  {tr(lang, 'Nv.', 'Lv.')} {HATCHERY_LEVELS.findIndex((l) => l.slots > i) + 1}
                </small>
              </div>
            );
          const egg = hatching[i];
          if (!egg)
            return (
              <div key={i} className="hatch2-nest free">
                <span className="hatch2-nest-bed" />
                <small>{tr(lang, 'Liber', 'Free')}</small>
              </div>
            );
          const left = Math.max(0, egg.hatchAt! - now),
            ready = left === 0,
            full = residents(save, egg.element).length >= habitatCapacity(save, egg.element),
            blocked = !save.habitats[egg.element] || full;
          return (
            <div key={egg.id} className={`hatch2-nest ${ready ? 'ready' : 'warming'}`} style={{ '--egg-glow': element(egg.element).color } as React.CSSProperties}>
              <EggArt species={egg.species} realm={egg.element} size={64} hatching={hatchingId === egg.id} rarity={egg.rarity} />
              <strong>{eggName(egg)}</strong>
              {ready ? (
                <button
                  className="realm-button"
                  disabled={!!hatchingId || blocked}
                  title={blocked ? (!save.habitats[egg.element] ? tr(lang, 'Deblochează mai întâi lumea lui.', 'Unlock its world first.') : tr(lang, 'Habitatul e plin.', 'The habitat is full.')) : undefined}
                  onClick={() => {
                    // animația de eclozare rulează întâi; comanda se dă la final (aceeași regulă de joc)
                    setHatchingId(egg.id);
                    window.setTimeout(() => {
                      setHatchingId(null);
                      if (run({ type: 'hatch', eggId: egg.id })) onHatched();
                    }, 1400);
                  }}
                >
                  {tr(lang, 'Eclozează', 'Hatch')}
                </button>
              ) : (
                <>
                  <div className="realm-meter">
                    <i style={{ width: `${Math.min(100, (1 - left / (egg.seconds * 1000)) * 100)}%` }} />
                  </div>
                  <small>⏱ {duration(Math.ceil(left / 1000))}</small>
                  <button className="realm-gem-finish" disabled={save.gems < gemsToFinish(left)} onClick={() => run({ type: 'gemFinish', target: 'egg', id: egg.id })} title={tr(lang, 'Termină acum cu diamante', 'Finish now with diamonds')}>
                    ⚡ {gemsToFinish(left)} 💎
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {hatching.some((egg) => egg.hatchAt! <= now && (!save.habitats[egg.element] || residents(save, egg.element).length >= habitatCapacity(save, egg.element))) && (
        <RequirementLink
          title={tr(lang, 'Un ou nu are unde să eclozeze', 'An egg has nowhere to hatch')}
          detail={tr(lang, 'Deblochează lumea lui sau fă loc în habitat.', 'Unlock its world or make room in its habitat.')}
          route={{ panel: 'realms', realm: hatching.find((egg) => egg.hatchAt! <= now)!.element }}
        />
      )}

      {/* Your eggs as cards: one click puts an egg in the first free nest. */}
      <h4 className="realm-farm-title">
        {tr(lang, 'Ouăle tale', 'Your eggs')} · {waiting.length}
      </h4>
      {busy >= slots && waiting.length > 0 && (
        <p className="hatch2-note">{tr(lang, 'Toate cuiburile sunt ocupate. Așteaptă o eclozare sau îmbunătățește incubatorul.', 'Every nest is busy. Wait for a hatch or upgrade the hatchery.')}</p>
      )}
      <div className="hatch2-eggs">
        {waiting.map((egg) => (
          <div key={egg.id} className="hatch2-egg" style={{ '--egg-glow': element(egg.element).color } as React.CSSProperties}>
            <EggArt species={egg.species} realm={egg.element} size={56} rarity={egg.rarity} />
            <strong>{eggName(egg)}</strong>
            <small>
              {element(egg.element).symbol} {element(egg.element).name[lang]} · ⏱ {duration(egg.seconds)}
            </small>
            <RarityBadge rarity={rarityOf(egg)} lang={lang} short />
            <button className="realm-button" disabled={busy >= slots} onClick={() => run({ type: 'incubate', eggId: egg.id })}>
              {tr(lang, 'Incubează', 'Incubate')}
            </button>
            {egg.id !== 'egg-ignis' && egg.species !== 'boss' && (
              <button
                className={`realm-egg-sell${selling === egg.id ? ' confirm' : ''}`}
                onClick={() => {
                  if (selling !== egg.id) return setSelling(egg.id);
                  setSelling(null);
                  run({ type: 'sellEgg', eggId: egg.id });
                }}
                onBlur={() => setSelling((id) => (id === egg.id ? null : id))}
                title={tr(lang, 'Vinde oul', 'Sell this egg')}
              >
                {selling === egg.id ? `${tr(lang, 'Sigur?', 'Sure?')} +${eggSellPrice(egg.element)} ●` : `${tr(lang, 'Vinde', 'Sell')} ${eggSellPrice(egg.element)} ●`}
              </button>
            )}
          </div>
        ))}
        <button className="hatch2-egg hatch2-market" onClick={openMarket}>
          <span>+</span>
          <strong>{tr(lang, 'Mai multe ouă', 'More eggs')}</strong>
          <small>{tr(lang, 'Piața, lupte și expediții', 'Market, fights and expeditions')}</small>
        </button>
      </div>
    </div>
  );
}

export function MarketPanel({
  save,
  lang,
  run,
  build,
  openHabitats,
}: {
  save: Save;
  lang: number;
  run: Run;
  build: () => void;
  openHabitats: () => void;
}) {
  const owned = ELEMENTS.filter((e) => save.habitats[e.id] && MARKET_ELEMENTS.includes(e.id));
  const [realm, setRealm] = useState<RealmId>(owned[0]?.id ?? 'fire');
  if (!save.buildings.some((b) => b.kind === 'market'))
    return (
      <div className="realm-centered">
        <span className="realm-large-symbol">⚖</span>
        <h3>{tr(lang, 'Piața nu e construită', 'The market is not built yet')}</h3>
        <p>{tr(lang, 'Construiește Piața ca să cumperi ouă.', 'Build the Market to buy eggs.')}</p>
        <button className="realm-button" onClick={build}>
          {tr(lang, 'Construiește', 'Build')}
        </button>
      </div>
    );
  return (
    <div className="realm-dino-panel">
      <p className="realm-intro">
        {tr(
          lang,
          'Piața vinde ouă de foc, apă și pământ, pentru lumile în care ai habitat. Oul își păstrează specia și elementul.',
          'The market sells fire, water and earth eggs for worlds where you own a habitat. Each egg keeps its species and element.',
        )}
      </p>
      <p className="realm-market-note">
        <Icon name="egg" scale={1} />{' '}
        {tr(
          lang,
          'Ouăle celorlalte elemente se câștigă: în liga arenei fiecărei lumi (bossul dă sigur un ou prima dată) și, mai rar, în expediții. Ouăle de care nu ai nevoie le poți vinde din Incubator.',
          "Other elements' eggs are won: in each world's arena league (its boss always drops one the first time) and, more rarely, on expeditions. Sell eggs you don't need from the Hatchery.",
        )}
      </p>
      <div className="dinosaur-filters">
        {owned.map((e) => (
          <button key={e.id} aria-pressed={realm === e.id} onClick={() => setRealm(e.id)}>
            {e.symbol} {e.name[lang]}
          </button>
        ))}
        {owned.length < MARKET_ELEMENTS.length && (
          <button onClick={openHabitats}>＋ {tr(lang, 'Habitat nou', 'New habitat')}</button>
        )}
      </div>
      <div className="realm-egg-grid">
        {playableSpecies(realm).map((species) => (
          <div key={species} className="realm-egg-card">
            <EggArt species={species} realm={realm} />
            <strong>{SPECIES_NAMES[species]}</strong>
            <small>
              {element(realm).role[lang]} · ⏱ {duration(BALANCE.eggSeconds)}
            </small>
            <ResourceHelp save={save} lang={lang} gold={eggPrice(realm)} />
            {save.eggs.length >= BALANCE.maxEggs && <RequirementLink title={tr(lang, 'Depozitul de ouă este plin', 'Egg storage is full')} detail={tr(lang, 'Incubează sau vinde ouă din Incubator.', 'Incubate or sell eggs in the Hatchery.')} route={{ panel: 'hatchery' }} />}
            <button
              className="realm-button"
              disabled={save.gold < eggPrice(realm) || save.eggs.length >= BALANCE.maxEggs}
              onClick={() => run({ type: 'buyEgg', species, element: realm })}
            >
              {eggPrice(realm)} ●
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HabitatsPanel({
  save,
  lang,
  run,
  visit,
  openWorkshop,
}: {
  save: Save;
  lang: number;
  run: Run;
  visit: (realm: RealmId) => void;
  openWorkshop: () => void;
}) {
  const cap = goldCap(save);
  return (
    <div className="realm-dino-panel">
      <div className="realm-farm-head">
        <span className="realm-farm-level">
          <small>{tr(lang, 'AUR', 'GOLD')}</small>●
        </span>
        <div>
          <strong>
            {Math.floor(save.storedGold)} / {cap} {tr(lang, 'aur strâns', 'gold stored')}
          </strong>
          <small>
            {Math.round(goldRate(save))}{' '}
            {tr(lang, 'aur/oră din toate habitatele · max 8h offline', 'gold/hour from all habitats · 8h offline max')}
          </small>
        </div>
        <button className="realm-button" disabled={save.storedGold < 1} onClick={() => run({ type: 'collect' })}>
          {tr(lang, 'Colectează', 'Collect')}
        </button>
      </div>
      <div className="realm-meter">
        <i style={{ width: `${cap ? (save.storedGold / cap) * 100 : 0}%` }} />
      </div>
      <p className="realm-market-note">
        ⌂{' '}
        {tr(
          lang,
          'Ca să ții mai mulți dinozauri într-o lume, îmbunătățește-i habitatul. Fiecare nivel costă aur și 1 kit de habitat, pe care îl faci în Atelier.',
          'To keep more dinosaurs in a world, upgrade its habitat. Each level costs gold and 1 habitat kit, made in the Workshop.',
        )}{' '}
        <b>
          {ITEMS.habitatKit.icon} {save.inventory.habitatKit} {tr(lang, 'kituri', 'kits')}
        </b>
      </p>
      <div className="realm-habitat-list">
        {ELEMENTS.map((e) => {
          const level = save.habitats[e.id],
            next = level ? HABITAT_LEVELS[level] : undefined,
            here = residents(save, e.id);
          return (
            <div
              key={e.id}
              className={`realm-habitat ${level ? '' : 'locked'}`}
              style={{ '--realm-color': e.color } as React.CSSProperties}
            >
              <span className="realm-habitat-symbol">{e.symbol}</span>
              <div>
                <strong>
                  {e.name[lang]} · {REALM_NAMES[e.id][lang]}
                </strong>
                {level ? (
                  <small>
                    {tr(lang, 'Nv.', 'Lv.')} {level} · 🦖 {here.length}/{habitatCapacity(save, e.id)} ·{' '}
                    {Math.round(here.reduce((n, d) => n + dinoIncome(save, d), 0))} ●/h ·{' '}
                    {tr(lang, 'depozit', 'storage')} {HABITAT_LEVELS[level - 1].cap}
                  </small>
                ) : (
                  <small>🔒 {tr(lang, 'Lume blocată', 'Locked world')}</small>
                )}
              </div>
              {level ? (
                <>
                  <button className="realm-link" onClick={() => visit(e.id)}>
                    {tr(lang, 'Vizitează', 'Visit')} →
                  </button>
                  {next ? (
                    <div className="realm-habitat-upgrade">
                      <small>
                        {tr(lang, 'Nv.', 'Lv.')} {level + 1}: 🦖 {next.capacity} {tr(lang, 'locuri', 'spots')}
                        {next.capacity === HABITAT_LEVELS[level - 1].capacity &&
                          ` (${tr(lang, 'doar depozit și venit', 'storage and income only')})`}
                      </small>
                      <ResourceHelp save={save} lang={lang} gold={next.gold} materials={{ habitatKit: 1 }} />
                      <button
                        className="realm-button secondary"
                        disabled={save.gold < next.gold || save.inventory.habitatKit < 1}
                        onClick={() => run({ type: 'upgradeHabitat', realm: e.id })}
                      >
                        ⬆ {next.gold} ● + {ITEMS.habitatKit.icon} 1
                      </button>
                      {save.inventory.habitatKit < 1 && (
                        <button className="realm-link" onClick={openWorkshop}>
                          {tr(lang, 'Fă un kit în Atelier', 'Make a kit in the Workshop')} →
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="realm-tag">MAX</span>
                  )}
                </>
              ) : (
                <div className="realm-habitat-unlock">
                  <Costs save={save} gold={WORLD_UNLOCK[e.id].gold} materials={WORLD_UNLOCK[e.id].materials} /><ResourceHelp save={save} lang={lang} gold={WORLD_UNLOCK[e.id].gold} materials={WORLD_UNLOCK[e.id].materials} />
                  <button className="realm-button" onClick={() => run({ type: 'unlockHabitat', realm: e.id })}>
                    🔓 {tr(lang, 'Deblochează', 'Unlock')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DinoPanel({
  save,
  lang,
  run,
  selected,
  select,
  openHatchery,
  realm,
  openHabitats,
  fromHatchery = false,
}: {
  save: Save;
  lang: number;
  run: Run;
  selected: string | null;
  select: (id: string) => void;
  openHatchery: () => void;
  /** Opened from a world: only that habitat's residents, with the habitat's summary on top. */
  realm?: RealmId | null;
  openHabitats?: () => void;
  /** Opened right after a hatch: keep the way back to the hatchery even when a habitat is shown. */
  fromHatchery?: boolean;
}) {
  const roster = realm ? residents(save, realm) : save.dinos;
  const d =
    roster.find((x) => x.id === selected) ?? roster.find((x) => x.id === save.champion) ?? roster[0];
  const habitat = realm ? (
    <div className="realm-habitat-summary">
      <span className="realm-tag" style={{ color: element(realm).color, borderColor: element(realm).color }}>
        {element(realm).symbol} {REALM_NAMES[realm][lang]}
      </span>
      <span>
        {tr(lang, 'Nivel', 'Level')} <b>{save.habitats[realm] ?? 0}</b>
      </span>
      <span>
        {tr(lang, 'Locuri', 'Spots')} <b>{residents(save, realm).length} / {habitatCapacity(save, realm)}</b>
      </span>
      <span>
        ● <b>{residents(save, realm).reduce((n, x) => n + dinoIncome(save, x), 0)}</b> / h
      </span>
      {openHabitats && (
        <button className="realm-link" onClick={openHabitats}>
          {tr(lang, 'Îmbunătățește habitatul', 'Upgrade the habitat')} →
        </button>
      )}
    </div>
  ) : null;
  if (!d)
    return realm ? (
      <>
        {habitat}
        <div className="realm-empty">
          <h3>{tr(lang, 'Habitatul e gol', 'The habitat is empty')}</h3>
          <p>{tr(lang, 'Eclozează un ou de acest element ca să-l populezi.', 'Hatch an egg of this element to fill it.')}</p>
          <button className="realm-button" onClick={openHatchery}>
            {tr(lang, 'Deschide incubatorul', 'Open hatchery')}
          </button>
        </div>
      </>
    ) : (
      <div className="realm-empty">
        <h3>{tr(lang, 'Un erou te așteaptă', 'A hero is waiting')}</h3>
        <button className="realm-button" onClick={openHatchery}>
          {tr(lang, 'Deschide incubatorul', 'Open hatchery')}
        </button>
      </div>
    );
  const el = element(d.element),
    gate = d.level === 9 || d.level === 24,
    inBattle = save.battle?.dinoId === d.id;
  const [from, to] = STAGE_LEVELS[d.stage],
    next = d.stage === 'baby' ? 'juvenile' : d.stage === 'juvenile' ? 'adult' : null;
  const cost = feedCost(d.level),
    hungry = save.food < cost;
  const now = stats(d.level, d.stage, d.species, rarityOf(d)),
    best = stats(50, 'adult', d.species, rarityOf(d));
  const stageOrder: Stage[] = ['baby', 'juvenile', 'adult'];
  return (
    <>
      {(!habitat || fromHatchery) && (
        <button className="realm-button secondary realm-back-to-hatchery" onClick={openHatchery}>
          ← {tr(lang, 'Înapoi la incubator', 'Back to hatchery')}
        </button>
      )}
      {habitat}
      <div className="dino-sheet">
        <nav className="dino-sheet-roster" aria-label={tr(lang, 'Dinozaurii tăi', 'Your dinosaurs')}>
          <span className="realm-eyebrow">
            {tr(lang, 'COLECȚIA', 'COLLECTION')} · {roster.length}
          </span>
          {roster.map((x) => (
            <button
              key={x.id}
              aria-pressed={x.id === d.id}
              data-rarity={rarityOf(x)}
              style={{ '--el': element(x.element).color } as CSSProperties}
              onClick={() => select(x.id)}
            >
              <span className="dino-sheet-thumb">
                <DinosaurArt species={x.species} element={x.element} stage={x.stage} paused frame={0} />
              </span>
              <span className="dino-sheet-roster-name">
                <strong>{x.nickname}</strong>
                <small>
                  {element(x.element).symbol} {tr(lang, 'Nv.', 'Lv.')} {x.level} · {stageName(x.stage, lang)}
                </small>
              </span>
              {x.id === save.champion && <b className="dino-sheet-crown" title={tr(lang, 'Campion', 'Champion')}>★</b>}
            </button>
          ))}
        </nav>

        <section className="dino-sheet-main" style={{ '--el': el.color } as CSSProperties}>
          <div className="dino-sheet-stage">
            {/* Sprites stand at 84% of their height, so the pedestal sits at the figure's 16% line. */}
            <span className="dino-sheet-figure">
              <span className="dino-sheet-pedestal" aria-hidden="true" />
              <DinosaurArt species={d.species} element={d.element} stage={d.stage} className={rarityClass(d.rarity)} />
            </span>
            <span className="dino-sheet-element">
              {el.symbol} {el.name[lang]} · {el.role[lang]}
            </span>
            {d.id === save.champion && <span className="dino-sheet-champion">★ {tr(lang, 'CAMPION', 'CHAMPION')}</span>}
          </div>

          <div className="dino-sheet-info">
            <header>
              <div className="dino-sheet-level" aria-label={`${tr(lang, 'Nivel', 'Level')} ${d.level}`}>
                <strong>{d.level}</strong>
                <small>{tr(lang, 'NIVEL', 'LEVEL')}</small>
              </div>
              <div>
                <h3>{d.nickname}</h3>
                <p>
                  {SPECIES_NAMES[d.species]} · {stageName(d.stage, lang)} <RarityBadge rarity={rarityOf(d)} lang={lang} />
                </p>
              </div>
            </header>

            <div className="dino-sheet-growth">
              <div className="dino-sheet-bar">
                <i style={{ width: `${Math.min(100, ((d.level - from) / Math.max(1, to - from)) * 100)}%` }} />
              </div>
              <small>
                {gate && next
                  ? tr(lang, `Gata de evoluție în ${stageName(next, lang)}!`, `Ready to evolve into ${stageName(next, lang)}!`)
                  : next
                    ? tr(lang, `Încă ${to - d.level} niveluri până la ${stageName(next, lang)}`, `${to - d.level} more levels to ${stageName(next, lang)}`)
                    : d.level >= 50
                      ? tr(lang, 'Nivel maxim atins', 'Max level reached')
                      : tr(lang, `Nivel ${d.level} din 50`, `Level ${d.level} of 50`)}
              </small>
            </div>

            {d.stage === 'baby' ? (
              <p className="dino-sheet-note">
                {tr(lang, 'Puii nu luptă încă. La nivelul 10 evoluează și pot intra în arenă.', 'Babies do not fight yet. At level 10 they evolve and can enter the arena.')}
              </p>
            ) : (
              <ul className="dino-sheet-stats">
                {STAT_ROWS.map(([key, icon, ro, en]) => (
                  <li key={key}>
                    <Icon name={icon} scale={1} />
                    <span>{tr(lang, ro, en)}</span>
                    <div className="dino-sheet-bar">
                      <i style={{ width: `${Math.min(100, (now[key] / best[key]) * 100)}%` }} />
                    </div>
                    <b>{now[key]}</b>
                  </li>
                ))}
              </ul>
            )}

            <div className="dino-sheet-income">
              <Icon name="gold" scale={1} /> <b>{Math.round(dinoIncome(save, d))}</b> {tr(lang, 'aur pe oră în habitat', 'gold per hour in the habitat')}
            </div>

            <ResourceHelp save={save} lang={lang} food={cost} /><div className="dino-sheet-actions">
              <button
                className={`realm-button ${gate ? 'dino-sheet-evolve' : ''}`}
                disabled={inBattle || d.level === 50 || hungry}
                onClick={() => run({ type: gate ? 'evolve' : 'feed', dinoId: d.id })}
              >
                {gate ? tr(lang, 'Evoluează', 'Evolve') : tr(lang, 'Hrănește', 'Feed')}
                <span className="dino-sheet-cost">
                  <Icon name="food" scale={1} /> {cost}
                </span>
              </button>
              {d.id !== save.champion && (
                <button className="realm-button secondary" disabled={!!save.battle} onClick={() => run({ type: 'setChampion', dinoId: d.id })}>
                  ★ {tr(lang, 'Fă-l campion', 'Make champion')}
                </button>
              )}
            </div>
            {hungry && d.level < 50 && !inBattle && (
              <small className="dino-sheet-hint">
                {tr(lang, `Îți trebuie ${cost - save.food} hrană în plus. Recoltează la fermă.`, `You need ${cost - save.food} more food. Harvest at the farm.`)}
              </small>
            )}
          </div>
        </section>

        <ol className="dino-sheet-path" aria-label={tr(lang, 'Evoluție', 'Evolution')}>
          {stageOrder.map((stage, i) => {
            const reached = stageOrder.indexOf(d.stage) >= i;
            return (
              <li key={stage} className={`${d.stage === stage ? 'current' : ''} ${reached ? 'reached' : 'locked'}`}>
                <span className="dino-sheet-path-art">
                  <DinosaurArt species={d.species} element={d.element} stage={stage} paused={!reached} frame={reached ? undefined : 0} />
                </span>
                <strong>{stageName(stage, lang)}</strong>
                <small>
                  {tr(lang, 'Nivel', 'Level')} {STAGE_LEVELS[stage][0]}–{STAGE_LEVELS[stage][1]}
                  {stage === 'juvenile' && ` · ${tr(lang, 'luptă', 'fights')}`}
                  {stage === 'adult' && ` · ${tr(lang, 'ultimată', 'ultimate')}`}
                </small>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}

/** Test tools behind the "i" button: finish every timer and add resources. */
export function DevPanel({ lang, run, close }: { lang: number; run: Run; close: () => void }) {
  return (
    <div className="realm-dev" role="dialog" aria-label={tr(lang, 'Unelte de test', 'Test tools')}>
      <header>
        <strong>ⓘ {tr(lang, 'Unelte de test', 'Test tools')}</strong>
        <button onClick={close} aria-label="Close">
          ×
        </button>
      </header>
      <button className="realm-button" onClick={() => run({ type: 'devSkip' })}>
        ⏩ {tr(lang, 'Sari peste timpi', 'Skip timers')}
      </button>
      <small>
        {tr(
          lang,
          'Ouă, straturi și atelier gata acum; depozitul de aur se umple.',
          'Eggs, plots and workshop finish now; gold storage fills up.',
        )}
      </small>
      <button className="realm-button secondary" onClick={() => run({ type: 'devResources' })}>
        ＋ {tr(lang, 'Adaugă resurse', 'Add resources')}
      </button>
      <small>+5000 ● · +5000 ❧ · +50 {tr(lang, 'materii prime', 'raw materials')} · +20 ▤ ▦ · +3 ⌂ · +3 ✧</small>
      <button className="realm-button secondary" onClick={() => run({ type: 'devRarityEggs' })}>
        ✦ {tr(lang, 'Ou rar + ou epic', 'Rare + epic egg')}
      </button>
      <small>{tr(lang, 'Două ouă de T-Rex de foc, pe raftul incubatorului.', 'Two fire T-Rex eggs, on the hatchery shelf.')}</small>
    </div>
  );
}
