import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import Login from './Login';
import { supabase } from './db';
import './styles.css';

// Shows the app only with a session; keyed by user so signing in as someone else starts fresh.
function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  return session ? <App key={session.user.id} email={session.user.email ?? ''} /> : <Login />;
}

createRoot(document.getElementById('root')!).render(<Root />);
// Cache the app shell so it opens offline (data needs a connection to Supabase).
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
