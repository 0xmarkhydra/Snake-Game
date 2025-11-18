const IMAGE_CACHE = 'slither-image-cache-v1';
const IMAGE_EXT_REGEX = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== IMAGE_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isImageRequest =
    request.destination === 'image' ||
    (isSameOrigin && IMAGE_EXT_REGEX.test(url.pathname));

  if (!isImageRequest) {
    return;
  }

  event.respondWith(
    caches.open(IMAGE_CACHE).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Nếu offline và chưa có cache, trả lại response rỗng để tránh lỗi.
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    }),
  );
});


