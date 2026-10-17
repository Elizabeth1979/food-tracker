import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// One id per build: the commit on Vercel, a timestamp elsewhere. The app is built with it and
// /version.json carries it, so an open app can tell a newer deploy is live (see src/update.ts).
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? `local-${Date.now()}`;
const versionFile = (): Plugin => ({
  name: 'version-file',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) }); },
});

// `npm run dev:test` (mode "demo") swaps the Supabase data layer for a local one: no sign-in, data in the browser.
export default defineConfig(({ mode }) => ({
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  resolve: mode === 'demo' ? { alias: [{ find: /^\.\/db$/, replacement: fileURLToPath(new URL('./src/db.demo.ts', import.meta.url)) }] } : {},
}));
