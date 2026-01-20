// sw.js

// 1. GANTI VERSI INI SETIAP KALI ANDA DEPLOY UPDATE KODE!
// Contoh: v2.1, v2.2, v2.3 ...
const CACHE_NAME = 'maspri-v2.2-cache';

// Daftar file statis yang mau disimpan agar aplikasi kencang
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './js/main.js',
  // Masukkan library CDN jika ingin aplikasi jalan offline total
  // Tapi hati-hati, CDN jarang berubah, jadi aman di-cache
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://unpkg.com/vue@3.3.4/dist/vue.esm-browser.prod.js'
];

// --- INSTALL: Simpan file ke cache ---
self.addEventListener('install', (event) => {
  self.skipWaiting(); // PENTING: Paksa SW baru langsung aktif, jangan antri
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// --- ACTIVATE: Hapus cache versi lama ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Jika nama cache tidak sama dengan versi sekarang, HAPUS!
          if (cache !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // PENTING: Ambil alih kontrol halaman segera
  );
});

// --- FETCH: Strategi "Network First, Fallback to Cache" ---
// Ini strategi paling aman untuk aplikasi data yang sering update
self.addEventListener('fetch', function(event) {
  // --- [FIX] FILTER WAJIB ---
  // Jangan cache request dari Chrome Extension, Data URI, atau selain HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
      return; 
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          function(response) {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME) // Pastikan variabel CACHE_NAME sesuai dengan kode Bapak
              .then(function(cache) {
                // Bungkus put dalam try-catch agar tidak crash jika ada error aneh
                try {
                    cache.put(event.request, responseToCache);
                } catch (err) {
                    console.warn('Gagal caching:', event.request.url, err);
                }
              });

            return response;
          }
        );
      })
    );
});