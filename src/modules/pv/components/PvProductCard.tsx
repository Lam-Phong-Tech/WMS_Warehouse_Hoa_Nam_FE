import { Link } from "react-router-dom";
import { Tag } from "antd";
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
  const outOfStock = product.stock_status === "OUT_OF_STOCK";
  const primaryImage =
    product.images.find((image) => image.is_primary) ?? product.images[0];

  return (
    <Link
      to={pvProductDetailPath(product.sku_id)}
      data-testid="pv-product-card"
      data-sku-code={product.sku_code}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "2px solid #2b2b2b",
        borderRadius: 6,
        boxShadow: "4px 5px 0 rgba(43,43,43,.10)",
        color: "inherit",
        textDecoration: "none",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <div
        style={{
          aspectRatio: "4 / 3",
          background: "#efece3",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.alt_text ?? product.display_name}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ color: "#a8a397", fontSize: 12 }}>Chưa có ảnh</span>
        )}
      </div>

      <div style={{ padding: 12, display: "grid", gap: 6, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>
          {product.display_name}
        </div>
        <div style={{ fontSize: 12, color: "#7a766c" }}>
          Mã: {product.sku_code}
          {product.brand_name ? ` · ${product.brand_name}` : ""}
        </div>
        {product.power_source_name ? (
          <div style={{ fontSize: 12, color: "#7a766c" }}>
            Nguồn điện: {product.power_source_name}
          </div>
        ) : null}

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Tag
            color={outOfStock ? "default" : "green"}
            data-testid="pv-stock-badge"
            data-stock-status={product.stock_status}
            style={{ marginInlineEnd: 0 }}
          >
            {product.stock_label}
          </Tag>
          <span style={{ fontSize: 12, color: "#57534a" }}>
            Tồn khả dụng: <strong>{product.available_qty}</strong>
            {product.unit ? ` ${product.unit}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
