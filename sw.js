// Service Worker：离线可用。
// 策略：网络优先（保证总是拿到最新版本），网络不可用或超时时使用缓存。
// 缓存名带上作用域：同一域名下（如 xxx.github.io）的其它应用或其它部署互不影响
const CACHE_PREFIX = 'course-pwa-';
const CACHE = `${CACHE_PREFIX}v1@${self.registration.scope}`;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'jw/parsers.js',
  'jw/importer.js',
  'scriptable/widget.js',
  'js/app.js',
  'js/context.js',
  'js/store.js',
  'js/time.js',
  'js/ui.js',
  'js/share.js',
  'js/importers.js',
  'js/exporters.js',
  'js/widget-preview.js',
  'js/views/today.js',
  'js/views/week.js',
  'js/views/settings.js',
  'js/sheets/editor.js',
  'js/sheets/import.js',
  'js/sheets/widget.js',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // 只清理本应用、本作用域的旧版本缓存
      .then((keys) => Promise.all(keys
        .filter((k) => k !== CACHE && k.startsWith(CACHE_PREFIX) && k.endsWith(`@${self.registration.scope}`))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // 去掉查询参数（书签脚本会带 ?v=时间戳）
    const key = new Request(url.origin + url.pathname);
    try {
      const res = await Promise.race([fetch(req), timeout(4000)]);
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(key) || (req.mode === 'navigate' ? await cache.match('./') : null);
      if (hit) return hit;
      throw e;
    }
  })());
});
