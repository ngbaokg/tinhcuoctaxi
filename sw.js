// Service Worker cho Đồng Hồ Taxi AI
// Cho phép mở app khi không có mạng (chỉ phần giao diện; các tính năng cần mạng
// như GPS-online-map, dịch AI, tra cứu địa chỉ vẫn cần internet để hoạt động).

const CACHE_NAME = 'taxi-ai-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll có thể fail nếu 1 tài nguyên CDN lỗi mạng lúc cài đặt -> dùng allSettled để không chặn install
      return Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Chỉ can thiệp GET request; để nguyên các API động (dịch, tìm địa chỉ, GPS) đi thẳng ra mạng
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isDynamicApi =
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('translate.googleapis.com') ||
    url.hostname.includes('img.vietqr.io');

  if (isDynamicApi) return; // luôn lấy mới từ mạng, không cache dữ liệu động

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached); // offline & chưa cache -> báo lỗi mạng bình thường
    })
  );
});
