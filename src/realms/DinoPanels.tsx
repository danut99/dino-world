import { ResourceHelp, RequirementLink } from './ResourceHelp';
import { RarityBadge, rarityClass } from './Rarity';
import { ARENA_BOSSES } from './arenaBosses';
import { playableSpecies } from './playableDinosaurs';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon, elementIcon, type IconName } from './ui/Icon';
import { ReminderButton } from './ui/ReminderButton';
import { Tabs, TabPanel } from './ui/Tabs';
import { Pager } from './ui/Pager';
import { usePager } from './ui/usePager';
import { CompactCard } from './ui/CompactCard';
import { DinosaurArt } from './DinosaurArt';
import { MomentArt, SIGNATURE } from './DinoMoment';
import { DEV_TOOLS } from './devTools';
import { ConstructionStrip, CostChips, DecorCard, UpgradeButton, affordable, underConstruction } from './PanelKit';
import './dino-sheet.css';
import { duration } from './FarmPanel';
import { ITEMS } from './content';
import { dailyState } from './daily';
import {
  BALANCE,
  EGG_SECONDS,
  ELEMENTS,
  HABITAT_LEVELS,
  HATCHERY_LEVELS,
  MARKET_ELEMENTS,
  PET,
  REALM_NAMES,
  SPECIES_NAMES,
  TRAINING,
  WORLD_UNLOCK,
  busyDinos,
  dinoIncome,
  eggPrice,
  eggSellPrice,
  feedCost,
  goldCap,
  goldRate,
  awayAt,
  habitatCapacity,
  hatcherySlots,
  incubating,
  residents,
  regionOf,
  levelCap,
  releaseGold,
  stats,
  dinoStats,
  freePoints,
  spentPoints,
  RESET_COST,
  worldLock,
  type Command,
  type Dino,
  type EggKind,
  type RealmId,
  type Save,
  type Species,
  type Stage,
} from './game';
import { rarityOf, gemsToFinish, ROLE_ICONS, ROLE_INFO, ROLE_NAMES, SPECIES_ROLE, type Rarity } from './game';
import { DECOR, decorCount, type DecorKind } from './game';

type Run = (c: Command) => boolean;
const tr = (lang: number, ro: string, en: string) => (lang ? en : ro);
const element = (id: RealmId) => ELEMENTS.find((e) => e.id === id)!;
/** First and last level of each age; evolving happens at the last level of baby and juvenile. */
const STAGE_LEVELS: Record<Stage, [number, number]> = { baby: [1, 9], juvenile: [10, 24], adult: [25, 50] };
const STAGE_ORDER: Stage[] = ['baby', 'juvenile', 'adult'];
/** The battle stats points can raise, with their icon and name (speed is a species trait). */
const STAT_ROWS = [
  ['hp', 'heart', 'Viață', 'Health'],
  ['power', 'sword', 'Putere', 'Power'],
  ['defense', 'shield', 'Apărare', 'Defense'],
] as const;
const stageName = (s: Stage, lang: number) =>
  ({ baby: ['Pui', 'Baby'], juvenile: ['Juvenil', 'Juvenile'], adult: ['Adult', 'Adult'] })[s][lang];
/** Un ou PixelLab pe tărâm (64 px), comun tuturor speciilor acelui element; eclozarea are animația lui. */
export const eggSrc = (realm: RealmId) => `/realms/eggs/${realm}.png`;
export const hatchSrc = (realm: RealmId) => `/realms/eggs/${realm}-hatch.png`;
export function EggArt({
  realm,
  species,
  size = 64,
  hatching = false,
  rarity,
}: {
  species?: Species;
  realm: RealmId;
  size?: number;
  hatching?: boolean;
  rarity?: Rarity;
}) {
  return (
    <span
      className={`realm-egg${hatching ? ' hatching' : ''} ${rarityClass(rarity)}`}
      style={
        {
          width: size,
          height: size,
          '--egg-size': `${size}px`,
          '--hatch-sheet': `url('${hatchSrc(realm)}')`,
        } as React.CSSProperties
      }
    >
      <img
        src={eggSrc(realm)}
        alt={species === 'boss' ? `BOSS ${ARENA_BOSSES[realm].name}` : ''}
        width={size}
        height={size}
        draggable={false}
      />
      {species === 'boss' && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            color: '#ffe098',
            fontSize: Math.max(12, size / 4),
            textShadow: '1px 1px #241832',
          }}
        >
          ?
        </span>
      )}
    </span>
  );
}
/** Bosses only have adult art (see loadAnimation), whatever their age. */
const artStage = (d: Pick<Dino, 'species' | 'stage'>): Stage => (d.species === 'boss' ? 'adult' : d.stage);
const eggName = (egg: { species: Species; element: RealmId }) =>
  egg.species === 'boss' ? `BOSS ${ARENA_BOSSES[egg.element].name}` : SPECIES_NAMES[egg.species];

/* ============================== Hatchery ============================== */

type HatchTab = 'nests' | 'shelf' | 'owed';
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
    waiting = save.eggs.filter((e) => e.hatchAt === null),
    owed = save.owedEggs;
  const readyCount = hatching.filter((e) => e.hatchAt! <= now).length;
  // Selling takes a second click on the same egg, so a stray click never loses one.
  const [selling, setSelling] = useState<string | null>(null);
  const [tab, setTab] = useState<HatchTab>(() => (busy === 0 && waiting.length > 0 ? 'shelf' : 'nests'));
  const shelf = usePager(waiting, { max: 6 });
  const owedPager = usePager(owed, { max: 8 });
  const allNests = HATCHERY_LEVELS[HATCHERY_LEVELS.length - 1].slots;
  const blocked = (egg: { element: RealmId }) =>
    !save.habitats[egg.element] || residents(save, egg.element).length >= habitatCapacity(save, egg.element);
  const stuck = hatching.find((egg) => egg.hatchAt! <= now && blocked(egg));
  const idBase = 'hatchery';
  return (
    <div className="fit-panel hatch-panel">
      <header className="pk-head">
        <span className="pk-level">
          <small>{tr(lang, 'NIVEL', 'LEVEL')}</small>
          {save.hatcheryLevel}
        </span>
        <div className="pk-head-text">
          <strong>
            {busy}/{slots} {tr(lang, 'cuiburi ocupate', 'nests in use')}
          </strong>
          <small>
            {save.eggs.length}/{BALANCE.maxEggs} {tr(lang, 'ouă deținute', 'eggs owned')}
            {owed.length > 0 && ` · +${owed.length} ${tr(lang, 'așteaptă loc', 'waiting for room')}`}
          </small>
        </div>
        <div className="pk-head-actions">
          <button className="realm-link" onClick={move}>
            {tr(lang, 'Mută', 'Move')}
          </button>
        </div>
      </header>
      <Tabs
        idBase={idBase}
        label={tr(lang, 'Secțiuni incubator', 'Hatchery sections')}
        active={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'nests',
            label: tr(lang, 'Incubator', 'Incubator'),
            badge: readyCount,
            state: readyCount ? 'ready' : busy ? 'busy' : undefined,
          },
          { id: 'shelf', label: tr(lang, 'Raft', 'Shelf'), badge: waiting.length },
          { id: 'owed', label: tr(lang, 'În așteptare', 'Waiting'), badge: owed.length },
        ]}
      />
      {tab === 'nests' && (
        <TabPanel idBase={idBase} id="nests" className="fit-fill hatch-nests-tab">
          {/* Every nest on one shelf: warming, ready, free or still locked. */}
          <div className="hatch-nests">
            {Array.from({ length: allNests }, (_, i) => {
              if (i >= slots) {
                const unlock = HATCHERY_LEVELS.findIndex((l) => l.slots > i) + 1;
                return (
                  <div
                    key={i}
                    className="hatch-nest locked"
                    title={`${tr(lang, 'Se deblochează la nivelul', 'Unlocks at level')} ${unlock}`}
                  >
                    <Icon name="lock" scale={2} />
                    <small>
                      {tr(lang, 'Nivel', 'Level')} {unlock}
                    </small>
                  </div>
                );
              }
              const egg = hatching[i];
              if (!egg)
                return (
                  <button
                    key={i}
                    className="hatch-nest free"
                    onClick={() => setTab('shelf')}
                    disabled={!waiting.length}
                  >
                    <span className="hatch-nest-bed" />
                    <small>
                      {waiting.length
                        ? tr(lang, 'Liber · alege un ou', 'Free · pick an egg')
                        : tr(lang, 'Liber', 'Free')}
                    </small>
                  </button>
                );
              const left = Math.max(0, egg.hatchAt! - now),
                ready = left === 0,
                stop = blocked(egg);
              return (
                <div
                  key={egg.id}
                  className={`hatch-nest ${ready ? 'ready' : 'warming'}`}
                  style={{ '--egg-glow': element(egg.element).color } as CSSProperties}
                >
                  <EggArt
                    species={egg.species}
                    realm={egg.element}
                    size={56}
                    hatching={hatchingId === egg.id}
                    rarity={egg.rarity}
                  />
                  <strong>{eggName(egg)}</strong>
                  {ready ? (
                    <button
                      className="realm-button"
                      disabled={!!hatchingId || stop}
                      title={
                        stop
                          ? !save.habitats[egg.element]
                            ? tr(lang, 'Deblochează mai întâi lumea lui.', 'Unlock its world first.')
                            : tr(lang, 'Habitatul e plin.', 'The habitat is full.')
                          : undefined
                      }
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
                      <div className="pk-meter">
                        <i style={{ width: `${Math.min(100, (1 - left / (egg.seconds * 1000)) * 100)}%` }} />
                      </div>
                      <small className="pk-num">⏱ {duration(Math.ceil(left / 1000))}</small>
                      <button
                        className="realm-gem-finish"
                        disabled={save.gems < gemsToFinish(left)}
                        onClick={() => run({ type: 'gemFinish', target: 'egg', id: egg.id })}
                        title={tr(lang, 'Termină acum cu diamante', 'Finish now with diamonds')}
                      >
                        ⚡ {gemsToFinish(left)} 💎
                      </button>
                      <ReminderButton
                        compact
                        id={`egg-${egg.id}`}
                        at={egg.hatchAt!}
                        title={tr(lang, 'Oul e gata de eclozat! 🥚', 'Your egg is ready to hatch! 🥚')}
                        body={`${eggName(egg)}: ${tr(lang, 'intră în Incubator și apasă „Eclozează”.', 'open the Hatchery and tap "Hatch".')}`}
                        lang={lang}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {stuck && (
            <RequirementLink
              title={tr(lang, 'Un ou nu are unde să eclozeze', 'An egg has nowhere to hatch')}
              detail={tr(
                lang,
                'Deblochează lumea lui sau fă loc în habitat.',
                'Unlock its world or make room in its habitat.',
              )}
              route={{ panel: 'realms', realm: stuck.element }}
            />
          )}
          <div className="pk-box pk-upgrade">
            {underConstruction(save, now, 'hatchery') ? (
              <ConstructionStrip save={save} now={now} lang={lang} run={run} target="hatchery" />
            ) : next ? (
              <>
                <span className="pk-upgrade-what">
                  <b className="pk-num">
                    ⬆ {tr(lang, 'Nivel', 'Level')} {save.hatcheryLevel + 1}
                  </b>{' '}
                  · <Icon name="egg" scale={1} /> {slots} → <b>{next.slots}</b> {tr(lang, 'cuiburi', 'nests')}
                </span>
                <CostChips save={save} lang={lang} gold={next.gold} materials={next.materials} />
                <ResourceHelp save={save} lang={lang} gold={next.gold} materials={next.materials} />
                <UpgradeButton save={save} now={now} lang={lang} run={run} target="hatchery" />
              </>
            ) : (
              <span className="pk-upgrade-what">
                ★ {tr(lang, 'Incubatorul e la nivelul maxim.', 'The hatchery is at max level.')}
              </span>
            )}
          </div>
        </TabPanel>
      )}
      {tab === 'shelf' && (
        <TabPanel idBase={idBase} id="shelf" className="fit-fill pk-paged-tab">
          {waiting.length ? (
            <div ref={shelf.ref} className="ui-paged hatch-shelf">
              {shelf.pageItems.map((egg) => (
                <CompactCard
                  key={egg.id}
                  art={<EggArt species={egg.species} realm={egg.element} size={40} rarity={egg.rarity} />}
                  title={
                    <>
                      {eggName(egg)} <RarityBadge rarity={rarityOf(egg)} lang={lang} short />
                    </>
                  }
                  subtitle={
                    <>
                      {element(egg.element).symbol} {element(egg.element).name[lang]} · ⏱ {duration(egg.seconds)}
                    </>
                  }
                  tone={egg.species === 'boss' ? 'rare' : 'default'}
                  action={
                    <span className="hatch-egg-actions">
                      {egg.id !== 'egg-ignis' && egg.species !== 'boss' && (
                        <button
                          className={`pk-sell${selling === egg.id ? ' confirm' : ''}`}
                          onClick={() => {
                            if (selling !== egg.id) return setSelling(egg.id);
                            setSelling(null);
                            run({ type: 'sellEgg', eggId: egg.id });
                          }}
                          onBlur={() => setSelling((id) => (id === egg.id ? null : id))}
                          title={tr(lang, 'Vinde oul', 'Sell this egg')}
                        >
                          {selling === egg.id
                            ? `${tr(lang, 'Sigur?', 'Sure?')} +${eggSellPrice(egg)}`
                            : `${tr(lang, 'Vinde', 'Sell')} ${eggSellPrice(egg)}`}{' '}
                          ●
                        </button>
                      )}
                      <button
                        className="realm-button"
                        disabled={busy >= slots}
                        onClick={() => {
                          if (run({ type: 'incubate', eggId: egg.id })) setTab('nests');
                        }}
                      >
                        {tr(lang, 'Incubează', 'Incubate')}
                      </button>
                    </span>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="pk-empty">
              <EmptyHero save={save} icon="egg" scale={3} />
              <p className="pk-note">
                {tr(
                  lang,
                  'Raftul e gol. Cumpără ouă din Piață sau câștigă-le în arenă și expediții.',
                  'The shelf is empty. Buy eggs at the Market or win them in the arena and on expeditions.',
                )}
              </p>
            </div>
          )}
          <div className="pk-foot">
            <p className={`pk-note${busy >= slots && waiting.length ? ' warn' : ''}`}>
              {busy >= slots && waiting.length
                ? tr(lang, 'Toate cuiburile sunt ocupate.', 'Every nest is busy.')
                : `${save.eggs.length}/${BALANCE.maxEggs} ${tr(lang, 'ouă', 'eggs')}`}
            </p>
            <button className="realm-link" onClick={openMarket}>
              {tr(lang, 'Mai multe ouă', 'More eggs')} →
            </button>
            <Pager page={shelf.page} pages={shelf.pages} onPrev={shelf.prev} onNext={shelf.next} lang={lang} />
          </div>
        </TabPanel>
      )}
      {tab === 'owed' && (
        <TabPanel idBase={idBase} id="owed" className="fit-fill pk-paged-tab">
          {owed.length ? (
            <div ref={owedPager.ref} className="ui-paged hatch-owed">
              {owedPager.pageItems.map((egg: EggKind, i) => (
                <CompactCard
                  key={`${owedPager.page}-${i}`}
                  art={<EggArt species={egg.species} realm={egg.element} size={40} rarity={egg.rarity} />}
                  title={
                    <>
                      {eggName(egg)} <RarityBadge rarity={rarityOf(egg)} lang={lang} short />
                    </>
                  }
                  subtitle={
                    <>
                      {element(egg.element).symbol} {element(egg.element).name[lang]}
                      {egg.story && ` · ${tr(lang, 'din poveste', 'story')}`}
                    </>
                  }
                  tone="locked"
                />
              ))}
            </div>
          ) : (
            <div className="pk-empty">
              <Icon name="chest" scale={3} />
              <p className="pk-note">
                {tr(
                  lang,
                  'Niciun ou nu așteaptă. Ouăle câștigate cât raftul e plin apar aici.',
                  'No eggs are waiting. Eggs won while the shelf is full show up here.',
                )}
              </p>
            </div>
          )}
          <div className="pk-foot">
            <p className="pk-note">
              {tr(
                lang,
                `Intră singure pe raft când se face loc (max. ${BALANCE.maxEggs}).`,
                `They move to the shelf by themselves when there is room (max ${BALANCE.maxEggs}).`,
              )}
            </p>
            <Pager
              page={owedPager.page}
              pages={owedPager.pages}
              onPrev={owedPager.prev}
              onNext={owedPager.next}
              lang={lang}
            />
          </div>
        </TabPanel>
      )}
    </div>
  );
}

/* ============================== Market ============================== */

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
  const owned = ELEMENTS.filter(
    (e) => save.habitats[e.id] && MARKET_ELEMENTS.includes(e.id) && playableSpecies(e.id).length,
  );
  const [realm, setRealm] = useState<RealmId>(owned[0]?.id ?? 'fire');
  if (!save.buildings.some((b) => b.kind === 'market'))
    return (
      <div className="fit-panel fit-single">
        <div className="pk-empty">
          <Icon name="market" scale={4} />
          <h3>{tr(lang, 'Piața nu e construită', 'The market is not built yet')}</h3>
          <p className="pk-note">
            {tr(lang, 'Construiește Piața ca să cumperi ouă.', 'Build the Market to buy eggs.')}
          </p>
          <button className="realm-button" onClick={build}>
            {tr(lang, 'Construiește', 'Build')}
          </button>
        </div>
      </div>
    );
  const full = save.eggs.length >= BALANCE.maxEggs;
  return (
    <div className="fit-panel market-panel">
      <header className="pk-head">
        <span className="pk-lamp-icon">
          <Icon name="market" scale={2} />
        </span>
        <div className="pk-head-text">
          <strong>{tr(lang, 'Ouă pentru lumile tale', 'Eggs for your worlds')}</strong>
          <small>
            {tr(
              lang,
              `Pentru lumile cu habitat · incubare ${duration(EGG_SECONDS.market)}`,
              `For worlds with a habitat · ${duration(EGG_SECONDS.market)} to hatch`,
            )}
          </small>
        </div>
        <div className="pk-head-actions">
          <span className="pk-cost">
            <Icon name="gold" scale={1} /> {Math.floor(save.gold).toLocaleString(lang ? 'en-US' : 'ro-RO')}
          </span>
          <span className={`pk-cost${full ? ' short' : ''}`}>
            <Icon name="egg" scale={1} /> {save.eggs.length}/{BALANCE.maxEggs}
          </span>
        </div>
      </header>
      <div className="pk-chips" role="group" aria-label={tr(lang, 'Element', 'Element')}>
        {owned.map((e) => (
          <button key={e.id} className="pk-chip" aria-pressed={realm === e.id} onClick={() => setRealm(e.id)}>
            <Icon name={elementIcon(e.id)} scale={1} /> {e.name[lang]}
          </button>
        ))}
        {owned.length < MARKET_ELEMENTS.length && (
          <button className="pk-chip" onClick={openHabitats}>
            ＋ {tr(lang, 'Habitat nou', 'New habitat')}
          </button>
        )}
      </div>
      <div className="fit-fill market-eggs">
        {playableSpecies(realm).map((species) => (
          <article key={species} className="market-egg" style={{ '--egg-glow': element(realm).color } as CSSProperties}>
            <EggArt species={species} realm={realm} size={96} />
            <strong>{SPECIES_NAMES[species]}</strong>
            <small>
              {element(realm).symbol} {element(realm).role[lang]}
            </small>
            <button
              className="realm-button"
              disabled={save.gold < eggPrice(realm) || full}
              onClick={() => run({ type: 'buyEgg', species, element: realm })}
            >
              <Icon name="gold" scale={1} /> {eggPrice(realm)}
            </button>
            <ResourceHelp save={save} lang={lang} gold={eggPrice(realm)} />
          </article>
        ))}
      </div>
      {full ? (
        <RequirementLink
          title={tr(lang, 'Raftul de ouă e plin', 'The egg shelf is full')}
          detail={tr(lang, 'Incubează sau vinde ouă din Incubator.', 'Incubate or sell eggs in the Hatchery.')}
          route={{ panel: 'hatchery' }}
        />
      ) : (
        <p className="pk-note">
          <Icon name="egg" scale={1} />{' '}
          {tr(
            lang,
            'Ouăle din Piață sunt comune. Cele rare, epice și de boss se câștigă în arenă și în expediții.',
            'Market eggs are common. Rare, epic and boss eggs are won in the arena and on expeditions.',
          )}
        </p>
      )}
    </div>
  );
}

/* ============================== Habitats ============================== */

export function HabitatsPanel({
  save,
  now,
  lang,
  run,
  visit,
  openWorkshop,
  placeDecor,
}: {
  save: Save;
  now: number;
  lang: number;
  run: Run;
  visit: (realm: RealmId) => void;
  openWorkshop: () => void;
  placeDecor?: (kind: DecorKind) => void;
}) {
  const [selected, select] = useState<RealmId>(
    () => ELEMENTS.find((e) => !save.habitats[e.id] && !worldLock(save, e.id))?.id ?? 'fire',
  );
  const cap = goldCap(save, now);
  const e = element(selected),
    level = save.habitats[selected],
    next = level ? HABITAT_LEVELS[level] : undefined,
    here = residents(save, selected),
    lock = level ? null : worldLockText(save, selected, lang),
    unlock = WORLD_UNLOCK[selected];
  const income = Math.round(here.reduce((n, d) => n + (awayAt(save, d.id, now) ? 0 : dinoIncome(save, d)), 0));
  const onTrip = save.dinos.filter((d) => awayAt(save, d.id, now)).length;
  return (
    <div className="fit-panel habitats-panel">
      <header className="pk-head">
        <span className="pk-lamp-icon">
          <Icon name="gold" scale={2} />
        </span>
        <div className="pk-head-text">
          <strong>
            {Math.floor(save.storedGold).toLocaleString(lang ? 'en-US' : 'ro-RO')} /{' '}
            {cap.toLocaleString(lang ? 'en-US' : 'ro-RO')} {tr(lang, 'aur strâns', 'gold stored')}
          </strong>
          <small>
            {Math.round(goldRate(save, now))} {tr(lang, 'aur/oră', 'gold/hour')} ·{' '}
            {onTrip > 0 &&
              `${tr(lang, `${onTrip} în expediție (nu produc)`, `${onTrip} on expedition (not earning)`)} · `}
            {tr(lang, 'max. 8h offline', '8h offline max')} · ☼ {decorCount(save, 'lamp')}/{DECOR.lamp.max}{' '}
            {tr(lang, 'lămpi', 'lamps')} ·{' '}
            {ITEMS.habitatKit.icon} {save.inventory.habitatKit} {tr(lang, 'kituri', 'kits')}
          </small>
          <div className="pk-meter">
            <i style={{ width: `${cap ? Math.min(100, (save.storedGold / cap) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="pk-head-actions">
          <button className="realm-button" disabled={save.storedGold < 1} onClick={() => run({ type: 'collect' })}>
            {tr(lang, 'Colectează', 'Collect')}
          </button>
        </div>
      </header>
      <div className="habitat-tiles" role="group" aria-label={tr(lang, 'Lumi', 'Worlds')}>
        {ELEMENTS.map((w) => {
          const lv = save.habitats[w.id],
            canUnlock = !lv && !worldLock(save, w.id);
          return (
            <button
              key={w.id}
              className={`habitat-tile${lv ? '' : ' locked'}${canUnlock ? ' next' : ''}`}
              aria-pressed={selected === w.id}
              style={{ '--realm-color': w.color } as CSSProperties}
              onClick={() => select(w.id)}
            >
              <Icon name={elementIcon(w.id)} scale={2} />
              <span>
                <strong>{w.name[lang]}</strong>
                <small>
                  {lv
                    ? `${tr(lang, 'Nv.', 'Lv.')} ${lv} · ${residents(save, w.id).length}/${habitatCapacity(save, w.id)}`
                    : canUnlock
                      ? tr(lang, 'Se poate deschide', 'Can open')
                      : tr(lang, 'Blocată', 'Locked')}
                </small>
              </span>
            </button>
          );
        })}
      </div>
      <section
        className="pk-box habitat-detail"
        style={{ '--realm-color': e.color } as CSSProperties}
        aria-label={e.name[lang]}
      >
        <div className="habitat-detail-info">
          <h3 className="pk-title">
            <span>
              <Icon name={elementIcon(selected)} scale={1} /> {REALM_NAMES[selected][lang]}
            </span>
            {level ? (
              <button className="realm-link" onClick={() => visit(selected)}>
                {tr(lang, 'Vizitează', 'Visit')} →
              </button>
            ) : (
              <small>{e.role[lang]}</small>
            )}
          </h3>
          {level ? (
            <>
              <dl className="habitat-stats">
                <div>
                  <dt>{tr(lang, 'Nivel', 'Level')}</dt>
                  <dd>
                    {level}/{HABITAT_LEVELS.length}
                  </dd>
                </div>
                <div>
                  <dt>{tr(lang, 'Locuri', 'Spots')}</dt>
                  <dd>
                    {here.length}/{habitatCapacity(save, selected)}
                  </dd>
                </div>
                <div>
                  <dt>{tr(lang, 'Depozit', 'Storage')}</dt>
                  <dd>{HABITAT_LEVELS[level - 1].cap}</dd>
                </div>
                <div>
                  <dt>{tr(lang, 'Venit', 'Income')}</dt>
                  <dd>{income} ●/h</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="pk-note">
              {tr(
                lang,
                'Deschide lumea ca să eclozezi și să găzduiești dinozaurii acestui element.',
                'Open this world to hatch and house dinosaurs of this element.',
              )}
            </p>
          )}
        </div>
        <div className="habitat-detail-action">
          {level && underConstruction(save, now, `habitat:${selected}`) ? (
            <ConstructionStrip save={save} now={now} lang={lang} run={run} target={`habitat:${selected}`} />
          ) : level && next ? (
            <>
              <span className="pk-upgrade-what">
                <b className="pk-num">
                  ⬆ {tr(lang, 'Nivel', 'Level')} {level + 1}
                </b>{' '}
                · {next.capacity} {tr(lang, 'locuri', 'spots')}
                <span className="pk-upgrade-extra">
                  {' '}
                  · {tr(lang, 'depozit', 'storage')} {next.cap} · ×{next.income} ●
                </span>
              </span>
              <CostChips save={save} lang={lang} gold={next.gold} materials={{ habitatKit: next.kits }} />
              <div className="habitat-buttons">
                <UpgradeButton save={save} now={now} lang={lang} run={run} target={`habitat:${selected}`} />
                <ResourceHelp save={save} lang={lang} gold={next.gold} materials={{ habitatKit: next.kits }} />
                {save.inventory.habitatKit < next.kits && (
                  <button className="realm-link" onClick={openWorkshop}>
                    {tr(lang, 'Fă un kit în Atelier', 'Make a kit in the Workshop')} →
                  </button>
                )}
              </div>
            </>
          ) : level ? (
            <span className="pk-upgrade-what">★ {tr(lang, 'Habitat la nivel maxim', 'Habitat at max level')}</span>
          ) : (
            <>
              <span className="pk-upgrade-what">
                <b className="pk-num">🔓 {tr(lang, 'Deschide lumea', 'Open the world')}</b>
              </span>
              <CostChips save={save} lang={lang} gold={unlock.gold} materials={unlock.materials} />
              {lock && <p className="pk-note warn">🔒 {lock}</p>}
              <div className="habitat-buttons">
                <button
                  className="realm-button"
                  disabled={!!worldLock(save, selected) || !affordable(save, unlock.gold, unlock.materials)}
                  onClick={() => run({ type: 'unlockHabitat', realm: selected })}
                >
                  {tr(lang, 'Deblochează', 'Unlock')}
                </button>
                {!lock && <ResourceHelp save={save} lang={lang} gold={unlock.gold} materials={unlock.materials} />}
              </div>
            </>
          )}
        </div>
      </section>
      <DecorCard kind="lamp" save={save} lang={lang} run={run} place={placeDecor} openWorkshop={openWorkshop} />
    </div>
  );
}

/* ============================== Dinosaurs ============================== */

/** An empty screen keeps the champion company: it idles there, or the icon stands in before the first hatch. */
function EmptyHero({ save, icon, scale }: { save: Save; icon: IconName; scale: 2 | 3 | 4 }) {
  const hero = save.dinos.find((x) => x.id === save.champion);
  if (!hero) return <Icon name={icon} scale={scale} />;
  return (
    <span className="pk-empty-hero">
      <DinosaurArt species={hero.species} element={hero.element} stage={artStage(hero)} />
    </span>
  );
}

/** The sheet's dinosaur: it rests on idle and shows off (walk, attack or ultimate) each time it gains a level. */
function LevelUpArt({ dino, stage, className }: { dino: Dino; stage: Stage; className?: string }) {
  const [cheer, setCheer] = useState(0);
  const last = useRef({ id: dino.id, level: dino.level });
  useEffect(() => {
    if (last.current.id === dino.id && dino.level > last.current.level) setCheer((n) => n + 1);
    last.current = { id: dino.id, level: dino.level };
  }, [dino.id, dino.level]);
  return (
    <MomentArt
      species={dino.species}
      element={dino.element}
      stage={stage}
      sequence={cheer ? [SIGNATURE[stage]] : []}
      play={cheer}
      className={className}
    />
  );
}

type DinoTab = 'stats' | 'grow' | 'habitat';
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
  previewHero,
  initialTab,
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
  previewHero?: (dino: Dino) => void;
  initialTab?: DinoTab;
}) {
  const roster = realm ? residents(save, realm) : save.dinos;
  const d = roster.find((x) => x.id === selected) ?? roster.find((x) => x.id === save.champion) ?? roster[0];
  const [tab, setTab] = useState<DinoTab>(() => initialTab ?? 'grow');
  const [releasing, setReleasing] = useState<string | null>(null);
  const pager = usePager(roster, { max: 8, itemSelector: '.dino-roster-item' });
  const index = d ? roster.indexOf(d) : -1;
  const { setPage, perPage } = pager;
  // Keep the selected dinosaur's page in view when the selection comes from outside (a hatch, the island).
  useEffect(() => {
    if (index >= 0) setPage(Math.floor(index / perPage));
  }, [d?.id, perPage]); // eslint-disable-line react-hooks/exhaustive-deps
  // The training countdown ticks only while someone trains.
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!save.training) return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [save.training]);
  const [petted, setPetted] = useState(0);
  const away = busyDinos(save);
  const habitat = realm ? (
    <div className="dino-habitat-strip">
      <span className="pk-cost" style={{ color: element(realm).color }}>
        <Icon name={elementIcon(realm)} scale={1} /> {REALM_NAMES[realm][lang]}
      </span>
      <span>
        {tr(lang, 'Nivel', 'Level')} <b className="pk-num">{save.habitats[realm] ?? 0}</b>
      </span>
      <span>
        {tr(lang, 'Locuri', 'Spots')}{' '}
        <b className="pk-num">
          {residents(save, realm).length}/{habitatCapacity(save, realm)}
        </b>
      </span>
      <span>
        <b className="pk-num">
          {Math.round(
            residents(save, realm).reduce((n, x) => n + (awayAt(save, x.id, Date.now()) ? 0 : dinoIncome(save, x)), 0),
          )}
        </b>{' '}
        ●/h
      </span>
      {openHabitats && (
        <button className="realm-link" onClick={openHabitats}>
          {tr(lang, 'Îmbunătățește habitatul', 'Upgrade the habitat')} →
        </button>
      )}
    </div>
  ) : null;
  const toolbar =
    habitat || fromHatchery ? (
      <div className="dino-toolbar">
        {fromHatchery && (
          <button className="realm-button secondary" onClick={openHatchery}>
            ← {tr(lang, 'Incubator', 'Hatchery')}
          </button>
        )}
        {habitat}
      </div>
    ) : null;
  // With a dinosaur shown, the habitat facts live in its Habitat tab; only the way back stays on top.
  const sheetToolbar = fromHatchery ? (
    <div className="dino-toolbar">
      <button className="realm-button secondary" onClick={openHatchery}>
        ← {tr(lang, 'Incubator', 'Hatchery')}
      </button>
    </div>
  ) : null;
  if (!d)
    return (
      <div className={`fit-panel ${toolbar ? 'fit-body' : 'fit-single'}`}>
        {toolbar}
        <div className="pk-empty">
          <EmptyHero save={save} icon="egg" scale={4} />
          <h3>
            {realm
              ? tr(lang, 'Habitatul e gol', 'The habitat is empty')
              : tr(lang, 'Un erou te așteaptă', 'A hero is waiting')}
          </h3>
          {realm && (
            <p className="pk-note">
              {tr(
                lang,
                'Eclozează un ou de acest element ca să-l populezi.',
                'Hatch an egg of this element to fill it.',
              )}
            </p>
          )}
          <button className="realm-button" onClick={openHatchery}>
            {tr(lang, 'Deschide incubatorul', 'Open hatchery')}
          </button>
        </div>
      </div>
    );

  const el = element(d.element),
    cap = levelCap(d.stage),
    gate = d.stage !== 'adult' && d.level === cap,
    maxed = d.level >= 50,
    inBattle = save.battle?.dinoId === d.id;
  const [from, to] = STAGE_LEVELS[d.stage],
    nextStage = d.stage === 'baby' ? 'juvenile' : d.stage === 'juvenile' ? 'adult' : null;
  const cost = feedCost(d.level),
    hungry = save.food < cost,
    needsCrystal = gate && d.stage === 'juvenile',
    crystals = save.inventory.evolutionCrystal,
    toGate = cap - d.level;
  /** Food for the next `n` levels. */
  const feedFood = (n: number) => Array.from({ length: n }, (_, i) => feedCost(d.level + i)).reduce((a, b) => a + b, 0);
  const missingFood = (need: number) =>
    save.food < need
      ? tr(lang, `Îți mai trebuie ${need - save.food} hrană`, `You need ${need - save.food} more food`)
      : undefined;
  /** Feed `n` levels, ten at a time (one command feeds at most ten), while the food lasts. */
  const feedLevels = (n: number) => {
    let food = save.food,
      level = d.level;
    for (let left = n; left > 0; left -= 10) {
      const times = Math.min(10, left);
      if (food < feedCost(level)) break;
      if (!run({ type: 'feed', dinoId: d.id, times })) break;
      for (let i = 0; i < times && food >= feedCost(level); i++) food -= feedCost(level++);
    }
  };
  const now = dinoStats(d),
    best = stats(50, 'adult', d.species, rarityOf(d)),
    free = freePoints(d),
    resetCost = RESET_COST(d);
  const isTeam = d.id === save.champion || save.team.includes(d.id);
  const releaseBlock =
    d.species === 'boss' || rarityOf(d) === 'legendary'
      ? tr(lang, 'Campionii legendari nu pot fi eliberați.', 'Legendary champions cannot be released.')
      : isTeam
        ? tr(
            lang,
            'Face parte din echipă. Alege alt campion mai întâi.',
            'It is in your team. Choose another champion first.',
          )
        : away.has(d.id)
          ? tr(lang, 'E plecat în expediție sau în luptă.', 'It is away on an expedition or in a fight.')
          : save.dinos.length <= 1
            ? tr(lang, 'Nu-ți poți elibera ultimul dinozaur.', 'You cannot release your last dinosaur.')
            : null;
  const idBase = 'dino-sheet';
  return (
    <div className={`fit-panel ${sheetToolbar ? 'fit-body' : 'fit-single'}`}>
      {sheetToolbar}
      <div className={`dino-sheet${roster.length <= 1 ? ' solo' : ''}`}>
        <nav className="dino-roster" aria-label={tr(lang, 'Dinozaurii tăi', 'Your dinosaurs')}>
          <div className="pk-foot">
            <span className="pk-title">
              {tr(lang, 'Dinozauri', 'Dinosaurs')} <small>{roster.length}</small>
            </span>
            <Pager page={pager.page} pages={pager.pages} onPrev={pager.prev} onNext={pager.next} lang={lang} />
          </div>
          <div ref={pager.ref} className="ui-paged dino-roster-list">
            {pager.pageItems.map((x) => (
              <button
                key={x.id}
                className="dino-roster-item"
                aria-pressed={x.id === d.id}
                data-rarity={rarityOf(x)}
                style={{ '--el': element(x.element).color } as CSSProperties}
                onClick={() => {
                  select(x.id);
                  setReleasing(null);
                }}
              >
                <span className="dino-sheet-thumb">
                  <DinosaurArt species={x.species} element={x.element} stage={artStage(x)} paused frame={0} />
                </span>
                <span className="dino-roster-name">
                  <strong>{x.nickname}</strong>
                  <small>
                    {element(x.element).symbol}{' '}
                    <span className="pk-num">
                      {tr(lang, 'Nv.', 'Lv.')} {x.level}
                    </span>{' '}
                    · {stageName(x.stage, lang)}
                    {away.has(x.id) && ` · ${tr(lang, 'plecat', 'away')}`}
                  </small>
                </span>
                {x.id === save.champion && (
                  <b className="dino-sheet-crown" title={tr(lang, 'Campion', 'Champion')}>
                    ★
                  </b>
                )}
              </button>
            ))}
          </div>
        </nav>

        <div className="dino-sheet-stage" style={{ '--el': el.color } as CSSProperties}>
          {/* Sprites stand at 84% of their height, so the pedestal sits at the figure's 16% line. */}
          <span className="dino-sheet-figure">
            <span className="dino-sheet-pedestal" aria-hidden="true" />
            <LevelUpArt dino={d} stage={artStage(d)} className={rarityClass(d.rarity)} />
          </span>
          <span className="dino-sheet-element">
            {el.symbol} {el.name[lang]}
          </span>
          {d.id === save.champion && <span className="dino-sheet-champion">★ {tr(lang, 'CAMPION', 'CHAMPION')}</span>}
          {away.has(d.id) && <span className="dino-sheet-away">{tr(lang, 'Plecat', 'Away')}</span>}
        </div>

        <section className="dino-sheet-info" style={{ '--el': el.color } as CSSProperties}>
          <header>
            <div className="dino-sheet-level" aria-label={`${tr(lang, 'Nivel', 'Level')} ${d.level}`}>
              <strong>{d.level}</strong>
              <small>{tr(lang, 'NIVEL', 'LEVEL')}</small>
            </div>
            <div className="dino-sheet-name">
              <h3>{d.nickname}</h3>
              <p>
                {SPECIES_NAMES[d.species]} · {stageName(d.stage, lang)} <RarityBadge rarity={rarityOf(d)} lang={lang} />
              </p>
            </div>
          </header>
          <div className="dino-sheet-growth">
            <div
              className="pk-meter"
              title={
                nextStage && !gate
                  ? tr(lang, `Încă ${to - d.level} niveluri până la evoluție`, `${to - d.level} more levels to evolve`)
                  : undefined
              }
            >
              <i style={{ width: `${Math.min(100, ((d.level - from) / Math.max(1, to - from)) * 100)}%` }} />
            </div>
            {(gate && nextStage) || maxed ? (
              <small>
                {gate && nextStage
                  ? tr(
                      lang,
                      `Gata de evoluție: ${stageName(nextStage, lang)}!`,
                      `Ready to evolve: ${stageName(nextStage, lang)}!`,
                    )
                  : tr(lang, 'Nivel maxim atins', 'Max level reached')}
              </small>
            ) : null}
          </div>
          <Tabs
            idBase={idBase}
            label={tr(lang, 'Fișa dinozaurului', 'Dinosaur sheet')}
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'grow', label: tr(lang, 'Creștere', 'Grow'), badge: gate && !inBattle ? '!' : undefined },
              { id: 'stats', label: tr(lang, 'Statistici', 'Stats'), badge: free > 0 && !inBattle ? '!' : undefined },
              { id: 'habitat', label: tr(lang, 'Habitat', 'Habitat') },
            ]}
          />
          {tab === 'stats' && (
            <TabPanel idBase={idBase} id="stats" className="fit-fill dino-tab">
              {d.stage === 'baby' && (
                <p className="dino-sheet-note">
                  {tr(
                    lang,
                    'Puii nu luptă încă. La nivelul 10 evoluează și pot intra în arenă.',
                    'Babies do not fight yet. At level 10 they evolve and can enter the arena.',
                  )}
                </p>
              )}
              <p className="dino-sheet-role">
                <span aria-hidden="true">{ROLE_ICONS[SPECIES_ROLE[d.species]]}</span>{' '}
                <b>{ROLE_NAMES[SPECIES_ROLE[d.species]][lang]}</b> · {ROLE_INFO[SPECIES_ROLE[d.species]][lang]}
              </p>
              <p className="dino-sheet-points">
                <span>
                  {tr(lang, 'Puncte libere', 'Free points')}: <b className="pk-num">{free}</b>
                </span>
                <button
                  className="realm-link"
                  disabled={inBattle || spentPoints(d) === 0 || save.gold < resetCost}
                  onClick={() => run({ type: 'resetPoints', dinoId: d.id })}
                >
                  {tr(lang, `Resetează (${resetCost} aur)`, `Reset (${resetCost} gold)`)}
                </button>
              </p>
              <ul className="dino-sheet-stats">
                {STAT_ROWS.map(([key, icon, ro, en]) => (
                  <li key={key}>
                    <Icon name={icon} scale={1} />
                    <span>{tr(lang, ro, en)}</span>
                    <div className="pk-meter" style={{ '--meter': el.color } as CSSProperties}>
                      <i style={{ width: `${Math.min(100, (now[key] / best[key]) * 100)}%` }} />
                    </div>
                    <b className="pk-num">{now[key]}</b>
                    <small className="pk-num" title={tr(lang, 'Puncte', 'Points')}>
                      {d.points?.[key] ?? 0}
                    </small>
                    <button
                      className="dino-point-add"
                      disabled={free < 1 || inBattle}
                      aria-label={tr(lang, `+1 punct la ${ro}`, `+1 point to ${en}`)}
                      onClick={() => run({ type: 'allocate', dinoId: d.id, stat: key })}
                    >
                      +
                    </button>
                  </li>
                ))}
              </ul>
              <div className="dino-tab-foot">
                <span className="dino-sheet-income">
                  <Icon name="gold" scale={1} /> <b className="pk-num">{Math.round(dinoIncome(save, d))}</b>{' '}
                  {tr(lang, 'aur/oră', 'gold/hour')}
                  {awayAt(save, d.id, Date.now()) &&
                    ` · ${tr(lang, 'în expediție: nu produce acum', 'on expedition: not earning now')}`}
                </span>
                {previewHero && d.id === save.dinos[0]?.id && d.stage !== 'adult' && (
                  <button className="realm-link" onClick={() => previewHero(d)}>
                    ✦ {tr(lang, 'Potențialul eroului', 'Hero potential')}
                  </button>
                )}
                {d.id !== save.champion && (
                  <button
                    className="realm-button secondary"
                    disabled={!!save.battle || d.stage === 'baby'}
                    title={d.stage === 'baby' ? tr(lang, 'Puii nu luptă încă.', 'Babies do not fight yet.') : undefined}
                    onClick={() => run({ type: 'setChampion', dinoId: d.id })}
                  >
                    ★ {tr(lang, 'Campion', 'Champion')}
                  </button>
                )}
              </div>
            </TabPanel>
          )}
          {tab === 'grow' && (
            <TabPanel idBase={idBase} id="grow" className="fit-fill dino-tab">
              <ol className="dino-evo" aria-label={tr(lang, 'Evoluție', 'Evolution')}>
                {(d.species === 'boss' ? (['adult'] as Stage[]) : STAGE_ORDER).map((stage) => {
                  const at = STAGE_ORDER.indexOf(d.stage),
                    i = STAGE_ORDER.indexOf(stage);
                  return (
                    <li
                      key={stage}
                      className={i === at ? 'current' : i < at ? 'reached' : 'locked'}
                      title={`${tr(lang, 'Nivel', 'Level')} ${STAGE_LEVELS[stage][0]}–${STAGE_LEVELS[stage][1]}`}
                    >
                      <span className="dino-evo-art">
                        <DinosaurArt
                          species={d.species}
                          element={d.element}
                          stage={d.species === 'boss' ? 'adult' : stage}
                          paused
                          frame={0}
                        />
                      </span>
                      <small>{stageName(stage, lang)}</small>
                    </li>
                  );
                })}
              </ol>
              {gate ? (
                <button
                  className="realm-button dino-feed-main dino-sheet-evolve"
                  disabled={inBattle || hungry || (needsCrystal && crystals < 1)}
                  onClick={() => run({ type: 'evolve', dinoId: d.id })}
                >
                  ✦ {tr(lang, 'Evoluează', 'Evolve')}
                  <span className="dino-sheet-cost">
                    <Icon name="food" scale={1} /> {cost}
                    {needsCrystal && (
                      <>
                        {' '}
                        + <Icon name="evolutionCrystal" scale={1} /> 1
                      </>
                    )}
                  </span>
                </button>
              ) : (
                !maxed && (
                  <button
                    className="realm-button dino-feed-main"
                    disabled={inBattle || hungry}
                    onClick={() => run({ type: 'feed', dinoId: d.id })}
                  >
                    {tr(lang, 'Hrănește', 'Feed')} <small>+1 {tr(lang, 'nivel', 'level')}</small>
                    <span className="dino-sheet-cost">
                      <Icon name="food" scale={1} /> {cost}
                    </span>
                  </button>
                )
              )}
              {(hungry && !maxed) || (needsCrystal && crystals < 1) || inBattle || maxed ? (
                <p className={`pk-note${maxed ? '' : ' warn'}`}>
                  {inBattle
                    ? tr(lang, 'E în luptă acum.', 'It is in a fight right now.')
                    : maxed
                      ? tr(lang, 'Nivel maxim: 50.', 'Max level: 50.')
                      : needsCrystal && crystals < 1
                        ? tr(
                            lang,
                            'Ca să devină adult îi trebuie un cristal de evoluție din Atelier.',
                            'Becoming an adult takes an evolution crystal from the Workshop.',
                          )
                        : tr(
                            lang,
                            `Îți mai trebuie ${cost - Math.floor(save.food)} hrană. Recoltează la fermă.`,
                            `You need ${cost - Math.floor(save.food)} more food. Harvest at the farm.`,
                          )}
                </p>
              ) : null}
              {((hungry && !maxed) || (needsCrystal && crystals < 1)) && (
                <ResourceHelp
                  save={save}
                  lang={lang}
                  food={cost}
                  materials={needsCrystal ? { evolutionCrystal: 1 } : {}}
                />
              )}
              {(() => {
                const today = dailyState(save, clock),
                  petsLeft = PET.perDay - today.pets,
                  trainsLeft = TRAINING.perDay - today.trainings,
                  t = save.training,
                  trainee = t && save.dinos.find((x) => x.id === t.dinoId),
                  left = t ? Math.max(0, t.endsAt - clock) : 0;
                return (
                  <div className="dino-care">
                    <button
                      key={petted}
                      className={`realm-button secondary dino-pet${petted ? ' petted' : ''}`}
                      disabled={petsLeft <= 0}
                      title={tr(lang, `Îl mai poți mângâia de ${petsLeft} ori azi.`, `${petsLeft} pets left today.`)}
                      onClick={() => run({ type: 'pet', dinoId: d.id }) && setPetted((n) => n + 1)}
                    >
                      <span>❤ {tr(lang, 'Mângâie', 'Pet')}</span>
                      <span className="dino-sheet-cost">
                        +{PET.food} <Icon name="food" scale={1} /> · {petsLeft}/{PET.perDay}
                      </span>
                    </button>
                    {t && left === 0 ? (
                      <button className="realm-button dino-train" onClick={() => run({ type: 'claimTraining' })}>
                        <span>⬆ {tr(lang, 'Ia nivelul', 'Claim level')}</span>
                        <span className="dino-sheet-cost">
                          {trainee?.nickname ?? ''} · +1 {tr(lang, 'nivel', 'level')}
                        </span>
                      </button>
                    ) : t ? (
                      <button className="realm-button secondary dino-train" disabled>
                        <span>⏳ {trainee?.nickname}</span>
                        <span className="dino-sheet-cost">{duration(Math.ceil(left / 1000))}</span>
                      </button>
                    ) : (
                      <button
                        className="realm-button secondary dino-train"
                        disabled={trainsLeft <= 0 || gate || maxed}
                        title={tr(
                          lang,
                          `${TRAINING.minutes} min, gratuit: +1 nivel. Încă ${trainsLeft} azi.`,
                          `${TRAINING.minutes} min, free: +1 level. ${trainsLeft} left today.`,
                        )}
                        onClick={() => run({ type: 'train', dinoId: d.id })}
                      >
                        <span>{tr(lang, 'Antrenează', 'Train')}</span>
                        <span className="dino-sheet-cost">
                          {gate
                            ? tr(lang, 'evoluează întâi', 'evolve first')
                            : `⏱ ${TRAINING.minutes} min · ${trainsLeft}/${TRAINING.perDay}`}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}
              {!gate && !maxed && (toGate > 1 || crystals > 0) && (
                <details className="dino-grow-more">
                  <summary>{tr(lang, 'Mai mult', 'More')}</summary>
                  <div className="dino-grow-buttons">
                    {toGate > 1 && (
                      <button
                        className="realm-button secondary"
                        disabled={inBattle || save.food < feedFood(Math.min(5, toGate))}
                        title={missingFood(feedFood(Math.min(5, toGate)))}
                        onClick={() => feedLevels(Math.min(5, toGate))}
                      >
                        +{Math.min(5, toGate)} {tr(lang, 'niveluri', 'levels')}
                        <span className="dino-sheet-cost">
                          <Icon name="food" scale={1} /> {feedFood(Math.min(5, toGate))}
                        </span>
                      </button>
                    )}
                    {toGate > 5 && (
                      <button
                        className="realm-button secondary"
                        disabled={inBattle || save.food < feedFood(toGate)}
                        title={missingFood(feedFood(toGate))}
                        onClick={() => feedLevels(toGate)}
                      >
                        {d.stage === 'adult'
                          ? tr(lang, `Până la nv. ${cap}`, `To lv. ${cap}`)
                          : tr(lang, 'Până la evoluție', 'To next evolution')}
                        <span className="dino-sheet-cost">
                          <Icon name="food" scale={1} /> {feedFood(toGate)}
                        </span>
                      </button>
                    )}
                    {crystals > 0 && (
                      <button
                        className="realm-button premium"
                        disabled={inBattle}
                        onClick={() => run({ type: 'useCrystal', dinoId: d.id })}
                      >
                        {tr(lang, 'Cristal: +1 nivel', 'Crystal: +1 level')}
                        <span className="dino-sheet-cost">
                          <Icon name="evolutionCrystal" scale={1} /> {crystals}
                        </span>
                      </button>
                    )}
                  </div>
                </details>
              )}
            </TabPanel>
          )}
          {tab === 'habitat' && (
            <TabPanel idBase={idBase} id="habitat" className="fit-fill dino-tab">
              <dl className="habitat-stats">
                <div>
                  <dt>{tr(lang, 'Lume', 'World')}</dt>
                  <dd>
                    {el.symbol} {REALM_NAMES[d.element][lang]}
                  </dd>
                </div>
                <div>
                  <dt>{tr(lang, 'Habitat', 'Habitat')}</dt>
                  <dd>
                    {tr(lang, 'Nv.', 'Lv.')} {save.habitats[d.element] ?? 0}
                  </dd>
                </div>
                <div>
                  <dt>{tr(lang, 'Locuri', 'Spots')}</dt>
                  <dd>
                    {residents(save, d.element).length}/{habitatCapacity(save, d.element)}
                  </dd>
                </div>
                <div>
                  <dt>{tr(lang, 'Aduce', 'Earns')}</dt>
                  <dd>{Math.round(dinoIncome(save, d))} ●/h</dd>
                </div>
              </dl>
              {openHabitats && (
                <button className="realm-link" onClick={openHabitats}>
                  {tr(lang, 'Habitate și îmbunătățiri', 'Habitats and upgrades')} →
                </button>
              )}
              {releasing === d.id && !releaseBlock ? (
                <div
                  className="pk-confirm"
                  role="alertdialog"
                  aria-label={tr(lang, 'Confirmă eliberarea', 'Confirm the release')}
                >
                  <p>
                    {tr(lang, `Eliberezi pe ${d.nickname}? Primești`, `Release ${d.nickname}? You get`)}{' '}
                    <b className="pk-num">+{releaseGold(d)} ●</b>.{' '}
                    {tr(lang, 'Familia rămâne în colecție.', 'The family stays in your collection.')}
                  </p>
                  <div>
                    <button
                      className="realm-button danger"
                      onClick={() => {
                        setReleasing(null);
                        run({ type: 'releaseDino', dinoId: d.id });
                      }}
                    >
                      {tr(lang, 'Da, eliberează', 'Yes, release')}
                    </button>
                    <button className="realm-button secondary" onClick={() => setReleasing(null)}>
                      {tr(lang, 'Anulează', 'Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dino-release">
                  <button
                    className="realm-button secondary"
                    disabled={!!releaseBlock}
                    onClick={() => setReleasing(d.id)}
                  >
                    {tr(lang, 'Eliberează', 'Release')}
                    {!releaseBlock && (
                      <span className="dino-sheet-cost">
                        +{releaseGold(d)} <Icon name="gold" scale={1} />
                      </span>
                    )}
                  </button>
                  <p className="pk-note">
                    {releaseBlock ??
                      tr(
                        lang,
                        'Face loc în habitat. Nu se poate anula.',
                        'Makes room in the habitat. It cannot be undone.',
                      )}
                  </p>
                </div>
              )}
            </TabPanel>
          )}
        </section>
      </div>
    </div>
  );
}

/** Why a world cannot be unlocked yet (see worldLock), in words; null when it can. */
export function worldLockText(save: Save, realm: RealmId, lang: number) {
  const lock = worldLock(save, realm);
  if (!lock || lock.reason === 'open') return null;
  const name = REALM_NAMES[lock.world][lang];
  return lock.reason === 'world'
    ? tr(lang, `Deblochează mai întâi ${name}.`, `Unlock ${name} first.`)
    : tr(
        lang,
        `Ajungi la etapa 3 în ${regionOf(lock.world).name[0]} (${name}).`,
        `Reach stage 3 of ${regionOf(lock.world).name[1]} (${name}).`,
      );
}

/** Test tools behind the "i" button: finish every timer and add resources. Development builds only. */
export function DevPanel({ lang, run, close }: { lang: number; run: Run; close: () => void }) {
  if (!DEV_TOOLS) return null;
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
      <small>
        {tr(lang, 'Două ouă de T-Rex de foc, pe raftul incubatorului.', 'Two fire T-Rex eggs, on the hatchery shelf.')}
      </small>
    </div>
  );
}
