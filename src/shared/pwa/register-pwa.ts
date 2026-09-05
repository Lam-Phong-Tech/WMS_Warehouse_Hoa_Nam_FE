export const PWA_UPDATE_READY_EVENT = "wms:pwa-update-ready";

let activeRegistration: ServiceWorkerRegistration | null = null;
let reloadForControllerChange = false;

function notifyUpdateReady() {
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_READY_EVENT));
}

export async function registerPwa(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

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
