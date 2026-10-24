import { ResourceHelp } from './ResourceHelp';
import { useState, type CSSProperties } from 'react';
import { ELEMENTS, REALM_NAMES, WORLD_UNLOCK, HABITAT_LEVELS, habitatCapacity, type Save, type RealmId, type Command } from './game';
import { ITEMS, type ItemId } from './content';
import { ISLANDS } from './islands';
import { Icon, elementIcon } from './ui/Icon';
import './realms-panel.css';

export function RealmsPanel({ save, lang, current, visit, run, workshop, initialRealm }: {
  save: Save; lang: number; current: 'home' | RealmId; visit: (realm: 'home' | RealmId) => void;
  run: (command: Command) => boolean; workshop: () => void;
  initialRealm?: RealmId;
}) {
  const [selected, select] = useState<RealmId>(initialRealm ?? (current === 'home' ? 'fire' : current));
  const tr = (ro: string, en: string) => lang ? en : ro;
  const el = ELEMENTS.find(e => e.id === selected)!;
  const level = save.habitats[selected] ?? 0, open = level > 0;
  const next = open ? HABITAT_LEVELS[level] : undefined;
  const cost = open ? { gold: next?.gold ?? 0, materials: { habitatKit: 1 } } : WORLD_UNLOCK[selected];
  const affordable = save.gold >= cost.gold && Object.entries(cost.materials).every(([id, n]) => save.inventory[id as ItemId] >= n!);
  const residents = save.dinos.filter(d => d.element === selected).length;
  const unlocked = ELEMENTS.filter(e => save.habitats[e.id]).length;
  return <div className="realm-atlas" style={{ '--atlas-color': el.color } as CSSProperties}>
    <header className="atlas-summary"><div><small>{tr('ATLASUL EXPLORATORULUI', 'EXPLORER’S ATLAS')}</small><h2>{tr('Zece lumi. Aventura ta.', 'Ten worlds. Your adventure.')}</h2></div><span><b>{unlocked} / {ELEMENTS.length}</b>{tr('tărâmuri deschise', 'worlds unlocked')}</span></header>
    <div className="atlas-layout"><nav className="atlas-worlds" aria-label={tr('Alege tărâmul', 'Choose a realm')}>
      <button className="atlas-home" onClick={() => visit('home')}><Icon name="build" /><span>{tr('Insula principală', 'Main island')}<small>{tr('Clădiri și producție', 'Buildings and production')}</small></span><b>↗</b></button>
      <div className="atlas-elements">{ELEMENTS.map(e => <button key={e.id} aria-label={e.name[lang]} title={e.name[lang]} aria-pressed={selected === e.id} onClick={() => select(e.id)}><Icon name={elementIcon(e.id)} /><span>{e.name[lang]}</span><small>{save.habitats[e.id] ? `Nv. ${save.habitats[e.id]}` : tr('Blocat', 'Locked')}</small><b className={save.habitats[e.id] ? 'is-open' : ''}>{save.habitats[e.id] ? '✓' : '◇'}</b></button>)}</div>
    </nav><section className="atlas-detail" aria-label={el.name[lang]}>
      <div className="atlas-landscape"><span className="atlas-state">{open ? tr('✓ Tărâm deblocat', '✓ World unlocked') : tr('◇ Tărâm nedescoperit', '◇ Unexplored world')}</span><img src={ISLANDS[selected].art} alt={REALM_NAMES[selected][lang]} /><span className="atlas-element"><Icon name={elementIcon(selected)} scale={1} />{el.name[lang]}</span></div>
      <div className="atlas-body"><header><h3>{REALM_NAMES[selected][lang]}</h3><p>{tr('Habitat elemental', 'Elemental habitat')} · {el.role[lang]}</p></header>
        {open ? <><div className="atlas-stats"><div><small>{tr('NIVEL', 'LEVEL')}</small><strong>{level}<span> / {HABITAT_LEVELS.length}</span></strong></div><div><small>{tr('DINOZAURI', 'DINOSAURS')}</small><strong>{residents}<span> / {habitatCapacity(save, selected)}</span></strong></div><div><small>{tr('LOCURI LIBERE', 'FREE SPOTS')}</small><strong>{Math.max(0, habitatCapacity(save, selected) - residents)}</strong></div></div><button className="atlas-primary" onClick={() => visit(selected)}>{current === selected ? tr('Revino în tărâm', 'Return to world') : tr('Intră în tărâm', 'Enter world')} →</button></>
          : <p className="atlas-locked-copy">{tr('Deblochează această lume pentru a ecloza și găzdui dinozaurii acestui element.', 'Unlock this world to hatch and house dinosaurs of this element.')}</p>}
        {(!open || next) ? <section className="atlas-upgrade"><div className="atlas-upgrade-heading"><Icon name={open ? 'habitatKit' : 'crystal'} scale={1} /><strong>{open ? tr(`Îmbunătățire · Nivel ${level + 1}`, `Upgrade · Level ${level + 1}`) : tr('Deschide un nou orizont', 'Unlock a new horizon')}</strong>{next && <small>{next.capacity} {tr('locuri', 'spots')}</small>}</div>
          {next && next.capacity === habitatCapacity(save, selected) && <p>{tr('Mărește depozitul și venitul.', 'Increase storage and income.')}</p>}
          <div className="atlas-costs"><div className={save.gold < cost.gold ? 'missing' : ''}><Icon name="gold" scale={1} /><span>{tr('Aur', 'Gold')}</span><strong>{cost.gold.toLocaleString(lang ? 'en-US' : 'ro-RO')}</strong><small>{tr('Ai', 'Owned')}: {Math.floor(save.gold).toLocaleString(lang ? 'en-US' : 'ro-RO')}</small></div>{Object.entries(cost.materials).map(([id, n]) => <div key={id} className={save.inventory[id as ItemId] < n! ? 'missing' : ''}><Icon name={id === 'provisions' ? 'chest' : id as Exclude<ItemId, 'provisions'>} scale={1} /><span>{ITEMS[id as ItemId].name[lang]}</span><strong>{n}</strong><small>{tr('Ai', 'Owned')}: {save.inventory[id as ItemId]}</small></div>)}</div>
          <ResourceHelp save={save} lang={lang} gold={cost.gold} materials={cost.materials} /><button className={open ? 'atlas-secondary' : 'atlas-primary'} disabled={!affordable} onClick={() => run({ type: open ? 'upgradeHabitat' : 'unlockHabitat', realm: selected })}>{open ? tr('Îmbunătățește habitatul', 'Upgrade habitat') : tr('Deblochează tărâmul', 'Unlock world')} →</button>
          {!affordable && <p className="atlas-shortage">{tr('Adună resursele lipsă pentru a continua.', 'Gather the missing resources to continue.')}</p>}
          {open && save.inventory.habitatKit < 1 && <button className="atlas-workshop" onClick={workshop}>{tr('Fabrică un kit în Atelier', 'Craft a kit in the Workshop')} →</button>}
        </section> : <p className="atlas-max">✓ {tr('Habitat la nivel maxim', 'Habitat at maximum level')}</p>}
      </div>
    </section></div>
  </div>;
}
