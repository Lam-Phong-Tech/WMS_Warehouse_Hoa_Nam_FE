/**
 * ADAPTER dữ liệu cho RPT-IO-01 (bản port 1:1 mockup 8.3 "Báo cáo Lịch sử
 * nhập – xuất kho").
 *
 * Mockup offline đọc MỘT mảng `data[]` cứng nhúng trong trang (5 chứng từ
 * POSTED, xem `Other/8.3.../mock-data.json`). File này là chỗ DUY NHẤT ánh xạ
 * mảng đó sang endpoint thật, để component chỉ còn việc dựng đúng DOM.
 *
 * BA NGUỒN, ĐỌC SONG SONG:
 *  · `GET /reports/document-history` (`REPORTS_DOCUMENT_HISTORY`) — chính là
 *    endpoint mang tên "RPT-IO-01 lịch sử phiếu nhập/xuất kèm tầng dòng" trong
 *    swagger. Gửi kèm `status=POSTED` vì mockup ghi rõ phạm vi "POSTED only".
 *    Endpoint này CHỈ đọc bảng `stock_documents` (doc_type nhập/xuất) nên
 *    không bao giờ trả phiếu hoàn tác.
 *  · `GET /reversal-documents` — nguồn canonical của phiếu hoàn tác, cần để đủ
 *    ba loại chứng từ mà mockup có (`INBOUND` / `OUTBOUND` / `REVERSAL`).
 *    Endpoint này KHÔNG nhận `from_date`/`to_date`/`status` nên phải cắt kỳ và
 *    lọc trạng thái ở client.
 *  · `GET /reports/inventory-ledger` — sổ movement authoritative. Đây là nguồn
 *    DUY NHẤT cho cột "Movement" và cho DẤU của "Qty posted" (`qty_delta` đã
 *    mang dấu); cũng là nguồn của biểu đồ theo ngày.
 *  · Phòng ban của người thực hiện ← `useUserDirectory()` (`/users`): không
 *    endpoint `/reports/*` nào trả `department` kèm chứng từ.
 *
 * KHÔNG BỊA:
 *  · `qty` là `number | null`. `null` = KHÔNG xác định được dấu của lượng ghi
 *    nhận (phiếu hoàn tác chưa sinh movement và cũng không truy được loại
 *    chứng từ gốc). Dòng như vậy hiện "Chưa có" và KHÔNG được cộng vào KPI —
 *    đúng như hai dòng chú thích của mockup: "đơn vị đã xác định dấu" và "Chỉ
 *    cộng movement/qty có dấu xác định".
 *  · Mockup gán mỗi chứng từ đúng MỘT movement (`MOV-IO-0001`). Thực tế một
 *    phiếu nhiều dòng SKU sinh nhiều movement, nên cột "Movement" hiện
 *    `shortId` khi chỉ có một, và "N movement" khi nhiều hơn — không chọn bừa
 *    một movement làm đại diện.
 *  · Mockup nối phiếu hoàn tác với chứng từ gốc qua `original` (id movement
 *    gốc). Bản này nối qua `reference_document_code` — cùng quan hệ nghiệp vụ,
 *    nhưng là MÃ chứng từ người đọc được thay vì UUID thô.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  useReversalDocuments,
  useUserDirectory,
} from "@/modules/reports/operations/report-data";
import {
  dayKey,
  listOf,
  n,
  text,
  type Raw,
} from "@/modules/reports/operations/report-format";

/** Múi giờ nghiệp vụ — in ở dòng mô tả và ở chú thích biểu đồ như mockup. */
export const IO_HISTORY_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Mã màn theo mockup (`data-report-code` của trang 8.3). */
export const IO_HISTORY_REPORT_CODE = "RPT-IO-01";

/** `report_code` Annex C mà BE phục vụ cho luồng xuất tệp. */
export const IO_HISTORY_EXPORT_CODE = "document-history";

/** Trạng thái duy nhất nằm trong phạm vi báo cáo. */
export const IO_HISTORY_STATUS = "POSTED";

export const ISO_DATE = "YYYY-MM-DD";

const STALE_MS = 60_000;

export type IoDocType = "INBOUND" | "OUTBOUND" | "REVERSAL";

/** Bộ lọc "Loại chứng từ"; chuỗi rỗng = tất cả (đúng `st.type` của mockup). */
export type IoTypeFilter = "" | IoDocType;

/** Một dòng của bảng "Lịch sử chứng từ đã ghi nhận" — shape `data[]` mockup. */
export type IoHistoryRow = {
  /** Khoá drill-down của mockup (`data-drill-key` / `data-detail`). */
  id: string;
  documentNo: string;
  type: IoDocType;
  /** Luôn là `POSTED` trong phạm vi báo cáo; giữ giá trị BE trả về. */
  status: string;
  createdAt: string;
  postedAt: string;
  /** `null` khi BE chưa đủ dữ liệu để xác định DẤU của lượng ghi nhận. */
  qty: number | null;
  actor: string;
  department: string;
  /** Nguồn hàng (phiếu nhập) hoặc nơi nhận (phiếu xuất). */
  party: string;
  /** Số movement authoritative mà chứng từ này sinh ra. */
  movementCount: number;
  /** Id movement khi chứng từ chỉ sinh đúng một movement. */
  movementId: string;
  /** Mã chứng từ gốc của một phiếu hoàn tác; rỗng với phiếu nhập/xuất. */
  originalDocumentNo: string;
  /** "MÃ · TÊN" của từng dòng SKU trong chứng từ. */
  skuLines: string[];
};

export type IoHistorySnapshot = {
  rows: IoHistoryRow[];
  /** Mốc máy chủ chốt phản hồi (`meta.timestamp`) — dòng "Data as-of". */
  dataAsOf: string;
};

export type IoHistoryResult = {
  snapshot: IoHistorySnapshot;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Khoá snapshot hiển thị trên đầu trang và trên đầu bảng.
 *
 * Giữ NGUYÊN công thức của mockup (`snap()`), chỉ bỏ tiền tố `mock-` vì dữ
 * liệu ở đây là thật: hai khối phải in cùng một chuỗi thì người đọc mới kiểm
 * được rằng chúng mô tả cùng một lát cắt.
 */
export function ioSnapshotId(
  from: string,
  to: string,
  type: IoTypeFilter,
): string {
  return `rpt-io-01-${from}-${to}-${type === "" ? "ALL" : type}`;
}

/** `doc_type` mà `/reports/document-history` nhận (không có nhánh reversal). */
function docTypeParam(type: IoTypeFilter): "all" | "inbound" | "outbound" {
  if (type === "INBOUND") return "inbound";
  if (type === "OUTBOUND") return "outbound";
  return "all";
}

/**
 * Lịch sử phiếu nhập/xuất trong kỳ.
 *
 * Dùng `http.getPage` (không phải `http.get`) vì đầu trang cần
 * `meta.timestamp` làm mốc "Data as-of". KHÔNG gửi `per_page`: bốn thẻ KPI,
 * biểu đồ, bảng và lát cắt phải mô tả CÙNG một tập chứng từ — để BE cắt trang
 * cho riêng bảng thì biểu đồ ngay trên nó sẽ kể một câu chuyện khác.
 */
function useDocumentHistoryPage({
  from,
  to,
  type,
  enabled,
}: {
  from: string;
  to: string;
  type: IoTypeFilter;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["rpt-io-01", "document-history", from, to, docTypeParam(type)],
    queryFn: () =>
      http.getPage<Raw>(API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY, {
        params: {
          from_date: from,
          to_date: to,
          doc_type: docTypeParam(type),
          status: IO_HISTORY_STATUS,
        },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Sổ movement của kỳ — nguồn của cột Movement, của dấu qty và của biểu đồ. */
function useInventoryLedger({
  from,
  to,
  enabled,
}: {
  from: string;
  to: string;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["rpt-io-01", "inventory-ledger", from, to],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_INVENTORY_LEDGER, {
        params: { from_date: from, to_date: to },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Movement của MỘT chứng từ, gom theo `source_id`. */
type MovementGroup = { count: number; firstId: string; netQty: number };

/**
 * Lát cắt RPT-IO-01 của một kỳ báo cáo.
 *
 * Ba nguồn được ghép thành MỘT `snapshot` duy nhất, đúng cách mockup dùng một
 * mảng `data[]`: KPI / biểu đồ / bảng / lát cắt / hộp thoại đều đọc từ object
 * này nên không thể lệch nhau.
 */
export function useIoHistorySnapshot({
  from,
  to,
  type,
}: {
  from: string;
  to: string;
  type: IoTypeFilter;
}): IoHistoryResult {
  const valid = from !== "" && to !== "" && from <= to;
  /** Lọc "Hoàn tác" thì không cần gọi endpoint chỉ trả phiếu nhập/xuất. */
  const wantsStockDocuments = type !== "REVERSAL";
  /** Ngược lại, lọc nhập hoặc xuất thì không cần nguồn phiếu hoàn tác. */
  const wantsReversals = type === "" || type === "REVERSAL";

  const documents = useDocumentHistoryPage({
    from,
    to,
    type,
    enabled: valid && wantsStockDocuments,
  });
  const reversals = useReversalDocuments({
    from,
    to,
    enabled: valid && wantsReversals,
  });
  const ledger = useInventoryLedger({ from, to, enabled: valid });
  const users = useUserDirectory();

  /** `source_id` → movement của chứng từ đó (số lượng, id, tổng qty có dấu). */
  const movementsByDocument = useMemo(() => {
    const map = new Map<string, MovementGroup>();
    for (const row of listOf((ledger.data as Raw | undefined)?.rows)) {
      const sourceId = text(row.source_id, "");
      if (sourceId === "") continue;
      const current = map.get(sourceId);
      if (current === undefined) {
        map.set(sourceId, {
          count: 1,
          firstId: text(row.id, ""),
          netQty: n(row.qty_delta),
        });
        continue;
      }
      current.count += 1;
      current.netQty += n(row.qty_delta);
    }
    return map;
  }, [ledger.data]);

  const rows = useMemo<IoHistoryRow[]>(() => {
    const result: IoHistoryRow[] = [];

    // ── Phiếu nhập / xuất ────────────────────────────────────────────────
    for (const row of listOf((documents.data?.data as Raw | undefined)?.rows)) {
      const id = text(row.id, "");
      const docType: IoDocType =
        text(row.doc_type, "") === "OUTBOUND" ? "OUTBOUND" : "INBOUND";
      const lines = listOf(row.lines);
      const movements = movementsByDocument.get(id);
      const postedFromLines = lines.reduce(
        (total, line) => total + n(line.posted_qty),
        0,
      );
      const actor = text(row.created_by_name ?? row.posted_by_name, "");
      result.push({
        id,
        documentNo: text(row.document_no, ""),
        type: docType,
        status: text(row.status, ""),
        createdAt: text(row.document_date ?? row.created_at, ""),
        postedAt: text(row.posted_at, ""),
        // Sổ movement là nguồn có dấu; chỉ khi chứng từ chưa có movement nào
        // mới rơi về tầng dòng, và dấu suy từ chiều của loại chứng từ.
        qty:
          movements !== undefined
            ? movements.netQty
            : lines.length === 0
              ? null
              : docType === "INBOUND"
                ? postedFromLines
                : -postedFromLines,
        actor,
        department: users.departmentNameOfActor(actor),
        party: text(row.counterpart, ""),
        movementCount: movements?.count ?? 0,
        movementId: movements?.count === 1 ? movements.firstId : "",
        originalDocumentNo: "",
        skuLines: lines
          .map((line) =>
            [text(line.product_code, ""), text(line.product_name, "")]
              .filter((part) => part !== "")
              .join(" · "),
          )
          .filter((label) => label !== ""),
      });
    }

    // ── Phiếu hoàn tác ───────────────────────────────────────────────────
    for (const row of listOf((reversals.data as { data?: unknown })?.data)) {
      const id = text(row.id, "");
      const status = text(row.status, "");
      if (status !== IO_HISTORY_STATUS) continue;
      const postedAt = text(row.reversed_at ?? row.posted_at, "");
      const date = dayKey(postedAt);
      // `/reversal-documents` không nhận khoảng ngày ⇒ cắt kỳ ở client, nếu
      // không phiếu hoàn tác của kỳ khác sẽ lọt vào snapshot đang xem.
      if (date === "" || date < from || date > to) continue;
      const movements = movementsByDocument.get(id);
      const originalType = text(row.reference_document_type, "");
      const totalQty = n(row.total_qty);
      const actor = text(row.posted_by ?? row.created_by, "");
      result.push({
        id,
        documentNo: text(row.reversal_code ?? row.reversal_no, ""),
        type: "REVERSAL",
        status,
        createdAt: text(row.created_at, ""),
        postedAt,
        // Đảo một phiếu NHẬP làm giảm tồn, đảo một phiếu XUẤT làm tăng tồn.
        // Không truy được loại chứng từ gốc ⇒ dấu KHÔNG xác định (null).
        qty:
          movements !== undefined
            ? movements.netQty
            : originalType === "INBOUND"
              ? -totalQty
              : originalType === "OUTBOUND"
                ? totalQty
                : null,
        actor,
        department: users.departmentNameOfActor(actor),
        party: text(row.warehouse_name, ""),
        movementCount: movements?.count ?? 0,
        movementId: movements?.count === 1 ? movements.firstId : "",
        originalDocumentNo: text(row.reference_document_code, ""),
        skuLines: [],
      });
    }

    // Mockup sắp mới nhất trước theo `posted_at` (`b.posted.localeCompare(a)`).
    return result.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  }, [documents.data, reversals.data, movementsByDocument, users, from, to]);

  const snapshot = useMemo<IoHistorySnapshot>(
    () => ({ rows, dataAsOf: text(documents.data?.meta?.timestamp, "") }),
    [rows, documents.data],
  );

  return {
    snapshot,
    loading:
      (wantsStockDocuments && documents.isLoading) ||
      (wantsReversals && reversals.isLoading) ||
      ledger.isLoading,
    fetching: documents.isFetching || reversals.isFetching || ledger.isFetching,
    error: documents.error ?? reversals.error ?? ledger.error,
    refetch: () => {
      void documents.refetch();
      void reversals.refetch();
      void ledger.refetch();
    },
  };
}
