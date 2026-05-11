const CACHE_NAME = "folgas-wap-v1-sunwork";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./logo.jpg",
  "./colaborador.csv",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k!==CACHE_NAME) ? caches.delete(k) : null)))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(()=>{});
      return res;
    }).catch(()=>cached))
  );
});
