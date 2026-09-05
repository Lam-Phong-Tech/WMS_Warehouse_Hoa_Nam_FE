/**
 * Service worker của WMS Hoà Nam — CHỈ cache vỏ ứng dụng và tài nguyên tĩnh.
 *
 * Ranh giới không đổi so với WWHN-325: không đụng `/api/*`, không đụng
 * cross-origin, không đụng request có header Authorization, không background
 * sync. Dữ liệu nghiệp vụ do tầng React Query + IndexedDB (src/shared/cache/)
 * lo — nơi có thể vô hiệu theo mutation và theo danh tính người dùng, thứ mà
 * CacheStorage không làm được.
 *
 * ĐIỂM SỬA CỦA ĐỢT NÀY — tên cache gắn với BUILD ID.
 * Trước đây tên cache ghim cứng `hoa-nam-pwa-static-v1`. Tên file JS/CSS có hash
 * nội dung nên mỗi lần deploy sinh một bộ URL mới, còn bộ cũ NẰM LẠI trong đúng
 * cache đó vĩnh viễn — không có gì dọn, dung lượng trên máy người dùng chỉ tăng.
 * Nay build id được `register-pwa.ts` truyền vào qua query `?v=`, nên deploy mới
 * đổi URL script (trình duyệt cài SW mới) và đổi tên cache (nhánh `activate`
 * xoá sạch cache của build cũ).
 *
 * ĐÁNH ĐỔI ĐÃ CÂN NHẮC: sau mỗi deploy, chunk KHÔNG đổi nội dung cũng bị tải lại
 * một lần vì nằm ở cache mang tên mới. Đây đúng là hành vi precache của Workbox;
 * đổi lại là bảo đảm cứng "không bao giờ tích chunk mồ côi". Với app nội bộ
 * deploy theo đợt, một lần tải lại mỗi deploy rẻ hơn nhiều so với rác tăng
 * không giới hạn trên máy kho.
 */
const CACHE_PREFIX = "hoa-nam-pwa";
const BUILD_ID =
  new URL(self.location.href).searchParams.get("v") || "unversioned";
const STATIC_CACHE = `${CACHE_PREFIX}-static-${BUILD_ID}`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
];
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);
const API_PATH = /^\/api(?:\/|$)/i;
/**
 * Tài nguyên có hash nội dung trong tên (Vite: `name-<hash>.js`). URL đã là định
 * danh của nội dung nên cache-first là đúng: nội dung đổi thì URL đổi, không thể
 * phục vụ nhầm bản cũ. Ảnh/icon/manifest trong `public/` KHÔNG có hash nên dùng
 * stale-while-revalidate để bản mới còn có đường thay thế.
 */
const CONTENT_HASHED = /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function cacheFirst(request) {
  return caches.match(request).then(async (cached) => {
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const network = fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches
            .open(STATIC_CACHE)
            .then((cache) => cache.put(request, copy));
        }
        return response;
      })
      // Mạng hỏng mà có bản cache thì dùng bản cache; không có thì để lỗi nổi
      // lên đúng như một request thường, đừng nuốt thành 200 rỗng.
      .catch((error) => {
        if (cached) return cached;
        throw error;
      });

    return cached ?? network;
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Explicit denylist: service worker never handles cross-origin traffic,
  // private API routes, or requests carrying an Authorization header.
  // Therefore auth/session/token/private API responses cannot enter CacheStorage.
  if (
    url.origin !== self.location.origin ||
    API_PATH.test(url.pathname) ||
    request.headers.has("authorization")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/index.html");
          return (
            cached ??
            new Response("Ứng dụng chưa có bản giao diện ngoại tuyến.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) return;

  event.respondWith(
    CONTENT_HASHED.test(url.pathname)
      ? cacheFirst(request)
      : staleWhileRevalidate(request),
  );
});
