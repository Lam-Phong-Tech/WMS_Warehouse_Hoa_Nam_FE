import { useEffect, useState } from "react";
import { queryClient } from "@/app/providers/query-client";
import { useAuthStore } from "@/shared/store/auth.store";
import { startQueryPersistence } from "./query-persister";
import type { CacheIdentity } from "./cache-namespace";

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isProfileLoaded) return;

    // Đã báo "profile loaded" mà không có profile thì không có danh tính để đặt
    // namespace -> không nạp gì cả. Phải mở cổng ngay: giữ `ready=false` ở nhánh
    // này sẽ treo màn hình chờ vĩnh viễn, đúng kiểu lỗi biến cache thành điểm
    // chết của ứng dụng.
    if (!profile) {
      setReady(true);
      return;
    }

    const identity: CacheIdentity = {
      userId: String(profile.user_id ?? profile.id ?? "unknown"),
      warehouseScopeIds: profile.warehouse_scope_ids ?? [],
      contextRef:
        currentContext?.scope_ref ??
        (currentContext?.warehouse_id != null
          ? String(currentContext.warehouse_id)
          : null),
      permissionCodes,
      isSuperAdmin,
    };

    let cancelled = false;
    void startQueryPersistence(queryClient, identity).finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isProfileLoaded, profile, permissionCodes, isSuperAdmin, currentContext]);

  // Chưa đăng nhập thì không có gì để nạp — đừng giữ màn hình chờ.
  return isProfileLoaded ? ready : true;
}
