import { useEffect, useMemo, useState } from "react";
import { queryClient } from "@/app/providers/query-client";
import { mark } from "@/shared/perf/marks";
import { useAuthStore } from "@/shared/store/auth.store";
import { startQueryPersistence, stopQueryPersistence } from "./query-persister";
import { buildCacheNamespace, type CacheIdentity } from "./cache-namespace";

/**
 * Cổng nạp persisted query cache.
 *
 * THỜI ĐIỂM là phần quan trọng nhất ở đây. Cache chỉ được nạp SAU khi
 * `GET /auth/me` trả về, tức là sau khi MÁY CHỦ xác nhận danh tính của đúng JWT
 * hiện tại — không dùng gợi ý user còn trong cookie. Trên máy dùng chung của kho,
 * cookie có thể là của ca trước; hydrate theo nó là mở đúng cửa rò dữ liệu chéo
 * tài khoản mà persisted cache buộc phải đóng.
 *
 * Chi phí của việc chờ này bằng 0 về mặt cảm nhận: ProtectedRoute vốn đã chặn
 * mọi màn hình dữ liệu cho tới khi `isProfileLoaded`, còn thao tác đọc IndexedDB
 * mất vài mili giây và chạy song song với chính request /auth/me.
 */
export function usePersistedQueryCache(): boolean {
  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);
  const profile = useAuthStore((s) => s.profile);
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const currentContext = useAuthStore((s) => s.currentContext);
  const token = useAuthStore((s) => s.token);
  const [readySession, setReadySession] = useState<{
    namespace: string | null;
    token: string | null;
  } | null>(null);

  const identity = useMemo<CacheIdentity | null>(
    () =>
      profile
        ? {
            userId: String(profile.user_id ?? profile.id ?? "unknown"),
            warehouseScopeIds: profile.warehouse_scope_ids ?? [],
            contextRef:
              currentContext?.scope_ref ??
              (currentContext?.warehouse_id != null
                ? String(currentContext.warehouse_id)
                : null),
            permissionCodes,
            isSuperAdmin,
          }
        : null,
    [profile, permissionCodes, isSuperAdmin, currentContext],
  );
  const namespace = identity ? buildCacheNamespace(identity) : null;

  useEffect(() => {
    if (!isProfileLoaded) {
      stopQueryPersistence();
      return;
    }

    // Đã báo "profile loaded" mà không có profile thì không có danh tính để đặt
    // namespace -> không nạp gì cả. Phải mở cổng ngay: giữ `ready=false` ở nhánh
    // này sẽ treo màn hình chờ vĩnh viễn, đúng kiểu lỗi biến cache thành điểm
    // chết của ứng dụng.
    if (!identity) return;

    let cancelled = false;
    mark("cache:start");
    void startQueryPersistence(queryClient, identity).finally(() => {
      mark("cache:ready");
      if (!cancelled) setReadySession({ namespace, token });
    });

    return () => {
      cancelled = true;
      stopQueryPersistence();
    };
  }, [isProfileLoaded, identity, namespace, token]);

  // Chưa đăng nhập thì không có gì để nạp — đừng giữ màn hình chờ.
  return (
    !isProfileLoaded ||
    !identity ||
    (readySession?.namespace === namespace && readySession.token === token)
  );
}
