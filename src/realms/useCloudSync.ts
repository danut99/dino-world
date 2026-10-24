import { useEffect, useRef, useState } from 'react';
import type { Save } from './game';
import { fetchCloudSave, pushCloudSave, type CloudSave } from './cloud';

export type SyncStatus = 'local' | 'signedOut' | 'syncing' | 'synced' | 'offline';

/** Edits are gathered for a moment before one upload; hiding the page uploads at once. */
const PUSH_DELAY_MS = 2500;

/** One account, two saves: the one whose last action is more recent wins (`updatedAt` is stamped by every action). */
export const newerSave = (local: Save, remote: CloudSave) => (local.updatedAt >= remote.save.updatedAt ? 'local' : 'cloud');

/**
 * Writes the signed-in player's save to the cloud, which is the only place it is kept. `marker` is the cloud time
 * of the save the game started from (null when the account has no row yet).
 * The same account may be open in several places: coming back to this tab first takes in what was played
 * elsewhere, and if two places did save, the most recent progress wins (`replaced` reports when that was the
 * other one). Without `userId` (accounts not configured) it does nothing.
 */
export function useCloudSync(
  userId: string | null,
  marker: string | null,
  unsaved: boolean,
  save: Save,
  apply: (save: Save) => void,
  replaced?: () => void,
) {
  const [status, setStatus] = useState<SyncStatus>(userId ? (unsaved ? 'syncing' : 'synced') : 'local');
  const saveRef = useRef(save);
  saveRef.current = save;
  const markerRef = useRef(marker);
  const dirty = useRef(unsaved);
  const busy = useRef<Promise<void> | null>(null);
  const first = useRef(true);

  /** Takes the cloud copy into the game: this device's view was behind. */
  const adopt = (remote: CloudSave) => {
    markerRef.current = remote.updatedAt;
    dirty.current = false;
    apply(remote.save);
    replaced?.();
  };

  /** Runs one cloud job at a time; a job asked for while another runs waits for it. */
  const queue = (job: () => Promise<void>): Promise<void> => {
    const run = (busy.current ?? Promise.resolve()).then(job);
    const tracked = run.finally(() => {
      if (busy.current === tracked) busy.current = null;
    });
    busy.current = tracked;
    return tracked;
  };

  const push = () =>
    queue(async () => {
      if (!userId || !dirty.current) return;
      dirty.current = false;
      setStatus('syncing');
      try {
        // Two rounds at most: a refused write means another place saved first; settle it, then retry once.
        for (let round = 0; round < 2; round++) {
          const at = await pushCloudSave(userId, saveRef.current, markerRef.current);
          if (at) {
            markerRef.current = at;
            setStatus(dirty.current ? 'syncing' : 'synced');
            return;
          }
          const remote = await fetchCloudSave(userId);
          if (remote && newerSave(saveRef.current, remote) === 'cloud') {
            adopt(remote);
            setStatus('synced');
            return;
          }
          markerRef.current = remote?.updatedAt ?? null;
        }
        throw new Error('cloud kept changing');
      } catch {
        dirty.current = true;
        setStatus('offline');
      }
    });

  /** Back on this tab or device: take in progress made elsewhere before the player acts on an old view. */
  const pull = () =>
    queue(async () => {
      if (!userId || dirty.current) return;
      try {
        const remote = await fetchCloudSave(userId);
        if (remote && remote.updatedAt !== markerRef.current && newerSave(saveRef.current, remote) === 'cloud') adopt(remote);
        else if (remote) markerRef.current = remote.updatedAt;
      } catch {
        /* Offline: the next save retries. */
      }
    });

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
    const visibility = () => void (document.visibilityState === 'hidden' ? push() : dirty.current ? push() : pull());
    const online = () => void (dirty.current ? push() : pull());
    const leave = () => void push();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', online);
    window.addEventListener('focus', online);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', online);
      window.removeEventListener('pagehide', leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /** Uploads anything pending now (before signing out). */
  const flush = () => push();

  return { status, flush };
}
