import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Task 23: installable, and everything (code, question bank, fonts, art) cached on the first visit, so the app
    // works offline and a mock never touches the network. Production builds only; dev has no service worker.
    VitePWA({
      // A new version waits until every tab of the app is closed, so an update never reloads a page mid-mock.
      registerType: 'prompt',
      injectRegister: 'script-defer',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Comparia Academy',
        short_name: 'Comparia',
        description: 'Practice for the UMTYMP quantitative-comparison exam.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f4ead5',
        theme_color: '#5b3fa8',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // KaTeX ships woff, woff2 and ttf; browsers pick woff2, so only that is cached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Take control on the first visit, so "offline after the first load" holds without a second visit.
        clientsClaim: true,
      },
    }),
  ],
  server: {
    // The dev server always runs in Docker, where file events from a macOS bind mount don't arrive.
    watch: { usePolling: true, interval: 300 },
  },
});
