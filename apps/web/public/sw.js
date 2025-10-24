// Enhanced Service Worker for LabelMint PWA
const CACHE_NAME = 'labelmint-v1.0.0';
const OFFLINE_URL = '/offline';
const STATIC_CACHE = 'static-cache-v1';
const DYNAMIC_CACHE = 'dynamic-cache-v1';
const API_CACHE = 'api-cache-v1';

// Cache assets for offline functionality
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/projects',
  '/offline',
  '/_next/static/css/',
  '/_next/static/js/',
  '/fonts/inter-v12-latin-regular.woff2',
  '/fonts/inter-v12-latin-bold.woff2',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - pre-cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);

      // Skip waiting to activate immediately
      self.skipWaiting();
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    (async () => {
      // Enable navigation preload
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }

      // Delete old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
          .map(name => caches.delete(name))
      );

      // Take control of all pages
      self.clients.claim();
    })()
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external resources
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Handle different request types
  if (request.url.includes('/api/')) {
    // API requests - Network First with fallback to cache
    event.respondWith(handleApiRequest(request));
  } else if (request.destination === 'image') {
    // Images - Cache First
    event.respondWith(handleImageRequest(request));
  } else if (request.destination === 'script' || request.destination === 'style') {
    // Scripts and styles - Stale While Revalidate
    event.respondWith(handleStaticRequest(request));
  } else {
    // HTML pages - Network First with offline fallback
    event.respondWith(handleNavigationRequest(request));
  }
});

// Handle API requests with Network First strategy
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(API_CACHE);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache if network fails
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline response for API failures
    return new Response(
      JSON.stringify({
        error: 'Network unavailable',
        offline: true,
        message: 'This request requires an internet connection'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    // Try network first with navigation preload
    const preloadResponse = await event.preloadResponse;
    if (preloadResponse) {
      return preloadResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to offline page
    return caches.match(OFFLINE_URL);
  }
}

// Handle static assets (JS, CSS)
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Return cached version immediately
    // Fetch in background and update cache
    fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    }).catch(() => {
      // Network request failed, cached version is fine
    });

    return cachedResponse;
  }

  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    return new Response('Resource not available offline', { status: 503 });
  }
}

// Handle image requests with Cache First strategy
async function handleImageRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return a placeholder image
    return new Response('<svg width="400" height="300"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#6b7280">Image not available offline</text></svg>', {
      headers: { 'Content-Type': 'image/svg+xml' }
    });
  }
}

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncOfflineTasks());
  } else if (event.tag === 'sync-payments') {
    event.waitUntil(syncPendingPayments());
  } else if (event.tag === 'daily-sync') {
    event.waitUntil(performDailySync());
  }
});

// Sync offline tasks
async function syncOfflineTasks() {
  const tasks = await getOfflineTasks();

  for (const task of tasks) {
    try {
      const response = await fetch('/api/tasks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });

      if (response.ok) {
        await removeOfflineTask(task.id);
      }
    } catch (error) {
      console.error('Failed to sync task:', error);
    }
  }
}

// Sync pending payments
async function syncPendingPayments() {
  const payments = await getOfflinePayments();

  for (const payment of payments) {
    try {
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment)
      });

      if (response.ok) {
        await removeOfflinePayment(payment.id);
      }
    } catch (error) {
      console.error('Failed to sync payment:', error);
    }
  }
}

// Daily sync for user data
async function performDailySync() {
  const allClients = await self.clients.matchAll();

  for (const client of allClients) {
    client.postMessage({
      type: 'DAILY_SYNC',
      data: { timestamp: Date.now() }
    });
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification from LabelMint',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    image: data.image,
    tag: data.tag || 'labelmint-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    data: data.data || {},
    actions: data.actions || [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss.png'
      }
    ],
    vibrate: [200, 100, 200],
    timestamp: Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'LabelMint', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data;

  notification.close();

  if (action === 'dismiss') {
    return;
  }

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      // Focus existing window if available
      for (const client of allClients) {
        if (client.url.includes(data.url || '/dashboard')) {
          await client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: data
          });
          return;
        }
      }

      // Open new window
      if (self.clients.openWindow) {
        await self.clients.openWindow(data.url || '/dashboard');
      }
    })()
  );
});

// Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-daily') {
    event.waitUntil(
      (async () => {
        try {
          const response = await fetch('/api/user/daily-sync');
          if (response.ok) {
            const data = await response.json();
            await updateLocalData(data);
          }
        } catch (error) {
          console.error('Daily sync failed:', error);
        }
      })()
    );
  }
});

// App Badge API
async function updateAppBadge(count) {
  if ('setAppBadge' in navigator) {
    try {
      await navigator.setAppBadge(count);
    } catch (error) {
      console.error('Failed to set app badge:', error);
    }
  }
}

// IndexedDB helpers
async function getOfflineTasks() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LabelMintOffline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const getAll = store.getAll();

      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject(getAll.error);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('tasks', { keyPath: 'id' });
    };
  });
}

async function removeOfflineTask(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LabelMintOffline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function getOfflinePayments() {
  // Similar implementation for payments
  return [];
}

async function removeOfflinePayment(id) {
  // Similar implementation for removing payments
  return Promise.resolve();
}

async function updateLocalData(data) {
  // Update local IndexedDB with fresh data
  console.log('[SW] Updating local data:', data);
}

// Message handling from clients
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'UPDATE_BADGE':
      updateAppBadge(data.count);
      break;

    case 'CACHE_URLS':
      cacheUrls(data.urls);
      break;

    case 'CLEAR_CACHE':
      clearCache(data.cacheName);
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Cache multiple URLs
async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  await cache.addAll(urls);
}

// Clear specific cache
async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
  } else {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
}