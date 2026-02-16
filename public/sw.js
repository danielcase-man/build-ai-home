// UBuildIt Process Manager — Service Worker
// Cache-first for static assets, network-first for API calls, offline fallback

const CACHE_NAME = 'ubuildit-v1'
const STATIC_CACHE = 'ubuildit-static-v1'
const API_CACHE = 'ubuildit-api-v1'

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
]

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// ─── Fetch Strategy ──────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request))
    return
  }

  // Static assets: cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request))
    return
  }

  // Navigation and other requests: network-first
  event.respondWith(networkFirstStrategy(request))
})

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(pathname)
}

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) {
      // Mark response as from offline cache
      const headers = new Headers(cached.headers)
      headers.set('X-Offline', 'true')
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      })
    }
    return new Response(
      JSON.stringify({ error: 'Offline', _offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ─── Background Sync (stubs for future offline support) ──────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-projects') {
    event.waitUntil(syncPendingUpdates('projects'))
  }
  if (event.tag === 'sync-communications') {
    event.waitUntil(syncPendingUpdates('communications'))
  }
  if (event.tag === 'sync-vendor-research') {
    event.waitUntil(syncPendingUpdates('vendor-research'))
  }
})

async function syncPendingUpdates(store) {
  const updates = await getPendingUpdates(store)
  for (const update of updates) {
    try {
      await fetch(update.url, {
        method: update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update.body),
      })
      await removePendingUpdate(store, update.id)
    } catch {
      // Will retry on next sync
    }
  }
}

// ─── IndexedDB Helpers (stubs) ───────────────────────────────────────────────

function getPendingUpdates(/* store */) {
  // Stub: will be implemented when offline-first is built out
  return Promise.resolve([])
}

function removePendingUpdate(/* store, id */) {
  // Stub
  return Promise.resolve()
}

// eslint-disable-next-line no-unused-vars
function storeFailedRequest(/* store, request */) {
  // Stub
  return Promise.resolve()
}

// ─── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || 'New update from UBuildIt',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'ubuildit-notification',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(data.title || 'UBuildIt', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
