// Service worker : l'app fonctionne hors-ligne et se met à jour en arrière-plan.
// Quand tu modifies un fichier, change VERSION pour forcer la mise à jour.
const VERSION = 'forge-v1.0.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/calc.js',
  './js/charts.js',
  './js/ui.js',
  './js/timer.js',
  './js/workouts.js',
  './js/off.js',
  './js/scanner.js',
  './js/photos.js',
  './js/data/exercises.js',
  './js/data/program.js',
  './js/data/foods.js',
  './js/views/week.js',
  './js/views/session.js',
  './js/views/progress.js',
  './js/views/nutrition.js',
  './js/views/body.js',
  './js/views/profile.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const CDN = ['unpkg.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'forge-cdn').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Bibliothèque du scanner : mise en cache après le premier chargement
  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.open('forge-cdn').then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return; // Open Food Facts : toujours en direct

  // Fichiers de l'app : réponse immédiate depuis le cache, mise à jour en arrière-plan
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      const key = req.mode === 'navigate' ? './index.html' : req;
      const hit = await c.match(key, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => {
          if (res.ok && req.mode !== 'navigate') c.put(req, res.clone());
          if (res.ok && req.mode === 'navigate') c.put('./index.html', res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
