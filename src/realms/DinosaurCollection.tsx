import { useState } from 'react';
import { ELEMENTS, type Dino, type RealmId, type Stage } from './game';
import { DINOSAURS, STAGES } from './dinosaurs';
import { DinosaurArt } from './DinosaurArt';

export function DinosaurCollection({ lang, dinos, openOwned, openMarket, initialElement = 'fire' }: {
  lang: number; dinos: Dino[]; openOwned: (id: string) => void; openMarket: () => void; initialElement?: RealmId;
}) {
  const [element, setElement] = useState<RealmId>(initialElement);
  const [stage, setStage] = useState<Stage>('adult');
  const tr = (ro: string, en: string) => lang ? en : ro;
  const discovered = new Set(dinos.map(d => `${d.species}_${d.element}`)).size;
  return <div className="dinosaur-catalog">
    <p>{tr(`50 de variante elementale · 150 de stadii. Descoperite: ${discovered} / 50. Ouăle vin din poveste și din Piață.`, `50 elemental variants · 150 stage designs. Discovered: ${discovered} / 50. Eggs come from the story and the Market.`)}</p>
    <div className="dinosaur-filters" aria-label={lang ? 'Element filter' : 'Filtru elemental'}>
      {ELEMENTS.map(e => <button key={e.id} aria-pressed={element === e.id} onClick={() => setElement(e.id)}>{e.symbol} {e.name[lang]}</button>)}
    </div>
    <div className="dinosaur-filters" aria-label={tr('Stadiu de evoluție', 'Evolution stage')}>
      {STAGES.map((s, i) => <button key={s} aria-pressed={stage === s} onClick={() => setStage(s)}>{[['Copil', 'Baby'], ['Juvenil', 'Juvenile'], ['Adult', 'Adult']][i][lang]}</button>)}
    </div>
    <div className="realm-collection">
      {DINOSAURS.filter(d => d.element === element).map(d => {
        const mine = dinos.filter(x => x.species === d.species && x.element === d.element);
        return <article className={`realm-collection-card ${mine.length ? 'owned' : ''}`} key={d.id} data-dinosaur={d.id}>
          <DinosaurArt species={d.species} element={element} stage={stage} />
          <h3>{d.name}</h3><p>{d.role[lang]}</p>
          {mine.length
            ? <button className="realm-button secondary" onClick={() => openOwned(mine[0].id)}>{mine.map(x => x.nickname).join(', ')}{mine.length > 1 ? ` · ×${mine.length}` : ''}</button>
            : <button className="realm-link" onClick={openMarket}>{tr('NEDESCOPERIT · Piață →', 'UNDISCOVERED · Market →')}</button>}
        </article>;
      })}
    </div>
  </div>;
}
