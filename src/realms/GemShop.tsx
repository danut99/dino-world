import { DEV_TOOLS } from './devTools';
import { useState } from 'react';
import { CROPS, RECIPES, REGIONS } from './content';
import { champion, constructionLeft, GEMS, gemsToFinish, isTired, SPECIES_NAMES, targetName, type Command, type Save } from './game';
import { EggArt } from './DinoPanels';
import { Tabs, TabPanel } from './ui/Tabs';
import { Pager } from './ui/Pager';
import { usePager } from './ui/usePager';
import { CompactCard } from './ui/CompactCard';
import { Icon } from './ui/Icon';
import { itemIcon } from './PanelKit';
import './gem-shop.css';

const T = (lang: number, ro: string, en: string) => (lang ? en : ro);
const minutes = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
};

/** Diamond packs as they will be sold. Shown only: payments are not open yet. */
const PACKS = [
  { gems: 100, price: '4,99 lei' },
  { gems: 550, price: '24,99 lei', bonus: 10 },
  { gems: 1200, price: '49,99 lei', bonus: 20, tag: ['Popular', 'Popular'] },
  { gems: 2500, price: '99,99 lei', bonus: 25, tag: ['Cel mai bun', 'Best value'] },
] as const;

type Running = { key: string; art: React.ReactNode; title: string; left: number; command: Command };

/**
 * The diamond shop: the balance, then three tabs — finish what is running now (the upgrade being built included),
 * boosts (double habitat gold, wake the champion), and the packs that real money will buy later ("coming soon").
 */
export function GemShop({ save, now, lang, run }: { save: Save; now: number; lang: number; run: (c: Command) => boolean }) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const hero = champion(save);
  const tired = !!hero && isTired(save, hero.id, now);
  const boostLeft = Math.max(0, save.boostUntil - now);
  const afford = (n: number) => save.gems >= n;

  // Everything running that diamonds can finish now.
  const building = constructionLeft(save, now);
  const running: Running[] = [
    ...(building
      ? [
          {
            key: 'construction',
            art: <Icon name="build" scale={2} />,
            title: `${tr('Construcție', 'Construction')} · ${targetName(building.target, lang)} ${tr('nv.', 'lv.')} ${building.level}`,
            left: building.left,
            command: { type: 'gemFinish', target: 'construction' } as Command,
          },
        ]
      : []),
    ...save.eggs
      .filter((e) => e.hatchAt !== null && e.hatchAt > now)
      .map((e) => ({
        key: e.id,
        art: <EggArt species={e.species} realm={e.element} size={36} rarity={e.rarity} />,
        title: `${tr('Ou', 'Egg')} · ${e.species === 'boss' ? 'BOSS' : SPECIES_NAMES[e.species]}`,
        left: e.hatchAt! - now,
        command: { type: 'gemFinish', target: 'egg', id: e.id } as Command,
      })),
    ...save.crafting
      .filter((j) => j.startedAt <= now && j.endsAt > now)
      .map((j) => {
        const recipe = RECIPES.find((r) => r.id === j.recipeId)!;
        return {
          key: j.id,
          art: <Icon name={itemIcon(recipe.output)} scale={2} />,
          title: `${tr('Atelier', 'Workshop')} · ${recipe.name[lang]}`,
          left: j.endsAt - now,
          command: { type: 'gemFinish', target: 'craft', id: j.id } as Command,
        };
      }),
    ...save.plots.flatMap((p, i) => {
      if (!p || p.readyAt <= now) return [];
      const crop = CROPS.find((c) => c.id === p.crop)!;
      return [
        {
          key: `plot-${i}`,
          art: <span className="gem-run-icon">{crop.icon}</span>,
          title: `${tr('Fermă', 'Farm')} · ${crop.name[lang]}`,
          left: p.readyAt - now,
          command: { type: 'gemFinish', target: 'plot', plot: i } as Command,
        },
      ];
    }),
    ...save.expeditions
      .filter((x) => x.endsAt > now)
      .map((x) => ({
        key: `trip-${x.id}`,
        art: <Icon name="expedition" scale={2} />,
        title: `${tr('Expediție', 'Expedition')} · ${REGIONS.find((r) => r.id === x.regionId)?.name[lang] ?? ''}`,
        left: x.endsAt - now,
        command: { type: 'gemFinish', target: 'expedition', id: x.id } as Command,
      })),
  ];
  const [tab, setTab] = useState<'finish' | 'boost' | 'packs'>(() => (running.length ? 'finish' : 'boost'));
  const pager = usePager(running, { itemSelector: '.ui-card' });
  const idBase = 'gem-shop';

  return (
    <div className="fit-panel gem-shop">
      <header className="pk-head gem-balance">
        <span className="gem-icon" aria-hidden="true">
          💎
        </span>
        <div className="pk-head-text">
          <strong className="pk-num">
            {save.gems.toLocaleString(lang ? 'en' : 'ro')} {tr('diamante', 'diamonds')}
          </strong>
          <small>{tr('Diamantele cumpără timp, nu putere: termini mai repede, produci mai mult.', 'Diamonds buy time, never power: finish sooner, produce more.')}</small>
        </div>
        {DEV_TOOLS && (
          <div className="pk-head-actions">
            <button className="realm-button secondary" onClick={() => run({ type: 'addGems', amount: 100 })}>
              +100 💎 <small>(test)</small>
            </button>
          </div>
        )}
      </header>
      <Tabs
        idBase={idBase}
        label={tr('Secțiuni magazin', 'Shop sections')}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'finish', label: tr('Accelerări', 'Speed-ups'), badge: running.length },
          { id: 'boost', label: 'Boost' },
          { id: 'packs', label: tr('Pachete', 'Packs') },
        ]}
      />
      {tab === 'finish' && (
        <TabPanel idBase={idBase} id="finish" className="fit-fill pk-paged-tab">
          {running.length ? (
            <div ref={pager.ref} className="ui-paged gem-running">
              {pager.pageItems.map((r) => {
                const cost = gemsToFinish(r.left);
                return (
                  <CompactCard
                    key={r.key}
                    art={r.art}
                    title={r.title}
                    subtitle={<span className="pk-num">⏱ {minutes(r.left)}</span>}
                    action={
                      <button className="realm-button" disabled={!afford(cost)} onClick={() => run(r.command)}>
                        ⚡ {cost} 💎
                      </button>
                    }
                  />
                );
              })}
            </div>
          ) : (
            <div className="pk-empty">
              <Icon name="clock" scale={3} />
              <p className="pk-note">{tr('Nimic nu așteaptă acum. Construcțiile, ouăle din incubator, culturile, fabricările și expedițiile apar aici.', 'Nothing is waiting right now. Upgrades being built, incubating eggs, crops, crafts and expeditions show up here.')}</p>
            </div>
          )}
          <div className="pk-foot">
            <p className="pk-note">{tr(`Prețul scade pe măsură ce timpul trece: 5 min = ${gemsToFinish(300_000)} 💎, 1 h = ${gemsToFinish(3_600_000)} 💎.`, `The price drops as time passes: 5 min = ${gemsToFinish(300_000)} 💎, 1 h = ${gemsToFinish(3_600_000)} 💎.`)}</p>
            <Pager page={pager.page} pages={pager.pages} onPrev={pager.prev} onNext={pager.next} lang={lang} />
          </div>
        </TabPanel>
      )}
      {tab === 'boost' && (
        <TabPanel idBase={idBase} id="boost" className="fit-fill gem-offers">
          <article className={boostLeft ? 'active' : ''}>
            <span className="gem-offer-icon">×2</span>
            <div>
              <strong>{tr('Aur dublu din habitate', 'Double habitat gold')}</strong>
              <small>{boostLeft ? tr(`Activ încă ${minutes(boostLeft)}`, `Active for ${minutes(boostLeft)}`) : tr('Habitatele produc de două ori mai repede.', 'Habitats produce twice as fast.')}</small>
            </div>
            <div className="gem-offer-buttons">
              {([1, 4] as const).map((h) => (
                <button key={h} className="realm-button" disabled={!afford(GEMS.boost[h])} onClick={() => run({ type: 'gemBoost', hours: h })}>
                  {h}h · {GEMS.boost[h]} 💎
                </button>
              ))}
            </div>
          </article>
          <article>
            <span className="gem-offer-icon">☀</span>
            <div>
              <strong>{tr('Trezește campionul', 'Wake your champion')}</strong>
              <small>{tired ? tr(`${hero!.nickname} se odihnește după o luptă.`, `${hero!.nickname} is resting after a fight.`) : tr('Campionul e odihnit și gata de luptă.', 'Your champion is rested and ready.')}</small>
            </div>
            <div className="gem-offer-buttons">
              <button className="realm-button" disabled={!tired || !afford(GEMS.rest)} onClick={() => run({ type: 'gemRest' })}>
                {GEMS.rest} 💎
              </button>
            </div>
          </article>
        </TabPanel>
      )}
      {tab === 'packs' && (
        <TabPanel idBase={idBase} id="packs" className="fit-fill gem-packs-tab">
          <div className="gem-packs">
            {PACKS.map((p) => (
              <div key={p.gems} className="gem-pack" aria-disabled="true">
                {'tag' in p && <em>{p.tag[lang]}</em>}
                <span className="gem-icon" aria-hidden="true">
                  💎
                </span>
                <strong className="pk-num">{p.gems.toLocaleString(lang ? 'en' : 'ro')}</strong>
                {'bonus' in p ? <small>+{p.bonus}% bonus</small> : <small>&nbsp;</small>}
                <b>{p.price}</b>
                <span className="gem-soon">{tr('În curând', 'Coming soon')}</span>
              </div>
            ))}
          </div>
          <p className="pk-note">{tr('Plățile nu sunt încă active. Deocamdată diamantele se câștigă din joc: capitole, regiuni, stele, colecție, cufărul zilnic, roata și sezonul arenei.', 'Payments are not open yet. For now diamonds are earned in the game: chapters, regions, stars, the collection, the daily chest, the wheel and the arena season.')}</p>
        </TabPanel>
      )}
    </div>
  );
}
