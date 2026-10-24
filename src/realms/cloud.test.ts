import { describe, expect, it } from 'vitest';
import { newSave, type Save } from './game';
import { isFreshSave, planSync } from './cloud';

const fresh = () => newSave(0);
const played = (): Save => ({
  ...newSave(0),
  dinos: [{ id: 'ignis', species: 'trex', element: 'fire', level: 5, stage: 'juvenile', nickname: 'Ignis' }] as Save['dinos'],
});
const remote = (save: Save, updatedAt = '2026-10-24T10:00:00+00:00') => ({ save, updatedAt });

describe('cloud sync plan', () => {
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
  it('keeps the more recent progress when both the device and the account hold some', () => {
    const older = { ...played(), updatedAt: 1000 }, newer = { ...played(), updatedAt: 2000 };
    expect(planSync(newer, remote(older))).toBe('upload');
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
    for (const bad of ['Io', 'x'.repeat(21), ' Ion', '-Rex', 'Ion<3', 'a@b.ro']) expect(validName(bad), bad).toBe(false);
  });
});

describe('same account in two places', () => {
  it('the save whose last action came later wins', async () => {
    const { newerSave } = await import('./useCloudSync');
    const at = (updatedAt: number) => ({ ...played(), updatedAt });
    expect(newerSave(at(2000), remote(at(1000)))).toBe('local');
    expect(newerSave(at(1000), remote(at(2000)))).toBe('cloud');
  });
});
