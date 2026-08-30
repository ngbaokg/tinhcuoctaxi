// Service Worker cho Đồng Hồ Taxi AI
// Cho phép mở app khi không có mạng (chỉ phần giao diện; các tính năng cần mạng
// như GPS-online-map, dịch AI, tra cứu địa chỉ vẫn cần internet để hoạt động).

// QUAN TRỌNG: tăng số version này (v3, v4...) MỖI LẦN bạn cập nhật index.html và tải lên GitHub,
// để trình duyệt biết cần lấy bản mới thay vì tiếp tục phát bản đã lưu cache cũ.
const CACHE_NAME = 'taxi-ai-cache-v2';
const CORE_ASSETS = [
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
  self.skipWaiting(); // kích hoạt service worker mới ngay, không đợi tab cũ đóng hết
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

  // QUAN TRỌNG: trang chính (index.html / điều hướng) dùng chiến lược "ưu tiên mạng trước":
  // luôn cố lấy bản MỚI NHẤT từ máy chủ trước; chỉ dùng bản cache cũ khi không có mạng.
  // Đây là điểm khác biệt so với trước — trước đây dùng "cache trước" nên sửa code xong tải lên
  // vẫn không thấy thay đổi vì service worker cứ phát mãi bản đã lưu lúc cài app.
  const isHtmlNavigation = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)) // mất mạng -> mới dùng bản cache cũ để app vẫn mở được
    );
    return;
  }

  // Các tài nguyên tĩnh khác (CSS/font từ CDN) vẫn ưu tiên cache trước cho nhanh, ít thay đổi
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
