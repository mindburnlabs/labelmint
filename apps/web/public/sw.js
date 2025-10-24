// Service Worker for LabelMint PWA
const CACHE_NAME = 'labelmint-v1';
const RUNTIME_CACHE = 'labelmint-runtime';
const API_CACHE = 'labelmint-api';

// Resources to cache on install
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching resources');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE && name !== API_CACHE)
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request);
        })
    );
    return;
  }

  // Static resources - cache first, network fallback
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request).then((response) => {
            // Cache the response for future use
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/offline');
          }
        })
    );
    return;
  }

  // HTML pages - network first, cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/offline');
            });
        })
    );
    return;
  }

  // Default behavior - network first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  const options = {
    body: event.data?.text() || 'You have new updates!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
      },
      {
        action: 'close',
        title: 'Close',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification('LabelMint', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic background sync (experimental)
self.addEventListener('periodicsync', (event) => {
  console.log('[Service Worker] Periodic sync:', event.tag);
  
  if (event.tag === 'update-tasks') {
    event.waitUntil(updateTasks());
  }
});

// Helper function to sync offline tasks
async function syncTasks() {
  try {
    // Get offline tasks from IndexedDB or cache
    const offlineTasks = await getOfflineTasks();
    
    // Send each task to the server
    for (const task of offlineTasks) {
      try {
        await fetch('/api/tasks/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(task),
        });
        
        // Remove from offline storage
        await removeOfflineTask(task.id);
      } catch (error) {
        console.error('[Service Worker] Failed to sync task:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// Helper function to update tasks in background
async function updateTasks() {
  try {
    const response = await fetch('/api/tasks/latest');
    const tasks = await response.json();
    
    // Cache the updated tasks
    const cache = await caches.open(API_CACHE);
    await cache.put('/api/tasks', new Response(JSON.stringify(tasks)));
    
    // Notify active clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'TASKS_UPDATED',
        payload: tasks,
      });
    });
  } catch (error) {
    console.error('[Service Worker] Update failed:', error);
  }
}

// Placeholder functions (implement with IndexedDB)
async function getOfflineTasks() {
  return [];
}

async function removeOfflineTask(id) {
  // Remove from IndexedDB
}

// Message handler for communication with app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});
