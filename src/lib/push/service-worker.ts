// A push-only worker: no fetch interception or offline caching of private pages.
export const PUSH_WORKER = `
const clickUrl = (value) => {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && url.pathname === '/api/push/open' ? url : null;
  } catch { return null; }
};
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data.json(); } catch { return; }
    if (!data || data.version !== 1 || typeof data.url !== 'string') return;
    const url = clickUrl(data.url);
    if (!url) return;
    await self.registration.showNotification(data.title === 'Zhaogong' ? 'Zhaogong' : '找工', {
      body: data.title === 'Zhaogong' ? 'You have a new message. Open Zhaogong to read it.' : '你有一条新消息，打开找工查看。',
      icon: '/icons/icon-192.png', badge: '/icons/favicon-32.png',
      tag: 'zhaogong-chat', data: { url: url.href }
    });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = clickUrl(event.notification.data?.url || '/');
    if (!url) return;
    await self.clients.openWindow(url.href);
  })());
});
`;
