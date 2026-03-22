// FrameWork — Service Worker
// Field-ready offline caching for construction site use.
//
// Strategies:
//   - App shell (mobile pages, static assets): cache-first with network update
//   - API data: network-first with cache fallback (stale data > no data on-site)
//   - Images: cache-first (content rarely changes)
//   - POST/PATCH: queued in IndexedDB for background sync when reconnected

const CACHE_VERSION = 'framework-v2'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const DATA_CACHE = `${CACHE_VERSION}-data`
const IMAGE_CACHE = `${CACHE_VERSION}-images`

// Pre-cache these on install — the mobile field experience works offline
const PRECACHE_URLS = [
  '/mobile',
  '/mobile/punch-list',
  '/manifest.json',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
]

// API routes worth caching for offline field use
const CACHEABLE_API_PATTERNS = [
  '/api/project-status',
  '/api/punch-list',
  '/api/change-orders',
  '/api/warranties',
  '/api/notifications/count',
]

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        // Non-fatal during dev — pages may not be pre-rendered yet
        console.warn('SW: Pre-cache partial failure (expected in dev):', err.message)
      })
    })
  )
  self.skipWaiting()
})

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('framework-') && ![SHELL_CACHE, DATA_CACHE, IMAGE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests (mutations need the network)
  if (request.method !== 'GET') return

  // Only handle same-origin HTTP(S) requests
  if (url.origin !== self.location.origin) return
  if (!url.protocol.startsWith('http')) return

  // API routes: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API_PATTERNS.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(networkFirst(request, DATA_CACHE))
    }
    return
  }

  // Next.js static bundles (content-hashed, safe to cache forever)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  // Images and icons
  if (/\.(png|jpg|jpeg|svg|ico|webp|gif)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  // Static assets (fonts, css)
  if (/\.(woff2?|ttf|eot|css)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  // HTML pages: network-first with cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }
})

// ─── Strategies ───────────────────────────────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) {
      // Add header so the app can show "offline data" indicators
      const headers = new Headers(cached.headers)
      headers.set('X-SW-Offline', 'true')
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      })
    }
    // HTML fallback for pages with no cache
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(
        `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>FrameWork — Offline</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}.card{background:white;border-radius:1rem;padding:2rem;max-width:320px;box-shadow:0 1px 3px rgba(0,0,0,.1)}h2{font-size:1.25rem;margin-bottom:.5rem}p{color:#6b7280;font-size:.875rem;margin-bottom:1.5rem}button{background:#ea580c;color:white;border:none;padding:.75rem 1.5rem;border-radius:.5rem;font-weight:600;font-size:.875rem;cursor:pointer}</style></head><body><div class="card"><h2>You're Offline</h2><p>No cached version of this page is available. Your data will sync when you reconnect.</p><button onclick="location.reload()">Retry</button></div></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }
    return new Response(
      JSON.stringify({ error: 'Offline', _offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

// ─── Background Sync ──────────────────────────────────────────────────────────
// Queued mutations (punch list items, daily logs) get retried when back online

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(syncPendingMutations())
  }
})

async function syncPendingMutations() {
  // Read queued mutations from IndexedDB
  const mutations = await getQueuedMutations()
  for (const mutation of mutations) {
    try {
      await fetch(mutation.url, {
        method: mutation.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mutation.body),
      })
      await removeQueuedMutation(mutation.id)
    } catch {
      // Will retry on next sync event
      break
    }
  }
}

// IndexedDB helpers for mutation queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('framework-offline', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getQueuedMutations() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('mutations', 'readonly')
      const store = tx.objectStore('mutations')
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

async function removeQueuedMutation(id) {
  try {
    const db = await openDB()
    const tx = db.transaction('mutations', 'readwrite')
    tx.objectStore('mutations').delete(id)
  } catch {
    // Non-fatal
  }
}

// ─── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'FrameWork', {
      body: data.body || 'New update',
      icon: '/icon-192.png',
      badge: '/favicon-48x48.png',
      tag: data.tag || 'framework-notification',
      data: { url: data.url || '/mobile' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/mobile'
  event.waitUntil(clients.openWindow(url))
})
