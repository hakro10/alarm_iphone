const CACHE_NAME = 'alarm-pwa-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/manifest.json',
    '/icons/icon-192x192.svg',
    '/icons/icon-512x512.svg'
];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - serve from cache
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for alarms
self.addEventListener('sync', event => {
    if (event.tag === 'alarm-check') {
        event.waitUntil(checkAlarms());
    }
});

// Push notification handler
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Alarm notification',
        icon: 'icons/icon-192x192.svg',
        badge: 'icons/icon-192x192.svg',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'snooze',
                title: 'Snooze',
                icon: 'icons/icon-192x192.svg'
            },
            {
                action: 'stop',
                title: 'Stop',
                icon: 'icons/icon-192x192.svg'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Alarm', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'snooze') {
        // Handle snooze action
        console.log('Snooze clicked');
        // Could send message to main app
    } else if (event.action === 'stop') {
        // Handle stop action
        console.log('Stop clicked');
        // Could send message to main app
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handler for communication with main app
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SCHEDULE_ALARM') {
        console.log('Scheduling alarm from service worker');
        // Handle alarm scheduling
    }
});

// Background task for checking alarms
async function checkAlarms() {
    try {
        // Get alarms from IndexedDB or communicate with main app
        const clients = await self.clients.matchAll();
        
        if (clients.length > 0) {
            // Send message to main app to check alarms
            clients[0].postMessage({
                type: 'CHECK_ALARMS'
            });
        }
    } catch (error) {
        console.error('Error checking alarms:', error);
    }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'alarm-check') {
        event.waitUntil(checkAlarms());
    }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
    console.log('Notification closed:', event.notification.data);
});