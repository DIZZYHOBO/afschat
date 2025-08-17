const CACHE_NAME = 'afschat-v1.0.0';
const STATIC_CACHE = 'afschat-static-v1.0.0';
const RUNTIME_CACHE = 'afschat-runtime-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add any additional static assets here
];

// CDN resources that should be cached
const CDN_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.0/dist/peerjs.min.js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      }),
      // Cache CDN resources
      caches.open(RUNTIME_CACHE).then((cache) => {
        console.log('[SW] Caching CDN resources');
        return cache.addAll(CDN_RESOURCES);
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match current version
          if (cacheName !== STATIC_CACHE && 
              cacheName !== RUNTIME_CACHE && 
              cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        console.log('[SW] Serving from cache:', event.request.url);
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Determine which cache to use
        let cacheName = RUNTIME_CACHE;
        if (STATIC_FILES.includes(new URL(event.request.url).pathname)) {
          cacheName = STATIC_CACHE;
        }

        // Cache the response
        caches.open(cacheName).then((cache) => {
          console.log('[SW] Caching new resource:', event.request.url);
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // If both cache and network fail, provide a fallback
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
        return new Response('Offline - Content not available', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});

// Background sync for message queue (when user comes back online)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'message-sync') {
    event.waitUntil(
      // Here you could implement message queue synchronization
      // For now, just notify the client to check for pending messages
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_MESSAGES',
            payload: { tag: event.tag }
          });
        });
      })
    );
  }
});

// Push notifications (for future implementation)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'You have a new secure message',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open AFSChat',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('AFSChat', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Check if AFSChat is already open
        for (let client of clients) {
          if (client.url.includes('/') && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION',
      version: CACHE_NAME
    });
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service worker loaded successfully');
