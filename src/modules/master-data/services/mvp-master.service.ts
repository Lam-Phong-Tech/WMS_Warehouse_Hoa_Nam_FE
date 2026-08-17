import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  AgencyPayload,
  AgencyRecord,
  CatalogRefRecord,
  DefectPayload,
  DefectRecord,
  MasterListParams,
  MasterPageResult,
  ProductCatalogRefs,
  SkuPayload,
  SkuRecord,
} from "@/modules/master-data/types/mvp-master.types";

function cleanParams(params: MasterListParams) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

function idempotencyKey(operation: string) {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `fe:${operation}:${uuid}`;
}

async function listPage<T>(
  endpoint: string,
  params: MasterListParams,
): Promise<MasterPageResult<T>> {
  const result = await http.getPage<T[]>(endpoint, {
    params: cleanParams({ ...params, per_page: params.per_page ?? 100 }),
  });
  return { data: result.data, meta: result.meta };
}

/**
 * MST-02 nay chọn master bằng dropdown nên FE gửi thẳng id canonical
 * (ERD bảng 16: skus.brand_id/category_id/model_id/power_source_id/
 * package_variant_id). Trước đây FE nhập mã dạng text rồi tự tra
 * /product-masters để đổi ra id — vừa thêm round-trip vừa không chạm được tới
 * hai FK power_source_id / package_variant_id.
 *
 * Chuỗi rỗng nghĩa là "không gán / gỡ liên kết" và được gửi null tường minh;
 * `undefined` (field không có trong form) thì bỏ hẳn khỏi payload.
 */
function canonicalSkuPayload(payload: SkuPayload) {
  const body: Record<string, unknown> = {
    sku_code: payload.code.trim(),
    sku_name: payload.name.trim(),
    sku_type: payload.sku_type,
    unit: payload.unit?.trim() || null,
    is_serial_tracked: payload.is_serial_tracked,
    status: payload.status,
  };
  if (payload.published_to_app !== undefined)
    body.published_to_app = payload.published_to_app;
  // version_code là master phiên bản của SKU: để trống nghĩa là "giữ nguyên",
  // không phải "xoá" — gửi null sẽ làm mất giá trị đang có.
  if (payload.version_code?.trim())
    body.version_code = payload.version_code.trim();

  const masterLinks: Array<[string, string | null | undefined]> = [
    ["brand_id", payload.brand_id],
    ["category_id", payload.category_id],
    ["model_id", payload.model_id],
    ["power_source_id", payload.power_source_id],
    ["package_variant_id", payload.package_variant_id],
  ];
  for (const [key, value] of masterLinks) {
    if (value === undefined) continue;
    body[key] = value?.trim() ? value.trim() : null;
  }

  return body;
}

export function getMvpSkus(params: MasterListParams) {
  return listPage<SkuRecord>(API_ENDPOINTS.PRODUCTS, params);
}

// MST-01 (wireframe: toolbar "Hãng" + cột "Hãng"): danh sách SKU chỉ trả về
// brand_id/category_id/model_id, nên phải nạp danh mục để map id -> tên.
// Thiếu quyền catalog.view hoặc lỗi mạng thì fail-open bằng danh sách rỗng —
// bảng vẫn hiển thị được (rơi về mã rút gọn) thay vì chặn cả màn hình.
async function listCatalogRefs(
  endpoint: string,
  codeKey: string,
  nameKey: string,
): Promise<CatalogRefRecord[]> {
  try {
    const result = await http.getPage<Array<Record<string, unknown>>>(
      endpoint,
      {
        params: { status: "ACTIVE", per_page: 200 },
      },
    );
    return (result.data ?? [])
      .map((row) => ({
        id: String(row.id ?? ""),
        code: String(row[codeKey] ?? ""),
        name: String(row[nameKey] ?? ""),
      }))
      .filter((row) => Boolean(row.id));
  } catch {
    return [];
  }
}

export async function getMvpProductCatalogs(): Promise<ProductCatalogRefs> {
  const [brands, categories, models, powerSources, packageVariants] =
    await Promise.all([
      listCatalogRefs(API_ENDPOINTS.BRANDS, "brand_code", "brand_name"),
      listCatalogRefs(
        API_ENDPOINTS.PRODUCT_CATEGORIES,
        "category_code",
        "category_name",
      ),
      listCatalogRefs(API_ENDPOINTS.PRODUCT_MODELS, "model_code", "model_name"),
      listCatalogRefs(
        API_ENDPOINTS.POWER_SOURCES,
        "power_source_code",
        "power_source_name",
      ),
      listCatalogRefs(
        API_ENDPOINTS.PACKAGE_VARIANTS,
        "package_code",
        "package_name",
      ),
    ]);
  return { brands, categories, models, powerSources, packageVariants };
}

// BR-SKU-10: BE khoá sku_code/is_serial_tracked khi SKU đã có stock/movement
// (xem ProductController::assertImmutableAfterStock ở BE — nguồn thực thi rule).
// Hàm này chỉ là tín hiệu best-effort để form khoá field TRƯỚC khi submit, dựa
// trên on_hand_qty hiện tại; không bắt được ca "đã có movement nhưng tồn về 0",
// nên lỗi/permission-thiếu đều fail-open (không khoá) — BE vẫn là chốt chặn cuối.
export async function hasMvpSkuStock(skuId: string): Promise<boolean> {
  if (!skuId) return false;
  try {
    const result = await http.getPage<Array<{ on_hand_qty?: number | string }>>(
      API_ENDPOINTS.INVENTORY_BALANCES,
      { params: { product_id: skuId } },
    );
    return (result.data ?? []).some((row) => Number(row.on_hand_qty ?? 0) > 0);
  } catch {
    return false;
  }
}

export async function createMvpSku(payload: SkuPayload) {
  const body = canonicalSkuPayload(payload);
  const created = await http.post<SkuRecord>(API_ENDPOINTS.PRODUCTS, body, {
    headers: { "Idempotency-Key": idempotencyKey("sku-create") },
  });
  if (payload.status === "INACTIVE" && created.status !== "INACTIVE") {
    return http.patch<SkuRecord>(
      API_ENDPOINTS.PRODUCT.replace(":id", created.sku_id),
      {
        status: "INACTIVE",
      },
    );
  }
  return created;
}

export function updateMvpSku(id: string, version: number, payload: SkuPayload) {
  const body = canonicalSkuPayload(payload);
  return http.patch<SkuRecord>(API_ENDPOINTS.PRODUCT.replace(":id", id), body, {
    headers: {
      "Idempotency-Key": idempotencyKey(`sku-update-${id}`),
      "If-Match": String(version),
    },
  });
}

// REQ-SRS-020 + Annex C publishPvProduct: publish/unpublish đi qua endpoint riêng
// `PATCH /pv/products/{id}/publish` với quyền `pv.publish` (SRS §3 tách khỏi
// sku.manage), không phải PATCH /products. BE
// (ProductController::assertPublishRequiresActive) vẫn là nguồn thực thi rule
// "chỉ SKU ACTIVE mới publish".
export function setMvpSkuPublished(
  id: string,
  version: number,
  publishedToApp: boolean,
) {
  return http.patch<SkuRecord>(
    API_ENDPOINTS.PV_PRODUCT_PUBLISH.replace(":id", id),
    { published: publishedToApp },
    {
      headers: {
        "Idempotency-Key": idempotencyKey(`sku-publish-${id}`),
        "If-Match": String(version),
      },
    },
  );
}

/**
 * ERD bảng 9/15 (agencies.version, defect_catalog.version) + Annex C
 * updateAgency/updateDefect: PATCH gửi If-Match để BE trả 412 STALE_VERSION khi
 * bản ghi đã đổi ở phiên khác, thay vì âm thầm ghi đè. Bản ghi không có version
 * (API cũ) thì bỏ header — BE chỉ enforce khi client gửi.
 */
function ifMatchConfig(version?: number | null) {
  return version === null || version === undefined
    ? undefined
    : { headers: { "If-Match": String(version) } };
}

export function getMvpAgencies(params: MasterListParams) {
  return listPage<AgencyRecord>(API_ENDPOINTS.AGENCIES, params);
}
export function createMvpAgency(payload: AgencyPayload) {
  return http.post<AgencyRecord>(API_ENDPOINTS.AGENCIES, payload);
}
export function updateMvpAgency(
  id: string,
  payload: AgencyPayload,
  version?: number | null,
) {
  return http.patch<AgencyRecord>(
    `${API_ENDPOINTS.AGENCIES}/${id}`,
    payload,
    ifMatchConfig(version),
  );
}

export function getMvpDefects(params: MasterListParams) {
  return listPage<DefectRecord>(API_ENDPOINTS.DEFECT_CATALOGS, params);
}
export function createMvpDefect(payload: DefectPayload) {
  return http.post<DefectRecord>(API_ENDPOINTS.DEFECT_CATALOGS, payload);
}
export function updateMvpDefect(
  id: string,
  payload: DefectPayload,
  version?: number | null,
) {
  return http.patch<DefectRecord>(
    `${API_ENDPOINTS.DEFECT_CATALOGS}/${id}`,
    payload,
    ifMatchConfig(version),
  );
}
