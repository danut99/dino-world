import { useState } from 'react';
import { CROPS, ENCOUNTERS, ITEMS, RECIPES } from './content';
import { champion, GEMS, gemsToFinish, isTired, SPECIES_NAMES, type Command, type Save } from './game';
import { EggArt } from './DinoPanels';
import './gem-shop.css';

const T = (lang: number, ro: string, en: string) => (lang ? en : ro);
const minutes = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
};

/** Diamond packs as they will be sold. Prices are shown only: no payment is taken yet. */
const PACKS = [
  { gems: 100, price: '4,99 lei' },
  { gems: 550, price: '24,99 lei', bonus: 10 },
  { gems: 1200, price: '49,99 lei', bonus: 20, tag: ['Popular', 'Popular'] },
  { gems: 2500, price: '99,99 lei', bonus: 25, tag: ['Cel mai bun', 'Best value'] },
] as const;

/**
 * The diamond shop, opened from the profile: the balance, ways to spend diamonds to go faster (finish what is
 * running, double habitat gold, trade, wake the champion), and the packs that real money will buy later.
 */
export function GemShop({ save, now, lang, run }: { save: Save; now: number; lang: number; run: (c: Command) => boolean }) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const [notice, setNotice] = useState('');
  const hero = champion(save);
  const tired = !!hero && isTired(save, hero.id, now);
  const boostLeft = Math.max(0, save.boostUntil - now);
  const afford = (n: number) => save.gems >= n;

  // Everything running that diamonds can finish now.
  const running: { key: string; art: React.ReactNode; title: string; left: number; command: Command }[] = [
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
          art: <span className="gem-run-icon" style={{ color: ITEMS[recipe.output].color }}>{ITEMS[recipe.output].icon}</span>,
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
    ...(save.expedition && save.expedition.endsAt > now
      ? [
          {
            key: 'trip',
            art: <span className="gem-run-icon">⛰</span>,
            title: `${tr('Expediție', 'Expedition')} · ${ENCOUNTERS.find((e) => e.id === save.expedition!.encounterId)?.name[lang] ?? ''}`,
            left: save.expedition.endsAt - now,
            command: { type: 'gemFinish', target: 'expedition' } as Command,
          },
        ]
      : []),
  ];

  return (
    <div className="gem-shop">
      <header className="gem-balance">
        <span className="gem-icon" aria-hidden="true">💎</span>
        <div>
          <strong>{save.gems.toLocaleString(lang ? 'en' : 'ro')}</strong>
          <small>{tr('diamante', 'diamonds')}</small>
        </div>
        <p>{tr('Diamantele îți economisesc timp: termini mai repede, produci mai mult.', 'Diamonds save you time: finish sooner, produce more.')}</p>
        {import.meta.env.DEV && (
          <button className="realm-button secondary" onClick={() => run({ type: 'addGems', amount: 100 })}>
            + 100 💎 <small>(test)</small>
          </button>
        )}
      </header>

      <section>
        <h4 className="realm-farm-title">{tr('Termină acum', 'Finish now')}</h4>
        {running.length === 0 ? (
          <p className="gem-empty">{tr('Nimic nu așteaptă acum. Ouăle din incubator, culturile, fabricările și expedițiile apar aici.', 'Nothing is waiting right now. Incubating eggs, crops, crafts and expeditions show up here.')}</p>
        ) : (
          <ul className="gem-running">
            {running.map((r) => {
              const cost = gemsToFinish(r.left);
              return (
                <li key={r.key}>
                  {r.art}
                  <span>
                    <strong>{r.title}</strong>
                    <small>⏱ {minutes(r.left)}</small>
                  </span>
                  <button className="realm-button" disabled={!afford(cost)} onClick={() => run(r.command)}>
                    ⚡ {cost} 💎
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h4 className="realm-farm-title">{tr('Accelerează', 'Speed up')}</h4>
        <div className="gem-offers">
          <article className={boostLeft ? 'active' : ''}>
            <span className="gem-offer-icon">×2</span>
            <strong>{tr('Aur dublu din habitate', 'Double habitat gold')}</strong>
            <small>{boostLeft ? tr(`Activ încă ${minutes(boostLeft)}`, `Active for ${minutes(boostLeft)}`) : tr('Habitatele produc de două ori mai repede.', 'Habitats produce twice as fast.')}</small>
            <div className="gem-offer-buttons">
              {([1, 4] as const).map((h) => (
                <button key={h} className="realm-button" disabled={!afford(GEMS.boost[h])} onClick={() => run({ type: 'gemBoost', hours: h })}>
                  {h} {tr(h === 1 ? 'oră' : 'ore', h === 1 ? 'hour' : 'hours')} · {GEMS.boost[h]} 💎
                </button>
              ))}
            </div>
          </article>
          <article>
            <span className="gem-offer-icon gold">●</span>
            <strong>+{GEMS.trade.gold.amount} {tr('aur', 'gold')}</strong>
            <small>{tr('Pentru o construcție sau o lume nouă, acum.', 'For a building or a new world, right now.')}</small>
            <button className="realm-button" disabled={!afford(GEMS.trade.gold.gems)} onClick={() => run({ type: 'gemTrade', offer: 'gold' })}>
              {GEMS.trade.gold.gems} 💎
            </button>
          </article>
          <article>
            <span className="gem-offer-icon food">❧</span>
            <strong>+{GEMS.trade.food.amount} {tr('hrană', 'food')}</strong>
            <small>{tr('Hrănește-ți dinozaurii fără să aștepți ferma.', 'Feed your dinosaurs without waiting for the farm.')}</small>
            <button className="realm-button" disabled={!afford(GEMS.trade.food.gems)} onClick={() => run({ type: 'gemTrade', offer: 'food' })}>
              {GEMS.trade.food.gems} 💎
            </button>
          </article>
          <article>
            <span className="gem-offer-icon">☀</span>
            <strong>{tr('Trezește campionul', 'Wake your champion')}</strong>
            <small>{tired ? tr(`${hero!.nickname} se odihnește după o înfrângere.`, `${hero!.nickname} is resting after a defeat.`) : tr('Campionul e odihnit și gata de luptă.', 'Your champion is rested and ready.')}</small>
            <button className="realm-button" disabled={!tired || !afford(GEMS.rest)} onClick={() => run({ type: 'gemRest' })}>
              {GEMS.rest} 💎
            </button>
          </article>
        </div>
      </section>

      <section>
        <h4 className="realm-farm-title">{tr('Cumpără diamante', 'Buy diamonds')}</h4>
        <div className="gem-packs">
          {PACKS.map((p) => (
            <button key={p.gems} className="gem-pack" onClick={() => setNotice(tr('Plățile nu sunt încă active. Nu s-a taxat nimic.', 'Payments are not active yet. Nothing was charged.'))}>
              {'tag' in p && <em>{p.tag[lang]}</em>}
              <span className="gem-icon" aria-hidden="true">💎</span>
              <strong>{p.gems.toLocaleString(lang ? 'en' : 'ro')}</strong>
              {'bonus' in p && <small>+{p.bonus}% {tr('bonus', 'bonus')}</small>}
              <b>{p.price}</b>
            </button>
          ))}
        </div>
        {notice && <p className="gem-notice" role="status">{notice}</p>}
      </section>
    </div>
  );
}
