import { useEffect, useRef, useState } from 'react';
import { DAILY_BONUS, DAILY_QUESTS, WHEEL_PRIZES, dailyQuests, dailyState, type DailyReward } from './daily';
import { ITEMS, type ItemId } from './content';
import type { Command, Save } from './game';
import { useReducedMotion } from './useMotion';
import './daily.css';

function rewardText(reward: DailyReward, lang: number) {
  return [reward.gold && `${reward.gold} ${lang ? 'gold' : 'aur'}`, reward.food && `${reward.food} ${lang ? 'food' : 'hrană'}`,
    ...Object.entries(reward.materials ?? {}).map(([id, amount]) => `${amount} ${ITEMS[id as ItemId].name[lang]}`)].filter(Boolean).join(' · ');
}
export function DailyPanel({ save, now, lang, run, navigate }: {
  save: Save; now: number; lang: number; run: (c: Command) => boolean;
  navigate: (to: 'dino' | 'farm' | 'workshop' | 'arena' | 'expedition') => void;
}) {
  const tr = (ro: string, en: string) => lang ? en : ro;
  const daily = dailyState(save, now);
  const quests = dailyQuests(daily.day);
  const reduced = useReducedMotion();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(() => daily.spin === null ? 0 : -daily.spin * 45 - 22.5);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  useEffect(() => {
    if (daily.spin !== null && spinning) setRotation(1800 - daily.spin * 45 - 22.5);
  }, [daily.spin, spinning]);
  const spin = () => {
    if (spinning || daily.spin !== null) return;
    if (run({ type: 'spinDaily' })) {
      setSpinning(true);
      timeout.current = setTimeout(() => setSpinning(false), reduced ? 0 : 3200);
    }
  };
  const reset = new Date(`${daily.day}T00:00:00Z`).getTime() + 86400000;
  const remaining = Math.max(0, Math.ceil((reset - now) / 60000));
  return <div className="daily-panel">
    <p className="realm-intro">{tr('O rotire gratuită și patru misiuni în fiecare zi. Joacă în ritmul tău; recompensele sunt opționale.', 'One free spin and four missions each day. Play at your own pace; rewards are optional.')}</p>
    <p className="daily-reset">{tr('Resetare zilnică la 00:00 UTC', 'Daily reset at 00:00 UTC')} · {tr('În', 'In')} {Math.floor(remaining / 60)}h {remaining % 60}min</p>
    <div className="daily-columns">
      <section className="daily-wheel-card" aria-label={tr('Roata zilnică', 'Daily wheel')}>
        <h3>{tr('Roata descoperirilor', 'Wheel of discoveries')}</h3>
        <p>{tr('Un premiu garantat. O încercare gratuită pe zi.', 'A guaranteed prize. One free spin each day.')}</p>
        <div className="daily-wheel-frame" aria-hidden="true"><span className="daily-pointer">▼</span>
          <div className="daily-wheel-clip"><div className={`daily-wheel ${spinning ? 'spinning' : ''}`} style={{ transform: `rotate(${rotation}deg)` }}>
            {WHEEL_PRIZES.map((prize, i) => <span key={i} style={{ transform: `translate(-50%, -50%) rotate(${i * 45 + 22.5}deg) translateY(-100px) rotate(${-i * 45 - 22.5}deg)` }}>{prize.icon}</span>)}
          </div></div><span className="daily-wheel-hub">★</span>
        </div>
        <button className="realm-button" disabled={daily.spin !== null || spinning} onClick={spin}>{spinning ? tr('Se învârte…', 'Spinning…') : daily.spin !== null ? tr('Revino mâine', 'Come back tomorrow') : tr('Învârte gratuit', 'Spin for free')}</button>
        <div className="daily-result" role="status" aria-live="polite">{daily.spin !== null && !spinning ? <><strong>{tr('Ai câștigat', 'You won')}: {WHEEL_PRIZES[daily.spin].label[lang]}</strong><small>{tr('Premiul a fost adăugat resurselor tale.', 'Your prize has been added to your resources.')}</small></> : <span>{tr('Resurse pentru următoarea aventură.', 'Resources for your next adventure.')}</span>}</div>
        <details><summary>{tr('Premii și șanse', 'Prizes and odds')}</summary><ul className="daily-prize-list">{WHEEL_PRIZES.map(p => <li key={p.label[1]}><span>{p.icon} {p.label[lang]}</span><b>{p.weight}%</b></li>)}</ul></details>
      </section>
      <section className="daily-quests" aria-label={tr('Misiuni zilnice', 'Daily missions')}>
        <h3>{tr('Aventura de azi', "Today's adventure")}</h3>
        <p>{tr('Acțiunile se numără automat, chiar dacă nu deschizi acest panou. Setul se schimbă zilnic.', 'Actions count automatically, even if you do not open this panel. The set changes daily.')}</p>
        {quests.map(id => {
          const quest = DAILY_QUESTS[id]; const claimed = daily.claimed.includes(id); const complete = daily.progress[id] >= quest.target;
          return <article className={`daily-quest ${claimed ? 'claimed' : ''}`} key={id}>
            <div><strong>{quest.title[lang]}</strong><span>{daily.progress[id]}/{quest.target}</span></div>
            <progress value={daily.progress[id]} max={quest.target} aria-label={quest.title[lang]} />
            <small>{rewardText(quest.reward, lang)}</small>
            <button className={`realm-button ${complete ? '' : 'secondary'}`} disabled={claimed} onClick={() => complete ? run({ type: 'claimDailyQuest', quest: id }) : navigate(quest.to)}>{claimed ? tr('Colectat ✓', 'Claimed ✓') : complete ? tr('Colectează premiul', 'Claim reward') : tr('Mergi la activitate', 'Go to activity')} {!claimed && !complete && '→'}</button>
          </article>;
        })}
        <article className="daily-bonus"><strong>{tr('Bonus pentru toate cele 4 misiuni', 'Bonus for all 4 missions')}</strong><p>{rewardText(DAILY_BONUS, lang)}</p><button className="realm-button" disabled={daily.bonus || !quests.every(id => daily.claimed.includes(id))} onClick={() => run({ type: 'claimDailyBonus' })}>{daily.bonus ? tr('Bonus colectat ✓', 'Bonus claimed ✓') : tr('Colectează bonusul', 'Claim bonus')}</button></article>
      </section>
    </div>
  </div>;
}
