import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { runtimeConfig } from "@/shared/config/env";
import { api } from "@/shared/api/axios";
import { memoryStorage } from "@/shared/lib/memory-storage";

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

let echoInstance: Echo<"reverb"> | null = null;

/**
 * App dùng JWT bearer (không session/Sanctum) — Echo phải tự POST channel-auth
 * kèm Authorization header thay vì cơ chế cookie mặc định. Dùng lại instance
 * axios `api` sẵn có để request đi qua đúng interceptor refresh-token hiện hành.
 */
interface ChannelAuthResponse {
  auth: string;
  channel_data?: string;
  shared_secret?: string;
}

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

/** Trả null khi thiếu cấu hình Reverb (VITE_REVERB_APP_KEY) — bảng chuông tắt realtime, không sập app. */
export function getEcho(): Echo<"reverb"> | null {
  if (!runtimeConfig.reverb.appKey) return null;
  if (!memoryStorage.getToken()) return null;
  if (echoInstance) return echoInstance;

  window.Pusher = Pusher;
  echoInstance = new Echo({
    broadcaster: "reverb",
    key: runtimeConfig.reverb.appKey,
    wsHost: runtimeConfig.reverb.host,
    wsPort: runtimeConfig.reverb.port,
    wssPort: runtimeConfig.reverb.port,
    forceTLS: runtimeConfig.reverb.scheme === "https",
    enabledTransports: ["ws", "wss"],
    authorizer,
  });

  return echoInstance;
}

export function disconnectEcho(): void {
  echoInstance?.disconnect();
  echoInstance = null;
}
