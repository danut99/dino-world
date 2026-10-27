import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ITEMS, recipeFoodCost, RECIPES, REGIONS, REGION_STAGES, type ItemId } from './content';
import {
  expeditionPlan,
  memberIssue,
  PATROL,
  PATROL_HOURS,
  patrolPlan,
  regionById,
  suggestTeam,
  type ExpeditionPlan,
  type ExpeditionReward,
  type MemberIssue,
  type PatrolHours,
  type PatrolPlan,
} from './expeditionRules';
import {
  busyDinos,
  ELEMENTS,
  gemsToFinish,
  PORTAL_LEVELS,
  portalSlots,
  REALM_NAMES,
  type Command,
  type Dino,
  type ExpeditionRun,
  type Save,
} from './game';
import { DinosaurArt } from './DinosaurArt';
import { TeamPicker } from './TeamPicker';
import { Tabs, TabPanel } from './ui/Tabs';
import { CompactCard } from './ui/CompactCard';
import { Icon, elementIcon } from './ui/Icon';
import { ConstructionStrip, CostChips, UpgradeButton, underConstruction } from './PanelKit';

export function tripTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
}

type Tab = 'stage' | 'patrol' | 'active';
type Props = {
  save: Save;
  now: number;
  lang: number;
  /** The selected region. */
  destination: string;
  select: (id: string) => void;
  run: (c: Command) => boolean;
  navigate: (to: 'dino' | 'farm' | 'workshop') => void;
  build: () => void;
  prepareSupplies: () => void;
};

/** Gold, food, materials, tickets, and the finale's egg and diamonds, as one row of tiles. */
function RewardTiles({
  reward,
  lang,
  region,
  egg,
  extra,
}: {
  reward: ExpeditionReward;
  lang: number;
  region: string;
  egg?: ReactNode;
  extra?: ReactNode;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const element = ELEMENTS.find((e) => e.id === regionById(region)?.element)!;
  return (
    <section className="expedition-loot" aria-label={tr('Recompense', 'Rewards')}>
      <h3 className="expedition-section-title">{tr('Recompense', 'Rewards')}</h3>
      <div className="gameplay-rewards expedition-rewards">
        <span>
          <Icon name="gold" scale={1} />
          {reward.gold}
          <small>{tr('Aur', 'Gold')}</small>
        </span>
        <span>
          <Icon name="food" scale={1} />
          {reward.food}
          <small>{tr('Hrană', 'Food')}</small>
        </span>
        {(Object.entries(reward.materials) as [ItemId, number][]).map(([id, n]) => (
          <span key={id}>
            <Icon name={id as 'wood'} scale={1} />
            {n}
            <small>{ITEMS[id].name[lang]}</small>
          </span>
        ))}
        {!!reward.tickets && (
          <span title={tr(`Bilete de arenă: ${element.name[0]}`, `Arena tickets: ${element.name[1]}`)}>
            <Icon name={elementIcon(element.id)} scale={1} />
            {reward.tickets}
            <small>{tr('Bilete', 'Tickets')}</small>
          </span>
        )}
        {!!reward.gems && (
          <span>
            <b className="expedition-gem">💎</b>
            {reward.gems}
            <small>{tr('Diamante', 'Diamonds')}</small>
          </span>
        )}
        {egg}
        {extra}
      </div>
    </section>
  );
}

/** Short words for why a dinosaur cannot go, shown on its tile. */
function issueText(issue: MemberIssue, level: number, lang: number) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  return issue === 'baby'
    ? tr('Pui', 'Baby')
    : issue === 'level'
      ? `${tr('Nv', 'Lv')} ${level}+`
      : issue === 'busy'
        ? tr('Plecat', 'Away')
        : '—';
}

/**
 * The expedition sidebar, in three scrollable tabs: the region's next stage (requirements,
 * reward with the team's element bonus, the team, departure), its patrols (length, reward, team) and the runs under
 * way, one card per portal slot.
 */
export function ExpeditionGuide({
  save,
  now,
  lang,
  destination,
  select,
  run,
  navigate,
  build,
  prepareSupplies,
}: Props) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const ready = save.expeditions.filter((x) => now >= x.endsAt).length;
  const [tab, setTab] = useState<Tab>(() => (ready ? 'active' : 'stage'));
  const [stageTeam, setStageTeam] = useState<string[]>([]);
  const [patrolTeam, setPatrolTeam] = useState<string[]>([]);
  const [hours, setHours] = useState<PatrolHours>(1);
  const busyKey = [...busyDinos(save)].join();
  // A new destination (or a team leaving) starts from a suggested team.
  useEffect(() => {
    setStageTeam(suggestTeam(save, destination, 'stage'));
    setPatrolTeam(suggestTeam(save, destination, 'patrol'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, busyKey, save.expeditionProgress[destination]]);
  const plan = expeditionPlan(save, destination, stageTeam);
  const patrol = patrolPlan(save, destination, hours, patrolTeam);
  useEffect(() => {
    if (tab === 'stage' && plan.done && patrol.unlocked) setTab('patrol');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);
  const busy = busyDinos(save);
  const eligible = (level: number) => (d: Dino) => {
    const issue = memberIssue(save, d, level, busy);
    return issue ? issueText(issue, level, lang) : null;
  };
  // Stable checks for the pickers (they re-sort only when the rules change).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stageEligible = useCallback(eligible(plan.level), [plan.level, busyKey, save.dinos, lang]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const patrolEligible = useCallback(eligible(patrol.level), [patrol.level, busyKey, save.dinos, lang]);
  const idBase = 'expedition-tabs';
  return (
    <section className="expedition-guide" aria-label={tr('Expediție', 'Expedition')}>
      <Tabs<Tab>
        idBase={idBase}
        label={tr('Secțiuni expediție', 'Expedition sections')}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'stage', label: tr('Avansează', 'Advance') },
          { id: 'patrol', label: tr('Strânge resurse', 'Gather') },
          {
            id: 'active',
            label: tr('Pe drum', 'Away'),
            badge: ready ? `${ready}✓` : save.expeditions.length || undefined,
            state: ready ? 'ready' : save.expeditions.length ? 'busy' : undefined,
          },
        ]}
      />
      {tab === 'stage' && (
        <TabPanel idBase={idBase} id="stage" className="expedition-tab expedition-stage-tab">
          <StageTab
            {...{
              save,
              now,
              lang,
              plan,
              team: stageTeam,
              setTeam: setStageTeam,
              eligible: stageEligible,
              select,
              run,
              navigate,
              build,
              prepareSupplies,
              setTab,
            }}
          />
        </TabPanel>
      )}
      {tab === 'patrol' && (
        <TabPanel idBase={idBase} id="patrol" className="expedition-tab expedition-patrol-tab">
          <PatrolTab
            {...{
              save,
              now,
              lang,
              plan: patrol,
              stage: plan,
              team: patrolTeam,
              setTeam: setPatrolTeam,
              eligible: patrolEligible,
              hours,
              setHours,
              run,
              navigate,
              build,
              prepareSupplies,
              setTab,
            }}
          />
        </TabPanel>
      )}
      {tab === 'active' && (
        <TabPanel idBase={idBase} id="active" className="expedition-tab expedition-active-tab">
          <ActiveTab {...{ save, now, lang, run, build, select }} />
        </TabPanel>
      )}
    </section>
  );
}

type Shared = Pick<Props, 'save' | 'lang' | 'run' | 'navigate' | 'build' | 'prepareSupplies'> & {
  team: string[];
  setTeam: (t: string[]) => void;
  eligible: (d: Dino) => string | null;
  setTab: (t: Tab) => void;
};

/** What to do about missing supply packs: build the workshop, collect, grow food, gather or craft. */
function suppliesAction(
  save: Save,
  now: number,
  lang: number,
  prepareSupplies: () => void,
  build: () => void,
  navigate: Props['navigate'],
) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const recipe = RECIPES.find((r) => r.id === 'provisions')!;
  const jobs = save.crafting.filter((j) => j.recipeId === 'provisions');
  const materials = (Object.entries(recipe.cost) as [ItemId, number][]).every(([id, n]) => save.inventory[id] >= n);
  if (!save.buildings.some((b) => b.kind === 'workshop'))
    return { label: tr('Construiește atelierul', 'Build the workshop'), click: build };
  if (jobs.some((j) => j.endsAt <= now))
    return { label: tr('Colectează proviziile', 'Collect supplies'), click: prepareSupplies };
  if (jobs.length) return { label: tr('Provizii în lucru', 'Supplies in progress'), click: prepareSupplies };
  if (save.food < recipeFoodCost(recipe))
    return { label: tr('Cultivă hrană', 'Grow food'), click: () => navigate('farm') };
  if (!materials) return { label: tr('Lipsesc lemn/fibre', 'Need wood/fiber'), click: prepareSupplies };
  return { label: tr('Fabrică provizii', 'Craft supplies'), click: prepareSupplies };
}

function Notice({ text, action }: { text: ReactNode; action?: { label: string; click: () => void } }) {
  return (
    <div className="expedition-notice">
      <span>{text}</span>
      {/* The notice names what blocks the start, so its fix is the main action. */}
      {action && (
        <button type="button" className="realm-button" onClick={action.click}>
          {action.label} →
        </button>
      )}
    </div>
  );
}

function StageTab({
  save,
  now,
  lang,
  plan,
  team,
  setTeam,
  eligible,
  select,
  run,
  navigate,
  build,
  prepareSupplies,
  setTab,
}: Shared & Pick<Props, 'now' | 'select'> & { plan: ExpeditionPlan }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const element = ELEMENTS.find((e) => e.id === plan.region.element)!;
  const recommended = ELEMENTS.find((e) => e.id === plan.recommended)!;
  const next = REGIONS[plan.number];
  const finale = plan.stage === REGION_STAGES - 1;
  const notice: { text: ReactNode; action?: { label: string; click: () => void } } | null =
    plan.blocker === 'world'
      ? {
          text: tr(
            `Deblochează lumea ${REALM_NAMES[element.id][0]} din Lumi.`,
            `Unlock ${REALM_NAMES[element.id][1]} in Worlds.`,
          ),
        }
      : plan.blocker === 'previous' && plan.previousRegion
        ? {
            text: tr(
              `Termină mai întâi ${plan.previousRegion.name[0]} (5/5).`,
              `Finish ${plan.previousRegion.name[1]} (5/5) first.`,
            ),
            action: { label: tr('Vezi regiunea', 'View region'), click: () => select(plan.previousRegion!.id) },
          }
        : plan.blocker === 'portal'
          ? {
              text: tr('Echipele pleacă din Portalul de expediții.', 'Teams leave from the Expedition Portal.'),
              action: { label: tr('Construiește portalul', 'Build the portal'), click: build },
            }
          : plan.blocker === 'done'
            ? {
                text: tr(
                  'Regiune traversată ✓ Patrulele aduc resurse în continuare.',
                  'Region crossed ✓ Patrols keep bringing resources.',
                ),
                action: next
                  ? { label: next.name[lang], click: () => select(next.id) }
                  : { label: tr('Patrulează', 'Patrol'), click: () => setTab('patrol') },
              }
            : plan.blocker === 'running'
              ? {
                  text: tr('O echipă e deja pe drum în această etapă.', 'A team is already on this stage.'),
                  action: { label: tr('Vezi active', 'View active'), click: () => setTab('active') },
                }
              : plan.blocker === 'slots'
                ? {
                    text: tr(
                      `Toate sloturile portalului sunt ocupate (${portalSlots(save)}).`,
                      `Every portal slot is busy (${portalSlots(save)}).`,
                    ),
                    action: { label: tr('Vezi active', 'View active'), click: () => setTab('active') },
                  }
                : plan.blocker === 'supplies'
                  ? {
                      text: tr(
                        `Provizii: ${save.inventory.provisions}/${plan.supplies} pachete.`,
                        `Supplies: ${save.inventory.provisions}/${plan.supplies} packs.`,
                      ),
                      action: suppliesAction(save, now, lang, prepareSupplies, build, navigate),
                    }
                  : (plan.blocker === 'teamSize' || plan.blocker === 'team') && !save.dinos.some((d) => !eligible(d))
                    ? {
                        text: tr(
                          `Ai nevoie de ${plan.teamSize} ${plan.teamSize === 1 ? 'dinozaur tânăr' : 'dinozauri tineri'} de nivel ${plan.level}+.`,
                          `You need ${plan.teamSize} juvenile ${plan.teamSize === 1 ? 'dinosaur' : 'dinosaurs'} at level ${plan.level}+.`,
                        ),
                        action: { label: tr('Crește dinozaurii', 'Raise dinosaurs'), click: () => navigate('dino') },
                      }
                    : null;
  return (
    <>
      <div className="expedition-stage-row">
        <strong>
          {plan.done
            ? tr('Regiune traversată ✓', 'Region crossed ✓')
            : tr(`Etapa ${plan.stage + 1} din ${plan.total}`, `Stage ${plan.stage + 1} of ${plan.total}`)}
        </strong>
        <ol className="expedition-pips" aria-label={tr('Etape', 'Stages')}>
          {Array.from({ length: plan.total }, (_, i) => (
            <li key={i} className={i < plan.completed ? 'done' : i === plan.stage && !plan.done ? 'current' : ''} />
          ))}
        </ol>
      </div>
      {!plan.done && (
        <ul className="expedition-facts">
          <li title={tr('Durata', 'Duration')}>
            <Icon name="clock" scale={1} /> {tripTime(plan.duration)}
          </li>
          <li title={tr('Echipa și nivelul cerut fiecărui membru', 'Team and the level every member needs')}>
            <Icon name="dino" scale={1} /> {plan.teamSize}{' '}
            {plan.teamSize === 1 ? tr('dinozaur', 'dinosaur') : tr('dinozauri', 'dinosaurs')} · {tr('Nv', 'Lv')}{' '}
            {plan.level}+
          </li>
          <li title={tr('Pachete de provizii', 'Supply packs')}>
            <Icon name="chest" scale={1} /> {tr('Provizii', 'Supplies')}: {plan.supplies || tr('nu', 'none')}
          </li>
          <li
            className="expedition-recommended"
            title={tr(
              `${recommended.name[0]} bate ${element.name[0]}: +20% pe membru`,
              `${recommended.name[1]} beats ${element.name[1]}: +20% per member`,
            )}
          >
            <Icon name={elementIcon(recommended.id)} scale={1} /> +20%
            {plan.bonus > 0 && <b> = +{Math.round(plan.bonus * 100)}%</b>}
          </li>
        </ul>
      )}
      {!plan.done && (
        <RewardTiles
          reward={plan.reward}
          lang={lang}
          region={plan.region.id}
          egg={
            finale && (
              <span className="reward-egg" title={tr('Ou garantat al regiunii', "The region's egg, guaranteed")}>
                <Icon name="egg" scale={1} />
                100%
                <small>{tr('Ou', 'Egg')}</small>
              </span>
            )
          }
        />
      )}
      {notice && <Notice {...notice} />}
      {!plan.done && (
        <TeamPicker
          dinos={save.dinos}
          selected={team}
          max={plan.teamSize}
          onChange={setTeam}
          isEligible={eligible}
          lang={lang}
          recommended={plan.recommended}
        />
      )}
      {!plan.done && (
        <button
          type="button"
          className="realm-button adventure-start"
          disabled={!plan.canSend}
          onClick={() => run({ type: 'expedition', regionId: plan.region.id, team })}
        >
          {tr('Pornește etapa', 'Start stage')} {plan.stage + 1} · {tripTime(plan.duration)} →
        </button>
      )}
    </>
  );
}

function PatrolTab({
  save,
  now,
  lang,
  plan,
  stage,
  team,
  setTeam,
  eligible,
  hours,
  setHours,
  run,
  navigate,
  build,
  prepareSupplies,
  setTab,
}: Shared &
  Pick<Props, 'now'> & {
    plan: PatrolPlan;
    stage: ExpeditionPlan;
    hours: PatrolHours;
    setHours: (h: PatrolHours) => void;
  }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  if (!plan.unlocked)
    return (
      <Notice
        text={tr(
          `Patrulele se deschid după etapa ${PATROL.unlockStage} din ${plan.region.name[0]} (acum ${stage.completed}/${PATROL.unlockStage}).`,
          `Patrols open after stage ${PATROL.unlockStage} of ${plan.region.name[1]} (now ${stage.completed}/${PATROL.unlockStage}).`,
        )}
        action={{ label: tr('Vezi etapa', 'View stage'), click: () => setTab('stage') }}
      />
    );
  const notice =
    plan.blocker === 'portal'
      ? {
          text: tr('Echipele pleacă din Portalul de expediții.', 'Teams leave from the Expedition Portal.'),
          action: { label: tr('Construiește portalul', 'Build the portal'), click: build },
        }
      : plan.blocker === 'slots'
        ? {
            text: tr(
              `Toate sloturile portalului sunt ocupate (${portalSlots(save)}).`,
              `Every portal slot is busy (${portalSlots(save)}).`,
            ),
            action: { label: tr('Vezi active', 'View active'), click: () => setTab('active') },
          }
        : plan.blocker === 'supplies'
          ? {
              text: tr('O patrulă cere 1 pachet de provizii.', 'A patrol takes 1 supply pack.'),
              action: suppliesAction(save, now, lang, prepareSupplies, build, navigate),
            }
          : null;
  return (
    <>
      <p className="expedition-tab-hint">
        {tr(
          'Patrula nu avansează pe hartă: dinozaurii pleacă câteva ore și aduc resurse și uneori un ou.',
          'A patrol does not advance on the map: your dinosaurs leave for a few hours and bring resources, sometimes an egg.',
        )}
      </p>
      <h3 className="expedition-section-title">{tr('Durata patrulei', 'Patrol duration')}</h3>
      <div className="expedition-hours" role="radiogroup" aria-label={tr('Durata patrulei', 'Patrol length')}>
        {PATROL_HOURS.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={hours === h}
            className={hours === h ? 'active' : ''}
            onClick={() => setHours(h)}
          >
            {h}h
          </button>
        ))}
        <span
          className="expedition-daily"
          title={tr('Primele 3 patrule colectate azi dau ×1.5', 'The first 3 patrols claimed today pay ×1.5')}
        >
          ×1.5 · {plan.dailyLeft}/{PATROL.daily} {tr('azi', 'today')}
        </span>
      </div>
      <ul className="expedition-facts">
        <li>
          <Icon name="dino" scale={1} /> 1–3 {tr('dinozauri', 'dinosaurs')} · {tr('Nv', 'Lv')} {plan.level}+
        </li>
        <li>
          <Icon name="chest" scale={1} /> {tr('Provizii', 'Supplies')}: 1
        </li>
        <li className="expedition-recommended">
          <Icon name={elementIcon(plan.recommended)} scale={1} /> +20%
          {plan.bonus > 0 && <b> = +{Math.round(plan.bonus * 100)}%</b>}
        </li>
      </ul>
      <RewardTiles
        reward={plan.reward}
        lang={lang}
        region={plan.region.id}
        egg={
          <span className="reward-egg" title={tr('Șansă de ou al regiunii', "Chance of the region's egg")}>
            <Icon name="egg" scale={1} />
            {Math.round(plan.eggChance * 1000) / 10}%<small>{tr('Ou', 'Egg')}</small>
          </span>
        }
      />
      {notice && <Notice {...notice} />}
      <TeamPicker
        dinos={save.dinos}
        selected={team}
        max={3}
        onChange={setTeam}
        isEligible={eligible}
        lang={lang}
        recommended={plan.recommended}
      />
      <button
        type="button"
        className="realm-button adventure-start"
        disabled={!plan.canSend}
        onClick={() => run({ type: 'patrol', regionId: plan.region.id, hours, team })}
      >
        {tr('Trimite patrula', 'Send patrol')} · {hours}h →
      </button>
    </>
  );
}

/** Team portraits of a run, side by side. */
function TeamFaces({ save, team }: { save: Save; team: string[] }) {
  return (
    <span className="expedition-faces">
      {team.map((id) => {
        const d = save.dinos.find((x) => x.id === id);
        return d ? (
          <span key={id} title={`${d.nickname} · ${d.level}`}>
            <DinosaurArt species={d.species} element={d.element} stage={d.stage} paused frame={0} />
          </span>
        ) : null;
      })}
    </span>
  );
}

function ActiveTab({
  save,
  now,
  lang,
  run,
  build,
  select,
}: Pick<Props, 'save' | 'now' | 'lang' | 'run' | 'build' | 'select'>) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const slots = portalSlots(save);
  const card = (x: ExpeditionRun) => {
    const region = regionById(x.regionId)!;
    const done = now >= x.endsAt;
    const left = x.endsAt - now,
      cost = gemsToFinish(left);
    return (
      <CompactCard
        key={x.id}
        className="expedition-run"
        tone={done ? 'good' : 'default'}
        art={<Icon name={elementIcon(region.element)} scale={2} />}
        title={
          <button type="button" className="expedition-run-title" onClick={() => select(region.id)}>
            {region.name[lang]} ·{' '}
            {x.kind === 'stage'
              ? `${tr('Etapa', 'Stage')} ${(x.stage ?? 0) + 1}`
              : `${tr('Patrulă', 'Patrol')} ${x.hours}h`}
          </button>
        }
        subtitle={
          <>
            <TeamFaces save={save} team={x.team} />
            <i className="realm-meter">
              <i
                style={{
                  width: `${Math.max(0, Math.min(100, ((now - x.startedAt) / Math.max(1, x.endsAt - x.startedAt)) * 100))}%`,
                }}
              />
            </i>
          </>
        }
        value={done ? undefined : tripTime(left)}
        action={
          done ? (
            <button
              type="button"
              className="realm-button"
              onClick={() => run({ type: 'claimExpedition', runId: x.id })}
            >
              {tr('Colectează', 'Claim')}
            </button>
          ) : (
            <button
              type="button"
              className="realm-gem-finish"
              disabled={save.gems < cost}
              title={tr('Adu echipa înapoi acum cu diamante', 'Bring the team back now with diamonds')}
              onClick={() => run({ type: 'gemFinish', target: 'expedition', id: x.id })}
            >
              ⚡ {cost} 💎
            </button>
          )
        }
      />
    );
  };
  return (
    <div className="expedition-runs">
      <header className="expedition-active-summary">
        <h3 className="expedition-section-title">{tr('Echipe pe drum', 'Teams on the move')}</h3>
        <p>
          {save.expeditions.length}/{slots} {tr('sloturi ocupate', 'slots occupied')}
        </p>
      </header>
      {save.expeditions.map(card)}
      {Array.from({ length: Math.max(0, slots - save.expeditions.length) }, (_, i) => (
        <CompactCard
          key={`free-${i}`}
          tone="locked"
          className="expedition-slot"
          title={save.portalLevel ? tr('Slot liber', 'Free slot') : tr('Portal neconstruit', 'No portal yet')}
          subtitle={
            save.portalLevel
              ? tr('Trimite o echipă din Etapă sau Patrulă.', 'Send a team from Stage or Patrol.')
              : tr('Construiește Portalul de expediții.', 'Build the Expedition Portal.')
          }
          action={
            !save.portalLevel ? (
              <button type="button" className="realm-button secondary" onClick={build}>
                {tr('Construiește', 'Build')}
              </button>
            ) : undefined
          }
        />
      ))}
      {(() => {
        // The next portal level (one more slot) is upgraded right here; while it is being built, its progress shows.
        const level = Math.max(1, save.portalLevel) + 1,
          next = PORTAL_LEVELS[level - 1];
        if (!next) return null;
        if (save.portalLevel && underConstruction(save, now, 'portal'))
          return <ConstructionStrip save={save} now={now} lang={lang} run={run} target="portal" />;
        return (
          <div className="pk-box pk-upgrade expedition-portal-up">
            <span className="pk-upgrade-what">
              <Icon name="lock" scale={1} />{' '}
              <b className="pk-num">{tr(`Portal nivelul ${level}`, `Portal level ${level}`)}</b> · {next.slots}{' '}
              {tr('sloturi', 'slots')}
            </span>
            {save.portalLevel > 0 && (
              <>
                <CostChips save={save} lang={lang} gold={next.gold} materials={next.materials} />
                <UpgradeButton save={save} now={now} lang={lang} run={run} target="portal" />
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
