export const PWA_UPDATE_READY_EVENT = "wms:pwa-update-ready";

let activeRegistration: ServiceWorkerRegistration | null = null;
let reloadForControllerChange = false;
/**
 * Trang này ĐANG được một service worker điều khiển hay không — đọc MỘT LẦN lúc
 * đăng ký.
 *
 * ĐO ĐƯỢC 07/09/2026 (`scripts/perf/_check-sw-reload.mjs`): trên máy sạch, lần
 * cài service worker ĐẦU TIÊN làm trang tự tải lại — Playwright đếm 2 lần điều
 * hướng và `navigation.type` của tài liệu cuối là `reload`. Nguyên nhân: worker
 * mới gọi `clients.claim()` để nhận quyền kiểm soát tab hiện tại, việc đó phát
 * `controllerchange`, và listener bên dưới reload vô điều kiện. Nhưng reload chỉ
 * ĐÚNG khi worker MỚI thay worker CŨ (mã đã đổi giữa chừng phiên); ở lần cài đầu
 * thì trang đang chạy đúng bản mã vừa tải về — reload là tải lại toàn bộ một
 * cách vô ích, ngay giữa lúc khởi động.
 */
let hadControllerAtStartup = false;

function notifyUpdateReady() {
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_READY_EVENT));
}

export async function registerPwa(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  hadControllerAtStartup = Boolean(navigator.serviceWorker.controller);

  // Đăng ký service worker là việc của NỀN, không phải của lần vẽ đầu tiên: nó
  // kéo theo một GET service-worker.js (bỏ qua HTTP cache) và việc cài đặt +
  // precache, tranh băng thông và luồng chính với chính lúc app đang khởi động.
  // Hoãn tới sau sự kiện `load` — muộn nhất vài trăm mili giây, và người dùng
  // không mất gì vì bản offline chỉ cần cho LẦN TẢI SAU.
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      window.addEventListener("load", () => resolve(), { once: true });
    });
  }

  try {
    // `?v=<build id>` là cách build id đi được vào service worker: file nằm
    // trong public/ nên vite `define` không chạm tới nó, còn SW đọc lại được từ
    // `self.location.search`. Hệ quả mong muốn: deploy mới đổi URL script ->
    // trình duyệt cài SW mới VÀ tên CacheStorage đổi theo -> chunk của build cũ
    // bị nhánh `activate` xoá thay vì nằm lại vĩnh viễn trên máy người dùng.
    const registration = await navigator.serviceWorker.register(
      `/service-worker.js?v=${encodeURIComponent(__APP_BUILD_ID__)}`,
      { scope: "/" },
    );
    activeRegistration = registration;

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdateReady();
    }

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (
          installingWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          notifyUpdateReady();
        }
      });
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Lần cài ĐẦU TIÊN (chưa có controller lúc khởi động): `clients.claim()`
      // của worker mới cũng phát sự kiện này, nhưng trang đang chạy đúng bản mã
      // vừa tải nên KHÔNG có gì để tải lại. Reload ở đây là một lần tải trang
      // thừa trên mọi máy mới — xem ghi chú ở `hadControllerAtStartup`.
      if (!hadControllerAtStartup) return;
      if (reloadForControllerChange) return;
      reloadForControllerChange = true;
      window.location.reload();
    });
  } catch (error) {
    // PWA is a stretch enhancement. Registration failure must not prevent the
    // core WMS application from booting, but remains visible in diagnostics.
    console.warn("[WWHN-325] Service worker registration failed", error);
  }
}

export function activateWaitingServiceWorker(): void {
  const waitingWorker = activeRegistration?.waiting;
  if (!waitingWorker) {
    window.location.reload();
    return;
  }

  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}
