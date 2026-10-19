import { useEffect, useState } from 'react';
import { addDays, client, hasPending, loadEntries, syncPending, loadFoods, loadSavedMeals, store, today, type Food, type Profile, type SavedMeal } from './lib';
import Day from './Day';
import Reports from './Reports';
import Foods from './Foods';
import Settings from './Settings';

export type Ctx = {
  foods: Food[];
  setFoods: (f: Food[]) => void;
  meals: SavedMeal[];
  setMeals: (m: SavedMeal[]) => void;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  // Recently logged food ids, newest first. Kept on the profile so every device shares them.
  recent: string[];
  addRecent: (ids: string[]) => void;
};
type Tab = 'day' | 'reports' | 'foods' | 'settings';
const TABS: [Tab, string, string][] = [['day', 'יומן', '📖'], ['reports', 'דוחות', '📊'], ['foods', 'מזונות', '🥗'], ['settings', 'הגדרות', '⚙️']];

const hashTab = (): Tab => TABS.find(([k]) => `#${k}` === location.hash)?.[0] ?? 'day';

export default function App({ email }: { email: string }) {
  // Tabs live in the browser history, so the phone's back button returns to the diary instead of leaving the app.
  // The diary is the bottom entry; any other tab sits one entry above it (switching between them replaces it).
  const [tab, setTabState] = useState<Tab>(hashTab);
  const setTab = (t: Tab) => {
    if (t === tab) return;
    if (t === 'day') return history.back(); // popstate below brings the diary back
    const url = `${location.pathname}${location.search}#${t}`;
    if (tab === 'day') history.pushState(null, '', url); else history.replaceState(null, '', url);
    setTabState(t);
  };
  useEffect(() => {
    // Opened straight on a tab (a reload): put the diary underneath it.
    if (hashTab() !== 'day') { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); history.pushState(null, '', h); }
    const onPop = () => setTabState(hashTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [date, setDate] = useState(today);
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState('');
  const [waiting, setWaiting] = useState(hasPending);

  useEffect(() => {
    // Each piece shows as soon as it's ready; the 1.6 MB food file doesn't hold up goals or meals.
    const fail = (e: Error) => setStatus('שגיאה בטעינה: ' + e.message + ' · לחץ לטעינה מחדש');
    loadFoods().then(setFoods, fail);
    loadSavedMeals().then(setMeals, fail);
    client.models.Profile.list()
      .then(async (p) => setProfile(p.data[0] ?? (await client.models.Profile.create({ kcal: 2000, carbs: 250, fat: 65, protein: 100 })).data))
      .catch(fail);
    // Changes made offline go out on start, when the connection is back, and when the app comes back to the front.
    // A refused one rejects, so it shows in the banner below.
    const sync = () => void syncPending();
    const onPending = () => setWaiting(hasPending());
    // Keeps the past week on the device too, so those days open offline even if they weren't viewed.
    const keepWeek = () => void loadEntries(addDays(today(), -6), today()).catch(() => {});
    const onOnline = () => { sync(); keepWeek(); };
    onOnline();
    window.addEventListener('online', onOnline);
    window.addEventListener('pending-changed', onPending);
    // reopening the app after a while always lands on today
    let hiddenAt = Date.now();
    const onVis = () => {
      if (document.visibilityState === 'hidden') return void (hiddenAt = Date.now());
      sync();
      if (Date.now() - hiddenAt > 30 * 60000) setDate(today());
    };
    document.addEventListener('visibilitychange', onVis);
    // A save that fails (offline, session gone) rejects; show it rather than losing it silently.
    const onReject = (e: PromiseRejectionEvent) => setStatus('שגיאה: ' + (e.reason?.message ?? e.reason) + ' · לחץ לטעינה מחדש');
    window.addEventListener('unhandledrejection', onReject);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pending-changed', onPending);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('unhandledrejection', onReject);
    };
  }, []);

  // Before the profile had a `recent` column the list lived only in this browser; start from that copy.
  const recent = profile?.recent ?? store.get<string[]>('recent', []);
  const addRecent = (ids: string[]) => {
    if (!profile || !ids.length) return;
    const next = [...new Set([...ids, ...recent])].slice(0, 40);
    store.set('recent', next);
    setProfile({ ...profile, recent: next });
    // A convenience only: a failed save must not raise the error banner over the entry that did save.
    client.models.Profile.update({ id: profile.id, recent: next }).catch((e) => console.warn('recent foods not saved', e));
  };
  const ctx: Ctx = { foods, setFoods, meals, setMeals, profile, setProfile, recent, addRecent };
  return (
    <div className="app">
      <nav className="tabs">
        <b className="brand"><img src="/icon.svg" width={26} alt="" /> יומן תזונה</b>
        {TABS.map(([k, label, icon]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{icon}</span>{label}</button>
        ))}
      </nav>
      {waiting && <div role="status" className="banner pending">⏳ יש שינויים שממתינים לשליחה · יישלחו כשיחזור החיבור</div>}
      {status && <div role="alert"><button className="banner" onClick={() => location.reload()}>{status}</button></div>}
      <main>
        {tab === 'day' && <Day ctx={ctx} date={date} setDate={setDate} onExport={() => setTab('reports')} />}
        {tab === 'reports' && <Reports ctx={ctx} date={date} />}
        {tab === 'foods' && <Foods ctx={ctx} date={date} />}
        {tab === 'settings' && <Settings key={profile?.id} ctx={ctx} email={email} />}
      </main>
    </div>
  );
}
