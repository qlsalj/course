// Service Worker：离线可用 + 秒开。
//
// 线上（VERSION 由部署时的 tools/build-site.mjs 写入，是所有文件内容的哈希）：
//   - 缓存优先：启动时直接从本机缓存读取，不等网络，所以打开很快
//   - 原子更新：只要有任何文件变化，VERSION 就会变，浏览器会在后台安装新版 Service Worker，
//     把所有文件完整下载到新缓存后再一次性切换，不会出现新旧文件混用
// 本地开发（VERSION = 'dev'）：网络优先，改完刷新就能看到效果
//
// 缓存名带上作用域：同一域名下（如 xxx.github.io）的其它应用或其它部署互不影响
const VERSION = 'dev';
const CACHE_PREFIX = 'course-pwa-';
const CACHE = `${CACHE_PREFIX}${VERSION}@${self.registration.scope}`;
const DEV = VERSION === 'dev';

// 部署时会被替换成实际的文件清单
const ASSETS = /*@ASSETS*/[
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
  'icons/icon.svg'
]/*@END*/;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' 绕过浏览器的 HTTP 缓存（GitHub Pages 默认缓存 10 分钟），保证拿到的是这个版本的文件
    await cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
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

// 让页面能查询当前生效的版本（设置页里显示）
self.addEventListener('message', (event) => {
  if (event.data === 'version' && event.ports[0]) event.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 去掉查询参数（书签脚本会带 ?v=时间戳，小组件链接带 ?s=）
  const key = new Request(url.origin + url.pathname);
  const isPage = req.mode === 'navigate';
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (!DEV) {
      // 缓存优先：页面统一用缓存里的首页
      const hit = await cache.match(isPage ? './' : key);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    }
    // 开发模式：网络优先，失败或超时再用缓存
    try {
      const res = await Promise.race([fetch(req), timeout(4000)]);
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(key) || (isPage ? await cache.match('./') : null);
      if (hit) return hit;
      throw e;
    }
  })());
});
