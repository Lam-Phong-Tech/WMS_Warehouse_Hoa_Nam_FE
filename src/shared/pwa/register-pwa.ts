import {
  markPageLeaving,
  unsafeRequestsInFlight,
} from "@/shared/api/transport-monitor";

export const PWA_UPDATE_READY_EVENT = "wms:pwa-update-ready";

let activeRegistration: ServiceWorkerRegistration | null = null;
let reloadScheduled = false;
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
/**
 * Bản cập nhật được kích hoạt vì CHÍNH người dùng ở tab này bấm "Cập nhật ngay".
 * Khi đó reload là điều họ đang chờ — chỉ còn nhường request ghi đang bay. Còn khi
 * bản mới tự áp (chế độ máy quét) hoặc do tab khác bấm, người dùng ở tab này không
 * hề yêu cầu gì, nên phải đợi tới lúc reload không phá việc họ đang làm.
 */
let updateRequestedByUser = false;

/**
 * ĐO ĐƯỢC 10/09/2026 (`scripts/perf/_check-login-cold-start.mjs`, kịch bản
 * `update`): trên bản build bật chế độ máy quét (đúng cấu hình UAT), mở lại /login
 * sau một lần deploy thì trang TỰ TẢI LẠI giữa lúc người dùng đang gõ / vừa bấm
 * đăng nhập — 3/3 lượt. Chuỗi: đăng ký worker mới → `PwaStatus` tự áp bản mới →
 * `controllerchange` → reload ngay. Reload lúc đó xoá chữ đang gõ, và nếu request
 * đăng nhập đã gửi thì mất luôn response của nó.
 *
 * Nên reload áp bản mới chỉ chạy khi KHÔNG còn lý do nào dưới đây.
 */
export type ReloadBlocker =
  | "request-in-flight"
  | "auth-entry-page"
  | "typing"
  | "editing";

export interface ReloadSafetyInput {
  /** Request ghi (POST/PUT/PATCH/DELETE) đang chờ response. */
  unsafeRequests: number;
  userInitiated: boolean;
  pathname: string;
  msSinceTyping: number;
  /** Con trỏ đang nằm trong một ô nhập đã có nội dung. */
  editingFilledField: boolean;
}

/** Không gõ phím trong ngần này thì coi như người dùng đã ngừng nhập. */
export const TYPING_QUIET_MS = 2000;
const RELOAD_RETRY_MS = 400;
/** Trang người dùng nhập thông tin đăng nhập — reload ở đây xoá mất thứ họ vừa gõ. */
const AUTH_ENTRY_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/change-password",
];
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Còn lý do nào để CHƯA reload áp bản mới không? `null` nghĩa là reload được. */
export function reloadBlocker(input: ReloadSafetyInput): ReloadBlocker | null {
  // Kể cả khi người dùng tự bấm cập nhật: reload giữa một request ghi là mất
  // response của nó (và với refresh xoay vòng token: mất luôn cookie mới).
  if (input.unsafeRequests > 0) return "request-in-flight";
  if (input.userInitiated) return null;
  if (
    AUTH_ENTRY_PATHS.some(
      (path) =>
        input.pathname === path || input.pathname.startsWith(`${path}/`),
    )
  ) {
    return "auth-entry-page";
  }
  if (input.msSinceTyping < TYPING_QUIET_MS) return "typing";
  if (input.editingFilledField) return "editing";
  return null;
}

let lastTypingAt = Number.NEGATIVE_INFINITY;
let typingWatchInstalled = false;

function watchTyping(): void {
  if (typingWatchInstalled) return;
  typingWatchInstalled = true;
  const note = () => {
    lastTypingAt = performance.now();
  };
  // capture + passive: chỉ ghi dấu thời gian, không chạm vào xử lý sự kiện của app.
  window.addEventListener("keydown", note, { capture: true, passive: true });
  window.addEventListener("input", note, { capture: true, passive: true });
}

function isEditingFilledField(): boolean {
  const element = document.activeElement;
  if (element instanceof HTMLTextAreaElement) return element.value !== "";
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(element.type) && element.value !== "";
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

function currentReloadBlocker(): ReloadBlocker | null {
  return reloadBlocker({
    unsafeRequests: unsafeRequestsInFlight(),
    userInitiated: updateRequestedByUser,
    pathname: window.location.pathname,
    msSinceTyping: performance.now() - lastTypingAt,
    editingFilledField: isEditingFilledField(),
  });
}

/**
 * Reload để áp bản mới — nhưng chỉ khi an toàn; chưa an toàn thì thử lại sau.
 * Cố ý KHÔNG có hạn chót: trang cũ vẫn chạy bình thường bằng mã cũ, còn một lần
 * reload giết request đăng nhập hay ghi phiếu thì không lấy lại được.
 */
function reloadWhenSafe(): void {
  if (reloadScheduled) return;
  reloadScheduled = true;
  const attempt = () => {
    if (currentReloadBlocker() !== null) {
      window.setTimeout(attempt, RELOAD_RETRY_MS);
      return;
    }
    markPageLeaving();
    window.location.reload();
  };
  attempt();
}

function notifyUpdateReady() {
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_READY_EVENT));
}

export async function registerPwa(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  hadControllerAtStartup = Boolean(navigator.serviceWorker.controller);
  watchTyping();

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
      reloadWhenSafe();
    });
  } catch (error) {
    // PWA is a stretch enhancement. Registration failure must not prevent the
    // core WMS application from booting, but remains visible in diagnostics.
    console.warn("[WWHN-325] Service worker registration failed", error);
  }
}

/**
 * Kích hoạt bản mới đang chờ. `userInitiated` chỉ bật khi người dùng bấm nút ở
 * tab này; lời gọi tự động (chế độ máy quét) phải để mặc định để reload chờ lúc an
 * toàn — xem `reloadBlocker`.
 */
export function activateWaitingServiceWorker(
  options: { userInitiated?: boolean } = {},
): void {
  if (options.userInitiated) updateRequestedByUser = true;
  const waitingWorker = activeRegistration?.waiting;
  if (!waitingWorker) {
    reloadWhenSafe();
    return;
  }

  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}
