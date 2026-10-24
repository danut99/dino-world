import { useEffect, useState } from 'react';
import RealmsApp, { Window } from './RealmsApp';
import { AccountPanel, NameForm, SyncConflictChoice } from './AccountPanel';
import { clearLegacySave, cloud, fetchCloudSave, fetchPlayerName, planSync, pushCloudSave, readLegacySave, type CloudSave } from './cloud';
import { newSave, type Save } from './game';
import { useAuth } from './useAuth';

const T = (lang: number, ro: string, en: string) => (lang ? en : ro);
const language = () => {
  try {
    return localStorage.getItem('dino-realms-language') === 'en' ? 1 : 0;
  } catch {
    return 0;
  }
};
const dropBootLoader = () => document.getElementById('boot-loader')?.remove();

type Start =
  | { phase: 'loading' }
  | { phase: 'error' }
  /** The account has no player name yet: it picks one before entering. */
  | { phase: 'name' }
  | { phase: 'conflict'; local: Save; remote: CloudSave }
  /** `owner`: the account this save belongs to, so a different account never starts from it. */
  | { phase: 'ready'; owner: string; name: string; save: Save; marker: string | null; unsaved: boolean };

/**
 * With accounts configured, nothing of the game shows until the player signs in; then their save is loaded from the
 * cloud, which is the only place it is kept. Progress this device kept locally before accounts existed moves into
 * the account once (or the player picks between the two), and is then removed from the device.
 * Without accounts configured (local development) the game runs as before.
 */
export default function SignInGate() {
  const auth = useAuth();
  const [lang] = useState(language);
  const [start, setStart] = useState<Start>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const userId = auth.user?.id;

  useEffect(() => {
    if (!userId || auth.recovering) return;
    let active = true;
    setStart({ phase: 'loading' });
    (async () => {
      const name = await fetchPlayerName(userId);
      if (!name) return { phase: 'name' } as const;
      const remote = await fetchCloudSave(userId);
      const legacy = readLegacySave();
      if (!legacy) return { phase: 'ready', owner: userId, name, save: remote?.save ?? newSave(Date.now()), marker: remote?.updatedAt ?? null, unsaved: !remote } as const;
      const plan = planSync(legacy, remote);
      if (plan === 'ask' && remote) return { phase: 'conflict', local: legacy, remote } as const;
      if (plan === 'download' && remote) {
        clearLegacySave();
        return { phase: 'ready', owner: userId, name, save: remote.save, marker: remote.updatedAt, unsaved: false } as const;
      }
      // The device's progress moves into the account; only once it is safely there does it leave the device.
      const at = await pushCloudSave(userId, legacy, remote?.updatedAt ?? null);
      if (!at) throw new Error('conflict');
      clearLegacySave();
      return { phase: 'ready', owner: userId, name, save: legacy, marker: at, unsaved: false } as const;
    })().then(
      (next) => active && setStart(next),
      () => active && setStart({ phase: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [userId, auth.recovering, attempt]);

  const choose = async (keep: 'local' | 'cloud') => {
    if (start.phase !== 'conflict' || !userId) return;
    const { local, remote } = start;
    const name = (await fetchPlayerName(userId).catch(() => null)) ?? '';
    setStart({ phase: 'loading' });
    try {
      if (keep === 'cloud') {
        clearLegacySave();
        setStart({ phase: 'ready', owner: userId, name, save: remote.save, marker: remote.updatedAt, unsaved: false });
        return;
      }
      const at = await pushCloudSave(userId, local, remote.updatedAt);
      if (!at) throw new Error('conflict');
      clearLegacySave();
      setStart({ phase: 'ready', owner: userId, name, save: local, marker: at, unsaved: false });
    } catch {
      setStart({ phase: 'error' });
    }
  };

  if (!cloud) return <RealmsApp />;
  const ready = auth.user && !auth.recovering && start.phase === 'ready' && start.owner === auth.user.id ? start : null;
  if (ready && auth.user)
    return (
      <RealmsApp
        key={auth.user.id}
        initialSave={ready.save}
        account={{ user: auth.user, name: ready.name, marker: ready.marker, unsaved: ready.unsaved, recovering: false, endRecovery: auth.endRecovery }}
      />
    );
  // Checking the session or loading the save: the boot screen from index.html stays up meanwhile.
  if (!auth.checked || (auth.user && !auth.recovering && (start.phase === 'loading' || start.phase === 'ready'))) return null;

  dropBootLoader();
  const screen = (title: string, body: React.ReactNode) => (
    <main className="realms-app realm-gate">
      <Window title={title} eyebrow="DINO REALMS" close={() => {}} closable={false} wide={start.phase === 'conflict'}>
        {body}
      </Window>
    </main>
  );
  if (auth.user && start.phase === 'name')
    return screen(
      tr('Cum te cheamă?', 'What is your name?'),
      <NameForm lang={lang} userId={auth.user.id} onDone={() => setAttempt((n) => n + 1)} />,
    );
  if (auth.user && start.phase === 'conflict')
    return screen(tr('Ce progres păstrezi?', 'Which progress do you keep?'), <SyncConflictChoice conflict={start} lang={lang} resolve={(keep) => void choose(keep)} />);
  if (auth.user && start.phase === 'error')
    return screen(
      tr('Nu ne-am putut conecta', 'We could not connect'),
      <div className="realm-auth">
        <p>{tr('Progresul tău e în cloud și nu l-am putut încărca. Verifică internetul și încearcă din nou.', 'Your progress is in the cloud and could not be loaded. Check your connection and try again.')}</p>
        <button className="realm-button" onClick={() => setAttempt((n) => n + 1)}>
          {tr('Încearcă din nou', 'Try again')}
        </button>
      </div>,
    );
  return screen(
    auth.recovering ? tr('Parolă nouă', 'New password') : tr('Bine ai venit în Dino Realms', 'Welcome to Dino Realms'),
    <AccountPanel lang={lang} sync={{ user: null, status: 'signedOut', recovering: auth.recovering && !!auth.user, endRecovery: auth.endRecovery }} />,
  );
}
