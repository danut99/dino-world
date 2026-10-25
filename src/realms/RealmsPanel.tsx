import { ResourceHelp } from './ResourceHelp';
import { useState, type CSSProperties } from 'react';
import { ELEMENTS, REALM_NAMES, WORLD_UNLOCK, HABITAT_LEVELS, habitatCapacity, worldLock, type Save, type RealmId, type Command } from './game';
import { worldLockText } from './DinoPanels';
import { ConstructionStrip, CostChips, UpgradeButton, affordable, underConstruction } from './PanelKit';
import { ISLANDS } from './islands';
import { Icon, elementIcon } from './ui/Icon';
import './realms-panel.css';

/** The atlas: the ten element worlds (opened in order), the chosen one's island, and how to open or grow it. */
export function RealmsPanel({ save, now, lang, current, visit, run, workshop, initialRealm }: {
  save: Save; now: number; lang: number; current: 'home' | RealmId; visit: (realm: 'home' | RealmId) => void;
  run: (command: Command) => boolean; workshop: () => void;
  initialRealm?: RealmId;
}) {
  const [selected, select] = useState<RealmId>(initialRealm ?? (current === 'home' ? 'fire' : current));
  const tr = (ro: string, en: string) => lang ? en : ro;
  const el = ELEMENTS.find(e => e.id === selected)!;
  const level = save.habitats[selected] ?? 0, open = level > 0;
  const next = open ? HABITAT_LEVELS[level] : undefined;
  const cost = open ? { gold: next?.gold ?? 0, materials: { habitatKit: next?.kits ?? 0 } } : WORLD_UNLOCK[selected];
  // Worlds open in order (see worldLock); the reason shows instead of the unlock button.
  const lock = open ? null : worldLockText(save, selected, lang);
  const canPay = affordable(save, cost.gold, cost.materials);
  const residents = save.dinos.filter(d => d.element === selected).length;
  const unlocked = ELEMENTS.filter(e => save.habitats[e.id]).length;
  return <div className="fit-panel realm-atlas" style={{ '--atlas-color': el.color } as CSSProperties}>
    <header className="pk-head">
      <span className="pk-level"><small>{tr('LUMI', 'WORLDS')}</small>{unlocked}</span>
      <div className="pk-head-text"><strong>{tr(`${unlocked} din ${ELEMENTS.length} lumi deschise`, `${unlocked} of ${ELEMENTS.length} worlds open`)}</strong><small>{tr('Lumile se deschid pe rând: fiecare cere lumea dinainte și expediția ei.', 'Worlds open in order: each needs the previous world and its expedition.')}</small></div>
      <div className="pk-head-actions"><button className="realm-button secondary" onClick={() => visit('home')}><Icon name="build" scale={1} /> {tr('Insula principală', 'Main island')}</button></div>
    </header>
    <div className="atlas-layout">
      <nav className="atlas-elements" aria-label={tr('Alege lumea', 'Choose a world')}>{ELEMENTS.map(e => {
        const lv = save.habitats[e.id], next = !lv && !worldLock(save, e.id);
        return <button key={e.id} aria-label={e.name[lang]} title={e.name[lang]} aria-pressed={selected === e.id} className={`${lv ? 'is-open' : ''}${next ? ' is-next' : ''}`} style={{ '--tab-color': e.color } as CSSProperties} onClick={() => select(e.id)}><Icon name={elementIcon(e.id)} /><span>{e.name[lang]}<small>{lv ? `${tr('Nv.', 'Lv.')} ${lv}` : next ? tr('Se poate deschide', 'Can open') : tr('Blocată', 'Locked')}</small></span></button>;
      })}</nav>
      <section className="atlas-detail" aria-label={el.name[lang]}>
        <div className="atlas-landscape"><img src={ISLANDS[selected].art} alt={REALM_NAMES[selected][lang]} /><span className="atlas-state">{open ? tr('✓ Deschisă', '✓ Open') : tr('◇ Nedescoperită', '◇ Unexplored')}</span></div>
        <div className="atlas-body">
          <h3 className="pk-title">{REALM_NAMES[selected][lang]} <small><Icon name={elementIcon(selected)} scale={1} /> {el.role[lang]}</small></h3>
          {open ? <>
            <dl className="habitat-stats"><div><dt>{tr('Nivel', 'Level')}</dt><dd>{level}/{HABITAT_LEVELS.length}</dd></div><div><dt>{tr('Dinozauri', 'Dinosaurs')}</dt><dd>{residents}/{habitatCapacity(save, selected)}</dd></div><div><dt>{tr('Locuri libere', 'Free spots')}</dt><dd>{Math.max(0, habitatCapacity(save, selected) - residents)}</dd></div></dl>
            <button className="realm-button secondary" onClick={() => visit(selected)}>{current === selected ? tr('Revino în lume', 'Return to world') : tr('Intră în lume', 'Enter world')} →</button>
          </> : <p className="pk-note">{tr('Deschide această lume ca să eclozezi și să găzduiești dinozaurii elementului ei.', 'Open this world to hatch and house dinosaurs of its element.')}</p>}
          {open && underConstruction(save, now, `habitat:${selected}`) ? <div className="atlas-upgrade"><ConstructionStrip save={save} now={now} lang={lang} run={run} target={`habitat:${selected}`} /></div> : (!open || next) ? <div className="atlas-upgrade">
            <span className="pk-upgrade-what"><b className="pk-num">{open ? `⬆ ${tr('Nivel', 'Level')} ${level + 1}` : `🔓 ${tr('Deschide lumea', 'Open the world')}`}</b>{next && ` · ${next.capacity} ${tr('locuri', 'spots')} · ${tr('depozit', 'storage')} ${next.cap}`}</span>
            <CostChips save={save} lang={lang} gold={cost.gold} materials={cost.materials} />
            {lock && <p className="pk-note warn">🔒 {lock}</p>}
            <div className="habitat-buttons">
              {open ? <UpgradeButton save={save} now={now} lang={lang} run={run} target={`habitat:${selected}`} /> : <button className="realm-button" disabled={!canPay || !!worldLock(save, selected)} onClick={() => run({ type: 'unlockHabitat', realm: selected })}>{tr('Deblochează', 'Unlock')}</button>}
              {!lock && <ResourceHelp save={save} lang={lang} gold={cost.gold} materials={cost.materials} />}
              {open && save.inventory.habitatKit < (next?.kits ?? 0) && <button className="realm-link" onClick={workshop}>{tr('Fă un kit în Atelier', 'Craft a kit in the Workshop')} →</button>}
            </div>
          </div> : <p className="pk-note good">✓ {tr('Habitat la nivel maxim', 'Habitat at maximum level')}</p>}
        </div>
      </section>
    </div>
  </div>;
}
