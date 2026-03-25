/* Service Worker - 离线缓存策略 */

// 缓存版本号，修改代码后递增此值可强制更新缓存
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `bp-tracker-${CACHE_VERSION}`;

// 需要预缓存的本地资源（应用外壳）
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/storage.js',
  '/js/ocr.js',
  '/js/charts.js',
  '/js/app.js',
  '/icons/icon.svg',
];

// CDN 资源域名（运行时缓存）
const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
  'tessdata.projectnaptha.com',
];

// ===== install：预缓存本地资源 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 预缓存本地资源');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting()) // 立即激活新 SW
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

// ===== fetch：拦截网络请求 =====
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CDN 资源：网络优先，失败时回退缓存（确保 Tesseract/Chart.js 离线可用）
  if (CDN_ORIGINS.includes(url.hostname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 成功则存入缓存
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 本地资源：缓存优先，确保离线可用
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // 顺便存入缓存
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
