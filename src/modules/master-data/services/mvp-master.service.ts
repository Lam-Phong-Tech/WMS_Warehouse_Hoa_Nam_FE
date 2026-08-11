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

const MASTER_ENDPOINTS = {
  skus: "/skus",
  agencies: "/agencies",
  defects: "/defect-catalogs",
} as const;

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

export function getMvpSkus(params: MasterListParams) {
  return listPage<SkuRecord>(MASTER_ENDPOINTS.skus, params);
}

export function createMvpSku(payload: SkuPayload) {
  return http.post<SkuRecord>(MASTER_ENDPOINTS.skus, payload, {
    headers: { "Idempotency-Key": idempotencyKey("sku-create") },
  });
}

export function updateMvpSku(id: string, version: number, payload: SkuPayload) {
  return http.patch<SkuRecord>(`${MASTER_ENDPOINTS.skus}/${id}`, payload, {
    headers: {
      "Idempotency-Key": idempotencyKey(`sku-update-${id}`),
      "If-Match": String(version),
    },
  });
}

export function getMvpAgencies(params: MasterListParams) {
  return listPage<AgencyRecord>(MASTER_ENDPOINTS.agencies, params);
}

export function createMvpAgency(payload: AgencyPayload) {
  return http.post<AgencyRecord>(MASTER_ENDPOINTS.agencies, payload);
}

export function updateMvpAgency(id: string, payload: AgencyPayload) {
  return http.patch<AgencyRecord>(`${MASTER_ENDPOINTS.agencies}/${id}`, payload);
}

export function getMvpDefects(params: MasterListParams) {
  return listPage<DefectRecord>(MASTER_ENDPOINTS.defects, params);
}

export function createMvpDefect(payload: DefectPayload) {
  return http.post<DefectRecord>(MASTER_ENDPOINTS.defects, payload);
}

export function updateMvpDefect(id: string, payload: DefectPayload) {
  return http.patch<DefectRecord>(`${MASTER_ENDPOINTS.defects}/${id}`, payload);
}
