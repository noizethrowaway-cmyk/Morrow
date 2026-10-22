/* Morrow static PWA service worker: caches the app shell for offline use. */
'use strict';
const CACHE_NAME = 'morrow-app-shell-v3';
const SCOPE_URL = self.registration.scope;
const APP_FILES = [
  SCOPE_URL,
  `${SCOPE_URL}index.html`,
  `${SCOPE_URL}styles.css`,
  `${SCOPE_URL}app.js`,
  `${SCOPE_URL}manifest.webmanifest`,
  `${SCOPE_URL}icons/icon-192.png`,
  `${SCOPE_URL}icons/icon-512.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('morrow-app-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response && response.ok && new URL(request.url).pathname.startsWith(new URL(SCOPE_URL).pathname)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => {
      if (request.mode === 'navigate') return caches.match(`${SCOPE_URL}index.html`);
      return Response.error();
    });
  }));
});
