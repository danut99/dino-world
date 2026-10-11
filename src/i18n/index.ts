import { useSyncExternalStore } from 'react';
import english from './en.json';

export type Language = 'en' | 'ro';
export const LANGUAGE_KEY = 'dino-world-language';
function readLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === 'ro' ? 'ro' : 'en';
  } catch {
    return 'en';
  }
}
let language = readLanguage();
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => (language === 'ro' ? 'ro-RO' : 'en-GB');
export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    /* Still switch when storage is unavailable. */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getLanguage,
    () => 'en' as const,
  );
}
const dictionary: Record<string, string> = english;
const lowercase = Object.fromEntries(
  Object.entries(dictionary)
    .filter(([key]) => !/\{\d+\}/.test(key))
    .map(([key, value]) => [key.toLocaleLowerCase('ro-RO'), value.toLocaleLowerCase('en-GB')]),
);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(dictionary)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => {
    const parts = key.split(/\{\d+\}/);
    return {
      pattern: new RegExp('^' + parts.map(escape).join('(.+?)') + '$', 's'),
      value,
      weight: parts.join('').length,
    };
  })
  .sort((a, b) => b.weight - a.weight);

function translate(text: string, depth = 0): string {
  if (language === 'ro' || !text.trim() || depth > 5) return text;
  const trimmed = text.trim();
  const replace = (translated: string) =>
    text.slice(0, text.indexOf(trimmed)) + translated + text.slice(text.indexOf(trimmed) + trimmed.length);
  const exact = dictionary[trimmed];
  if (exact !== undefined) return replace(exact);
  // Prefer a complete named message after its icon over broad resource templates,
  // e.g. “👉 Strânge primul aur” must not match “{0} aur”.
  const prefixed = trimmed.match(/^([^\p{L}]+)(\p{L}.*)$/u);
  if (prefixed && (dictionary[prefixed[2]] !== undefined || lowercase[prefixed[2]] !== undefined))
    return replace(prefixed[1] + translate(prefixed[2], depth + 1));
  if (/^\d{1,3}(?:\.\d{3})+$/.test(trimmed)) return replace(trimmed.replaceAll('.', ','));
  if (trimmed === trimmed.toLocaleLowerCase('ro-RO') && lowercase[trimmed] !== undefined)
    return replace(lowercase[trimmed]);
  for (const { pattern, value } of patterns) {
    const match = trimmed.match(pattern);
    if (match)
      return replace(value.replace(/\{(\d+)\}/g, (_, i: string) => translate(match[Number(i) + 1], depth + 1)));
  }
  // Messages can join independently localized reward/resource fragments.
  if (text.includes(' · '))
    return text
      .split(' · ')
      .map((part) => translate(part, depth + 1))
      .join(' · ');
  for (const separator of [', ', ' sau ']) {
    if (text.includes(separator))
      return text
        .split(separator)
        .map((part) => translate(part, depth + 1))
        .join(separator === ' sau ' ? ' or ' : separator);
  }
  // Icon and quantity prefixes are presentation, not part of the translated name.
  if (prefixed) return replace(prefixed[1] + translate(prefixed[2], depth + 1));
  return text;
}

/** Localize display values only. Objects, callbacks, IDs and game state stay intact. */
export function t<T>(value: T): T {
  if (typeof value === 'string') return translate(value) as T;
  if (Array.isArray(value)) return value.map((item) => t(item)) as T;
  return value;
}

if (typeof document !== 'undefined') document.documentElement.lang = language;
