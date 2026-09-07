/**
 * MÃ SKU — hiển thị thuần, KHÔNG bấm được.
 *
 * Trước đây mã SKU là link mở trang chi tiết trên App xem sản phẩm (App PV).
 * Trang đó đã được gỡ bỏ (07/09/2026), nên component này chỉ còn nhiệm vụ in mã
 * ra màn hình. Giữ lại component thay vì xoá và sửa hơn 20 chỗ gọi, để:
 *
 *  1. Quy ước ô rỗng vẫn đúng ở mọi màn: không có mã lẫn id -> EMPTY_TEXT chuẩn
 *     của dự án chứ không phải chuỗi rỗng.
 *  2. Mã dài trong ô bảng hẹp vẫn xuống dòng thay vì đẩy vỡ cột.
 *
 * `id` (sku_id) không còn tác dụng hiển thị — giữ trong props để các màn đang
 * truyền UUID không phải sửa theo.
 */
import type { ReactNode } from "react";
import { Box, type BoxProps } from "@/shared/ui";
import { EMPTY_TEXT } from "@/shared/constants/display";

export interface SkuLinkProps {
  /** Mã SKU hiển thị (sku_code). */
  code?: string | null;
  /** sku_id (UUID). Chỉ dùng để quyết định ô có nội dung hay không. */
  id?: string | null;
  /** Nội dung hiển thị thay cho mã (ví dụ "mã · tên"). Mặc định là chính mã. */
  children?: ReactNode;
  sx?: BoxProps["sx"];
}

export function SkuLink({ code, id, children, sx }: SkuLinkProps) {
  const skuCode = (code ?? "").trim();
  const skuId = (id ?? "").trim();
  const target = skuId || skuCode;

  if (target === "") {
    return <Box component="span">{children ?? EMPTY_TEXT}</Box>;
  }

  return (
    <Box
      component="span"
      data-testid="sku-code"
      sx={[
        {
          fontWeight: 600,
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
