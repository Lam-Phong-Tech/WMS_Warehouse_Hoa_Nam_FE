/**
 * MÃ SKU BẤM ĐƯỢC — mở chi tiết sản phẩm trên App xem sản phẩm (App PV).
 *
 * Dùng thay cho việc render trần `{row.sku_code}` ở mọi màn nghiệp vụ. Nhờ đi
 * qua một component duy nhất, ba quyết định dưới đây đúng ở mọi chỗ:
 *
 *  1. MỞ TAB MỚI. App PV nằm NGOÀI `ProtectedRoute` (SCR-PV-01/02 là bề mặt ẩn
 *     danh — xem app/router/index.tsx): điều hướng tại chỗ sẽ ném người dùng ra
 *     khỏi shell WMS và mất nguyên trạng thái màn đang thao tác dở (phiếu đang
 *     quét, bộ lọc, trang). Tra cứu sản phẩm là việc phụ, phải mở bên cạnh.
 *  2. `stopPropagation`. Rất nhiều bảng gắn onClick mở modal chi tiết lên cả
 *     dòng; không chặn nổi bọt thì một cú bấm vừa mở tab PV vừa bung modal.
 *  3. Ưu tiên `id` (sku_id) hơn `code`. Có UUID thì trang PV gọi thẳng
 *     `getPvProduct`; chỉ có mã thì nó phải tra thêm một lượt `listPvProducts`
 *     (xem findPvProductByCode). Truyền được UUID thì luôn truyền.
 *
 * Không có mã lẫn id -> trả về ô rỗng chuẩn của dự án, KHÔNG phải link chết.
 */
import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Box, type BoxProps } from "@/shared/ui";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import { pvProductDetailPath } from "@/modules/pv/lib/pv-paths";

export interface SkuLinkProps {
  /** Mã SKU hiển thị (sku_code). */
  code?: string | null;
  /** sku_id (UUID) khi màn hình có sẵn — link chính xác, khỏi phải tra mã. */
  id?: string | null;
  /** Nội dung hiển thị thay cho mã (ví dụ "mã · tên"). Mặc định là chính mã. */
  children?: ReactNode;
  sx?: BoxProps["sx"];
}

export function SkuLink({ code, id, children, sx }: SkuLinkProps) {
  const t = useT();
  const skuCode = (code ?? "").trim();
  const skuId = (id ?? "").trim();
  const target = skuId || skuCode;

  if (target === "") {
    return <Box component="span">{children ?? EMPTY_TEXT}</Box>;
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  };

  return (
    <Box
      component={Link}
      to={pvProductDetailPath(target)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      title={t("shared.skuLink.openTitle", { code: skuCode || target })}
      data-testid="sku-link"
      sx={[
        {
          color: "primary.main",
          textDecoration: "none",
          fontWeight: 600,
          cursor: "pointer",
          "&:hover": { textDecoration: "underline" },
          // Ô bảng hẹp: mã dài không được đẩy vỡ cột.
          wordBreak: "break-word",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children ?? (skuCode || target)}
    </Box>
  );
}
