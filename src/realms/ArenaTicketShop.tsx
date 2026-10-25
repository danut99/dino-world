import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ARENA_TICKET_LIMIT, ARENA_TICKET_PRICE, ELEMENTS, GATE_LEAGUES, type Command, type Save } from './game';
import { Icon } from './ui/Icon';
import './arena-tickets.css';

export function ArenaTicketShop({ save, lang, run, back }: {
  save: Save; lang: number; run: (c: Command) => boolean; back: () => void;
}) {
  const tr = (ro: string, en: string) => lang ? en : ro;
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="arena-ticket-shop" aria-label={tr('Magazin de tichete', 'Ticket shop')}>
    <header className="arena-ticket-shop-head">
      <button className="realm-button secondary" onClick={back}>← {tr('Înapoi la arenă', 'Back to arena')}</button>
      <span className="arena-ticket-gold"><Icon name="gold" scale={1} /> {Math.floor(save.gold).toLocaleString(lang ? 'en-US' : 'ro-RO')}</span>
    </header>
    <div className="arena-ticket-shop-intro"><span className="realm-eyebrow">{tr('ACCES ÎN ARENĂ', 'ARENA ACCESS')}</span>
      <h2 ref={heading} tabIndex={-1}>{tr('Alege tichetul elementului', 'Choose an elemental ticket')}</h2>
      <p>{tr('1 tichet = 1 luptă. Valabil pentru Ucenic, Veteran și Boss din același element. Tichetele nu expiră.', '1 ticket = 1 battle. Valid for Apprentice, Veteran and Boss of the same element. Tickets never expire.')}</p>
    </div>
    <p className="arena-ticket-notice" role="status" aria-live="polite">{notice || tr('Tichetul se consumă la începerea luptei, inclusiv în caz de înfrângere.', 'The ticket is consumed when the battle starts, including on defeat.')}</p>
    <div className="arena-ticket-grid">
      {ELEMENTS.map(e => {
        const owned = save.arenaTickets[e.id] ?? 0;
        const worldOpen = !!save.habitats[e.id];
        const gateOpen = !GATE_LEAGUES.includes(e.id) || save.arenaLevel >= 2;
        const unlocked = worldOpen && gateOpen;
        return <article key={e.id} className={`arena-ticket-card${unlocked ? '' : ' locked'}`} style={{ '--ticket-color': e.color } as CSSProperties} aria-label={`${tr('Tichet', 'Ticket')} ${e.name[lang]}`}>
          <div className="arena-ticket-card-title"><span className="arena-ticket-art" aria-hidden="true">{e.symbol}</span><div>
            <h3>{e.name[lang]}</h3><small>{tr('Deținute', 'Owned')}: <b>{owned}</b></small>
          </div></div>
          {unlocked ? <>
            <p className="arena-ticket-price"><Icon name="gold" scale={1} /> <b>{ARENA_TICKET_PRICE}</b> / {tr('tichet', 'ticket')}</p>
            <div className="arena-ticket-buy">{[1, 5].map(quantity => <button key={quantity} className="realm-button" disabled={save.gold < ARENA_TICKET_PRICE * quantity || owned + quantity > ARENA_TICKET_LIMIT}
              aria-label={`${tr('Cumpără', 'Buy')} ${quantity} ${e.name[lang]} ${tr('tichete', 'tickets')}`}
              onClick={() => { if (run({ type: 'buyArenaTicket', realm: e.id, quantity })) setNotice(tr(`Ai cumpărat ${quantity} ${quantity === 1 ? 'tichet' : 'tichete'} · ${e.name[lang]}.`, `Bought ${quantity} ${e.name[lang]} ${quantity === 1 ? 'ticket' : 'tickets'}.`)); }}>
              <span>+{quantity}</span><small>{ARENA_TICKET_PRICE * quantity} ●</small>
            </button>)}</div>
            {save.gold < ARENA_TICKET_PRICE && <small className="arena-ticket-missing">{tr(`Îți lipsesc ${Math.ceil(ARENA_TICKET_PRICE - save.gold)} aur.`, `You need ${Math.ceil(ARENA_TICKET_PRICE - save.gold)} more gold.`)}</small>}
          </> : <p className="arena-ticket-lock">🔒 {worldOpen ? tr('Necesită Poarta arenei nivel 2.', 'Requires Arena Gate level 2.') : tr('Deblochează mai întâi acest tărâm.', 'Unlock this world first.')}</p>}
        </article>;
      })}
    </div>
  </section>;
}
