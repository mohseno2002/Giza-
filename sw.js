/* ══════════════════════════════════════════
   Service Worker — ري الجيزة PWA
   v3 — تحديث إجباري للـ cache
══════════════════════════════════════════ */

const CACHE_NAME   = 'ري-الجيزة-v10';
const STATIC_CACHE = 'static-v10';
const DATA_CACHE   = 'data-v9';

// الأصول الثابتة — تتخزن عند التنصيب
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap',
];

// URLs بيانات Google Sheets — Network First
const DATA_URLS = [
  'https://docs.google.com/spreadsheets/',
];

/* ─── Install ─── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())   // ← يبدأ فوراً بدون انتظار
      .catch(err => console.warn('Cache install error:', err))
  );
});

/* ─── Activate — يمسح كل الـ cache القديم ─── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DATA_CACHE)
          .map(k => {
            console.log('Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())   // ← يتحكم في كل التبويبات المفتوحة فوراً
  );
});

/* ─── Fetch Strategy ─── */
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Google Sheets → Network First (بيانات حية — دايماً من النت)
  if (DATA_URLS.some(u => url.startsWith(u))) {
    e.respondWith(networkFirstStrategy(e.request, DATA_CACHE));
    return;
  }

  // Google Fonts → Stale While Revalidate
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(staleWhileRevalidate(e.request, STATIC_CACHE));
    return;
  }

  // Chart.js CDN → Cache First
  if (url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(cacheFirstStrategy(e.request, STATIC_CACHE));
    return;
  }

  // index.html → Network First عشان دايماً يجيب الأحدث
  if (url.endsWith('/') || url.endsWith('index.html')) {
    e.respondWith(networkFirstStrategy(e.request, STATIC_CACHE));
    return;
  }

  // باقي الطلبات → Cache First
  e.respondWith(cacheFirstStrategy(e.request, STATIC_CACHE));
});

/* ─── Cache First ─── */
async function cacheFirstStrategy(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

/* ─── Network First ─── */
async function networkFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/* ─── Stale While Revalidate ─── */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(r => {
    if (r.ok) cache.put(request, r.clone());
    return r;
  }).catch(() => null);
  return cached || await networkPromise;
}

/* ─── Push Notifications ─── */
self.addEventListener('push', e => {
  let data = { title: 'ري الجيزة', body: 'تحديث جديد' };
  try { data = e.data.json(); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body   : data.body,
      icon   : './icon-192.png',
      badge  : './icon-192.png',
      dir    : 'rtl',
      lang   : 'ar',
      vibrate: [200, 100, 200],
      data   : { url: './' },
      actions: [
        { action: 'open',    title: 'فتح اللوحة' },
        { action: 'dismiss', title: 'إغلاق'      },
      ],
    })
  );
});

/* ─── رسائل من الصفحة (إشعارات فورية) ─── */
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, {
      body   : e.data.body,
      icon   : e.data.icon || './icon-192.png',
      badge  : './icon-192.png',
      dir    : 'rtl',
      lang   : 'ar',
      vibrate: [300, 100, 300],
    });
  }
});

/* ─── Notification Click ─── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => c.url.includes('index.html') && 'focus' in c);
        if (existing) return existing.focus();
        return clients.openWindow('./');
      })
  );
});

/* ─── Background Sync ─── */
self.addEventListener('sync', e => {
  if (e.tag === 'background-refresh') {
    e.waitUntil(Promise.resolve());
  }
});
