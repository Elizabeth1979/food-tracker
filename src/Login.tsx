import { useState, type FormEvent } from 'react';
import { supabase } from './db';

// Passwordless sign-in: Supabase emails a magic link that lands back on this site, signed in.
export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin } });
    setBusy(false);
    if (!error) return setSent(email.trim());
    setErr(
      error.code === 'otp_disabled' || error.code === 'signup_disabled' ? 'הכתובת הזו לא רשומה באפליקציה'
        : error.code === 'over_email_send_rate_limit' ? 'נשלחו יותר מדי קישורים. אפשר לנסות שוב בעוד כמה דקות'
          : error.message,
    );
  };

  return (
    <div className="app">
      <main className="center">
        <section className="card pad form" style={{ width: '100%', maxWidth: 380, textAlign: 'start' }}>
          <h2><img src="/icon.svg" width={26} alt="" /> יומן תזונה</h2>
          {sent ? (
            <>
              <p>שלחנו קישור כניסה אל <b dir="ltr">{sent}</b>.</p>
              <p className="muted small">יש לפתוח את הקישור מהמייל כדי להיכנס.</p>
              <button className="link" onClick={() => setSent('')}>שליחה לכתובת אחרת</button>
            </>
          ) : (
            <form className="form" onSubmit={send}>
              <label><span>אימייל</span><input type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              {err && <p className="error" role="alert">{err}</p>}
              <button className="btn primary" disabled={busy}>{busy ? 'שולח…' : 'שליחת קישור כניסה'}</button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
