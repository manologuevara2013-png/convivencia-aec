// Service Worker para Convivencia AEC - FASTA Juan Pablo II
// Versión: incrementar cuando se actualice la app para forzar reload

const CACHE_VERSION = 'convivencia-aec-v1.0.0';
const CACHE_NAME = CACHE_VERSION;

// Archivos que se cachean para funcionar offline
const ARCHIVOS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './pwa_assets/icon-192.png',
  './pwa_assets/icon-512.png',
  './pwa_assets/apple-touch-icon.png'
];

// Instalación: cachear archivos base
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Cacheando archivos base');
        return cache.addAll(ARCHIVOS_CACHE).catch(err => {
          console.warn('SW: Algunos archivos no se cachearon:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('SW: Borrando cache viejo:', key);
          return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: estrategia network-first para peticiones a Supabase, cache-first para archivos
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // NUNCA cachear peticiones a Supabase - siempre red directa
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('supabase.io') ||
      url.pathname.includes('/auth/') ||
      url.pathname.includes('/rest/') ||
      url.pathname.includes('/realtime/')) {
    return; // Deja que el navegador maneje normal
  }
  
  // Para archivos de la app: cache first, luego red
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        
        return fetch(event.request).then(res => {
          // Solo cachear respuestas exitosas del mismo origen
          if (!res || res.status !== 200 || res.type !== 'basic') {
            return res;
          }
          
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, resClone);
          });
          
          return res;
        });
      })
      .catch(() => {
        // Si estamos offline y no hay cache, devolver la app principal
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});

// Mensaje para forzar actualización desde la app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
