import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// `npm run dev:test` (mode "demo") swaps the Supabase data layer for a local one: no sign-in, data in the browser.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: mode === 'demo' ? { alias: [{ find: /^\.\/db$/, replacement: fileURLToPath(new URL('./src/db.demo.ts', import.meta.url)) }] } : {},
}));
