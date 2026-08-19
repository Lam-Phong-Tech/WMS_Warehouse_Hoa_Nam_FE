import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Select, Switch } from "antd";
import { PvErrorState } from "@/modules/pv/components/PvErrorState";
import { PvFreshnessIndicator } from "@/modules/pv/components/PvFreshness";
import { PvProductCard } from "@/modules/pv/components/PvProductCard";
import { PvPublicLayout } from "@/modules/pv/components/PvPublicLayout";
import {
  usePvIndustries,
  usePvProducts,
  usePvRecommendations,
} from "@/modules/pv/hooks/use-pv";
import type { PvProductQuery } from "@/modules/pv/types/pv.types";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { LoadingState } from "@/shared/components/data-display/LoadingState";

const PER_PAGE = 12;

/**
 * WWHN-252 — SCR-PV-01 (PV product list).
 *
 * REQ-SRS-017: tìm kiếm + lọc + phân trang, responsive desktop/tablet/mobile.
 * REQ-SRS-018/036: hiển thị available_qty kho tổng, tồn 0 vẫn hiện.
 * REQ-SRS-019: khối gợi ý theo ngành nghề xuất hiện khi người xem chọn ngành.
 *
 * Bộ lọc được giữ trên URL (useSearchParams) chứ không chỉ trong state React:
 * trang công khai phải chia sẻ được bằng link, và deep-link cũng chính là thứ
 * QA2 dùng để chụp lại đúng một trạng thái lọc.
 */
export default function PvCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const industryId = searchParams.get("industry_id") ?? "";
  const keywordParam = searchParams.get("keyword") ?? "";
  const inStockOnly = searchParams.get("in_stock") === "1";
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const query: PvProductQuery = useMemo(
    () => ({
      keyword: keywordParam || undefined,
      industry_id: industryId || undefined,
      in_stock: inStockOnly || undefined,
      page,
      per_page: PER_PAGE,
    }),
    [keywordParam, industryId, inStockOnly, page],
  );

  const products = usePvProducts(query);
  const industries = usePvIndustries();
  const recommendations = usePvRecommendations(industryId || undefined);

  function patchParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    // Đổi bộ lọc phải quay về trang 1, nếu không người dùng rơi vào trang trống.
    if (!("page" in next)) params.delete("page");
    setSearchParams(params, { replace: true });
  }

  const meta = products.data?.meta;
  const total = meta?.total ?? 0;
  const lastPage = meta?.last_page ?? 1;
  const hasFilter = Boolean(keywordParam || industryId || inStockOnly);

  return (
    <PvPublicLayout
      title="Sản phẩm Hòa Nam"
      subtitle={
        <>
          Danh mục sản phẩm đang được công bố. Số lượng là tồn khả dụng của kho
          tổng.
        </>
      }
      actions={<PvFreshnessIndicator meta={meta} />}
    >
      <section
        aria-label="Bộ lọc sản phẩm"
        style={{
          background: "#fff",
          border: "2px solid #2b2b2b",
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
          display: "grid",
          gap: 10,
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          alignItems: "center",
        }}
      >
        {/* Ô tìm kiếm để KHÔNG kiểm soát và remount theo `key` mỗi khi keyword
            trên URL đổi. Bản kiểm soát cần một useEffect đồng bộ state theo URL,
            đúng thứ react-hooks/set-state-in-effect cảnh báo, và cũng dễ trôi
            khỏi URL khi người dùng bấm back. */}
        <Input.Search
          key={keywordParam}
          allowClear
          defaultValue={keywordParam}
          placeholder="Tìm theo tên hoặc mã sản phẩm"
          data-testid="pv-search-input"
          onSearch={(value) => patchParams({ keyword: value.trim() || null })}
        />
        <Select
          allowClear
          value={industryId || undefined}
          placeholder="Lọc theo ngành nghề"
          data-testid="pv-industry-filter"
          loading={industries.isLoading}
          options={(industries.data?.data ?? []).map((industry) => ({
            value: industry.industry_id,
            label: industry.industry_name,
          }))}
          onChange={(value) => patchParams({ industry_id: value ?? null })}
          style={{ width: "100%" }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
          }}
        >
          <Switch
            checked={inStockOnly}
            data-testid="pv-in-stock-filter"
            onChange={(checked) =>
              patchParams({ in_stock: checked ? "1" : null })
            }
          />
          Chỉ hiện sản phẩm còn hàng
        </label>
      </section>

      {industryId && (recommendations.data?.data.length ?? 0) > 0 ? (
        <section
          aria-label="Gợi ý theo ngành nghề"
          data-testid="pv-recommendations"
          style={{ marginBottom: 20 }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>
            Gợi ý cho ngành nghề đã chọn
          </h2>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
            }}
          >
            {(recommendations.data?.data ?? []).map((product) => (
              <PvProductCard key={`rec-${product.sku_id}`} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {products.isPending ? (
        <LoadingState
          tip="Đang tải danh mục sản phẩm…"
          testId="pv-list-loading"
        />
      ) : products.isError ? (
        <PvErrorState
          error={products.error}
          onRetry={() => products.refetch()}
        />
      ) : (products.data?.data.length ?? 0) === 0 ? (
        <EmptyState
          testId="pv-list-empty"
          title={
            hasFilter ? "Không có sản phẩm phù hợp" : "Chưa có sản phẩm công bố"
          }
          description={
            hasFilter
              ? "Thử bỏ bớt bộ lọc hoặc tìm bằng từ khoá khác."
              : "Danh mục sẽ hiển thị ngay khi có sản phẩm được công bố."
          }
        >
          {hasFilter ? (
            <Button
              data-testid="pv-clear-filters"
              onClick={() =>
                patchParams({
                  keyword: null,
                  industry_id: null,
                  in_stock: null,
                })
              }
            >
              Xoá bộ lọc
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <div
            data-testid="pv-product-grid"
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
            }}
          >
            {(products.data?.data ?? []).map((product) => (
              <PvProductCard key={product.sku_id} product={product} />
            ))}
          </div>

          <nav
            aria-label="Phân trang"
            style={{
              marginTop: 16,
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              disabled={page <= 1}
              data-testid="pv-prev-page"
              onClick={() => patchParams({ page: String(page - 1) })}
            >
              ← Trang trước
            </Button>
            <span style={{ fontSize: 13, color: "#57534a" }}>
              Trang {page}/{lastPage} · {total} sản phẩm
            </span>
            <Button
              disabled={page >= lastPage}
              data-testid="pv-next-page"
              onClick={() => patchParams({ page: String(page + 1) })}
            >
              Trang sau →
            </Button>
          </nav>
        </>
      )}
    </PvPublicLayout>
  );
}
