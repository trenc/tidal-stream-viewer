import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// The built app is served by Apache from public_html/currents/.
// Atlas data (public_html/atlas) and the tide proxy (public_html/api) live next to it,
// outside Vite, so a build never copies or deletes them.
const APP_BASE = '/currents/';
const APACHE = 'http://localhost';

export default defineConfig({
  base: APP_BASE,
  build: {
    outDir: 'public_html/currents',
    emptyOutDir: true,
  },
  server: {
    // In development, atlas files and the tide proxy come from the Apache container.
    proxy: {
      '/atlas': { target: APACHE, changeOrigin: true },
      '/api': { target: APACHE, changeOrigin: true },
    },
  },
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SHOM Current Viewer',
        short_name: 'Currents',
        description: 'Offline viewer for SHOM NetCDF current data',
        theme_color: '#091B27',
        background_color: '#102D42',
        display: 'standalone',
        start_url: APP_BASE,
        scope: APP_BASE,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tiles\.openseamap\.org\/seamark\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openseamap-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/atlas/') && url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'atlas-index',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 40 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/atlas/') && url.pathname.endsWith('.bin'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'atlas-frames',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/atlas/') && /\.nc(\.gz)?$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'atlas-files',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 12 },
            },
          },
        ],
      },
    }),
  ],
});
