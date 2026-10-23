import { RarityBadge, rarityClass } from './Rarity';
import { ARENA_BOSSES } from './arenaBosses';
import { playableSpecies } from './playableDinosaurs';
import { useState } from 'react';
import { Icon } from './ui/Icon';
import { DinosaurArt } from './DinosaurArt';
import { duration } from './FarmPanel';
import { ITEMS, type ItemId } from './content';
import {
  BALANCE,
  ELEMENTS,
  HABITAT_LEVELS,
  HATCHERY_LEVELS,
  MARKET_ELEMENTS,
  QUEST_EGGS,
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
  hatcheryStoryEggs,
  storyEgg,
  residents,
  stats,
  type Command,
  type Dino,
  type RealmId,
  type Save,
  type Species,
  type Stage,
} from './game';
import { rarityOf, type Rarity } from './game';

type Run = (c: Command) => boolean;
const tr = (lang: number, ro: string, en: string) => (lang ? en : ro);
const element = (id: RealmId) => ELEMENTS.find((e) => e.id === id)!;
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
  const claimable = hatcheryStoryEggs(save);
  // Selling takes a second click on the same egg, so a stray click never loses one.
  const [selling, setSelling] = useState<string | null>(null);
  // Chapter I eggs only; chapter II is followed on the story card.
  const open = QUEST_EGGS.filter((q) => !q.done(save) && !save.questEggs.includes(q.id));
  const upcoming = open.filter((q) => !q.chapter).filter(storyEgg);
  return (
    <div className="realm-dino-panel">
      <div className="realm-farm-head">
        <span className="realm-farm-level">
          <small>{tr(lang, 'NIVEL', 'LEVEL')}</small>
          {save.hatcheryLevel}
          <small>/ {HATCHERY_LEVELS.length}</small>
        </span>
        <div>
          <strong>
            {busy}/{slots} {tr(lang, 'ouă în incubare', 'eggs incubating')}
          </strong>
          <small>
            {save.eggs.length}/{BALANCE.maxEggs} {tr(lang, 'ouă deținute', 'eggs owned')}
            {save.owedEggs.length > 0 &&
              ` · +${save.owedEggs.length} ${tr(lang, 'așteaptă loc pe raft', 'waiting for shelf space')}`}
          </small>
        </div>
        <button className="realm-link" onClick={move}>
          {tr(lang, 'Mută incubatorul', 'Move hatchery')}
        </button>
      </div>

      {claimable.map((q) => (
        <div key={q.id} className="realm-quest-egg ready">
          <EggArt species={q.species} realm={q.element} size={48} />
          <div>
            <span className="realm-eyebrow">{tr(lang, 'RECOMPENSĂ DIN POVESTE', 'STORY REWARD')}</span>
            <strong>
              {SPECIES_NAMES[q.species]} · {element(q.element).name[lang]}
            </strong>
            <small>✓ {q.task[lang]}</small>
          </div>
          <button className="realm-button" onClick={() => run({ type: 'claimQuestEgg', questId: q.id })}>
            {tr(lang, 'Primește oul', 'Claim egg')}
          </button>
        </div>
      ))}

      <div className="realm-nests">
        {Array.from({ length: HATCHERY_LEVELS[HATCHERY_LEVELS.length - 1].slots }, (_, i) => {
          if (i >= slots)
            return (
              <div key={i} className="realm-nest locked">
                <span className="realm-nest-bed" />
                <strong>🔒</strong>
                <small>
                  {tr(lang, 'Nivel', 'Level')} {HATCHERY_LEVELS.findIndex((l) => l.slots > i) + 1}
                </small>
              </div>
            );
          const egg = hatching[i];
          if (!egg)
            return (
              <div key={i} className="realm-nest empty">
                <span className="realm-nest-bed" />
                <strong>{tr(lang, 'Cuib liber', 'Empty nest')}</strong>
                <small>{waiting.length ? tr(lang, 'Alege un ou de mai jos', 'Pick an egg below') : '—'}</small>
              </div>
            );
          const left = Math.max(0, egg.hatchAt! - now),
            ready = left === 0,
            full = residents(save, egg.element).length >= habitatCapacity(save, egg.element);
          return (
            <div
              key={egg.id}
              className={`realm-nest ${ready ? 'ready' : 'warming'}`}
              style={{ '--egg-glow': element(egg.element).color } as React.CSSProperties}
            >
              <span className="realm-nest-bed" />
              <EggArt species={egg.species} realm={egg.element} size={128} hatching={hatchingId === egg.id} rarity={egg.rarity} />
              <strong>
                {(egg.species === 'boss' ? `BOSS ${ARENA_BOSSES[egg.element].name}` : SPECIES_NAMES[egg.species])} · {element(egg.element).name[lang]}
                <RarityBadge rarity={rarityOf(egg)} lang={lang} />
              </strong>
              {ready ? (
                <>
                  <button
                    className="realm-button"
                    disabled={!!hatchingId}
                    onClick={() => {
                      // animația de eclozare rulează întâi; comanda se dă la final (aceeași regulă de joc)
                      setHatchingId(egg.id);
                      window.setTimeout(() => {
                        setHatchingId(null);
                        if (run({ type: 'hatch', eggId: egg.id })) onHatched();
                      }, 1400);
                    }}
                  >
                    <Icon name="egg" scale={1} /> {tr(lang, 'Eclozează', 'Hatch')}
                  </button>
                  {(!save.habitats[egg.element] || full) && (
                    <small className="realm-warning">
                      {!save.habitats[egg.element]
                        ? tr(lang, 'Deblochează mai întâi lumea lui.', 'Unlock its world first.')
                        : tr(lang, 'Habitatul e plin. Îmbunătățește-l.', 'The habitat is full. Upgrade it.')}
                    </small>
                  )}
                </>
              ) : (
                <>
                  <div className="realm-meter">
                    <i style={{ width: `${Math.min(100, (1 - left / (egg.seconds * 1000)) * 100)}%` }} />
                  </div>
                  <small>⏱ {duration(Math.ceil(left / 1000))}</small>
                </>
              )}
            </div>
          );
        })}
      </div>

      <h4 className="realm-farm-title">
        {tr(lang, 'Ouăle tale', 'Your eggs')} · {waiting.length}
      </h4>
      {waiting.length === 0 ? (
        <div className="realm-empty realm-eggs-empty">
          <p>
            {tr(
              lang,
              'Niciun ou în așteptare. Cumpără ouă de foc, apă și pământ din Piață; celelalte le câștigi în lupte și expediții.',
              'No eggs waiting. Buy fire, water and earth eggs at the Market; win the others in fights and expeditions.',
            )}
          </p>
          <button className="realm-button secondary" onClick={openMarket}>
            ⚖ {tr(lang, 'Piața', 'Market')}
          </button>
        </div>
      ) : (
        <div className="realm-egg-shelf">
          {waiting.map((egg) => (
            <div key={egg.id} className="realm-egg-item">
              <EggArt species={egg.species} realm={egg.element} size={48} rarity={egg.rarity} />
              <span>
                <strong>
                  {(egg.species === 'boss' ? `BOSS ${ARENA_BOSSES[egg.element].name}` : SPECIES_NAMES[egg.species])}
                  <RarityBadge rarity={rarityOf(egg)} lang={lang} short />
                </strong>
                <small>
                  {element(egg.element).symbol} {element(egg.element).name[lang]} · ⏱ {duration(egg.seconds)}
                </small>
              </span>
              <div className="realm-egg-actions">
                <button
                  className="realm-button secondary"
                  disabled={busy >= slots}
                  onClick={() => run({ type: 'incubate', eggId: egg.id })}
                >
                  {busy >= slots ? tr(lang, 'Cuiburi pline', 'Nests full') : tr(lang, 'Incubează', 'Incubate')}
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
                    {selling === egg.id
                      ? `${tr(lang, 'Sigur? Vinde', 'Sure? Sell')} +${eggSellPrice(egg.element)} ●`
                      : `${tr(lang, 'Vinde', 'Sell')} ${eggSellPrice(egg.element)} ●`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="realm-quest-list">
          <span className="realm-eyebrow">{tr(lang, 'OUĂ DIN POVESTE', 'STORY EGGS')}</span>
          {upcoming.map((q) => (
            <div key={q.id}>
              <EggArt species={q.species} realm={q.element} size={32} />
              <span>
                {SPECIES_NAMES[q.species]} · {element(q.element).name[lang]}
              </span>
              <small>{q.task[lang]}</small>
            </div>
          ))}
        </div>
      )}

      <div className="realm-farm-upgrade">
        {next ? (
          <>
            <div>
              <span className="realm-eyebrow">
                {tr(lang, 'ÎMBUNĂTĂȚIRE', 'UPGRADE')} · {tr(lang, 'NIVEL', 'LEVEL')} {save.hatcheryLevel + 1}
              </span>
              <ul>
                <li>
                  <Icon name="egg" scale={1} /> {slots} → <b>{next.slots}</b> {tr(lang, 'ouă incubate deodată', 'eggs incubating at once')}
                </li>
              </ul>
              <Costs save={save} gold={next.gold} materials={next.materials} />
            </div>
            <button className="realm-button" onClick={() => run({ type: 'upgradeHatchery' })}>
              {tr(lang, 'Îmbunătățește', 'Upgrade')}
            </button>
          </>
        ) : (
          <p>★ {tr(lang, 'Incubatorul e la nivelul maxim.', 'The hatchery is at max level.')}</p>
        )}
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
                  <Costs save={save} gold={WORLD_UNLOCK[e.id].gold} materials={WORLD_UNLOCK[e.id].materials} />
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
  return (
    <>
      {(!habitat || fromHatchery) && (
        <button className="realm-button secondary realm-back-to-hatchery" onClick={openHatchery}>
          ← {tr(lang, 'Înapoi la incubator', 'Back to hatchery')}
        </button>
      )}
      {habitat}
      <div className="realm-roster">
        {roster.map((x) => (
          <button key={x.id} aria-pressed={x.id === d.id} onClick={() => select(x.id)}>
            <DinosaurArt species={x.species} element={x.element} stage={x.stage} className={rarityClass(x.rarity)} />
            <strong>
              {x.id === save.champion && '★ '}
              {x.nickname}
              <RarityBadge rarity={rarityOf(x)} lang={lang} short />
            </strong>
            <small>
              {element(x.element).symbol} {tr(lang, 'Nv.', 'Lv.')} {x.level}
            </small>
          </button>
        ))}
      </div>
      <div className="realm-dino-layout">
        <div className="realm-character-card">
          <DinosaurArt species={d.species} element={d.element} stage={d.stage} className={rarityClass(d.rarity)} />
          <span className="realm-concept-label">
            {stageName(d.stage, lang)}
          </span>
        </div>
        <div className="realm-dino-copy">
          <span className="realm-tag" style={{ color: el.color, borderColor: el.color }}>
            {el.symbol} {el.name[lang].toUpperCase()} · {el.role[lang].toUpperCase()}
          </span>
          <h3>
            {d.nickname} <small>· {SPECIES_NAMES[d.species]}</small>
            <RarityBadge rarity={rarityOf(d)} lang={lang} />
          </h3>
          <div className="realm-level">
            <strong>{d.level}</strong>
            <span>
              {stageName(d.stage, lang)}
              <small>{tr(lang, 'NIVEL', 'LEVEL')}</small>
            </span>
          </div>
          <p>
            {d.stage === 'baby'
              ? tr(
                  lang,
                  'Crește în habitat. Poate lupta după evoluția la nivelul 10.',
                  'Grows in the habitat. Can battle after evolving at level 10.',
                )
              : tr(
                  lang,
                  'Rolul este dat de element; specia schimbă puțin statisticile.',
                  'The element sets the role; the species tweaks the stats.',
                )}{' '}
            {Math.round(dinoIncome(save, d))} ●/h.
          </p>
          {d.stage !== 'baby' && (
            <div className="realm-stat-row">
              {Object.entries(stats(d.level, d.stage, d.species, rarityOf(d))).map(([key, value]) => (
                <span key={key}>
                  <small>{key.toUpperCase()}</small>
                  <b>{value}</b>
                </span>
              ))}
            </div>
          )}
          <div className="realm-dino-actions">
            <button
              className="realm-button"
              disabled={inBattle || d.level === 50 || save.food < feedCost(d.level)}
              onClick={() => run({ type: gate ? 'evolve' : 'feed', dinoId: d.id })}
            >
              {gate ? tr(lang, 'Evoluează', 'Evolve') : tr(lang, 'Hrănește', 'Feed')} · {feedCost(d.level)} ❧
            </button>
            {d.id === save.champion ? (
              <span className="realm-tag">★ {tr(lang, 'CAMPION', 'CHAMPION')}</span>
            ) : (
              <button
                className="realm-button secondary"
                disabled={!!save.battle}
                onClick={() => run({ type: 'setChampion', dinoId: d.id })}
              >
                ★ {tr(lang, 'Fă-l campion', 'Make champion')}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="realm-evolutions">
        {(['baby', 'juvenile', 'adult'] as Stage[]).map((stage, i) => (
          <div key={stage} className={d.stage === stage ? 'selected' : ''}>
            <DinosaurArt species={d.species} element={d.element} stage={stage} />
            <strong>{stageName(stage, lang)}</strong>
            <small>
              {
                [
                  tr(lang, 'Nivel 1–9', 'Level 1–9'),
                  tr(lang, 'Nivel 10–24 · Skill', 'Level 10–24 · Skill'),
                  tr(lang, 'Nivel 25–50 · Ultimată', 'Level 25–50 · Ultimate'),
                ][i]
              }
            </small>
          </div>
        ))}
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
