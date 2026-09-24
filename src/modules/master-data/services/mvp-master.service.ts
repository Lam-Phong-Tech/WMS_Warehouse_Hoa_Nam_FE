import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  requiredApiIdentity,
  requiredApiNumber,
  requiredApiRows,
  requiredApiVersion,
} from "@/shared/api/api-read-values";
import { readAllApiPages } from "@/shared/api/read-all-pages";
import { WmsContractError } from "@/shared/api/wms-contract";
import type {
  AgencyPayload, AgencyRecord, CatalogRefRecord, DefectPayload, DefectRecord,
  MasterListParams, MasterPageResult, ProductCatalogRefs, SkuPayload, SkuRecord,
} from "@/modules/master-data/types/mvp-master.types";

function cleanParams(params: MasterListParams) {
  return Object.fromEntries(Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  ));
}
function idempotencyKey(operation: string) {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `fe:${operation}:${uuid}`;
}
async function listPage<T>(endpoint: string, params: MasterListParams): Promise<MasterPageResult<T>> {
  const result = await http.getPage<T[]>(endpoint, {
    params: cleanParams({ ...params, per_page: params.per_page ?? 100 }),
  });
  return { data: requiredApiRows<T>(result.data, "master.data"), meta: result.meta };
}

/** Preserve canonical FK payloads and explicit null/undefined semantics. */
function canonicalSkuPayload(payload: SkuPayload) {
  const body: Record<string, unknown> = {
    sku_code: payload.code.trim(),
    sku_name: payload.name.trim(),
    sku_type: payload.sku_type,
    unit: payload.unit?.trim() || null,
    is_serial_tracked: payload.is_serial_tracked,
    status: payload.status,
  };
  if (payload.published_to_app !== undefined) body.published_to_app = payload.published_to_app;
  // Empty version_code means keep the existing master version, not erase it.
  if (payload.version_code?.trim()) body.version_code = payload.version_code.trim();
  const masterLinks: Array<[string, string | null | undefined]> = [
    ["brand_id", payload.brand_id], ["category_id", payload.category_id],
    ["model_id", payload.model_id], ["power_source_id", payload.power_source_id],
    ["package_variant_id", payload.package_variant_id],
  ];
  for (const [key, value] of masterLinks) {
    if (value === undefined) continue;
    body[key] = value?.trim() ? value.trim() : null;
  }
  if (payload.min_stock !== undefined) body.min_stock = payload.min_stock;
  if (payload.max_stock !== undefined) body.max_stock = payload.max_stock;
  return body;
}
export function getMvpSkus(params: MasterListParams) {
  return listPage<SkuRecord>(API_ENDPOINTS.PRODUCTS, params);
}

/** Active choices are fully paged. Read failures remain query failures, not empty catalogues. */
async function listCatalogRefs(endpoint: string, codeKey: string, nameKey: string): Promise<CatalogRefRecord[]> {
  const rows = await readAllApiPages<Record<string, unknown>>(
    page => http.getPage<Record<string, unknown>[]>(endpoint, {
      params: { status: "ACTIVE", per_page: 200, page },
    }),
    row => requiredApiIdentity(row.id),
  );
  return rows.map(row => ({
    id: requiredApiIdentity(row.id),
    code: String(row[codeKey] ?? ""),
    name: String(row[nameKey] ?? ""),
  }));
}
export async function getMvpProductCatalogs(): Promise<ProductCatalogRefs> {
  const [brands, categories, models, powerSources, packageVariants] = await Promise.all([
    listCatalogRefs(API_ENDPOINTS.BRANDS, "brand_code", "brand_name"),
    listCatalogRefs(API_ENDPOINTS.PRODUCT_CATEGORIES, "category_code", "category_name"),
    listCatalogRefs(API_ENDPOINTS.PRODUCT_MODELS, "model_code", "model_name"),
    listCatalogRefs(API_ENDPOINTS.POWER_SOURCES, "power_source_code", "power_source_name"),
    listCatalogRefs(API_ENDPOINTS.PACKAGE_VARIANTS, "package_code", "package_name"),
  ]);
  return { brands, categories, models, powerSources, packageVariants };
}

/** BR-SKU-10: an unknown read must not turn into confirmation that identity is editable. */
export async function hasMvpSkuStock(skuId: string): Promise<boolean> {
  const id = requiredApiIdentity(skuId, "sku_id");
  const rows = await readAllApiPages<Record<string, unknown>>(
    page => http.getPage<Record<string, unknown>[]>(API_ENDPOINTS.INVENTORY_BALANCES, {
      params: { product_id: id, page, per_page: 200 },
    }),
    row => requiredApiIdentity(row.id ?? row.balance_id, "balance_id"),
  );
  if (rows.some(row => requiredApiNumber(row.on_hand_qty, "on_hand_qty") !== 0)) return true;
  // Zero stock today does not prove that the SKU has never had a stock movement.
  const movements = await http.getPage<Record<string, unknown>[]>(API_ENDPOINTS.STOCK_MOVEMENTS, {
    params: { product_id: id, per_page: 1, page: 1 },
  });
  const evidence = requiredApiRows<Record<string, unknown>>(movements.data, "sku.movements");
  return evidence.length > 0;
}
export async function createMvpSku(payload: SkuPayload) {
  const created = await http.post<SkuRecord>(API_ENDPOINTS.PRODUCTS, canonicalSkuPayload(payload), {
    headers: { "Idempotency-Key": idempotencyKey("sku-create") },
  });
  if (payload.status === "INACTIVE" && created.status !== "INACTIVE") {
    return http.patch<SkuRecord>(API_ENDPOINTS.PRODUCT.replace(":id", created.sku_id), { status: "INACTIVE" });
  }
  return created;
}
export async function updateMvpSku(id: string, version: number, payload: SkuPayload) {
  const normalizedId = requiredApiIdentity(id, "sku_id");
  const serverVersion = requiredApiVersion(version);
  const current = await http.get<SkuRecord>(API_ENDPOINTS.PRODUCT.replace(":id", normalizedId));
  const currentCode = current.sku_code ?? current.code;
  if (typeof currentCode !== "string" || typeof current.is_serial_tracked !== "boolean") {
    throw new WmsContractError("WMS_FE_MISSING_API_VALUE", "Chưa tải đủ định danh SKU từ máy chủ. Vui lòng tải lại trước khi lưu.");
  }
  const changesIdentity = payload.code.trim() !== currentCode || payload.is_serial_tracked !== current.is_serial_tracked;
  if (changesIdentity && await hasMvpSkuStock(normalizedId)) {
    throw new WmsContractError("WMS_FE_SKU_IDENTITY_LOCKED", "SKU đã có tồn hoặc biến động kho; không thể thay đổi mã và cách quản lý định danh.");
  }
  return http.patch<SkuRecord>(API_ENDPOINTS.PRODUCT.replace(":id", normalizedId), canonicalSkuPayload(payload), {
    headers: { "Idempotency-Key": idempotencyKey(`sku-update-${normalizedId}`), "If-Match": String(serverVersion) },
  });
}
/** Keep publishing on its own permission-protected endpoint. */
export function setMvpSkuPublished(id: string, version: number, publishedToApp: boolean) {
  return http.patch<SkuRecord>(API_ENDPOINTS.PV_PRODUCT_PUBLISH.replace(":id", requiredApiIdentity(id)),
    { published: publishedToApp },
    { headers: { "Idempotency-Key": idempotencyKey(`sku-publish-${id}`), "If-Match": String(requiredApiVersion(version)) } },
  );
}
/** Preserve the existing optional-header contract for legacy agency/defect responses. */
function ifMatchConfig(version?: number | null) {
  return version === null || version === undefined
    ? undefined : { headers: { "If-Match": String(requiredApiVersion(version)) } };
}
export function getMvpAgencies(params: MasterListParams) {
  return listPage<AgencyRecord>(API_ENDPOINTS.AGENCIES, params);
}
export function createMvpAgency(payload: AgencyPayload) {
  return http.post<AgencyRecord>(API_ENDPOINTS.AGENCIES, payload);
}
export function updateMvpAgency(id: string, payload: AgencyPayload, version?: number | null) {
  return http.patch<AgencyRecord>(`${API_ENDPOINTS.AGENCIES}/${id}`, payload, ifMatchConfig(version));
}
export function getMvpDefects(params: MasterListParams) {
  return listPage<DefectRecord>(API_ENDPOINTS.DEFECT_CATALOGS, params);
}
export function createMvpDefect(payload: DefectPayload) {
  return http.post<DefectRecord>(API_ENDPOINTS.DEFECT_CATALOGS, payload);
}
export function updateMvpDefect(id: string, payload: DefectPayload, version?: number | null) {
  return http.patch<DefectRecord>(`${API_ENDPOINTS.DEFECT_CATALOGS}/${id}`, payload, ifMatchConfig(version));
}
