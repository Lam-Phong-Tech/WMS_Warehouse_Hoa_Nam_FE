import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  ImportResult,
  ItemRecord,
  MasterListParams,
  MasterPageResult,
  PhysicalCodeRecord,
  ProductCategoryPayload,
  ProductCategoryRecord,
  ProductPayload,
  ProductRecord,
  ReferenceOptionRecord,
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
  const { ...paginatorMeta } = result.data as Record<string, unknown>;
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

// ===== Products (canonical) =====
export async function getProducts(
  params: MasterListParams,
): Promise<MasterPageResult<ProductRecord>> {
  const result = await http.getPage<MaybePaginator<ProductRecord>>(API_ENDPOINTS.PRODUCTS, {
    params: productParams(params),
  });
  return normalizePage(result);
}

export async function createProduct(payload: ProductPayload): Promise<ProductRecord> {
  return http.post<ProductRecord>(API_ENDPOINTS.PRODUCTS, payload);
}

export async function updateProductStatus(
  id: number | string,
  status: "active" | "inactive" | "discontinued",
): Promise<ProductRecord> {
  const endpoint =
    status === "active"
      ? API_ENDPOINTS.PRODUCT_ENABLE
      : status === "inactive"
        ? API_ENDPOINTS.PRODUCT_DISABLE
        : API_ENDPOINTS.PRODUCT.replace(":id", String(id)) + "/status";
  return http.patch<ProductRecord>(endpoint.replace(":id", String(id)), { status });
}

// ===== Legacy aliases kept for UI tabs until BE confirms new endpoints =====
export async function getSkus(
  params: MasterListParams,
): Promise<MasterPageResult<ProductRecord>> {
  return getProducts(params);
}

export async function createSku(payload: ProductPayload): Promise<ProductRecord> {
  return createProduct(payload);
}

export async function updateSkuStatus(
  id: number | string,
  status: "active" | "inactive" | "discontinued",
): Promise<ProductRecord> {
  return updateProductStatus(id, status);
}

export async function importSkus(file: File): Promise<ImportResult> {
  void file;
  throw new Error(
    "Import SKU is disabled because /skus/import-excel is not in OpenAPI 3.0.0.",
  );
}

// ===== Categories =====
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

// ===== Reference data =====
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

// ===== Legacy item/code tabs =====
export async function getItems(
  params: MasterListParams,
): Promise<MasterPageResult<ItemRecord>> {
  void params;
  throw new Error("Item list is disabled because /items is not in OpenAPI 3.0.0.");
}

export async function getPhysicalCodes(
  params: MasterListParams,
): Promise<MasterPageResult<PhysicalCodeRecord>> {
  void params;
  throw new Error(
    "Physical code list is disabled because /physical-codes is not in OpenAPI 3.0.0.",
  );
}
