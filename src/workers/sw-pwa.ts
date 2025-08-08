/// <reference lib="webworker" />

import {
  cleanupOutdatedCaches,
  precacheAndRoute,
  createHandlerBoundToURL,
} from "workbox-precaching";
import {
  NavigationRoute,
  registerRoute as workboxRegisterRoute,
} from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

// 注册skip waiting消息处理
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Take control of all clients immediately
self.addEventListener("activate", () => {
  self.clients.claim();
});

// Precache files - this will be replaced by Workbox during build
// @ts-expect-error - Workbox will inject this
precacheAndRoute(self.__WB_MANIFEST || []);

// Clean up old caches
cleanupOutdatedCaches();

// Navigation route fallback
const navigationRoute = new NavigationRoute(
  createHandlerBoundToURL("index.html"),
);
workboxRegisterRoute(navigationRoute);

// Cache Google Fonts
workboxRegisterRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  }),
  "GET",
);

// Cache Google Fonts stylesheets
workboxRegisterRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: "gstatic-fonts-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  }),
  "GET",
);
