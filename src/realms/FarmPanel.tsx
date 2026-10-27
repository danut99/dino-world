import { ResourceHelp } from './ResourceHelp';
import { useState } from 'react';
import { CROPS, FARM_LEVELS, type CropId } from './content';
import { Tabs, TabPanel } from './ui/Tabs';
import { Icon } from './ui/Icon';
import { ConstructionStrip, CostChips, UpgradeButton, underConstruction } from './PanelKit';
import './farm-layout.css';
import { farmReadyFood, farmYield, gemsToFinish, type Command, type Save } from './game';

export const duration = (seconds: number) =>
  seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h${seconds % 3600 ? ` ${Math.round((seconds % 3600) / 60)}m` : ''}`
    : seconds >= 60
      ? `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ''}`
      : `${seconds}s`;

/**
 * The farm: every plot on one row, the three crops under it (each says how much food and for how long you are
 * away), and the next level on its own tab with what it brings.
 */
export function FarmPanel({
  save,
  now,
  lang,
  run,
  build,
  move,
}: {
  save: Save;
  now: number;
  lang: number;
  run: (c: Command) => boolean;
  build: () => void;
  move: () => void;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [picked, setPicked] = useState<number | null>(null);
  const [cropId, setCropId] = useState<CropId>(CROPS[0].id);
  const [tab, setTab] = useState<'field' | 'upgrade'>('field');
  if (!save.buildings.some((b) => b.kind === 'farm'))
    return (
      <div className="fit-panel fit-single">
        <div className="pk-empty">
          <Icon name="food" scale={4} />
          <h3>{tr('O recoltă mică, vise mari', 'Small harvests, big dreams')}</h3>
          <p className="pk-note">{tr('Construiește o fermă ca să cultivi hrană.', 'Build a farm to grow food.')}</p>
          <button className="realm-button" onClick={build}>
            {tr('Construiește o fermă', 'Build a farm')}
          </button>
        </div>
      </div>
    );

  const level = FARM_LEVELS[save.farmLevel - 1],
    next = FARM_LEVELS[save.farmLevel];
  const freePlot = save.plots.findIndex((p) => !p);
  const target = picked !== null && picked < save.plots.length && !save.plots[picked] ? picked : freePlot;
  const readyFood = farmReadyFood(save, now);
  const busy = save.plots.filter((p) => p).length;
  const crop = CROPS.find((c) => c.id === cropId)!;
  const cropLocked = crop.level > save.farmLevel;
  const idBase = 'farm';
  const when: Record<CropId, string> = {
    ferns: tr('când joci acum', 'while you play'),
    cicadas: tr('pentru o pauză', 'for a break'),
    feast: tr('peste noapte', 'overnight'),
  };
  const fmt = (n: number) => n.toLocaleString(lang ? 'en-US' : 'ro-RO');
  const best = CROPS[CROPS.length - 1];

  return (
    <div className="fit-panel realm-farm farm-panel">
      <header className="pk-head">
        <span className="pk-level">
          <small>{tr('NIVEL', 'LEVEL')}</small>
          {save.farmLevel}
        </span>
        <div className="pk-head-text">
          <strong>
            {busy}/{level.plots} {tr('straturi active', 'active plots')} · {tr('recoltă', 'harvest')} ×{level.yield}
          </strong>
          <small>
            <Icon name="food" scale={1} /> {fmt(Math.floor(save.food))} {tr('hrană', 'food')} ·{' '}
            {tr('Hrana îți crește dinozaurii.', 'Food grows your dinosaurs.')}
          </small>
        </div>
        <div className="pk-head-actions">
          {readyFood > 0 && (
            <button className="realm-button" onClick={() => run({ type: 'harvest' })}>
              {tr('Recoltează tot', 'Harvest all')} · +{readyFood}
            </button>
          )}
          <button className="realm-link" onClick={move}>
            {tr('Mută', 'Move')}
          </button>
        </div>
      </header>
      <Tabs
        idBase={idBase}
        label={tr('Secțiuni fermă', 'Farm sections')}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'field', label: tr('Câmp', 'Field'), state: readyFood > 0 ? 'ready' : busy ? 'busy' : undefined },
          {
            id: 'upgrade',
            label: next ? `${tr('Nivel', 'Level')} ${save.farmLevel + 1}` : tr('Nivel maxim', 'Max level'),
            state: save.construction?.target === 'farm' ? 'busy' : undefined,
          },
        ]}
      />
      {tab === 'field' ? (
        <TabPanel idBase={idBase} id="field" className="fit-fill farm-field">
          <div className="farm-plots" style={{ '--plots': FARM_LEVELS.at(-1)!.plots } as React.CSSProperties}>
            {Array.from({ length: FARM_LEVELS.at(-1)!.plots }, (_, i) => {
              if (i >= save.plots.length) {
                const unlock = FARM_LEVELS.findIndex((l) => l.plots > i) + 1;
                return (
                  <div key={i} className="farm-plot locked">
                    <Icon name="lock" scale={2} />
                    <small>
                      {tr('Nivel', 'Level')} {unlock}
                    </small>
                  </div>
                );
              }
              const p = save.plots[i];
              if (!p)
                return (
                  <button
                    key={i}
                    className={`farm-plot empty ${i === target ? 'on' : ''}`}
                    onClick={() => setPicked(i)}
                    aria-pressed={i === target}
                  >
                    <span>＋</span>
                    <small>{tr('Liber', 'Empty')}</small>
                  </button>
                );
              const c = CROPS.find((x) => x.id === p.crop)!,
                left = p.readyAt - now,
                done = Math.max(0, Math.min(1, 1 - left / (c.seconds * 1000)));
              return left > 0 ? (
                <div key={i} className="farm-plot growing">
                  <span>{c.icon}</span>
                  <strong>{c.name[lang]}</strong>
                  <small className="pk-num">{duration(Math.ceil(left / 1000))}</small>
                  <div className="pk-meter" style={{ '--meter': 'var(--px-moss-1)' } as React.CSSProperties}>
                    <i style={{ width: `${done * 100}%` }} />
                  </div>
                  <button
                    className="realm-gem-finish"
                    disabled={save.gems < gemsToFinish(left)}
                    onClick={() => run({ type: 'gemFinish', target: 'plot', plot: i })}
                    title={tr('Termină acum cu diamante', 'Finish now with diamonds')}
                  >
                    ⚡ {gemsToFinish(left)} 💎
                  </button>
                </div>
              ) : (
                <button key={i} className="farm-plot ready" onClick={() => run({ type: 'harvest', plot: i })}>
                  <span>{c.icon}</span>
                  <strong>{c.name[lang]}</strong>
                  <small className="pk-num">❧ +{farmYield(save.farmLevel, p.crop)}</small>
                </button>
              );
            })}
          </div>
          <div className="farm-crops" role="group" aria-label={tr('Alege cultura', 'Choose a crop')}>
            {CROPS.map((c) => {
              const locked = c.level > save.farmLevel;
              return (
                <button
                  key={c.id}
                  className={`farm-crop${locked ? ' locked' : ''}`}
                  aria-pressed={cropId === c.id}
                  onClick={() => setCropId(c.id)}
                  title={c.name[lang]}
                >
                  <span className="farm-crop-icon">{c.icon}</span>
                  <span className="farm-crop-body">
                    <strong>{c.name[lang]}</strong>
                    {locked ? (
                      <small className="pk-num">
                        🔒 {tr('Nivel', 'Level')} {c.level}
                      </small>
                    ) : (
                      <>
                        <small className="pk-num farm-crop-food">
                          +{fmt(farmYield(save.farmLevel, c.id))} {tr('hrană', 'food')}
                        </small>
                        <small className="pk-num">
                          ⏱ {duration(c.seconds)} · {when[c.id]}
                        </small>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pk-box farm-plant">
            <span className="farm-plant-what">
              <b>
                {crop.icon} {crop.name[lang]}
              </b>{' '}
              · ❧ <b className="pk-num">+{farmYield(save.farmLevel, crop.id)}</b> · ⏱{' '}
              <b className="pk-num">{duration(crop.seconds)}</b> ·{' '}
              {crop.cost ? (
                <>
                  <Icon name="gold" scale={1} /> <b className="pk-num">{crop.cost}</b>
                </>
              ) : (
                tr('gratuit', 'free')
              )}
            </span>
            {cropLocked ? (
              <button className="realm-link" onClick={() => setTab('upgrade')}>
                🔒 {tr(`Se deschide la nivelul ${crop.level}`, `Opens at level ${crop.level}`)} →
              </button>
            ) : (
              <ResourceHelp save={save} lang={lang} gold={crop.cost} />
            )}
            <button
              className="realm-button"
              disabled={cropLocked || target < 0 || save.gold < crop.cost}
              onClick={() => {
                if (run({ type: 'plant', crop: crop.id, plot: target })) setPicked(null);
              }}
            >
              {target >= 0
                ? `${tr('Plantează pe stratul', 'Plant on plot')} ${target + 1}`
                : tr('Straturi ocupate', 'Plots occupied')}
            </button>
          </div>
        </TabPanel>
      ) : (
        <TabPanel idBase={idBase} id="upgrade" className="fit-fill farm-upgrade">
          {next ? (
            <>
              <div className="farm-levels">
                <div className="pk-box">
                  <h3 className="pk-title">
                    {tr('Acum', 'Now')}{' '}
                    <small>
                      {tr('Nivel', 'Level')} {save.farmLevel}
                    </small>
                  </h3>
                  <ul>
                    <li>
                      🌱 <b className="pk-num">{level.plots}</b> {tr('straturi', 'plots')}
                    </li>
                    <li>
                      ❧ <b className="pk-num">×{level.yield}</b> {tr('hrană per recoltă', 'food per harvest')}
                    </li>
                  </ul>
                </div>
                <span className="farm-arrow" aria-hidden="true">
                  ▶
                </span>
                <div className="pk-box farm-next">
                  <h3 className="pk-title">
                    {tr('Nivelul următor', 'Next level')}{' '}
                    <small>
                      {tr('Nivel', 'Level')} {save.farmLevel + 1}
                    </small>
                  </h3>
                  <ul>
                    <li>
                      🌱 <b className="pk-num">{next.plots}</b> {tr('straturi', 'plots')} (+{next.plots - level.plots})
                    </li>
                    <li>
                      ❧ <b className="pk-num">×{next.yield}</b> {tr('hrană per recoltă', 'food per harvest')}
                    </li>
                    <li>
                      {best.icon} {best.name[lang]}: +{fmt(farmYield(save.farmLevel, best.id))} →{' '}
                      <b className="pk-num">+{fmt(farmYield(save.farmLevel + 1, best.id))}</b> {tr('hrană', 'food')}
                    </li>
                  </ul>
                </div>
              </div>
              <div className="pk-box pk-upgrade">
                {underConstruction(save, now, 'farm') ? (
                  <ConstructionStrip save={save} now={now} lang={lang} run={run} target="farm" />
                ) : (
                  <>
                    <span className="pk-upgrade-what">{tr('Cost', 'Cost')}</span>
                    <CostChips save={save} lang={lang} gold={next.gold} materials={next.materials} />
                    <ResourceHelp save={save} lang={lang} gold={next.gold} materials={next.materials} />
                    <UpgradeButton save={save} now={now} lang={lang} run={run} target="farm" />
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="pk-empty">
              <Icon name="star" scale={3} />
              <p className="pk-note">
                {tr(
                  `Ferma e la nivelul maxim: ${level.plots} straturi și recoltă ×${level.yield}.`,
                  `The farm is at max level: ${level.plots} plots and harvests ×${level.yield}.`,
                )}
              </p>
            </div>
          )}
        </TabPanel>
      )}
    </div>
  );
}
