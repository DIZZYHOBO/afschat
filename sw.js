const CACHE_NAME = 'afschat-v1.0.0';
const STATIC_CACHE_NAME = 'afschat-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'afschat-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other critical assets
];

// CDN resources that should be cached
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.0/dist/peerjs.min.js',
  // Add other CDN resources as needed
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache CDN assets
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        console.log('🌐 Caching CDN assets');
        return cache.addAll(CDN_ASSETS.filter(url => url.startsWith('http')));
      })
    ]).then(() => {
      console.log('✅ Service Worker installed successfully');
      // Force activation
      return self.skipWaiting();
    }).catch(error => {
      console.error('❌ Service Worker installation failed:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME &&
              cacheName.startsWith('afschat-')) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
      // Take control of all pages
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') return;
  
  // Skip very long URLs (likely data URLs)
  if (request.url.length > 2048) return;

  event.respondWith(
    handleFetchRequest(request)
  );
});

async function handleFetchRequest(request) {
  const url = new URL(request.url);
  
  try {
    // For navigation requests, try cache first then network
    if (request.mode === 'navigate') {
      return await handleNavigationRequest(request);
    }
    
    // For static assets, try cache first
    if (isStaticAsset(url)) {
      return await handleStaticAsset(request);
    }
    
    // For CDN resources, try cache first then network
    if (isCDNResource(url)) {
      return await handleCDNResource(request);
    }
    
    // For API calls and other requests, network first
    return await handleNetworkFirst(request);
    
  } catch (error) {
    console.warn('⚠️ Fetch failed:', request.url, error);
    
    // Return offline fallback for navigation
    if (request.mode === 'navigate') {
      const cachedResponse = await caches.match('/');
      if (cachedResponse) return cachedResponse;
    }
    
    // Return a basic offline response
    return new Response('Offline - AFSChat requires an internet connection for P2P messaging', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation (fresh content)
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    // Fallback to index.html for SPA routing
    const indexResponse = await caches.match('/');
    if (indexResponse) return indexResponse;
    
    throw error;
  }
}

async function handleStaticAsset(request) {
  // Try cache first for static assets
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  
  // Fallback to network
  const networkResponse = await fetch(request);
  
  // Cache successful responses
  if (networkResponse.ok) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

async function handleCDNResource(request) {
  // Try cache first for CDN resources
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  
  // Fallback to network with longer timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const networkResponse = await fetch(request, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function handleNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    throw error;
  }
}

function isStaticAsset(url) {
  const staticExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  const pathname = url.pathname.toLowerCase();
  return staticExtensions.some(ext => pathname.endsWith(ext)) || pathname === '/';
}

function isCDNResource(url) {
  const cdnDomains = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com'];
  return cdnDomains.includes(url.hostname);
}

// Handle background sync for offline message queue
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync-messages') {
    console.log('🔄 Background sync: processing offline messages');
    event.waitUntil(processOfflineMessages());
  }
});

async function processOfflineMessages() {
  // This would handle queued messages when back online
  // For P2P messaging, this is complex as we need direct connections
  console.log('📤 Processing offline message queue...');
  
  // Notify all clients that we're back online
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'BACK_ONLINE',
      timestamp: Date.now()
    });
  });
}

// Handle push notifications (for future use)
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  console.log('📬 Push notification received:', data);
  
  const options = {
    body: data.body || 'New secure message received',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'afschat-message',
    data: data,
    actions: [
      {
        action: 'open',
        title: 'Open AFSChat',
        icon: '/icons/shortcut-chat.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/shortcut-dismiss.png'
      }
    ],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification('AFSChat', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        // Try to focus existing window
        for (const client of clients) {
          if (client.url.includes('afschat') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if no existing window found
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle messages from the main app
self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_CLEAR':
      clearAllCaches();
      break;
      
    case 'VERSION_CHECK':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
      
    default:
      console.log('📨 Service Worker received message:', event.data);
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith('afschat-'))
      .map(name => caches.delete(name))
  );
  console.log('🧹 All AFSChat caches cleared');
}

console.log('🔧 Service Worker script loaded');
