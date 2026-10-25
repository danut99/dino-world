import { ITEMS, type ItemId } from './content';
import { buildTime, constructionLeft, gemsToFinish, LAMP_BONUS, MAX_LAMPS, nextUpgrade, targetName, type BuildTarget, type Command, type RealmId, type Save } from './game';
import { Icon, type IconName } from './ui/Icon';

export const itemIcon = (id: ItemId): IconName => (id === 'provisions' ? 'chest' : id);

/** A price as chips: gold, food and materials, each red while the player has too little. */
export function CostChips({ save, lang, gold = 0, food = 0, materials = {}, showHave = true }: {
  save: Save;
  lang: number;
  gold?: number;
  food?: number;
  materials?: Partial<Record<ItemId, number>>;
  /** Materials as "have/need" (default) or only the amount needed. */
  showHave?: boolean;
}) {
  const items = (Object.entries(materials) as [ItemId, number][]).filter(([, n]) => n > 0);
  return (
    <ul className="pk-costs">
      {gold > 0 && (
        <li className={`pk-cost${save.gold < gold ? ' short' : ''}`} title={lang ? 'Gold' : 'Aur'}>
          <Icon name="gold" scale={1} /> {gold.toLocaleString(lang ? 'en-US' : 'ro-RO')}
        </li>
      )}
      {food > 0 && (
        <li className={`pk-cost${save.food < food ? ' short' : ''}`} title={lang ? 'Food' : 'Hrană'}>
          <Icon name="food" scale={1} /> {food.toLocaleString(lang ? 'en-US' : 'ro-RO')}
        </li>
      )}
      {items.map(([id, n]) => (
        <li key={id} className={`pk-cost${save.inventory[id] < n ? ' short' : ''}`} title={ITEMS[id].name[lang]}>
          <Icon name={itemIcon(id)} scale={1} /> {showHave ? <><span className="pk-have">{save.inventory[id]}/</span>{n}</> : n}
        </li>
      ))}
    </ul>
  );
}

/** Whether the player can pay this price. */
export const affordable = (save: Save, gold = 0, materials: Partial<Record<ItemId, number>> = {}, food = 0) =>
  save.gold >= gold && save.food >= food && (Object.entries(materials) as [ItemId, number][]).every(([id, n]) => save.inventory[id] >= n);

/** Ornamental lamps: each one placed on the island adds LAMP_BONUS to habitat gold, up to MAX_LAMPS. */
export function LampCard({ save, lang, run, openWorkshop }: { save: Save; lang: number; run: (c: Command) => boolean; openWorkshop?: () => void }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const full = save.lamps >= MAX_LAMPS,
    have = save.inventory.lamp;
  return (
    <div className="pk-lamp">
      <span className="pk-lamp-icon">
        <Icon name="lamp" scale={2} />
      </span>
      <div className="pk-head-text">
        <strong>
          {tr('Lămpi', 'Lamps')} {save.lamps}/{MAX_LAMPS} · +{Math.round(save.lamps * LAMP_BONUS * 100)}% {tr('aur', 'gold')}
        </strong>
        <small>
          {full
            ? tr('Toate lămpile sunt aprinse.', 'Every lamp is lit.')
            : have > 0
              ? tr(`${have} în inventar · +${LAMP_BONUS * 100}% aur fiecare`, `${have} in your inventory · +${LAMP_BONUS * 100}% gold each`)
              : tr('Nicio lampă în inventar · se fac în Atelier', 'No lamps in your inventory · craft them in the Workshop')}
        </small>
      </div>
      {!full && have === 0 && openWorkshop ? (
        <button className="realm-button secondary sm" onClick={openWorkshop}>
          {tr('Atelier', 'Workshop')} →
        </button>
      ) : (
        <button className="realm-button sm" disabled={full || have < 1} onClick={() => run({ type: 'placeLamp' })}>
          {tr('Pune lampă', 'Place lamp')}
        </button>
      )}
    </div>
  );
}

/** The command that starts the next upgrade of a build target. */
export function upgradeCommand(target: BuildTarget): Command {
  if (target.startsWith('habitat:')) return { type: 'upgradeHabitat', realm: target.slice(8) as RealmId };
  const types = { farm: 'upgradeFarm', hatchery: 'upgradeHatchery', workshop: 'upgradeWorkshop', portal: 'upgradePortal', arena: 'upgradeArena' } as const;
  return { type: types[target as keyof typeof types] };
}
/** A countdown: "1h 05m", "4m 12s" or "38s". */
export function clock(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000)),
    h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    sec = t % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`;
}
/** Whether `target`'s next level is being built right now. */
export const underConstruction = (save: Save, now: number, target: BuildTarget) => constructionLeft(save, now)?.target === target;

/**
 * The upgrade of `target` being built: the level it is going to, a progress bar, the time left and "finish now"
 * with diamonds. Nothing when the builder is not working on this target.
 */
export function ConstructionStrip({ save, now, lang, run, target }: { save: Save; now: number; lang: number; run: (c: Command) => boolean; target: BuildTarget }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const b = constructionLeft(save, now);
  if (!b || b.target !== target) return null;
  const total = Math.max(1, b.endsAt - b.startedAt),
    cost = gemsToFinish(b.left);
  return (
    <div className="pk-construction" role="status">
      <span className="pk-construction-icon" aria-hidden="true">
        <Icon name="build" scale={2} />
      </span>
      <div className="pk-construction-body">
        <strong>
          {tr('În construcție', 'Being built')} · <span className="pk-num">{tr('Nivel', 'Level')} {b.level}</span>
        </strong>
        <div className="pk-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((1 - b.left / total) * 100)}>
          <i style={{ width: `${Math.min(100, (1 - b.left / total) * 100)}%` }} />
        </div>
      </div>
      <span className="pk-construction-time pk-num">⏱ {clock(b.left)}</span>
      <button className="realm-button" disabled={save.gems < cost} onClick={() => run({ type: 'gemFinish', target: 'construction' })}>
        {tr('Termină acum', 'Finish now')} ({cost} 💎)
      </button>
    </div>
  );
}

/**
 * The upgrade button with its build time. While the single builder works on another building the button waits,
 * and says on what and for how long.
 */
export function UpgradeButton({ save, now, lang, run, target, label }: { save: Save; now: number; lang: number; run: (c: Command) => boolean; target: BuildTarget; label?: string }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const step = nextUpgrade(save, target);
  if (!step) return null;
  const busy = constructionLeft(save, now),
    busyText = busy ? `${tr('Constructorul lucrează la', 'The builder is working on')} ${targetName(busy.target, lang)} (${clock(busy.left)})` : '';
  return (
    <span className="pk-upgrade-go">
      {busy ? (
        <small className="pk-build-time busy" title={busyText}>
          <Icon name="build" scale={1} /> {tr('ocupat', 'busy')} · {clock(busy.left)}
        </small>
      ) : (
        <small className="pk-build-time" title={tr('Timp de construcție', 'Build time')}>
          ⏱ {buildTime(step.minutes)}
        </small>
      )}
      <button
        className="realm-button"
        disabled={!!busy || !affordable(save, step.gold, step.materials)}
        title={busyText || undefined}
        onClick={() => run(upgradeCommand(target))}
      >
        {label ?? tr('Îmbunătățește', 'Upgrade')}
      </button>
    </span>
  );
}
