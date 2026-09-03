/**
 * ADAPTER dữ liệu cho RPT-01 (bản port 1:1 mockup 8.1 "Báo cáo Nhập – Xuất –
 * Tồn").
 *
 * Mockup offline đọc MỘT khối JSON phẳng nhúng trong trang (`#report-01-data`)
 * với bốn khoá `summary / xntRows / inventoryLedger / documents`. File này là
 * chỗ DUY NHẤT ánh xạ bốn khối đó sang endpoint thật, để component chỉ còn việc
 * dựng đúng DOM của mockup.
 *
 *  · `summary` + `xntRows` ← `GET /reports/inventory-xnt-enhanced`
 *    (`API_ENDPOINTS.REPORTS_XNT_ENHANCED`). Đây là endpoint canonical của
 *    RPT-XNT-01: mỗi dòng đã có sẵn `opening / receipt_* / issue_* /
 *    component_issue_* / reversal_unlinked_net / closing` đúng tên khoá mockup
 *    dùng, nên `summary` chỉ là phép CỘNG các dòng — không suy diễn con số nào.
 *  · `inventoryLedger` ← `GET /reports/inventory-ledger`. §3.2 của
 *    `BA_API_BE_REPORT_01.md` chỉ đích danh endpoint này cho drill-down; BE
 *    dùng chung builder với `/reports/movement-trace` nên payload giống hệt.
 *    Đây cũng là nguồn của HAI biểu đồ theo ngày (xem `dailySeries` bên dưới).
 *  · `documents` ← `GET /reports/document-history` + `GET /reversal-documents`.
 *    Endpoint đầu chỉ đọc `stock_documents` (nhập/xuất) nên KHÔNG bao giờ trả
 *    phiếu hoàn tác, mà mockup có đúng một thẻ "Phiếu hoàn tác" — phải ghép
 *    thêm nguồn canonical `/reversal-documents` mới phủ đủ ba loại chứng từ.
 *  · Loại hàng (Sản phẩm / Linh kiện) và Đơn vị ← danh mục `/products` qua
 *    `useSkuCatalog`: mọi endpoint `/reports/*` chỉ trả `product_code`, không
 *    trả `sku_type` lẫn `unit`.
 *
 * KHÔNG BỊA: `quantity_scale` của mockup chưa có nguồn nào trong BE (không khoá
 * nào trong swagger), nên số lượng hiển thị qua `formatQuantity` dùng chung của
 * dự án. Nguồn nào chưa trả thì ô hiện "Chưa có" theo `EMPTY_TEXT`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { tStatic } from "@/shared/i18n/useT";
import {
  useDocumentHistory,
  useReversalDocuments,
  useSkuCatalog,
  useXntReport,
} from "@/modules/reports/operations/report-data";
import {
  dayKey,
  listOf,
  n,
  text,
  type Raw,
} from "@/modules/reports/operations/report-format";

/** Múi giờ nghiệp vụ (BA-01) — in ở dòng "Snapshot" như mockup. */
export const INVENTORY_FLOW_TIMEZONE = "Asia/Ho_Chi_Minh";

/** `report_code` của báo cáo này theo `BA_API_BE_REPORT_01.md`. */
export const INVENTORY_FLOW_REPORT_CODE = "RPT-XNT-01";

export const ISO_DATE = "YYYY-MM-DD";

const STALE_MS = 60_000;

export type ItemKindCode = "PRODUCT" | "COMPONENT";

/** Một dòng "Chi tiết cân đối tồn kho" — đúng shape `xntRows[]` của mockup. */
export type XntRow = {
  /** Khoá drill-down của mockup (`data-drill-key`) — chính là mã SKU. */
  drillKey: string;
  warehouse_code: string;
  sku_code: string;
  sku_name: string;
  sku_type: ItemKindCode | "";
  unit: string;
  stock_status: string;
  opening: number;
  receipt_gross: number;
  receipt_reversal: number;
  receipt_net: number;
  issue_gross: number;
  issue_reversal: number;
  issue_net: number;
  component_issue_gross: number;
  component_issue_reversal: number;
  component_issue_net: number;
  reversal_unlinked_net: number;
  reversal_net: number;
  closing: number;
  /** `closing` có khớp phương trình cân đối BA-03 không. */
  matched: boolean;
};

/** Sáu ô của khối "Cân đối tồn theo kỳ" — đúng shape `summary` của mockup. */
export type XntSummary = {
  opening: number;
  receiptNet: number;
  issueNet: number;
  componentNet: number;
  reversalUnlinked: number;
  closing: number;
};

/** Một movement của khối "Movement liên quan" trong hộp thoại đối soát. */
export type LedgerMovement = {
  movement_id: string;
  posted_at: string;
  movement_type: string;
  sku_code: string;
  qty_delta: number;
  /** Mã chứng từ nguồn; rỗng khi `source_id` không tra được (không bịa mã). */
  source_document_no: string;
  /** Movement gốc của một REVERSAL; rỗng khi là hoàn tác không truy được gốc. */
  reversal_of_movement_id: string;
};

/** Một thẻ của mục "Lịch sử chứng từ". */
export type FlowDocument = {
  id: string;
  document_no: string;
  doc_type: "INBOUND" | "OUTBOUND" | "REVERSAL";
  status: string;
  warehouse_code: string;
  /** Đối tác/nguồn của chứng từ; với phiếu hoàn tác là mã chứng từ gốc. */
  counterpart: string;
  /** Mốc ghi sổ; rỗng với chứng từ chưa Post (nháp / đang quét). */
  posted_at: string;
  /** Ngày chứng từ — mốc để cắt kỳ khi chứng từ chưa có `posted_at`. */
  document_date: string;
  /** SKU mở hộp thoại đối soát khi bấm "Đối chiếu dòng chứng từ". */
  drillKey: string;
};

/** Một điểm của hai biểu đồ theo ngày. */
export type FlowDailyPoint = {
  date: string;
  inbound: number;
  product: number;
  component: number;
  reversal: number;
  closing: number;
};

/**
 * Phương trình cân đối BA-03. Dùng CHUNG cho dòng bảng, ô "Đối soát" và dòng
 * công thức trong hộp thoại, nên ba chỗ không thể lệch nhau.
 */
export function closingOf(row: {
  opening: number;
  receipt_net: number;
  issue_net: number;
  component_issue_net: number;
  reversal_unlinked_net: number;
}): number {
  return (
    row.opening +
    row.receipt_net -
    row.issue_net -
    row.component_issue_net +
    row.reversal_unlinked_net
  );
}

/**
 * Sai số cho phép khi so `closing` BE trả với phương trình tính lại.
 *
 * BE trả `number/float` nên tổng của các số thập phân có thể lệch ở hàng cuối
 * của float; ngưỡng này chỉ nuốt sai số biểu diễn, không nuốt chênh lệch
 * nghiệp vụ (nhỏ nhất là 1 đơn vị lẻ của `quantity_scale`).
 */
const MATCH_EPSILON = 1e-6;

function normalizeXntLine(
  line: Raw,
  catalog: {
    kindOfCode: (code: unknown) => ItemKindCode | undefined;
    unitOfCode: (code: unknown) => string;
  },
): XntRow {
  const skuCode = text(line.product_code, "");
  const row = {
    opening: n(line.opening),
    receipt_net: n(line.receipt_net),
    issue_net: n(line.issue_net),
    component_issue_net: n(line.component_issue_net),
    reversal_unlinked_net: n(line.reversal_unlinked_net),
  };
  const closing = n(line.closing);
  return {
    drillKey: skuCode,
    warehouse_code: text(line.warehouse_code, ""),
    sku_code: skuCode,
    sku_name: text(line.product_name, ""),
    sku_type: catalog.kindOfCode(skuCode) ?? "",
    unit: catalog.unitOfCode(skuCode),
    stock_status: text(line.stock_status, ""),
    opening: row.opening,
    // `receipt` là bí danh tương thích của `receipt_gross` trong hợp đồng BE.
    receipt_gross: n(line.receipt_gross ?? line.receipt),
    receipt_reversal: n(line.receipt_reversal),
    receipt_net: row.receipt_net,
    issue_gross: n(line.issue_gross ?? line.issue),
    issue_reversal: n(line.issue_reversal),
    issue_net: row.issue_net,
    component_issue_gross: n(
      line.component_issue_gross ?? line.component_issue,
    ),
    component_issue_reversal: n(line.component_issue_reversal),
    component_issue_net: row.component_issue_net,
    reversal_unlinked_net: row.reversal_unlinked_net,
    reversal_net: n(line.reversal_net),
    closing,
    matched: Math.abs(closingOf(row) - closing) <= MATCH_EPSILON,
  };
}

/**
 * Gộp các dòng cùng mã SKU.
 *
 * BE phát hành một dòng cho MỖI bucket `kho × SKU × trạng thái tồn`, còn mockup
 * hiển thị một dòng cho mỗi SKU ("2 SKU trong snapshot", `drill-key` là mã
 * SKU). Cộng dồn ở đây để bảng, lát cắt và hộp thoại cùng đọc một tập dòng.
 */
function mergeBySku(rows: XntRow[]): XntRow[] {
  const map = new Map<string, XntRow>();
  for (const row of rows) {
    const current = map.get(row.sku_code);
    if (current === undefined) {
      map.set(row.sku_code, { ...row });
      continue;
    }
    const merged: XntRow = {
      ...current,
      opening: current.opening + row.opening,
      receipt_gross: current.receipt_gross + row.receipt_gross,
      receipt_reversal: current.receipt_reversal + row.receipt_reversal,
      receipt_net: current.receipt_net + row.receipt_net,
      issue_gross: current.issue_gross + row.issue_gross,
      issue_reversal: current.issue_reversal + row.issue_reversal,
      issue_net: current.issue_net + row.issue_net,
      component_issue_gross:
        current.component_issue_gross + row.component_issue_gross,
      component_issue_reversal:
        current.component_issue_reversal + row.component_issue_reversal,
      component_issue_net:
        current.component_issue_net + row.component_issue_net,
      reversal_unlinked_net:
        current.reversal_unlinked_net + row.reversal_unlinked_net,
      reversal_net: current.reversal_net + row.reversal_net,
      closing: current.closing + row.closing,
      // Trạng thái tồn chỉ còn ý nghĩa ở tầng bucket; dòng gộp không mang nó.
      stock_status:
        current.stock_status === row.stock_status ? row.stock_status : "",
      matched: true,
    };
    merged.matched =
      Math.abs(closingOf(merged) - merged.closing) <= MATCH_EPSILON;
    map.set(row.sku_code, merged);
  }
  return [...map.values()];
}

export function sumRows(rows: XntRow[]): XntSummary {
  return rows.reduce<XntSummary>(
    (total, row) => ({
      opening: total.opening + row.opening,
      receiptNet: total.receiptNet + row.receipt_net,
      issueNet: total.issueNet + row.issue_net,
      componentNet: total.componentNet + row.component_issue_net,
      reversalUnlinked: total.reversalUnlinked + row.reversal_unlinked_net,
      closing: total.closing + row.closing,
    }),
    {
      opening: 0,
      receiptNet: 0,
      issueNet: 0,
      componentNet: 0,
      reversalUnlinked: 0,
      closing: 0,
    },
  );
}

/**
 * Sổ ledger của kỳ — nguồn của drill-down VÀ của hai biểu đồ theo ngày.
 *
 * KHÔNG gửi `per_page`: BE chỉ cắt trang khi client gửi tham số đó, và bảng
 * KPI / biểu đồ / hộp thoại của màn này buộc phải mô tả CÙNG một tập movement
 * (cùng lý do đã ghi ở `operations/report-data.ts`).
 */
function useInventoryLedger({
  from,
  to,
  enabled = true,
}: {
  from: string;
  to: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["rpt-xnt-01", "inventory-ledger", from, to],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_INVENTORY_LEDGER, {
        params: { from_date: from, to_date: to },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Loại movement mà một REVERSAL đang đảo — để quy đúng cột nguồn (BA-03). */
type ReversalTarget = "RECEIPT" | "ISSUE" | "COMPONENT_ISSUE" | "UNLINKED";

export type InventoryFlowSnapshot = {
  /** `snap-rpt-xnt-YYYYMMDD-HHmm`, dựng từ mốc chốt THẬT của phản hồi. */
  snapshot_id: string;
  /** Mốc máy chủ dựng số (ISO) — dòng "Dữ liệu lúc …". */
  as_of: string;
  /** Mốc ghi sổ gần nhất trong kỳ — dòng "Đã ghi sổ đến …". */
  source_watermark: string;
  /** Mã kho của lát cắt; nhiều kho ⇒ `ALL_WAREHOUSES_LABEL`. */
  warehouse_code: string;
  rows: XntRow[];
  summary: XntSummary;
  ledger: LedgerMovement[];
  documents: FlowDocument[];
  daily: FlowDailyPoint[];
};

/**
 * Nhãn hiển thị khi lát cắt trải trên nhiều kho.
 *
 * Live binding (`export let`) chứ không phải hằng: nơi dùng import thẳng một
 * chuỗi nên giá trị phải được cập nhật khi đổi ngôn ngữ (cùng lối
 * `UNKNOWN_BUSINESS_LABEL` của business-labels.ts).
 */
export let ALL_WAREHOUSES_LABEL: string = tStatic(
  "reports.inventoryFlow.warehouseAll",
);

useLanguageStore.subscribe(() => {
  ALL_WAREHOUSES_LABEL = tStatic("reports.inventoryFlow.warehouseAll");
});

export type InventoryFlowResult = {
  snapshot: InventoryFlowSnapshot;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  /** Gọi lại toàn bộ nguồn; trả promise để nút "Làm mới" chờ được. */
  refetch: () => Promise<unknown>;
};

/**
 * Lát cắt RPT-01 của một kỳ báo cáo.
 *
 * Bốn nguồn được đọc SONG SONG và ghép thành một `snapshot` duy nhất, đúng cách
 * mockup dùng một khối JSON: mọi KPI / phương trình / bảng / biểu đồ / thẻ
 * chứng từ trên màn đều đọc từ object này nên không thể lệch nhau.
 */
export function useInventoryFlowSnapshot({
  from,
  to,
}: {
  from: string;
  to: string;
}): InventoryFlowResult {
  const valid = from !== "" && to !== "" && from <= to;
  const catalog = useSkuCatalog();
  const xnt = useXntReport({ from, to, enabled: valid });
  const ledger = useInventoryLedger({ from, to, enabled: valid });
  const documents = useDocumentHistory({ from, to, enabled: valid });
  const reversals = useReversalDocuments({ from, to, enabled: valid });

  const unitOfCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of catalog.entries) map.set(entry.sku_code, entry.unit);
    return (code: unknown) => map.get(text(code, "")) ?? "";
  }, [catalog.entries]);

  const kindOfCode = catalog.kindOfCode;

  // ── xntRows + summary ──────────────────────────────────────────────────
  const rows = useMemo(() => {
    const payload = (xnt.data ?? {}) as Raw;
    return mergeBySku(
      listOf(payload.lines)
        .map((line) => normalizeXntLine(line, { kindOfCode, unitOfCode }))
        .filter((row) => row.sku_code !== ""),
    );
  }, [xnt.data, kindOfCode, unitOfCode]);

  // ── inventoryLedger ────────────────────────────────────────────────────
  /**
   * Bảng tra `source_id` (UUID) → mã chứng từ người đọc được. Ledger chỉ mang
   * UUID, còn mockup in "NK-…/XK-…/RV-…"; thiếu mã thì để rỗng chứ không bịa.
   */
  const documentCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of listOf((documents.data as Raw | undefined)?.rows)) {
      const id = text(row.id, "");
      const code = text(row.document_no, "");
      if (id !== "" && code !== "") map.set(id, code);
    }
    for (const row of listOf((reversals.data as { data?: unknown })?.data)) {
      const id = text(row.id, "");
      const code = text(row.reversal_code, "");
      if (id !== "" && code !== "") map.set(id, code);
    }
    return map;
  }, [documents.data, reversals.data]);

  const ledgerRows = useMemo<LedgerMovement[]>(() => {
    return listOf((ledger.data as Raw | undefined)?.rows)
      .map((row) => ({
        movement_id: text(row.id, ""),
        posted_at: text(row.occurred_at, ""),
        movement_type: text(row.movement_type, ""),
        sku_code: text(row.product_code, ""),
        qty_delta: n(row.qty_delta),
        source_document_no: documentCodeById.get(text(row.source_id, "")) ?? "",
        reversal_of_movement_id: text(row.original_movement_id, ""),
      }))
      .sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  }, [ledger.data, documentCodeById]);

  // ── Hai biểu đồ theo ngày ──────────────────────────────────────────────
  /**
   * Chuỗi theo ngày được dựng TỪ CHÍNH sổ ledger ở trên, không từ một endpoint
   * thứ hai: `/reports/inventory-xnt-daily` chỉ phát hành `inbound_qty /
   * outbound_qty / reversal_net`, gộp chung xuất sản phẩm với xuất linh kiện,
   * nên không vẽ được BỐN chuỗi mà mockup có.
   *
   * Mỗi REVERSAL được quy về cột nguồn theo `movement_type` của giao dịch GỐC
   * (BA-03, XntReportLine của BE) — KHÔNG theo dấu của `qty_delta`, vì đảo một
   * ISSUE và đảo một COMPONENT_ISSUE đều cho `qty_delta` dương. Hoàn tác không
   * truy được movement gốc trong kỳ chính là `reversal_unlinked_net`, đi vào
   * chuỗi "Hoàn tác" đúng như cột thứ tư của mockup.
   *
   * Nhờ vậy tổng bốn chuỗi trùng đúng bốn KPI, và "tồn cuối ngày" cuối kỳ trùng
   * KPI "Tồn cuối kỳ" — hai khối không thể kể hai câu chuyện khác nhau.
   */
  const daily = useMemo<FlowDailyPoint[]>(() => {
    const typeById = new Map<string, string>();
    for (const row of ledgerRows)
      typeById.set(row.movement_id, row.movement_type);

    const targetOf = (row: LedgerMovement): ReversalTarget => {
      const origin = typeById.get(row.reversal_of_movement_id);
      if (origin === "RECEIPT") return "RECEIPT";
      if (origin === "ISSUE") return "ISSUE";
      if (origin === "COMPONENT_ISSUE") return "COMPONENT_ISSUE";
      return "UNLINKED";
    };

    const byDate = new Map<string, FlowDailyPoint>();
    const at = (date: string) => {
      const current = byDate.get(date);
      if (current !== undefined) return current;
      const created: FlowDailyPoint = {
        date,
        inbound: 0,
        product: 0,
        component: 0,
        reversal: 0,
        closing: 0,
      };
      byDate.set(date, created);
      return created;
    };

    for (const row of ledgerRows) {
      const date = dayKey(row.posted_at);
      if (date === "") continue;
      const point = at(date);
      if (row.movement_type === "RECEIPT") {
        point.inbound += row.qty_delta;
      } else if (row.movement_type === "ISSUE") {
        point.product += -row.qty_delta;
      } else if (row.movement_type === "COMPONENT_ISSUE") {
        point.component += -row.qty_delta;
      } else if (row.movement_type === "REVERSAL") {
        const target = targetOf(row);
        // Đảo NHẬP có qty_delta âm ⇒ trừ thẳng vào cột Nhập thuần.
        if (target === "RECEIPT") point.inbound += row.qty_delta;
        // Đảo XUẤT có qty_delta dương ⇒ trừ vào cột Xuất tương ứng.
        else if (target === "ISSUE") point.product -= row.qty_delta;
        else if (target === "COMPONENT_ISSUE") point.component -= row.qty_delta;
        else point.reversal += row.qty_delta;
      }
    }

    const points = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const summary = sumRows(rows);
    let running = summary.opening;
    for (const point of points) {
      running +=
        point.inbound - point.product - point.component + point.reversal;
      point.closing = running;
    }
    return points;
  }, [ledgerRows, rows]);

  // ── documents ──────────────────────────────────────────────────────────
  const documentCards = useMemo<FlowDocument[]>(() => {
    const cards: FlowDocument[] = [];

    for (const row of listOf((documents.data as Raw | undefined)?.rows)) {
      const lines = listOf(row.lines);
      cards.push({
        id: text(row.id, ""),
        document_no: text(row.document_no, ""),
        doc_type:
          text(row.doc_type, "") === "OUTBOUND" ? "OUTBOUND" : "INBOUND",
        status: text(row.status, ""),
        warehouse_code: text(row.warehouse_code, ""),
        counterpart: text(row.counterpart, ""),
        posted_at: text(row.posted_at, ""),
        document_date: text(row.document_date, ""),
        drillKey: text(lines[0]?.product_code, ""),
      });
    }

    /** Ledger là nguồn duy nhất biết một phiếu hoàn tác chạm vào SKU nào. */
    const skuOfDocumentId = new Map<string, string>();
    for (const row of ledgerRows) {
      if (row.source_document_no === "" || row.sku_code === "") continue;
      if (!skuOfDocumentId.has(row.source_document_no)) {
        skuOfDocumentId.set(row.source_document_no, row.sku_code);
      }
    }

    for (const row of listOf((reversals.data as { data?: unknown })?.data)) {
      const documentNo = text(row.reversal_code, "");
      if (documentNo === "") continue;
      const postedAt = text(row.reversed_at, "");
      cards.push({
        id: text(row.id, ""),
        document_no: documentNo,
        doc_type: "REVERSAL",
        status: text(row.status, ""),
        warehouse_code: text(row.warehouse_code, ""),
        // Mockup in mã chứng từ GỐC ở dòng đối tác của thẻ hoàn tác.
        counterpart: text(row.reference_document_code, ""),
        posted_at: postedAt,
        document_date: text(row.created_at, ""),
        drillKey: skuOfDocumentId.get(documentNo) ?? "",
      });
    }

    /**
     * Cắt kỳ ở CLIENT vì `/reversal-documents` không nhận `from_date`/`to_date`
     * (index chỉ lọc `status`/`keyword`) — nếu không, thẻ hoàn tác của tháng
     * trước sẽ lọt vào mục "Lịch sử chứng từ" của kỳ đang xem.
     *
     * Mốc cắt là `posted_at`, rơi về `document_date` khi chứng từ CHƯA Post:
     * chứng từ nháp/đang quét vẫn thuộc kỳ và mockup có nhãn trạng thái động
     * cho chúng, chỉ là không tác động tồn kho (BA-01).
     */
    return cards
      .filter((card) => {
        const date = dayKey(card.posted_at) || dayKey(card.document_date);
        return date !== "" && date >= from && date <= to;
      })
      .sort((a, b) =>
        `${a.posted_at || a.document_date}`.localeCompare(
          `${b.posted_at || b.document_date}`,
        ),
      );
  }, [documents.data, reversals.data, ledgerRows, from, to]);

  const snapshot = useMemo<InventoryFlowSnapshot>(() => {
    /**
     * Mốc chốt: endpoint XNT không phát hành `data_as_of`, nên rơi về mốc
     * payload về tới trình duyệt — vẫn là một mốc THẬT, không phải chuỗi bịa.
     */
    const asOf =
      xnt.dataUpdatedAt > 0 ? dayjs(xnt.dataUpdatedAt).toISOString() : "";
    const parsed = dayjs(asOf);
    const warehouseCodes = [
      ...new Set(rows.map((row) => row.warehouse_code).filter((c) => c !== "")),
    ];
    const watermark = ledgerRows.reduce(
      (latest, row) => (row.posted_at > latest ? row.posted_at : latest),
      "",
    );

    return {
      snapshot_id: parsed.isValid()
        ? `snap-rpt-xnt-${parsed.format("YYYYMMDD-HHmm")}`
        : "",
      as_of: asOf,
      source_watermark: watermark,
      warehouse_code:
        warehouseCodes.length === 1 ? warehouseCodes[0] : ALL_WAREHOUSES_LABEL,
      rows,
      summary: sumRows(rows),
      ledger: ledgerRows,
      documents: documentCards,
      daily,
    };
  }, [rows, ledgerRows, documentCards, daily, xnt.dataUpdatedAt]);

  return {
    snapshot,
    loading:
      xnt.isLoading ||
      ledger.isLoading ||
      documents.isLoading ||
      catalog.loading,
    fetching:
      xnt.isFetching ||
      ledger.isFetching ||
      documents.isFetching ||
      reversals.isFetching,
    error: xnt.error ?? ledger.error ?? documents.error ?? reversals.error,
    /**
     * Trả PROMISE của cả bốn nguồn: nút "Làm mới" phải biết lúc nào lượt gọi
     * lại thực sự xong mới báo cho người dùng (xem `useReportRefresh`).
     */
    refetch: () =>
      Promise.all([
        xnt.refetch(),
        ledger.refetch(),
        documents.refetch(),
        reversals.refetch(),
      ]),
  };
}
