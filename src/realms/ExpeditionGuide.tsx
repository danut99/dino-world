import { ENCOUNTERS, recipeFoodCost, RECIPES, type ItemId } from './content';
import { EXPEDITION_STAGES, expeditionPlan } from './expeditionRules';
import type { Command, Save } from './game';

export function tripTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}

export function ExpeditionGuide({ save, now, lang, destination, select, run, navigate, build, prepareSupplies }: {
  save: Save; now: number; lang: number; destination: string; select: (id: string) => void;
  run: (c: Command) => boolean; navigate: (to: 'dino' | 'farm' | 'workshop') => void;
  build: () => void; prepareSupplies: () => void;
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
  const checks = [
    { done: plan.previous, text: previous ? tr(`Termină ${previous.name[0]}`, `Finish ${previous.name[1]}`) : tr('Prima destinație este deschisă', 'First destination is open') },
    { done: plan.trained, text: tr(`Campion evoluat, nivel ${plan.level}+`, `Evolved champion, level ${plan.level}+`) },
    { done: plan.portal, text: destination === 'training' ? tr('Fără portal pentru introducere', 'No portal needed for the introduction') : tr('Portal de expediții construit', 'Expedition Portal built') },
    { done: plan.stocked, text: plan.supplies ? tr(`Provizii: ${save.inventory.provisions}/${plan.supplies} pachete`, `Supplies: ${save.inventory.provisions}/${plan.supplies} packs`) : tr('Fără provizii pentru introducere', 'No supplies needed for the introduction') },
    { done: plan.available, text: tr('Campion disponibil pentru plecare', 'Champion available to depart') },
  ];
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
  return (
    <section className="expedition-guide" aria-label={tr('Pașii expediției', 'Expedition steps')}>
      {trip && tripDestination && (
        <div className="expedition-travel" role="status">
          <strong>{tripDestination.name[lang]} · {tr('Pe drum', 'Travelling')}</strong>
          <p>{trip.stage === undefined ? tr('Călătorie începută anterior', 'Previously started trip') : EXPEDITION_STAGES[trip.stage][lang]}</p>
          <div className="realm-meter"><i style={{ width: `${Math.max(0, Math.min(100, (now - trip.startedAt) / (trip.endsAt - trip.startedAt) * 100))}%` }} /></div>
          {now < trip.endsAt ? <strong>{tr('Revine în', 'Returns in')} {tripTime(trip.endsAt - now)}</strong> : <button className="realm-button" onClick={() => run({ type: 'claimExpedition' })}>{tr('Colectează și continuă', 'Collect and continue')} ✓</button>}
          <small>{tr('Călătoria continuă offline. Recompensa te așteaptă până revii.', 'The trip continues offline. Your reward waits until you return.')}</small>
          <div className="expedition-preparation-links">
            <button className="realm-link" onClick={() => navigate('farm')}>{tr('Pregătește hrană', 'Prepare food')}</button>
            <button className="realm-link" onClick={prepareSupplies}>{tr('Pregătește provizii', 'Prepare supplies')}</button>
          </div>
        </div>
      )}
      <div className="gameplay-section-label">{tr('PLANUL EXPEDIȚIEI', 'EXPEDITION PLAN')}</div>
      <h3 className="expedition-guide-title">{plan.encounter.name[lang]}</h3>
      <strong>{plan.completed >= plan.total ? tr('Traseu finalizat', 'Route complete') : tr(`Etapa ${plan.stage + 1}/${plan.total}`, `Stage ${plan.stage + 1}/${plan.total}`)}</strong>
      <ol className="expedition-stages">
        {EXPEDITION_STAGES.slice(0, plan.total).map((label, i) => <li key={i} className={i < plan.completed ? 'done' : i === plan.stage ? 'current' : ''} aria-current={i === plan.stage && plan.completed < plan.total ? 'step' : undefined}>{i < plan.completed ? '✓' : i + 1} · {label[lang]}</li>)}
      </ol>
      <p>{tr('Durata etapei', 'Stage duration')}: <b>{tripTime(plan.duration)}</b> · {tr('Cost la plecare', 'Departure cost')}: <b>{plan.supplies} {plan.supplies === 1 ? tr('pachet', 'pack') : tr('pachete', 'packs')}</b></p>
      <ul className="expedition-checklist">
        {checks.map(check => <li key={check.text} className={check.done ? 'done' : 'missing'}><span aria-hidden>{check.done ? '✓' : '○'}</span>{check.text}</li>)}
      </ul>
      {plan.completed < plan.total && <small>{tr('Fiecare etapă oferă recompense. Ultima deschide destinația următoare și poate aduce un ou.', 'Every stage grants rewards. The final stage opens the next destination and may bring an egg.')}</small>}
      {!trip && action && <div className="expedition-next-step"><strong>{tr('Următorul pas', 'Next step')}</strong><p>{action.detail}</p><button className="realm-button secondary" onClick={action.click}>{action.label} →</button></div>}
      {!trip && plan.completed >= plan.total && next && <button className="realm-button" onClick={() => select(next.id)}>{tr('Următoarea destinație', 'Next destination')}: {next.name[lang]} →</button>}
      {!trip && <button className="realm-button adventure-start" disabled={!plan.canSend} onClick={() => run({ type: 'expedition', encounterId: destination })}>{plan.completed >= plan.total ? tr('Repetă traseul', 'Repeat route') : tr('Pornește etapa', 'Start stage')} · {tripTime(plan.duration)} →</button>}
    </section>
  );
}
