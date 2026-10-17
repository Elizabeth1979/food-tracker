import { useEffect, useState } from 'react';
import { client, syncPending, loadFoods, loadSavedMeals, store, today, type Food, type Profile, type SavedMeal } from './lib';
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

export default function App({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('day');
  const [date, setDate] = useState(today);
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState('');

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
    sync();
    window.addEventListener('online', sync);
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
      window.removeEventListener('online', sync);
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
