/**
 * Lớp dữ liệu của RPT-07 "Xuất theo người nhận / đại lý".
 *
 * MÀN HÌNH được port 1:1 từ baseline Report 08 (hợp đồng
 * `/reports/recipient-agency/{summary,filter-options,details,exports}`).
 * Backend của dự án này KHÔNG có nhóm endpoint đó, nên module này đóng vai
 * ADAPTER: dựng đúng các shape mà `RecipientAgencyReport.tsx` yêu cầu từ những
 * endpoint CÓ THẬT đang phục vụ báo cáo này:
 *
 *   · `/reports/outbound-by-recipient` — dòng xuất đã POSTED (gross).
 *   · `/reversal-documents`            — lượng hoàn tác theo CHỨNG TỪ gốc.
 *   · `/reports/document-history`      — người tạo/ghi nhận phiếu ⇒ phòng ban.
 *   · `/skus`, `/agencies`, `/users`   — danh mục cho bộ lọc.
 *
 * Công thức phân bổ hoàn tác về từng dòng SKU (largest remainder) là công thức
 * ĐÃ CHỐT của tab 7 hiện hành — copy nguyên văn từ `TabRecipient.tsx` để số
 * liệu của hai màn không lệch nhau. Không phát minh endpoint, không đổi
 * semantics nghiệp vụ.
 *
 * "Lát cắt" (snapshot) ở đây là lát cắt PHÍA CLIENT: mọi sự kiện dựng được từ
 * một lần fetch được lưu vào `SNAPSHOT_STORE` theo `snapshot_id` suy từ chính
 * bộ lọc, để drill-down/export đọc lại đúng tập dữ liệu đang hiển thị — giống
 * ý nghĩa snapshot của hợp đồng gốc, chỉ khác nơi lưu.
 */
import { useCallback, useEffect, useMemo } from "react";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import {
  listOf,
  n,
  text,
  type Raw,
} from "@/modules/reports/operations/report-format";
import {
  useAgencyOptions,
  useDocumentHistory,
  useOutboundByRecipient,
  useReversalDocuments,
  useSkuCatalog,
  useUserDirectory,
} from "@/modules/reports/operations/report-data";
import { runReportExport } from "@/modules/reports/operations/report-export";
import { tStatic } from "@/shared/i18n/useT";

export const RECIPIENT_AGENCY_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Mã báo cáo Annex C dùng cho job export của màn này. */
export const RECIPIENT_AGENCY_REPORT_CODE = "outbound-by-agency";

export type RecipientAgencyProductType = "PRODUCT" | "COMPONENT";

export type RecipientAgencyReversalState =
  | "ALL"
  | "NOT_REVERSED"
  | "PARTIALLY_REVERSED"
  | "FULLY_REVERSED";

export type RecipientAgencySortBy =
  | "RECIPIENT_NAME"
  | "SKU_CODE"
  | "GROSS_ISSUE_POSTED_QTY"
  | "REVERSED_ISSUE_QTY"
  | "NET_ISSUED_QTY"
  | "POSTED_DOCUMENT_COUNT";

export type RecipientAgencyParty = {
  id: string;
  code: string | null;
  name: string | null;
};

export type RecipientAgencyRecipient = RecipientAgencyParty & {
  type: string | null;
};

export type RecipientAgencySkuParty = RecipientAgencyParty & {
  product_type: RecipientAgencyProductType | null;
};

export type RecipientAgencyMetrics = {
  gross_issue_posted_qty: string;
  reversed_issue_qty: string;
  net_issued_qty: string;
  posted_document_count: number;
  reversed_document_count: number;
  fully_reversed_document_count: number;
};

export type RecipientAgencySummaryRow = RecipientAgencyMetrics & {
  drill_key: string;
  recipient: RecipientAgencyRecipient;
  agency: RecipientAgencyParty | null;
  requesting_department: RecipientAgencyParty | null;
  sku: RecipientAgencySkuParty;
  data_quality_flags: string[];
};

export type RecipientAgencyChartPoint = {
  drill_key: string;
  label: string;
  net_issued_qty: string;
};

export type RecipientAgencyPii = {
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  masked: boolean;
};

export type RecipientAgencyDetailRow = RecipientAgencyMetrics & {
  event_id: string;
  event_type: "ISSUE_POSTED" | "ISSUE_REVERSED";
  occurred_at: string;
  outbound_document_id: string;
  outbound_no: string;
  source_request_no: string | null;
  reversal_of_event_id: string | null;
  reversal_state: Exclude<RecipientAgencyReversalState, "ALL">;
  recipient: RecipientAgencyRecipient;
  agency: RecipientAgencyParty | null;
  requesting_department: RecipientAgencyParty | null;
  sku: RecipientAgencySkuParty;
  pii: RecipientAgencyPii | null;
  data_quality_flags: string[];
};

export type RecipientAgencyDetails = {
  snapshot_id: string;
  rows: RecipientAgencyDetailRow[];
  page: { current: number; page_size: number; total: number };
};

export type RecipientAgencyPermissions = {
  can_export: boolean;
  can_view_pii: boolean;
  can_export_pii: boolean;
};

export type RecipientAgencySummary = {
  snapshot_id: string;
  as_of: string;
  timezone: string;
  kpis: RecipientAgencyMetrics;
  chart_by_recipient: RecipientAgencyChartPoint[];
  chart_by_sku: RecipientAgencyChartPoint[];
  rows: RecipientAgencySummaryRow[];
  permissions: RecipientAgencyPermissions;
  page: { current: number; page_size: number; total: number };
};

export type RecipientAgencyFilterOption = {
  id: string;
  code: string | null;
  name: string;
  type?: string | null;
};

export type RecipientAgencyFilterOptions = {
  recipients: RecipientAgencyFilterOption[];
  agencies: RecipientAgencyFilterOption[];
  departments: RecipientAgencyFilterOption[];
  skus: RecipientAgencyFilterOption[];
};

export type RecipientAgencyFilters = {
  dateFrom: string;
  dateTo: string;
  timezone: string;
  recipientIds: string[];
  recipientTypes: string[];
  agencyIds: string[];
  departmentIds: string[];
  skuIds: string[];
  productTypes: RecipientAgencyProductType[];
  reversalState: RecipientAgencyReversalState;
  sortBy: string;
  sortDir: "ASC" | "DESC";
  page: number;
  pageSize: number;
};

export const DEFAULT_RECIPIENT_AGENCY_FILTERS: RecipientAgencyFilters = {
  dateFrom: "",
  dateTo: "",
  timezone: RECIPIENT_AGENCY_TIMEZONE,
  recipientIds: [],
  recipientTypes: [],
  agencyIds: [],
  departmentIds: [],
  skuIds: [],
  productTypes: [],
  reversalState: "ALL",
  sortBy: "NET_ISSUED_QTY",
  sortDir: "DESC",
  page: 1,
  pageSize: 50,
};

// ── Sổ sự kiện dựng phía client ──────────────────────────────────────────

type LedgerEvent = {
  event_id: string;
  event_type: "ISSUE_POSTED" | "ISSUE_REVERSED";
  occurred_at: string;
  outbound_document_id: string;
  outbound_no: string;
  source_request_no: string | null;
  reversal_of_event_id: string | null;
  /** Lượng đã ghi nhận (posted) của chính dòng gốc — dùng để suy reversal_state. */
  posted_quantity: number;
  /** Lượng hoàn tác đã phân bổ cho dòng gốc. */
  reversed_quantity: number;
  quantity: number;
  recipient: RecipientAgencyRecipient;
  agency: RecipientAgencyParty | null;
  requesting_department: RecipientAgencyParty | null;
  sku: RecipientAgencySkuParty;
  pii: RecipientAgencyPii | null;
  cross_period_reversal: boolean;
};

type Snapshot = {
  createdAt: number;
  filters: RecipientAgencyFilters;
  events: LedgerEvent[];
};

/**
 * Kho lát cắt phía client. TTL 15 phút giữ đúng ý nghĩa "lát cắt đã khóa" của
 * hợp đồng gốc: drill-down/export luôn đọc đúng tập dữ liệu người dùng đang
 * nhìn, kể cả khi query nền đã refetch.
 */
const SNAPSHOT_TTL_MS = 15 * 60_000;
const SNAPSHOT_STORE = new Map<string, Snapshot>();

function pruneSnapshots() {
  const now = Date.now();
  for (const [id, snapshot] of SNAPSHOT_STORE) {
    if (now - snapshot.createdAt > SNAPSHOT_TTL_MS) SNAPSHOT_STORE.delete(id);
  }
}

/** Băm ngắn, ổn định (djb2) — cùng bộ lọc ⇒ cùng snapshot_id. */
function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(7, "0");
}

function snapshotIdOf(filters: RecipientAgencyFilters): string {
  const key = [
    filters.dateFrom,
    filters.dateTo,
    filters.timezone,
    [...filters.recipientIds].sort().join(","),
    [...filters.recipientTypes].sort().join(","),
    [...filters.agencyIds].sort().join(","),
    [...filters.departmentIds].sort().join(","),
    [...filters.skuIds].sort().join(","),
    [...filters.productTypes].sort().join(","),
    filters.reversalState,
  ].join("|");
  return `RPT07-${stableHash(key)}`;
}

// ── Helpers dựng party ───────────────────────────────────────────────────

function partyOrNull(
  id: string,
  code: string,
  name: string,
): RecipientAgencyParty | null {
  if (!id && !name) return null;
  return { id: id || name, code: code || null, name: name || null };
}

function reversalStateOf(
  posted: number,
  reversed: number,
): Exclude<RecipientAgencyReversalState, "ALL"> {
  if (reversed <= 0) return "NOT_REVERSED";
  if (reversed >= posted) return "FULLY_REVERSED";
  return "PARTIALLY_REVERSED";
}

function metricsFromEvents(events: LedgerEvent[]): RecipientAgencyMetrics {
  const postedDocs = new Set<string>();
  const reversedDocs = new Set<string>();
  const fullyReversedDocs = new Set<string>();
  let gross = 0;
  let reversed = 0;
  for (const event of events) {
    if (event.event_type === "ISSUE_POSTED") {
      gross += event.quantity;
      postedDocs.add(event.outbound_document_id);
      if (
        reversalStateOf(event.posted_quantity, event.reversed_quantity) ===
        "FULLY_REVERSED"
      ) {
        fullyReversedDocs.add(event.outbound_document_id);
      }
    } else {
      reversed += event.quantity;
      reversedDocs.add(event.outbound_document_id);
    }
  }
  return {
    gross_issue_posted_qty: String(gross),
    reversed_issue_qty: String(reversed),
    net_issued_qty: String(gross - reversed),
    posted_document_count: postedDocs.size,
    reversed_document_count: reversedDocs.size,
    fully_reversed_document_count: fullyReversedDocs.size,
  };
}

function groupKeyOf(event: LedgerEvent): string {
  return [
    event.recipient.id || "none",
    event.agency?.id || "none",
    event.requesting_department?.id || "none",
    event.sku.id || "none",
    event.sku.product_type || "none",
  ].join("|");
}

function rowForGroup(
  key: string,
  events: LedgerEvent[],
): RecipientAgencySummaryRow {
  const first = events[0];
  return {
    drill_key: `group:${key}`,
    recipient: first.recipient,
    agency: first.agency,
    requesting_department: first.requesting_department,
    sku: first.sku,
    ...metricsFromEvents(events),
    data_quality_flags: events.some((event) => event.cross_period_reversal)
      ? ["CROSS_PERIOD_REVERSAL"]
      : [],
  };
}

function compareRows(sortBy: string, sortDir: "ASC" | "DESC") {
  const descending = sortDir !== "ASC";
  const numericField = {
    GROSS_ISSUE_POSTED_QTY: "gross_issue_posted_qty",
    REVERSED_ISSUE_QTY: "reversed_issue_qty",
    NET_ISSUED_QTY: "net_issued_qty",
    POSTED_DOCUMENT_COUNT: "posted_document_count",
  }[sortBy] as keyof RecipientAgencyMetrics | undefined;

  return (
    left: RecipientAgencySummaryRow,
    right: RecipientAgencySummaryRow,
  ) => {
    let value = 0;
    if (numericField) {
      value = Number(left[numericField]) - Number(right[numericField]);
    } else if (sortBy === "RECIPIENT_NAME") {
      value = String(left.recipient.name ?? "").localeCompare(
        String(right.recipient.name ?? ""),
        "vi",
      );
    } else if (sortBy === "SKU_CODE") {
      value = String(left.sku.code ?? "").localeCompare(
        String(right.sku.code ?? ""),
        "vi",
      );
    }
    if (value === 0) value = left.drill_key.localeCompare(right.drill_key);
    return descending ? -value : value;
  };
}

function chartPoints(
  events: LedgerEvent[],
  kind: "recipient" | "sku",
): RecipientAgencyChartPoint[] {
  const grouped = new Map<string, LedgerEvent[]>();
  for (const event of events) {
    const entity = kind === "recipient" ? event.recipient : event.sku;
    if (!entity.id) continue;
    const bucket = grouped.get(entity.id);
    if (bucket) bucket.push(event);
    else grouped.set(entity.id, [event]);
  }
  return [...grouped.entries()]
    .map(([id, values]) => ({
      drill_key: `${kind}:${id}`,
      label:
        kind === "recipient"
          ? (values[0].recipient.name ?? "")
          : (values[0].sku.code ?? values[0].sku.name ?? ""),
      net_issued_qty: metricsFromEvents(values).net_issued_qty,
    }))
    .sort(
      (left, right) =>
        Number(right.net_issued_qty) - Number(left.net_issued_qty),
    )
    .slice(0, 10);
}

function detailFromEvent(event: LedgerEvent): RecipientAgencyDetailRow {
  return {
    event_id: event.event_id,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    outbound_document_id: event.outbound_document_id,
    outbound_no: event.outbound_no,
    source_request_no: event.source_request_no,
    reversal_of_event_id: event.reversal_of_event_id,
    reversal_state: reversalStateOf(
      event.posted_quantity,
      event.reversed_quantity,
    ),
    recipient: event.recipient,
    agency: event.agency,
    requesting_department: event.requesting_department,
    sku: event.sku,
    ...metricsFromEvents([event]),
    pii: event.pii,
    data_quality_flags: event.cross_period_reversal
      ? ["CROSS_PERIOD_REVERSAL"]
      : [],
  };
}

// ── Hook chính ───────────────────────────────────────────────────────────

/**
 * Dựng lát cắt Report 08 từ các endpoint có thật của dự án.
 *
 * Trả về đúng bề mặt mà màn hình dùng (`data / isLoading / isFetching / error /
 * refetch`) nên component không cần biết bên dưới là một hay nhiều query.
 */
export function useRecipientAgencySummary(filters: RecipientAgencyFilters) {
  const enabled = Boolean(filters.dateFrom && filters.dateTo);
  const outbound = useOutboundByRecipient({
    from: filters.dateFrom,
    to: filters.dateTo,
    enabled,
  });
  const reversals = useReversalDocuments({
    from: filters.dateFrom,
    to: filters.dateTo,
    enabled,
  });
  const documents = useDocumentHistory({
    from: filters.dateFrom,
    to: filters.dateTo,
    docType: "outbound",
    enabled,
  });
  const catalog = useSkuCatalog();
  const users = useUserDirectory();

  const canExport = useCan(WMS_PERMISSION_CATALOG.REPORT_EXPORT);

  const events = useMemo(
    () =>
      buildLedger(
        outbound.data,
        reversals.data,
        documents.data,
        catalog,
        users,
      ),
    [outbound.data, reversals.data, documents.data, catalog, users],
  );

  // Mốc "chốt lát cắt" = lần dữ liệu nguồn về gần nhất. Trong lúc đổi bộ lọc,
  // react-query giữ dữ liệu cũ làm placeholder và `dataUpdatedAt` tạm về 0 —
  // khi đó dòng "Chốt lúc …" hiện EMPTY_TEXT đúng như mọi ô chưa có dữ liệu.
  const asOf = useMemo(() => {
    const stamps = [
      outbound.dataUpdatedAt,
      reversals.dataUpdatedAt,
      documents.dataUpdatedAt,
    ].filter((stamp) => stamp > 0);
    if (!stamps.length) return "";
    return new Date(Math.max(...stamps)).toISOString();
  }, [
    outbound.dataUpdatedAt,
    reversals.dataUpdatedAt,
    documents.dataUpdatedAt,
  ]);

  const computed = useMemo(() => {
    if (!outbound.data) return undefined;

    const matching = events.filter((event) => matchesFilters(event, filters));
    const snapshotId = snapshotIdOf(filters);

    const grouped = new Map<string, LedgerEvent[]>();
    for (const event of matching) {
      const key = groupKeyOf(event);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(event);
      else grouped.set(key, [event]);
    }
    const orderedRows = [...grouped.entries()]
      .map(([key, values]) => rowForGroup(key, values))
      .sort(compareRows(filters.sortBy, filters.sortDir));

    const page = Math.max(1, filters.page);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize));

    const summary: RecipientAgencySummary = {
      snapshot_id: snapshotId,
      as_of: asOf,
      timezone: filters.timezone,
      kpis: metricsFromEvents(matching),
      chart_by_recipient: chartPoints(matching, "recipient"),
      chart_by_sku: chartPoints(matching, "sku"),
      rows: orderedRows.slice((page - 1) * pageSize, page * pageSize),
      permissions: {
        can_export: canExport,
        // Endpoint `/reports/outbound-by-recipient` luôn trả liên hệ ĐÃ CHE
        // (WarrantyPiiMasker) và dự án chưa có quyền xem/xuất PII người nhận,
        // nên hai cờ này fail-closed thay vì đoán.
        can_view_pii: false,
        can_export_pii: false,
      },
      page: { current: page, page_size: pageSize, total: orderedRows.length },
    };
    return { summary, events: matching };
  }, [outbound.data, events, filters, asOf, canExport]);

  // Ghi lát cắt vào kho SAU khi render: drill-down/export đọc lại đúng tập sự
  // kiện đang hiển thị mà không biến giai đoạn render thành hàm có tác dụng phụ.
  useEffect(() => {
    if (!computed) return;
    pruneSnapshots();
    SNAPSHOT_STORE.set(computed.summary.snapshot_id, {
      createdAt: Date.now(),
      filters,
      events: computed.events,
    });
  }, [computed, filters]);

  const refetch = useCallback(async () => {
    await Promise.all([
      outbound.refetch(),
      reversals.refetch(),
      documents.refetch(),
    ]);
  }, [outbound, reversals, documents]);

  return {
    data: computed?.summary,
    isLoading: outbound.isLoading || reversals.isLoading || documents.isLoading,
    isFetching:
      outbound.isFetching || reversals.isFetching || documents.isFetching,
    error: outbound.error ?? reversals.error ?? documents.error ?? null,
    refetch,
  };
}

function matchesFilters(
  event: LedgerEvent,
  filters: RecipientAgencyFilters,
): boolean {
  const checks: Array<[string[], string | null | undefined]> = [
    [filters.recipientIds, event.recipient.id],
    [filters.recipientTypes, event.recipient.type],
    [filters.agencyIds, event.agency?.id],
    [filters.departmentIds, event.requesting_department?.id],
    [filters.skuIds, event.sku.id],
    [filters.productTypes, event.sku.product_type],
  ];
  for (const [selected, candidate] of checks) {
    if (selected.length > 0 && (!candidate || !selected.includes(candidate))) {
      return false;
    }
  }
  if (filters.reversalState === "ALL") return true;
  return (
    reversalStateOf(event.posted_quantity, event.reversed_quantity) ===
    filters.reversalState
  );
}

/**
 * Danh mục cho các bộ lọc. Người nhận/SKU lấy từ chính lát cắt đang xem (chỉ
 * hiện thứ thật sự có phát sinh trong kỳ, đúng như `filter-options` của hợp
 * đồng gốc); đại lý và phòng ban lấy từ master data đang dùng chung.
 */
export function useRecipientAgencyFilterOptions(from: string, to: string) {
  const enabled = Boolean(from && to);
  const outbound = useOutboundByRecipient({ from, to, enabled });
  const documents = useDocumentHistory({
    from,
    to,
    docType: "outbound",
    enabled,
  });
  const agencies = useAgencyOptions();
  const catalog = useSkuCatalog();
  const users = useUserDirectory();

  const events = useMemo(
    () => buildLedger(outbound.data, undefined, documents.data, catalog, users),
    [outbound.data, documents.data, catalog, users],
  );

  const data = useMemo<RecipientAgencyFilterOptions | undefined>(() => {
    if (!outbound.data) return undefined;
    const recipients = new Map<string, RecipientAgencyFilterOption>();
    const skus = new Map<string, RecipientAgencyFilterOption>();
    const departments = new Map<string, RecipientAgencyFilterOption>();
    for (const event of events) {
      if (event.recipient.id && !recipients.has(event.recipient.id)) {
        recipients.set(event.recipient.id, {
          id: event.recipient.id,
          code: event.recipient.code,
          name: event.recipient.name ?? "",
          type: event.recipient.type,
        });
      }
      if (event.sku.id && !skus.has(event.sku.id)) {
        skus.set(event.sku.id, {
          id: event.sku.id,
          code: event.sku.code,
          name: event.sku.name ?? "",
        });
      }
      const department = event.requesting_department;
      if (department?.id && !departments.has(department.id)) {
        departments.set(department.id, {
          id: department.id,
          code: department.code,
          name: department.name ?? "",
        });
      }
    }
    const byName = (
      left: RecipientAgencyFilterOption,
      right: RecipientAgencyFilterOption,
    ) => left.name.localeCompare(right.name, "vi");
    return {
      recipients: [...recipients.values()].sort(byName),
      agencies: agencies.entries
        .filter((entry) => entry.agency_id !== "")
        .map((entry) => ({
          id: entry.agency_id,
          code: entry.agency_code || null,
          name: entry.agency_name,
        }))
        .sort(byName),
      departments: [...departments.values()].sort(byName),
      skus: [...skus.values()].sort(byName),
    };
  }, [outbound.data, events, agencies.entries]);

  const refetch = useCallback(async () => {
    await Promise.all([outbound.refetch(), documents.refetch()]);
  }, [outbound, documents]);

  return {
    data,
    isLoading: outbound.isLoading || documents.isLoading,
    isFetching: outbound.isFetching || documents.isFetching,
    error: outbound.error ?? documents.error ?? null,
    refetch,
  };
}

/**
 * Chi tiết chứng từ nguồn của một `drill_key` trong lát cắt đang mở. Đọc thẳng
 * từ kho lát cắt nên không phát sinh request mới — người dùng luôn thấy đúng
 * dữ liệu của dòng vừa bấm.
 */
export function useRecipientAgencyDetails(
  snapshotId: string | null,
  drillKey: string | null,
) {
  const result = useMemo(() => {
    if (!snapshotId || !drillKey) {
      return { data: undefined, error: null as unknown };
    }
    // Lát cắt hết hạn đã bị `pruneSnapshots()` dọn khi tạo lát cắt mới, nên ở
    // đây chỉ cần kiểm tra sự tồn tại — không đọc đồng hồ trong lúc render.
    const snapshot = SNAPSHOT_STORE.get(snapshotId);
    if (!snapshot) {
      return {
        data: undefined,
        error: new Error(
          tStatic("reports.recipientAgency.snapshotExpiredDrill"),
        ) as unknown,
      };
    }

    let events: LedgerEvent[];
    if (drillKey.startsWith("group:")) {
      const key = drillKey.slice("group:".length);
      events = snapshot.events.filter((event) => groupKeyOf(event) === key);
    } else if (drillKey.startsWith("recipient:")) {
      const id = drillKey.slice("recipient:".length);
      events = snapshot.events.filter((event) => event.recipient.id === id);
    } else if (drillKey.startsWith("sku:")) {
      const id = drillKey.slice("sku:".length);
      events = snapshot.events.filter((event) => event.sku.id === id);
    } else {
      return {
        data: undefined,
        error: new Error(
          tStatic("reports.recipientAgency.drillKeyInvalid"),
        ) as unknown,
      };
    }

    const rows = events
      .map(detailFromEvent)
      .sort(
        (left, right) =>
          Date.parse(right.occurred_at) - Date.parse(left.occurred_at),
      );
    const details: RecipientAgencyDetails = {
      snapshot_id: snapshotId,
      rows,
      page: { current: 1, page_size: rows.length, total: rows.length },
    };
    return { data: details, error: null as unknown };
  }, [snapshotId, drillKey]);

  return {
    data: result.data,
    isLoading: false,
    error: result.error,
    refetch: () => Promise.resolve(),
  };
}

/**
 * Xuất báo cáo theo ĐÚNG lát cắt đang xem, đi qua job export Annex C
 * (`POST /reports/export` + poll + download) để mọi lần xuất vẫn được audit.
 */
export async function exportRecipientAgencyReport({
  snapshotId,
  format,
}: {
  snapshotId: string;
  format: "XLSX" | "CSV";
  scope?: "DETAIL" | "SUMMARY";
  includePii?: boolean;
}): Promise<void> {
  const snapshot = SNAPSHOT_STORE.get(snapshotId);
  if (!snapshot || Date.now() - snapshot.createdAt > SNAPSHOT_TTL_MS) {
    throw new Error(tStatic("reports.recipientAgency.snapshotExpiredExport"));
  }
  if (format !== "XLSX") {
    // `POST /reports/export` chỉ nhận xlsx|pdf và dự án chưa có kênh xuất kèm
    // PII người nhận. Nút CSV vì vậy luôn ở trạng thái khóa quyền; nhánh này
    // chỉ là chốt chặn fail-closed nếu quyền được mở mà BE chưa sẵn sàng.
    throw new Error(tStatic("reports.recipientAgency.csvNotSupported"));
  }
  await runReportExport("xlsx", {
    reportCode: RECIPIENT_AGENCY_REPORT_CODE,
    fileStem: "xuat-theo-nguoi-nhan-dai-ly",
    fileSuffix: `-${snapshot.filters.dateFrom}_${snapshot.filters.dateTo}`,
    filters: exportFiltersOf(snapshot.filters),
  });
}

function exportFiltersOf(filters: RecipientAgencyFilters): Raw {
  const params: Raw = {
    from_date: filters.dateFrom,
    to_date: filters.dateTo,
  };
  if (filters.recipientIds.length === 1) {
    params.recipient_id = filters.recipientIds[0];
  }
  if (filters.recipientTypes.length === 1) {
    params.recipient_type = filters.recipientTypes[0];
  }
  return params;
}

// ── Dựng sổ sự kiện từ dữ liệu thật ──────────────────────────────────────

type CatalogLike = ReturnType<typeof useSkuCatalog>;
type UserDirectoryLike = ReturnType<typeof useUserDirectory>;

function buildLedger(
  outboundData: Raw | undefined,
  reversalData: { data?: unknown } | undefined,
  documentData: Raw | undefined,
  catalog: CatalogLike,
  users: UserDirectoryLike,
): LedgerEvent[] {
  const raw = listOf(outboundData?.rows);
  if (!raw.length) return [];

  const documentRows = listOf(documentData?.rows);
  const documentNoById = new Map<string, string>();
  for (const row of documentRows) {
    documentNoById.set(text(row.id, ""), text(row.document_no, ""));
  }

  /** Số phiếu xuất → lượng đã hoàn tác (POSTED) của chính phiếu đó. */
  const reversalByOutboundNo = new Map<string, number>();
  /** Số phiếu xuất → thời điểm hoàn tác gần nhất. */
  const reversalAtByOutboundNo = new Map<string, string>();
  for (const row of listOf(
    (reversalData as { data?: unknown } | undefined)?.data,
  )) {
    if (text(row.status, "") !== "POSTED") continue;
    const docNo =
      text(row.reference_document_code, "") ||
      documentNoById.get(text(row.reference_document_id, "")) ||
      "";
    if (!docNo) continue;
    reversalByOutboundNo.set(
      docNo,
      (reversalByOutboundNo.get(docNo) ?? 0) + n(row.total_qty),
    );
    const reversedAt = text(row.reversed_at ?? row.posted_at, "");
    if (reversedAt) {
      const current = reversalAtByOutboundNo.get(docNo);
      if (!current || Date.parse(reversedAt) > Date.parse(current)) {
        reversalAtByOutboundNo.set(docNo, reversedAt);
      }
    }
  }

  /** Số phiếu xuất → phòng ban xử lý (suy từ người tạo/ghi nhận phiếu). */
  const departmentByOutboundNo = new Map<string, string>();
  for (const row of documentRows) {
    const docNo = text(row.document_no, "");
    if (!docNo) continue;
    const actor = text(row.created_by_name ?? row.posted_by_name, "");
    const departmentId = users.departmentOfName(actor);
    if (departmentId) departmentByOutboundNo.set(docNo, departmentId);
  }
  const departmentNameById = new Map(
    users.departmentOptions.map((option) => [option.value, option.label]),
  );

  // Phân bổ lượng hoàn tác của một phiếu về từng dòng SKU theo tỉ trọng gross,
  // làm tròn "phần dư lớn nhất" — công thức đã chốt của tab 7 (TabRecipient).
  const linesByDocument = new Map<string, number[]>();
  raw.forEach((row, index) => {
    const docNo = text(row.outbound_no, "");
    const bucket = linesByDocument.get(docNo);
    if (bucket) bucket.push(index);
    else linesByDocument.set(docNo, [index]);
  });

  const reversalByIndex = new Array<number>(raw.length).fill(0);
  for (const [docNo, indexes] of linesByDocument) {
    const documentReversal = reversalByOutboundNo.get(docNo) ?? 0;
    if (documentReversal <= 0) continue;
    const grossOf = (index: number) =>
      n(raw[index].issued_qty ?? raw[index].scanned_qty);
    const documentGross = indexes.reduce(
      (acc, index) => acc + grossOf(index),
      0,
    );
    if (documentGross <= 0) continue;

    const shares = indexes.map((index) => {
      const exact = (documentReversal * grossOf(index)) / documentGross;
      return { index, floor: Math.floor(exact), rest: exact % 1 };
    });
    let remaining =
      documentReversal - shares.reduce((acc, item) => acc + item.floor, 0);
    shares.sort((a, b) => b.rest - a.rest);
    for (const share of shares) {
      const bonus = remaining > 0 ? 1 : 0;
      remaining -= bonus;
      reversalByIndex[share.index] = share.floor + bonus;
    }
  }

  const events: LedgerEvent[] = [];
  raw.forEach((row, index) => {
    const outboundNo = text(row.outbound_no, "");
    const documentId = text(row.document_id, "") || outboundNo;
    const documentDate = text(row.document_date, "");
    const productCode = text(row.product_code, "");
    const catalogEntry = catalog.byCode.get(productCode);
    const gross = n(row.issued_qty ?? row.scanned_qty);
    const reversed = reversalByIndex[index] ?? 0;

    const recipientId = text(row.recipient_id, "");
    const recipientName = text(row.recipient_name ?? row.agency_name, "");
    const recipient: RecipientAgencyRecipient = {
      id: recipientId || recipientName,
      code: text(row.agency_code, "") || null,
      name: recipientName || null,
      type: text(row.recipient_type, "") || null,
    };
    // Chỉ những phiếu có liên kết agency master mới có "tuyến đại lý"; phiếu
    // chỉ mang tên người nhận snapshot là xuất trực tiếp.
    const agency = partyOrNull(
      text(row.agency_id, ""),
      text(row.agency_code, ""),
      text(row.agency_name, ""),
    );
    const departmentId = departmentByOutboundNo.get(outboundNo) ?? "";
    const requestingDepartment = departmentId
      ? {
          id: departmentId,
          code: null,
          name: departmentNameById.get(departmentId) ?? null,
        }
      : null;
    const sku: RecipientAgencySkuParty = {
      id: text(row.sku_id, "") || productCode,
      code: productCode || null,
      name: text(row.product_name, catalogEntry?.sku_name ?? "") || null,
      product_type:
        catalogEntry?.sku_type === "COMPONENT"
          ? "COMPONENT"
          : catalogEntry?.sku_type === "PRODUCT"
            ? "PRODUCT"
            : null,
    };
    const address = text(row.address, "");
    const maskedPhone = text(row.contact_masked, "");
    const pii: RecipientAgencyPii | null =
      address || maskedPhone
        ? {
            contact_name: null,
            phone: maskedPhone || null,
            email: null,
            address: address || null,
            // API đã che liên hệ ở phía máy chủ.
            masked: true,
          }
        : null;

    const postedEventId = `${documentId}#${index}:POSTED`;
    const reversedAt = reversalAtByOutboundNo.get(outboundNo) ?? documentDate;
    const crossPeriod =
      reversed > 0 &&
      Boolean(documentDate) &&
      Boolean(reversedAt) &&
      documentDate.slice(0, 7) !== reversedAt.slice(0, 7);

    const base = {
      outbound_document_id: documentId,
      outbound_no: outboundNo,
      source_request_no: text(row.source_request_no, "") || null,
      posted_quantity: gross,
      reversed_quantity: reversed,
      recipient,
      agency,
      requesting_department: requestingDepartment,
      sku,
      pii,
      cross_period_reversal: crossPeriod,
    };

    if (gross > 0) {
      events.push({
        ...base,
        event_id: postedEventId,
        event_type: "ISSUE_POSTED",
        occurred_at: documentDate,
        reversal_of_event_id: null,
        quantity: gross,
      });
    }
    if (reversed > 0) {
      events.push({
        ...base,
        event_id: `${documentId}#${index}:REVERSED`,
        event_type: "ISSUE_REVERSED",
        occurred_at: reversedAt,
        reversal_of_event_id: postedEventId,
        quantity: reversed,
      });
    }
  });

  return events;
}
