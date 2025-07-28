// ES Module Service Worker - 不使用importScripts

// 缓存策略配置
const CACHE_NAME = 'cuckoox-v1';
const STATIC_CACHE = 'static-v1';
const FONT_CACHE = 'fonts-v1';

// 获取预缓存清单（将由Workbox注入）
const precacheManifest = self.__WB_MANIFEST || [];

// Service Worker 事件监听器
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', async (event) => {
  event.waitUntil(
    (async () => {
      // 立即控制所有客户端
      await self.clients.claim();
      
      // 清理旧缓存
      const cacheWhitelist = [CACHE_NAME, STATIC_CACHE, FONT_CACHE];
      const cacheNames = await caches.keys();
      
      await Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
      
      // 预缓存文件
      if (precacheManifest.length > 0) {
        const cache = await caches.open(CACHE_NAME);
        const urlsToCache = precacheManifest.map(entry => 
          typeof entry === 'string' ? entry : entry.url
        );
        await cache.addAll(urlsToCache);
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 导航请求回退到index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then(response => response || caches.match('/index.html'))
        .then(response => response || fetch(request))
    );
    return;
  }
  
  // Google Fonts 缓存策略
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache => {
        return cache.match(request).then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(fetchResponse => {
            if (fetchResponse.ok) {
              cache.put(request, fetchResponse.clone());
            }
            return fetchResponse;
          });
        });
      })
    );
    return;
  }
  
  // 静态资源缓存策略
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image') {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache => {
        return cache.match(request).then(response => {
          return response || fetch(request).then(fetchResponse => {
            if (fetchResponse.ok) {
              cache.put(request, fetchResponse.clone());
            }
            return fetchResponse;
          });
        });
      })
    );
    return;
  }
  
  // 默认网络优先策略
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});