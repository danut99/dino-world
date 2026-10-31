import { useState } from 'react';
import { addReminder, reminderSet, remindersSupported } from '../reminders';
import './ui-kit.css';

/**
 * "🔔 Remind me once" next to a timer the player just started. `compact` shows only the bell (tight tiles); the
 * tooltip still says it is a single reminder for this one thing.
 */
export function ReminderButton({
  id,
  at,
  title,
  body,
  lang,
  compact = false,
  label,
}: {
  id: string;
  at: number;
  title: string;
  body: string;
  lang: number;
  compact?: boolean;
  /** What it is for, when several sit together ("Feast", "Egg"). */
  label?: string;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [state, setState] = useState<'idle' | 'set' | 'denied'>(() => (reminderSet(id) ? 'set' : 'idle'));
  if (!remindersSupported() || at <= Date.now()) return null;
  const time = new Date(at).toLocaleTimeString(lang ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' });
  const once = tr(
    'Un singur anunț, doar pentru asta, când e gata. Merge cât jocul rămâne deschis într-un tab.',
    'One notice, just for this, when it is ready. Works while the game stays open in a tab.',
  );
  if (state === 'set')
    return (
      <small className="reminder-note" title={once}>
        🔔 {compact ? '✓' : `${label ? `${label}: ` : ''}${tr(`te anunț la ${time}`, `I will tell you at ${time}`)}`}
      </small>
    );
  if (state === 'denied')
    return (
      <small className="reminder-note off">
        {compact ? '🔕' : tr('Notificările sunt blocate în browser.', 'Notifications are blocked in this browser.')}
      </small>
    );
  return (
    <button
      type="button"
      className={`reminder-button${compact ? ' compact' : ''}`}
      title={once}
      aria-label={tr('Anunță-mă o dată când e gata', 'Remind me once when ready')}
      onClick={async () => setState((await addReminder({ id, at, title, body })) === 'set' ? 'set' : 'denied')}
    >
      🔔
      {!compact && (
        <>
          {' '}
          {label ? `${label} · ` : ''}
          {tr('Anunță-mă o dată când e gata', 'Remind me once when ready')}
        </>
      )}
    </button>
  );
}
