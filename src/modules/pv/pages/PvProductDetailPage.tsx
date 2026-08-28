import { Link, useParams } from "react-router-dom";
import { Box, UiDescriptions, UiStatusBadge } from "@/shared/ui";
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { PvErrorState } from "@/modules/pv/components/PvErrorState";
import { PvFreshnessIndicator } from "@/modules/pv/components/PvFreshness";
import { PvProductCard } from "@/modules/pv/components/PvProductCard";
import { PvPublicLayout } from "@/modules/pv/components/PvPublicLayout";
import { usePvProduct, usePvRecommendations } from "@/modules/pv/hooks/use-pv";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { ROUTES } from "@/shared/constants/routes";
import type { PublicApiError } from "@/shared/api/public-http";
import { ActionButton } from "@/shared/components/actions";

/** Surface trắng token-hoá dùng chung trong màn chi tiết PV. */
const CARD_SX = {
  backgroundColor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
  boxShadow: S.shadowCard,
} as const;

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
        detail ? <PvFreshnessIndicator meta={product.data?.meta} /> : null
      }
    >
      <Box sx={{ marginBottom: "12px" }}>
        <Link to={ROUTES.PV_CATALOG} data-testid="pv-back-to-catalog">
          ← Về danh mục sản phẩm
        </Link>
      </Box>

      {product.isPending ? (
        <LoadingState tip="Đang tải sản phẩm…" testId="pv-detail-loading" />
      ) : notFound ? (
        <EmptyState
          testId="pv-detail-not-found"
          title="Không tìm thấy sản phẩm"
          description="Sản phẩm không tồn tại hoặc hiện chưa được công bố."
        >
          <Link to={ROUTES.PV_CATALOG}>
            <ActionButton kind="view">Xem danh mục sản phẩm</ActionButton>
          </Link>
        </EmptyState>
      ) : product.isError ? (
        <PvErrorState error={product.error} onRetry={() => product.refetch()} />
      ) : detail ? (
        <>
          <Box
            component="section"
            data-testid="pv-detail"
            sx={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              alignItems: "start",
            }}
          >
            <Box sx={{ ...CARD_SX, overflow: "hidden" }}>
              <Box
                sx={{
                  aspectRatio: "4 / 3",
                  backgroundColor: S.bgSubtle,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {detail.images[0] ? (
                  <Box
                    component="img"
                    src={detail.images[0].url}
                    alt={detail.images[0].alt_text ?? detail.display_name}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Box
                    component="span"
                    sx={{ color: S.textDisabled, fontSize: 13 }}
                  >
                    Chưa có ảnh sản phẩm
                  </Box>
                )}
              </Box>
              {detail.images.length > 1 ? (
                <Box
                  sx={{
                    display: "flex",
                    gap: "8px",
                    padding: "8px",
                    overflowX: "auto",
                  }}
                >
                  {detail.images.slice(1).map((image) => (
                    <Box
                      component="img"
                      key={image.url}
                      src={image.url}
                      alt={image.alt_text ?? detail.display_name}
                      sx={{
                        width: 72,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: `${RADIUS.control}px`,
                        flex: "0 0 auto",
                      }}
                    />
                  ))}
                </Box>
              ) : null}
            </Box>

            <Box sx={{ display: "grid", gap: "12px" }}>
              <Box
                sx={{
                  ...CARD_SX,
                  padding: "14px",
                  display: "grid",
                  gap: "8px",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <UiStatusBadge
                    tone={
                      detail.stock_status === "OUT_OF_STOCK"
                        ? "neutral"
                        : "success"
                    }
                    label={detail.stock_label}
                    data-testid="pv-detail-stock"
                    data-stock-status={detail.stock_status}
                  />
                  <Box component="span" sx={{ fontSize: 13 }}>
                    Tồn khả dụng kho tổng:{" "}
                    <strong>{detail.available_qty}</strong>
                    {detail.unit ? ` ${detail.unit}` : ""}
                  </Box>
                </Box>
                {detail.description ? (
                  <Box
                    component="p"
                    sx={{ margin: 0, fontSize: 13, color: S.textMedium }}
                  >
                    {detail.description}
                  </Box>
                ) : null}
                {detail.industries.length > 0 ? (
                  <Box sx={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {detail.industries.map((industry) => (
                      <UiStatusBadge
                        key={industry.industry_id}
                        tone="neutral"
                        label={industry.industry_name}
                      />
                    ))}
                  </Box>
                ) : null}
              </Box>

              <Box
                data-testid="pv-detail-spec"
                sx={{ ...CARD_SX, padding: "14px" }}
              >
                <UiDescriptions
                  columns={1}
                  items={[
                    {
                      label: "Thương hiệu",
                      value: detail.brand_name ?? "—",
                    },
                    {
                      label: "Nhóm hàng",
                      value: detail.category_name ?? "—",
                    },
                    {
                      label: "Model",
                      value: detail.model_name ?? "—",
                    },
                    {
                      label: "Nguồn điện",
                      value: detail.power_source_name ?? "—",
                    },
                    ...specifications.map(([key, value]) => ({
                      label: key,
                      value: String(value),
                    })),
                  ]}
                />
              </Box>
            </Box>
          </Box>

          {(related.data?.data.length ?? 0) > 1 ? (
            <Box
              component="section"
              data-testid="pv-detail-related"
              aria-label="Sản phẩm cùng ngành nghề"
              sx={{ marginTop: "24px" }}
            >
              <Box
                component="h2"
                sx={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: S.textHigh,
                  margin: "0 0 8px",
                }}
              >
                Sản phẩm cùng ngành nghề
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: "12px",
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
              </Box>
            </Box>
          ) : null}
        </>
      ) : null}
    </PvPublicLayout>
  );
}
