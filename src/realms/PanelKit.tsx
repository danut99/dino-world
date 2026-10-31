import { ITEMS, type ItemId } from './content';
import {
  buildTime,
  constructionLeft,
  DECOR,
  decorCount,
  gemsToFinish,
  nextUpgrade,
  targetName,
  type BuildTarget,
  type Command,
  type DecorKind,
  type RealmId,
  type Save,
} from './game';
import { Icon, type IconName } from './ui/Icon';

export const itemIcon = (id: ItemId): IconName => (id === 'provisions' ? 'chest' : id);

/** A price as chips: gold, food and materials, each red while the player has too little. */
export function CostChips({
  save,
  lang,
  gold = 0,
  food = 0,
  materials = {},
  showHave = true,
}: {
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
          <Icon name={itemIcon(id)} scale={1} />{' '}
          {showHave ? (
            <>
              <span className="pk-have">{save.inventory[id]}/</span>
              {n}
            </>
          ) : (
            n
          )}
        </li>
      ))}
    </ul>
  );
}

/** Whether the player can pay this price. */
export const affordable = (save: Save, gold = 0, materials: Partial<Record<ItemId, number>> = {}, food = 0) =>
  save.gold >= gold &&
  save.food >= food &&
  (Object.entries(materials) as [ItemId, number][]).every(([id, n]) => save.inventory[id] >= n);

const DECOR_TEXT: Record<
  DecorKind,
  { plural: [string, string]; effect: (pct: number) => [string, string]; short: (pct: number) => [string, string] }
> = {
  lamp: {
    plural: ['Lămpi', 'Lamps'],
    effect: (p) => [`+${p}% aur`, `+${p}% gold`],
    short: (p) => [`+${p}% aur`, `+${p}% gold`],
  },
  scarecrow: {
    plural: ['Sperietori', 'Scarecrows'],
    effect: (p) => [`+${p}% recoltă`, `+${p}% harvest`],
    short: (p) => [`+${p}% hrană`, `+${p}% food`],
  },
  signpost: {
    plural: ['Indicatoare', 'Signposts'],
    effect: (p) => [`−${p}% timp de drum`, `−${p}% trip time`],
    short: (p) => [`−${p}% drum`, `−${p}% trips`],
  },
};

/** A decoration kind: how many stand on the island, what they give, and a button to place the next one. */
export function DecorCard({
  kind,
  save,
  lang,
  run,
  openWorkshop,
  place,
}: {
  kind: DecorKind;
  save: Save;
  lang: number;
  run: (c: Command) => boolean;
  openWorkshop?: () => void;
  place?: (kind: DecorKind) => void;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const { bonus, max } = DECOR[kind],
    text = DECOR_TEXT[kind],
    placed = decorCount(save, kind),
    full = placed >= max,
    have = save.inventory[kind],
    each = text.effect(Math.round(bonus * 100))[lang];
  return (
    <div className="pk-lamp" title={`${text.plural[lang]}: ${each}`}>
      <span className="pk-lamp-icon">
        <Icon name={kind} scale={2} />
      </span>
      <div className="pk-head-text">
        <strong>
          <span className="decor-name">{text.plural[lang]} </span>
          {placed}/{max}
          <span className="decor-effect"> · {text.effect(Math.round(placed * bonus * 100))[lang]}</span>
        </strong>
        <small className="decor-short">
          {text.short(Math.round(bonus * 100))[lang]} {tr('fiecare', 'each')}
        </small>
        <small>
          {full
            ? tr('Toate sunt pe insulă.', 'All of them are on the island.')
            : have > 0
              ? tr(`${have} în inventar · ${each} fiecare`, `${have} in your inventory · ${each} each`)
              : tr(`Niciuna în inventar · ${each} fiecare`, `None in your inventory · ${each} each`)}
        </small>
      </div>
      {!full && have === 0 && openWorkshop ? (
        <button
          className="realm-button secondary sm"
          onClick={openWorkshop}
          aria-label={tr('Fă-le în Atelier', 'Craft them in the Workshop')}
        >
          ⚒ <span className="decor-btn-text">{tr('Atelier', 'Workshop')}</span>
        </button>
      ) : (
        <button
          className="realm-button sm"
          disabled={full || have < 1}
          onClick={() => (place ? place(kind) : run({ type: 'placeDecor', kind }))}
        >
          {tr('Pune', 'Place')}
        </button>
      )}
    </div>
  );
}

/** The command that starts the next upgrade of a build target. */
export function upgradeCommand(target: BuildTarget): Command {
  if (target.startsWith('habitat:')) return { type: 'upgradeHabitat', realm: target.slice(8) as RealmId };
  const types = {
    farm: 'upgradeFarm',
    hatchery: 'upgradeHatchery',
    workshop: 'upgradeWorkshop',
    portal: 'upgradePortal',
    arena: 'upgradeArena',
  } as const;
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
export const underConstruction = (save: Save, now: number, target: BuildTarget) =>
  constructionLeft(save, now)?.target === target;

/**
 * The upgrade of `target` being built: the level it is going to, a progress bar, the time left and "finish now"
 * with diamonds. Nothing when the builder is not working on this target.
 */
export function ConstructionStrip({
  save,
  now,
  lang,
  run,
  target,
}: {
  save: Save;
  now: number;
  lang: number;
  run: (c: Command) => boolean;
  target: BuildTarget;
}) {
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
          {tr('În construcție', 'Being built')} ·{' '}
          <span className="pk-num">
            {tr('Nivel', 'Level')} {b.level}
          </span>
        </strong>
        <div
          className="pk-meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((1 - b.left / total) * 100)}
        >
          <i style={{ width: `${Math.min(100, (1 - b.left / total) * 100)}%` }} />
        </div>
      </div>
      <span className="pk-construction-time pk-num">⏱ {clock(b.left)}</span>
      <button
        className="realm-button"
        disabled={save.gems < cost}
        onClick={() => run({ type: 'gemFinish', target: 'construction' })}
      >
        {tr('Termină acum', 'Finish now')} ({cost} 💎)
      </button>
    </div>
  );
}

/**
 * The upgrade button with its build time. While the single builder works on another building the button waits,
 * and says on what and for how long.
 */
export function UpgradeButton({
  save,
  now,
  lang,
  run,
  target,
  label,
}: {
  save: Save;
  now: number;
  lang: number;
  run: (c: Command) => boolean;
  target: BuildTarget;
  label?: string;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const step = nextUpgrade(save, target);
  if (!step) return null;
  const busy = constructionLeft(save, now),
    busyText = busy
      ? `${tr('Constructorul lucrează la', 'The builder is working on')} ${targetName(busy.target, lang)} (${clock(busy.left)})`
      : '';
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
