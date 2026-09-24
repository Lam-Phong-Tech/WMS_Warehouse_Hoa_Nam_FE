import { WmsContractError } from "./wms-contract";

/** Parse a value actually supplied by the API; missing is distinct from zero. */
export function nullableApiNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (
    typeof value !== "string" ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Required response fields must never be fabricated to make a screen look complete. */
export function requiredApiNumber(value: unknown, field = "quantity"): number {
  const number = nullableApiNumber(value);
  if (number === null)
    throw new WmsContractError(
      "WMS_FE_MISSING_API_VALUE",
      "Dữ liệu từ máy chủ chưa đầy đủ hoặc không hợp lệ (" +
        field +
        "). Vui lòng tải lại để kiểm tra.",
    );
  return number;
}

export function requiredApiState<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field = "status",
): T {
  const state = typeof value === "string" ? value.trim().toUpperCase() : "";
  const known = allowed.find((candidate) => candidate === state);
  if (known === undefined)
    throw new WmsContractError(
      "WMS_FE_INVALID_API_STATE",
      "Chưa xác định được trạng thái từ máy chủ (" +
        field +
        "). Vui lòng tải lại để kiểm tra.",
    );
  return known;
}

export function requiredApiIdentity(value: unknown, field = "id"): string {
  const id =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : "";
  if (!id)
    throw new WmsContractError(
      "WMS_FE_MISSING_API_ID",
      "Phản hồi máy chủ thiếu định danh " +
        field +
        ". Vui lòng tải lại để kiểm tra.",
    );
  return id;
}

/** Only a boolean received from the API is a confirmed server decision. */
export function nullableApiBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function requiredApiBoolean(value: unknown, field: string): boolean {
  const result = nullableApiBoolean(value);
  if (result === null)
    throw new WmsContractError(
      "WMS_FE_MISSING_API_VALUE",
      `Chưa nhận đủ dữ liệu từ máy chủ (${field}). Vui lòng tải lại.`,
    );
  return result;
}

/** Optional presentation fields stay absent; an unsupported state is not a default state. */
export function optionalApiState<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredApiState(value, allowed, field);
}

/** An explicit empty array is valid; a missing/malformed list is not an empty result. */
export function requiredApiRows<T>(value: unknown, field = "rows"): T[] {
  if (Array.isArray(value)) return value as T[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: T[] }).data;
  }
  throw new WmsContractError(
    "WMS_FE_MISSING_API_VALUE",
    `Danh sách từ máy chủ chưa đầy đủ hoặc không hợp lệ (${field}). Vui lòng tải lại.`,
  );
}

/** Missing/invalid versions must never be replaced with 0 or 1 before a write. */
export function requiredApiVersion(value: unknown, field = "If-Match"): number {
  const version = requiredApiNumber(value, field);
  if (!Number.isSafeInteger(version) || version <= 0)
    throw new WmsContractError(
      "WMS_FE_MISSING_API_VALUE",
      "Chưa có phiên bản bản ghi hợp lệ từ máy chủ. Vui lòng tải lại trước khi thao tác.",
    );
  return version;
}
