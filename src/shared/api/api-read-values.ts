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
