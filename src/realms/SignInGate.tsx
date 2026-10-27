import { useEffect, useRef, useState } from 'react';
import RealmsApp, { Window } from './RealmsApp';
import { AccountPanel, NameForm } from './AccountPanel';
import {
  clearLegacySave,
  clearPendingPassword,
  cloud,
  compareProgress,
  fetchCloudSave,
  fetchPlayerName,
  guestName,
  pendingPassword,
  planSync,
  pushCloudSave,
  readLegacySave,
  readBackup,
  startAnonymous,
} from './cloud';
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
/** Set once an account signs in on this device: from then on the game opens on sign-in, not as a new guest game. */
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
  | {
      phase: 'ready';
      owner: string;
      anonymous: boolean;
      name: string;
      save: Save;
      marker: string | null;
      unsaved: boolean;
    };

/**
 * A newcomer plays straight away as a guest, with the save on this device, and is invited to create an account
 * after the first hatch. Signed in, the save lives in the cloud: the guest progress moves into a new account (an
 * account that already has progress keeps its own), and is then removed from the device. Someone who already had
 * an account here opens on sign-in instead. Without accounts configured (local development) the game runs as before.
 */
export default function SignInGate() {
  const auth = useAuth();
  const [lang] = useState(language);
  const [start, setStart] = useState<Start>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [signIn, setSignIn] = useState(hadAccount);
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const userId = auth.user?.id;
  /** An anonymous account plays as a guest: no name step, and the invitations to create an account. */
  const anonymous = !!auth.user?.is_anonymous;
  const guestOwner = useRef<string | null>(null);
  useEffect(() => {
    if (anonymous && userId) guestOwner.current = userId;
  }, [anonymous, userId]);
  // A newcomer gets an anonymous account; if Supabase refuses one, the game keeps the save on the device instead.
  const [anonymousFailed, setAnonymousFailed] = useState(false);
  const anonymousStarted = useRef(false);
  useEffect(() => {
    if (!cloud || !auth.checked || auth.user || auth.recovering || signIn || anonymousStarted.current) return;
    anonymousStarted.current = true;
    void startAnonymous().then((ok) => {
      if (!ok) setAnonymousFailed(true);
    });
  }, [auth.checked, auth.user, auth.recovering, signIn]);
  useEffect(() => {
    if (!userId || anonymous) return;
    try {
      localStorage.setItem(HAD_ACCOUNT, 'yes');
    } catch {
      /* Without storage the next visit opens as a guest. */
    }
    setSignIn(true);
  }, [userId]);

  useEffect(() => {
    if (!userId || auth.recovering) return;
    let active = true;
    setStart({ phase: 'loading' });
    (async () => {
      const name = anonymous ? guestName() : await fetchPlayerName(userId);
      if (!name) return { phase: 'name' } as const;
      const remote = await fetchCloudSave(userId);
      const legacy = readLegacySave();
      // An upload that never reached the cloud (offline, tab closed) is still in this device's backup.
      const backup = readBackup(userId)?.save;
      if (!legacy && backup && (!remote || remote.outdated || compareProgress(backup, remote.save) > 0))
        return {
          phase: 'ready',
          owner: userId,
          anonymous,
          name,
          save: backup,
          marker: remote?.updatedAt ?? null,
          unsaved: true,
        } as const;
      // A cloud row from an older schema starts a new game, uploaded at once so the row moves to the new schema.
      if (!legacy)
        return {
          phase: 'ready',
          owner: userId,
          anonymous,
          name,
          save: remote?.save ?? newSave(Date.now()),
          marker: remote?.updatedAt ?? null,
          unsaved: !remote || !!remote.outdated,
        } as const;
      if (planSync(legacy, remote, guestOwner.current === userId) === 'download' && remote && !remote.outdated) {
        clearLegacySave();
        return {
          phase: 'ready',
          owner: userId,
          anonymous,
          name,
          save: remote.save,
          marker: remote.updatedAt,
          unsaved: false,
        } as const;
      }
      // The device's progress moves into the account; only once it is safely there does it leave the device.
      const at = await pushCloudSave(userId, legacy, remote?.updatedAt ?? null);
      if (!at) throw new Error('cloud changed meanwhile');
      clearLegacySave();
      return { phase: 'ready', owner: userId, anonymous, name, save: legacy, marker: at, unsaved: false } as const;
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
  }, [userId, anonymous, auth.recovering, attempt]);

  if (!cloud) return <RealmsApp />;
  // Linking an email keeps the user id but remounts the game. Wait for the new bootstrap instead of
  // mounting with the guest's original startup snapshot, which could upload a reset over its latest save.
  const ready =
    auth.user &&
    !auth.recovering &&
    start.phase === 'ready' &&
    start.owner === auth.user.id &&
    start.anonymous === anonymous
      ? start
      : null;
  // After an anonymous account linked its e-mail and confirmed it, it chooses its password.
  const choosePassword = !!auth.user && !anonymous && pendingPassword();
  if (ready && auth.user && !choosePassword)
    return (
      <RealmsApp
        key={`${auth.user.id}-${anonymous ? 'guest' : 'player'}`}
        guest={anonymous}
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
  if (!auth.checked || (auth.user && !auth.recovering && (start.phase === 'loading' || start.phase === 'ready')))
    return null;
  if (!auth.user && !auth.recovering && !signIn) return anonymousFailed ? <RealmsApp key="guest" guest /> : null;

  dropBootLoader();
  const screen = (title: string, body: React.ReactNode) => (
    <main className="realms-app realm-gate">
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
  if (auth.user && start.phase === 'name')
    return screen(
      tr('Cum te cheamă?', 'What is your name?'),
      <NameForm lang={lang} userId={auth.user.id} suggested={guestName()} onDone={() => setAttempt((n) => n + 1)} />,
    );
  if (auth.user && start.phase === 'error') {
    const user = auth.user;
    const backup = readBackup(user.id);
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
                owner: user.id,
                anonymous,
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
  return screen(
    auth.recovering ? tr('Parolă nouă', 'New password') : tr('Bine ai venit în Dino Realms', 'Welcome to Dino Realms'),
    <>
      <AccountPanel
        lang={lang}
        sync={{
          user: null,
          status: 'signedOut',
          recovering: auth.recovering && !!auth.user,
          endRecovery: auth.endRecovery,
        }}
      />
      {!auth.recovering && (
        <button
          className="realm-link realm-gate-guest"
          onClick={() => {
            // A guest started earlier in this tab may since have signed in and out: start a new one.
            anonymousStarted.current = false;
            setAnonymousFailed(false);
            setSignIn(false);
          }}
        >
          {tr('Joacă fără cont', 'Play without an account')} →
        </button>
      )}
    </>,
  );
}
