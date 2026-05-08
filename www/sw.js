const STATIC_CACHE = 'fincavet-static-v3';
const DYNAMIC_CACHE = 'fincavet-dynamic-v3';

const staticUrls = [
  '/',
  '/index.html',
  '/app.html',
  '/admin.html',
  '/style.css',
  '/app.js',
  '/admin.js',
  '/login.js',
  '/manifest.json',
  '/icono-192.png',
  '/icono-512.png',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js'
];

// Instalar: cachear todo
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Cacheando archivos estáticos...');
        return cache.addAll(staticUrls);
      })
      .catch(err => console.error('Error cacheando:', err))
  );
  self.skipWaiting();
});

// Activar: limpiar cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('fincavet-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log('Eliminando caché vieja:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: estrategia híbrida
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Estrategia 1: Archivos estáticos locales y Firebase SDKs -> Cache First
  if (staticUrls.includes(request.url) || url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          console.warn('Recurso no disponible offline:', request.url);
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Estrategia 2: API de Firebase -> Network First
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    event.respondWith(
      fetch(request).then(response => {
        return response;
      }).catch(() => {
        console.warn('Firebase offline, usando persistencia local');
        return new Response(JSON.stringify({ offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Estrategia 3: Todo lo demás -> Network First, fallback a caché
  event.respondWith(
    fetch(request).then(response => {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
      return response;
    }).catch(() => {
      return caches.match(request);
    })
  );
});