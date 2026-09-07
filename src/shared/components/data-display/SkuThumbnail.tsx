/**
 * ẢNH THU NHỎ CỦA MÃ HÀNG — dùng chung cho mọi bảng/thẻ nghiệp vụ trong WMS.
 *
 * Kho Hoa Nam có 992 mã DongCheng, trong đó hàng chục mã cùng một họ chỉ khác
 * nhau ở cỡ ("Kìm mũi dài 6/7/8 inch") hoặc ở đuôi mã máy (DCPB298 / DCPB298S).
 * Nhân viên kho nhận diện bằng HÌNH nhanh hơn nhiều so với đọc mã, nên mọi màn
 * có danh sách hàng hoá đều nên hiện ảnh.
 *
 * Ba quyết định gói ở đây để không phải lặp lại ở từng màn:
 *  1. `objectFit: contain` — ảnh catalog là 2400×1800 nền trắng; `cover` sẽ cắt
 *     cụt đầu/đuôi máy (đúng lý do đã ghi ở PvProductCard).
 *  2. Ảnh hỏng/URL chết -> tự chuyển về ô giữ chỗ, KHÔNG để icon vỡ của trình
 *     duyệt lọt vào bảng.
 *  3. `loading="lazy"` + kích thước cố định: bảng 100 dòng không kéo về 100 ảnh
 *     cùng lúc và không bị nhảy layout khi ảnh về.
 */
import { useState } from "react";
import { Box } from "@/shared/ui";
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";

export interface SkuThumbnailProps {
  /** URL ảnh chính (BE trả `image_url`). Rỗng/undefined -> ô giữ chỗ. */
  url?: string | null;
  /** Tên hàng, dùng cho alt/title. */
  name?: string | null;
  /** Cạnh của ô ảnh (px). Mặc định 40 — vừa chiều cao một dòng bảng. */
  size?: number;
}

export function SkuThumbnail({ url, name, size = 40 }: SkuThumbnailProps) {
  const t = useT();
  const src = (url ?? "").trim();

  // Nhớ ĐÚNG URL đã hỏng chứ không phải một cờ boolean: ô này bị tái dùng khi
  // đổi trang/bộ lọc, một cờ boolean sẽ "dính" lỗi sang ảnh mới. So sánh theo
  // URL cũng tránh phải reset bằng useEffect (cascading render).
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = src !== "" && failedSrc === src;

  const shell = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: `${RADIUS.control}px`,
    border: `1px solid ${S.border}`,
    backgroundColor: S.bgSubtle,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  } as const;

  if (src === "" || failed) {
    return (
      <Box
        sx={shell}
        data-testid="sku-thumbnail-empty"
        title={t("shared.skuThumbnail.noImage")}
        aria-label={t("shared.skuThumbnail.noImage")}
      >
        <Box
          component="span"
          aria-hidden
          sx={{ color: S.textDisabled, fontSize: Math.round(size * 0.45) }}
        >
          ▤
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={shell} data-testid="sku-thumbnail">
      <Box
        component="img"
        src={src}
        alt={name ?? t("shared.skuThumbnail.alt")}
        title={name ?? undefined}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        sx={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Box>
  );
}
