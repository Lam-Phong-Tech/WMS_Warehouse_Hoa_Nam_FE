import { useMemo, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, UiSelect, UiTextField } from "@/shared/ui";
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";
import { PvErrorState } from "@/modules/pv/components/PvErrorState";
import { PvFreshnessIndicator } from "@/modules/pv/components/PvFreshness";
import { PvProductCard } from "@/modules/pv/components/PvProductCard";
import { PvPublicLayout } from "@/modules/pv/components/PvPublicLayout";
import { PvSwitch } from "@/modules/pv/components/PvSwitch";
import {
  usePvIndustries,
  usePvProducts,
  usePvRecommendations,
} from "@/modules/pv/hooks/use-pv";
import type { PvProductQuery } from "@/modules/pv/types/pv.types";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { ActionButton } from "@/shared/components/actions";

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
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const industryId = searchParams.get("industry_id") ?? "";
  const categoryId = searchParams.get("category_id") ?? "";
  const tagId = searchParams.get("tag_id") ?? "";
  const keywordParam = searchParams.get("keyword") ?? "";
  const inStockOnly = searchParams.get("in_stock") === "1";
  // `page` trên URL do người dùng tự sửa được: "0", "-3", "2.5", "abc" đều phải
  // về số nguyên ≥ 1, nếu không BE trả trang rỗng/422 mà màn hình không giải
  // thích được.
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const query: PvProductQuery = useMemo(
    () => ({
      keyword: keywordParam || undefined,
      industry_id: industryId || undefined,
      category_id: categoryId || undefined,
      tag_id: tagId || undefined,
      in_stock: inStockOnly || undefined,
      page,
      per_page: PER_PAGE,
    }),
    [keywordParam, industryId, categoryId, tagId, inStockOnly, page],
  );

  const products = usePvProducts(query);
  const industries = usePvIndustries();
  const recommendations = usePvRecommendations(industryId || undefined);

  // Danh mục & phân loại (tag) chưa có endpoint liệt kê công khai riêng, nên
  // options được rút từ một snapshot sản phẩm KHÔNG áp category/tag (chỉ giữ
  // ngành nghề đang chọn). Nhờ vậy dropdown vẫn đứng yên sau khi người dùng đã
  // chọn một danh mục — nếu rút từ chính danh sách đã lọc thì options sẽ tự thu
  // về đúng một mục. Việc LỌC vẫn do server thực hiện qua category_id/tag_id.
  const taxonomySnapshot = usePvProducts(
    useMemo(
      () => ({
        industry_id: industryId || undefined,
        per_page: 200,
      }),
      [industryId],
    ),
  );

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of taxonomySnapshot.data?.data ?? []) {
      // Bỏ qua nhóm hàng chưa có tên: nhãn dropdown mà rơi xuống UUID thì
      // người xem không đọc được, thà không liệt kê lựa chọn đó.
      if (product.category_id && product.category_name) {
        map.set(product.category_id, product.category_name);
      }
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [taxonomySnapshot.data]);

  const tagOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of taxonomySnapshot.data?.data ?? []) {
      for (const tag of product.tags) {
        // Tương tự: chỉ liệt kê thẻ có tên/mã đọc được, không rơi xuống UUID.
        const label = tag.tag_name || tag.tag_code;
        if (label) map.set(tag.tag_id, label);
      }
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [taxonomySnapshot.data]);

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
  const hasFilter = Boolean(
    keywordParam || industryId || categoryId || tagId || inStockOnly,
  );

  return (
    <PvPublicLayout
      title={t("pv.catalog.title")}
      subtitle={t("pv.catalog.subtitle")}
      actions={<PvFreshnessIndicator meta={meta} />}
    >
      <Box
        component="section"
        aria-label={t("pv.catalog.filterAria")}
        sx={{
          backgroundColor: S.bgSurface,
          border: `1px solid ${S.border}`,
          borderRadius: `${RADIUS.card}px`,
          boxShadow: S.shadowCard,
          padding: "12px",
          marginBottom: "16px",
          display: "grid",
          gap: "10px",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          alignItems: "center",
        }}
      >
        {/* Ô tìm kiếm để KHÔNG kiểm soát và remount theo `key` mỗi khi keyword
            trên URL đổi. Bản kiểm soát cần một useEffect đồng bộ state theo URL,
            đúng thứ react-hooks/set-state-in-effect cảnh báo, và cũng dễ trôi
            khỏi URL khi người dùng bấm back. Tìm kiếm kích hoạt bằng Enter —
            giữ ngữ nghĩa onSearch của Input.Search cũ. */}
        <UiTextField
          key={keywordParam}
          type="search"
          defaultValue={keywordParam}
          placeholder={t("pv.catalog.searchPlaceholder")}
          fullWidth
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== "Enter") return;
            const value = (event.target as HTMLInputElement).value ?? "";
            patchParams({ keyword: value.trim() || null });
          }}
          slotProps={{
            htmlInput: {
              "aria-label": t("pv.catalog.searchAria"),
              "data-testid": "pv-search-input",
              maxLength: 200,
            },
          }}
        />
        <UiSelect
          value={industryId}
          placeholder={t("pv.catalog.industryFilter")}
          aria-label={t("pv.catalog.industryFilter")}
          data-testid="pv-industry-filter"
          fullWidth
          options={(industries.data?.data ?? []).map((industry) => ({
            value: industry.industry_id,
            label: industry.industry_name,
          }))}
          onChange={(value) => patchParams({ industry_id: value || null })}
        />
        <UiSelect
          value={categoryId}
          placeholder={t("pv.catalog.categoryFilterPlaceholder")}
          aria-label={t("pv.catalog.categoryFilterAria")}
          data-testid="pv-category-filter"
          fullWidth
          options={categoryOptions}
          onChange={(value) => patchParams({ category_id: value || null })}
        />
        <UiSelect
          value={tagId}
          placeholder={t("pv.catalog.tagFilterPlaceholder")}
          aria-label={t("pv.catalog.tagFilterAria")}
          data-testid="pv-tag-filter"
          fullWidth
          options={tagOptions}
          onChange={(value) => patchParams({ tag_id: value || null })}
        />
        <Box
          component="label"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: 13,
          }}
        >
          <PvSwitch
            checked={inStockOnly}
            data-testid="pv-in-stock-filter"
            onChange={(checked) =>
              patchParams({ in_stock: checked ? "1" : null })
            }
          />
          {t("pv.catalog.inStockOnly")}
        </Box>
      </Box>

      {industryId && (recommendations.data?.data.length ?? 0) > 0 ? (
        <Box
          component="section"
          aria-label={t("pv.catalog.recommendationsAria")}
          data-testid="pv-recommendations"
          sx={{ marginBottom: "20px" }}
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
            {t("pv.catalog.recommendationsTitle")}
          </Box>
          <Box
            sx={{
              display: "grid",
              gap: "12px",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
            }}
          >
            {(recommendations.data?.data ?? []).map((product) => (
              <PvProductCard key={`rec-${product.sku_id}`} product={product} />
            ))}
          </Box>
        </Box>
      ) : null}

      {products.isPending ? (
        <LoadingState tip={t("pv.catalog.loading")} testId="pv-list-loading" />
      ) : products.isError ? (
        <PvErrorState
          error={products.error}
          onRetry={() => products.refetch()}
        />
      ) : (products.data?.data.length ?? 0) === 0 ? (
        <EmptyState
          testId="pv-list-empty"
          title={
            hasFilter
              ? t("pv.catalog.emptyFilteredTitle")
              : t("pv.catalog.emptyTitle")
          }
          description={
            hasFilter
              ? t("pv.catalog.emptyFilteredDesc")
              : t("pv.catalog.emptyDesc")
          }
        >
          {hasFilter ? (
            <ActionButton
              kind="reset"
              data-testid="pv-clear-filters"
              onClick={() =>
                patchParams({
                  keyword: null,
                  industry_id: null,
                  category_id: null,
                  tag_id: null,
                  in_stock: null,
                })
              }
            >
              {t("pv.catalog.clearFilters")}
            </ActionButton>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <Box
            data-testid="pv-product-grid"
            sx={{
              display: "grid",
              gap: "12px",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
            }}
          >
            {(products.data?.data ?? []).map((product) => (
              <PvProductCard key={product.sku_id} product={product} />
            ))}
          </Box>

          <Box
            component="nav"
            aria-label={t("pv.catalog.paginationAria")}
            sx={{
              marginTop: "16px",
              display: "flex",
              gap: "10px",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <ActionButton
              kind="back"
              disabled={page <= 1}
              data-testid="pv-prev-page"
              onClick={() => patchParams({ page: String(page - 1) })}
            >
              {t("pv.catalog.prevPage")}
            </ActionButton>
            <Box component="span" sx={{ fontSize: 13, color: S.textMedium }}>
              {t("pv.catalog.pageInfo", { page, lastPage, total })}
            </Box>
            <ActionButton
              kind="next"
              disabled={page >= lastPage}
              data-testid="pv-next-page"
              onClick={() => patchParams({ page: String(page + 1) })}
            >
              {t("pv.catalog.nextPage")}
            </ActionButton>
          </Box>
        </>
      )}
    </PvPublicLayout>
  );
}
