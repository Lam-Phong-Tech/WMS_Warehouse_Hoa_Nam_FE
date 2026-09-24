import { nullableApiNumber, requiredApiRows } from "./api-read-values";
import { WmsContractError } from "./wms-contract";

type Page<T> = { data: T[] | unknown; meta?: unknown };
function invalid(): never {
  throw new WmsContractError(
    "WMS_FE_INCOMPLETE_API_PAGINATION",
    "Danh sách từ máy chủ tải chưa đầy đủ hoặc đã thay đổi. Vui lòng tải lại.",
  );
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

/** All-or-error aggregation: never publish a truncated first page as a complete lookup. */
export async function readAllApiPages<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  identity: (row: T) => string,
): Promise<T[]> {
  const output: T[] = [];
  const seen = new Set<string>();
  let expectedTotal: number | null = null;
  let snapshot: unknown;
  for (let page = 1; page <= 1000; page += 1) {
    const response = await fetchPage(page);
    const rows = requiredApiRows<T>(response.data, "pagination.data");
    const meta = record(response.meta);
    const pagination = Object.keys(record(meta.pagination)).length ? record(meta.pagination) : meta;
    const total = nullableApiNumber(pagination.total);
    const last = nullableApiNumber(pagination.last_page ?? pagination.total_pages);
    const current = nullableApiNumber(pagination.current_page ?? pagination.page);
    const perPage = nullableApiNumber(pagination.per_page ?? pagination.page_size);
    for (const value of [total, last, current, perPage]) {
      if (value !== null && (!Number.isSafeInteger(value) || value < 0)) invalid();
    }
    if (current !== null && current !== page) invalid();
    if (page === 1) {
      expectedTotal = total;
      snapshot = meta.snapshot_id ?? meta.snapshot_version;
    } else {
      if (expectedTotal !== total) invalid();
      if (snapshot !== undefined && snapshot !== (meta.snapshot_id ?? meta.snapshot_version)) invalid();
    }
    for (const row of rows) {
      const id = identity(row);
      if (!id || seen.has(id)) invalid();
      seen.add(id);
      output.push(row);
    }
    if (total !== null && output.length > total) invalid();
    if (last !== null && page >= last) {
      if (total !== null && output.length !== total) invalid();
      return output;
    }
    if (total !== null && output.length === total) return output;
    // A server-confirmed terminal page is evidence; a requested page size is not.
    if (pagination.has_more === false || pagination.has_next_page === false) {
      if (total !== null && output.length !== total) invalid();
      return output;
    }
    if (total === null && last === null && perPage !== null && perPage > 0 && rows.length < perPage) return output;
    if (rows.length === 0) {
      if (page === 1 && total === null && last === null) return output;
      invalid();
    }
    if (total === null && last === null && !(perPage !== null && perPage > 0)) invalid();
  }
  return invalid();
}
