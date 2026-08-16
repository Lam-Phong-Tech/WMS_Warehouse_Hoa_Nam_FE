import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type { MasterStatus } from "@/modules/master-data/types/mvp-master.types";

/**
 * REQ-SRS-029 / SRS §8.3 SCR-MST-01: năm bảng catalog master nuôi form tạo SKU
 * (brand / category / model / power source / package variant). Cùng contract
 * GET|POST /{resource} + PATCH /{resource}/{id}, chỉ khác cặp cột code/name nên
 * gom về một service thay vì năm bản sao.
 */
export type CatalogMasterKind =
  | "BRAND"
  | "CATEGORY"
  | "MODEL"
  | "POWER_SOURCE"
  | "PACKAGE";

export interface CatalogMasterRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  status: MasterStatus;
  /** null khi bảng master chưa có cột version — khi đó bỏ qua If-Match. */
  version: number | null;
  /** Chỉ product_models tham chiếu brand. */
  brand_id: string | null;
}

export interface CatalogMasterPayload {
  code: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  status: MasterStatus;
  brand_id?: string | null;
}

export interface CatalogMasterListParams {
  keyword?: string;
  status?: MasterStatus | "";
  page?: number;
  per_page?: number;
}

export interface CatalogMasterPage {
  data: CatalogMasterRecord[];
  meta: Record<string, unknown>;
}

interface CatalogMasterDefinition {
  endpoint: string;
  detailEndpoint: string;
  codeField: string;
  nameField: string;
  /** BR-MST: chỉ product_models nhận brand_id (và brand phải ACTIVE). */
  supportsBrand: boolean;
}

const CATALOG_MASTER_DEFINITIONS: Record<
  CatalogMasterKind,
  CatalogMasterDefinition
> = {
  BRAND: {
    endpoint: API_ENDPOINTS.BRANDS,
    detailEndpoint: API_ENDPOINTS.BRAND,
    codeField: "brand_code",
    nameField: "brand_name",
    supportsBrand: false,
  },
  CATEGORY: {
    endpoint: API_ENDPOINTS.PRODUCT_CATEGORIES,
    detailEndpoint: API_ENDPOINTS.PRODUCT_CATEGORY,
    codeField: "category_code",
    nameField: "category_name",
    supportsBrand: false,
  },
  MODEL: {
    endpoint: API_ENDPOINTS.PRODUCT_MODELS,
    detailEndpoint: API_ENDPOINTS.PRODUCT_MODEL,
    codeField: "model_code",
    nameField: "model_name",
    supportsBrand: true,
  },
  POWER_SOURCE: {
    endpoint: API_ENDPOINTS.POWER_SOURCES,
    detailEndpoint: API_ENDPOINTS.POWER_SOURCE,
    codeField: "power_source_code",
    nameField: "power_source_name",
    supportsBrand: false,
  },
  PACKAGE: {
    endpoint: API_ENDPOINTS.PACKAGE_VARIANTS,
    detailEndpoint: API_ENDPOINTS.PACKAGE_VARIANT,
    codeField: "package_code",
    nameField: "package_name",
    supportsBrand: false,
  },
};

export function catalogMasterSupportsBrand(kind: CatalogMasterKind): boolean {
  return CATALOG_MASTER_DEFINITIONS[kind].supportsBrand;
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function cleanParams(params: CatalogMasterListParams) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

function toRecord(
  kind: CatalogMasterKind,
  row: RawRecord,
): CatalogMasterRecord {
  const definition = CATALOG_MASTER_DEFINITIONS[kind];
  const rawVersion = Number(row.version);
  const status = text(row.status).toUpperCase();
  return {
    id: text(row.id),
    code: text(row[definition.codeField]),
    name: text(row[definition.nameField]),
    description: row.description === null ? null : text(row.description),
    sort_order: Number.isFinite(Number(row.sort_order))
      ? Number(row.sort_order)
      : 0,
    status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    version: Number.isFinite(rawVersion) ? rawVersion : null,
    brand_id: definition.supportsBrand ? (text(row.brand_id) || null) : null,
  };
}

function toBody(
  kind: CatalogMasterKind,
  payload: CatalogMasterPayload,
): RawRecord {
  const definition = CATALOG_MASTER_DEFINITIONS[kind];
  const description = payload.description?.trim();
  const body: RawRecord = {
    [definition.codeField]: payload.code.trim(),
    [definition.nameField]: payload.name.trim(),
    description: description ? description : null,
    status: payload.status,
    sort_order: Number.isFinite(Number(payload.sort_order))
      ? Number(payload.sort_order)
      : 0,
  };
  if (definition.supportsBrand) {
    body.brand_id = payload.brand_id?.trim() || null;
  }
  return body;
}

export async function getCatalogMasters(
  kind: CatalogMasterKind,
  params: CatalogMasterListParams,
): Promise<CatalogMasterPage> {
  const result = await http.getPage<RawRecord[]>(
    CATALOG_MASTER_DEFINITIONS[kind].endpoint,
    { params: cleanParams({ ...params, per_page: params.per_page ?? 15 }) },
  );
  const rows = Array.isArray(result.data) ? result.data : [];
  return { data: rows.map((row) => toRecord(kind, row)), meta: result.meta };
}

export async function createCatalogMaster(
  kind: CatalogMasterKind,
  payload: CatalogMasterPayload,
): Promise<CatalogMasterRecord> {
  const created = await http.post<RawRecord>(
    CATALOG_MASTER_DEFINITIONS[kind].endpoint,
    toBody(kind, payload),
  );
  return toRecord(kind, created ?? {});
}

/**
 * BR-MST-01..07: đổi mã master đã được SKU tham chiếu bị BE chặn bằng 409
 * MASTER_CODE_IMMUTABLE_AFTER_USE; đổi trạng thái sang INACTIVE là cách "xoá"
 * duy nhất. If-Match chỉ gửi khi bản ghi có version để BE so khớp
 * optimistic-locking (412 STALE_VERSION khi bản ghi đã đổi ở phiên khác).
 */
export async function updateCatalogMaster(
  kind: CatalogMasterKind,
  id: string,
  payload: CatalogMasterPayload,
  version: number | null,
): Promise<CatalogMasterRecord> {
  const updated = await http.patch<RawRecord>(
    CATALOG_MASTER_DEFINITIONS[kind].detailEndpoint.replace(":id", id),
    toBody(kind, payload),
    version === null ? undefined : { headers: { "If-Match": String(version) } },
  );
  return toRecord(kind, updated ?? {});
}

/** Model chỉ được gắn brand ACTIVE (BE trả 422 BRAND_NOT_ACTIVE khi vi phạm). */
export async function getActiveBrandOptions(): Promise<CatalogMasterRecord[]> {
  const page = await getCatalogMasters("BRAND", {
    status: "ACTIVE",
    per_page: 200,
  });
  return page.data;
}
