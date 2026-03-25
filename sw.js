/* Service Worker - 离线缓存策略
 * 首次访问时缓存所有资源，之后完全离线运行
 */

// 缓存版本号，修改代码后递增此值可强制更新缓存
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `bp-tracker-${CACHE_VERSION}`;

// 预缓存的本地资源（首次 install 时一次性下载并缓存）
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/storage.js',
  './js/ocr.js',
  './js/charts.js',
  './js/app.js',
  './icons/icon.svg',
];

// 预缓存的 CDN 资源（首次 install 时也一并下载，确保离线可用）
const PRECACHE_CDN = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// 需要运行时缓存的 CDN 域名
const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
];

// ===== install：预缓存所有本地 + CDN 资源 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] 预缓存本地资源');
      await cache.addAll(PRECACHE_ASSETS);

      // CDN 资源逐个缓存，单个失败不影响其他
      console.log('[SW] 预缓存 CDN 资源');
      for (const url of PRECACHE_CDN) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('[SW] CDN 缓存失败（离线时将重试）:', url);
        }
      }
    }).then(() => self.skipWaiting()) // 立即激活，不等旧 SW 退出
  );
});

// ===== activate：清理旧版本缓存 =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] 删除旧缓存:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim()) // 接管所有已打开的页面
  );
});

// ===== fetch：缓存优先策略（确保离线可用）=====
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // CDN 资源：缓存优先，没缓存时走网络并存入缓存
  if (CDN_ORIGINS.includes(url.hostname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached; // 有缓存直接用，不请求网络
        return fetch(event.request).then((response) => {
          // 请求成功则存入缓存，下次离线可用
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 本地资源：缓存优先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
