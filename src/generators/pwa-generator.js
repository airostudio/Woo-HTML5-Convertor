/**
 * PWA Generator
 * Generates Service Worker and Web App Manifest for offline support
 */

const fs = require('fs-extra');
const path = require('path');

class PWAGenerator {
    constructor(options = {}) {
        this.options = {
            siteName: options.siteName || 'My Store',
            shortName: options.shortName || 'Store',
            description: options.description || 'Your Online Store',
            themeColor: options.themeColor || '#2563eb',
            backgroundColor: options.backgroundColor || '#ffffff',
            display: options.display || 'standalone',
            startUrl: options.startUrl || '/',
            cacheVersion: options.cacheVersion || 'v1',
            offlineStrategy: options.offlineStrategy || 'cache-first',
            ...options
        };
    }

    /**
     * Generate the web app manifest
     */
    generateManifest() {
        return {
            name: this.options.siteName,
            short_name: this.options.shortName,
            description: this.options.description,
            start_url: this.options.startUrl,
            display: this.options.display,
            background_color: this.options.backgroundColor,
            theme_color: this.options.themeColor,
            orientation: 'any',
            icons: [
                {
                    src: 'assets/images/icon-72.png',
                    sizes: '72x72',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: 'assets/images/icon-96.png',
                    sizes: '96x96',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: 'assets/images/icon-128.png',
                    sizes: '128x128',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: 'assets/images/icon-144.png',
                    sizes: '144x144',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: 'assets/images/icon-152.png',
                    sizes: '152x152',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: 'assets/images/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: 'assets/images/icon-384.png',
                    sizes: '384x384',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: 'assets/images/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any maskable'
                }
            ],
            categories: ['shopping', 'lifestyle'],
            shortcuts: [
                {
                    name: 'Products',
                    short_name: 'Products',
                    description: 'Browse all products',
                    url: '/products.html',
                    icons: [{ src: 'assets/images/icon-96.png', sizes: '96x96' }]
                },
                {
                    name: 'Cart',
                    short_name: 'Cart',
                    description: 'View your cart',
                    url: '/cart.html',
                    icons: [{ src: 'assets/images/icon-96.png', sizes: '96x96' }]
                }
            ],
            screenshots: [
                {
                    src: 'assets/images/screenshot-wide.png',
                    sizes: '1280x720',
                    type: 'image/png',
                    form_factor: 'wide',
                    label: 'Homepage'
                },
                {
                    src: 'assets/images/screenshot-narrow.png',
                    sizes: '750x1334',
                    type: 'image/png',
                    form_factor: 'narrow',
                    label: 'Homepage on mobile'
                }
            ],
            related_applications: [],
            prefer_related_applications: false
        };
    }

    /**
     * Generate the service worker
     */
    generateServiceWorker(pagesToCache = []) {
        const defaultPages = [
            '/',
            '/index.html',
            '/products.html',
            '/cart.html',
            '/search.html',
            '/404.html',
            '/assets/css/main.css',
            '/assets/js/store.js',
            '/manifest.json'
        ];

        const allPages = [...new Set([...defaultPages, ...pagesToCache])];

        return `/**
 * Service Worker for ${this.options.siteName}
 * Cache Version: ${this.options.cacheVersion}
 */

const CACHE_NAME = 'store-cache-${this.options.cacheVersion}';
const RUNTIME_CACHE = 'store-runtime-${this.options.cacheVersion}';

// Resources to cache on install
const PRECACHE_URLS = ${JSON.stringify(allPages, null, 2)};

// Install event - cache essential resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching app shell');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[SW] Precache failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
            })
            .then((cachesToDelete) => {
                return Promise.all(
                    cachesToDelete.map((cacheToDelete) => {
                        console.log('[SW] Deleting old cache:', cacheToDelete);
                        return caches.delete(cacheToDelete);
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip external requests
    if (url.origin !== location.origin) {
        return;
    }

    // HTML pages - Network first, cache fallback
    if (request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Return offline page
                            return caches.match('/404.html');
                        });
                })
        );
        return;
    }

    // CSS, JS, Images - Cache first, network fallback
    if (
        request.url.match(/\\.(css|js|png|jpg|jpeg|gif|svg|webp|woff2?)$/) ||
        request.url.includes('/assets/')
    ) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Update cache in background
                        fetch(request)
                            .then((response) => {
                                if (response.ok) {
                                    caches.open(RUNTIME_CACHE).then((cache) => {
                                        cache.put(request, response);
                                    });
                                }
                            })
                            .catch(() => {});
                        return cachedResponse;
                    }

                    return fetch(request)
                        .then((response) => {
                            if (response.ok) {
                                const responseClone = response.clone();
                                caches.open(RUNTIME_CACHE).then((cache) => {
                                    cache.put(request, responseClone);
                                });
                            }
                            return response;
                        });
                })
        );
        return;
    }

    // JSON data - Network first
    if (request.url.endsWith('.json')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Default - Network first
    event.respondWith(
        fetch(request)
            .catch(() => caches.match(request))
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data === 'clearCache') {
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        });
    }
});

// Background sync for cart/wishlist
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-cart') {
        event.waitUntil(syncCart());
    }
});

async function syncCart() {
    // This would sync cart data with server when online
    console.log('[SW] Syncing cart data');
}

// Push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body || 'New notification',
        icon: '/assets/images/icon-192.png',
        badge: '/assets/images/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'open',
                title: 'View'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || '${this.options.siteName}', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});

console.log('[SW] Service Worker loaded for ${this.options.siteName}');
`;
    }

    /**
     * Write PWA files to output directory
     */
    async writeFiles(outputDir, pagesToCache = []) {
        // Write manifest
        const manifestPath = path.join(outputDir, 'manifest.json');
        await fs.writeJson(manifestPath, this.generateManifest(), { spaces: 2 });

        // Write service worker
        const swPath = path.join(outputDir, 'sw.js');
        await fs.writeFile(swPath, this.generateServiceWorker(pagesToCache));

        // Generate placeholder icons (in real use, these would be actual icons)
        const iconsDir = path.join(outputDir, 'assets/images');
        await fs.ensureDir(iconsDir);

        // Create a simple SVG favicon
        const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="${this.options.themeColor}"/>
  <text x="50" y="65" font-size="50" text-anchor="middle" fill="white" font-family="system-ui">${this.options.shortName.charAt(0)}</text>
</svg>`;

        await fs.writeFile(path.join(iconsDir, 'favicon.svg'), favicon);

        return {
            manifest: manifestPath,
            serviceWorker: swPath
        };
    }
}

module.exports = PWAGenerator;
