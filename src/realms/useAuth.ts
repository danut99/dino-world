import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { cloud } from './cloud';

/** Who is signed in. `checked` stays false until the stored session (if any) has been read. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(!cloud);
  /** Set by a password-reset link: the account window then asks for the new password. */
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!cloud) return;
    void cloud.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
    const { data } = cloud.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      // Google, confirmation and reset links come back with a one-time `?code=`; once used, drop it from the address.
      const address = new URL(window.location.href);
      if (session && address.searchParams.has('code')) {
        address.searchParams.delete('code');
        window.history.replaceState(window.history.state, '', address);
      }
      // A token refresh keeps the same account; a different account, or an anonymous one linking its e-mail, updates it.
      setUser((current) => {
        const next = session?.user ?? null;
        return current?.id === next?.id && current?.is_anonymous === next?.is_anonymous && current?.email === next?.email ? current : next;
      });
      setChecked(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, checked, recovering, endRecovery: () => setRecovering(false) };
}
