import type Echo from "laravel-echo";
import { runtimeConfig } from "@/shared/config/env";
import { api } from "@/shared/api/axios";
import { memoryStorage } from "@/shared/lib/memory-storage";

/**
 * Kết nối realtime cho chuông thông báo (Laravel Reverb).
 *
 * NẠP LƯỜI — ĐO ĐƯỢC 07/09/2026: `laravel-echo` + `pusher-js` là ~110 KB thô
 * (chunk `axios-*.js` 142 KB / 41,6 KB gz) và trước đây nằm trong ĐỒ THỊ TẢI
 * NGAY của mọi lần tải trang, kể cả màn đăng nhập. Đường kéo chúng vào là
 * `auth.store.ts` → `disconnectEcho` (một hàm hai dòng) → `import Echo from
 * "laravel-echo"` ở đầu file này. Mỗi lần F5 vì thế phải tải, phân tích và chạy
 * một thư viện WebSocket mà chuông thông báo chỉ cần tới SAU khi đã đăng nhập và
 * shell đã lên.
 *
 * Nay hai thư viện chỉ được `import()` bên trong `connectEcho()`. Trên đường tới
 * hạn của F5 chúng biến mất hoàn toàn; chuông vẫn nối realtime ngay sau đó.
 *
 * `import type` ở dòng đầu chỉ là kiểu — TypeScript xoá lúc biên dịch, không
 * sinh import runtime.
 */

interface ChannelAuthResponse {
  auth: string;
  channel_data?: string;
  shared_secret?: string;
}

type EchoInstance = Echo<"reverb">;

let echoInstance: EchoInstance | null = null;
let connecting: Promise<EchoInstance | null> | null = null;

/**
 * App dùng JWT bearer (không session/Sanctum) — Echo phải tự POST channel-auth
 * kèm Authorization header thay vì cơ chế cookie mặc định. Dùng lại instance
 * axios `api` sẵn có để request đi qua đúng interceptor refresh-token hiện hành.
 */
function authorizer(channel: { name: string }) {
  return {
    authorize(
      socketId: string,
      callback: (error: Error | null, data: ChannelAuthResponse | null) => void,
    ) {
      api
        .post<ChannelAuthResponse>("/broadcasting/auth", {
          socket_id: socketId,
          channel_name: channel.name,
        })
        .then((response) => callback(null, response.data))
        .catch((error) => callback(error, null));
    },
  };
}

/** Điều kiện đủ để có realtime: có cấu hình Reverb và đang có access token. */
function canConnect(): boolean {
  if (!runtimeConfig.reverb.appKey) return false;
  if (!memoryStorage.getToken()) return false;
  return true;
}

/**
 * Kết nối (nạp thư viện nếu cần). Trả `null` khi thiếu cấu hình Reverb
 * (VITE_REVERB_APP_KEY) hoặc chưa có phiên — bảng chuông chỉ mất realtime,
 * `GET /notifications` vẫn hoạt động.
 *
 * Single-flight: nhiều nơi gọi cùng lúc vẫn chỉ tạo một kết nối.
 */
export function connectEcho(): Promise<EchoInstance | null> {
  if (echoInstance) return Promise.resolve(echoInstance);
  if (!canConnect()) return Promise.resolve(null);
  if (connecting) return connecting;

  connecting = Promise.all([import("laravel-echo"), import("pusher-js")])
    .then(([echoModule, pusherModule]) => {
      // Điều kiện có thể đã đổi trong lúc chờ tải (đăng xuất giữa chừng).
      if (!canConnect()) return null;
      if (echoInstance) return echoInstance;

      const EchoCtor = echoModule.default;
      const Pusher = pusherModule.default;
      // laravel-echo tìm Pusher ở biến toàn cục khi broadcaster là reverb/pusher.
      (window as Window & { Pusher?: unknown }).Pusher = Pusher;

      echoInstance = new EchoCtor({
        broadcaster: "reverb",
        key: runtimeConfig.reverb.appKey,
        wsHost: runtimeConfig.reverb.host,
        wsPort: runtimeConfig.reverb.port,
        wssPort: runtimeConfig.reverb.port,
        forceTLS: runtimeConfig.reverb.scheme === "https",
        enabledTransports: ["ws", "wss"],
        authorizer,
      }) as EchoInstance;

      return echoInstance;
    })
    .catch(() => {
      // Không tải được thư viện (mất mạng, deploy giữa chừng): mất realtime chứ
      // không sập app. Lần gọi sau thử lại.
      return null;
    })
    .finally(() => {
      connecting = null;
    });

  return connecting;
}

/** Instance hiện có, KHÔNG kích hoạt tải thư viện. */
export function getEchoIfConnected(): EchoInstance | null {
  return echoInstance;
}

/** Ngắt kết nối. No-op nếu thư viện chưa từng nạp — không kéo nó vào đồ thị. */
export function disconnectEcho(): void {
  echoInstance?.disconnect();
  echoInstance = null;
}
