/* eslint-disable no-restricted-globals */
// 简化版 PWA Service Worker（与 travel-planner 一致）

const CACHE_VERSION = 'v8';
const CACHE_NAME = `bp-tracker-${CACHE_VERSION}`;

const BASE = self.registration.scope;

const PRECACHE_URLS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `${BASE}icons/icon.svg`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => {
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))).then(() => {
      self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (!res || !res.ok) return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone).catch(() => {});
          });
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') {
            return caches.match(`${BASE}index.html`) || caches.match(BASE);
          }
          return undefined;
        });
    })
  );
});
