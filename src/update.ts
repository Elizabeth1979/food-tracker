// Phones keep a home-screen app paused in the background; reopening it resumes the old page, so a
// deploy only shows up after the app is fully closed. Instead, check /version.json whenever the app
// comes back to the front (and every half hour while it stays open) and report a newer build.
export const APP_VERSION = __APP_VERSION__;

export function watchForUpdate(onNew: () => void) {
  if (!import.meta.env.PROD) return () => {};
  let found = false;
  const check = async () => {
    if (found || document.visibilityState !== 'visible') return;
    try {
      const r = await fetch('/version.json', { cache: 'no-store' });
      const { version } = await r.json();
      if (version && version !== APP_VERSION) { found = true; onNew(); }
    } catch { /* offline: try again next time */ }
  };
  document.addEventListener('visibilitychange', check);
  const timer = setInterval(check, 30 * 60000);
  check();
  return () => { document.removeEventListener('visibilitychange', check); clearInterval(timer); };
}
