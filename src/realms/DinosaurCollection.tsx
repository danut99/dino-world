import { useState, type CSSProperties } from 'react';
import { RarityBadge, rarityClass } from './Rarity';
import { ARENA_BOSSES } from './arenaBosses';
import { ELEMENTS, MARKET_ELEMENTS, type Dino, type RealmId, type Stage } from './game';
import { DINOSAURS, STAGES } from './dinosaurs';
import { DinosaurArt } from './DinosaurArt';
import { Icon, elementIcon } from './ui/Icon';
import './hero-book.css';
const stageNames = { baby: ['Pui', 'Baby'], juvenile: ['Juvenil', 'Juvenile'], adult: ['Adult', 'Adult'] };
export function DinosaurCollection({ lang, dinos, openOwned, openMarket, openExpeditions, initialElement = 'fire' }: {
  lang: number; dinos: Dino[]; openOwned: (id: string) => void; openMarket: () => void; openExpeditions?: () => void; initialElement?: RealmId;
}) {
  const [element, setElement] = useState<RealmId>(DINOSAURS.some(d => d.element === initialElement) ? initialElement : 'fire');
  const [stage, setStage] = useState<Stage>('adult'), [onlyOwned, setOnlyOwned] = useState(false);
  const tr = (ro: string, en: string) => lang ? en : ro;
  const has = (species: string, realm: RealmId) => dinos.some(d => d.species === species && d.element === realm);
  const discovered = DINOSAURS.filter(d => has(d.species, d.element)).length;
  const current = ELEMENTS.find(e => e.id === element)!;
  const families = DINOSAURS.filter(d => d.element === element), owned = families.filter(d => has(d.species, element)).length;
  const bosses = dinos.filter(d => d.species === 'boss' && d.element === element);
  return <div className="hero-book" style={{ '--hero-element': current.color } as CSSProperties}>
    <header className="hero-book-summary"><div><small>{tr('ALBUMUL EXPLORATORULUI', 'EXPLORER’S ALBUM')}</small><h2>{tr('Descoperă. Crește. Colecționează.', 'Discover. Raise. Collect.')}</h2></div><div className="hero-book-progress"><strong>{discovered}<span> / {DINOSAURS.length}</span></strong><progress value={discovered} max={DINOSAURS.length} /><small>{tr('variante descoperite', 'variants discovered')}</small></div></header>
    <div className="hero-book-layout"><nav className="hero-elements" aria-label={tr('Filtru elemental', 'Element filter')}>{ELEMENTS.filter(e => DINOSAURS.some(d => d.element === e.id)).map(e => {
      const all = DINOSAURS.filter(d => d.element === e.id), count = all.filter(d => has(d.species, e.id)).length;
      return <button key={e.id} aria-label={e.name[lang]} title={e.name[lang]} style={{ '--tab-color': e.color } as CSSProperties} aria-pressed={element === e.id} onClick={() => setElement(e.id)}><Icon name={elementIcon(e.id)} /><span>{e.name[lang]}</span><small>{count}/{all.length}</small></button>;
    })}</nav><section className="hero-book-page">
      <header className="hero-element-title"><span className="hero-element-seal"><Icon name={elementIcon(element)} scale={3} /></span><div><small>{tr('TĂRÂM ELEMENTAL', 'ELEMENTAL REALM')}</small><h3>{current.name[lang]}</h3><p>{current.role[lang]} · {owned}/{families.length} {tr('descoperite', 'discovered')}</p></div></header>
      <div className="hero-book-controls"><div className="hero-stage-tabs" aria-label={tr('Stadiu de evoluție', 'Evolution stage')}>{STAGES.map(s => <button key={s} aria-pressed={stage === s} onClick={() => setStage(s)}>{stageNames[s][lang]}</button>)}</div><label><input type="checkbox" checked={onlyOwned} onChange={e => setOnlyOwned(e.target.checked)} />{tr('Doar ale mele', 'Owned only')}</label></div>
      <div className="hero-book-cards">{families.filter(d => !onlyOwned || has(d.species, element)).map(d => {
        const mine = dinos.filter(x => x.species === d.species && x.element === element), market = MARKET_ELEMENTS.includes(element);
        return <article className={`hero-specimen ${mine.length ? 'discovered' : ''}`} key={d.id} data-dinosaur={d.id}>
          <div className="hero-specimen-art"><span className="hero-specimen-number">No. {String(DINOSAURS.indexOf(d) + 1).padStart(2, '0')}</span><span className="hero-specimen-status">{mine.length ? `✓ ${tr('Descoperit', 'Discovered')}` : tr('De descoperit', 'Undiscovered')}</span><div className="hero-art-halo" /><DinosaurArt species={d.species} element={element} stage={stage} /><span className="hero-specimen-stage">{stageNames[stage][lang]}</span></div>
          <div className="hero-specimen-info"><h3>{d.name}</h3><div className="hero-role"><Icon name={elementIcon(element)} scale={1} />{d.role[lang]}</div><p className="hero-source">{mine.length ? tr('În colecția ta', 'In your collection') : market ? tr('Ou disponibil în Piață', 'Egg available at the Market') : tr('Ou din poveste, expediții sau arenă', 'Egg from story, expeditions or arena')}</p><button className={`hero-book-action ${mine.length ? '' : 'secondary'}`} onClick={() => mine.length ? openOwned(mine[0].id) : market ? openMarket() : (openExpeditions ?? openMarket)()}>{mine.length ? `${mine[0].nickname}${mine.length > 1 ? ` ×${mine.length}` : ''}` : market ? tr('Vezi în Piață', 'Visit Market') : tr('Explorează', 'Explore')} <span>→</span></button></div>
        </article>;
      })}{bosses.map(d => <article className="hero-specimen discovered" key={d.id} data-dinosaur={`boss_${element}`}><div className="hero-specimen-art"><span className="hero-specimen-status">BOSS</span><DinosaurArt species="boss" element={element} stage="adult" className={rarityClass('legendary')} /></div><div className="hero-specimen-info"><h3>{ARENA_BOSSES[element].name}</h3><RarityBadge rarity="legendary" lang={lang} /><p className="hero-source">{tr('Recompensă din lupta cu bossul · Adult', 'Boss battle reward · Adult')}</p><button className="hero-book-action" onClick={() => openOwned(d.id)}>{d.nickname} →</button></div></article>)}</div>
      {onlyOwned && !owned && !bosses.length && <div className="hero-book-empty"><Icon name="egg" scale={3} /><h3>{tr('Primul erou te așteaptă', 'Your first hero awaits')}</h3><p>{tr('Nu ai descoperit încă un dinozaur din acest element.', 'You have not discovered a dinosaur of this element yet.')}</p><button className="hero-book-action" onClick={() => setOnlyOwned(false)}>{tr('Vezi variantele', 'See the variants')}</button></div>}
      <p className="hero-book-note">{tr('Stadiile sunt previzualizări. Deschide un erou pentru nivel, raritate și evoluție.', 'Stages are previews. Open an owned hero for its level, rarity and evolution.')}</p>
    </section></div>
  </div>;
}
