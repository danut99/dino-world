import type { ReactNode } from 'react';
import { ITEMS, type ItemId } from './content';
import type { Save } from './game';

/** "Next level" card shared by the workshop and the arena gate: what the level adds, its price, and the button. */
export function UpgradeCard({
  save,
  lang,
  level,
  max,
  next,
  gold,
  materials,
  upgrade,
}: {
  save: Save;
  lang: number;
  level: number;
  max: number;
  next: ReactNode[];
  gold: number;
  materials: Partial<Record<ItemId, number>>;
  upgrade: () => void;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const costs = Object.entries(materials) as [ItemId, number][];
  const affordable = save.gold >= gold && costs.every(([id, n]) => save.inventory[id] >= n);
  return (
    <div className="realm-farm-upgrade realm-upgrade-card">
      {level < max ? (
        <>
          <div className="realm-upgrade-details">
            <span className="realm-eyebrow">
              {tr('ÎMBUNĂTĂȚIRE', 'UPGRADE')} · {tr('NIVEL', 'LEVEL')} {level} → {level + 1}
            </span>
            <ul>
              {next.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <div className="realm-farm-costs">
              <span className={save.gold >= gold ? '' : 'short'}>● {gold} {tr('aur', 'gold')}</span>
              {costs.map(([id, n]) => (
                <span key={id} className={save.inventory[id] >= n ? '' : 'short'} title={ITEMS[id].name[lang]}>
                  {ITEMS[id].icon} {ITEMS[id].name[lang]} {save.inventory[id]}/{n}
                </span>
              ))}
            </div>
          </div>
          <button className="realm-button" disabled={!affordable} onClick={upgrade}>
            {tr('Îmbunătățește', 'Upgrade')}
          </button>
        </>
      ) : (
        <p>
          ★ {tr('Nivel maxim', 'Max level')} · {level}/{max}
        </p>
      )}
    </div>
  );
}
