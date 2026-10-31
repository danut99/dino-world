import { useEffect, useState } from 'react';
import type { Clip } from './animation';
import { DinosaurArt } from './DinosaurArt';
import type { Species } from './dinosaurs';
import { ELEMENTS, type Dino, type RealmId, type Stage } from './game';
import { useClipSequence } from './useClipSequence';
import './dino-moment.css';

/** The move that shows off each age: a baby walks, a juvenile strikes, an adult unleashes its ultimate. */
export const SIGNATURE: Record<Stage, Clip> = { baby: 'walk', juvenile: 'attack', adult: 'ultimate' };
const STAGE_NAMES: Record<Stage, [string, string]> = {
  baby: ['Pui', 'Baby'],
  juvenile: ['Juvenil', 'Juvenile'],
  adult: ['Adult', 'Adult'],
};

/** A dinosaur that rests on idle and plays `sequence` each time `play` changes (and once when it mounts). */
export function MomentArt({
  species,
  element,
  stage,
  sequence,
  play = 0,
  className,
}: {
  species: Species;
  element: RealmId;
  stage: Stage;
  sequence: readonly Clip[];
  play?: number;
  className?: string;
}) {
  const { clip } = useClipSequence(species, element, stage, sequence, { play });
  return <DinosaurArt species={species} element={element} stage={stage} animation={clip} className={className} />;
}

/** Evolution: the old age for a moment, a flash, then the new age showing off the move it just learned. */
export function EvolveMoment({ dino, from, lang, close }: { dino: Dino; from: Stage; lang: number; close: () => void }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGrown(true), 1100);
    return () => window.clearTimeout(t);
  }, []);
  const el = ELEMENTS.find((e) => e.id === dino.element)!,
    move = SIGNATURE[dino.stage];
  return (
    <div className="dino-moment" style={{ '--el': el.color } as React.CSSProperties}>
      <div className={`dino-moment-stage stage-${grown ? dino.stage : from}`}>
        <span className="dino-moment-glow" aria-hidden="true" />
        {grown && <span className="dino-moment-flash" aria-hidden="true" />}
        <span className="dino-moment-art">
          {grown ? (
            <MomentArt species={dino.species} element={dino.element} stage={dino.stage} sequence={[move]} />
          ) : (
            <DinosaurArt species={dino.species} element={dino.element} stage={from} />
          )}
        </span>
      </div>
      <h3>
        {grown
          ? tr(`${dino.nickname} a evoluat!`, `${dino.nickname} evolved!`)
          : tr(`${dino.nickname} se schimbă…`, `${dino.nickname} is changing…`)}
      </h3>
      <p>
        {STAGE_NAMES[from][lang]} → <b>{STAGE_NAMES[dino.stage][lang]}</b>
        {grown &&
          (dino.stage === 'adult'
            ? tr(' · Lovitura supremă e deblocată!', ' · Ultimate move unlocked!')
            : tr(' · Acum poate lupta: atac și apărare!', ' · It can fight now: attack and defend!'))}
      </p>
      <button className="realm-button" onClick={close}>
        {tr('Super!', 'Awesome!')}
      </button>
    </div>
  );
}

/** A new hatchling: it takes its first steps, then looks around. */
export function HatchMoment({ dino, lang, close }: { dino: Dino; lang: number; close: () => void }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const el = ELEMENTS.find((e) => e.id === dino.element)!;
  return (
    <div className="dino-moment" style={{ '--el': el.color } as React.CSSProperties}>
      <div className={`dino-moment-stage stage-${dino.stage}`}>
        <span className="dino-moment-glow" aria-hidden="true" />
        <span className="dino-moment-flash" aria-hidden="true" />
        <span className="dino-moment-art">
          <MomentArt
            species={dino.species}
            element={dino.element}
            stage={dino.stage}
            sequence={[SIGNATURE[dino.stage]]}
          />
        </span>
      </div>
      <h3>{tr(`Bun venit, ${dino.nickname}!`, `Welcome, ${dino.nickname}!`)}</h3>
      <p>
        {el.name[lang]} · {STAGE_NAMES[dino.stage][lang]}
      </p>
      <button className="realm-button" onClick={close}>
        {tr('Super!', 'Awesome!')}
      </button>
    </div>
  );
}

/** Back from a trip: the team's leader walks in along the bottom of the screen with what it brought. */
export function TripReturn({
  dino,
  gold,
  food,
  lang,
  close,
}: {
  dino: Dino;
  gold: number;
  food: number;
  lang: number;
  close: () => void;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const { clip } = useClipSequence(dino.species, dino.element, dino.stage, ['walk']);
  useEffect(() => {
    const t = window.setTimeout(close, 4500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button className="dino-trip" onClick={close}>
      <span className="dino-trip-art">
        <DinosaurArt species={dino.species} element={dino.element} stage={dino.stage} animation={clip} />
      </span>
      <span className="dino-trip-text">
        <strong>{tr(`${dino.nickname} e acasă!`, `${dino.nickname} is home!`)}</strong>
        <small>
          {gold > 0 && `+${Math.round(gold)} ${tr('aur', 'gold')}`}
          {gold > 0 && food > 0 && ' · '}
          {food > 0 && `+${Math.round(food)} ${tr('hrană', 'food')}`}
        </small>
      </span>
    </button>
  );
}
