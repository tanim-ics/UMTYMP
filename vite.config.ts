import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readSecurityHeaders } from './tools/security-headers.ts';

/**
 * Preloads the first screen's fonts (Task 24). Otherwise the browser asks for them only after the script has run and
 * rendered the heading, which on a slow connection was most of the time to the largest paint. Build file names
 * carry a hash, so the links are added from the bundle.
 */
function preloadFonts(names: readonly string[]): Plugin {
  return {
    name: 'preload-fonts',
    apply: 'build',
    transformIndexHtml(_html, ctx) {
      return Object.keys(ctx.bundle ?? {})
        .filter((file) => file.endsWith('.woff2') && names.some((name) => file.includes(name)))
        .map((file) => ({
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'font',
            type: 'font/woff2',
            href: `/${file}`,
            crossorigin: '',
          },
          injectTo: 'head' as const,
        }));
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    preloadFonts(['grenze-latin-600-normal', 'nunito-latin-400-normal', 'nunito-latin-700-normal']),
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
  // `vite preview` (the production browser tests) sends nginx's security headers, from the same file (Task 24).
  preview: { headers: readSecurityHeaders('docker/security-headers.conf') },
  build: {
    // Fonts stay files: an inlined data: font would need font-src data: in the security policy (Task 24).
    assetsInlineLimit: (file) => (/\.(woff2?|ttf)$/.test(file) ? false : undefined),
  },
  server: {
    // The dev server always runs in Docker, where file events from a macOS bind mount don't arrive.
    watch: { usePolling: true, interval: 300 },
  },
});
