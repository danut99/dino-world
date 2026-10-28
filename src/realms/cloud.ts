import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { OutdatedSave, SAVE_KEY, newSave, parseSave, type Save } from './game';

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
if (secret)
  console.error('VITE_SUPABASE_KEY is a secret key. Use the publishable (anon) key; accounts stay off until then.');
export const cloud: SupabaseClient | null =
  url && key && !secret
    ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } })
    : null;

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

/**
 * The cloud copy of a player's save, with the server time of its last write. `outdated`: the row holds a save from
 * before the current schema, so `save` is a new game that should replace it.
 */
export type CloudSave = { save: Save; updatedAt: string; outdated?: true };

export async function fetchCloudSave(userId: string): Promise<CloudSave | null> {
  if (!cloud) return null;
  const { data, error } = await cloud.from('saves').select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // The cloud copy passes through the same validation as a local or imported save. A save from an older schema
  // is not migrated: everyone starts over (see OutdatedSave).
  try {
    return { save: parseSave(JSON.stringify(data.data)), updatedAt: data.updated_at };
  } catch (e) {
    if (e instanceof OutdatedSave) return { save: newSave(Date.now()), updatedAt: data.updated_at, outdated: true };
    throw e;
  }
}

export class SaveRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveRejected';
  }
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
    // The server guard (0004_save_guard.sql) refused the save itself: retrying the same data cannot succeed.
    if (error.code === '23514' || error.code === 'P0001') throw new SaveRejected(error.message);
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

/**
 * A copy of an account's save on this device, so an upload that never made it (offline, tab closed) is not lost
 * and the game can still open without a connection.
 */
const backupKey = (userId: string) => `${SAVE_KEY}-backup-${userId}`;
export function writeBackup(userId: string, save: Save, name: string) {
  try {
    localStorage.setItem(backupKey(userId), JSON.stringify({ name, save }));
  } catch {
    /* Optional copy. */
  }
}
export function readBackup(userId: string): { name: string; save: Save } | null {
  try {
    const raw = localStorage.getItem(backupKey(userId));
    if (!raw) return null;
    const kept = JSON.parse(raw) as { name?: unknown; save?: unknown };
    return { name: typeof kept.name === 'string' ? kept.name : '', save: parseSave(JSON.stringify(kept.save)) };
  } catch {
    return null;
  }
}

/**
 * Which of two saves of one account holds more progress (> 0: `a`). Every command adds one to `revision`, so the
 * save with more actions wins whatever the devices' clocks say; `updatedAt` (a device's clock) only breaks a tie.
 */
export const compareProgress = (a: Save, b: Save) => a.revision - b.revision || a.updatedAt - b.updatedAt;

/** A save with nothing the player could miss: no dinosaur raised, no fight won. */
export const isFreshSave = (s: Save) => s.dinos.length === 0 && s.cleared.length === 0;

/**
 * What to do with progress played on this device without an account when the player signs in:
 * - `upload`: the account has no save yet (or an empty one), so the guest progress becomes the account's;
 * - `download`: the account already has progress of its own, which is kept (a few guest minutes must never
 *   replace it), or the guest progress is nothing worth keeping.
 */
export function planSync(local: Save, remote: CloudSave | null, sameAccount = false): 'upload' | 'download' {
  if (!remote || remote.outdated) return 'upload';
  if (sameAccount) return compareProgress(local, remote.save) > 0 ? 'upload' : 'download';
  if (isFreshSave(local)) return 'download';
  return isFreshSave(remote.save) ? 'upload' : 'download';
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

/** What the leaderboard ranks by: dinosaurs owned, the champion's level, or arena stars. */
export type RankBy = 'dinos' | 'level' | 'stars';
export type Leaderboard = { top: PlayerSummary[]; self: PlayerSummary | null; selfRank: number | null };
/** The best players by `by`, and this player's own place when it falls outside the top. */
export async function listLeaderboard(by: RankBy, selfId: string, limit = 20): Promise<Leaderboard> {
  if (!cloud) return { top: [], self: null, selfRank: null };
  const { data, error } = await cloud
    .from('players')
    .select('*')
    .not('updated_at', 'is', null)
    .order(by, { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const top = (data ?? []) as PlayerSummary[];
  if (top.some((p) => p.user_id === selfId)) return { top, self: null, selfRank: null };
  const mine = await cloud.from('players').select('*').eq('user_id', selfId).maybeSingle();
  const self = (mine.data ?? null) as PlayerSummary | null;
  if (mine.error || !self || !self.updated_at) return { top, self: null, selfRank: null };
  const ahead = await cloud
    .from('players')
    .select('user_id', { count: 'exact', head: true })
    .not('updated_at', 'is', null)
    .gt(by, self[by]);
  return { top, self, selfRank: ahead.error ? null : (ahead.count ?? 0) + 1 };
}

/** A friendship seen from this player's side: `incoming` = they asked and wait for an answer from us. */
export type Friend = {
  user_id: string;
  name: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
  acceptHelp: boolean;
};
export async function listFriends(selfId: string): Promise<Friend[]> {
  if (!cloud) return [];
  const { data, error } = await cloud.from('friendships').select('requester, addressee, status');
  if (error) throw error;
  const rows = (data ?? []) as { requester: string; addressee: string; status: Friend['status'] }[];
  if (!rows.length) return [];
  const other = (r: (typeof rows)[number]) => (r.requester === selfId ? r.addressee : r.requester);
  const { data: people, error: e2 } = await cloud
    .from('profiles')
    .select('user_id, name, accept_help')
    .in('user_id', rows.map(other));
  if (e2) throw e2;
  const byId = new Map((people ?? []).map((p) => [p.user_id as string, p]));
  return rows
    .map((r) => {
      const p = byId.get(other(r));
      return {
        user_id: other(r),
        name: p?.name ?? '?',
        status: r.status,
        incoming: r.addressee === selfId,
        acceptHelp: !!p?.accept_help,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
export async function requestFriend(selfId: string, otherId: string) {
  if (!cloud) return;
  const { error } = await cloud.from('friendships').insert({ requester: selfId, addressee: otherId });
  // Already asked (by either side): nothing more to do.
  if (error && error.code !== '23505') throw error;
}
export async function acceptFriend(selfId: string, otherId: string) {
  if (!cloud) return;
  const { error } = await cloud
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('requester', otherId)
    .eq('addressee', selfId);
  if (error) throw error;
}
/** Refuses a request, cancels one sent, or ends a friendship. */
export async function removeFriend(selfId: string, otherId: string) {
  if (!cloud) return;
  const { error } = await cloud
    .from('friendships')
    .delete()
    .or(`and(requester.eq.${selfId},addressee.eq.${otherId}),and(requester.eq.${otherId},addressee.eq.${selfId})`);
  if (error) throw error;
}

export async function fetchAcceptHelp(userId: string) {
  if (!cloud) return false;
  const { data, error } = await cloud.from('profiles').select('accept_help').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data?.accept_help;
}
export async function saveAcceptHelp(userId: string, on: boolean) {
  if (!cloud) return;
  const { error } = await cloud.from('profiles').update({ accept_help: on }).eq('user_id', userId);
  if (error) throw error;
}

export type HelpProblem = 'not_friends' | 'help_off' | 'too_soon' | 'network';
/** Collects a friend's habitat gold for them (applied by their game when it next loads). */
export async function helpFriend(ownerId: string): Promise<HelpProblem | null> {
  if (!cloud) return 'network';
  const { data, error } = await cloud.rpc('help_friend', { target: ownerId });
  if (error) return 'network';
  return (data as HelpProblem | null) ?? null;
}

/** Friends' collects waiting for this player's game: when (ms) and who. */
export async function fetchFriendHelps(selfId: string) {
  if (!cloud) return [];
  const { data, error } = await cloud
    .from('friend_helps')
    .select('id, helper_id, created_at')
    .eq('owner_id', selfId)
    .order('created_at');
  if (error) throw error;
  const rows = (data ?? []) as { id: number; helper_id: string; created_at: string }[];
  if (!rows.length) return [];
  const { data: people } = await cloud
    .from('profiles')
    .select('user_id, name')
    .in('user_id', [...new Set(rows.map((r) => r.helper_id))]);
  const names = new Map((people ?? []).map((p) => [p.user_id as string, p.name as string]));
  return rows.map((r) => ({ id: r.id, at: new Date(r.created_at).getTime(), name: names.get(r.helper_id) ?? '?' }));
}
export async function clearFriendHelps(ids: number[]) {
  if (!cloud || !ids.length) return;
  const { error } = await cloud.from('friend_helps').delete().in('id', ids);
  if (error) throw error;
}

export type FightResult = 'victory' | 'defeat' | 'draw';
/** Whether record_duel (0011) would refuse a duel against `rivalId` now, and how long until it would not. */
export async function duelBlock(
  selfId: string,
  rivalId: string,
): Promise<{ code: 'too_soon'; wait: number } | { code: 'daily_limit'; wait: string } | null> {
  if (!cloud) return null;
  const now = Date.now(),
    day = 86_400_000;
  const { data, error } = await cloud
    .from('friend_battles')
    .select('defender, created_at')
    .eq('attacker', selfId)
    .gt('created_at', new Date(now - day).toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = ((data ?? []) as { defender: string; created_at: string }[]).map((r) => ({
    rival: r.defender,
    at: new Date(r.created_at).getTime(),
  }));
  const last = rows[0]?.at ?? 0;
  if (now - last < 60_000) return { code: 'too_soon', wait: Math.ceil((60_000 - (now - last)) / 1000) };
  const against = rows.filter((r) => r.rival === rivalId);
  if (against.length >= 3) {
    const minutes = Math.ceil((against[2].at + day - now) / 60_000);
    return { code: 'daily_limit', wait: minutes >= 60 ? `${Math.ceil(minutes / 60)}h` : `${minutes} min` };
  }
  return null;
}
/** Records a duel this player started against `otherId` (see record_duel, 0010). Throws with the refusal code. */
export async function recordFriendBattle(_selfId: string, otherId: string, result: FightResult) {
  if (!cloud) return;
  const { data, error } = await cloud.rpc('record_duel', { rival: otherId, outcome: result });
  if (error) throw error;
  if (data) throw new Error(data as string);
}
/** Friend requests waiting for this player's answer, and friendly fights friends started against them after `since`. */
export async function fetchFriendNews(selfId: string, since: string) {
  if (!cloud) return { requests: [], battles: [] as Defense[] };
  const [asked, battles] = await Promise.all([
    cloud.from('friendships').select('requester').eq('addressee', selfId).eq('status', 'pending'),
    fetchDefenses(selfId, since),
  ]);
  if (asked.error) throw asked.error;
  const requests = (asked.data ?? []) as { requester: string }[];
  const ids = [...new Set(requests.map((r) => r.requester))];
  const { data: people } = ids.length
    ? await cloud.from('profiles').select('user_id, name').in('user_id', ids)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.user_id as string, p.name as string]));
  return { requests: requests.map((r) => ({ id: r.requester, name: names.get(r.requester) ?? '?' })), battles };
}
/** A friendly fight a friend started against this player; `result` is the attacker's. */
export type Defense = { attackerId: string; attackerName: string; result: FightResult; at: string };
/** Friendly fights against this player after `since` (ISO time), oldest first. */
export async function fetchDefenses(selfId: string, since: string): Promise<Defense[]> {
  if (!cloud) return [];
  const { data, error } = await cloud
    .from('friend_battles')
    .select('attacker, result, created_at')
    .eq('defender', selfId)
    .gt('created_at', since)
    .order('created_at');
  if (error) throw error;
  const rows = (data ?? []) as { attacker: string; result: FightResult; created_at: string }[];
  if (!rows.length) return [];
  const { data: people } = await cloud
    .from('profiles')
    .select('user_id, name')
    .in('user_id', [...new Set(rows.map((r) => r.attacker))]);
  const names = new Map((people ?? []).map((p) => [p.user_id as string, p.name as string]));
  return rows.map((r) => ({
    attackerId: r.attacker,
    attackerName: names.get(r.attacker) ?? '?',
    result: r.result,
    at: r.created_at,
  }));
}
/** Friendly-fight wins since `since` for this player and their accepted friends, best first. */
export type RankRow = { userId: string; name: string; wins: number };
export async function fetchWeeklyRanking(since: Date): Promise<RankRow[]> {
  if (!cloud) return [];
  const { data, error } = await cloud.rpc('weekly_ranking', { since: since.toISOString() });
  if (error) throw error;
  return ((data ?? []) as { user_id: string; name: string; wins: number }[])
    .map((r) => ({ userId: r.user_id, name: r.name, wins: Number(r.wins) }))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}
/** Duel wins between `since` and `until` among players whose champion level is in [min, max] (0012). */
export async function fetchLeagueRanking(
  since: Date,
  until: Date,
  league: { min: number; max: number },
  /** Without 0012, fall back to the plain weekly ranking (fine to show, wrong for a past week). */
  fallback = true,
): Promise<RankRow[]> {
  if (!cloud) return [];
  const { data, error } = await cloud.rpc('league_ranking', {
    since: since.toISOString(),
    until: until.toISOString(),
    min_level: league.min,
    max_level: league.max,
  });
  // Before 0012 is applied: the plain weekly ranking of everyone.
  if (error?.code === 'PGRST202' && fallback) return fetchWeeklyRanking(since);
  if (error) throw error;
  return ((data ?? []) as { user_id: string; name: string; wins: number }[])
    .map((r) => ({ userId: r.user_id, name: r.name, wins: Number(r.wins) }))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}
/** Wins, losses and draws against each friend, counting fights started by either side. */
export type Score = { wins: number; losses: number; draws: number };
export async function fetchFriendScores(selfId: string): Promise<Map<string, Score>> {
  const scores = new Map<string, Score>();
  if (!cloud) return scores;
  const { data, error } = await cloud.from('friend_battles').select('attacker, defender, result');
  if (error) throw error;
  for (const r of (data ?? []) as { attacker: string; defender: string; result: FightResult }[]) {
    const mine = r.attacker === selfId,
      other = mine ? r.defender : r.attacker,
      score = scores.get(other) ?? { wins: 0, losses: 0, draws: 0 };
    if (r.result === 'draw') score.draws++;
    else if ((r.result === 'victory') === mine) score.wins++;
    else score.losses++;
    scores.set(other, score);
  }
  return scores;
}

const GUEST_NOUNS = ['Raptor', 'Rex', 'Tricera', 'Bronto', 'Stego', 'Ptero', 'Dino', 'Anky'];
const GUEST_ADJECTIVES = ['Curajos', 'Iute', 'Vesel', 'Isteț', 'Fioros', 'Zglobiu', 'Voinic', 'Sprinten'];
/** A random guest name such as "Raptor Curajos 482": always a valid player name (see validName). */
export function randomGuestName(random = Math.random) {
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  return `${pick(GUEST_NOUNS)} ${pick(GUEST_ADJECTIVES)} ${100 + Math.floor(random() * 900)}`;
}
/** The guest's name on this device, made up on first use. */
export function guestName() {
  try {
    const kept = localStorage.getItem('dino-realms-guest-name');
    if (kept && validName(kept)) return kept;
    const made = randomGuestName();
    localStorage.setItem('dino-realms-guest-name', made);
    return made;
  } catch {
    return randomGuestName();
  }
}

/**
 * Starts an anonymous account, so a newcomer's progress is in the cloud from the first second. False when refused
 * (anonymous sign-ins off in Supabase, the hourly limit, offline): the game then keeps the save on the device.
 */
export async function startAnonymous() {
  if (!cloud) return false;
  const { error } = await cloud.auth.signInAnonymously();
  return !error;
}
const PENDING_PASSWORD = 'dino-realms-pending-password';
/** An anonymous account linked an e-mail and still has to choose its password once the e-mail is confirmed. */
export function pendingPassword() {
  try {
    return localStorage.getItem(PENDING_PASSWORD) === 'yes';
  } catch {
    return false;
  }
}
export function clearPendingPassword() {
  try {
    localStorage.removeItem(PENDING_PASSWORD);
  } catch {
    /* Nothing stored. */
  }
}
/**
 * Turns the anonymous account into a permanent one, keeping its id and so its progress. Supabase takes the e-mail
 * first and the password only once the e-mail is confirmed: `confirm` means the player must open the e-mail link,
 * after which the game asks for the password.
 */
export async function linkEmail(
  email: string,
  password: string,
): Promise<{ problem: AuthProblem | null; confirm: boolean }> {
  if (!cloud) return { problem: 'other', confirm: false };
  const first = await cloud.auth.updateUser({ email }, { emailRedirectTo: returnUrl() });
  if (first.error) return { problem: problem(first.error), confirm: false };
  const second = await cloud.auth.updateUser({ password });
  if (!second.error) return { problem: null, confirm: false };
  try {
    localStorage.setItem(PENDING_PASSWORD, 'yes');
  } catch {
    /* The player can still set a password through "forgot password". */
  }
  return { problem: null, confirm: true };
}
