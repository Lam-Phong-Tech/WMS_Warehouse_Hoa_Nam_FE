import { publicHttp } from "@/shared/api/public-http";
import { PV_API_ENDPOINTS } from "@/modules/pv/services/pv-endpoints";
import type {
  PvIndustry,
  PvPage,
  PvProduct,
  PvProductQuery,
} from "@/modules/pv/types/pv.types";

/**
 * WWHN-252 — Annex C listPvProducts / getPvProduct / listPvIndustries /
 * listPvRecommendations. Toàn bộ nhóm này là `security: []` nên đi qua
 * `publicHttp` (không gắn Bearer, không redirect /login) — xem docblock của
 * shared/api/public-http.ts.
 */

/**
 * BE trả 400 INVALID_QUERY cho tham số sai (error set PV là 400/404/429/500,
 * KHÔNG có 422), nên FE phải bỏ hẳn giá trị rỗng thay vì gửi chuỗi "" và nhận
 * lỗi 400 cho một bộ lọc mà người dùng chưa hề chọn.
 */
function cleanQuery(query: PvProductQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean") {
      if (value) params[key] = 1;
      continue;
    }
    params[key] = value as string | number;
  }
  return params;
}

export async function getPvProducts(
  query: PvProductQuery,
): Promise<PvPage<PvProduct>> {
  const result = await publicHttp.get<PvProduct[]>(PV_API_ENDPOINTS.PRODUCTS, {
    params: cleanQuery(query),
  });
  return { data: result.data ?? [], meta: result.meta };
}

export async function getPvProduct(
  skuId: string,
): Promise<{ data: PvProduct; meta: PvPage<PvProduct>["meta"] }> {
  const result = await publicHttp.get<PvProduct>(
    PV_API_ENDPOINTS.PRODUCT_DETAIL(skuId),
  );
  return { data: result.data, meta: result.meta };
}

/**
 * Tra sản phẩm PV theo MÃ SKU (không phải sku_id).
 *
 * Annex C không có operation "lấy theo mã": `getPvProduct` chỉ nhận UUID và BE
 * trả thẳng 400 INVALID_PATH cho chuỗi khác. Nhưng phần lớn màn hình nghiệp vụ
 * chỉ có mã SKU trong tay (warranty_case lưu mã, dòng phiếu nhập/xuất hiển thị
 * mã), nên link "xem sản phẩm" phải đi được từ mã. Dùng chính `listPvProducts`
 * với `keyword` — endpoint public đã có sẵn, không phải mở thêm bề mặt API.
 *
 * Khớp CHÍNH XÁC `sku_code` (không phân biệt hoa thường) chứ không lấy kết quả
 * đầu tiên: `keyword` là tìm mờ, "HN-COMP-01" cũng khớp "HN-COMP-011" — mở nhầm
 * sang một sản phẩm khác còn tệ hơn là báo không tìm thấy.
 */
export async function findPvProductByCode(
  skuCode: string,
): Promise<PvProduct | null> {
  const needle = skuCode.trim().toLowerCase();
  if (needle === "") return null;
  const page = await getPvProducts({ keyword: skuCode.trim(), per_page: 50 });
  return (
    page.data.find((item) => item.sku_code.trim().toLowerCase() === needle) ??
    null
  );
}

export async function getPvIndustries(): Promise<PvPage<PvIndustry>> {
  const result = await publicHttp.get<PvIndustry[]>(
    PV_API_ENDPOINTS.INDUSTRIES,
    { params: { per_page: 50 } },
  );
  return { data: result.data ?? [], meta: result.meta };
}

export async function getPvRecommendations(
  industryId: string,
): Promise<PvPage<PvProduct>> {
  const result = await publicHttp.get<PvProduct[]>(
    PV_API_ENDPOINTS.RECOMMENDATIONS,
    { params: { industry_id: industryId, per_page: 12 } },
  );
  return { data: result.data ?? [], meta: result.meta };
}
