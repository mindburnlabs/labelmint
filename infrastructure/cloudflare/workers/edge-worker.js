/**
 * CloudFlare Edge Worker for dynamic content optimization
 * Handles routing, caching, and performance optimizations at edge
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Performance metrics collection
  const start = Date.now()

  // Route handling
  if (pathname.startsWith('/api/')) {
    return handleAPIRequest(request, url)
  } else if (pathname.startsWith('/assets/')) {
    return handleStaticAssets(request, url)
  } else if (pathname.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)) {
    return handleImageOptimization(request, url)
  } else if (pathname.startsWith('/_nuxt/') || pathname.startsWith('/static/')) {
    return handleSPAAssets(request, url)
  } else {
    return handlePageRequest(request, url)
  }
}

/**
 * API Request Handler with caching
 */
async function handleAPIRequest(request, url) {
  // Cache GET requests
  if (request.method === 'GET') {
    const cacheKey = new Request(url.toString(), {
      headers: request.headers,
      method: 'GET'
    })

    const cache = caches.default
    let response = await cache.match(cacheKey)

    if (response) {
      // Add age header
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Edge-Cache-Time', Date.now())
      return response
    }

    // Forward to origin if not cached
    response = await fetch(request)

    // Cache successful responses
    if (response.ok) {
      const cacheControl = getAPICacheControl(url.pathname)
      response = new Response(response.body, response)
      response.headers.set('Cache-Control', cacheControl)
      response.headers.set('X-Cache', 'MISS')

      // Store in cache
      cache.put(cacheKey, response.clone())
    }

    return response
  }

  // Pass through non-GET requests
  return fetch(request)
}

/**
 * Static Assets Handler with long-term caching
 */
async function handleStaticAssets(request, url) {
  const cache = caches.default
  const cacheKey = new Request(request.url)

  let response = await cache.match(cacheKey)

  if (response) {
    response.headers.set('X-Cache', 'HIT')
    response.headers.set('X-Asset-Cache', 'TRUE')
    return response
  }

  response = await fetch(request)

  if (response.ok) {
    response = new Response(response.body, response)

    // Long-term caching for static assets (1 year)
    const hash = getAssetHash(url.pathname)
    response.headers.set('Cache-Control', `public, max-age=31536000, immutable`)
    response.headers.set('ETag', `"${hash}"`)
    response.headers.set('X-Content-Type-Options', 'nosniff')

    // Add Brotli compression hint
    if (shouldCompress(url.pathname)) {
      response.headers.set('Vary', 'Accept-Encoding')
    }

    cache.put(cacheKey, response.clone())
  }

  return response
}

/**
 * Image Optimization Handler
 */
async function handleImageOptimization(request, url) {
  const cache = caches.default

  // Parse image optimization parameters
  const width = url.searchParams.get('w')
  const height = url.searchParams.get('h')
  const quality = url.searchParams.get('q') || 85
  const format = url.searchParams.get('f') || 'auto'

  // Create cache key with optimization parameters
  const cacheKey = new Request(`${url.pathname}?w=${width}&h=${height}&q=${quality}&f=${format}`)
  let response = await cache.match(cacheKey)

  if (response) {
    response.headers.set('X-Cache', 'HIT')
    response.headers.set('X-Image-Optimized', 'TRUE')
    return response
  }

  // Fetch original image
  const originalResponse = await fetch(new URL(url.pathname, request.url))

  if (!originalResponse.ok) {
    return originalResponse
  }

  // Optimize image using CloudFlare Image Resizing
  try {
    const optimizedImage = await optimizeImage(originalResponse, {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      quality: parseInt(quality),
      format: format
    })

    response = new Response(optimizedImage.body, {
      status: 200,
      headers: {
        'Content-Type': optimizedImage.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Cache': 'MISS',
        'X-Image-Optimized': 'TRUE',
        'Vary': 'Accept'
      }
    })

    cache.put(cacheKey, response.clone())
    return response

  } catch (error) {
    // Fallback to original if optimization fails
    return originalResponse
  }
}

/**
 * SPA Assets Handler with service worker strategy
 */
async function handleSPAAssets(request, url) {
  const cache = caches.default
  const cacheKey = new Request(request.url)

  let response = await cache.match(cacheKey)

  if (response) {
    // Add stale-while-revalidate header
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    response.headers.set('X-Cache', 'HIT')
    return response
  }

  response = await fetch(request)

  if (response.ok) {
    response = new Response(response.body, response)
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    response.headers.set('X-Cache', 'MISS')

    cache.put(cacheKey, response.clone())
  }

  return response
}

/**
 * Page Request Handler with full-page caching
 */
async function handlePageRequest(request, url) {
  const cache = caches.default

  // Check for authenticated user
  const authCookie = request.headers.get('Cookie')?.match(/auth_token=([^;]+)/)

  // Don't cache authenticated pages
  if (authCookie) {
    return fetch(request)
  }

  // Cache public pages
  const cacheKey = new Request(request.url)
  let response = await cache.match(cacheKey)

  if (response) {
    response.headers.set('X-Cache', 'HIT')
    response.headers.set('X-Page-Cache', 'TRUE')

    // Add age header
    const age = Math.floor((Date.now() - parseInt(response.headers.get('X-Cache-Time') || 0)) / 1000)
    response.headers.set('Age', age.toString())

    return response
  }

  response = await fetch(request)

  if (response.ok && shouldCachePage(url.pathname)) {
    response = new Response(response.body, response)
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    response.headers.set('X-Cache', 'MISS')
    response.headers.set('X-Cache-Time', Date.now().toString())

    // Cache HTML responses
    if (response.headers.get('Content-Type')?.includes('text/html')) {
      cache.put(cacheKey, response.clone())
    }
  }

  return response
}

/**
 * Helper Functions
 */

function getAPICacheControl(pathname) {
  // Different cache durations for different API endpoints
  if (pathname.includes('/public/')) {
    return 'public, max-age=300' // 5 minutes for public data
  } else if (pathname.includes('/static/') || pathname.includes('/config/')) {
    return 'public, max-age=3600' // 1 hour for semi-static data
  } else {
    return 'no-cache, no-store, must-revalidate' // No caching for private APIs
  }
}

function getAssetHash(pathname) {
  // Extract hash from filename or create based on path
  const hashMatch = pathname.match(/\.([a-f0-9]{8,})\./)
  return hashMatch ? hashMatch[1] : createHash(pathname)
}

function createHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

function shouldCompress(pathname) {
  const compressibleTypes = [
    '.js', '.css', '.html', '.json', '.xml', '.txt',
    '.svg', '.woff', '.woff2', '.ttf', '.eot'
  ]
  return compressibleTypes.some(type => pathname.endsWith(type))
}

function shouldCachePage(pathname) {
  // Don't cache certain pages
  const noCachePaths = ['/admin', '/account', '/checkout', '/login', '/register']
  return !noCachePaths.some(path => pathname.startsWith(path))
}

async function optimizeImage(response, options) {
  // This would use CloudFlare's Image Resizing API
  // For now, we'll return the original response
  // In production, this would be:
  // const imageResizing = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/image/resizing`, {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${API_TOKEN}` },
  //   body: response.body
  // })

  return {
    body: response.body,
    contentType: response.headers.get('Content-Type')
  }
}

/**
 * Security Headers Middleware
 */
function addSecurityHeaders(response) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  }

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

/**
 * Performance Metrics Collection
 */
function collectMetrics(request, response, startTime) {
  const duration = Date.now() - startTime
  const url = new URL(request.url)

  // Send metrics to analytics service
  fetch('https://analytics.labelmint.it/api/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      url: url.pathname,
      method: request.method,
      status: response.status,
      duration: duration,
      cache: response.headers.get('X-Cache'),
      userAgent: request.headers.get('User-Agent'),
      country: request.cf?.country,
      colo: request.cf?.colo // CloudFlare data center
    })
  }).catch(() => {
    // Ignore errors in metrics collection
  })
}

// Export for testing
module.exports = {
  handleRequest,
  handleAPIRequest,
  handleStaticAssets,
  handleImageOptimization,
  handleSPAAssets,
  handlePageRequest
}