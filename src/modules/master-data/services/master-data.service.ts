import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { assertMasterDataContractApproved } from "@/modules/master-data/contracts/master-data.contract";
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
  assertMasterDataContractApproved("PRODUCT_LIST");
  const result = await http.getPage<MaybePaginator<ProductRecord>>(
    API_ENDPOINTS.PRODUCTS,
    {
      params: productParams(params),
    },
  );
  return normalizePage(result);
}

export async function createProduct(
  payload: ProductPayload,
): Promise<ProductRecord> {
  assertMasterDataContractApproved("PRODUCT_CREATE");
  return http.post<ProductRecord>(API_ENDPOINTS.PRODUCTS, payload);
}

export async function updateProductStatus(
  id: number | string,
  status: "active" | "inactive" | "discontinued",
): Promise<ProductRecord> {
  assertMasterDataContractApproved("PRODUCT_STATUS");
  const endpoint =
    status === "active"
      ? API_ENDPOINTS.PRODUCT_ENABLE
      : status === "inactive"
        ? API_ENDPOINTS.PRODUCT_DISABLE
        : API_ENDPOINTS.PRODUCT.replace(":id", String(id)) + "/status";
  return http.patch<ProductRecord>(endpoint.replace(":id", String(id)), {
    status,
  });
}

// ===== Legacy aliases kept for UI tabs until BE confirms new endpoints =====
export async function getSkus(
  params: MasterListParams,
): Promise<MasterPageResult<ProductRecord>> {
  return getProducts(params);
}

export async function createSku(
  payload: ProductPayload,
): Promise<ProductRecord> {
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
  assertMasterDataContractApproved("SKU_IMPORT");
  throw new Error("Unreachable: SKU_IMPORT must remain fail-closed.");
}

// ===== Categories =====
export async function getProductCategories(
  params: MasterListParams,
): Promise<MasterPageResult<ProductCategoryRecord>> {
  assertMasterDataContractApproved("PRODUCT_CATEGORY");
  const result = await http.getPage<MaybePaginator<ProductCategoryRecord>>(
    API_ENDPOINTS.PRODUCT_CATEGORIES,
    { params: cleanParams(params) },
  );
  return normalizePage(result);
}

export async function createProductCategory(
  payload: ProductCategoryPayload,
): Promise<ProductCategoryRecord> {
  assertMasterDataContractApproved("PRODUCT_CATEGORY");
  return http.post<ProductCategoryRecord>(
    API_ENDPOINTS.PRODUCT_CATEGORIES,
    payload,
  );
}

// ===== Reference data =====
export async function getUoms(): Promise<ReferenceOptionRecord[]> {
  assertMasterDataContractApproved("REFERENCE_UOM");
  const result = await http.getPage<MaybePaginator<ReferenceOptionRecord>>(
    API_ENDPOINTS.UOMS,
    { params: { per_page: 100, status: 1 } },
  );
  return normalizePage(result).data;
}

export async function getSuppliers(): Promise<ReferenceOptionRecord[]> {
  assertMasterDataContractApproved("REFERENCE_SUPPLIER");
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
  assertMasterDataContractApproved("ITEM_LIST");
  throw new Error("Unreachable: ITEM_LIST must remain fail-closed.");
}

export async function getPhysicalCodes(
  params: MasterListParams,
): Promise<MasterPageResult<PhysicalCodeRecord>> {
  void params;
  assertMasterDataContractApproved("PHYSICAL_CODE_LIST");
  throw new Error("Unreachable: PHYSICAL_CODE_LIST must remain fail-closed.");
}
