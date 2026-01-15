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
self.addEventListener('fetch', (event) => {
  // Abaikan request ke Firestore/Google APIs (biar ditangani SDK Firebase)
  if (event.request.url.includes('firestore') || event.request.url.includes('googleapis')) {
    return; 
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Jika internet ada & berhasil ambil file baru:
        // 1. Return file tersebut ke user
        // 2. (Opsional) Update copy di cache biar cache-nya juga fresh
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone response karena stream cuma bisa dibaca sekali
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
            // Update cache dengan file terbaru dari server
            cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // JIKA INTERNET MATI / GAGAL:
        // Ambil dari cache sebagai cadangan
        return caches.match(event.request);
      })
  );
});