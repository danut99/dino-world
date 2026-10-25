import type { ReactNode } from 'react';
import type { ItemId } from './content';
import type { BuildTarget, Command, Save } from './game';
import { ResourceHelp } from './ResourceHelp';
import { ConstructionStrip, CostChips, UpgradeButton, underConstruction } from './PanelKit';

/**
 * "Next level" card shared by the workshop and the arena gate: what the level adds, its price, its build time and
 * the button; while the level is being built, its progress and "finish now" instead.
 */
export function UpgradeCard({
  save,
  now,
  lang,
  run,
  target,
  level,
  max,
  next,
  gold,
  materials,
}: {
  save: Save;
  now: number;
  lang: number;
  run: (c: Command) => boolean;
  target: BuildTarget;
  level: number;
  max: number;
  next: ReactNode[];
  gold: number;
  materials: Partial<Record<ItemId, number>>;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const building = underConstruction(save, now, target);
  return (
    <div className="pk-box pk-upgrade-card">
      {level < max ? (
        <>
          <h3 className="pk-title">
            {tr('Îmbunătățire', 'Upgrade')} <small className="pk-num">{tr('Nivel', 'Level')} {level} → {level + 1}</small>
          </h3>
          <ul>
            {next.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          {building ? (
            <ConstructionStrip save={save} now={now} lang={lang} run={run} target={target} />
          ) : (
            <>
              <CostChips save={save} lang={lang} gold={gold} materials={materials} />
              <div className="pk-upgrade-card-actions">
                <ResourceHelp save={save} lang={lang} gold={gold} materials={materials} />
                <UpgradeButton save={save} now={now} lang={lang} run={run} target={target} />
              </div>
            </>
          )}
        </>
      ) : (
        <p className="pk-note">
          ★ {tr('Nivel maxim', 'Max level')} · {level}/{max}
        </p>
      )}
    </div>
  );
}
