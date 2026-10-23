import { ARENA_BOSSES } from './arenaBosses';
import { useState } from 'react';
import { ELEMENTS, type Dino, type RealmId, type Stage } from './game';
import { DINOSAURS, STAGES } from './dinosaurs';
import { DinosaurArt } from './DinosaurArt';

export function DinosaurCollection({ lang, dinos, openOwned, openMarket, initialElement = 'fire' }: {
  lang: number; dinos: Dino[]; openOwned: (id: string) => void; openMarket: () => void; initialElement?: RealmId;
}) {
  const [element, setElement] = useState<RealmId>(DINOSAURS.some(d => d.element === initialElement) ? initialElement : 'fire');
  const [stage, setStage] = useState<Stage>('adult');
  const tr = (ro: string, en: string) => lang ? en : ro;
  const discovered = new Set(dinos.map(d => `${d.species}_${d.element}`)).size;
  return <div className="dinosaur-catalog">
    <p>{tr(`${DINOSAURS.length} variante elementale · ${DINOSAURS.length * STAGES.length} stadii animate. Descoperite: ${discovered} / ${DINOSAURS.length}. Ouăle vin din poveste și din Piață.`, `${DINOSAURS.length} elemental variants · ${DINOSAURS.length * STAGES.length} animated stages. Discovered: ${discovered} / ${DINOSAURS.length}. Eggs come from the story and the Market.`)}</p>
    <div className="dinosaur-filters" aria-label={lang ? 'Element filter' : 'Filtru elemental'}>
      {ELEMENTS.filter(e => DINOSAURS.some(d => d.element === e.id)).map(e => <button key={e.id} aria-pressed={element === e.id} onClick={() => setElement(e.id)}>{e.symbol} {e.name[lang]}</button>)}
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
      {dinos.filter(d => d.species === 'boss' && d.element === element).map(d => (
        <article className="realm-collection-card owned" key={d.id} data-dinosaur={`boss_${element}`}>
          <DinosaurArt species="boss" element={element} stage="adult" />
          <h3>BOSS {ARENA_BOSSES[element].name}</h3>
          <p>{tr('Recompens? din lupta cu bossul ? Adult', 'Boss battle reward ? Adult')}</p>
          <button className="realm-button secondary" onClick={() => openOwned(d.id)}>{d.nickname}</button>
        </article>
      ))}
    </div>
  </div>;
}
