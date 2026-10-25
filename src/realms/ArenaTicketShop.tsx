import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ARENA_TICKET_LIMIT,
  arenaTicketPrice,
  ELEMENTS,
  GATE_LEAGUES,
  type Command,
  type RealmId,
  type Save,
} from './game';
import { Icon, elementIcon } from './ui/Icon';
import './arena-tickets.css';

/** Elemental tickets purchased without leaving the arena. */
export function ArenaTicketShop({
  save,
  lang,
  run,
  back,
  focus,
}: {
  save: Save;
  lang: number;
  run: (c: Command) => boolean;
  back: () => void;
  /** The league the player came from: its tile is highlighted. */
  focus?: RealmId;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = dialog.current!;
    modal.showModal();
    return () => modal.close();
  }, []);
  const gold = Math.floor(save.gold);
  const isOpen = (id: RealmId) => !!save.habitats[id] && (!GATE_LEAGUES.includes(id) || save.arenaLevel >= 2);
  const elements = [...ELEMENTS].sort(
    (a, b) => Number(isOpen(b.id)) - Number(isOpen(a.id)) || Number(b.id === focus) - Number(a.id === focus),
  );
  return (
    <dialog
      ref={dialog}
      className="arena-ticket-modal"
      aria-labelledby="arena-ticket-title"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        back();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          back();
      }}
    >
      <section className="arena-ticket-shop">
        <header className="arena-ticket-shop-head">
          <div>
            <h2 id="arena-ticket-title">{tr('Bilete de arenă', 'Arena tickets')}</h2>
            <p>
              {tr(
                'Fiecare ligă cere un bilet al elementului ei. Se cumpără cu aur sau se câștigă din expediții, patrule, roată și sezon.',
                'Each league takes a ticket of its element. Buy them with gold or win them on expeditions, patrols, the wheel and the season.',
              )}
            </p>
          </div>
          <span className="arena-ticket-gold" aria-label={tr('Aur', 'Gold')}>
            <Icon name="gold" scale={1} /> {gold.toLocaleString(lang ? 'en-US' : 'ro-RO')}
          </span>
          <button
            type="button"
            className="realm-button secondary arena-ticket-close"
            onClick={back}
            aria-label={tr('Închide', 'Close')}
            autoFocus
          >
            &times;
          </button>
        </header>
        <p className="arena-ticket-notice" role="status" aria-live="polite">
          {notice ||
            tr(
              'Biletul se consumă la începutul luptei; la remiză îl primești înapoi.',
              'The ticket is spent when the fight starts; a draw gives it back.',
            )}
        </p>
        <div className="arena-ticket-grid">
          {elements.map((e) => {
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
                  <h3>
                    {e.name[lang]}
                    {focus === e.id && (
                      <small className="arena-ticket-selected">{tr('Liga selectată', 'Selected league')}</small>
                    )}
                  </h3>
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
                          {price * quantity} {tr('aur', 'gold')}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="arena-ticket-lock">
                    🔒{' '}
                    {worldOpen ? tr('Poarta arenei nivel 2', 'Arena Gate level 2') : tr('Lume blocată', 'World locked')}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </dialog>
  );
}
