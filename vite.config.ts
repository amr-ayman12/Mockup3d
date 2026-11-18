import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The deep-zoom pages are lazy routes, so OpenSeadragon lands in its own chunk automatically.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2020' },
});
