import type { ReactNode } from 'react';
import { ENCOUNTERS, recipeFoodCost, RECIPES, type ItemId } from './content';
import { EXPEDITION_STAGES, expeditionPlan } from './expeditionRules';
import { gemsToFinish, type Command, type Save } from './game';
import { DinosaurArt } from './DinosaurArt';
import { Icon } from './ui/Icon';

export function tripTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}

/**
 * The selected destination as one compact card that fits without scrolling: the stage and its cost, the rewards,
 * whether the champion is ready (only what is missing is listed, with the way to fix it), then the departure button.
 */
export function ExpeditionGuide({ save, now, lang, destination, select, run, navigate, build, prepareSupplies, rewards }: {
  save: Save; now: number; lang: number; destination: string; select: (id: string) => void;
  run: (c: Command) => boolean; navigate: (to: 'dino' | 'farm' | 'workshop') => void;
  build: () => void; prepareSupplies: () => void;
  /** The reward tiles for this stage, drawn by the gameplay screen. */
  rewards?: ReactNode;
}) {
  const tr = (ro: string, en: string) => lang ? en : ro;
  const plan = expeditionPlan(save, destination);
  const chain = ENCOUNTERS.filter(e => e.mode === 'expedition');
  const next = chain[chain.findIndex(e => e.id === destination) + 1];
  const previous = chain.find(e => e.id === plan.encounter.requires);
  const workshop = save.buildings.some(b => b.kind === 'workshop');
  const recipe = RECIPES.find(r => r.id === 'provisions')!;
  const materials = (Object.entries(recipe.cost) as [ItemId, number][]).every(([id, n]) => save.inventory[id] >= n);
  const jobs = save.crafting.filter(j => j.recipeId === 'provisions');
  const ready = jobs.some(j => j.endsAt <= now);
  const missing = [
    { done: plan.previous, text: previous ? tr(`Termină mai întâi ${previous.name[0]}`, `Finish ${previous.name[1]} first`) : '' },
    { done: plan.trained, text: tr(`Campionul trebuie să fie juvenil, nivel ${plan.level}+`, `Champion must be a juvenile, level ${plan.level}+`) },
    { done: plan.portal, text: tr('Construiește Portalul de expediții', 'Build the Expedition Portal') },
    { done: plan.stocked, text: tr(`Provizii: ${save.inventory.provisions}/${plan.supplies} pachete`, `Supplies: ${save.inventory.provisions}/${plan.supplies} packs`) },
    { done: plan.available, text: tr('Campionul e ocupat acum', 'The champion is busy right now') },
  ].filter(c => !c.done);
  let action: { label: string; detail: string; click: () => void } | null = null;
  if (!plan.previous && previous) action = { label: tr('Vezi destinația precedentă', 'View previous destination'), detail: tr('Finalizează toate etapele de acolo pentru a deschide acest traseu.', 'Finish its stages to open this route.'), click: () => select(previous.id) };
  else if (!plan.trained) action = { label: tr('Pregătește dinozaurul', 'Prepare your dinosaur'), detail: tr('Hrănește campionul. La nivelul 9, evoluează-l la juvenil; apoi atinge nivelul cerut.', 'Feed your champion. At level 9 evolve it to juvenile, then reach the required level.'), click: () => navigate('dino') };
  else if (!plan.portal) action = { label: tr('Construiește portalul', 'Build the portal'), detail: tr('Deschide Construcții și alege Portal de expediții.', 'Open Construction and choose Expedition Portal.'), click: build };
  else if (!plan.stocked) {
    if (!workshop) action = { label: tr('Construiește atelierul', 'Build the workshop'), detail: tr('Proviziile se fabrică în Atelier: 50 hrană, 2 lemn și 1 fibră per pachet.', 'Craft supplies in the Workshop: 50 food, 2 wood and 1 fiber per pack.'), click: build };
    else if (ready || jobs.length) action = { label: ready ? tr('Colectează proviziile', 'Collect supplies') : tr('Vezi proviziile în lucru', 'View supplies in progress'), detail: ready ? tr('Pachetele sunt gata în coada Atelierului.', 'Supply packs are ready in the Workshop queue.') : tr('Așteaptă finalizarea pachetelor și colectează-le din Atelier.', 'Wait for the packs to finish, then collect them in the Workshop.'), click: prepareSupplies };
    else if (save.food < recipeFoodCost(recipe)) action = { label: tr('Cultivă hrană la fermă', 'Grow food at the farm'), detail: tr('Ai nevoie de 50 hrană pentru fiecare pachet de provizii.', 'Each supply pack needs 50 food.'), click: () => navigate('farm') };
    else if (!materials) action = { label: tr('Strânge materiale din canion', 'Gather materials in the canyon'), detail: tr('Repetă prima expediție, fără provizii, pentru lemn și fibre.', 'Repeat the first expedition, without supplies, for wood and fiber.'), click: () => select('training') };
    else action = { label: tr('Fabrică provizii în Atelier', 'Craft supplies in the Workshop'), detail: tr('Un pachet: 50 hrană + 2 lemn + 1 fibră. Colectează-l după fabricare.', 'One pack: 50 food + 2 wood + 1 fiber. Collect it after crafting.'), click: prepareSupplies };
  } else if (!plan.available && !save.expedition) action = { label: tr('Alege un campion disponibil', 'Choose an available champion'), detail: tr('Campionul selectat este ocupat într-o luptă.', 'The selected champion is in a battle.'), click: () => navigate('dino') };

  const trip = save.expedition;
  const tripDestination = trip && chain.find(e => e.id === trip.encounterId);
  const done = plan.completed >= plan.total;
  const hero = plan.hero;
  return (
    <section className="expedition-guide" aria-label={tr('Pașii expediției', 'Expedition steps')}>
      {trip && tripDestination && (
        <div className="expedition-travel" role="status">
          <strong>{tripDestination.name[lang]} · {tr('Pe drum', 'Travelling')}</strong>
          <p>{trip.stage === undefined ? tr('Călătorie începută anterior', 'Previously started trip') : EXPEDITION_STAGES[trip.stage][lang]}</p>
          <div className="realm-meter"><i style={{ width: `${Math.max(0, Math.min(100, (now - trip.startedAt) / (trip.endsAt - trip.startedAt) * 100))}%` }} /></div>
          {now < trip.endsAt ? <>
            <strong>{tr('Revine în', 'Returns in')} {tripTime(trip.endsAt - now)}</strong>
            <button className="realm-gem-finish" disabled={save.gems < gemsToFinish(trip.endsAt - now)} onClick={() => run({ type: 'gemFinish', target: 'expedition' })} title={tr('Adu-l înapoi acum cu diamante', 'Bring it back now with diamonds')}>
              ⚡ {tr('Înapoi acum', 'Back now')} · {gemsToFinish(trip.endsAt - now)} 💎
            </button>
          </> : <button className="realm-button" onClick={() => run({ type: 'claimExpedition' })}>{tr('Colectează și continuă', 'Collect and continue')} ✓</button>}
          <small>{tr('Călătoria continuă offline.', 'The trip continues offline.')}</small>
        </div>
      )}

      <div className="expedition-stage-row">
        <strong>{done ? tr('Traseu finalizat ✓', 'Route complete ✓') : tr(`Etapa ${plan.stage + 1} din ${plan.total}`, `Stage ${plan.stage + 1} of ${plan.total}`)}</strong>
        <ol className="expedition-pips" aria-label={tr('Etape', 'Stages')}>
          {EXPEDITION_STAGES.slice(0, plan.total).map((label, i) => (
            <li key={i} title={label[lang]} className={i < plan.completed ? 'done' : i === plan.stage && !done ? 'current' : ''} />
          ))}
        </ol>
      </div>
      <ul className="expedition-facts">
        <li><Icon name="clock" scale={1} /> {tripTime(plan.duration)}</li>
        <li><Icon name="chest" scale={1} /> {plan.supplies ? `${plan.supplies} ${plan.supplies === 1 ? tr('pachet provizii', 'supply pack') : tr('pachete provizii', 'supply packs')}` : tr('fără provizii', 'no supplies')}</li>
        {!done && plan.stage === plan.total - 1 && next && <li><Icon name="arrow" scale={1} /> {tr('deschide', 'opens')} {next.name[lang]}</li>}
      </ul>

      {rewards}

      {hero && (
        <div className={`expedition-hero ${plan.trained ? 'ok' : 'low'}`}>
          <span className="expedition-hero-art"><DinosaurArt species={hero.species} element={hero.element} stage={hero.stage} paused frame={0} /></span>
          <span>
            <strong>{hero.nickname}</strong>
            <small>{tr('Nivel', 'Level')} {hero.level} · {tr('cerut', 'needed')} {plan.level}+</small>
          </span>
          <b aria-hidden>{plan.trained ? '✓' : '!'}</b>
        </div>
      )}

      {!trip && (missing.length === 0
        ? <p className="expedition-ready">✓ {tr('Gata de plecare', 'Ready to go')}</p>
        : <div className="expedition-missing">
            <ul>{missing.map(m => <li key={m.text}>○ {m.text}</li>)}</ul>
            {action && <>
              <p>{action.detail}</p>
              <button className="realm-button secondary" onClick={action.click}>{action.label} →</button>
            </>}
          </div>)}

      {!trip && done && next && <button className="realm-button secondary" onClick={() => select(next.id)}>{tr('Următoarea destinație', 'Next destination')}: {next.name[lang]} →</button>}
      {!trip && <button className="realm-button adventure-start" disabled={!plan.canSend} onClick={() => run({ type: 'expedition', encounterId: destination })}>{done ? tr('Repetă traseul', 'Repeat route') : tr('Pornește etapa', 'Start stage')} · {tripTime(plan.duration)} →</button>}
    </section>
  );
}
