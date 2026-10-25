import { useEffect, useState, type ReactNode } from 'react';
import { ITEMS, RECIPES, recipeFoodCost, type ItemId } from './content';
import { advance, gemsToFinish, WORKSHOP_LEVELS, workshop, type CraftJob, type Command, type Save } from './game';
import { AnimatedWorkshopSprite } from './AnimatedWorkshopSprite';
import { WORKSHOP_STATES } from './workshopTiers';
import { UpgradeCard } from './UpgradeCard';
import { ResourceHelp } from './ResourceHelp';
import { CostChips, itemIcon } from './PanelKit';
import { Tabs, TabPanel } from './ui/Tabs';
import { Pager } from './ui/Pager';
import { usePager } from './ui/usePager';
import { CompactCard } from './ui/CompactCard';
import { Icon } from './ui/Icon';
import './workshop.css';

/** m:ss for crafting timers. */
export const time = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

type QueueItem = { kind: 'done' | 'running' | 'queued'; job: CraftJob } | { kind: 'free'; id: string };

/**
 * The workshop: stock on top, then three tabs — the six recipes (3×2), the queue (only running and waiting jobs
 * take a slot; finished ones wait to be collected), and the next level.
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
  const level = workshop(save);
  const done = save.crafting.filter((j) => j.endsAt <= now);
  const active = save.crafting.filter((j) => j.endsAt > now);
  const free = Math.max(0, level.slots - active.length);
  const full = active.length >= level.slots;
  const [tab, setTab] = useState<'recipes' | 'queue' | 'upgrade'>(() => (done.length ? 'queue' : 'recipes'));
  const queue: QueueItem[] = [
    ...done.map((job) => ({ kind: 'done' as const, job })),
    ...active.map((job) => ({ kind: now < job.startedAt ? ('queued' as const) : ('running' as const), job })),
    ...Array.from({ length: free }, (_, i) => ({ kind: 'free' as const, id: `free-${i}` })),
  ];
  const pager = usePager(queue, { itemSelector: '.ui-card' });
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px) and (orientation: portrait)');
    const update = () => setPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const recipes = usePager(RECIPES, { itemSelector: '.craft-recipe', max: 6 });
  useEffect(() => {
    const index = RECIPES.findIndex((r) => r.id === recipeId);
    if (phone && index >= 0) recipes.setPage(Math.floor(index / recipes.perPage));
  }, [phone, recipeId, recipes.perPage, recipes.setPage]);
  const idBase = 'workshop';

  if (!hasBuilding)
    return (
      <div className="fit-panel fit-single">
        <div className="pk-empty workshop-empty">
          <AnimatedWorkshopSprite art={WORKSHOP_STATES[0].art} />
          <h3>{tr('Încă nu ai atelier pe insulă', 'You have no workshop on the island yet')}</h3>
          <p className="pk-note">{tr('Atelierul face plăci, blocuri, kituri de habitat, cristale de evoluție, lămpi și provizii.', 'The workshop makes planks, blocks, habitat kits, evolution crystals, lamps and supplies.')}</p>
          <button className="realm-button" onClick={build}>
            {tr('Construiește atelierul', 'Build the workshop')}
          </button>
        </div>
      </div>
    );

  const next = WORKSHOP_LEVELS[save.workshopLevel];
  const upgradeLines: ReactNode[] = next
    ? [
        next.slots > level.slots && (
          <>
            ⚒ {level.slots} → <b>{next.slots}</b> {tr('locuri în coadă', 'queue slots')}
          </>
        ),
        next.lanes > level.lanes && (
          <>
            ⚙ {level.lanes} → <b>{next.lanes}</b> {tr('procese deodată', 'jobs at once')}
          </>
        ),
        next.speed < level.speed && (
          <>
            ⏱ <b>−{Math.round((1 - next.speed) * 100)}%</b> {tr('timp de lucru', 'crafting time')}
          </>
        ),
      ].filter(Boolean)
    : [];

  const queueCard = (item: QueueItem) => {
    if (item.kind === 'free')
      return <CompactCard key={item.id} className="craft-free" title={tr('Loc liber', 'Free slot')} subtitle={tr('Alege o rețetă', 'Pick a recipe')} onClick={() => setTab('recipes')} tone="locked" />;
    const { job } = item;
    const r = RECIPES.find((x) => x.id === job.recipeId)!;
    const art = <span className="craft-icon" style={{ color: ITEMS[r.output].color }}><Icon name={itemIcon(r.output)} scale={2} /></span>;
    if (item.kind === 'done')
      return (
        <CompactCard
          key={job.id}
          art={art}
          tone="good"
          title={`${r.name[lang]} ×${r.quantity}`}
          subtitle={tr('Gata!', 'Ready!')}
          action={
            <button className="realm-button" onClick={() => run({ type: 'claimCraft', jobId: job.id })}>
              {tr('Colectează', 'Collect')}
            </button>
          }
        />
      );
    if (item.kind === 'queued')
      return (
        <CompactCard
          key={job.id}
          art={art}
          title={`${r.name[lang]} ×${r.quantity}`}
          subtitle={`${tr('În așteptare', 'Queued')} · ${time(job.endsAt - job.startedAt)}`}
          action={
            <button className="realm-button secondary" onClick={() => run({ type: 'cancelCraft', jobId: job.id })}>
              {tr('Anulează', 'Cancel')}
            </button>
          }
        />
      );
    const progress = Math.max(0, Math.min(100, ((now - job.startedAt) / (job.endsAt - job.startedAt)) * 100));
    return (
      <CompactCard
        key={job.id}
        art={art}
        tone="warn"
        title={`${r.name[lang]} ×${r.quantity}`}
        subtitle={
          <span className="craft-progress">
            <span className="pk-num">⏱ {time(job.endsAt - now)}</span>
            <span className="pk-meter">
              <i style={{ width: `${progress}%` }} />
            </span>
          </span>
        }
        action={
          <button className="realm-gem-finish" disabled={save.gems < gemsToFinish(job.endsAt - now)} onClick={() => run({ type: 'gemFinish', target: 'craft', id: job.id })} title={tr('Termină acum cu diamante', 'Finish now with diamonds')}>
            ⚡ {gemsToFinish(job.endsAt - now)} 💎
          </button>
        }
      />
    );
  };

  return (
    <div className="fit-panel workshop-panel">
      <header className="pk-head">
        <span className="pk-level">
          <small>{tr('NIVEL', 'LEVEL')}</small>
          {save.workshopLevel}
        </span>
        <div className="pk-head-text">
          <strong>
            {active.length}/{level.slots} {tr('în coadă', 'in the queue')} · {level.lanes} {level.lanes === 1 ? tr('proces deodată', 'job at a time') : tr('procese deodată', 'jobs at once')}
            {level.speed < 1 && ` · −${Math.round((1 - level.speed) * 100)}% ${tr('timp', 'time')}`}
          </strong>
          <ul className="pk-costs workshop-stock" aria-label={tr('Resurse', 'Resources')}>
            <li className="pk-cost" title={tr('Hrană', 'Food')}>
              <Icon name="food" scale={1} /> {Math.floor(ready.food)}
            </li>
            {(Object.keys(ITEMS) as ItemId[]).map((id) => (
              <li key={id} className={`pk-cost${ready.inventory[id] ? '' : ' empty'}`} title={ITEMS[id].name[lang]}>
                <Icon name={itemIcon(id)} scale={1} /> {ready.inventory[id]}
              </li>
            ))}
          </ul>
        </div>
        {returnToExpeditions && (
          <div className="pk-head-actions">
            <button className="realm-button secondary" onClick={returnToExpeditions}>
              ← {tr('Expediție', 'Expedition')}
            </button>
          </div>
        )}
      </header>
      <Tabs
        idBase={idBase}
        label={tr('Secțiuni atelier', 'Workshop sections')}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'recipes', label: tr('Rețete', 'Recipes') },
          { id: 'queue', label: `${tr('Coadă', 'Queue')} ${active.length}/${level.slots}`, badge: done.length },
          { id: 'upgrade', label: next ? `${tr('Nivel', 'Level')} ${save.workshopLevel + 1}` : tr('Nivel maxim', 'Max level') },
        ]}
      />
      {tab === 'recipes' && (
        <TabPanel idBase={idBase} id="recipes" className="fit-fill craft-recipes-tab">
          <div className="craft-grid" ref={phone ? recipes.ref : undefined}>
            {(phone ? recipes.pageItems : RECIPES).map((r) => {
              const food = recipeFoodCost(r);
              const costs = Object.entries(r.cost) as [ItemId, number][];
              const canPay = save.food >= food && costs.every(([id, n]) => save.inventory[id] >= n);
              return (
                <article key={r.id} className={`craft-recipe${r.id === recipeId ? ' focus' : ''}${canPay ? ' ready' : ''}`}>
                  <header>
                    <span className="craft-icon" style={{ color: ITEMS[r.output].color }}>
                      <Icon name={itemIcon(r.output)} scale={2} />
                    </span>
                    <div>
                      <strong>{r.name[lang]}</strong>
                      <small className="pk-num">
                        ×{r.quantity} · ⏱ {time(Math.round(r.seconds * 1000 * level.speed))} · {tr('ai', 'have')} {save.inventory[r.output]}
                      </small>
                    </div>
                  </header>
                  <CostChips save={save} lang={lang} food={food} materials={r.cost} />
                  <footer>
                    <span className="craft-spacer" />
                    <ResourceHelp save={save} lang={lang} food={food} materials={r.cost} />
                    <button className="realm-button" disabled={full || !canPay} title={full ? tr('Coada e plină.', 'The queue is full.') : undefined} onClick={() => run({ type: 'craft', recipeId: r.id })}>
                      ⚒ {tr('Fabrică', 'Craft')}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
          {phone && <div className="pk-foot"><Pager page={recipes.page} pages={recipes.pages} onPrev={recipes.prev} onNext={recipes.next} lang={lang} /></div>}
          {full && (
            <p className="pk-note warn">
              {tr('Coada e plină: așteaptă să se termine o lucrare sau îmbunătățește atelierul.', 'The queue is full: wait for a job to finish or upgrade the workshop.')}
            </p>
          )}
        </TabPanel>
      )}
      {tab === 'queue' && (
        <TabPanel idBase={idBase} id="queue" className="fit-fill pk-paged-tab">
          <div ref={pager.ref} className="ui-paged craft-queue-list">
            {pager.pageItems.map(queueCard)}
          </div>
          <div className="pk-foot">
            <p className="pk-note">
              {tr(`${free} ${free === 1 ? 'loc liber' : 'locuri libere'} din ${level.slots}`, `${free} of ${level.slots} slots free`)}
              {done.length > 0 && ` · ${done.length} ${tr('gata de colectat', 'ready to collect')}`}
            </p>
            <Pager page={pager.page} pages={pager.pages} onPrev={pager.prev} onNext={pager.next} lang={lang} />
          </div>
        </TabPanel>
      )}
      {tab === 'upgrade' && (
        <TabPanel idBase={idBase} id="upgrade" className="fit-fill craft-upgrade-tab">
          <div className="craft-building">
            <AnimatedWorkshopSprite art={WORKSHOP_STATES[Math.max(0, save.workshopLevel - 1)].art} />
          </div>
          <UpgradeCard
            save={save}
            now={now}
            lang={lang}
            run={run}
            target="workshop"
            level={save.workshopLevel}
            max={WORKSHOP_LEVELS.length}
            next={upgradeLines}
            gold={next?.gold ?? 0}
            materials={next?.materials ?? {}}
          />
        </TabPanel>
      )}
    </div>
  );
}
