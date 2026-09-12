const CACHE_NAME = 'shag-shell-v1';

const NEVER_CACHE = [
    'yop7qymjl5.execute-api.ap-southeast-2.amazonaws.com',
    'ct96qivjdd.execute-api.ap-southeast-2.amazonaws.com',
    '/data/run-info.json'
];

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/js/api.js',
    '/js/state.js',
    '/js/runInfo.js',
    '/js/render.js',
    '/js/collapse.js',
    '/js/icons.js',
    '/js/utils.js',
    '/js/register-sw.js',
    '/images/shag.svg',
    '/images/flowtracker.svg',
    '/images/microboard.svg',
    '/images/moving-boat.svg',
    '/images/no-data.svg',

    '/tools/',
    '/tools/index.html',
    '/js/lag.js',
    '/js/declination.js',

    '/gauging/',
    '/gauging/index.html',
    '/js/gauging-notes.js',
    '/js/gauging-quality.js',
    '/js/gauging-share.js',
    '/js/form-utils.js',

    'https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap'
];

function isNeverCache(url) {
    return NEVER_CACHE.some(pattern => url.includes(pattern));
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    if (isNeverCache(url)) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                }
                return response;
            }).catch(() => cached);
        })
    );
});