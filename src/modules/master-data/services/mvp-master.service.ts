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

type ProductMasterType = "BRAND" | "CATEGORY" | "MODEL";
type ProductMasterRecord = {
  master_id: string;
  master_type: ProductMasterType | "PACKAGE" | "POWER";
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

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

async function resolveMasterId(
  code: string | null | undefined,
  type: ProductMasterType,
) {
  const normalized = code?.trim();
  if (!normalized) return null;
  const result = await http.getPage<ProductMasterRecord[]>(
    API_ENDPOINTS.PRODUCT_MASTERS,
    {
      params: {
        master_type: type,
        keyword: normalized,
        status: "ACTIVE",
        per_page: 100,
      },
    },
  );
  const exact = result.data.find(
    (row) =>
      row.master_type === type &&
      row.code.toLowerCase() === normalized.toLowerCase(),
  );
  if (!exact) {
    throw new Error(
      `Không tìm thấy ${type} ACTIVE có mã "${normalized}" trong Product Master.`,
    );
  }
  return exact.master_id;
}

async function canonicalSkuPayload(payload: SkuPayload) {
  const [brandId, categoryId, modelId] = await Promise.all([
    resolveMasterId(payload.brand_code, "BRAND"),
    resolveMasterId(payload.category_code, "CATEGORY"),
    resolveMasterId(payload.model_code, "MODEL"),
  ]);
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
  // Master-link boxes are left blank on edit to mean "keep the current link"
  // (see the "Master tham chiếu" hint in ApiMasterScreens.tsx). Omitting the
  // key when blank preserves that on PATCH; sending an explicit null would
  // overwrite an existing brand/category/model/power link with nothing.
  if (payload.brand_code?.trim()) body.brand_id = brandId;
  if (payload.category_code?.trim()) body.category_id = categoryId;
  if (payload.model_code?.trim()) body.model_id = modelId;
  if (payload.power_source_code?.trim()) {
    // Current canonical schema stores the electrical descriptor as text.
    body.power_or_voltage = payload.power_source_code.trim();
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
  const [brands, categories, models] = await Promise.all([
    listCatalogRefs(API_ENDPOINTS.BRANDS, "brand_code", "brand_name"),
    listCatalogRefs(
      API_ENDPOINTS.PRODUCT_CATEGORIES,
      "category_code",
      "category_name",
    ),
    listCatalogRefs(API_ENDPOINTS.PRODUCT_MODELS, "model_code", "model_name"),
  ]);
  return { brands, categories, models };
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
  const body = await canonicalSkuPayload(payload);
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

export async function updateMvpSku(
  id: string,
  version: number,
  payload: SkuPayload,
) {
  const body = await canonicalSkuPayload(payload);
  return http.patch<SkuRecord>(API_ENDPOINTS.PRODUCT.replace(":id", id), body, {
    headers: {
      "Idempotency-Key": idempotencyKey(`sku-update-${id}`),
      "If-Match": String(version),
    },
  });
}

// REQ-SRS-020: publish/unpublish là thao tác nhanh trên danh sách, không cần mở
// lại toàn bộ form sửa SKU. BE (ProductController::assertPublishRequiresActive)
// là nguồn thực thi rule "chỉ SKU active mới publish" — lỗi 422
// SKU_PUBLISH_REQUIRES_ACTIVE khi cố publish SKU không ACTIVE.
export function setMvpSkuPublished(
  id: string,
  version: number,
  publishedToApp: boolean,
) {
  return http.patch<SkuRecord>(
    API_ENDPOINTS.PRODUCT.replace(":id", id),
    { published_to_app: publishedToApp },
    {
      headers: {
        "Idempotency-Key": idempotencyKey(`sku-publish-${id}`),
        "If-Match": String(version),
      },
    },
  );
}

export function getMvpAgencies(params: MasterListParams) {
  return listPage<AgencyRecord>(API_ENDPOINTS.AGENCIES, params);
}
export function createMvpAgency(payload: AgencyPayload) {
  return http.post<AgencyRecord>(API_ENDPOINTS.AGENCIES, payload);
}
export function updateMvpAgency(id: string, payload: AgencyPayload) {
  return http.patch<AgencyRecord>(`${API_ENDPOINTS.AGENCIES}/${id}`, payload);
}

export function getMvpDefects(params: MasterListParams) {
  return listPage<DefectRecord>(API_ENDPOINTS.DEFECT_CATALOGS, params);
}
export function createMvpDefect(payload: DefectPayload) {
  return http.post<DefectRecord>(API_ENDPOINTS.DEFECT_CATALOGS, payload);
}
export function updateMvpDefect(id: string, payload: DefectPayload) {
  return http.patch<DefectRecord>(
    `${API_ENDPOINTS.DEFECT_CATALOGS}/${id}`,
    payload,
  );
}
