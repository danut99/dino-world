import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SAVE_KEY, parseSave, type Save } from './game';

/**
 * Cloud saves and accounts (Supabase). Without VITE_SUPABASE_URL / VITE_SUPABASE_KEY the game simply stays
 * local-only: `cloud` is null and every caller checks for that. Setup steps: docs/SUPABASE.md.
 */
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_KEY;
/**
 * A secret key (sb_secret_…, or a legacy service_role JWT) bypasses row level security and would ship to every
 * player's browser, so it is refused outright.
 */
export function isSecretKey(k: string) {
  if (k.startsWith('sb_secret_')) return true;
  try {
    return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role';
  } catch {
    return false;
  }
}
const secret = !!key && isSecretKey(key);
if (secret) console.error('VITE_SUPABASE_KEY is a secret key. Use the publishable (anon) key; accounts stay off until then.');
export const cloud: SupabaseClient | null =
  url && key && !secret ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }) : null;

/** Back to the page the player is on, without the one-time `?code=` the sign-in left behind. */
const returnUrl = () => `${window.location.origin}${window.location.pathname}`;

/** Supabase's error messages, reduced to the few cases the account window explains in the player's language. */
export type AuthProblem = 'credentials' | 'unconfirmed' | 'exists' | 'weak' | 'rate' | 'network' | 'other';
function problem(error: { message?: string; status?: number; code?: string } | null): AuthProblem | null {
  if (!error) return null;
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (text.includes('invalid login') || text.includes('invalid_credentials')) return 'credentials';
  if (text.includes('not confirmed') || text.includes('email_not_confirmed')) return 'unconfirmed';
  if (text.includes('already registered') || text.includes('user_already_exists')) return 'exists';
  if (text.includes('password') && (text.includes('weak') || text.includes('at least'))) return 'weak';
  if (error.status === 429 || text.includes('rate limit')) return 'rate';
  if (text.includes('fetch') || text.includes('network')) return 'network';
  return 'other';
}

export async function signIn(email: string, password: string) {
  if (!cloud) return 'other';
  const { error } = await cloud.auth.signInWithPassword({ email, password });
  return problem(error);
}
/** Creates the account. With e-mail confirmation on (Supabase's default), `confirm` is true until the link is opened. */
export async function signUp(email: string, password: string) {
  if (!cloud) return { problem: 'other' as AuthProblem, confirm: false };
  const { data, error } = await cloud.auth.signUp({ email, password, options: { emailRedirectTo: returnUrl() } });
  return { problem: problem(error), confirm: !error && !data.session };
}
export async function signInWithGoogle() {
  if (!cloud) return 'other';
  const { error } = await cloud.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl() } });
  return problem(error);
}
export async function sendPasswordReset(email: string) {
  if (!cloud) return 'other';
  const { error } = await cloud.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() });
  return problem(error);
}
export async function setNewPassword(password: string) {
  if (!cloud) return 'other';
  const { error } = await cloud.auth.updateUser({ password });
  return problem(error);
}
export async function signOut() {
  await cloud?.auth.signOut();
}

/** The cloud copy of a player's save, with the server time of its last write. */
export type CloudSave = { save: Save; updatedAt: string };

export async function fetchCloudSave(userId: string): Promise<CloudSave | null> {
  if (!cloud) return null;
  const { data, error } = await cloud.from('saves').select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  // The cloud copy passes through the same validation and migrations as a local or imported save.
  return data ? { save: parseSave(JSON.stringify(data.data)), updatedAt: data.updated_at } : null;
}

/**
 * Writes the save. With `expected` (the cloud time this device last saw), the write only lands if no other device
 * wrote since; otherwise it returns null so the caller can ask the player which progress to keep.
 */
export async function pushCloudSave(userId: string, save: Save, expected: string | null): Promise<string | null> {
  if (!cloud) return null;
  const row = { user_id: userId, data: save, schema_version: save.schemaVersion };
  const query = expected
    ? cloud.from('saves').update(row).eq('user_id', userId).eq('updated_at', expected)
    : cloud.from('saves').insert(row);
  const { data, error } = await query.select('updated_at');
  if (error) {
    // Another device created the row first: the same conflict as an outdated update.
    if (error.code === '23505') return null;
    throw error;
  }
  return data?.[0]?.updated_at ?? null;
}

/**
 * Progress kept on this device before accounts existed. It is read once, at the first sign-in, so it can move into
 * the account; after that the save lives only in the cloud.
 */
export function readLegacySave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? parseSave(raw) : null;
  } catch {
    return null;
  }
}
export function clearLegacySave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* Nothing stored. */
  }
}

/** A save with nothing the player could miss: no dinosaur raised, no fight won. */
export const isFreshSave = (s: Save) => s.dinos.length === 0 && s.cleared.length === 0;

/**
 * What to do when a device's older local progress meets the account's cloud save at sign-in:
 * - `upload`: the account has no save yet (or an empty one), or the local progress is the more recent;
 * - `download`: the local progress is nothing worth keeping, or the cloud's is the more recent.
 * Between two real saves the one whose last action came later wins, as during play (see useCloudSync).
 */
export function planSync(local: Save, remote: CloudSave | null): 'upload' | 'download' {
  if (!remote) return 'upload';
  if (isFreshSave(local)) return 'download';
  if (isFreshSave(remote.save)) return 'upload';
  return local.updatedAt >= remote.save.updatedAt ? 'upload' : 'download';
}

/** A public player name: 3–20 letters (Romanian included), digits, spaces, `_`, `.` or `-`, starting with a letter or digit. */
export const NAME_PATTERN = /^[A-Za-z0-9ĂÂÎȘȚŞŢăâîșțşţ][A-Za-z0-9ĂÂÎȘȚŞŢăâîșțşţ _.-]*$/;
export const validName = (name: string) => name.length >= 3 && name.length <= 20 && NAME_PATTERN.test(name);
export type NameProblem = 'invalid' | 'taken' | 'network';

/** The player's public name; null when the account has not chosen one yet. */
export async function fetchPlayerName(userId: string): Promise<string | null> {
  if (!cloud) return null;
  const { data, error } = await cloud.from('profiles').select('name').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.name ?? null;
}
/** Picks (`create`) or changes the player's public name. */
export async function savePlayerName(userId: string, raw: string, create: boolean): Promise<NameProblem | null> {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!validName(name)) return 'invalid';
  if (!cloud) return 'network';
  const { error } = create
    ? await cloud.from('profiles').insert({ user_id: userId, name })
    : await cloud.from('profiles').update({ name }).eq('user_id', userId);
  if (!error) return null;
  if (error.code === '23505') return 'taken';
  if (error.code === '23514') return 'invalid';
  return 'network';
}

/** One row of the player list: a name and a summary of their world. */
export type PlayerSummary = {
  user_id: string;
  name: string;
  updated_at: string | null;
  dinos: number;
  stars: number;
  worlds: number;
  species: string | null;
  element: string | null;
  stage: string | null;
  level: number;
};
/** The most recently active players, optionally those whose name contains `search`. */
export async function listPlayers(search = ''): Promise<PlayerSummary[]> {
  if (!cloud) return [];
  let query = cloud.from('players').select('*');
  // `%` and `_` are wildcards in LIKE: a player searching for them means the characters themselves.
  const q = search.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
  if (q) query = query.ilike('name', `%${q}%`);
  const { data, error } = await query.order('updated_at', { ascending: false, nullsFirst: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as PlayerSummary[];
}
