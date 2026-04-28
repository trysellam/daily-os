const CACHE = 'daily-os-v2';
const SHELL = ['/'];

// ── Install: cache app shell ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// ── Fetch: network first for API, cache first for shell ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return; // never intercept API calls
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── Messages from the app ──
self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_NOTIFS') {
    checkDueNotifications(e.data.times, e.data.todayKey, e.data.userName);
  }
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Push (for future server-sent push) ──
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'The Daily OS', {
      body: data.body || 'Time to check your daily activities.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'daily-os',
      data: { url: '/' }
    })
  );
});

// ── Notification click ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow('/');
    })
  );
});

// ── Check if a notification is due ──
async function checkDueNotifications(times, todayKey, userName) {
  if (!times || !times.length) return;
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const nowMins = h * 60 + m;

  const messages = [
    { title: 'Good morning, ' + (userName || 'there') + '.', body: 'Your non-negotiables are waiting. How many will you complete today?' },
    { title: 'Midday check-in.', body: 'How are your 11 activities looking? There is still time.' },
    { title: 'Evening review.', body: 'Close the day strong. Lock in everything you can before midnight.' }
  ];

  for (let i = 0; i < times.length; i++) {
    const [th, tm] = times[i].split(':').map(Number);
    if (isNaN(th) || isNaN(tm)) continue;
    const targetMins = th * 60 + tm;
    const diffMins = nowMins - targetMins;

    // Show if within 30 minutes past the scheduled time
    if (diffMins >= 0 && diffMins <= 30) {
      const notifKey = `notif-${todayKey}-${i}`;
      // Check cache to avoid repeats
      const cache = await caches.open('notif-state');
      const shown = await cache.match(notifKey);
      if (!shown) {
        const msg = messages[i] || messages[0];
        await self.registration.showNotification(msg.title, {
          body: msg.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'daily-os-' + i,
          silent: false,
          data: { url: '/' }
        });
        await cache.put(notifKey, new Response('shown'));
      }
    }
  }
}
