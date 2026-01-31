const CACHE_NAME = 'synapse-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// Audio files for ambient sounds (would be hosted)
const AUDIO_ASSETS = [
  '/audio/library-ambience.mp3',
  '/audio/brown-noise.mp3',
  '/audio/rain-hospital.mp3'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('fonts.googleapis.com') &&
      !event.request.url.includes('fonts.gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Background sync for session data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sessions') {
    event.waitUntil(syncSessions());
  }
});

async function syncSessions() {
  try {
    // Get pending sessions from IndexedDB
    const pendingSessions = await getPendingSessions();
    
    if (pendingSessions.length > 0) {
      // Sync to server (when backend is implemented)
      console.log('[ServiceWorker] Syncing sessions:', pendingSessions.length);
      
      // For now, just log - would POST to API
      // await fetch('/api/sessions/sync', {
      //   method: 'POST',
      //   body: JSON.stringify(pendingSessions),
      //   headers: { 'Content-Type': 'application/json' }
      // });
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

async function getPendingSessions() {
  // Would use IndexedDB in production
  return [];
}

// Push notifications for reminders
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Time to study!',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'synapse-reminder',
    renotify: true,
    actions: [
      { action: 'start', title: '▶️ Start Session' },
      { action: 'snooze', title: '⏰ Snooze 30min' }
    ],
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification('Synapse', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'start') {
    event.waitUntil(
      clients.openWindow('/?autostart=true')
    );
  } else if (event.action === 'snooze') {
    // Schedule another notification in 30 minutes
    setTimeout(() => {
      self.registration.showNotification('Synapse', {
        body: 'Your snooze is up! Time to study.',
        icon: '/icons/icon-192.png'
      });
    }, 30 * 60 * 1000);
  } else {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Periodic background sync for streak notifications
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-streak') {
    event.waitUntil(checkStreak());
  }
});

async function checkStreak() {
  // Check if user has studied today
  // Would check IndexedDB/localStorage via client
  console.log('[ServiceWorker] Checking streak status');
}

// Message handling from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_AUDIO') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(AUDIO_ASSETS);
      })
    );
  }
});

console.log('[ServiceWorker] Synapse Service Worker loaded');
