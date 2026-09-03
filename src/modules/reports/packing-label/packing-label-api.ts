import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  listOf,
  n,
  objectOf,
  text,
  type Raw,
  type SelectOption,
} from "@/modules/reports/operations/report-format";
import {
  useLabelLog,
  usePrinterOptions,
  useUserDirectory,
} from "@/modules/reports/operations/report-data";
import { tStatic } from "@/shared/i18n/useT";

/**
 * NGUỒN DỮ LIỆU CỦA RPT-05 — Nhãn đóng gói · Print / Reprint.
 *
 * Màn hình đọc MỘT DÒNG LÀ MỘT LẦN IN (event audit), nhưng backend chia đôi
 * thông tin đó:
 *
 *  - `/reports/label-log` (permission `report.view`) trả TỔNG HỢP theo từng
 *    nhãn: mã nhãn, phiếu xuất, người nhận, máy in + người in của lần in gần
 *    nhất, số lần in / lỗi / in lại. Đây là hợp đồng RPT-LABEL-01 và cũng là
 *    thứ mà `/reports/export` (report_code `label-log`) xuất ra, nên KỲ BÁO CÁO
 *    của màn hình phải là kỳ của endpoint này — nếu lọc theo ngày của event thì
 *    file XLSX/PDF tải về sẽ mô tả một tập dòng khác hẳn thứ đang hiện trên
 *    màn hình mà người đọc không có cách nào phát hiện.
 *  - `/label-print-events` (permission `label.print`) trả TỪNG LẦN IN nhưng là
 *    dòng thô của bảng `label_print_events`: chỉ có `label_snapshot_id`,
 *    `printer_config_id`, `created_by` — không kèm tên nhãn/phiếu/máy in/người
 *    in. Ghép lại bằng ba danh mục dùng chung (`label-log`, `/printer-configs`,
 *    `/users`) ngay ở đây để chỗ dùng không phải tự đoán.
 *
 * Endpoint event KHÔNG có tham số ngày và có thể thiếu quyền với người chỉ có
 * `report.view`; cả hai giới hạn đó đều được phơi ra ngoài (`capped`,
 * `eventsError`) thay vì im lặng trả bảng rỗng.
 */

const STALE_MS = 60_000;
/** Trần 100 dòng/trang là giới hạn cứng của `/label-print-events` ở BE. */
const EVENT_PAGE_SIZE = 100;
/** Trần cuốn trang — 20 × 100 = 2.000 lần in gần nhất. */
export const LABEL_EVENT_MAX_PAGES = 20;
/** Số lần in tối đa màn hình đọc được trong một lượt tải. */
export const LABEL_EVENT_LIMIT = EVENT_PAGE_SIZE * LABEL_EVENT_MAX_PAGES;

/**
 * Kết quả một lần in, theo ĐÚNG bộ giá trị BE khai trong OpenAPI của
 * `/label-print-events`.
 */
export type PackingLabelResult = "PENDING_PRINT" | "PRINTED" | "PRINT_FAILED";

/** Thao tác trên nhãn: in lần đầu hay in lại. */
export type PackingLabelAction = "PRINT" | "REPRINT";

export type PackingLabelEvent = {
  eventId: string;
  labelId: string;
  labelCode: string;
  outboundNo: string;
  outboundDate: string;
  recipient: string;
  action: PackingLabelAction;
  result: PackingLabelResult;
  attemptedAt: string;
  attemptNo: number;
  printerId: string;
  printerName: string;
  actorId: string;
  actorName: string;
  errorCode: string;
  reasonCode: string;
  reasonNote: string;
  /** Dấu vết audit đủ bốn mảnh (thời điểm · máy in · người thao tác · kết quả). */
  auditComplete: boolean;
  /** Tên các mảnh audit còn thiếu — hiện thẳng trong tooltip, không suy diễn. */
  auditMissing: string[];
};

export type PackingLabelDetail = {
  labelId: string;
  labelCode: string;
  outboundNo: string;
  outboundDate: string;
  recipient: string;
  status: string;
  version: string;
  appliedAt: string;
  createdAt: string;
  content: string;
  attempts: PackingLabelEvent[];
};

/**
 * BE lưu song song hai bộ từ vựng cho cùng một trạng thái: bộ nghiệp vụ
 * (`PENDING_PRINT` / `PRINTED` / `PRINT_FAILED`) và bộ ERD mà trigger PostgreSQL
 * chuẩn hoá về (`PENDING` / `SENT` / `PRINTED` / `FAILED`). Chính
 * `AlignedLabelLogReportController` cũng phải đếm `status IN ('PRINT_FAILED',
 * 'FAILED')` vì lý do này — quy về một bộ ngay khi đọc, nếu không cột "Kết quả"
 * sẽ hiện hai nhãn khác nhau cho cùng một sự việc.
 */
export function normalizePrintResult(value: unknown): PackingLabelResult {
  const raw = String(value ?? "").toUpperCase();
  if (raw === "PRINTED") return "PRINTED";
  if (raw === "PRINT_FAILED" || raw === "FAILED") return "PRINT_FAILED";
  return "PENDING_PRINT";
}

export const PACKING_LABEL_RESULTS: readonly PackingLabelResult[] = [
  "PRINTED",
  "PRINT_FAILED",
  "PENDING_PRINT",
];

export const PACKING_LABEL_ACTIONS: readonly PackingLabelAction[] = [
  "PRINT",
  "REPRINT",
];

export type PackingLabelDimension = {
  labelCode: string;
  outboundNo: string;
  outboundDate: string;
  recipient: string;
  status: string;
  createdAt: string;
  itemCount: number;
  skuCount: number;
  skuSummary: string;
  applied: boolean;
};

type RawEvent = {
  eventId: string;
  labelId: string;
  result: PackingLabelResult;
  eventType: string;
  attemptNo: number;
  attemptedAt: string;
  printerId: string;
  actorId: string;
  errorCode: string;
  reasonCode: string;
  reasonNote: string;
};

function readRawEvent(row: Raw): RawEvent {
  const metadata = objectOf(row.metadata);
  return {
    eventId: text(row.id, ""),
    labelId: text(row.label_snapshot_id, ""),
    result: normalizePrintResult(row.status),
    eventType: String(row.event_type ?? "").toUpperCase(),
    attemptNo: n(row.attempt_no, 0),
    // `requested_at` là mốc ERD của lần in; bản ghi cũ chưa backfill thì rơi về
    // `printed_at`/`created_at` — không bỏ trống cột "Thời điểm".
    attemptedAt: text(row.requested_at ?? row.printed_at ?? row.created_at, ""),
    printerId: text(row.printer_config_id ?? row.printer_id, ""),
    actorId: text(row.created_by ?? row.actor_id, ""),
    errorCode: text(row.error_code, ""),
    // Controller đã phẳng hoá `metadata.reason` thành field `reason`; đọc cả
    // hai để không phụ thuộc vào một phiên bản BE duy nhất.
    reasonCode: text(row.reason ?? metadata.reason, ""),
    reasonNote: text(row.error_message, ""),
  };
}

/**
 * Print hay Reprint?
 *
 * Cột `event_type` chỉ được ghi bởi migration backfill (mặc định `PRINT`) —
 * đường ghi thật (`dispatchLabelOnce`) không set cột này, nên KHÔNG thể tin nó
 * một mình. Định nghĩa có hiệu lực là định nghĩa BE dùng để tính `reprint_count`
 * của RPT-LABEL-01: **in lại là lần in THÀNH CÔNG thứ hai trở đi của cùng một
 * nhãn**; thử lại sau khi lỗi vẫn là Print. Vẫn ưu tiên `event_type` khi BE nói
 * rõ `REPRINT` để dữ liệu tương lai không bị đọc sai.
 */
function resolveActions(events: RawEvent[]): Map<string, PackingLabelAction> {
  const byLabel = new Map<string, RawEvent[]>();
  for (const event of events) {
    const bucket = byLabel.get(event.labelId);
    if (bucket) bucket.push(event);
    else byLabel.set(event.labelId, [event]);
  }

  const actions = new Map<string, PackingLabelAction>();
  for (const bucket of byLabel.values()) {
    let successSoFar = 0;
    for (const event of [...bucket].sort((left, right) =>
      left.attemptedAt.localeCompare(right.attemptedAt),
    )) {
      if (event.result === "PRINTED") successSoFar += 1;
      const derived: PackingLabelAction =
        event.eventType === "REPRINT" || successSoFar > 1 ? "REPRINT" : "PRINT";
      actions.set(event.eventId, derived);
    }
  }
  return actions;
}

/** Toàn bộ lần in gần nhất (BE không có tham số ngày cho endpoint này). */
function useLabelPrintEvents(enabled: boolean) {
  return useQuery({
    queryKey: ["rpt-05", "label-print-events"],
    queryFn: async () => {
      const rows: Raw[] = [];
      let capped = false;
      for (let page = 1; page <= LABEL_EVENT_MAX_PAGES; page += 1) {
        const result = await http.getPage<Raw[]>(
          API_ENDPOINTS.LABEL_PRINT_EVENTS,
          { params: { page, per_page: EVENT_PAGE_SIZE } },
        );
        const pageRows = Array.isArray(result.data) ? result.data : [];
        rows.push(...pageRows);
        const lastPage = n(result.meta?.last_page, 1);
        if (pageRows.length === 0) break;
        if (page >= lastPage) break;
        if (page === LABEL_EVENT_MAX_PAGES) capped = true;
      }
      return { rows, capped };
    },
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export type PackingLabelReport = {
  /** Mọi lần in của các nhãn thuộc kỳ, mới nhất trước. */
  events: PackingLabelEvent[];
  /** Nhãn trong kỳ theo `/reports/label-log`, để dựng modal bản lưu. */
  labels: Map<string, PackingLabelDimension>;
  printerOptions: SelectOption[];
  actorOptions: SelectOption[];
  loading: boolean;
  fetching: boolean;
  /** Lỗi của nguồn CHÍNH (`/reports/label-log`). */
  error: unknown;
  /** Lỗi riêng của nhật ký từng lần in (thường là thiếu `label.print`). */
  eventsError: unknown;
  /** true = đã chạm trần cuốn trang, danh sách event chưa phải toàn bộ. */
  capped: boolean;
  /** Mốc chốt số liệu = lần in gần nhất đang có trong kỳ. */
  asOf: string;
  refetch: () => void;
};

export function usePackingLabelReport({
  from,
  to,
  enabled = true,
}: {
  from: string;
  to: string;
  enabled?: boolean;
}): PackingLabelReport {
  const labelLog = useLabelLog({ from, to, enabled });
  const eventLog = useLabelPrintEvents(enabled);
  const printers = usePrinterOptions();
  const directory = useUserDirectory();

  const printerNames = useMemo(
    () => new Map(printers.options.map((item) => [item.value, item.label])),
    [printers.options],
  );
  const actorNames = useMemo(
    () =>
      new Map(
        directory.entries
          .filter((entry) => entry.user_id !== "")
          .map((entry) => [entry.user_id, entry.name]),
      ),
    [directory.entries],
  );

  const labels = useMemo(() => {
    const map = new Map<string, PackingLabelDimension>();
    for (const row of listOf(labelLog.data?.rows)) {
      const id = text(row.id, "");
      if (id === "") continue;
      map.set(id, {
        labelCode: text(row.label_code, ""),
        outboundNo: text(row.outbound_no, ""),
        outboundDate: text(row.outbound_date, ""),
        recipient: text(row.recipient, ""),
        status: text(row.status, ""),
        createdAt: text(row.created_at, ""),
        itemCount: n(row.item_count),
        skuCount: n(row.sku_count),
        skuSummary: text(row.sku_summary, ""),
        applied: row.applied === true,
      });
    }
    return map;
  }, [labelLog.data]);

  const events = useMemo(() => {
    const raw = listOf(eventLog.data?.rows)
      .map(readRawEvent)
      .filter((event) => event.eventId !== "" && event.labelId !== "");
    // Chỉ giữ lần in của các nhãn thuộc kỳ đang xem — cùng tập dòng mà
    // `/reports/export` sẽ xuất ra cho report_code `label-log`.
    const inPeriod = raw.filter((event) => labels.has(event.labelId));
    const actions = resolveActions(raw);

    return inPeriod
      .map((event) => {
        const label = labels.get(event.labelId);
        const printerName = event.printerId
          ? (printerNames.get(event.printerId) ?? "")
          : "";
        const actorName = event.actorId
          ? (actorNames.get(event.actorId) ?? "")
          : "";
        const auditMissing: string[] = [];
        if (event.attemptedAt === "")
          auditMissing.push(tStatic("reports.packingLabel.colMoment"));
        if (event.printerId === "")
          auditMissing.push(tStatic("reports.packingLabel.colPrinter"));
        if (event.actorId === "")
          auditMissing.push(tStatic("reports.packingLabel.colActor"));
        if (event.result === "PENDING_PRINT")
          auditMissing.push(tStatic("reports.packingLabel.outcomeAria"));

        return {
          eventId: event.eventId,
          labelId: event.labelId,
          labelCode: label?.labelCode ?? "",
          outboundNo: label?.outboundNo ?? "",
          outboundDate: label?.outboundDate ?? "",
          recipient: label?.recipient ?? "",
          action: actions.get(event.eventId) ?? "PRINT",
          result: event.result,
          attemptedAt: event.attemptedAt,
          attemptNo: event.attemptNo,
          printerId: event.printerId,
          printerName,
          actorId: event.actorId,
          actorName,
          errorCode: event.errorCode,
          reasonCode: event.reasonCode,
          reasonNote: event.reasonNote,
          auditComplete: auditMissing.length === 0,
          auditMissing,
        } satisfies PackingLabelEvent;
      })
      .sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt));
  }, [eventLog.data, labels, printerNames, actorNames]);

  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const event of events) {
      if (event.actorId === "") continue;
      // Không có tên thì nhãn là "Chưa có" — không đưa UUID lên hộp chọn.
      seen.set(event.actorId, event.actorName || EMPTY_TEXT);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, "vi"));
  }, [events]);

  return {
    events,
    labels,
    printerOptions: printers.options,
    actorOptions,
    loading: labelLog.isLoading || eventLog.isLoading,
    fetching: labelLog.isFetching || eventLog.isFetching,
    error: labelLog.error,
    eventsError: eventLog.error,
    capped: eventLog.data?.capped === true,
    asOf: events[0]?.attemptedAt ?? "",
    refetch: () => {
      void labelLog.refetch();
      void eventLog.refetch();
    },
  };
}

/**
 * Bản lưu bất biến của MỘT nhãn + toàn bộ lần in của chính nhãn đó.
 *
 * `/label-snapshots/{id}` trả nguyên dòng `label_snapshots` (kèm `version`,
 * `applied_at`, `label_payload`) và mảng `print_events` — đây là nguồn duy nhất
 * cho phần "Bản lưu bất biến" của hộp thoại audit. Chỉ gọi khi người dùng thực
 * sự mở một dòng.
 */
export function usePackingLabelSnapshot(
  labelId: string | null,
  context: {
    labels: Map<string, PackingLabelDimension>;
    printerNames: Map<string, string>;
    actorNames: Map<string, string>;
  },
) {
  const query = useQuery({
    queryKey: ["rpt-05", "label-snapshot", labelId],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.LABEL_SNAPSHOT.replace(":id", labelId ?? "")),
    enabled: Boolean(labelId),
    staleTime: STALE_MS,
  });

  const detail = useMemo<PackingLabelDetail | null>(() => {
    if (!labelId) return null;
    const row = query.data;
    const label = context.labels.get(labelId);
    if (!row && !label) return null;

    const payload = objectOf(row?.label_payload);
    const rawAttempts = listOf(row?.print_events).map(readRawEvent);
    const actions = resolveActions(rawAttempts);
    const attempts = rawAttempts
      .map((event) => ({
        eventId: event.eventId,
        labelId,
        labelCode: text(payload.label_code, label?.labelCode ?? ""),
        outboundNo: text(payload.outbound_no, label?.outboundNo ?? ""),
        outboundDate: label?.outboundDate ?? "",
        recipient: label?.recipient ?? "",
        action: actions.get(event.eventId) ?? "PRINT",
        result: event.result,
        attemptedAt: event.attemptedAt,
        attemptNo: event.attemptNo,
        printerId: event.printerId,
        printerName: event.printerId
          ? (context.printerNames.get(event.printerId) ?? "")
          : "",
        actorId: event.actorId,
        actorName: event.actorId
          ? (context.actorNames.get(event.actorId) ?? "")
          : "",
        errorCode: event.errorCode,
        reasonCode: event.reasonCode,
        reasonNote: event.reasonNote,
        auditComplete:
          event.attemptedAt !== "" &&
          event.printerId !== "" &&
          event.actorId !== "" &&
          event.result !== "PENDING_PRINT",
        auditMissing: [],
      }))
      .sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt));

    // `sku_summary` của RPT-LABEL-01 là chuỗi "SKU x số lượng" đã dựng sẵn; khi
    // chỉ có snapshot thô thì rơi về số hiện vật đếm được trong payload.
    const itemIds = listOf(payload.item_ids);
    const content =
      label?.skuSummary ||
      (itemIds.length > 0
        ? tStatic("reports.packingLabel.itemCountShort", {
            count: itemIds.length,
          })
        : "");

    return {
      labelId,
      labelCode: text(payload.label_code, label?.labelCode ?? ""),
      outboundNo: text(payload.outbound_no, label?.outboundNo ?? ""),
      outboundDate: label?.outboundDate ?? "",
      recipient: label?.recipient ?? "",
      status: text(row?.status, label?.status ?? ""),
      version: row?.version === undefined ? "" : `v${n(row.version)}`,
      appliedAt: text(row?.applied_at, ""),
      createdAt: text(row?.created_at, label?.createdAt ?? ""),
      content,
      attempts,
    };
  }, [labelId, query.data, context]);

  return {
    detail,
    loading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
