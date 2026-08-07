import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Dev-only config for iterating on the side panel UI in a plain browser. */
export default defineConfig({
  root: 'src/sidepanel',
  plugins: [react()],
  server: {
    port: 5199,
  },
});