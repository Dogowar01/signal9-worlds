import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// Unique per build: the installed app compares this with the live version.json to detect updates.
const BUILD_ID = `${pkg.version}-${Date.now().toString(36)}`;
const BUILD_TIME = new Date().toISOString();

const STATIC_FILES = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png'];

/** Emits version.json and a service worker that precaches this exact build for offline use. */
function offlineAndUpdates(): Plugin {
  return {
    name: 'signal9-offline-and-updates',
    apply: 'build',
    generateBundle(_opts, bundle) {
      // Precache code, styles and the Latin font files; other font subsets are cached the first time they're needed.
      const files = Object.keys(bundle).filter(
        (f) => !f.endsWith('.map') && f !== 'index.html' && (!/\.(woff2?|ttf)$/.test(f) || /-latin-wght-/.test(f)),
      );
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, build: BUILD_ID, builtAt: BUILD_TIME }) });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker([...STATIC_FILES, ...files]) });
    },
  };
}

function serviceWorker(precache: string[]) {
  return `// Generated at build time. Cache name changes every deploy so old files are cleaned up.
const CACHE = 's9-${BUILD_ID}';
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('s9-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // always ask the network

  // Pages: network first (so a deploy shows up straight away), cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
    );
    return;
  }

  // Built files have content hashes in their names, so cache first is safe.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
}

// `base: './'` keeps asset paths relative so the build works on GitHub Pages
// (https://<user>.github.io/<repo>/) as well as opened from any folder.
export default defineConfig({
  base: './',
  plugins: [react(), offlineAndUpdates()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  build: { chunkSizeWarningLimit: 1200 },
});
