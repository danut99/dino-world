import { useMemo } from 'react';
import { DinosaurArt } from './DinosaurArt';
import { rarityClass } from './Rarity';
import { ELEMENTS, ROLE_ICONS, ROLE_NAMES, SPECIES_ROLE, type Dino, type RealmId } from './game';
import { Pager } from './ui/Pager';
import { usePager } from './ui/usePager';
import { Icon, elementIcon } from './ui/Icon';

/**
 * Picks a team of up to `max` dinosaurs from a paged roster that fits the space it is given (no scrolling).
 * `isEligible` says why a dinosaur cannot join (a short text shown on its tile), or null when it can. A click adds
 * or removes a dinosaur; with the team full, the new one takes the last place. Members are numbered in pick order.
 * Shared by expeditions and, later, the arena team.
 */
export function TeamPicker({
  dinos,
  selected,
  max,
  onChange,
  isEligible,
  lang = 0,
  recommended,
  label,
  className = '',
}: {
  dinos: readonly Dino[];
  selected: string[];
  max: number;
  onChange: (team: string[]) => void;
  isEligible: (d: Dino) => string | null;
  lang?: number;
  /** An element worth picking (its tiles get a mark). */
  recommended?: RealmId;
  /** Title over the roster; defaults to "Echipa / Team". */
  label?: string;
  className?: string;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  // Able dinosaurs first, then by level; the order does not move while picking.
  const roster = useMemo(
    () =>
      dinos
        .map((d) => ({ d, reason: isEligible(d) }))
        .sort((a, b) => Number(!!a.reason) - Number(!!b.reason) || b.d.level - a.d.level),
    [dinos, isEligible],
  );
  const pager = usePager(roster, { itemSelector: '.team-pick', initial: 6 });
  const toggle = (id: string) => {
    if (selected.includes(id)) return onChange(selected.filter((x) => x !== id));
    if (selected.length < max) return onChange([...selected, id]);
    onChange([...selected.slice(0, max - 1), id]);
  };
  return (
    <div className={`team-picker ${className}`}>
      <div className="team-picker-head">
        <span>
          {label ?? tr('Echipa', 'Team')}{' '}
          <b>
            {selected.length}/{max}
          </b>
        </span>
        <Pager page={pager.page} pages={pager.pages} onPrev={pager.prev} onNext={pager.next} lang={lang} />
      </div>
      {roster.length === 0 ? (
        <p className="team-picker-empty">{tr('Nu ai încă dinozauri.', 'No dinosaurs yet.')}</p>
      ) : (
        <div
          className="team-picker-roster ui-paged"
          ref={pager.ref}
          role="group"
          aria-label={label ?? tr('Echipa', 'Team')}
        >
          {pager.pageItems.map(({ d, reason }) => {
            const place = selected.indexOf(d.id);
            const element = ELEMENTS.find((e) => e.id === d.element)!;
            return (
              <button
                key={d.id}
                type="button"
                className={`team-pick${place >= 0 ? ' picked' : ''}${reason ? ' unable' : ''}${recommended === d.element ? ' recommended' : ''}`}
                aria-pressed={place >= 0}
                disabled={!!reason && place < 0}
                title={`${d.nickname} · ${element.name[lang]} · ${ROLE_NAMES[SPECIES_ROLE[d.species]][lang]} · ${tr('nivel', 'level')} ${d.level}${reason ? ` · ${reason}` : ''}`}
                onClick={() => toggle(d.id)}
              >
                <span className="team-pick-art">
                  <DinosaurArt
                    species={d.species}
                    element={d.element}
                    stage={d.stage}
                    paused
                    frame={0}
                    className={rarityClass(d.rarity)}
                  />
                </span>
                <span className="team-pick-level">
                  <Icon name={elementIcon(d.element)} scale={1} />
                  {d.level}
                </span>
                {place >= 0 && <b className="team-pick-place">{place + 1}</b>}
                <i className="team-pick-role" aria-hidden="true">
                  {ROLE_ICONS[SPECIES_ROLE[d.species]]}
                </i>
                {reason && <small className="team-pick-reason">{reason}</small>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
