/**
 * ADAPTER dữ liệu cho RPT-02 (bản port 1:1 mockup 8.2 "Tồn kho & đối soát").
 *
 * Mockup offline đọc MỘT khối snapshot phẳng nhúng trong trang
 * (`#report-02-data`) với các khoá `sku_code / balance_qty / ledger_qty /
 * delta_qty / reconciliation_status / mismatch_checks / incident_*`. BE thật
 * dùng tên khác (`product_code / on_hand_qty / variance / sku_type`) và không
 * có endpoint snapshot riêng, nên file này là chỗ DUY NHẤT làm phép ánh xạ —
 * component chỉ còn việc dựng đúng DOM của mockup.
 *
 *  · `/reports/inventory-reconciliation` — nguồn CHÍNH: đủ 4 phép kiểm §7.5
 *    (`mismatch_checks`, `reconciliation_overall`) mà `/inventory-balance`
 *    không trả.
 *  · `/reports/inventory-balance?as_of=…` — nguồn khi chốt số liệu tại một mốc
 *    QUÁ KHỨ: lúc đó BE trả ảnh chụp theo sổ và `reconciliation_status =
 *    NOT_APPLICABLE` (DEC-INV-001), endpoint đối soát không còn ý nghĩa nên
 *    KHÔNG gọi.
 *  · `/products` (danh mục SKU) — loại hàng + định mức Min/Max cho mục "Kiểm
 *    soát lượng khả dụng"; mockup lấy từ khối `products`.
 *  · `/reports/movement-trace` — khối "Movement liên quan" trong hộp thoại bằng
 *    chứng; mockup lấy từ khối `movements`.
 *
 * KHÔNG BỊA: hai cột `incident_id` / `incident_status` của mockup chưa có nguồn
 * nào trong BE (không có khoá incident nào trong swagger), nên adapter trả
 * `null` và màn hình hiển thị "Chưa có" theo quy ước `EMPTY_TEXT`. Cột vẫn giữ
 * đúng vị trí mockup để khi BE bổ sung thì chỉ cần map thêm ở đây.
 */
import { useMemo } from "react";
import dayjs from "dayjs";
import {
  useInventoryBalance,
  useInventoryReconciliation,
  useMovementTrace,
  useSkuCatalog,
} from "@/modules/reports/operations/report-data";
import {
  listOf,
  n,
  text,
  type Raw,
} from "@/modules/reports/operations/report-format";

/** Múi giờ nghiệp vụ của kho — hiển thị ở dòng "Snapshot" như mockup. */
export const STOCK_RECONCILE_TIMEZONE = "Asia/Ho_Chi_Minh";

export const ISO_DATE = "YYYY-MM-DD";

/** Bốn trạng thái tồn của SRS, đúng thứ tự mockup vẽ cơ cấu tồn. */
export const STOCK_STATUSES = [
  "AVAILABLE",
  "NON_SELLABLE",
  "DEFECTIVE",
  "QUARANTINE",
] as const;

export type StockStatusCode = (typeof STOCK_STATUSES)[number];

export type ItemKindCode = "PRODUCT" | "COMPONENT";

/** Một dòng = một bucket kho × SKU × trạng thái tồn (đúng dimension của BE). */
export type StockReconcileRow = {
  /** Khoá ổn định để React và nút "Xem" định danh dòng. */
  drillKey: string;
  warehouse_id: string;
  warehouse_code: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  category_id: string | null;
  item_kind: ItemKindCode | "";
  stock_status: string;
  available_qty: number;
  balance_qty: number;
  ledger_qty: number;
  delta_qty: number;
  reconciliation_status: string;
  mismatch_checks: string[];
  balance_updated_at: string;
  /** Chưa có nguồn ở BE — xem ghi chú đầu file. */
  incident_id: string | null;
  incident_status: string | null;
};

export type StockReconcileSnapshot = {
  /** Định danh lát cắt, dựng từ mốc chốt THẬT: `rpt02-YYYYMMDD-HHmm`. */
  snapshot_id: string;
  /** Mốc chốt số liệu (ISO) — dòng "Đang xem ảnh chụp tại …". */
  as_of: string;
  /** true khi người dùng chốt tại một ngày quá khứ (BE trả ảnh chụp sổ). */
  as_of_snapshot: boolean;
  /** Mã kho của lát cắt; nhiều kho ⇒ `ALL_WAREHOUSES_LABEL`. */
  warehouse_code: string;
  /** Mốc ghi sổ gần nhất trong tập dòng — dòng "Đã ghi sổ đến …". */
  source_watermark: string;
  rows: StockReconcileRow[];
};

export type SkuThreshold = { min_qty: number | null; max_qty: number | null };

/** Nhãn hiển thị khi lát cắt trải trên nhiều kho. */
export const ALL_WAREHOUSES_LABEL = "Tất cả kho";

function itemKindOf(value: unknown): ItemKindCode | "" {
  const raw = text(value, "");
  return raw === "PRODUCT" || raw === "COMPONENT" ? raw : "";
}

function snapshotIdOf(asOf: string): string {
  const parsed = dayjs(asOf);
  if (!parsed.isValid()) return "";
  return `rpt02-${parsed.format("YYYYMMDD-HHmm")}`;
}

/**
 * Chuẩn hoá một dòng payload BE về shape của mockup.
 *
 * `reconciliation_overall` là kết luận của CẢ BỐN phép kiểm; `reconciliation_status`
 * chỉ là phép kiểm sổ cái ↔ số dư. Mockup hiển thị "Trạng thái đối soát" tổng
 * hợp nên phải ưu tiên `reconciliation_overall` — nếu không, dòng lệch ở sổ phụ
 * sẽ hiện màu xanh trong khi bảng "Top SKU chênh lệch" lại liệt kê nó.
 *
 * `kindOfCode` là dự phòng cho nhánh nào BE chưa gắn `sku_type` vào dòng: loại
 * hàng vẫn phải đúng vì bộ lọc "Loại hàng" của mockup chạy trên nó.
 */
function normalizeRow(
  row: Raw,
  kindOfCode: (code: unknown) => ItemKindCode | undefined,
): StockReconcileRow {
  const skuCode = text(row.product_code, "");
  const stockStatus = text(row.stock_status, "");
  return {
    drillKey: `${skuCode}::${stockStatus}`,
    warehouse_id: text(row.warehouse_id, ""),
    warehouse_code: text(row.warehouse_code, ""),
    sku_id: text(row.product_id, ""),
    sku_code: skuCode,
    sku_name: text(row.product_name, ""),
    category_id:
      row.category_id === null || row.category_id === undefined
        ? null
        : String(row.category_id),
    item_kind: itemKindOf(row.sku_type) || (kindOfCode(skuCode) ?? ""),
    stock_status: stockStatus,
    available_qty: n(row.available_qty),
    balance_qty: n(row.on_hand_qty),
    ledger_qty: n(row.ledger_qty),
    // BE trả sẵn `delta_qty`; `variance` là tên cũ của cùng phép trừ.
    delta_qty: n(row.delta_qty ?? row.variance),
    reconciliation_status: text(
      row.reconciliation_overall ?? row.reconciliation_status,
      "",
    ),
    mismatch_checks: listOf(row.mismatch_checks as unknown)
      .map((check) => text(check, ""))
      .filter((check) => check !== ""),
    balance_updated_at: text(row.updated_at, ""),
    incident_id: null,
    incident_status: null,
  };
}

/**
 * `mismatch_checks` chỉ do endpoint đối soát trả về. Nếu một dòng đang MISMATCH
 * mà không kèm mã check nào (nhánh balance thuần), phép kiểm duy nhất đã chạy
 * là Ledger ↔ số dư — gọi đúng tên nó thay vì để cột "Lệch ở" trống nghĩa.
 */
function withFallbackChecks(row: StockReconcileRow): StockReconcileRow {
  if (row.reconciliation_status !== "MISMATCH") return row;
  if (row.mismatch_checks.length > 0) return row;
  return { ...row, mismatch_checks: ["ledger_to_balance"] };
}

export type StockReconcileSnapshotResult = {
  snapshot: StockReconcileSnapshot;
  /** Min/Max theo mã SKU, khoá theo `sku_code` như bảng định mức của mockup. */
  thresholds: Map<string, SkuThreshold>;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  /** Gọi lại nguồn; trả promise để nút "Làm mới" chờ được. */
  refetch: () => Promise<unknown>;
};

/**
 * Lát cắt RPT-02 tại một mốc chốt.
 *
 * `asOf` là hôm nay (hoặc rỗng) ⇒ đọc đối soát hiện thời, có đủ 4 phép kiểm.
 * `asOf` ở quá khứ ⇒ chỉ đọc `/reports/inventory-balance?as_of=…`.
 */
export function useStockReconcileSnapshot({
  asOf,
}: {
  asOf: string;
}): StockReconcileSnapshotResult {
  const catalog = useSkuCatalog();
  const today = dayjs().format(ISO_DATE);
  const pointInTime = asOf !== "" && asOf < today;

  const balance = useInventoryBalance({
    asOf: pointInTime ? asOf : undefined,
    enabled: pointInTime,
  });
  const reconciliation = useInventoryReconciliation({
    enabled: !pointInTime,
  });

  const source = pointInTime ? balance : reconciliation;
  const kindOfCode = catalog.kindOfCode;

  const snapshot = useMemo<StockReconcileSnapshot>(() => {
    const payload = (source.data ?? {}) as Raw;
    const rows = listOf(payload.rows)
      .map((row) => normalizeRow(row, kindOfCode))
      .map(withFallbackChecks)
      .filter((row) => row.sku_code !== "");

    const warehouseCodes = [
      ...new Set(
        rows.map((row) => row.warehouse_code).filter((code) => code !== ""),
      ),
    ];
    const watermark = rows.reduce(
      (latest, row) =>
        row.balance_updated_at > latest ? row.balance_updated_at : latest,
      "",
    );
    /**
     * Mốc chốt: `data_as_of` là thời điểm máy chủ dựng số. Endpoint đối soát
     * KHÔNG trả trường này, nên rơi về mốc payload về tới trình duyệt — vẫn là
     * một mốc thật, không phải chuỗi bịa.
     */
    const asOfValue = text(
      payload.data_as_of,
      source.dataUpdatedAt > 0 ? dayjs(source.dataUpdatedAt).toISOString() : "",
    );

    return {
      snapshot_id: snapshotIdOf(asOfValue),
      as_of: asOfValue,
      as_of_snapshot: payload.as_of_snapshot === true,
      warehouse_code:
        warehouseCodes.length === 1 ? warehouseCodes[0] : ALL_WAREHOUSES_LABEL,
      source_watermark: watermark,
      rows,
    };
  }, [source.data, source.dataUpdatedAt, kindOfCode]);

  const thresholds = useMemo(() => {
    const map = new Map<string, SkuThreshold>();
    for (const entry of catalog.entries) {
      map.set(entry.sku_code, {
        min_qty: entry.min_stock,
        max_qty: entry.max_stock,
      });
    }
    return map;
  }, [catalog.entries]);

  return {
    snapshot,
    thresholds,
    loading: source.isLoading || catalog.loading,
    fetching: source.isFetching,
    error: source.error,
    /** Trả PROMISE để nút "Làm mới" biết lúc nào lượt gọi lại thực sự xong. */
    refetch: () => source.refetch(),
  };
}

export type MovementEvent = {
  id: string;
  movement_type: string;
  occurred_at: string;
  warehouse_code: string;
  qty_delta: number;
};

/** Cửa sổ trace của modal bằng chứng — đúng "mẫu trace 90 ngày" của mockup. */
export const MOVEMENT_TRACE_DAYS = 90;

/**
 * Movement của MỘT mã SKU trong 90 ngày gần nhất — nội dung khối "Movement
 * liên quan" trong modal.
 *
 * `/reports/movement-trace` không lọc theo mã SKU (`code_value` là mã VẬT LÝ
 * của kiện/serial), nên lấy trọn cửa sổ rồi lọc ở client — đúng cách mockup lọc
 * khối `movements` theo `product_code`. Lọc theo SKU chứ không theo trạng thái
 * tồn: modal mô tả cả vòng đời SKU, không riêng một bucket.
 */
export function useSkuMovements(skuCode: string | null) {
  const query = useMovementTrace({
    from: dayjs().subtract(MOVEMENT_TRACE_DAYS, "day").format(ISO_DATE),
    to: dayjs().format(ISO_DATE),
    enabled: skuCode !== null,
  });

  const events = useMemo<MovementEvent[]>(() => {
    if (skuCode === null) return [];
    return listOf((query.data as Raw | undefined)?.rows)
      .filter((row) => text(row.product_code, "") === skuCode)
      .map((row) => ({
        id: text(row.id, ""),
        movement_type: text(row.movement_type, ""),
        occurred_at: text(row.occurred_at, ""),
        warehouse_code: text(row.warehouse_code, ""),
        qty_delta: n(row.qty_delta),
      }))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [query.data, skuCode]);

  return { events, loading: skuCode !== null && query.isLoading };
}
