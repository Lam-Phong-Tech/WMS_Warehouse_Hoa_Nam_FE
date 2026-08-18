import { Link, useParams } from "react-router-dom";
import { Button, Descriptions, Tag } from "antd";
import { PvErrorState } from "@/modules/pv/components/PvErrorState";
import { PvFreshnessIndicator } from "@/modules/pv/components/PvFreshness";
import { PvProductCard } from "@/modules/pv/components/PvProductCard";
import { PvPublicLayout } from "@/modules/pv/components/PvPublicLayout";
import { usePvProduct, usePvRecommendations } from "@/modules/pv/hooks/use-pv";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { ROUTES } from "@/shared/constants/routes";
import type { PublicApiError } from "@/shared/api/public-http";

/**
 * WWHN-252 — SCR-PV-02 (PV product detail).
 *
 * §13.8: SKU chưa publish / không ACTIVE bị BE mask bằng 404. Deep-link tới một
 * SKU nội bộ vì vậy phải rơi vào trạng thái "không tìm thấy" — KHÔNG được hiện
 * "bạn không có quyền", vì câu đó tự nó xác nhận SKU có tồn tại.
 */
export default function PvProductDetailPage() {
  const { skuId } = useParams<{ skuId: string }>();
  const product = usePvProduct(skuId);
  const primaryIndustry = product.data?.data.industries[0]?.industry_id;
  const related = usePvRecommendations(primaryIndustry);

  const notFound = (product.error as PublicApiError | undefined)?.isNotFound;
  const detail = product.data?.data;
  const specifications = Object.entries(detail?.specifications ?? {}).filter(
    ([, value]) => value !== null && value !== "" && typeof value !== "object",
  );

  return (
    <PvPublicLayout
      title={detail?.display_name ?? "Chi tiết sản phẩm"}
      subtitle={
        detail ? (
          <>
            Mã sản phẩm: {detail.sku_code}
            {detail.brand_name ? ` · ${detail.brand_name}` : ""}
          </>
        ) : null
      }
      actions={
        detail ? (
          <PvFreshnessIndicator meta={product.data?.meta} />
        ) : null
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Link to={ROUTES.PV_CATALOG} data-testid="pv-back-to-catalog">
          ← Về danh mục sản phẩm
        </Link>
      </div>

      {product.isPending ? (
        <LoadingState tip="Đang tải sản phẩm…" testId="pv-detail-loading" />
      ) : notFound ? (
        <EmptyState
          testId="pv-detail-not-found"
          title="Không tìm thấy sản phẩm"
          description="Sản phẩm không tồn tại hoặc hiện chưa được công bố."
        >
          <Link to={ROUTES.PV_CATALOG}>
            <Button>Xem danh mục sản phẩm</Button>
          </Link>
        </EmptyState>
      ) : product.isError ? (
        <PvErrorState error={product.error} onRetry={() => product.refetch()} />
      ) : detail ? (
        <>
          <section
            data-testid="pv-detail"
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              alignItems: "start",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "2px solid #2b2b2b",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  aspectRatio: "4 / 3",
                  background: "#efece3",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {detail.images[0] ? (
                  <img
                    src={detail.images[0].url}
                    alt={detail.images[0].alt_text ?? detail.display_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ color: "#a8a397", fontSize: 13 }}>
                    Chưa có ảnh sản phẩm
                  </span>
                )}
              </div>
              {detail.images.length > 1 ? (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: 8,
                    overflowX: "auto",
                  }}
                >
                  {detail.images.slice(1).map((image) => (
                    <img
                      key={image.url}
                      src={image.url}
                      alt={image.alt_text ?? detail.display_name}
                      style={{
                        width: 72,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 4,
                        flex: "0 0 auto",
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  background: "#fff",
                  border: "2px solid #2b2b2b",
                  borderRadius: 6,
                  padding: 14,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div
                  style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                >
                  <Tag
                    color={
                      detail.stock_status === "OUT_OF_STOCK" ? "default" : "green"
                    }
                    data-testid="pv-detail-stock"
                    data-stock-status={detail.stock_status}
                  >
                    {detail.stock_label}
                  </Tag>
                  <span style={{ fontSize: 13 }}>
                    Tồn khả dụng kho tổng:{" "}
                    <strong>{detail.available_qty}</strong>
                    {detail.unit ? ` ${detail.unit}` : ""}
                  </span>
                </div>
                {detail.description ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#57534a" }}>
                    {detail.description}
                  </p>
                ) : null}
                {detail.industries.length > 0 ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {detail.industries.map((industry) => (
                      <Tag key={industry.industry_id}>
                        {industry.industry_name}
                      </Tag>
                    ))}
                  </div>
                ) : null}
              </div>

              <Descriptions
                bordered
                size="small"
                column={1}
                data-testid="pv-detail-spec"
                style={{ background: "#fff" }}
                items={[
                  { key: "brand", label: "Thương hiệu", children: detail.brand_name ?? "—" },
                  { key: "category", label: "Nhóm hàng", children: detail.category_name ?? "—" },
                  { key: "model", label: "Model", children: detail.model_name ?? "—" },
                  {
                    key: "power",
                    label: "Nguồn điện",
                    children: detail.power_source_name ?? "—",
                  },
                  ...specifications.map(([key, value]) => ({
                    key: `spec-${key}`,
                    label: key,
                    children: String(value),
                  })),
                ]}
              />
            </div>
          </section>

          {(related.data?.data.length ?? 0) > 1 ? (
            <section
              data-testid="pv-detail-related"
              aria-label="Sản phẩm cùng ngành nghề"
              style={{ marginTop: 24 }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>
                Sản phẩm cùng ngành nghề
              </h2>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
                }}
              >
                {(related.data?.data ?? [])
                  .filter((item) => item.sku_id !== detail.sku_id)
                  .slice(0, 8)
                  .map((item) => (
                    <PvProductCard key={item.sku_id} product={item} />
                  ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </PvPublicLayout>
  );
}
