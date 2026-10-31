/**
 * "Tell me when it is ready": one browser notification for one timer the player chose (a crop, an egg, a trip).
 * Asked only from that button, never up front. It is a local timer, so it fires while the game is still open in a
 * tab (in the background); with the game in view, the in-game "Ready!" notice says it instead.
 */
export type Reminder = { id: string; at: number; title: string; body: string };

const KEY = 'dino-realms-reminders';
const timers = new Map<string, number>();

const read = (): Reminder[] => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string' && typeof r.at === 'number') : [];
  } catch {
    return [];
  }
};
const write = (list: Reminder[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* Only this visit then. */
  }
};

export const remindersSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
export const reminderSet = (id: string) => read().some((r) => r.id === id);

const register = () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);

async function fire(r: Reminder) {
  timers.delete(r.id);
  write(read().filter((x) => x.id !== r.id));
  if (!document.hidden || Notification.permission !== 'granted') return;
  const options = { body: r.body, icon: `${import.meta.env.BASE_URL}favicon.svg`, tag: r.id };
  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  if (registration) await registration.showNotification(r.title, options).catch(() => undefined);
  else
    try {
      new Notification(r.title, options);
    } catch {
      /* Phones only show notifications through the service worker. */
    }
}

function schedule(r: Reminder) {
  window.clearTimeout(timers.get(r.id));
  const wait = r.at - Date.now();
  // Browsers cap timers at about 24.8 days.
  if (wait > 2_147_000_000) return;
  timers.set(
    r.id,
    window.setTimeout(() => void fire(r), Math.max(0, wait)),
  );
}

/** At start: drops reminders already past and sets the timers of the others again. */
export function restoreReminders() {
  if (!remindersSupported()) return;
  const list = read().filter((r) => r.at > Date.now());
  write(list);
  if (!list.length || Notification.permission !== 'granted') return;
  void register();
  list.forEach(schedule);
}

export async function addReminder(r: Reminder): Promise<'set' | 'denied' | 'unsupported'> {
  if (!remindersSupported()) return 'unsupported';
  const permission =
    Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return 'denied';
  await register();
  write([...read().filter((x) => x.id !== r.id), r]);
  schedule(r);
  return 'set';
}
