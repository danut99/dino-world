import { useState, type FormEvent } from 'react';
import { starTotal, type Save } from './game';
import type { User } from '@supabase/supabase-js';
import { cloud, sendPasswordReset, setNewPassword, signIn, signInWithGoogle, signOut, signUp, type AuthProblem } from './cloud';
import type { SyncConflict, SyncStatus } from './useCloudSync';

/** What the account window shows and does: the signed-in player (if any), their save status and a reset in progress. */
export type AccountState = {
  user: User | null;
  status: SyncStatus;
  recovering: boolean;
  endRecovery: () => void;
  /** Uploads pending progress; signing out waits for it. */
  flush?: () => Promise<void>;
};
const T = (lang: number, ro: string, en: string) => (lang ? en : ro);

function problemText(p: AuthProblem, lang: number) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  return {
    credentials: tr('Email sau parolă greșită.', 'Wrong e-mail or password.'),
    unconfirmed: tr('Confirmă întâi adresa din emailul primit.', 'Confirm your address from the e-mail first.'),
    exists: tr('Există deja un cont cu acest email. Intră în cont.', 'An account with this e-mail exists. Sign in instead.'),
    weak: tr('Parola trebuie să aibă cel puțin 6 caractere.', 'The password needs at least 6 characters.'),
    rate: tr('Prea multe încercări. Mai încearcă peste câteva minute.', 'Too many attempts. Try again in a few minutes.'),
    network: tr('Fără conexiune la server. Verifică internetul.', 'Cannot reach the server. Check your connection.'),
    other: tr('Nu a mers. Mai încearcă o dată.', 'That did not work. Please try again.'),
  }[p];
}

export function statusText(status: SyncStatus, lang: number) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  return {
    local: tr('Doar pe acest dispozitiv', 'This device only'),
    signedOut: tr('Neconectat', 'Not signed in'),
    syncing: tr('Se sincronizează…', 'Syncing…'),
    synced: tr('Salvat în cloud', 'Saved to the cloud'),
    offline: tr('Offline · se salvează când revine internetul', 'Offline · saves when back online'),
  }[status];
}

/** Account window: sign in or create an account (e-mail or Google), reset a password, or sign out. */
export function AccountPanel({ lang, sync }: { lang: number; sync: AccountState }) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (!cloud)
    return (
      <p className="realm-note">
        {tr(
          'Conturile nu sunt configurate încă. Progresul se salvează pe acest dispozitiv.',
          'Accounts are not set up yet. Progress is saved on this device.',
        )}
      </p>
    );

  const attempt = async (job: () => Promise<{ ok: boolean; text: string } | null>) => {
    setBusy(true);
    setNote(null);
    try {
      setNote(await job());
    } finally {
      setBusy(false);
    }
  };
  const fail = (p: AuthProblem | null, success?: string) =>
    p ? { ok: false, text: problemText(p, lang) } : success ? { ok: true, text: success } : null;

  if (sync.recovering)
    return (
      <form
        className="realm-auth"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void attempt(async () => {
            const p = await setNewPassword(password);
            if (!p) sync.endRecovery();
            return fail(p, tr('Parola a fost schimbată.', 'Your password was changed.'));
          });
        }}
      >
        <p>{tr('Alege o parolă nouă pentru cont.', 'Choose a new password for your account.')}</p>
        <label>
          {tr('Parolă nouă', 'New password')}
          <input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="realm-button" disabled={busy}>
          {tr('Salvează parola', 'Save password')}
        </button>
        {note && <p className={note.ok ? 'realm-auth-ok' : 'realm-auth-error'} role="status">{note.text}</p>}
      </form>
    );

  if (sync.user)
    return (
      <div className="realm-auth">
        <p>
          {tr('Conectat ca', 'Signed in as')} <strong>{sync.user.email}</strong>
        </p>
        <p className="realm-auth-status" data-status={sync.status}>
          {statusText(sync.status, lang)}
        </p>
        <small>
          {tr(
            'Progresul se salvează automat și îl găsești pe orice dispozitiv în care intri cu acest cont.',
            'Progress saves automatically and follows you to any device you sign in on.',
          )}
        </small>
        <button
          className="realm-button secondary"
          disabled={busy}
          onClick={() =>
            void attempt(async () => {
              await sync.flush?.().catch(() => undefined);
              await signOut();
              return null;
            })
          }
        >
          {tr('Ieși din cont', 'Sign out')}
        </button>
      </div>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'reset')
      void attempt(async () =>
        fail(await sendPasswordReset(email), tr('Ți-am trimis un email cu linkul de resetare.', 'We sent you a reset link by e-mail.')),
      );
    else if (mode === 'signup')
      void attempt(async () => {
        const r = await signUp(email, password);
        return fail(
          r.problem,
          r.confirm ? tr('Cont creat! Deschide linkul din email ca să-l confirmi.', 'Account created! Open the link in your e-mail to confirm it.') : undefined,
        );
      });
    else void attempt(async () => fail(await signIn(email, password)));
  };

  return (
    <form className="realm-auth" onSubmit={submit}>
      <p>
        {tr(
          'Intră în cont sau creează unul ca să joci. Progresul tău e salvat în cloud și îl continui pe orice telefon sau calculator.',
          'Sign in or create an account to play. Your progress is saved in the cloud and continues on any phone or computer.',
        )}
      </p>
      <button type="button" className="realm-button realm-google" disabled={busy} onClick={() => void attempt(async () => fail(await signInWithGoogle()))}>
        <b aria-hidden="true">G</b> {tr('Continuă cu Google', 'Continue with Google')}
      </button>
      <div className="realm-auth-or">{tr('sau cu email', 'or with e-mail')}</div>
      <label>
        Email
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode !== 'reset' && (
        <label>
          {tr('Parolă', 'Password')}
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}
      <button className="realm-button" disabled={busy}>
        {mode === 'signin' ? tr('Intră în cont', 'Sign in') : mode === 'signup' ? tr('Creează cont', 'Create account') : tr('Trimite linkul', 'Send the link')}
      </button>
      {note && <p className={note.ok ? 'realm-auth-ok' : 'realm-auth-error'} role="status">{note.text}</p>}
      <nav className="realm-auth-modes">
        {mode !== 'signin' && (
          <button type="button" onClick={() => { setMode('signin'); setNote(null); }}>
            {tr('Am deja cont', 'I have an account')}
          </button>
        )}
        {mode !== 'signup' && (
          <button type="button" onClick={() => { setMode('signup'); setNote(null); }}>
            {tr('Cont nou', 'New account')}
          </button>
        )}
        {mode !== 'reset' && (
          <button type="button" onClick={() => { setMode('reset'); setNote(null); }}>
            {tr('Am uitat parola', 'Forgot password')}
          </button>
        )}
      </nav>
    </form>
  );
}

const summary = (s: Save) => ({
  dinos: s.dinos.length,
  level: Math.max(0, ...s.dinos.map((d) => d.level)),
  stars: starTotal(s),
  gold: Math.floor(s.gold),
});

/** Two devices made different progress on one account: show both and let the player keep one. */
export function SyncConflictChoice({ conflict, lang, resolve }: { conflict: SyncConflict; lang: number; resolve: (keep: 'local' | 'cloud') => void }) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const card = (title: string, s: Save, keep: 'local' | 'cloud') => {
    const x = summary(s);
    return (
      <div className="realm-sync-option">
        <strong>{title}</strong>
        <ul>
          <li>🦖 {x.dinos} {tr('dinozauri', 'dinosaurs')} · {tr('nivel max.', 'top level')} {x.level}</li>
          <li>★ {x.stars} · ● {x.gold} {tr('aur', 'gold')}</li>
        </ul>
        <button className="realm-button" onClick={() => resolve(keep)}>
          {tr('Păstrează asta', 'Keep this one')}
        </button>
      </div>
    );
  };
  return (
    <div className="realm-sync-conflict">
      <p>
        {tr(
          'Contul tău are alt progres decât acest dispozitiv. Alege pe care îl păstrezi; celălalt va fi înlocuit.',
          'Your account holds different progress from this device. Choose which one to keep; the other is replaced.',
        )}
      </p>
      <div className="realm-sync-options">
        {card(tr('Pe acest dispozitiv', 'On this device'), conflict.local, 'local')}
        {card(tr('În cloud (contul tău)', 'In the cloud (your account)'), conflict.remote.save, 'cloud')}
      </div>
    </div>
  );
}
