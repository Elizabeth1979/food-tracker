import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import Login from './Login';
import { supabase } from './db';
import { watchForUpdate } from './update';
import './styles.css';

// Shows the app only with a session; keyed by user so signing in as someone else starts fresh.
function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [update, setUpdate] = useState(false);
  // A newer deploy is live: reload right away, unless a dialog is open (something half-entered); then ask.
  useEffect(() => watchForUpdate(() => (document.querySelector('.modal') ? setUpdate(true) : location.reload())), []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  return (
    <>
      {import.meta.env.MODE === 'demo' && <div className="test-mode">מצב בדיקה · הנתונים נשמרים רק בדפדפן הזה, לא בחשבון</div>}
      {update && <button className="update-bar" onClick={() => location.reload()}>גרסה חדשה של האפליקציה זמינה · הקש לעדכון</button>}
      {session ? <App key={session.user.id} email={session.user.email ?? ''} /> : <Login />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
// Cache the app shell so it opens offline (data needs a connection to Supabase).
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
