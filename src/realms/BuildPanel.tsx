import { ResourceHelp } from './ResourceHelp';
import { useEffect, useState } from 'react';
import { BuildingSprite } from './BuildingSprite';
import { UTILITY_BUILDINGS, type UtilityKind } from './content';
import type { Command, Save } from './game';
import { Icon, type IconName } from './ui/Icon';
import { LampCard } from './PanelKit';
import './build-panel.css';

const icons: Record<UtilityKind, IconName> = { hatchery: 'egg', farm: 'food', workshop: 'workshop', market: 'market', portal: 'expedition', arena: 'arena' };
/** The build menu: every utility building on the left, the chosen one on the right, and the island lamps below. */
export function BuildPanel({ save, lang, open, place, placeLamp, run, initialKind = 'farm' }: {
  save: Save; lang: number; open: (kind: UtilityKind) => void; place: (id: string | null, kind: UtilityKind) => void;
  placeLamp?: () => void;
  run: (c: Command) => boolean;
  initialKind?: UtilityKind;
}) {
  const tr = (ro: string, en: string) => lang ? en : ro;
  const [kind, select] = useState<UtilityKind>(initialKind);
  useEffect(() => select(initialKind), [initialKind]);
  const spec = UTILITY_BUILDINGS[kind], existing = save.buildings.find(b => b.kind === kind);
  const canAfford = save.gold >= spec.cost;
  return <div className="fit-panel compact-builder">
    <header className="pk-head build-summary">
      <div className="pk-head-text"><strong>{tr('Alege ce construiești', 'Choose your next building')}</strong><small>{tr('Apoi alege un loc verde pe insula principală.', 'Then pick a green spot on the main island.')}</small></div>
      <span className="pk-cost"><Icon name="gold" scale={1} />{Math.floor(save.gold).toLocaleString(lang ? 'en-US' : 'ro-RO')}</span>
    </header>
    <div className="build-browser">
      <nav className="build-picker" aria-label={tr('Clădiri', 'Buildings')}>{(Object.keys(UTILITY_BUILDINGS) as UtilityKind[]).map(id => {
        const built = save.buildings.some(b => b.kind === id);
        return <button key={id} aria-pressed={kind === id} onClick={() => select(id)}><Icon name={icons[id]} /><span>{UTILITY_BUILDINGS[id].name[lang]}<small>{built ? tr('Construită', 'Built') : `${UTILITY_BUILDINGS[id].cost} ${tr('aur', 'gold')}`}</small></span>{built && <b aria-label={tr('Construită', 'Built')}>✓</b>}</button>;
      })}</nav>
      <section className="build-preview" aria-label={spec.name[lang]}>
        <div className="build-art"><span className="build-size">3 × 3</span><BuildingSprite kind={kind} save={save} /><span className={`build-state ${existing ? 'owned' : ''}`}>{existing ? tr('✓ Pe insula ta', '✓ On your island') : tr('Clădire nouă', 'New building')}</span></div>
        <div className="build-details"><h3>{spec.name[lang]}</h3><p>{spec.description[lang]}</p>
          {existing ? <div className="build-buttons"><button className="realm-button" onClick={() => open(kind)}>{tr('Deschide', 'Open')} →</button><button className="realm-button secondary" onClick={() => place(existing.id, kind)}>{tr('Mută', 'Move')}</button></div>
            : <div className="build-buttons"><span className="build-cost"><Icon name="gold" scale={1} />{spec.cost || tr('Gratuit', 'Free')}</span><ResourceHelp save={save} lang={lang} gold={spec.cost} /><button className="realm-button" disabled={!canAfford} onClick={() => place(null, kind)}>{canAfford ? tr('Amplasează pe insulă', 'Place on island') : tr(`Mai trebuie ${Math.ceil(spec.cost - save.gold)} aur`, `${Math.ceil(spec.cost - save.gold)} more gold`)}</button></div>}
        </div>
      </section>
    </div>
    <LampCard save={save} lang={lang} run={run} place={placeLamp} openWorkshop={save.buildings.some(b => b.kind === 'workshop') ? () => open('workshop') : undefined} />
  </div>;
}
