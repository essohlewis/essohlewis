const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `taskflow-${CACHE_VERSION}`;
const RUNTIME_CACHE = `taskflow-runtime-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/mobile.css',
  '/js/app.js',
  '/js/mobile.js',
  '/manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.log('Cache error during install:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Don't cache POST requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first strategy for assets
  if (isAsset(request.url)) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            const cache = caches.open(RUNTIME_CACHE);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        });
      }).catch(() => {
        // Return a fallback for failed requests
        return caches.match('/');
      })
    );
  } else {
    // Network-first strategy for API calls
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response && response.status === 200) {
            const cache = caches.open(RUNTIME_CACHE);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Try cache as fallback
          return caches.match(request).then((response) => {
            return response || createOfflineResponse();
          });
        })
    );
  }
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Determine if a request is for an asset
function isAsset(url) {
  return /\.(css|js|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot|ico)$/i.test(url) ||
         url.includes('/fonts.googleapis.com') ||
         url.includes('/fonts.gstatic.com');
}

// Create offline response
function createOfflineResponse() {
  return new Response('Offline - Please check your connection', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: new Headers({
      'Content-Type': 'text/plain'
    })
  });
}
