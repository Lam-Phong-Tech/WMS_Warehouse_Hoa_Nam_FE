import { Box } from "@mui/material";
import { useWarehouseDirectory } from "@/shared/data/reference-queries";
import { useAuthStore } from "@/shared/store/auth.store";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { hasAnyWmsPermission } from "@/shared/constants/wms-permissions";
import { useT } from "@/shared/i18n/useT";
import { UiAlert } from "@/shared/ui";

/**
 * Dải cảnh báo "kho đang tạm dừng", hiện ở MỌI màn trong shell.
 *
 * VÌ SAO Ở TẦNG SHELL: khi Super Admin tạm dừng kho, BE đóng băng toàn bộ thao tác ghi
 * (EnsureWarehouseOperational -> 409 WAREHOUSE_INACTIVE). Không có dải này thì người
 * dùng ở màn nhập/xuất/bảo hành chỉ thấy mọi nút bấm đều báo lỗi và không hiểu vì sao —
 * đọc như hệ thống hỏng chứ không như một trạng thái có chủ ý.
 *
 * IM LẶNG KHI KHÔNG CHẮC: đang tải, lỗi, hoặc danh mục rỗng đều render null. Vai
 * NO_PERMISSION không có `warehouse.view` nên query 403 — thà không hiện gì còn hơn
 * dựng một cảnh báo sai trên mọi màn của họ.
 */
export function WarehousePausedBanner() {
  const t = useT();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);

  // Không có warehouse.view thì đừng gọi API chỉ để nhận 403 trên mọi lần đổi màn.
  const canRead = hasAnyWmsPermission(
    permissionCodes,
    [P.WAREHOUSE_VIEW],
    isSuperAdmin,
  );
  const query = useWarehouseDirectory({ enabled: canRead });

  const rows = query.data ?? [];
  if (!canRead || query.isLoading || query.isError || rows.length === 0) {
    return null;
  }

  // Hoa Nam vận hành đúng 01 kho tổng và chỉ một kho được ACTIVE, nên "hệ thống đang
  // chạy" ⇔ tồn tại kho ACTIVE — cùng phép đo với middleware bên BE, để dải cảnh báo
  // không bao giờ nói ngược với thứ API đang cưỡng chế.
  const paused = !rows.some(
    (row) =>
      String((row as { status?: unknown }).status ?? "")
        .trim()
        .toUpperCase() === "ACTIVE",
  );

  if (!paused) return null;

  return (
    <Box sx={{ mb: 2 }} data-testid="warehouse-paused-shell-banner">
      <UiAlert tone="warning" title={t("masterData.warehouse.pausedTitle")}>
        {t("masterData.warehouse.pausedBody")}
      </UiAlert>
    </Box>
  );
}
