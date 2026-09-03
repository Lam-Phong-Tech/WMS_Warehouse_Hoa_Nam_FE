import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type { ApiMeta } from "@/shared/types/api-response";
import {
  listOf,
  n,
  text,
  type Raw,
} from "@/modules/reports/operations/report-format";

/**
 * RPT-MOV-01 — nguồn dữ liệu của màn "Truy vết hàng hóa".
 *
 * Màn này đọc DUY NHẤT `/reports/movement-trace`: đó là lát cắt append-only mà
 * §13.10 công bố cho truy vết (movement_id, chứng từ nguồn, actor, chuỗi
 * reversal). Hai endpoint phụ (`/reports/document-history`,
 * `/reversal-documents`) CHỈ dùng để đổi `source_id` (UUID) sang mã chứng từ
 * người đọc được — ledger không mang mã chứng từ, còn màn hình thì buộc phải
 * hiện "IN-…/OUT-…/REV-…" chứ không phải UUID thô.
 *
 * KHÔNG gửi `per_page`: bảng, timeline và 4 thẻ KPI phải mô tả CÙNG một tập
 * dòng. Nếu để BE cắt trang cho bảng thì timeline sẽ kể một chuỗi khác với
 * bảng ngay dưới nó và người đọc không có cách nào phát hiện ra sự lệch đó
 * (cùng lý do đã ghi ở `operations/report-data.ts`).
 */

export const MOVEMENT_TRACE_TIMEZONE = "Asia/Ho_Chi_Minh";

/** `report_code` Annex C của báo cáo này (BE phục vụ đúng mã này). */
export const MOVEMENT_TRACE_REPORT_CODE = "movement-trace";

const STALE_MS = 60_000;

/** Một dòng sổ biến động, đã chuẩn hoá từ payload BE. */
export type MovementTraceRow = {
  id: string;
  occurredAt: string;
  movementType: string;
  warehouseCode: string;
  productCode: string;
  productName: string;
  stockStatus: string;
  qtyDelta: number;
  itemId: string;
  containerId: string;
  physicalCode: string;
  sourceType: string;
  sourceId: string;
  actor: string;
  originalMovementId: string;
  /** Mã nghiệp vụ (MV-…) của movement — thứ DUY NHẤT được in ra màn hình. */
  movementNo: string;
  /** Mã của movement gốc mà một REVERSAL đang đảo; rỗng nếu BE không tra được. */
  originalMovementNo: string;
  correctionChainId: string;
};

export type MovementTraceSummary = {
  totalMovements: number;
  netEffect: number;
  reversalCount: number;
};

export type MovementTraceData = {
  rows: MovementTraceRow[];
  summary: MovementTraceSummary;
  /** COUNT(*) theo movement_type của TOÀN kỳ (BE tính trước khi cắt trang). */
  countByType: Record<string, number>;
  period: { from: string; to: string };
  /** Thời điểm máy chủ chốt phản hồi (meta.timestamp) — mốc "Chốt" trên màn. */
  dataAsOf: string;
  requestId: string;
};

export type MovementTraceQuery = {
  fromDate?: string;
  toDate?: string;
  /** Mã vật lý (Barcode/QR/RFID) của Item hoặc Container. */
  codeValue?: string;
  /** UUID SKU — dùng khi "Tra theo" = SKU. */
  productId?: string;
  movementType?: string;
  enabled?: boolean;
};

function toRow(raw: Raw): MovementTraceRow {
  return {
    id: text(raw.id, ""),
    occurredAt: text(raw.occurred_at, ""),
    movementType: text(raw.movement_type, ""),
    warehouseCode: text(raw.warehouse_code, ""),
    productCode: text(raw.product_code, ""),
    productName: text(raw.product_name, ""),
    stockStatus: text(raw.stock_status, ""),
    qtyDelta: n(raw.qty_delta),
    itemId: text(raw.item_id, ""),
    containerId: text(raw.container_id, ""),
    physicalCode: text(raw.physical_code, ""),
    sourceType: text(raw.source_type, ""),
    sourceId: text(raw.source_id, ""),
    actor: text(raw.actor, ""),
    originalMovementId: text(raw.original_movement_id, ""),
    movementNo: text(raw.movement_no, ""),
    originalMovementNo: text(raw.original_movement_no, ""),
    correctionChainId: text(raw.correction_chain_id, ""),
  };
}

function cleanParams(params: Raw): Raw {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

function toData(payload: Raw, meta: ApiMeta): MovementTraceData {
  const summary = (payload.summary ?? {}) as Raw;
  const period = (payload.period ?? {}) as Raw;
  const countByType: Record<string, number> = {};
  for (const entry of listOf(payload.by_movement_type)) {
    const type = text(entry.movement_type, "");
    if (type !== "") countByType[type] = n(entry.movement_count);
  }
  const rows = listOf(payload.rows).map(toRow);

  return {
    rows,
    summary: {
      totalMovements: n(summary.total_movements, rows.length),
      netEffect: n(summary.net_effect),
      reversalCount: n(summary.reversal_count),
    },
    countByType,
    period: {
      from: text(period.from_date, ""),
      to: text(period.to_date, ""),
    },
    dataAsOf: text(meta.timestamp, ""),
    requestId: text(meta.request_id, ""),
  };
}

/**
 * Sổ biến động của lát cắt đang tra cứu.
 *
 * Dùng `http.getPage` (không phải `http.get`) vì màn hình cần `meta.timestamp`
 * làm mốc "Chốt" và `meta.request_id` cho khối bằng chứng — `http.get` bỏ meta.
 */
export function useMovementTraceReport(query: MovementTraceQuery) {
  const params = cleanParams({
    from_date: query.fromDate,
    to_date: query.toDate,
    code_value: query.codeValue,
    product_id: query.productId,
    movement_type: query.movementType,
  });

  return useQuery({
    queryKey: ["rpt-mov-01", "movement-trace", params],
    queryFn: async () => {
      const result = await http.getPage<Raw>(
        API_ENDPOINTS.REPORTS_MOVEMENT_TRACE,
        { params },
      );
      const payload =
        result.data && typeof result.data === "object" ? result.data : {};
      return toData(payload as Raw, result.meta ?? {});
    },
    enabled: query.enabled !== false,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/**
 * Bảng tra `source_id` → mã chứng từ hiển thị.
 *
 * `stock_movements.source_id` là UUID; §13.10 lại đòi cột "Chứng từ / dòng" của
 * RPT-MOV-01 phải truy ngược được. `/reports/document-history` chỉ đọc
 * `stock_documents` (nhập/xuất) nên KHÔNG bao giờ trả phiếu Reversal — phải
 * ghép thêm `/reversal-documents` mới phủ hết ba loại chứng từ mà ledger trỏ
 * tới. Thiếu mã thì màn hình hiện "Chưa có" — không bịa mã, không in UUID.
 */
export function useSourceDocumentCodes({
  fromDate,
  toDate,
  enabled = true,
}: {
  fromDate?: string;
  toDate?: string;
  enabled?: boolean;
}) {
  const documents = useQuery({
    queryKey: ["rpt-mov-01", "document-history", fromDate, toDate],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY, {
        params: cleanParams({
          from_date: fromDate,
          to_date: toDate,
          doc_type: "all",
        }),
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });

  const reversals = useQuery({
    queryKey: ["rpt-mov-01", "reversal-documents", fromDate, toDate],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.REVERSAL_DOCUMENTS, {
        params: cleanParams({
          from_date: fromDate,
          to_date: toDate,
          per_page: 200,
        }),
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });

  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of listOf(documents.data?.rows)) {
      const code = text(row.document_no, "");
      const id = text(row.id, "");
      if (id !== "" && code !== "") map.set(id, code);
    }
    for (const row of listOf(reversals.data?.data)) {
      const code = text(row.reversal_code ?? row.reversal_no, "");
      const id = text(row.id, "");
      if (id !== "" && code !== "") map.set(id, code);
    }
    return map;
  }, [documents.data, reversals.data]);

  return {
    byId,
    loading: documents.isLoading || reversals.isLoading,
  };
}
