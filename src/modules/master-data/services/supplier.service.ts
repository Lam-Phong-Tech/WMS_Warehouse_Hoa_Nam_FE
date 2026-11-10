import { z } from "zod";
import { http } from "@/shared/api/http";
import { requiredApiVersion } from "@/shared/api/api-read-values";
import { WmsContractError } from "@/shared/api/wms-contract";

export type SupplierStatus = "ACTIVE" | "INACTIVE";
export interface SupplierPayload {
  name: string;
  status: SupplierStatus;
  description?: string | null;
}
export interface SupplierListParams {
  q?: string;
  status: SupplierStatus;
  page: number;
  per_page: number;
}
const supplierSchema = z.object({
  id: z.string().min(1),
  code: z.string().nullable(),
  name: z.string().min(1),
  display_name: z.string(),
  code_status: z.enum(["ASSIGNED", "NOT_ASSIGNED"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  version: z.number().int().positive(),
  updated_at: z.string(),
  description: z.string().nullable().default(null),
});
export type Supplier = z.infer<typeof supplierSchema>;
const pageSchema = z.object({
  data: z.array(supplierSchema),
  meta: z.object({
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    last_page: z.number().int().positive(),
  }),
});
export interface SupplierPage {
  rows: Supplier[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
}
export const SUPPLIER_ENDPOINT = "/mini-app/inbound/suppliers";

export const SUPPLIER_DESCRIPTION_MAX_LENGTH = 500;

function normalizeDescription(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if ([...trimmed].length > SUPPLIER_DESCRIPTION_MAX_LENGTH)
    throw new Error("SUPPLIER_DESCRIPTION_TOO_LONG");
  return trimmed === "" ? null : trimmed;
}

function readSupplier(value: unknown): Supplier {
  const result = supplierSchema.safeParse(value);
  if (!result.success)
    throw new WmsContractError(
      "SUPPLIER_RESPONSE_INVALID",
      "Dữ liệu nhà cung cấp chưa đầy đủ. Vui lòng tải lại để kiểm tra.",
    );
  return result.data;
}
export async function listSuppliers(
  params: SupplierListParams,
  signal?: AbortSignal,
): Promise<SupplierPage> {
  const response = await http.getPage<unknown>(SUPPLIER_ENDPOINT, {
    params: { ...params, q: params.q?.trim() || undefined },
    signal,
  });
  const result = pageSchema.safeParse(response);
  if (!result.success)
    throw new WmsContractError(
      "SUPPLIER_PAGE_INVALID",
      "Dữ liệu danh sách nhà cung cấp chưa đầy đủ. Vui lòng thử lại.",
    );
  const { data, meta } = result.data;
  return {
    rows: data,
    page: meta.page,
    perPage: meta.per_page,
    total: meta.total,
    lastPage: meta.last_page,
  };
}
export async function createSupplier(
  payload: SupplierPayload,
): Promise<Supplier> {
  return readSupplier(
    await http.post<unknown>(SUPPLIER_ENDPOINT, {
      name: payload.name.trim(),
      status: payload.status,
      description: normalizeDescription(payload.description),
    }),
  );
}
export async function updateSupplier(
  id: string,
  version: number,
  payload: SupplierPayload,
): Promise<Supplier> {
  const expected = requiredApiVersion(version);
  return readSupplier(
    await http.patch<unknown>(
      `${SUPPLIER_ENDPOINT}/${encodeURIComponent(id)}`,
      {
        name: payload.name.trim(),
        status: payload.status,
        description: normalizeDescription(payload.description),
      },
      { headers: { "If-Match": `"${expected}"` } },
    ),
  );
}
