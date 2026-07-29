import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  ItemRecord,
  ImportResult,
  MasterListParams,
  MasterPageResult,
  PhysicalCodeRecord,
  SkuPayload,
  SkuRecord,
} from "@/modules/master-data/types/master-data.types";

function cleanParams(params: MasterListParams) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

export async function getSkus(
  params: MasterListParams,
): Promise<MasterPageResult<SkuRecord>> {
  const result = await http.getPage<SkuRecord[]>(API_ENDPOINTS.SKUS, {
    params: cleanParams(params),
  });
  return { data: result.data, meta: result.meta };
}

export async function createSku(payload: SkuPayload): Promise<SkuRecord> {
  return http.post<SkuRecord>(API_ENDPOINTS.SKUS, payload);
}

export async function updateSkuStatus(
  id: number | string,
  status: "ACTIVE" | "INACTIVE",
): Promise<SkuRecord> {
  return http.patch<SkuRecord>(API_ENDPOINTS.SKU.replace(":id", String(id)), {
    status,
  });
}

export async function importSkus(file: File): Promise<ImportResult> {
  const body = new FormData();
  body.append("file", file);
  return http.post<ImportResult>(API_ENDPOINTS.SKU_IMPORT_EXCEL, body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function getItems(
  params: MasterListParams,
): Promise<MasterPageResult<ItemRecord>> {
  const result = await http.getPage<ItemRecord[]>(API_ENDPOINTS.ITEMS, {
    params: cleanParams(params),
  });
  return { data: result.data, meta: result.meta };
}

export async function getPhysicalCodes(
  params: MasterListParams,
): Promise<MasterPageResult<PhysicalCodeRecord>> {
  const result = await http.getPage<PhysicalCodeRecord[]>(
    API_ENDPOINTS.PHYSICAL_CODES,
    { params: cleanParams(params) },
  );
  return { data: result.data, meta: result.meta };
}
