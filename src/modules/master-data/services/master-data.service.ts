import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  ItemRecord,
  ImportResult,
  MasterListParams,
  MasterPageResult,
  PhysicalCodeRecord,
  ProductCategoryPayload,
  ProductCategoryRecord,
  ReferenceOptionRecord,
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

type MaybePaginator<T> =
  | T[]
  | {
      data?: T[];
      current_page?: number;
      per_page?: number;
      total?: number;
      last_page?: number;
      [key: string]: unknown;
    };

function normalizePage<T>(
  result: { data: MaybePaginator<T>; meta: Record<string, unknown> },
): MasterPageResult<T> {
  if (Array.isArray(result.data)) {
    return { data: result.data, meta: result.meta };
  }
  const rows = Array.isArray(result.data.data) ? result.data.data : [];
  const { data: _rows, ...paginatorMeta } = result.data;
  return {
    data: rows,
    meta: { ...paginatorMeta, ...result.meta },
  };
}

function productParams(params: MasterListParams) {
  const cleaned = cleanParams(params);
  const sortBy = cleaned.sort_by;
  const direction = cleaned.sort_direction;
  delete cleaned.sort_by;
  delete cleaned.sort_direction;
  if (sortBy) {
    cleaned.sort = `${direction === "desc" ? "-" : ""}${sortBy}`;
  }
  return cleaned;
}

export async function getSkus(
  params: MasterListParams,
): Promise<MasterPageResult<SkuRecord>> {
  const result = await http.getPage<MaybePaginator<SkuRecord>>(API_ENDPOINTS.PRODUCTS, {
    params: productParams(params),
  });
  return normalizePage(result);
}

export async function createSku(payload: SkuPayload): Promise<SkuRecord> {
  return http.post<SkuRecord>(API_ENDPOINTS.PRODUCTS, payload);
}

export async function updateSkuStatus(
  id: number | string,
  status: "ACTIVE" | "INACTIVE",
): Promise<SkuRecord> {
  const endpoint =
    status === "ACTIVE" ? API_ENDPOINTS.PRODUCT_ENABLE : API_ENDPOINTS.PRODUCT_DISABLE;
  return http.patch<SkuRecord>(endpoint.replace(":id", String(id)));
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

export async function getProductCategories(
  params: MasterListParams,
): Promise<MasterPageResult<ProductCategoryRecord>> {
  const result = await http.getPage<MaybePaginator<ProductCategoryRecord>>(
    API_ENDPOINTS.PRODUCT_CATEGORIES,
    { params: cleanParams(params) },
  );
  return normalizePage(result);
}

export async function createProductCategory(
  payload: ProductCategoryPayload,
): Promise<ProductCategoryRecord> {
  return http.post<ProductCategoryRecord>(API_ENDPOINTS.PRODUCT_CATEGORIES, payload);
}

export async function getUoms(): Promise<ReferenceOptionRecord[]> {
  const result = await http.getPage<MaybePaginator<ReferenceOptionRecord>>(
    API_ENDPOINTS.UOMS,
    { params: { per_page: 100, status: 1 } },
  );
  return normalizePage(result).data;
}

export async function getSuppliers(): Promise<ReferenceOptionRecord[]> {
  const result = await http.getPage<MaybePaginator<ReferenceOptionRecord>>(
    API_ENDPOINTS.SUPPLIERS,
    { params: { per_page: 100, status: 1 } },
  );
  return normalizePage(result).data;
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
