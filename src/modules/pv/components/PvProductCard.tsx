import { Link } from "react-router-dom";
import { Box, UiStatusBadge } from "@/shared/ui";
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";
import { pvProductDetailPath } from "@/modules/pv/lib/pv-paths";
import type { PvProduct } from "@/modules/pv/types/pv.types";

/**
 * WWHN-252 / SCR-PV-01 — thẻ sản phẩm trên danh sách công khai.
 *
 * DEC-CATALOG-001 / REQ-SRS-036: SKU đã publish nhưng tồn 0 VẪN hiển thị, kèm
 * nhãn "Chưa có hàng" do BE trả (`stock_label`) chứ không phải chuỗi FE tự đặt
 * — nếu FE tự sinh nhãn thì hai tầng sẽ trôi khỏi nhau theo thời gian.
 */
export function PvProductCard({ product }: { product: PvProduct }) {
  const t = useT();
  const outOfStock = product.stock_status === "OUT_OF_STOCK";
  const primaryImage =
    product.images.find((image) => image.is_primary) ?? product.images[0];

  return (
    <Box
      component={Link}
      to={pvProductDetailPath(product.sku_id)}
      data-testid="pv-product-card"
      data-sku-code={product.sku_code}
      sx={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: S.bgSurface,
        border: `1px solid ${S.border}`,
        borderRadius: `${RADIUS.card}px`,
        boxShadow: S.shadowCard,
        color: "inherit",
        textDecoration: "none",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <Box
        sx={{
          aspectRatio: "4 / 3",
          backgroundColor: S.bgSubtle,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {primaryImage ? (
          <Box
            component="img"
            src={primaryImage.url}
            alt={primaryImage.alt_text ?? product.display_name}
            loading="lazy"
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box component="span" sx={{ color: S.textDisabled, fontSize: 12 }}>
            {t("pv.card.noImage")}
          </Box>
        )}
      </Box>

      <Box sx={{ padding: "12px", display: "grid", gap: "6px", flex: 1 }}>
        <Box sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>
          {product.display_name}
        </Box>
        <Box sx={{ fontSize: 12, color: S.textMedium }}>
          {t("pv.card.code", { code: product.sku_code })}
          {product.brand_name ? ` · ${product.brand_name}` : ""}
        </Box>
        {product.power_source_name ? (
          <Box sx={{ fontSize: 12, color: S.textMedium }}>
            {t("pv.card.powerSource", { name: product.power_source_name })}
          </Box>
        ) : null}

        <Box
          sx={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <UiStatusBadge
            tone={outOfStock ? "neutral" : "success"}
            label={product.stock_label}
            data-testid="pv-stock-badge"
            data-stock-status={product.stock_status}
          />
          <Box component="span" sx={{ fontSize: 12, color: S.textMedium }}>
            {t("pv.card.availableQty")} <strong>{product.available_qty}</strong>
            {product.unit ? ` ${product.unit}` : ""}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
