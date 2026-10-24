import { useEffect, useRef, useState } from 'react';
import type { Save } from './game';
import { fetchCloudSave, pushCloudSave, type CloudSave } from './cloud';

export type SyncStatus = 'local' | 'signedOut' | 'syncing' | 'synced' | 'offline';
export type SyncConflict = { local: Save; remote: CloudSave };

/** Edits are gathered for a moment before one upload; hiding the page uploads at once. */
const PUSH_DELAY_MS = 2500;

/**
 * Writes the signed-in player's save to the cloud, which is the only place it is kept. `marker` is the cloud time
 * of the save the game started from (null when the account has no row yet). A write another device made in the
 * meantime is never overwritten silently: it becomes a conflict for the player to settle.
 * Without `userId` (accounts not configured) it does nothing.
 */
export function useCloudSync(userId: string | null, marker: string | null, unsaved: boolean, save: Save, apply: (save: Save) => void) {
  const [status, setStatus] = useState<SyncStatus>(userId ? (unsaved ? 'syncing' : 'synced') : 'local');
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const markerRef = useRef(marker);
  const dirty = useRef(unsaved);
  const pushing = useRef<Promise<void> | null>(null);
  const paused = useRef(false);
  const first = useRef(true);

  const push = (): Promise<void> => {
    if (!userId || paused.current) return Promise.resolve();
    if (pushing.current) return pushing.current.then(() => (dirty.current ? push() : undefined));
    dirty.current = false;
    setStatus('syncing');
    const job = (async () => {
      try {
        const at = await pushCloudSave(userId, saveRef.current, markerRef.current);
        if (at) {
          markerRef.current = at;
          setStatus(dirty.current ? 'syncing' : 'synced');
          return;
        }
        // Another device saved first: stop writing until the player chooses.
        const remote = await fetchCloudSave(userId);
        if (remote) {
          paused.current = true;
          setConflict({ local: saveRef.current, remote });
        }
        setStatus('synced');
      } catch {
        dirty.current = true;
        setStatus('offline');
      } finally {
        pushing.current = null;
      }
    })();
    pushing.current = job;
    return job;
  };

  // Upload after changes once they settle (and right away when the game starts from progress the cloud lacks).
  useEffect(() => {
    if (!userId) return;
    if (first.current) {
      first.current = false;
      if (unsaved) void push();
      return;
    }
    dirty.current = true;
    const id = window.setTimeout(() => void push(), PUSH_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save]);
  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      if (dirty.current) void push();
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('online', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('online', flush);
      window.removeEventListener('pagehide', flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /** The player's answer to a conflict: keep this device's progress, or take the cloud's. */
  const resolve = (keep: 'local' | 'cloud') => {
    if (!conflict) return;
    markerRef.current = conflict.remote.updatedAt;
    paused.current = false;
    setConflict(null);
    if (keep === 'cloud') apply(conflict.remote.save);
    else void push();
  };

  /** Uploads anything pending now (before signing out). */
  const flush = () => (dirty.current ? push() : (pushing.current ?? Promise.resolve()));

  return { status, conflict, resolve, flush };
}
