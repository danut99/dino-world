import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { DAILY_BONUS, DAILY_COUNT, DAILY_QUESTS, WHEEL_PRIZES, dailyQuests, dailyState, type DailyReward } from './daily';
import { ITEMS, type ItemId } from './content';
import { GEMS, type Command, type Save } from './game';
import { useReducedMotion } from './useMotion';
import { Icon, type IconName } from './ui/Icon';
import sheet from './ui/icons.json';
import './daily.css';

const SLICE = 360 / WHEEL_PRIZES.length;
/** Pixel icon for a material; supplies have no icon of their own and use the chest. */
const itemIcon = (id: string): IconName => (id in sheet.icons ? (id as IconName) : 'chest');

/** A reward as small chips: icon and amount, with the name for screen readers and on hover. */
function RewardChips({ reward, lang }: { reward: DailyReward; lang: number }) {
  const chips: { icon: IconName; amount: number; name: string }[] = [
    ...(reward.gold ? [{ icon: 'gold' as IconName, amount: reward.gold, name: lang ? 'gold' : 'aur' }] : []),
    ...(reward.food ? [{ icon: 'food' as IconName, amount: reward.food, name: lang ? 'food' : 'hrană' }] : []),
    ...Object.entries(reward.materials ?? {}).map(([id, amount]) => ({ icon: itemIcon(id), amount: amount!, name: ITEMS[id as ItemId].name[lang] })),
  ];
  return (
    <ul className="daily-chips">
      {chips.map((c) => (
        <li key={c.name} title={c.name}>
          <Icon name={c.icon} scale={1} />
          <b>+{c.amount}</b>
          <span>{c.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function DailyPanel({ save, now, lang, run, navigate }: {
  save: Save; now: number; lang: number; run: (c: Command) => boolean;
  navigate: (to: 'dino' | 'farm' | 'workshop' | 'arena' | 'expedition' | null) => void;
}) {
  const tr = (ro: string, en: string) => lang ? en : ro;
  const daily = dailyState(save, now);
  const quests = dailyQuests(daily.day);
  const reduced = useReducedMotion();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(() => daily.spin === null ? 0 : -daily.spin * SLICE - SLICE / 2);
  // Each spin adds five full turns, so a paid spin landing on the same prize still visibly spins.
  const [turns, setTurns] = useState(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  useEffect(() => {
    if (daily.spin !== null && spinning) setRotation(turns * 1800 - daily.spin * SLICE - SLICE / 2);
  }, [daily.spin, spinning, turns]);
  const spin = () => {
    if (spinning) return;
    if (run(daily.spin === null ? { type: 'spinDaily' } : { type: 'gemSpin' })) {
      setTurns((t) => t + 1);
      setSpinning(true);
      timeout.current = setTimeout(() => setSpinning(false), reduced ? 0 : 3200);
    }
  };
  const reset = new Date(`${daily.day}T00:00:00Z`).getTime() + 86400000;
  const remaining = Math.max(0, Math.ceil((reset - now) / 60000));
  const claimedCount = quests.filter((id) => daily.claimed.includes(id)).length;
  const won = daily.spin !== null && !spinning ? WHEEL_PRIZES[daily.spin] : null;
  return <div className="daily-panel">
    <header className="daily-head">
      <p>{tr(`O rotire gratuită și ${DAILY_COUNT} misiuni noi în fiecare zi. Joacă în ritmul tău.`, `One free spin and ${DAILY_COUNT} new missions every day. Play at your own pace.`)}</p>
      <span className="daily-reset"><Icon name="clock" scale={1} /> {tr('Noi misiuni în', 'New missions in')} {Math.floor(remaining / 60)}h {remaining % 60}min</span>
    </header>
    <div className="daily-columns">
      <section className="daily-wheel-card" aria-label={tr('Roata zilnică', 'Daily wheel')}>
        <h3>{tr('Roata descoperirilor', 'Wheel of discoveries')}</h3>
        <p>{tr('Un premiu garantat, o rotire gratuită pe zi.', 'A guaranteed prize, one free spin a day.')}</p>
        <div className={`daily-wheel-frame ${spinning ? 'spinning' : ''}`} aria-hidden="true">
          <span className="daily-pointer" />
          {Array.from({ length: 16 }, (_, i) => <i key={i} className="daily-bulb" style={{ '--a': `${i * 22.5}deg`, '--n': i % 2 } as CSSProperties} />)}
          <div className="daily-wheel" style={{ transform: `rotate(${rotation}deg)` }}>
            {WHEEL_PRIZES.map((prize, i) => {
              const angle = (i * SLICE + SLICE / 2) * Math.PI / 180;
              return <span key={i} className={daily.spin === i && !spinning ? 'won' : ''} style={{ left: `${50 + 36 * Math.sin(angle)}%`, top: `${50 - 36 * Math.cos(angle)}%`, transform: `translate(-50%, -50%) rotate(${i * SLICE + SLICE / 2}deg)` }}>
                <Icon name={prize.art} scale={2} />
              </span>;
            })}
          </div>
          <span className="daily-wheel-hub"><Icon name="star" scale={2} /></span>
        </div>
        <div className="daily-result" role="status" aria-live="polite">
          {won ? <>
            <span className="daily-result-prize"><Icon name={won.art} scale={2} /> <strong>{won.label[lang]}</strong></span>
            <small>{tr('Premiul a fost adăugat resurselor tale.', 'Your prize has been added to your resources.')}</small>
          </> : <small>{spinning ? tr('Hai, hai…', 'Come on…') : tr('Aur, hrană, materiale sau marele premiu de 500 de aur.', 'Gold, food, materials or the 500 gold jackpot.')}</small>}
        </div>
        <button className="realm-button daily-spin" disabled={spinning || (daily.spin !== null && save.gems < GEMS.spin)} onClick={spin}>
          {spinning ? tr('Se învârte…', 'Spinning…') : daily.spin !== null ? `${tr('Învârte din nou', 'Spin again')} · ${GEMS.spin} 💎` : tr('Învârte gratuit', 'Spin for free')}
        </button>
        <details>
          <summary>{tr('Premii și șanse', 'Prizes and odds')}</summary>
          <ul className="daily-prize-list">{WHEEL_PRIZES.map(p => <li key={p.label[1]}><span><Icon name={p.art} scale={1} /> {p.label[lang]}</span><b>{p.weight}%</b></li>)}</ul>
        </details>
      </section>
      <section className="daily-quests" aria-label={tr('Misiuni zilnice', 'Daily missions')}>
        <h3>{tr('Misiunile de azi', "Today's missions")}</h3>
        <p>{tr('Se numără singure cât joci. Colectează premiul când bara e plină.', 'They count by themselves as you play. Claim the reward once the bar is full.')}</p>
        {quests.map(id => {
          const quest = DAILY_QUESTS[id]; const claimed = daily.claimed.includes(id); const done = daily.progress[id] >= quest.target;
          return <article className={`daily-quest ${claimed ? 'claimed' : done ? 'ready' : ''}`} key={id}>
            <span className="daily-quest-icon"><Icon name={quest.icon} scale={2} /></span>
            <div className="daily-quest-body">
              <div className="daily-quest-title"><strong>{quest.title[lang]}</strong><span>{daily.progress[id]}/{quest.target}</span></div>
              <div className="daily-bar" role="progressbar" aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={daily.progress[id]} aria-label={quest.title[lang]}>
                <i style={{ width: `${(daily.progress[id] / quest.target) * 100}%` }} />
              </div>
              <RewardChips reward={quest.reward} lang={lang} />
            </div>
            {claimed
              ? <span className="daily-stamp">✓ {tr('Colectat', 'Claimed')}</span>
              : <button className={`realm-button ${done ? '' : 'secondary'}`} onClick={() => done ? run({ type: 'claimDailyQuest', quest: id }) : navigate(quest.to)}>
                  {done ? tr('Colectează', 'Claim') : tr('Mergi', 'Go')} {!done && '→'}
                </button>}
          </article>;
        })}
        <article className={`daily-bonus ${daily.bonus ? 'claimed' : claimedCount === quests.length ? 'ready' : ''}`}>
          <span className="daily-quest-icon"><Icon name="chest" scale={2} /></span>
          <div className="daily-quest-body">
            <div className="daily-quest-title"><strong>{tr(`Cufărul zilei · toate cele ${quests.length} misiuni`, `Chest of the day · all ${quests.length} missions`)}</strong></div>
            <div className="daily-pips" aria-label={`${claimedCount}/${quests.length}`}>{quests.map((id) => <i key={id} className={daily.claimed.includes(id) ? 'on' : ''} />)}</div>
            <RewardChips reward={DAILY_BONUS} lang={lang} />
          </div>
          {daily.bonus
            ? <span className="daily-stamp">✓ {tr('Colectat', 'Claimed')}</span>
            : <button className="realm-button" disabled={claimedCount < quests.length} onClick={() => run({ type: 'claimDailyBonus' })}>{tr('Deschide', 'Open')}</button>}
        </article>
      </section>
    </div>
  </div>;
}
