import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  AgencyPayload,
  AgencyRecord,
  DefectPayload,
  DefectRecord,
  MasterListParams,
  MasterPageResult,
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
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function idempotencyKey(operation: string) {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `fe:${operation}:${uuid}`;
}

async function listPage<T>(endpoint: string, params: MasterListParams): Promise<MasterPageResult<T>> {
  const result = await http.getPage<T[]>(endpoint, {
    params: cleanParams({ ...params, per_page: params.per_page ?? 100 }),
  });
  return { data: result.data, meta: result.meta };
}

async function resolveMasterId(code: string | null | undefined, type: ProductMasterType) {
  const normalized = code?.trim();
  if (!normalized) return null;
  const result = await http.getPage<ProductMasterRecord[]>(API_ENDPOINTS.PRODUCT_MASTERS, {
    params: { master_type: type, keyword: normalized, status: "ACTIVE", per_page: 100 },
  });
  const exact = result.data.find(
    (row) => row.master_type === type && row.code.toLowerCase() === normalized.toLowerCase(),
  );
  if (!exact) {
    throw new Error(`Không tìm thấy ${type} ACTIVE có mã "${normalized}" trong Product Master.`);
  }
  return exact.master_id;
}

async function canonicalSkuPayload(payload: SkuPayload) {
  const [brandId, categoryId, modelId] = await Promise.all([
    resolveMasterId(payload.brand_code, "BRAND"),
    resolveMasterId(payload.category_code, "CATEGORY"),
    resolveMasterId(payload.model_code, "MODEL"),
  ]);
  return {
    sku_code: payload.code.trim(),
    sku_name: payload.name.trim(),
    sku_type: payload.sku_type,
    unit: payload.unit?.trim() || null,
    is_serial_tracked: payload.is_serial_tracked,
    brand_id: brandId,
    category_id: categoryId,
    model_id: modelId,
    // Current canonical schema stores the electrical descriptor as text.
    power_or_voltage: payload.power_source_code?.trim() || null,
    status: payload.status,
  };
}

export function getMvpSkus(params: MasterListParams) {
  return listPage<SkuRecord>(API_ENDPOINTS.PRODUCTS, params);
}

export async function createMvpSku(payload: SkuPayload) {
  const body = await canonicalSkuPayload(payload);
  const created = await http.post<SkuRecord>(API_ENDPOINTS.PRODUCTS, body, {
    headers: { "Idempotency-Key": idempotencyKey("sku-create") },
  });
  if (payload.status === "INACTIVE" && created.status !== "INACTIVE") {
    return http.patch<SkuRecord>(API_ENDPOINTS.PRODUCT.replace(":id", created.sku_id), {
      status: "INACTIVE",
    });
  }
  return created;
}

export async function updateMvpSku(id: string, version: number, payload: SkuPayload) {
  const body = await canonicalSkuPayload(payload);
  return http.patch<SkuRecord>(API_ENDPOINTS.PRODUCT.replace(":id", id), body, {
    headers: {
      "Idempotency-Key": idempotencyKey(`sku-update-${id}`),
      "If-Match": String(version),
    },
  });
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
  return http.patch<DefectRecord>(`${API_ENDPOINTS.DEFECT_CATALOGS}/${id}`, payload);
}
