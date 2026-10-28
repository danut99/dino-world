import { useEffect, useState } from 'react';
import RealmsApp, { Window } from './RealmsApp';
import World from './World';
import { Landing } from './Landing';
import { AccountPanel, NameForm } from './AccountPanel';
import {
  clearPendingPassword,
  cloud,
  compareProgress,
  fetchCloudSave,
  fetchPlayerName,
  guestName,
  pendingPassword,
  readBackup,
  signOut,
} from './cloud';
import { newSave, type Save } from './game';
import { useAuth } from './useAuth';

const T = (lang: number, ro: string, en: string) => (lang ? en : ro);
const language = () => {
  try {
    return localStorage.getItem('dino-realms-language') === 'ro' ? 0 : 1;
  } catch {
    return 1;
  }
};
const dropBootLoader = () => document.getElementById('boot-loader')?.remove();
const islandSave = newSave(Date.now());
/** Set once an account signs in on this device: from then on the gate opens on sign-in rather than sign-up. */
const HAD_ACCOUNT = 'dino-realms-had-account';
const hadAccount = () => {
  try {
    return localStorage.getItem(HAD_ACCOUNT) === 'yes';
  } catch {
    return false;
  }
};

type Start =
  | { phase: 'loading' }
  /** `detail`: the underlying error, shown small so a failure can be reported precisely. */
  | { phase: 'error'; detail: string }
  /** The account has no player name yet: it picks one before entering. */
  | { phase: 'name' }
  /** `owner`: the account this save belongs to, so a different account never starts from it. */
  | { phase: 'ready'; owner: string; name: string; save: Save; marker: string | null; unsaved: boolean };

/**
 * Every player has an account (e-mail and password): the gate signs in or signs up, then loads the save from the
 * cloud. Old guest (anonymous) sessions are signed out and start over with an account. Without accounts configured
 * (local development) the game runs locally.
 */
export default function SignInGate() {
  const auth = useAuth();
  const [lang, setLang] = useState(language);
  const switchLanguage = (next: number) => {
    setLang(next);
    document.documentElement.lang = next ? 'en' : 'ro';
    try {
      localStorage.setItem('dino-realms-language', next ? 'en' : 'ro');
    } catch {
      /* Only this visit then. */
    }
  };
  const [start, setStart] = useState<Start>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const guest = !!auth.user?.is_anonymous;
  const userId = guest ? undefined : auth.user?.id;
  // Guest play is gone: a guest session left on this device is dropped.
  useEffect(() => {
    if (guest) void signOut();
  }, [guest]);
  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(HAD_ACCOUNT, 'yes');
    } catch {
      /* Only decides whether the gate opens on sign-in or sign-up. */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || auth.recovering) return;
    let active = true;
    setStart({ phase: 'loading' });
    (async () => {
      const name = await fetchPlayerName(userId);
      if (!name) return { phase: 'name' } as const;
      const remote = await fetchCloudSave(userId);
      // An upload that never reached the cloud (offline, tab closed) is still in this device's backup.
      const backup = readBackup(userId)?.save;
      if (backup && (!remote || remote.outdated || compareProgress(backup, remote.save) > 0))
        return {
          phase: 'ready',
          owner: userId,
          name,
          save: backup,
          marker: remote?.updatedAt ?? null,
          unsaved: true,
        } as const;
      // A cloud row from an older schema starts a new game, uploaded at once so the row moves to the new schema.
      return {
        phase: 'ready',
        owner: userId,
        name,
        save: remote?.save ?? newSave(Date.now()),
        marker: remote?.updatedAt ?? null,
        unsaved: !remote || !!remote.outdated,
      } as const;
    })().then(
      (next) => active && setStart(next),
      (error: unknown) => {
        console.error('Loading the cloud save failed', error);
        if (active)
          setStart({ phase: 'error', detail: error instanceof Error ? error.message : JSON.stringify(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [userId, auth.recovering, attempt]);

  if (!cloud) return <RealmsApp />;
  const ready = userId && !auth.recovering && start.phase === 'ready' && start.owner === userId ? start : null;
  // After e-mail confirmation the account may still need to choose its password.
  const choosePassword = !!userId && pendingPassword();
  if (ready && auth.user && !choosePassword)
    return (
      <RealmsApp
        key={auth.user.id}
        initialSave={ready.save}
        account={{
          user: auth.user,
          name: ready.name,
          marker: ready.marker,
          unsaved: ready.unsaved,
          recovering: false,
          endRecovery: auth.endRecovery,
        }}
      />
    );
  // Checking the session or loading the save: the boot screen from index.html stays up meanwhile.
  if (!auth.checked || guest || (userId && !auth.recovering && (start.phase === 'loading' || start.phase === 'ready')))
    return null;

  dropBootLoader();
  // The real home island of a new game, drawn still behind every gate screen.
  const island = (
    <div className="realm-gate-island" aria-hidden="true">
      <World
        save={islandSave}
        realm="home"
        lang={lang}
        placing={false}
        moving={null}
        onPlace={() => {}}
        onSelect={() => {}}
        covered
      />
    </div>
  );
  const screen = (title: string, body: React.ReactNode) => (
    <main className="realms-app realm-gate">
      {island}
      <Window title={title} eyebrow="DINO REALMS" close={() => {}} closable={false}>
        {body}
      </Window>
    </main>
  );
  if (choosePassword)
    return screen(
      tr('Alege o parolă', 'Choose a password'),
      <AccountPanel
        lang={lang}
        sync={{
          user: null,
          status: 'signedOut',
          recovering: true,
          endRecovery: () => {
            clearPendingPassword();
            setAttempt((n) => n + 1);
          },
        }}
      />,
    );
  if (userId && start.phase === 'name')
    return screen(
      tr('Cum te cheamă?', 'What is your name?'),
      <NameForm lang={lang} userId={userId} suggested={guestName()} onDone={() => setAttempt((n) => n + 1)} />,
    );
  if (userId && start.phase === 'error') {
    const backup = readBackup(userId);
    return screen(
      tr('Nu ne-am putut conecta', 'We could not connect'),
      <div className="realm-auth">
        <p>
          {tr(
            'Progresul tău e în cloud și nu l-am putut încărca. Verifică internetul și încearcă din nou.',
            'Your progress is in the cloud and could not be loaded. Check your connection and try again.',
          )}
        </p>
        <small className="realm-gate-detail">{start.detail}</small>
        <button className="realm-button" onClick={() => setAttempt((n) => n + 1)}>
          {tr('Încearcă din nou', 'Try again')}
        </button>
        {backup && (
          <button
            className="realm-link realm-gate-guest"
            onClick={() =>
              setStart({
                phase: 'ready',
                owner: userId,
                name: backup.name || guestName(),
                save: backup.save,
                marker: null,
                unsaved: true,
              })
            }
          >
            {tr('Joacă offline cu copia de pe acest dispozitiv', 'Play offline with the copy on this device')} →
          </button>
        )}
      </div>,
    );
  }
  if (auth.recovering)
    return screen(
      tr('Parolă nouă', 'New password'),
      <AccountPanel
        lang={lang}
        sync={{ user: null, status: 'signedOut', recovering: !!auth.user, endRecovery: auth.endRecovery }}
      />,
    );
  return (
    <Landing
      lang={lang}
      setLang={switchLanguage}
      island={island}
      returning={hadAccount()}
      endRecovery={auth.endRecovery}
    />
  );
}
