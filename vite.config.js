import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// The app is served from the document root: https://your-domain/.
// The build goes into dist/ and "make build" copies it into public_html/ without touching
// public_html/atlas (converted data) and public_html/api (tide proxy), which live outside Vite.
const APP_BASE = '/';
const APACHE = 'http://localhost';

// "0.1.0 (a1b2c3d)": the version from package.json plus the short git commit, if git is available.
function appVersion() {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  try {
    const commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return commit ? `${version} (${commit})` : version;
  } catch {
    return version;
  }
}

// Replaces __APP_VERSION__ in index.html, in development and in the build.
const versionPlugin = {
  name: 'app-version',
  transformIndexHtml: (html) => html.replaceAll('__APP_VERSION__', appVersion()),
};

// The first-party analytics script comes from the webserver at runtime (/api/m.php/s), so
// Vite cannot bundle it: the tag is added here, in the dev server and in the build,
// instead of being a src reference in index.html (Vite would refuse it).
const analyticsPlugin = {
  name: 'analytics-script',
  transformIndexHtml: (html) => html.replace('<script>', '<script async src="/api/m.php/s"></script><script>'),
};

export default defineConfig({
  base: APP_BASE,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // In development, atlas files and the tide proxy come from the webserver container.
    proxy: {
      '/atlas': { target: APACHE, changeOrigin: true },
      '/api': { target: APACHE, changeOrigin: true },
    },
  },
  plugins: [
    tailwindcss(),
    versionPlugin,
    analyticsPlugin,
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tidal Stream Viewer',
        short_name: 'Tidal Streams',
        description: 'Offline viewer for SHOM NetCDF current data',
        theme_color: '#091B27',
        background_color: '#102D42',
        display: 'standalone',
        start_url: APP_BASE,
        scope: APP_BASE,
        icons: [
          { src: 'app-icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'app-icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'app-icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // iOS fetches the launch images itself when the app is added to the Home Screen.
        globIgnores: ['splash/**'],
        // The worker now covers the whole site. Opening the data or the proxy directly
        // in a browser tab must show the file, not the app.
        navigateFallbackDenylist: [/^\/api\//, /^\/atlas\//],
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
