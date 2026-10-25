import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ARENA_TICKET_LIMIT, arenaTicketPrice, ELEMENTS, GATE_LEAGUES, type Command, type RealmId, type Save } from './game';
import { Icon, elementIcon } from './ui/Icon';
import './arena-tickets.css';

/**
 * The ticket counter: one compact tile per element world, with the stock, the gold price and +1 / +5. A league
 * takes a ticket of its own element; tickets never refill on their own and cannot be bought with diamonds.
 * Fits its window without scrolling (two rows of five, or five rows of two on narrow screens).
 */
export function ArenaTicketShop({ save, lang, run, back, focus }: {
  save: Save;
  lang: number;
  run: (c: Command) => boolean;
  back: () => void;
  /** The league the player came from: its tile is highlighted. */
  focus?: RealmId;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const gold = Math.floor(save.gold);
  return (
    <section className="arena-ticket-shop" aria-label={tr('Magazin de bilete', 'Ticket shop')}>
      <header className="arena-ticket-shop-head">
        <button type="button" className="realm-button secondary" onClick={back}>
          ← {tr('Arena', 'Arena')}
        </button>
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {tr('Bilete de arenă', 'Arena tickets')}
          </h2>
          <p>{tr('Fiecare ligă cere un bilet al elementului ei. Se cumpără cu aur sau se câștigă din expediții, patrule, roată și sezon.', 'Each league takes a ticket of its element. Buy them with gold or win them on expeditions, patrols, the wheel and the season.')}</p>
        </div>
        <span className="arena-ticket-gold" aria-label={tr('Aur', 'Gold')}>
          <Icon name="gold" scale={1} /> {gold.toLocaleString(lang ? 'en-US' : 'ro-RO')}
        </span>
      </header>
      <p className="arena-ticket-notice" role="status" aria-live="polite">
        {notice || tr('Biletul se consumă la începutul luptei; la remiză îl primești înapoi.', 'The ticket is spent when the fight starts; a draw gives it back.')}
      </p>
      <div className="arena-ticket-grid">
        {ELEMENTS.map((e) => {
          const owned = save.arenaTickets[e.id] ?? 0,
            price = arenaTicketPrice(e.id),
            worldOpen = !!save.habitats[e.id],
            gateOpen = !GATE_LEAGUES.includes(e.id) || save.arenaLevel >= 2,
            open = worldOpen && gateOpen;
          return (
            <article
              key={e.id}
              className={`arena-ticket-card${open ? '' : ' locked'}${focus === e.id ? ' focus' : ''}`}
              style={{ '--ticket-color': e.color } as CSSProperties}
              aria-label={`${tr('Bilet', 'Ticket')} ${e.name[lang]}`}
            >
              <div className="arena-ticket-card-title">
                <span className="arena-ticket-art" aria-hidden="true">
                  <Icon name={elementIcon(e.id)} scale={1} />
                </span>
                <h3>{e.name[lang]}</h3>
                <b className="arena-ticket-stock" title={tr('Bilete deținute', 'Tickets owned')}>
                  🎟 {owned}
                </b>
              </div>
              {open ? (
                <div className="arena-ticket-buy">
                  {[1, 5].map((quantity) => (
                    <button
                      key={quantity}
                      type="button"
                      className="realm-button"
                      disabled={gold < price * quantity || owned + quantity > ARENA_TICKET_LIMIT}
                      aria-label={`${tr('Cumpără', 'Buy')} ${quantity} · ${e.name[lang]} · ${price * quantity} ${tr('aur', 'gold')}`}
                      onClick={() => {
                        if (run({ type: 'buyArenaTicket', realm: e.id, quantity }))
                          setNotice(
                            tr(
                              `+${quantity} ${quantity === 1 ? 'bilet' : 'bilete'} ${e.name[0]} · ai ${owned + quantity}.`,
                              `+${quantity} ${e.name[1]} ${quantity === 1 ? 'ticket' : 'tickets'} · you have ${owned + quantity}.`,
                            ),
                          );
                      }}
                    >
                      <span>+{quantity}</span>
                      <small>
                        {price * quantity} <Icon name="gold" scale={1} />
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="arena-ticket-lock">
                  🔒 {worldOpen ? tr('Poarta arenei nivel 2', 'Arena Gate level 2') : tr('Lume blocată', 'World locked')}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
