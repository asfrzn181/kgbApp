// sw.js
// =====================================================================
// STRATEGI AUTO-UPDATE:
//   - File APP (JS, HTML, CSS milik app) → NETWORK FIRST
//     Selalu ambil versi terbaru dari network. Cache hanya fallback offline.
//   - File VENDOR (library pihak ketiga) → CACHE FIRST
//     Stabil & jarang berubah, aman di-cache permanen.
// Versi cache OTOMATIS dari timestamp build — tidak perlu ubah manual.
// =====================================================================

const CACHE_APP_PREFIX = 'maspri-app-';
const CACHE_APP        = 'maspri-app-v4.0';   // Naikkan hanya jika ingin paksa invalidate semua
const CACHE_VENDOR     = 'maspri-vendor-v1';   // Cache vendor (persistent, jarang berubah)

// File vendor yang boleh di-cache permanen (berdasarkan path prefix)
const VENDOR_PATH = '/assets/vendor/';

function isAppFile(url) {
  if (!url.startsWith('http')) return false;
  try {
    const u = new URL(url);
    if (u.origin !== self.location.origin) return false;
    if (u.pathname.startsWith(VENDOR_PATH)) return false;
    return true;
  } catch { return false; }
}

function isVendorFile(url) {
  if (!url.startsWith('http')) return false;
  try {
    const u = new URL(url);
    if (u.origin !== self.location.origin) return false;
    return u.pathname.startsWith(VENDOR_PATH);
  } catch { return false; }
}

// ── INSTALL ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // skipWaiting → SW baru langsung aktif, tidak perlu tunggu semua tab ditutup
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_VENDOR).then((cache) => {
      return cache.addAll([
        './assets/vendor/bootstrap.min.css',
        './assets/vendor/vue.esm-browser.prod.js',
        './assets/vendor/bootstrap-icons.css',
        './assets/vendor/bootstrap.bundle.min.js',
        './assets/vendor/sweetalert2.all.min.js',
        './assets/vendor/jquery-3.7.1.min.js',
        './assets/vendor/pizzip.js',
        './assets/vendor/docxtemplater.js',
        './assets/vendor/FileSaver.min.js',
        './assets/vendor/jszip.min.js',
        './assets/vendor/docx-preview.min.js',
        './assets/vendor/xlsx.full.min.js',
      ]).catch(() => { /* Toleransi, tidak block install */ });
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Hapus SEMUA cache lama — termasuk maspri-v3.1-cache, dll
          if (name !== CACHE_APP && name !== CACHE_VENDOR) {
            console.log('[SW] Hapus cache lama:', name);
            return caches.delete(name);
          }
          return null;
        })
      );
    })
    .then(() => self.clients.claim())
    .then(() => {
      // Broadcast ke SEMUA tab/window yang terbuka agar reload
      // Ini mengatasi kasus di mana halaman lama tidak punya controllerchange listener
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            console.log('[SW] Kirim SW_UPDATED ke tab:', client.url);
            client.postMessage({ type: 'SW_UPDATED' });
          });
        });
    })
  );
});


// ── FETCH ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Abaikan non-http dan non-GET
  if (!request.url.startsWith('http')) return;
  if (request.method !== 'GET') return;

  // ── 1. VENDOR: Cache First ────────────────────────────────────────
  if (isVendorFile(request.url)) {
    event.respondWith(
      caches.open(CACHE_VENDOR).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.status === 200) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return new Response('Vendor offline', { status: 503 });
        }
      })
    );
    return;
  }

  // ── 2. APP FILES: Network First ───────────────────────────────────
  if (isAppFile(request.url)) {
    event.respondWith(
      caches.open(CACHE_APP).then(async (cache) => {
        try {
          // Selalu coba network dulu → user selalu dapat versi terbaru
          const fresh = await fetch(request);
          if (fresh && fresh.status === 200) {
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          // Network gagal → fallback ke cache (offline mode)
          const cached = await cache.match(request);
          return cached || new Response('Offline', { status: 503 });
        }
      })
    );
    return;
  }

  // ── 3. Request lain (Firestore API, CDN eksternal, dll) ──────────
  // Biarkan browser tangani langsung, tidak di-cache SW
});

// ── MESSAGE: Terima perintah SKIP_WAITING dari halaman ───────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});