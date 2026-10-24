import { ResourceHelp, RequirementLink } from './ResourceHelp';
import { useState } from 'react';
import { CROPS, FARM_LEVELS, ITEMS, type ItemId, type CropId } from './content';
import './farm-layout.css';
import { farmReadyFood, farmYield, gemsToFinish, type Command, type Save } from './game';

export const duration = (seconds: number) =>
  seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h${seconds % 3600 ? ` ${Math.round((seconds % 3600) / 60)}m` : ''}`
    : seconds >= 60
      ? `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ''}`
      : `${seconds}s`;

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
  if (!save.buildings.some((b) => b.kind === 'farm'))
    return (
      <div className="realm-centered">
        <span className="realm-large-symbol food">❧</span>
        <h3>{tr('O recoltă mică, vise mari', 'Small harvests, big dreams')}</h3>
        <p>{tr('Construiește o fermă ca să cultivi hrană.', 'Build a farm to grow food.')}</p>
        <button className="realm-button" onClick={build}>
          {tr('Construiește o fermă', 'Build a farm')}
        </button>
      </div>
    );

  const level = FARM_LEVELS[save.farmLevel - 1],
    next = FARM_LEVELS[save.farmLevel];
  const freePlot = save.plots.findIndex((p) => !p);
  const target = picked !== null && picked < save.plots.length && !save.plots[picked] ? picked : freePlot;
  const readyFood = farmReadyFood(save, now);
  const busy = save.plots.filter((p) => p).length;
  const nextCrop = next && CROPS.find((c) => c.level === save.farmLevel + 1);
  const materials = next ? (Object.entries(next.materials) as [ItemId, number][]) : [];
  const canUpgrade = !!next && save.gold >= next.gold && materials.every(([id, n]) => save.inventory[id] >= n);
  const selectedCrop = CROPS.find(c => c.id === cropId)!;
  const cropLocked = selectedCrop.level > save.farmLevel;

  return (
    <div className="realm-farm">
      <div className="realm-farm-head">
        <span className="realm-farm-level">
          <small>{tr('NIVEL', 'LEVEL')}</small>
          {save.farmLevel}
          <small>/ {FARM_LEVELS.length}</small>
        </span>
        <div>
          <strong>
            {busy}/{level.plots} {tr('straturi active', 'active plots')}
          </strong>
          <small>
            {tr('Recoltă', 'Harvest')} ×{level.yield} · {tr('hrană per strat', 'food per plot')}
          </small>
        </div>
        <button className="realm-link" onClick={move}>
          {tr('Mută ferma', 'Move farm')}
        </button>
      </div>

      <div className="farm-layout"><section className="farm-field"><div className="farm-section-title"><h3>{tr('Straturile tale', 'Your plots')}</h3><small>{tr('Alege un strat liber', 'Choose an empty plot')}</small></div><div className="realm-farm-plots">
        {Array.from({ length: FARM_LEVELS.at(-1)!.plots }, (_, i) => {
          if (i >= save.plots.length) {
            const unlock = FARM_LEVELS.findIndex((l) => l.plots > i) + 1;
            return (
              <div key={i} className="realm-plot locked">
                <span>🔒</span>
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
                className={`realm-plot empty ${i === target ? 'on' : ''}`}
                onClick={() => setPicked(i)}
                aria-pressed={i === target}
              >
                <span>＋</span>
                <small>{tr('Liber', 'Empty')}</small>
              </button>
            );
          const crop = CROPS.find((c) => c.id === p.crop)!,
            left = p.readyAt - now,
            done = Math.max(0, Math.min(1, 1 - left / (crop.seconds * 1000)));
          return left > 0 ? (
            <div key={i} className="realm-plot growing">
              <span>{crop.icon}</span>
              <strong>{crop.name[lang]}</strong>
              <small>{duration(Math.ceil(left / 1000))}</small>
              <div className="realm-meter">
                <i style={{ width: `${done * 100}%` }} />
              </div>
              <button className="realm-gem-finish" disabled={save.gems < gemsToFinish(left)} onClick={() => run({ type: 'gemFinish', target: 'plot', plot: i })} title={tr('Termină acum cu diamante', 'Finish now with diamonds')}>
                ⚡ {gemsToFinish(left)} 💎
              </button>
            </div>
          ) : (
            <button key={i} className="realm-plot ready" onClick={() => run({ type: 'harvest', plot: i })}>
              <span>{crop.icon}</span>
              <strong>{crop.name[lang]}</strong>
              <small>❧ +{farmYield(save.farmLevel, p.crop)}</small>
            </button>
          );
        })}
      </div>

      {readyFood > 0 && (
        <button className="realm-button realm-farm-harvest" onClick={() => run({ type: 'harvest' })}>
          {tr('Recoltează tot', 'Harvest all')} · ❧ +{readyFood}
        </button>
      )}

      </section><section className="farm-seeds"><div className="farm-section-title"><h3>{tr('Alege cultura', 'Choose a crop')}</h3><small>{target >= 0 ? `${tr('Strat', 'Plot')} ${target + 1}` : tr('Niciun strat liber', 'No free plots')}</small></div>
      <div className="realm-farm-crops">
        {CROPS.map(c => <button key={c.id} className={`realm-crop ${cropId === c.id ? 'selected' : ''}`} aria-pressed={cropId === c.id} onClick={() => setCropId(c.id)}>
          <span className="realm-crop-icon">{c.icon}</span><span className="realm-crop-body"><strong>{c.name[lang]}</strong><small>{c.level > save.farmLevel ? `${tr('Nivel', 'Level')} ${c.level}` : `${duration(c.seconds)} · +${farmYield(save.farmLevel, c.id)}`}</small></span>
        </button>)}
      </div>
      <div className="farm-plant-selection"><strong>{selectedCrop.icon} {selectedCrop.name[lang]}</strong><div className="farm-crop-facts"><span>{tr('Recoltă', 'Harvest')}: <b>+{farmYield(save.farmLevel, selectedCrop.id)}</b></span><span>{tr('Durată', 'Time')}: <b>{duration(selectedCrop.seconds)}</b></span><span>{tr('Cost', 'Cost')}: <b>{selectedCrop.cost || tr('Gratuit', 'Free')}{selectedCrop.cost > 0 && ` ${tr('aur', 'gold')}`}</b></span></div>
      {cropLocked ? <RequirementLink title={tr(`Nivel necesar: ${selectedCrop.level}`, `Required level: ${selectedCrop.level}`)} detail={tr('Vezi îmbunătățirea fermei.', 'View the farm upgrade.')} action={() => document.querySelector('.realm-farm-upgrade')?.scrollIntoView({ block: 'center' })} /> : <ResourceHelp save={save} lang={lang} gold={selectedCrop.cost} />}
      {target < 0 && <p className="farm-busy-note">{tr('Recoltează culturile gata sau așteaptă eliberarea unui strat.', 'Harvest ready crops or wait for a free plot.')}</p>}
      <button className="realm-button farm-plant-button" disabled={cropLocked || target < 0 || save.gold < selectedCrop.cost} onClick={() => { if (run({ type: 'plant', crop: selectedCrop.id, plot: target })) setPicked(null); }}>{target >= 0 ? `${tr('Plantează pe stratul', 'Plant on plot')} ${target + 1}` : tr('Straturi ocupate', 'Plots occupied')} →</button>
      </div></section></div>

      <div className="realm-farm-upgrade">
        {next ? (
          <>
            <div>
              <span className="realm-eyebrow">
                {tr('ÎMBUNĂTĂȚIRE', 'UPGRADE')} · {tr('NIVEL', 'LEVEL')} {save.farmLevel + 1}
              </span>
              <ul>
                <li>
                  🌱 {level.plots} → <b>{next.plots}</b> {tr('straturi active', 'active plots')}
                </li>
                <li>
                  ❧ ×{level.yield} → <b>×{next.yield}</b> {tr('hrană per recoltă', 'food per harvest')}
                </li>
                {nextCrop && (
                  <li>
                    {nextCrop.icon} {tr('Cultură nouă', 'New crop')}: <b>{nextCrop.name[lang]}</b>
                  </li>
                )}
              </ul>
              <div className="realm-farm-costs">
                <span className={save.gold >= next.gold ? '' : 'short'}>{next.gold} ●</span>
                {materials.map(([id, n]) => (
                  <span key={id} className={save.inventory[id] >= n ? '' : 'short'} title={ITEMS[id].name[lang]}>
                    {ITEMS[id].icon} {save.inventory[id]}/{n}
                  </span>
                ))}
              </div>
            </div>
            <div className="farm-upgrade-actions"><ResourceHelp save={save} lang={lang} gold={next.gold} materials={next.materials} /><button className="realm-button" disabled={!canUpgrade} onClick={() => run({ type: 'upgradeFarm' })}>
              {tr('Îmbunătățește', 'Upgrade')}
            </button></div>
          </>
        ) : (
          <p>★ {tr('Ferma e la nivelul maxim.', 'The farm is at max level.')}</p>
        )}
      </div>
    </div>
  );
}
