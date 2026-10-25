import { useState, type CSSProperties } from 'react';
import { rarityClass } from './Rarity';
import { ARENA_BOSSES } from './arenaBosses';
import { COLLECTION, ELEMENTS, MARKET_ELEMENTS, type Dino, type RealmId, type Species, type Stage } from './game';
import { DINOSAURS, STAGES } from './dinosaurs';
import { DinosaurArt } from './DinosaurArt';
import { Icon, elementIcon } from './ui/Icon';
import { Pager } from './ui/Pager';
import { usePager } from './ui/usePager';
import './hero-book.css';

const stageNames = { baby: ['Pui', 'Baby'], juvenile: ['Juvenil', 'Juvenile'], adult: ['Adult', 'Adult'] };
type Entry = { id: string; species: Species; element: RealmId; boss: boolean; name: string };
/** The thirty collection entries (see COLLECTION): every playable family, then each world's boss. */
const ENTRIES: Entry[] = COLLECTION.map((id) => {
  const [species, element] = id.split('_') as [Species, RealmId];
  const boss = species === 'boss';
  return { id, species, element, boss, name: boss ? ARENA_BOSSES[element].name : DINOSAURS.find((d) => d.id === id)?.name ?? species };
}).sort((a, b) => Number(a.boss) - Number(b.boss) || ELEMENTS.findIndex((e) => e.id === a.element) - ELEMENTS.findIndex((e) => e.id === b.element));

/**
 * The collection album: thirty entries (twenty families and ten bosses), counted from `discovered` so a released
 * dinosaur stays in it. Undiscovered entries show as silhouettes. One element at a time (or all), paged.
 */
export function DinosaurCollection({ lang, dinos, discovered, openOwned, openMarket, openExpeditions, initialElement }: {
  lang: number;
  dinos: Dino[];
  /** Families ever hatched (`species_element`). */
  discovered: string[];
  openOwned: (id: string) => void;
  openMarket: () => void;
  openExpeditions?: () => void;
  initialElement?: RealmId;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [element, setElement] = useState<RealmId | 'all'>(initialElement ?? 'all');
  const [stage, setStage] = useState<Stage>('adult');
  const found = (e: Entry) => discovered.includes(e.id) || dinos.some((d) => d.species === e.species && d.element === e.element);
  const shown = element === 'all' ? ENTRIES : ENTRIES.filter((e) => e.element === element);
  const pager = usePager(shown, { itemSelector: '.hero-card' });
  const total = ENTRIES.filter(found).length,
    families = ENTRIES.filter((e) => !e.boss && found(e)).length,
    bosses = ENTRIES.filter((e) => e.boss && found(e)).length;
  const go = (e: Entry) => {
    const mine = dinos.find((d) => d.species === e.species && d.element === e.element);
    if (mine) return openOwned(mine.id);
    if (!e.boss && MARKET_ELEMENTS.includes(e.element)) return openMarket();
    (openExpeditions ?? openMarket)();
  };
  return (
    <div className="fit-panel hero-book">
      <header className="pk-head">
        <span className="pk-level">
          <small>{tr('COLECȚIE', 'ALBUM')}</small>
          {total}
        </span>
        <div className="pk-head-text">
          <strong>
            {total}/{ENTRIES.length} {tr('descoperiți', 'discovered')}
          </strong>
          <small>
            {tr('Familii', 'Families')} {families}/{ENTRIES.filter((e) => !e.boss).length} · {tr('Boși', 'Bosses')} {bosses}/{ENTRIES.filter((e) => e.boss).length}
          </small>
          <div className="pk-meter">
            <i style={{ width: `${(total / ENTRIES.length) * 100}%` }} />
          </div>
        </div>
        <div className="pk-head-actions pk-chips" role="group" aria-label={tr('Stadiu', 'Stage')}>
          {STAGES.map((s) => (
            <button key={s} className="pk-chip" aria-pressed={stage === s} onClick={() => setStage(s)}>
              {stageNames[s][lang]}
            </button>
          ))}
        </div>
      </header>
      <div className="pk-chips hero-filter" role="group" aria-label={tr('Element', 'Element')}>
        <button className="pk-chip" aria-pressed={element === 'all'} onClick={() => setElement('all')}>
          {tr('Toate', 'All')} <small>{total}/{ENTRIES.length}</small>
        </button>
        {ELEMENTS.map((e) => {
          const all = ENTRIES.filter((x) => x.element === e.id);
          return (
            <button key={e.id} className="pk-chip" aria-pressed={element === e.id} title={e.name[lang]} aria-label={e.name[lang]} style={{ '--tab-color': e.color } as CSSProperties} onClick={() => setElement(e.id)}>
              <Icon name={elementIcon(e.id)} scale={1} />
              <span className="hero-filter-name">{e.name[lang]}</span>
              <small>
                {all.filter(found).length}/{all.length}
              </small>
            </button>
          );
        })}
      </div>
      <div ref={pager.ref} className="ui-paged hero-cards">
        {pager.pageItems.map((e) => {
          const known = found(e),
            mine = dinos.filter((d) => d.species === e.species && d.element === e.element),
            el = ELEMENTS.find((x) => x.id === e.element)!;
          return (
            <button
              key={e.id}
              className={`hero-card${known ? ' known' : ''}${e.boss ? ' boss' : ''}`}
              style={{ '--hero-element': el.color } as CSSProperties}
              data-dinosaur={e.id}
              onClick={() => go(e)}
              title={known ? e.name : tr('Nedescoperit', 'Undiscovered')}
            >
              <span className="hero-card-art">
                <span className="hero-card-tag">{e.boss ? 'BOSS' : `No. ${String(ENTRIES.indexOf(e) + 1).padStart(2, '0')}`}</span>
                <DinosaurArt species={e.species} element={e.element} stage={e.boss ? 'adult' : stage} paused={!known} frame={known ? undefined : 0} className={e.boss ? rarityClass('legendary') : ''} />
              </span>
              <strong>{known ? e.name : '???'}</strong>
              <small>
                <Icon name={elementIcon(e.element)} scale={1} />{' '}
                {mine.length
                  ? `${mine[0].nickname}${mine.length > 1 ? ` ×${mine.length}` : ''}`
                  : known
                    ? tr('Descoperit', 'Discovered')
                    : e.boss
                      ? tr('Învinge bossul ligii', "Beat the league's boss")
                      : MARKET_ELEMENTS.includes(e.element)
                        ? tr('Ou în Piață', 'Egg at the Market')
                        : tr('Arenă și expediții', 'Arena and expeditions')}
              </small>
            </button>
          );
        })}
      </div>
      <div className="pk-foot">
        <p className="pk-note">{tr('Familiile rămân în colecție și după ce eliberezi un dinozaur.', 'Families stay in the collection after you release a dinosaur.')}</p>
        <Pager page={pager.page} pages={pager.pages} onPrev={pager.prev} onNext={pager.next} lang={lang} />
      </div>
    </div>
  );
}
