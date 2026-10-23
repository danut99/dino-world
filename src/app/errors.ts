// Erorile jocului: ultimele câteva se țin în browser, ca jucătorul să le poată trimite într-un raport
// (ecranul „Ceva n-a mers”). Nimic nu pleacă singur din browser.

import { SAVE_KEY } from '../realms/game';

const LOG_KEY = 'dino-world:errors';
const MAX = 15;

export interface LoggedError {
  at: string;
  message: string;
  stack?: string;
}

export function readErrors(): LoggedError[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as LoggedError[];
  } catch {
    return [];
  }
}

export function logError(error: unknown, extra?: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  const entry: LoggedError = {
    at: new Date().toISOString(),
    message: e.message,
    stack: [e.stack, extra].filter(Boolean).join('\n').split('\n').slice(0, 12).join('\n'),
  };
  try {
    const list = readErrors();
    // aceeași eroare repetată (ex. la fiecare cadru) ocupă un singur loc
    if (list.at(-1)?.message === entry.message) list.pop();
    localStorage.setItem(LOG_KEY, JSON.stringify([...list, entry].slice(-MAX)));
  } catch {
    // fără stocare: raportul va avea doar ce scrie jucătorul
  }
}

/** Erorile din afara React (evenimente, promisiuni, cod încărcat la cerere). */
export function watchErrors() {
  window.addEventListener('error', (e) => logError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => logError(e.reason));
}

/** Salvarea din browser, ca text (null = nu există). Citită direct, merge și când interfața a căzut. */
export function savedGame(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function downloadSave(): boolean {
  const text = savedGame();
  if (!text) return false;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `dino-realms-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Raportul: ce a scris jucătorul, dispozitivul și ultimele erori. Fără salvarea întreagă (e mare). */
export function buildReport(note: string): string {
  let summary = 'no save';
  try {
    const s = JSON.parse(savedGame() ?? 'null');
    if (s) summary = `${s.dinos?.length ?? 0} dinosaurs · ${Object.keys(s.habitats ?? {}).length} worlds · level ${s.arenaLevel ?? 1} arena`;
  } catch {
    summary = 'unreadable save';
  }
  const errors = readErrors();
  return [
    note.trim() || '(no description)',
    '',
    '---',
    `Version: ${__APP_VERSION__}`,
    `Date: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `Screen: ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    `Game: ${summary}`,
    '',
    errors.length ? `Recent errors (${errors.length}):` : 'Recent errors: none',
    ...errors.map((e) => `[${e.at}] ${e.message}\n${e.stack ?? ''}`),
  ].join('\n');
}

/**
 * Unde pleacă raportul: VITE_REPORT_EMAIL (se deschide aplicația de e-mail) sau VITE_REPORT_URL (un formular),
 * din .env. Fără ele, raportul doar se copiază, iar jucătorul îl trimite cum vrea.
 */
export const REPORT_EMAIL = import.meta.env.VITE_REPORT_EMAIL as string | undefined;
export const REPORT_URL = import.meta.env.VITE_REPORT_URL as string | undefined;

/** Trimite (sau copiază) raportul; întoarce ce s-a întâmplat, pentru mesajul afișat. */
export async function sendReport(note: string): Promise<'mail' | 'form' | 'copied' | 'failed'> {
  const text = buildReport(note);
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    // fără clipboard: e-mailul sau formularul primesc textul oricum
  }
  if (REPORT_EMAIL) {
    // linkurile mailto lungi sunt tăiate de unele aplicații: corpul are cel mult ~1800 de caractere
    const body = encodeURIComponent(text.slice(0, 1800));
    window.location.href = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent('Dino Realms · problem report')}&body=${body}`;
    return 'mail';
  }
  if (REPORT_URL) {
    window.open(REPORT_URL, '_blank', 'noopener');
    return 'form';
  }
  return copied ? 'copied' : 'failed';
}
