import { describe, expect, it, vi } from 'vitest';
import { newSave, type Save } from './game';
import { isFreshSave, planSync } from './cloud';

const fresh = () => newSave(0);
const played = (): Save => ({
  ...newSave(0),
  dinos: [
    { id: 'ignis', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' },
  ] as Save['dinos'],
  champion: 'ignis',
  team: ['ignis'],
});
const remote = (save: Save, updatedAt = '2026-10-24T10:00:00+00:00') => ({ save, updatedAt });

describe('cloud sync plan', () => {
  it('keeps the latest guest progress when upgrading the same anonymous account', () => {
    const latest = { ...played(), updatedAt: 2000 };
    const earlier = { ...played(), updatedAt: 1000 };
    expect(planSync(latest, remote(earlier), true)).toBe('upload');
    expect(planSync(earlier, remote(latest), true)).toBe('download');
    expect(planSync(latest, remote(latest), true)).toBe('download');
  });
  it('moves local progress into an account with no cloud save yet', () => {
    expect(planSync(played(), null)).toBe('upload');
  });
  it('takes the cloud save over local progress with nothing worth keeping', () => {
    expect(isFreshSave(fresh())).toBe(true);
    expect(planSync(fresh(), remote(played()))).toBe('download');
  });
  it('replaces an empty cloud save with real progress', () => {
    expect(planSync(played(), remote(fresh()))).toBe('upload');
  });
  it('keeps the progress an account already has over progress played here without an account', () => {
    const older = { ...played(), updatedAt: 1000 },
      newer = { ...played(), updatedAt: 2000 };
    expect(planSync(newer, remote(older))).toBe('download');
    expect(planSync(older, remote(newer))).toBe('download');
  });
});

describe('cloud key guard', () => {
  it('refuses secret keys and accepts publishable ones', async () => {
    const { isSecretKey } = await import('./cloud');
    const jwt = (role: string) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.y`;
    expect(isSecretKey('sb_secret_abc')).toBe(true);
    expect(isSecretKey(jwt('service_role'))).toBe(true);
    expect(isSecretKey('sb_publishable_abc')).toBe(false);
    expect(isSecretKey(jwt('anon'))).toBe(false);
  });
});

describe('player names', () => {
  it('accepts 3–20 letters, digits and simple separators, Romanian letters included', async () => {
    const { validName } = await import('./cloud');
    for (const ok of ['Ion', 'Dino_Rex 7', 'Ștefan-Țepeș', 'a.b.c']) expect(validName(ok), ok).toBe(true);
    for (const bad of ['Io', 'x'.repeat(21), ' Ion', '-Rex', 'Ion<3', 'a@b.ro'])
      expect(validName(bad), bad).toBe(false);
  });
});

describe('same account in two places', () => {
  it('on equal progress, the save whose last action came later wins', async () => {
    const { newerSave } = await import('./useCloudSync');
    const at = (updatedAt: number) => ({ ...played(), updatedAt });
    expect(newerSave(at(2000), remote(at(1000)))).toBe('local');
    expect(newerSave(at(1000), remote(at(2000)))).toBe('cloud');
  });
  it('more actions win over a device clock running ahead, and a stale tab never overwrites', async () => {
    const { newerSave } = await import('./useCloudSync');
    const save = (revision: number, updatedAt: number) => ({ ...played(), revision, updatedAt });
    // A fast clock with fewer actions loses.
    expect(newerSave(save(5, 9_000_000), remote(save(40, 1000)))).toBe('cloud');
    expect(newerSave(save(40, 1000), remote(save(5, 9_000_000)))).toBe('local');
    expect(planSync(save(5, 9_000_000), remote(save(40, 1000)), true)).toBe('download');
    expect(planSync(save(41, 1000), remote(save(40, 9_000_000)), true)).toBe('upload');
  });
});

describe('guest names', () => {
  it('are always valid player names, and vary', async () => {
    const { randomGuestName, validName } = await import('./cloud');
    const names = Array.from({ length: 500 }, () => randomGuestName());
    for (const n of names) expect(validName(n), n).toBe(true);
    expect(new Set(names).size).toBeGreaterThan(300);
    expect(randomGuestName(() => 0)).toBe('Raptor Curajos 100');
  });
});

describe('saves from before the v6 reset', () => {
  it('turn a cloud row into a new game that is uploaded over it', async () => {
    const old = { ...played(), schemaVersion: 5 };
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_KEY', 'sb_publishable_test');
    const row = { data: old as unknown, updated_at: '2026-10-24T10:00:00+00:00' };
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error: null }) };
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => query }) }));
    vi.resetModules();
    try {
      const { fetchCloudSave, planSync } = await import('./cloud');
      const { newerSave } = await import('./useCloudSync');
      const remote = (await fetchCloudSave('user'))!;
      expect(remote).toMatchObject({ outdated: true, updatedAt: row.updated_at });
      expect(remote.save).toMatchObject({ schemaVersion: 6, dinos: [] });
      // An outdated row never wins, whatever its time: the new game replaces it.
      expect(newerSave({ ...newSave(0), updatedAt: 0 }, remote)).toBe('local');
      expect(planSync(fresh(), remote)).toBe('upload');
      // A valid v6 row is read as usual; a broken one is still an error.
      row.data = played();
      expect(await fetchCloudSave('user')).toEqual({ save: played(), updatedAt: row.updated_at });
      row.data = { ...played(), gold: -1 };
      await expect(fetchCloudSave('user')).rejects.toThrow('Invalid save');
    } finally {
      vi.doUnmock('@supabase/supabase-js');
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe('a save the server guard refuses', () => {
  it('is reported as refused rather than as a conflict to retry', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_KEY', 'sb_publishable_test');
    let error: { code: string; message: string } | null = { code: '23514', message: 'gems rose too fast' };
    const query = {
      update: () => query,
      insert: () => query,
      eq: () => query,
      select: async () => ({ data: error ? null : [{ updated_at: 'now' }], error }),
    };
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => query }) }));
    vi.resetModules();
    try {
      const { pushCloudSave, SaveRejected } = await import('./cloud');
      await expect(pushCloudSave('user', played(), 'before')).rejects.toBeInstanceOf(SaveRejected);
      error = { code: '23505', message: 'duplicate' };
      expect(await pushCloudSave('user', played(), null)).toBeNull();
      error = null;
      expect(await pushCloudSave('user', played(), 'before')).toBe('now');
    } finally {
      vi.doUnmock('@supabase/supabase-js');
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
