import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import App from './App';
import Login from './Login';
import { setOfflineUser, supabase } from './db';
import { store } from './store';
import { watchForUpdate } from './update';
import '@fontsource-variable/rubik'; // self-hosted, so it works offline; unicode-range loads only the Hebrew/Latin files used
import './styles.css';

type User = { id: string; email: string };
const userOf = (s: Session | null): User | null => s && { id: s.user.id, email: s.user.email ?? '' };
const lastUser = () => store.get<User | null>('user', null);

// Shows the app only with a session; keyed by user so signing in as someone else starts fresh.
// Offline the last signed-in user carries on: an expired sign-in can't be renewed without a connection
// (and trying takes ~25 s). Data waits on the device until it can be sent (db.ts).
function Root() {
  const [user, setUser] = useState<User | null | undefined>(() => (navigator.onLine ? undefined : lastUser() ?? undefined));
  const [update, setUpdate] = useState(false);
  // A newer deploy is live: reload right away, unless a dialog is open (something half-entered); then ask.
  useEffect(() => watchForUpdate(() => (document.querySelector('.modal') ? setUpdate(true) : location.reload())), []);
  useEffect(() => {
    const show = (u: User | null) => { store.set('user', u); setUser(u); };
    supabase.auth.getSession().then(({ data, error }) => (isAuthRetryableFetchError(error) ? setUser((u) => u ?? lastUser()) : show(userOf(data.session))));
    // The first event repeats getSession's answer, but without telling "signed out" from "offline".
    const { data } = supabase.auth.onAuthStateChange((event, s) => event !== 'INITIAL_SESSION' && show(userOf(s)));
    return () => data.subscription.unsubscribe();
  }, []);
  if (user === undefined) return null;
  if (user) setOfflineUser(user.id);
  return (
    <>
      {import.meta.env.MODE === 'demo' && <div className="test-mode">מצב בדיקה · הנתונים נשמרים רק בדפדפן הזה, לא בחשבון</div>}
      {update && <button className="update-bar" onClick={() => location.reload()}>גרסה חדשה של האפליקציה זמינה · הקש לעדכון</button>}
      {user ? <App key={user.id} email={user.email} /> : <Login />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
// Cache the app shell so it opens offline (the data layer keeps its own copy, db.ts).
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
