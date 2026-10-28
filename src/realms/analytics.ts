/** Umami (index.html) custom events: where new players get to, and whether they come back. No-op without it. */
export function track(event: string, data?: Record<string, string | number>) {
  try {
    (window as { umami?: { track: (e: string, d?: object) => void } }).umami?.track(event, data);
  } catch {
    /* Analytics never breaks the game. */
  }
}

/** Once per player and day after their first: `return` with how many days since they started. */
export function trackReturn(userId: string, today: string) {
  try {
    const key = `dino-realms-first-day-${userId}`,
      first = localStorage.getItem(key);
    if (!first) return localStorage.setItem(key, today);
    const seen = `dino-realms-return-${userId}`;
    if (first === today || localStorage.getItem(seen) === today) return;
    localStorage.setItem(seen, today);
    track('return', { days: Math.round((Date.parse(today) - Date.parse(first)) / 86_400_000) });
  } catch {
    /* Without storage nothing is counted. */
  }
}
