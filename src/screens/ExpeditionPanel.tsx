import { t } from '../i18n';
import { useState } from 'react';
import '../styles/expeditions.css';
import {
  dailyExpeditions,
  nextExpeditionReset,
  expeditionTeamMatches,
  matchesRequirement,
  requirementLabel,
  dinoUnavailable,
  isRecovering,
  expeditionRewards,
  EXPEDITION_SWAP_COST,
  EXPEDITION_CHEST_TARGET,
  EXPEDITION_TRAINING_COST,
  speciesOf,
  stageForLevel,
  ELEMENTS,
  EXPEDITION_MATERIALS,
  MATERIALS,
  type MaterialId,
  type Building,
  type ExpeditionMission,
  type Dino,
} from '@shared/game';
import type { Game } from '../hooks/useGame';
import { DinoThumb, Need, formatTime, formatNumber, Progress } from '../components/ui';

const tiers = { easy: 'Ușoară', medium: 'Medie', hard: 'Grea' };
/** Cele trei îmbunătățiri ale rucsacului (EXPEDITION_TRAINING_COST), fiecare cu +10% pradă. */
const PACK = [
  { icon: '🧭', name: 'Busolă de os' },
  { icon: '🪢', name: 'Frânghii de liană' },
  { icon: '🗺️', name: 'Harta stelelor' },
];
const positions = [
  { left: '19%', top: '32%' },
  { left: '49%', top: '37%' },
  { left: '81%', top: '30%' },
  { left: '20%', top: '61%' },
  { left: '51%', top: '66%' },
  { left: '81%', top: '59%' },
];
function elementOf(m: ExpeditionMission) {
  if (m.element) return m.element;
  const r = m.requirements[0];
  return r.element ?? (r.species ? speciesOf(r.species).elements[0] : 'plant');
}
function Rewards({ mission }: { mission: ExpeditionMission }) {
  return (
    <div className="expedition-rewards" aria-label={t('Recompense')}>
      <span
        className="fragment"
        title={t('Fragmente ancestrale')}
        aria-label={t(`${mission.fragments} fragmente ancestrale`)}
      >
        ✦ <b>{mission.fragments}</b>
      </span>
      <span title={t('Aur')} aria-label={t(`${mission.gold} aur`)}>
        🪙 <b>{t(formatNumber(mission.gold))}</b>
      </span>
      <span title={t('Hrană')} aria-label={t(`${mission.food} hrană`)}>
        🍖 <b>{t(formatNumber(mission.food))}</b>
      </span>
      {mission.gems > 0 && (
        <span title={t('Diamante')} aria-label={t(`${mission.gems} diamante`)}>
          💎 <b>{mission.gems}</b>
        </span>
      )}
      {Object.entries(EXPEDITION_MATERIALS[mission.tier]).map(([k, n]) => (
        <span key={k} className="material" title={t(MATERIALS[k as MaterialId].name)}>
          {t(MATERIALS[k as MaterialId].icon)} <b>{n}</b>
        </span>
      ))}
    </div>
  );
}
function findTeam(dinos: Dino[], mission: ExpeditionMission): string[] | undefined {
  function match(i: number, ids: string[]): string[] | undefined {
    if (i === mission.requirements.length) return ids;
    for (const d of dinos) {
      if (!ids.includes(d.id) && matchesRequirement(d, mission.requirements[i])) {
        const found = match(i + 1, [...ids, d.id]);
        if (found) return found;
      }
    }
  }
  return match(0, []);
}
export function ExpeditionPanel({ game, building }: { game: Game; building: Building }) {
  const { state, now, run } = game,
    board = dailyExpeditions(state, now),
    active = building.adventure;
  const [selection, setSelection] = useState('slot-0');
  const [chosen, setChosen] = useState<{ day: string; mission: string; ids: string[] }>();
  const [view, setView] = useState<'mission' | 'reserves' | 'equipment'>('mission');
  const slot = board.slots.find((s) => s.id === selection) ?? board.slots[0];
  const mission = active?.expedition ?? slot.mission;
  const team = chosen?.day === board.day && chosen.mission === mission.id ? chosen.ids : [];
  const available = state.dinos.filter((d) => !dinoUnavailable(state, d, now));
  const selected = state.dinos.filter((d) => team.includes(d.id));
  const suggested = findTeam(available, mission);
  const owned = expeditionTeamMatches(state.dinos, mission.requirements);
  const canSend =
    !active &&
    slot.status === 'available' &&
    expeditionTeamMatches(selected, mission.requirements) &&
    selected.every((d) => !dinoUnavailable(state, d, now)) &&
    state.food >= mission.cost;
  const finished = board.slots.filter((s) => s.status === 'completed').length;
  const reserves = board.reserves.filter(
    (m) => !slot.mission.element || (m.element === slot.mission.element && m.tier === slot.mission.tier),
  );
  const training = state.expeditionTraining ?? 0;
  const choose = (id: string) => {
    setSelection(id);
    setChosen(undefined);
    setView('mission');
  };
  const candidateDinos = state.dinos.filter((d) =>
    mission.requirements.some((r) => matchesRequirement(d, { ...r, level: 1 })),
  );
  return (
    <div className="expedition-panel">
      <div className="expedition-layout">
        <section className="expedition-map" aria-label={t('Harta expedițiilor')}>
          <div
            className="expedition-map-art"
            style={{
              backgroundImage: `linear-gradient(180deg,#102d3060,transparent 35%,#112b2040),url(${import.meta.env.BASE_URL}world/expedition-map.webp)`,
            }}
          />
          <div className="expedition-map-heading">
            <span>{t('JURNALUL EXPLORATORILOR')}</span>
            <h3>{t('Dincolo de insule')}</h3>
            <small>
              {t('Noi aventuri în ')}
              {t(formatTime(nextExpeditionReset(now) - now))}
            </small>
          </div>
          <svg className="expedition-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M19 32 Q34 27 49 37 T81 30 M19 32 Q10 48 20 61 T51 66 T81 59 Q91 43 81 30 M49 37 Q42 53 51 66" />
          </svg>
          {board.slots.map((s, i) => {
            const ready = expeditionTeamMatches(available, s.mission.requirements),
              element = elementOf(s.mission);
            return (
              <button
                key={s.id}
                className={`expedition-pin tier-${s.mission.tier} ${slot.id === s.id && !active ? 'selected' : ''} ${s.status}`}
                style={{ ...positions[i], '--pin-color': ELEMENTS[element].color } as React.CSSProperties}
                aria-pressed={slot.id === s.id}
                disabled={!!active}
                onClick={() => choose(s.id)}
              >
                <span className="expedition-pin-medallion">
                  <span>
                    {t(s.status === 'completed' ? '✓' : s.status === 'active' ? '⌖' : ELEMENTS[element].icon)}
                  </span>
                  <b>{i + 1}</b>
                </span>
                <strong>{t(s.mission.name)}</strong>
                <span className="expedition-pin-tier">
                  {t(ELEMENTS[element].name)} · {t(tiers[s.mission.tier])}
                </span>
                <small>
                  {t(
                    s.status === 'completed'
                      ? 'Explorată'
                      : s.status === 'active'
                        ? 'În explorare'
                        : ready
                          ? 'Gata de aventură'
                          : 'Echipă incompletă',
                  )}
                </small>
              </button>
            );
          })}
          <div className="expedition-map-caption">
            <span>⌖</span> {t(active ? 'Echipa ta explorează ținutul' : 'Alege un loc de explorat')}
          </div>
          <div className="expedition-treasure">
            <span className="expedition-treasure-icon">🎁</span>
            <div>
              <strong>
                {t(
                  board.chestClaimed ? 'Comoara zilei e a ta!' : `Comoara zilei · ${EXPEDITION_CHEST_TARGET} aventuri`,
                )}
              </strong>
              <div className="expedition-treasure-progress">
                {board.slots.map((s) => (
                  <span key={s.id} className={s.status === 'completed' ? 'done' : ''} />
                ))}
                <small>
                  {finished}/{board.slots.length}
                </small>
              </div>
            </div>
            <span className="expedition-treasure-loot">
              ✦ 15 <span>💎 2</span>
            </span>
          </div>
        </section>
        <aside className="expedition-detail">
          <nav className="expedition-tabs" aria-label={t('Panoul expediției')}>
            <button
              aria-pressed={view === 'mission'}
              className={view === 'mission' ? 'on' : ''}
              onClick={() => setView('mission')}
            >
              {t('⌖ Aventura')}
            </button>
            <button
              aria-pressed={view === 'equipment'}
              className={view === 'equipment' ? 'on' : ''}
              onClick={() => setView('equipment')}
            >
              {t('🎒 Rucsac')}
            </button>
            <span title={t('Fragmente ancestrale')}>✦ {state.fragments ?? 0}</span>
          </nav>
          {view === 'equipment' ? (
            <section className="expedition-equipment">
              <header className="pack-head">
                <span className="pack-icon" aria-hidden="true">
                  🎒
                </span>
                <div>
                  <h3>{t('Rucsacul de expediție')}</h3>
                  <p>{t('Mai multă pradă din fiecare expediție')}</p>
                </div>
                <span className="pack-bonus" title={t('Bonus pe aur, hrană și fragmente')}>
                  +{training * 10}%
                </span>
              </header>
              <ol className="pack-track">
                {PACK.map((tier, i) => {
                  const done = training > i;
                  const next = training === i;
                  return (
                    <li key={tier.name} className={`pack-tier ${done ? 'done' : next ? 'next' : 'locked'}`}>
                      <span className="pack-tier-icon" aria-hidden="true">
                        {t(done ? '✓' : tier.icon)}
                      </span>
                      <div className="pack-tier-copy">
                        <strong>{t(tier.name)}</strong>
                        <small>+{(i + 1) * 10}% 🪙 🍖 ✦</small>
                      </div>
                      {done ? (
                        <span className="pack-tier-state">{t('Echipat')}</span>
                      ) : next ? (
                        <button
                          className="button pack-buy"
                          disabled={(state.fragments ?? 0) < EXPEDITION_TRAINING_COST[i]}
                          onClick={() => run({ type: 'improveExpeditions' })}
                        >
                          ✦ {EXPEDITION_TRAINING_COST[i]}
                          {t(
                            (state.fragments ?? 0) < EXPEDITION_TRAINING_COST[i] &&
                              ` · lipsesc ${EXPEDITION_TRAINING_COST[i] - (state.fragments ?? 0)}`,
                          )}
                        </button>
                      ) : (
                        <span className="pack-tier-state">🔒 ✦ {EXPEDITION_TRAINING_COST[i]}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="pack-note">
                ✦ {state.fragments ?? 0} {t('fragmente · le aduci din expediții și din cufărul zilei')}
              </p>
            </section>
          ) : view === 'reserves' ? (
            <section className="expedition-reserves">
              <button className="expedition-back" onClick={() => setView('mission')}>
                {t('← Înapoi la aventură')}
              </button>
              <h3>{t('O altă destinație?')}</h3>
              <p>
                {t('Alegi o rezervă pentru ')}
                <b>💎 {EXPEDITION_SWAP_COST}</b>.
              </p>
              {state.gems < EXPEDITION_SWAP_COST && (
                <Need
                  what={`Îți lipsesc 💎 ${EXPEDITION_SWAP_COST - state.gems}`}
                  how="Nestemate din cufărul zilei, obiective și Atlas"
                />
              )}
              {!!active && <Need what="O echipă e deja plecată" how="Schimbi destinația după ce se întoarce" />}
              <div className="expedition-reserve-list">
                {reserves.map((m) => (
                  <article key={m.id}>
                    <span className="expedition-reserve-icon">{t(ELEMENTS[elementOf(m)].icon)}</span>
                    <div>
                      <strong>{t(m.name)}</strong>
                      <small>
                        {t(tiers[m.tier])} · {t(formatTime(m.seconds * 1000))}
                      </small>
                      <span className="expedition-reserve-requirements">
                        {t(m.requirements.map(requirementLabel).join(' / '))}
                      </span>
                      <Rewards mission={expeditionRewards(state, m)} />
                    </div>
                    <button
                      aria-label={t(`Alege ${m.name} pentru ${EXPEDITION_SWAP_COST} diamante`)}
                      disabled={!!active || slot.status !== 'available' || state.gems < EXPEDITION_SWAP_COST}
                      onClick={() => {
                        if (run({ type: 'swapExpedition', slotId: slot.id, reserveId: m.id, day: board.day }))
                          choose(slot.id);
                      }}
                    >
                      →
                    </button>
                  </article>
                ))}
              </div>
              {!reserves.length && <p>{t('Nu mai ai o rezervă pentru această expediție astăzi.')}</p>}
              {state.gems < EXPEDITION_SWAP_COST && (
                <small>
                  {t('Ai nevoie de ')}
                  {EXPEDITION_SWAP_COST} {t('diamante pentru înlocuire.')}
                </small>
              )}
            </section>
          ) : (
            <>
              <header className="expedition-mission-heading">
                <span className={`expedition-kicker ${mission.tier}`}>
                  {t(
                    active
                      ? 'ECHIPA ÎN AVENTURĂ'
                      : tiers[mission.tier] + ' · EXPEDIȚIA ' + (board.slots.indexOf(slot) + 1),
                  )}
                </span>
                <h3>{t(mission.name)}</h3>
                <div className="expedition-timing">
                  <span title={t('Durata expediției')}>◷ {t(formatTime(mission.seconds * 1000))}</span>
                  <span
                    title={t(
                      'După întoarcere, dinozaurii nu pot participa la arenă, împerechere sau alte expediții în timpul recuperării.',
                    )}
                  >
                    {t('☾ Odihnă ')}
                    {t(formatTime(mission.recoverySeconds * 1000))}
                  </span>
                </div>
              </header>
              {active ? (
                <section className="expedition-active">
                  <div className="expedition-active-portraits">
                    {active.dinoIds.map((id) => {
                      const d = state.dinos.find((d) => d.id === id);
                      return d && <DinoThumb key={id} species={d.species} stage={stageForLevel(d.level)} tight />;
                    })}
                  </div>
                  <strong>{t(active.readyAt > now ? 'Explorează ținutul…' : 'Echipa s-a întors!')}</strong>
                  <span className="expedition-active-countdown">
                    {t(active.readyAt > now ? formatTime(active.readyAt - now) : 'Comoara te așteaptă')}
                  </span>
                  <Progress value={1 - Math.max(0, active.readyAt - now) / (mission.seconds * 1000)} />
                  <div className="expedition-reward-box">
                    <span className="expedition-kicker">{t('COMORI GĂSITE')}</span>
                    <Rewards mission={mission} />
                  </div>
                  <button
                    className="button expedition-primary"
                    disabled={active.readyAt > now}
                    onClick={() => run({ type: 'claimAdventure', buildingId: building.id })}
                  >
                    {t(active.readyAt > now ? 'Explorare în desfășurare' : 'Adună comoara')}
                  </button>
                  <small>
                    {t(
                      active.readyAt > now
                        ? 'Dinozaurii se vor odihni după întoarcere.'
                        : 'Odihna începe la întoarcere, chiar dacă aduni comoara mai târziu.',
                    )}
                    {t(active.expeditionDay !== board.day && ' Această aventură este de ieri.')}
                  </small>
                </section>
              ) : slot.status === 'completed' ? (
                <div className="expedition-completed">
                  <span>🏆</span>
                  <h3>{t('Aventură completată!')}</h3>
                  <p>{t('Comoara a fost adăugată în resursele tale.')}</p>
                  <button
                    className="button expedition-primary"
                    disabled={!board.slots.some((s) => s.status === 'available')}
                    onClick={() => choose(board.slots.find((s) => s.status === 'available')!.id)}
                  >
                    {t('Alege următoarea aventură')}
                  </button>
                </div>
              ) : (
                <>
                  <section className="expedition-crew">
                    <div className="expedition-crew-heading">
                      <span className="expedition-kicker">{t('ECHIPA DE EXPLORATORI')}</span>
                      {suggested && (
                        <button onClick={() => setChosen({ day: board.day, mission: mission.id, ids: suggested })}>
                          {t('Alege automat ✨')}
                        </button>
                      )}
                    </div>
                    {!owned ? (
                      <div className="expedition-required-creatures">
                        {mission.requirements.map((r, i) => (
                          <div key={i} title={t(requirementLabel(r))}>
                            {r.species ? (
                              <DinoThumb species={r.species} stage={stageForLevel(r.level)} tight />
                            ) : (
                              <span className="expedition-required-element">{t(ELEMENTS[r.element!].icon)}</span>
                            )}
                            <strong>{t(r.species ? speciesOf(r.species).name : ELEMENTS[r.element!].name)}</strong>
                            <small>
                              {t('Nivel ')}
                              {r.level}+
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="adventure-team">
                        {candidateDinos.map((d) => {
                          const selected = team.includes(d.id),
                            busy = dinoUnavailable(state, d, now),
                            eligible = mission.requirements.some((r) => matchesRequirement(d, r));
                          return (
                            <button
                              key={d.id}
                              className={`adventure-dino ${selected ? 'selected' : ''}`}
                              aria-pressed={selected}
                              disabled={busy || !eligible || (!selected && team.length >= 3)}
                              onClick={() =>
                                setChosen({
                                  day: board.day,
                                  mission: mission.id,
                                  ids: selected ? team.filter((id) => id !== d.id) : [...team, d.id],
                                })
                              }
                            >
                              <span className="expedition-dino-check">{t(selected ? '✓' : '+')}</span>
                              <DinoThumb species={d.species} stage={stageForLevel(d.level)} tight />
                              <strong>{t(d.nickname ?? speciesOf(d.species).name)}</strong>
                              <small>
                                {t(
                                  isRecovering(d, now)
                                    ? 'Odihnă ' + formatTime(d.recoveryUntil! - now)
                                    : busy
                                      ? 'Ocupat'
                                      : 'Nivel ' + d.level,
                                )}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className={`expedition-crew-status ${!owned ? 'missing' : ''}`}>
                      {t(
                        !owned
                          ? '🔒 Ai nevoie de speciile și nivelurile de mai sus.'
                          : !suggested
                            ? '☾ Echipa potrivită este ocupată sau în recuperare.'
                            : expeditionTeamMatches(selected, mission.requirements)
                              ? '✓ Echipa e pregătită!'
                              : mission.requirements.map(requirementLabel).join(' · '),
                      )}
                    </div>
                  </section>
                  <div className="expedition-reward-box">
                    <span className="expedition-kicker">{t('TE ÎNTORCI CU')}</span>
                    <Rewards mission={expeditionRewards(state, mission)} />
                  </div>
                  <div className="expedition-launch">
                    <button
                      className="button expedition-primary"
                      disabled={!canSend}
                      onClick={() => {
                        if (
                          run({
                            type: 'startAdventure',
                            buildingId: building.id,
                            missionId: mission.id,
                            dinoIds: team,
                            day: board.day,
                          })
                        )
                          setChosen(undefined);
                      }}
                    >
                      {t('Pornește aventura ')}
                      <span>🍖 {mission.cost}</span>
                    </button>
                    {state.food < mission.cost && <small>{t('Nu ai suficientă hrană.')}</small>}
                    <button
                      className="expedition-swap"
                      disabled={!board.reserves.length}
                      onClick={() => setView('reserves')}
                    >
                      {t('↻ Altă destinație · 💎 ')}
                      {EXPEDITION_SWAP_COST}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
