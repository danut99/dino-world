import { ITEMS, RECIPES, recipeFoodCost, type ItemId } from './content';
import { advance, gemsToFinish, WORKSHOP_LEVELS, workshop, type Command, type Save } from './game';
import { AnimatedWorkshopSprite } from './AnimatedWorkshopSprite';
import { WORKSHOP_STATES } from './workshopTiers';
import { UpgradeCard } from './UpgradeCard';
import { ResourceHelp, RequirementLink } from './ResourceHelp';
import './gameplay.css';

/** m:ss for crafting timers. */
export const time = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * The workshop: stock on top, every recipe as a card to craft from directly, the queue as a row of slots, and the
 * workshop's upgrade on the side. Opens as a window over the island.
 */
export function WorkshopPanel({ save, now, lang, run, build, recipeId, returnToExpeditions }: {
  save: Save;
  now: number;
  lang: number;
  run: (c: Command) => boolean;
  build: () => void;
  /** The recipe to highlight, e.g. supplies when coming from an expedition. */
  recipeId?: string;
  returnToExpeditions?: () => void;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const hasBuilding = save.buildings.some((b) => b.kind === 'workshop');
  const ready = advance(save, now);
  const activeJobs = save.crafting.filter((j) => j.endsAt > now).length;
  return (
    <div className="crafting-layout">
      <div className="craft-main">
        {returnToExpeditions && <button className="realm-button secondary realm-back-to-hatchery" onClick={returnToExpeditions}>← {tr('Înapoi la expediție', 'Back to expedition')}</button>}
        {!hasBuilding && (
          <div className="craft-unbuilt">
            <span>{tr('Încă nu ai atelier pe insulă.', 'You have no workshop on the island yet.')}</span>
            <button className="realm-button" onClick={build}>{tr('Construiește atelierul · 200 aur', 'Build the workshop · 200 gold')}</button>
          </div>
        )}
        {/* What you own, at a glance: every material as a small chip. */}
        <ul className="craft-stock" aria-label={tr('Resurse', 'Resources')}>
          <li className="food" title={tr('Hrană', 'Food')}><span>❧</span><b>{Math.floor(ready.food)}</b></li>
          {(Object.keys(ITEMS) as ItemId[]).map((id) => (
            <li key={id} className={ready.inventory[id] ? '' : 'empty'} title={ITEMS[id].name[lang]}>
              <span style={{ color: ITEMS[id].color }}>{ITEMS[id].icon}</span>
              <b>{ready.inventory[id]}</b>
              <small>{ITEMS[id].name[lang]}</small>
            </li>
          ))}
        </ul>

        {/* Every recipe at once: what it takes, what it makes, one click to start. */}
        <div className="gameplay-section-label">
          {tr('REȚETE', 'RECIPES')} <small>{tr('materialele vin din expediții și arenă', 'materials come from expeditions and the arena')}</small>
        </div>
        <div className="craft-recipes">
          {RECIPES.map((r) => {
            const food = recipeFoodCost(r);
            const costs = Object.entries(r.cost) as [ItemId, number][];
            const affordable = save.food >= food && costs.every(([id, n]) => save.inventory[id] >= n);
            const blocked = !hasBuilding || activeJobs >= workshop(save).slots;
            return (
              <article key={r.id} className={`craft-card${r.id === recipeId ? ' focus' : ''}${affordable ? ' ready' : ''}`}>
                <header>
                  <span className="craft-card-icon" style={{ color: ITEMS[r.output].color }}>{ITEMS[r.output].icon}</span>
                  <div>
                    <strong>{r.name[lang]}</strong>
                    <small>×{r.quantity} · {time(Math.round(r.seconds * 1000 * workshop(save).speed))}</small>
                  </div>
                </header>
                <ul className="craft-cost">
                  {food > 0 && <li className={save.food < food ? 'missing' : ''} title={tr('Hrană', 'Food')}><span className="food">❧</span> {food}</li>}
                  {costs.map(([id, n]) => (
                    <li key={id} className={save.inventory[id] < n ? 'missing' : ''} title={ITEMS[id].name[lang]}>
                      <span style={{ color: ITEMS[id].color }}>{ITEMS[id].icon}</span> {save.inventory[id]}/{n}
                    </li>
                  ))}
                </ul>
                <ResourceHelp save={save} lang={lang} food={food} materials={r.cost} />
                {!hasBuilding && <RequirementLink title={tr('Atelier necesar', 'Workshop required')} detail={tr('Construiește Atelierul pe insula principală.', 'Build the Workshop on the main island.')} action={build} />}
                {hasBuilding && activeJobs >= workshop(save).slots && <RequirementLink title={tr('Coada este plină', 'Queue is full')} detail={tr('Vezi lucrările în curs și colectează rezultatele gata.', 'Check active jobs and collect finished items.')} action={() => document.querySelector('.craft-queue')?.scrollIntoView({ block: 'center', behavior: 'smooth' })} />}
                <button className="realm-button" disabled={blocked || !affordable} onClick={() => run({ type: 'craft', recipeId: r.id })}>
                  ⚒ {tr('Fabrică', 'Craft')}
                </button>
              </article>
            );
          })}
        </div>

        {/* The queue as a row of slots: working, waiting, or free. */}
        <div className="craft-queue">
          <div className="gameplay-section-label">
            {tr('COADA ATELIERULUI', 'WORKSHOP QUEUE')}{' '}
            <small>
              {activeJobs} / {workshop(save).slots} · {workshop(save).lanes} {workshop(save).lanes === 1 ? tr('proces deodată', 'job at a time') : tr('procese deodată', 'jobs at once')}
            </small>
          </div>
          <div className="craft-slots">
            {save.crafting.map((job) => {
              const r = RECIPES.find((r) => r.id === job.recipeId)!;
              const finished = now >= job.endsAt,
                queued = now < job.startedAt;
              return (
                <div className={`craft-job${finished ? ' finished' : ''}`} key={job.id}>
                  <span>{ITEMS[r.output].icon}</span>
                  <div>
                    <strong>{r.name[lang]} ×{r.quantity}</strong>
                    <small>{finished ? tr('Gata!', 'Ready!') : queued ? tr('În așteptare', 'Queued') : time(job.endsAt - now)}</small>
                    <i><b style={{ width: `${Math.max(0, Math.min(100, ((now - job.startedAt) / (job.endsAt - job.startedAt)) * 100))}%` }} /></i>
                  </div>
                  {finished ? (
                    <button className="realm-button" onClick={() => run({ type: 'claimCraft', jobId: job.id })}>{tr('Colectează', 'Collect')}</button>
                  ) : queued ? (
                    <button className="realm-link" onClick={() => run({ type: 'cancelCraft', jobId: job.id })}>{tr('Anulează', 'Cancel')}</button>
                  ) : (
                    <button className="realm-gem-finish" disabled={save.gems < gemsToFinish(job.endsAt - now)} onClick={() => run({ type: 'gemFinish', target: 'craft', id: job.id })} title={tr('Termină acum cu diamante', 'Finish now with diamonds')}>
                      ⚡ {gemsToFinish(job.endsAt - now)} 💎
                    </button>
                  )}
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, workshop(save).slots - save.crafting.length) }, (_, i) => (
              <div className="craft-job free" key={`free-${i}`}>
                <small>{tr('Loc liber', 'Free slot')}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="craft-use">
        {/* The workshop itself: its level now, and what the next one brings. */}
        <div className="craft-level">
          <AnimatedWorkshopSprite art={WORKSHOP_STATES[Math.max(0, save.workshopLevel - 1)].art} />
          <div>
            <span className="realm-eyebrow">{tr('ATELIERUL', 'THE WORKSHOP')}</span>
            <strong>{tr('Nivel', 'Level')} {hasBuilding ? save.workshopLevel : 0} / {WORKSHOP_LEVELS.length}</strong>
            <small>
              {workshop(save).lanes} {tr('în lucru', 'working')} · {workshop(save).slots} {tr('în coadă', 'queued')}
              {workshop(save).speed < 1 && ` · −${Math.round((1 - workshop(save).speed) * 100)}% ${tr('timp', 'time')}`}
            </small>
          </div>
        </div>
        {hasBuilding && (
          <UpgradeCard
            save={save}
            lang={lang}
            level={save.workshopLevel}
            max={WORKSHOP_LEVELS.length}
            next={(() => {
              const now = workshop(save),
                next = WORKSHOP_LEVELS[save.workshopLevel];
              if (!next) return [];
              return [
                next.slots > now.slots && (
                  <>
                    ⚒ {now.slots} → <b>{next.slots}</b> {tr('locuri în coadă', 'queue slots')}
                  </>
                ),
                next.speed < now.speed && (
                  <>
                    ⏱ <b>{Math.round((1 - next.speed) * 100)}%</b> {tr('mai rapid', 'faster crafting')}
                  </>
                ),
                next.lanes > now.lanes && (
                  <>
                    ⚙ <b>{next.lanes}</b> {tr('procese deodată', 'jobs at once')}
                  </>
                ),
              ].filter(Boolean);
            })()}
            gold={WORKSHOP_LEVELS[save.workshopLevel]?.gold ?? 0}
            materials={WORKSHOP_LEVELS[save.workshopLevel]?.materials ?? {}}
            upgrade={() => run({ type: 'upgradeWorkshop' })}
          />
        )}
      </aside>
    </div>
  );
}
