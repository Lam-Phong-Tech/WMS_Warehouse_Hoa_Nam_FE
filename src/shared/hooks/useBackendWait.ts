import { useSyncExternalStore } from "react";
import {
  isWaitingForBackend,
  subscribeBackendWait,
} from "@/shared/api/backend-availability";

/**
 * `true` khi một thao tác đang tự chờ máy chủ khởi động lại xong (xem
 * shared/api/backend-availability.ts) — để màn hình nói đúng điều đang xảy ra
 * thay vì một vòng xoay "đang xác thực" kéo dài vài chục giây không lời giải thích.
 */
export function useBackendWait(): boolean {
  return useSyncExternalStore(
    subscribeBackendWait,
    isWaitingForBackend,
    () => false,
  );
}
