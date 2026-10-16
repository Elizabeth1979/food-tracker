import { useEffect, useState } from 'react';
import { client, loadFoods, loadSavedMeals, today, type Food, type Profile, type SavedMeal } from './lib';
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
};
type Tab = 'day' | 'reports' | 'foods' | 'settings';
const TABS: [Tab, string, string][] = [['day', 'יומן', '📖'], ['reports', 'דוחות', '📊'], ['foods', 'מזונות', '🥗'], ['settings', 'הגדרות', '⚙️']];

export default function App() {
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
    // reopening the app after a while always lands on today
    let hiddenAt = Date.now();
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (Date.now() - hiddenAt > 30 * 60000) setDate(today());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const ctx: Ctx = { foods, setFoods, meals, setMeals, profile, setProfile };
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
        {tab === 'foods' && <Foods ctx={ctx} />}
        {tab === 'settings' && <Settings key={profile?.id} ctx={ctx} />}
      </main>
    </div>
  );
}
