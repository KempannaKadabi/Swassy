const CACHE_NAME = "swasya-ai-v14-cache";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/css/style.css",
  "/js/translations.js",
  "/js/voice.js",
  "/js/body_skeleton.js",
  "/js/patient_kiosk.js",
  "/js/doctor.js",
  "/js/nurse.js",
  "/js/admin.js",
  "/js/map.js",
  "/js/app.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
