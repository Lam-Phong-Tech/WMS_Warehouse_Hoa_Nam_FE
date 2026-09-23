import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
import type { QueryClient } from "@tanstack/react-query";
import { mvpMasterKeys } from "@/modules/master-data/hooks/use-mvp-master";
import { getMvpSkus } from "@/modules/master-data/services/mvp-master.service";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import { warrantyKeys } from "@/modules/warranty/hooks/use-warranty";
import {
  fetchComponentIssueDocument,
  fetchComponentIssueDocuments,
  type ComponentIssueDocument,
  type ComponentIssueListParams,
} from "@/modules/warranty/services/componentIssueService";
import { tStatic as tUi } from "@/shared/i18n/useT";

export type ComponentIssueTracking = "SERIAL" | "QUANTITY" | "MIXED";

const PAGE_SIZE = 50;
const CONCURRENCY = 5;
const getINCOMPLETE_SOURCE_MESSAGE = localizedUiValue(() =>
  tUi("updatedUi.text_08eb97c3cb94"),
);

let activeReads = 0;
const readWaiters: Array<() => void> = [];

/** Share five request slots across the visible list, its lookups and tracking. */
export async function withComponentIssueReadSlot<T>(
  read: () => Promise<T>,
): Promise<T> {
  if (activeReads >= CONCURRENCY) {
    await new Promise<void>((resolve) => readWaiters.push(resolve));
  } else {
    activeReads += 1;
  }
  try {
    return await read();
  } finally {
    const next = readWaiters.shift();
    // Transfer the occupied slot directly to the oldest waiter.
    if (next) next();
    else activeReads -= 1;
  }
}

function incompleteSource(): Error {
  return new Error(getINCOMPLETE_SOURCE_MESSAGE());
}

/** Missing lines or SKU metadata do not prove quantity-based tracking. */
export function resolveComponentIssueTracking(
  document: ComponentIssueDocument,
  skuById: ReadonlyMap<string, SkuRecord>,
): ComponentIssueTracking | null {
  if (!document.lines?.length) return null;
  const kinds = new Set<"SERIAL" | "QUANTITY">();
  for (const line of document.lines) {
    const sku = skuById.get(line.sku_id);
    if (
      !sku ||
      (sku.sku_id || sku.id) !== line.sku_id ||
      typeof sku.is_serial_tracked !== "boolean"
    ) {
      return null;
    }
    kinds.add(sku.is_serial_tracked ? "SERIAL" : "QUANTITY");
  }
  return kinds.size === 2 ? "MIXED" : [...kinds][0];
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  map: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  let failed = false;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, values.length) }, async () => {
      while (!failed && next < values.length) {
        const index = next++;
        try {
          results[index] = await map(values[index]);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  return results;
}

type Pagination = { lastPage: number; total?: number; perPage?: number };

function integer(value: unknown, minimum: number): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= minimum
    ? (value as number)
    : undefined;
}

function readPagination(
  meta: Record<string, unknown> | undefined,
  rowCount: number,
  page: number,
  previous?: Pagination,
): Pagination {
  const total = integer(meta?.total, 0);
  const perPage = integer(meta?.per_page, 1);
  const declaredLastPage = integer(meta?.last_page, 1);
  const calculatedLastPage =
    total !== undefined && perPage !== undefined
      ? Math.max(1, Math.ceil(total / perPage))
      : undefined;
  const lastPage = declaredLastPage ?? calculatedLastPage;
  if (
    lastPage === undefined ||
    page > lastPage ||
    (meta?.current_page !== undefined && meta.current_page !== page) ||
    (meta?.total !== undefined && total === undefined) ||
    (meta?.per_page !== undefined && perPage === undefined) ||
    (meta?.last_page !== undefined && declaredLastPage === undefined) ||
    (perPage !== undefined && (perPage > PAGE_SIZE || rowCount > perPage)) ||
    (calculatedLastPage !== undefined && lastPage !== calculatedLastPage) ||
    (previous &&
      (previous.lastPage !== lastPage ||
        previous.total !== total ||
        previous.perPage !== perPage)) ||
    (rowCount === 0 && (page > 1 || lastPage > 1))
  ) {
    throw incompleteSource();
  }
  if (total !== undefined && perPage !== undefined) {
    const expectedCount = Math.min(perPage, total - (page - 1) * perPage);
    if (rowCount !== expectedCount) throw incompleteSource();
  }
  return { lastPage, total, perPage };
}

/**
 * Tracking is not an API filter. Resolve all matching documents before the
 * caller paginates so a matching document on a later API page stays reachable.
 * Every read shares the normal list/detail/master cache and mutation invalidation.
 */
export async function fetchComponentIssueTrackingRows(
  queryClient: QueryClient,
  params: Pick<ComponentIssueListParams, "keyword" | "status"> & {
    tracking: "SERIAL" | "QUANTITY";
  },
): Promise<ComponentIssueDocument[]> {
  const fetchPage = (page: number) => {
    const listParams = {
      keyword: params.keyword,
      status: params.status,
      page,
      per_page: PAGE_SIZE,
    };
    return queryClient.fetchQuery({
      queryKey: warrantyKeys.componentIssues(listParams),
      queryFn: () =>
        withComponentIssueReadSlot(() =>
          fetchComponentIssueDocuments(listParams),
        ),
    });
  };
  const first = await fetchPage(1);
  const pagination = readPagination(first.meta, first.data.length, 1);
  const remaining = await mapConcurrent(
    Array.from({ length: pagination.lastPage - 1 }, (_, index) => index + 2),
    async (page) => {
      const result = await fetchPage(page);
      readPagination(result.meta, result.data.length, page, pagination);
      return result.data;
    },
  );
  const rows = [first.data, ...remaining].flat();
  const ids = new Set(rows.map((row) => row.id));
  if (
    ids.has("") ||
    ids.size !== rows.length ||
    (pagination.total !== undefined && rows.length !== pagination.total)
  ) {
    throw incompleteSource();
  }

  const documents = await mapConcurrent(rows, async (row) => {
    const document = await queryClient.fetchQuery({
      queryKey: warrantyKeys.componentIssueDetail(row.id),
      queryFn: () =>
        withComponentIssueReadSlot(() => fetchComponentIssueDocument(row.id)),
    });
    if (document.id !== row.id || !document.lines?.length) {
      throw incompleteSource();
    }
    return document;
  });
  const skuById = await fetchComponentIssueSkuIndex(queryClient, documents);
  return documents.filter((document) => {
    const tracking = resolveComponentIssueTracking(document, skuById);
    if (tracking === null) throw incompleteSource();
    return tracking === params.tracking || tracking === "MIXED";
  });
}

/** Resolve exact IDs across keyword pages; never take the first fuzzy match. */
export async function fetchComponentIssueSkuIndex(
  queryClient: QueryClient,
  documents: readonly ComponentIssueDocument[],
): Promise<Map<string, SkuRecord>> {
  const skuIdsByCode = new Map<string, Set<string>>();
  for (const document of documents) {
    for (const line of document.lines) {
      if (!line.sku_code || !line.sku_id) throw incompleteSource();
      const idsForCode = skuIdsByCode.get(line.sku_code) ?? new Set<string>();
      idsForCode.add(line.sku_id);
      skuIdsByCode.set(line.sku_code, idsForCode);
    }
  }
  const skuById = new Map<string, SkuRecord>();
  await mapConcurrent([...skuIdsByCode], async ([code, requiredIds]) => {
    let previous: Pagination | undefined;
    for (let page = 1; ; page += 1) {
      // Match the visible-row lookup's first-page key to share in-flight reads.
      const skuParams = {
        keyword: code,
        per_page: PAGE_SIZE,
        ...(page > 1 ? { page } : {}),
      };
      const result = await queryClient.fetchQuery({
        queryKey: mvpMasterKeys.skus(skuParams),
        queryFn: () => withComponentIssueReadSlot(() => getMvpSkus(skuParams)),
      });
      for (const sku of result.data) {
        const id = sku.sku_id || sku.id;
        if (id && requiredIds.has(id)) {
          if (typeof sku.is_serial_tracked !== "boolean")
            throw incompleteSource();
          skuById.set(id, sku);
        }
      }
      if ([...requiredIds].every((id) => skuById.has(id))) return;
      const current = readPagination(
        result.meta,
        result.data.length,
        page,
        previous,
      );
      if (page >= current.lastPage) throw incompleteSource();
      previous = current;
    }
  });
  return skuById;
}
