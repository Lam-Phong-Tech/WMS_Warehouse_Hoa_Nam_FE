import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
import {
  fetchOutboundDocuments,
  type OutboundDocumentRecord,
  type OutboundListResult,
} from "@/modules/outbound/services/alignedOutboundService";
import { tStatic as tUi } from "@/shared/i18n/useT";

type OutboundListParams = NonNullable<
  Parameters<typeof fetchOutboundDocuments>[0]
>;

export interface OutboundRecipientListParams extends OutboundListParams {
  recipientName: string;
}

const INDEX_PAGE_SIZE = 100;
const MAX_INDEX_PAGES = 1000;
const getINCOMPLETE_LIST_MESSAGE = localizedUiValue(() =>
  tUi("updatedUi.text_16a239d0e413"),
);

function paginationError(): Error {
  return new Error(getINCOMPLETE_LIST_MESSAGE());
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

/**
 * The list endpoint has no recipient parameter. Read every matching API page
 * before filtering so recipients on later pages are not silently omitted.
 * A changing/incomplete page set is an error, never a successful partial list.
 */
async function fetchAllOutboundRows(
  params: Pick<OutboundListParams, "search" | "status" | "sortOrder">,
  signal?: AbortSignal,
): Promise<OutboundDocumentRecord[]> {
  const rowsById = new Map<string, OutboundDocumentRecord>();
  let expectedTotal: number | undefined;
  let expectedPageSize: number | undefined;
  let lastPage = 1;

  for (let page = 1; page <= lastPage; page += 1) {
    signal?.throwIfAborted();
    const result = await fetchOutboundDocuments({
      ...params,
      page,
      per_page: INDEX_PAGE_SIZE,
    });
    signal?.throwIfAborted();

    const { current_page, per_page, total, last_page } = result.meta;
    if (
      current_page !== page ||
      !isIntegerAtLeast(per_page, 1) ||
      per_page > INDEX_PAGE_SIZE ||
      !isIntegerAtLeast(total, 0)
    ) {
      throw paginationError();
    }

    const calculatedLastPage = Math.max(1, Math.ceil(total / per_page));
    if (
      calculatedLastPage > MAX_INDEX_PAGES ||
      (last_page !== undefined && last_page !== calculatedLastPage) ||
      (expectedTotal !== undefined && total !== expectedTotal) ||
      (expectedPageSize !== undefined && per_page !== expectedPageSize)
    ) {
      throw paginationError();
    }

    expectedTotal = total;
    expectedPageSize = per_page;
    lastPage = calculatedLastPage;
    const expectedRows = Math.min(per_page, total - (page - 1) * per_page);
    if (result.data.length !== expectedRows) throw paginationError();

    for (const row of result.data) {
      if (!row.id) throw paginationError();
      if (!rowsById.has(row.id)) rowsById.set(row.id, row);
    }
  }

  // Duplicate IDs can indicate that data moved between API pages while loading.
  // Deduplicate the index, but do not return it if records are still missing.
  if (rowsById.size !== expectedTotal) throw paginationError();
  return [...rowsById.values()];
}

/** Load lazily when the recipient selector opens. */
export function fetchOutboundRecipientIndex(
  signal?: AbortSignal,
): Promise<OutboundDocumentRecord[]> {
  return fetchAllOutboundRows({}, signal);
}

export function filterOutboundRecipientRows(
  rows: readonly OutboundDocumentRecord[],
  recipientName: string,
): OutboundDocumentRecord[] {
  return rows.filter((row) => row.recipientName === recipientName);
}

/** Keep server search/status/order semantics, then paginate exact recipients. */
export async function fetchOutboundRowsForRecipient(
  params: OutboundRecipientListParams,
  signal?: AbortSignal,
): Promise<OutboundListResult> {
  const page = params.page ?? 1;
  const perPage = params.per_page ?? 10;
  if (!isIntegerAtLeast(page, 1) || !isIntegerAtLeast(perPage, 1)) {
    throw paginationError();
  }

  const rows = filterOutboundRecipientRows(
    await fetchAllOutboundRows(
      {
        search: params.search,
        status: params.status,
        sortOrder: params.sortOrder,
      },
      signal,
    ),
    params.recipientName,
  );
  const offset = (page - 1) * perPage;
  const data = rows.slice(offset, offset + perPage);
  return {
    data,
    meta: {
      current_page: page,
      per_page: perPage,
      total: rows.length,
      last_page: Math.max(1, Math.ceil(rows.length / perPage)),
      from: data.length ? offset + 1 : 0,
      to: data.length ? offset + data.length : 0,
    },
  };
}
