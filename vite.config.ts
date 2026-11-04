import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // The dev server always runs in Docker, where file events from a macOS bind mount don't arrive.
    watch: { usePolling: true, interval: 300 },
  },
});
