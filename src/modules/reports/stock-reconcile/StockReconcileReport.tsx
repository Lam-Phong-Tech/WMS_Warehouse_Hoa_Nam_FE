/**
 * MÀN "BÁO CÁO TỒN KHO & ĐỐI SOÁT" (RPT-02) — port 1:1 demo UI/UX đã chốt
 * `8.2.WMS_Hoa_Nam_Bao_Cao_Ton_Kho__Doi_Soat.html`: cùng cấu trúc khối, cùng
 * class, cùng số đo (CSS port ở `./stock-reconcile-report.css`), cùng công thức
 * tính (`Other/Report02_HTML_Export/report-02-offline.js`).
 *
 * KHÁC DEMO Ở ĐÂU (và vì sao):
 *  · Demo chạy trên một khối JSON cứng nhúng trong trang. Ở đây MỌI con số đến
 *    từ endpoint thật (xem `./stock-reconcile-api.ts`); không KPI nào được suy
 *    diễn, nguồn nào chưa trả thì ô hiện "Chưa có" theo `EMPTY_TEXT`.
 *  · Demo có hai nút chết: chú giải MATCH / MISMATCH của vòng tròn. Bản này
 *    gắn hành vi thật (bật/tắt chuỗi) thay vì để nút bấm không phản hồi.
 *  · BỘ LỌC DÙNG CONTROL CHUNG, KHÔNG PHẢI CONTROL TỰ DỰNG CỦA DEMO: "Mốc đối
 *    soát" là `UiVuexyDateField`, "Tìm SKU" là `SearchInput`, "Loại hàng" là
 *    `UiSelect` — cùng bộ với màn "Nhập liệu, đối chiếu & lỗi" (RPT-04). Yêu cầu
 *    người dùng 2026-09-03: thao tác trên 8 màn Báo cáo phải đồng bộ, nên lịch
 *    và listbox tự dựng của demo (kèm chuyển động riêng của chúng) bị thay.
 *    Bố cục lưới của thanh lọc giữ NGUYÊN theo demo.
 *  · `.kpi-spark` bị `report-02-offline.css` đặt `display:none`, và các điểm
 *    polyline trong demo là hình trang trí cứng — không dựng lại một đường xu
 *    hướng bịa cho phần tử vốn không hiển thị.
 *  · Nhãn `movement_type` trong hộp thoại: demo in thẳng mã enum
 *    (`OPENING`/`RECEIPT`…), ở đây dùng nhãn tiếng Việt dùng chung của module
 *    báo cáo — mọi drill-down khác của dự án đọc cùng bảng nhãn đó.
 *  · Trạng thái đối soát có thêm `NOT_APPLICABLE` (BE trả khi chốt tại một mốc
 *    quá khứ). Demo không có nhánh này; hiển thị "Không áp dụng" thay vì gán
 *    bừa thành "Lệch".
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { UiSelect, UiVuexyDateField, VuexyDemoIcon } from "@/shared/ui";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useAuthStore } from "@/shared/store/auth.store";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { fmt } from "@/modules/reports/operations/report-format";
import { MOVEMENT_LABELS } from "@/modules/reports/operations/report-labels";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { EvidenceModal, ModalCloseButton } from "./stock-reconcile-overlays";
import {
  ALL_WAREHOUSES_LABEL,
  ISO_DATE,
  STOCK_RECONCILE_TIMEZONE,
  STOCK_STATUSES,
  useSkuMovements,
  useStockReconcileSnapshot,
  type ItemKindCode,
  type StockReconcileRow,
  type StockStatusCode,
} from "./stock-reconcile-api";
import { useT } from "@/shared/i18n/useT";
import {
  CHECK_LABELS,
  KIND_OPTIONS,
  LABELS,
  NORM_STATE_LABELS,
  type NormState,
} from "./stock-reconcile-labels";
import "./stock-reconcile-report.css";

/**
 * Nhãn hiển thị — chép nguyên `labels` của demo.
 *
 * Nhãn theo mã nghiệp vụ (`LABELS`, `CHECK_LABELS`, `NORM_STATE_LABELS`) nằm ở
 * `./stock-reconcile-labels.ts` — bảng song ngữ đọc theo ngôn ngữ lúc truy cập.
 */

/** Màu từng trạng thái tồn trong thanh cơ cấu — đúng bảng màu Vuexy của demo. */
const STATUS_COLORS: Readonly<Record<StockStatusCode, string>> = {
  AVAILABLE: "var(--wms-success)",
  NON_SELLABLE: "var(--wms-warning)",
  DEFECTIVE: "var(--wms-error)",
  QUARANTINE: "var(--wms-info)",
};

/** Chu vi vòng tròn r=66 mà demo dùng để cắt cung (2πr ≈ 415). */
const DONUT_CIRCUMFERENCE = 415;

type ViewMode = "table" | "snapshot";

type SkuAggregate = {
  code: string;
  name: string;
  kind: ItemKindCode | "";
  balance: number;
  ledger: number;
  available: number;
  mismatch: boolean;
  checks: string[];
};

/** `(v>0?"+":v<0?"−":"") + |v|` — đúng hàm `signed` của demo (dấu trừ U+2212). */
function signed(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return prefix + fmt(Math.abs(value));
}

/** "95,2" — demo làm tròn 1 chữ số rồi đổi dấu chấm thành dấu phẩy. */
function percentText(part: number, total: number): string {
  const ratio = total ? (part / total) * 100 : 0;
  return ratio.toFixed(1).replace(".", ",");
}

function checkLabel(checks: string[]): string {
  if (checks.length === 0) return EMPTY_TEXT;
  return checks.map((check) => CHECK_LABELS[check] ?? check).join(" · ");
}

/** Badge "Trạng thái đối soát" — demo chỉ có 2 nhánh, thêm nhánh NOT_APPLICABLE. */
function ReconcileChip({ status }: { status: string }) {
  const t = useT();
  if (status === "MATCH") {
    return (
      <span className="match-chip">
        {t("reports.stockReconcileReport.matched")}
      </span>
    );
  }
  if (status === "NOT_APPLICABLE") {
    return (
      <span className="chip chip-neutral">
        {t("reports.stockReconcileReport.notApplicable")}
      </span>
    );
  }
  return (
    <span className="chip chip-error">
      {t("reports.stockReconcileReport.mismatch")}
    </span>
  );
}

function stockStatusChipClass(status: string): string {
  if (status === "AVAILABLE") return "chip chip-success";
  if (status === "NON_SELLABLE") return "chip chip-warning";
  return "chip chip-error";
}

/** Số âm dùng lớp `.is-negative` thay cho style màu đỏ inline của demo. */
function DeltaCell({ value }: { value: number }) {
  return (
    <td className="num">
      <strong className={value === 0 ? undefined : "is-negative"}>
        {signed(value)}
      </strong>
    </td>
  );
}

/**
 * Câu chữ trạng thái định mức — NGUỒN DUY NHẤT cho cả dropdown lọc lẫn chip
 * trong bảng (trước đây hai nơi tự viết lại chuỗi nên dễ nói hai kiểu).
 */

type NormRow = {
  code: string;
  name: string;
  kind: ItemKindCode | "";
  available: number;
  min: number | null;
  max: number | null;
  gap: number | null;
  state: NormState;
};

function normStateOf(
  available: number,
  min: number | null,
  max: number | null,
): { state: NormState; gap: number | null } {
  if (min === null && max === null) return { state: "UNSET", gap: null };
  if (min !== null && available < min) {
    return { state: "LOW", gap: available - min };
  }
  if (max !== null && available > max) {
    return { state: "OVER", gap: available - max };
  }
  return { state: "NORMAL", gap: min !== null ? available - min : null };
}

/** Tông màu của từng trạng thái; câu chữ luôn lấy từ `NORM_STATE_LABELS`. */
const NORM_STATE_CHIP_CLASS: Readonly<Record<NormState, string>> = {
  LOW: "chip chip-error",
  OVER: "chip chip-warning",
  UNSET: "chip chip-neutral",
  NORMAL: "match-chip",
};

function NormStatusChip({ state }: { state: NormState }) {
  return (
    <span className={NORM_STATE_CHIP_CLASS[state]}>
      {NORM_STATE_LABELS[state]}
    </span>
  );
}

export default function StockReconcileReport() {
  const t = useT();
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);

  // ── Bộ lọc (state của demo: kind / query / view + mốc đối soát) ─────────
  const [asOf, setAsOf] = useState<Dayjs>(() => dayjs().startOf("day"));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [view, setView] = useState<ViewMode>("table");
  /** Chú giải MATCH / MISMATCH của vòng tròn — demo để nút chết, đây bật/tắt thật. */
  const [series, setSeries] = useState({ match: true, mismatch: true });

  /**
   * Dòng đang mở hộp thoại được CHỤP tại thời điểm bấm (demo cũng vậy:
   * `data.rows.find(...)` chạy trong handler), nên đổi bộ lọc phía sau không
   * làm nội dung hộp thoại nhảy số.
   */
  const [drill, setDrill] = useState<{
    row: StockReconcileRow;
    trigger: HTMLElement;
  } | null>(null);

  const { snapshot, thresholds, loading, fetching, error, refetch } =
    useStockReconcileSnapshot({ asOf: asOf.format(ISO_DATE) });

  // ── Tập dòng trong phạm vi bộ lọc (hàm `rowsInScope` của demo) ──────────
  const rowsInScope = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.rows.filter((row) => {
      const byKind = kind === "all" || row.item_kind === kind;
      const haystack = `${row.sku_code} ${row.sku_name}`.toLowerCase();
      return byKind && haystack.includes(needle);
    });
  }, [snapshot.rows, kind, query]);

  // ── Gộp theo SKU (hàm `aggregateSku` của demo) ──────────────────────────
  const aggregates = useMemo<SkuAggregate[]>(() => {
    const map = new Map<string, SkuAggregate>();
    for (const row of rowsInScope) {
      const entry = map.get(row.sku_code) ?? {
        code: row.sku_code,
        name: row.sku_name,
        kind: row.item_kind,
        balance: 0,
        ledger: 0,
        available: 0,
        mismatch: false,
        checks: [] as string[],
      };
      entry.balance += row.balance_qty;
      entry.ledger += row.ledger_qty;
      entry.available += row.available_qty;
      entry.mismatch =
        entry.mismatch || row.reconciliation_status === "MISMATCH";
      for (const check of row.mismatch_checks) {
        if (!entry.checks.includes(check)) entry.checks.push(check);
      }
      map.set(row.sku_code, entry);
    }
    return [...map.values()];
  }, [rowsInScope]);

  // ── Bốn thẻ KPI (hàm `updateSummary` của demo) ──────────────────────────
  const summary = useMemo(() => {
    const sum = (
      predicate: (row: StockReconcileRow) => boolean,
      field: (row: StockReconcileRow) => number,
    ) =>
      rowsInScope.reduce(
        (total, row) => (predicate(row) ? total + field(row) : total),
        0,
      );
    return {
      balance: sum(
        () => true,
        (row) => row.balance_qty,
      ),
      available: sum(
        () => true,
        (row) => row.available_qty,
      ),
      nonSellable: sum(
        (row) => row.stock_status === "NON_SELLABLE",
        (row) => row.balance_qty,
      ),
      risk: sum(
        (row) =>
          row.stock_status === "DEFECTIVE" || row.stock_status === "QUARANTINE",
        (row) => row.balance_qty,
      ),
    };
  }, [rowsInScope]);

  // ── 1. Cơ cấu tồn kho hiện tại (hàm `renderStructure`) ──────────────────
  const structure = useMemo(
    () =>
      STOCK_STATUSES.map((status) => {
        const value = rowsInScope
          .filter((row) => row.stock_status === status)
          .reduce((total, row) => total + row.balance_qty, 0);
        return { status, value };
      }),
    [rowsInScope],
  );
  const structureAria = structure
    .map((item) =>
      t("reports.stockReconcileReport.structureAriaItem", {
        label: LABELS[item.status],
        value: fmt(item.value),
        percent: percentText(item.value, summary.balance),
      }),
    )
    .join("; ");

  // ── 2. Tỷ lệ đối soát (hàm `renderReconcile`) ───────────────────────────
  const matchedCount = aggregates.filter((entry) => !entry.mismatch).length;
  const mismatchedCount = aggregates.length - matchedCount;
  const shownMatched = series.match ? matchedCount : 0;
  const shownMismatched = series.mismatch ? mismatchedCount : 0;
  const donutTotal = shownMatched + shownMismatched;
  const matchArc = donutTotal
    ? (shownMatched / donutTotal) * DONUT_CIRCUMFERENCE
    : 0;
  const mismatchArc = donutTotal
    ? (shownMismatched / donutTotal) * DONUT_CIRCUMFERENCE
    : 0;

  // ── 3. Top SKU chênh lệch (hàm `renderVariance`) ────────────────────────
  const varianceRows = useMemo(
    () =>
      aggregates
        .filter((entry) => entry.mismatch)
        .sort(
          (a, b) =>
            Math.abs(b.balance - b.ledger) - Math.abs(a.balance - a.ledger),
        ),
    [aggregates],
  );

  // ── 4. Kiểm soát lượng khả dụng (bảng định mức) ─────────────────────────
  const normRows = useMemo<NormRow[]>(
    () =>
      aggregates.map((entry) => {
        const threshold = thresholds.get(entry.code);
        const min = threshold?.min_qty ?? null;
        const max = threshold?.max_qty ?? null;
        const { state, gap } = normStateOf(entry.available, min, max);
        return {
          code: entry.code,
          name: entry.name,
          kind: entry.kind,
          available: entry.available,
          min,
          max,
          gap,
          state,
        };
      }),
    [aggregates, thresholds],
  );
  const belowMinCount = normRows.filter((row) => row.state === "LOW").length;

  /**
   * Ba bộ lọc RIÊNG cho ba khối danh sách dài của màn này.
   *
   * Bộ lọc đầu trang đổi cả KPI, donut cơ cấu tồn và cả ba khối cùng lúc; khi
   * người đọc chỉ muốn "tìm SKU này trong đúng bảng đang soi" thì đó là công
   * cụ quá thô. Ba bộ lọc dưới đây chỉ thu hẹp TẦM NHÌN của chính khối chứa
   * nó, không gọi lại API và không đụng tới số liệu tổng.
   */
  const varianceFilterConfig = useMemo<SectionFilterConfig<SkuAggregate>>(
    () => ({
      searchPlaceholder: t("reports.stockReconcileReport.skuSearchPlaceholder"),
      searchText: (row) => [row.code, row.name],
      selects: [
        {
          key: "kind",
          placeholder: t("reports.stockReconcileReport.anyKind"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.kind,
              (value) => LABELS[value] ?? value,
            ),
          match: (row, value) => row.kind === value,
        },
        {
          key: "check",
          placeholder: t("reports.stockReconcileReport.anyCheck"),
          options: (list) => {
            const codes = new Set<string>();
            for (const row of list) {
              for (const code of row.checks) codes.add(code);
            }
            return [...codes]
              .sort((a, b) => a.localeCompare(b, "vi"))
              .map((code) => ({
                value: code,
                label: CHECK_LABELS[code] ?? code,
              }));
          },
          match: (row, value) => row.checks.includes(value),
          minWidth: 210,
        },
      ],
    }),
    [t],
  );
  const varianceFilter = useSectionFilter(varianceRows, varianceFilterConfig);

  const normFilterConfig = useMemo<SectionFilterConfig<NormRow>>(
    () => ({
      searchPlaceholder: t("reports.stockReconcileReport.skuSearchPlaceholder"),
      searchText: (row) => [row.code, row.name],
      selects: [
        {
          key: "kind",
          placeholder: t("reports.stockReconcileReport.anyKind"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.kind,
              (value) => LABELS[value] ?? value,
            ),
          match: (row, value) => row.kind === value,
        },
        {
          key: "state",
          placeholder: t("reports.stockReconcileReport.anyNormState"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.state,
              (value) => NORM_STATE_LABELS[value as NormState] ?? value,
            ),
          match: (row, value) => row.state === value,
          minWidth: 210,
        },
      ],
    }),
    [t],
  );
  const normFilter = useSectionFilter(normRows, normFilterConfig);

  const detailFilterConfig = useMemo<SectionFilterConfig<StockReconcileRow>>(
    () => ({
      searchPlaceholder: t(
        "reports.stockReconcileReport.skuWarehouseSearchPlaceholder",
      ),
      searchText: (row) => [row.sku_code, row.sku_name, row.warehouse_code],
      selects: [
        {
          key: "warehouse",
          placeholder: t("reports.stockReconcileReport.anyWarehouse"),
          options: (list) => optionsFromRows(list, (row) => row.warehouse_code),
          match: (row, value) => row.warehouse_code === value,
          minWidth: 150,
        },
        {
          key: "status",
          placeholder: t("reports.stockReconcileReport.anyStockStatus"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.stock_status,
              (value) => LABELS[value] ?? value,
            ),
          match: (row, value) => row.stock_status === value,
          minWidth: 190,
        },
        {
          key: "reconcile",
          placeholder: t("reports.stockReconcileReport.anyReconcileResult"),
          options: [
            {
              value: "MISMATCH",
              label: t("reports.stockReconcileReport.mismatch"),
            },
            {
              value: "MATCH",
              label: t("reports.stockReconcileReport.matched"),
            },
          ],
          match: (row, value) =>
            value === "MISMATCH"
              ? row.reconciliation_status === "MISMATCH"
              : row.reconciliation_status !== "MISMATCH",
          minWidth: 200,
        },
      ],
    }),
    [],
  );
  const detailFilter = useSectionFilter(rowsInScope, detailFilterConfig);

  // ── 5. Chi tiết + hộp thoại bằng chứng ──────────────────────────────────
  const drillRow = drill?.row ?? null;
  const { events: movementEvents, loading: movementsLoading } = useSkuMovements(
    drillRow?.sku_code ?? null,
  );

  const closeDrill = () => {
    drill?.trigger.focus({ preventScroll: true });
    setDrill(null);
  };

  const openDrill = (row: StockReconcileRow, trigger: HTMLElement) => {
    setDrill({ row, trigger });
  };

  /**
   * Nút "Làm mới" của demo (`offline-reset`) đưa MỌI bộ lọc về mặc định rồi vẽ
   * lại; ở đây thêm một lượt gọi lại số liệu vì dữ liệu là thật.
   */
  const resetFilters = useCallback(() => {
    setKind("all");
    setQuery("");
    setAsOf(dayjs().startOf("day"));
    setView("table");
    setSeries({ match: true, mismatch: true });
  }, []);

  const { refreshing, refresh } = useReportRefresh({
    refetch,
    readError: () => error,
    beforeRefetch: resetFilters,
  });

  // Đổi tab bằng bàn phím thì focus phải đi theo tab đang chọn (như demo).
  const tableTabRef = useRef<HTMLButtonElement>(null);
  const snapshotTabRef = useRef<HTMLButtonElement>(null);

  /** Điều hướng bàn phím giữa hai tab, đúng bộ phím demo bắt. */
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: ViewMode =
      event.key === "Home"
        ? "table"
        : event.key === "End"
          ? "snapshot"
          : view === "table"
            ? "snapshot"
            : "table";
    setView(next);
    const target = next === "table" ? tableTabRef : snapshotTabRef;
    target.current?.focus();
  };

  const snapshotMoment = snapshot.as_of === "" ? null : dayjs(snapshot.as_of);
  const watermark =
    snapshot.source_watermark === ""
      ? null
      : dayjs(snapshot.source_watermark.replace(" ", "T"));

  const pageAlert: { tone: string; body: ReactNode } | null = (() => {
    if (error !== null && error !== undefined) {
      return {
        tone: "page-alert is-error",
        body: <>{getApiErrorMessage(error)}</>,
      };
    }
    if (loading) {
      return {
        tone: "page-alert is-info",
        body: <>{t("reports.stockReconcileReport.loadingData")}</>,
      };
    }
    if (snapshot.as_of_snapshot) {
      return {
        tone: "page-alert is-info",
        body: (
          <>
            {t("reports.stockReconcileReport.asOfNoticeA")}{" "}
            <strong>{asOf.format("DD-MM-YYYY")}</strong>
            {t("reports.stockReconcileReport.asOfNoticeB")}
          </>
        ),
      };
    }
    // return {
    //   tone: "page-alert",
    //   body: (
    //     <>
    //       Đang xem ảnh chụp tại{" "}
    //       <strong>
    //         {snapshotMoment
    //           ? snapshotMoment.format("DD-MM-YYYY HH:mm")
    //           : EMPTY_TEXT}
    //       </strong>
    //       . Balance và ledger được đối soát theo cùng mốc chốt; đây không phải
    //       số dư thời gian thực.
    //     </>
    //   ),
    // };
    // Nhánh mặc định (dải "đang xem ảnh chụp" bên trên đã được gỡ): không có gì
    // phải báo thì KHÔNG hiện cảnh báo nào. Phải trả `null` tường minh — rơi
    // khỏi hàm là trả `undefined`, lệch kiểu đã khai của `pageAlert`.
    return null;
  })();

  return (
    <div className="hn-rpt02" data-mvp-screen="RPT-02">
      <div className="page-wrap">
        <div
          className="breadcrumb"
          aria-label={t("reports.stockReconcileReport.breadcrumbAria")}
        >
          <span>{t("reports.stockReconcileReport.breadcrumbHome")}</span>
          <span aria-hidden="true">/</span>
          <span>{t("reports.stockReconcileReport.breadcrumbReports")}</span>
          <span aria-hidden="true">/</span>
          <strong>{t("reports.stockReconcileReport.breadcrumbCurrent")}</strong>
        </div>

        <section className="page-header" aria-labelledby="rpt02-page-title">
          <div>
            <span className="eyebrow">
              {t("reports.stockReconcileReport.eyebrow")}
            </span>
            <h1 id="rpt02-page-title">
              {t("reports.stockReconcileReport.title")}
            </h1>
            <p>{t("reports.stockReconcileReport.subtitle")}</p>
          </div>
          <div className="scope-block">
            <span className="chip chip-primary">
              {snapshot.warehouse_code === ""
                ? ALL_WAREHOUSES_LABEL
                : snapshot.warehouse_code}
            </span>
            <span className="chip chip-neutral">
              {isSuperAdmin
                ? "Super Admin"
                : t("reports.stockReconcileReport.roleOperator")}
            </span>
            {mismatchedCount > 0 ? (
              <span className="chip chip-warning">
                {t("reports.stockReconcileReport.needsAction")}
              </span>
            ) : (
              <span className="chip chip-success">
                {t("reports.stockReconcileReport.allMatched")}
              </span>
            )}
          </div>
        </section>

        <section
          className="filter-card report-filter-card"
          aria-label={t("reports.stockReconcileReport.filterAria")}
        >
          <div className="filter-group">
            <span className="filter-label">
              {t("reports.stockReconcileReport.fieldAsOf")}
            </span>
            {/*
             * `maxDate` là hôm nay: mốc đối soát phải là ngày ĐÃ ghi sổ, chốt ở
             * tương lai thì không có số dư nào để đối chiếu.
             */}
            <UiVuexyDateField
              id="rpt02-as-of-date"
              field="as-of"
              aria-label={t("reports.stockReconcileReport.fieldAsOf")}
              value={asOf}
              maxDate={dayjs().startOf("day")}
              onChange={(value) => {
                if (value === null) return;
                setAsOf(value.startOf("day"));
              }}
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">
              {t("reports.stockReconcileReport.fieldSkuSearch")}
            </span>
            <SearchInput
              width="100%"
              value={query}
              aria-label={t("reports.stockReconcileReport.fieldSkuSearch")}
              placeholder={t("reports.stockReconcileReport.skuSearchInput")}
              onChange={setQuery}
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">
              {t("reports.stockReconcileReport.fieldKind")}
            </span>
            <UiSelect
              fullWidth
              aria-label={t("reports.stockReconcileReport.fieldKind")}
              value={kind}
              options={KIND_OPTIONS.map((option) => ({ ...option }))}
              onChange={setKind}
            />
          </div>

          <div className="refresh-block report-filter-actions">
            {/*
             * Đang làm mới thì nút hiện spinner + đổi chữ, xong thì có toast —
             * lượt gọi lại xong trong ~50ms nên nếu chỉ `disabled` thì người
             * dùng không thấy gì (xem `useReportRefresh`).
             */}
            <button
              className="button button-primary"
              type="button"
              onClick={refresh}
              disabled={refreshing || fetching}
              aria-busy={refreshing || undefined}
            >
              <span
                className={
                  refreshing ? "refresh-icon is-spinning" : "refresh-icon"
                }
                aria-hidden="true"
              >
                <VuexyDemoIcon name="refresh-cw" />
              </span>
              {refreshing
                ? t("reports.stockReconcileReport.refreshing")
                : t("reports.stockReconcileReport.refresh")}
            </button>
            <div className="refresh-meta">
              <span>
                {t("reports.stockReconcileReport.dataAt", {
                  time: snapshotMoment
                    ? snapshotMoment.format("HH:mm")
                    : EMPTY_TEXT,
                })}
              </span>
              <small>
                {t("reports.stockReconcileReport.postedUntil", {
                  date:
                    watermark && watermark.isValid()
                      ? watermark.format("DD-MM-YYYY")
                      : EMPTY_TEXT,
                })}
              </small>
            </div>
          </div>

          <div className="report-snapshot">
            {t("reports.stockReconcileReport.sliceLabel")}{" "}
            <strong>
              {snapshot.snapshot_id === "" ? EMPTY_TEXT : snapshot.snapshot_id}
            </strong>{" "}
            ·{" "}
            {snapshot.warehouse_code === ""
              ? ALL_WAREHOUSES_LABEL
              : snapshot.warehouse_code}{" "}
            · {STOCK_RECONCILE_TIMEZONE}
          </div>
        </section>

        {pageAlert ? (
          <div className={pageAlert.tone} role="note">
            {pageAlert.body}
          </div>
        ) : null}

        {/* ── Tổng quan tồn và đối soát ─────────────────────────────────── */}
        <section aria-labelledby="rpt02-overview-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.stockReconcileReport.overviewEyebrow")}
              </span>
              <h2 id="rpt02-overview-title">
                {t("reports.stockReconcileReport.overviewTitle")}
              </h2>
            </div>
            <span className="section-meta">
              {snapshot.warehouse_code === ""
                ? ALL_WAREHOUSES_LABEL
                : snapshot.warehouse_code}{" "}
              · {t("reports.stockReconcileReport.unitPcs")}
            </span>
          </div>
          <div className="kpi-grid report-kpi-grid">
            <article
              className="card kpi-card report-kpi-card"
              data-tone="opening"
            >
              <div className="kpi-top">
                <span className="kpi-label">
                  {t("reports.stockReconcileReport.kpiTotal")}
                </span>
                <span className="kpi-icon" aria-hidden="true">
                  <VuexyDemoIcon name="warehouse" />
                </span>
              </div>
              <div className="kpi-value">{fmt(summary.balance)}</div>
              <div className="kpi-bottom">
                <span className="kpi-foot">
                  {t("reports.stockReconcileReport.kpiTotalFoot")}
                </span>
              </div>
            </article>
            <article
              className="card kpi-card report-kpi-card"
              data-tone="inbound"
            >
              <div className="kpi-top">
                <span className="kpi-label">
                  {t("reports.stockReconcileReport.kpiAvailable")}
                </span>
                <span className="kpi-icon" aria-hidden="true">
                  <VuexyDemoIcon name="package-plus" />
                </span>
              </div>
              <div className="kpi-value">{fmt(summary.available)}</div>
              <div className="kpi-bottom">
                <span className="kpi-foot">
                  {t("reports.stockReconcileReport.kpiAvailableFoot")}
                </span>
              </div>
            </article>
            <article
              className="card kpi-card report-kpi-card"
              data-tone="component"
            >
              <div className="kpi-top">
                <span className="kpi-label">
                  {t("reports.stockReconcileReport.kpiNonSellable")}
                </span>
                <span className="kpi-icon" aria-hidden="true">
                  <VuexyDemoIcon name="briefcase-medical" />
                </span>
              </div>
              <div className="kpi-value">{fmt(summary.nonSellable)}</div>
              <div className="kpi-bottom">
                <span className="kpi-foot">
                  {t("reports.stockReconcileReport.kpiNonSellableFoot")}
                </span>
              </div>
            </article>
            <article
              className="card kpi-card report-kpi-card"
              data-tone="product"
            >
              <div className="kpi-top">
                <span className="kpi-label">
                  {t("reports.stockReconcileReport.kpiRisk")}
                </span>
                <span className="kpi-icon" aria-hidden="true">
                  <VuexyDemoIcon name="triangle-alert" />
                </span>
              </div>
              <div className="kpi-value">{fmt(summary.risk)}</div>
              <div className="kpi-bottom">
                <span className="kpi-foot">
                  {t("reports.stockReconcileReport.kpiRiskFoot")}
                </span>
              </div>
            </article>
          </div>
        </section>

        {/* ── Cơ cấu và mức độ khớp ─────────────────────────────────────── */}
        <section aria-labelledby="rpt02-status-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.stockReconcileReport.statusEyebrow")}
              </span>
              <h2 id="rpt02-status-title">
                {t("reports.stockReconcileReport.statusTitle")}
              </h2>
            </div>
            <span className="section-meta">
              {t("reports.stockReconcileReport.statusMeta")}
            </span>
          </div>
          <div className="analysis-grid">
            <article
              className="card chart-card report-chart-card"
              data-chart-series="structure"
            >
              <header className="card-head chart-card-head">
                <div className="chart-heading">
                  <span className="chart-icon" aria-hidden="true">
                    <VuexyDemoIcon name="warehouse" />
                  </span>
                  <div>
                    <h3>{t("reports.stockReconcileReport.structureTitle")}</h3>
                    <span className="card-subtitle">
                      {t("reports.stockReconcileReport.structureSubtitle")}
                    </span>
                  </div>
                </div>
                <div className="chart-head-meta">
                  <span className="chart-unit">
                    {t("reports.stockReconcileReport.unitPcs")}
                  </span>
                  <span className="chart-current">
                    <small>
                      {t("reports.stockReconcileReport.totalStock")}
                    </small>
                    <strong>{fmt(summary.balance)}</strong>
                  </span>
                </div>
              </header>
              <div className="chart-wrap">
                <div className="chart-plot structure-plot">
                  <div
                    className="structure-chart"
                    role="img"
                    aria-label={t(
                      "reports.stockReconcileReport.structureAria",
                      {
                        detail: structureAria,
                      },
                    )}
                  >
                    {structure.map((item) => (
                      <div
                        key={item.status}
                        className="structure-row"
                        style={
                          {
                            "--structure-color": STATUS_COLORS[item.status],
                            "--structure-width": `${summary.balance ? ((item.value / summary.balance) * 100).toFixed(2) : "0.00"}%`,
                          } as CSSProperties
                        }
                      >
                        <div className="structure-row-head">
                          <span className="structure-name">
                            <i aria-hidden="true" />
                            {LABELS[item.status]}
                          </span>
                          <strong>
                            {fmt(item.value)}{" "}
                            {t("reports.stockReconcileReport.pcsSuffix")}{" "}
                            <small>
                              {percentText(item.value, summary.balance)}%
                            </small>
                          </strong>
                        </div>
                        <span className="structure-track" aria-hidden="true">
                          <i />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <details className="chart-table">
                <summary>{t("reports.stockReconcileReport.altTable")}</summary>
                <table>
                  <thead>
                    <tr>
                      <th>{t("reports.stockReconcileReport.colStatus")}</th>
                      <th>{t("reports.stockReconcileReport.colQuantity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structure.map((item) => (
                      <tr key={item.status}>
                        <td>{LABELS[item.status]}</td>
                        <td>{fmt(item.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </article>

            <article
              className="card chart-card report-chart-card"
              data-chart-series="reconcile"
            >
              <header className="card-head chart-card-head">
                <div className="chart-heading">
                  <span
                    className="chart-icon chart-icon-warning"
                    aria-hidden="true"
                  >
                    <VuexyDemoIcon name="triangle-alert" />
                  </span>
                  <div>
                    <h3>
                      {t("reports.stockReconcileReport.reconcileRateTitle")}
                    </h3>
                    <span className="card-subtitle">
                      {t("reports.stockReconcileReport.reconcileRateSubtitle")}
                    </span>
                  </div>
                </div>
                <div className="chart-head-meta">
                  {mismatchedCount > 0 ? (
                    <span className="chip chip-warning">
                      {t("reports.stockReconcileReport.needsAction")}
                    </span>
                  ) : (
                    <span className="chip chip-success">
                      {t("reports.stockReconcileReport.allMatched")}
                    </span>
                  )}
                  <span className="chart-current">
                    <small>{t("reports.stockReconcileReport.totalSku")}</small>
                    <strong>{fmt(aggregates.length)}</strong>
                  </span>
                </div>
              </header>
              <div className="chart-wrap">
                <div className="chart-legend">
                  <button
                    className="legend-button"
                    type="button"
                    aria-pressed={series.match}
                    onClick={() =>
                      setSeries((current) => ({
                        ...current,
                        match: !current.match,
                      }))
                    }
                  >
                    <span
                      className="legend-dot"
                      style={
                        { "--legend": "var(--wms-success)" } as CSSProperties
                      }
                      aria-hidden="true"
                    />
                    {t("reports.stockReconcileReport.legendMatched", {
                      count: fmt(matchedCount),
                    })}
                  </button>
                  <button
                    className="legend-button"
                    type="button"
                    aria-pressed={series.mismatch}
                    onClick={() =>
                      setSeries((current) => ({
                        ...current,
                        mismatch: !current.mismatch,
                      }))
                    }
                  >
                    <span
                      className="legend-dot"
                      style={
                        { "--legend": "var(--wms-error)" } as CSSProperties
                      }
                      aria-hidden="true"
                    />
                    {t("reports.stockReconcileReport.legendMismatch", {
                      count: fmt(mismatchedCount),
                    })}
                  </button>
                </div>
                <div className="chart-plot">
                  <svg
                    className="chart-svg"
                    viewBox="0 0 360 228"
                    role="img"
                    aria-label={t("reports.stockReconcileReport.donutAria", {
                      matched: fmt(shownMatched),
                      mismatched: fmt(shownMismatched),
                    })}
                  >
                    <circle
                      className="chart-donut-track"
                      cx="180"
                      cy="112"
                      r="66"
                      fill="none"
                      strokeWidth="22"
                    />
                    <circle
                      className="chart-donut-match"
                      cx="180"
                      cy="112"
                      r="66"
                      fill="none"
                      strokeWidth="22"
                      strokeDasharray={`${matchArc} ${DONUT_CIRCUMFERENCE}`}
                      strokeLinecap="butt"
                      transform="rotate(-90 180 112)"
                    />
                    <circle
                      className="chart-donut-mismatch"
                      cx="180"
                      cy="112"
                      r="66"
                      fill="none"
                      strokeWidth="22"
                      strokeDasharray={`${mismatchArc} ${DONUT_CIRCUMFERENCE}`}
                      strokeDashoffset={`-${matchArc}`}
                      strokeLinecap="butt"
                      transform="rotate(-90 180 112)"
                    />
                    <text
                      className="chart-donut-total"
                      x="180"
                      y="106"
                      textAnchor="middle"
                    >
                      {fmt(donutTotal)}
                    </text>
                    <text
                      x="180"
                      y="128"
                      textAnchor="middle"
                      className="chart-axis-label"
                    >
                      {t("reports.stockReconcileReport.skuChecked")}
                    </text>
                  </svg>
                </div>
              </div>
              <details className="chart-table">
                <summary>{t("reports.stockReconcileReport.altTable")}</summary>
                <table>
                  <thead>
                    <tr>
                      <th>{t("reports.stockReconcileReport.colStatus")}</th>
                      <th>{t("reports.stockReconcileReport.colSkuCount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{t("reports.stockReconcileReport.matched")}</td>
                      <td>{fmt(matchedCount)}</td>
                    </tr>
                    <tr>
                      <td>{t("reports.stockReconcileReport.mismatch")}</td>
                      <td>{fmt(mismatchedCount)}</td>
                    </tr>
                  </tbody>
                </table>
              </details>
            </article>
          </div>
        </section>

        {/* ── Top SKU chênh lệch đối soát ───────────────────────────────── */}
        <section aria-labelledby="rpt02-variance-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.stockReconcileReport.varianceEyebrow")}
              </span>
              <h2 id="rpt02-variance-title">
                {t("reports.stockReconcileReport.varianceTitle")}
              </h2>
            </div>
            <span className="section-meta">
              {t("reports.stockReconcileReport.varianceMeta")}
            </span>
          </div>
          <article className="card report-table-card">
            <header className="card-head">
              <div>
                <h3>{t("reports.stockReconcileReport.varianceCardTitle")}</h3>
                <span className="card-subtitle">
                  {t("reports.stockReconcileReport.varianceCardSubtitle")}
                </span>
              </div>
              {varianceRows.length > 0 ? (
                <span className="chip chip-error">
                  {t("reports.stockReconcileReport.mismatchCount", {
                    count: fmt(varianceRows.length),
                  })}
                </span>
              ) : (
                <span className="chip chip-success">
                  {t("reports.stockReconcileReport.noMismatch")}
                </span>
              )}
            </header>
            <SectionFilterBar
              state={varianceFilter}
              label={t("reports.stockReconcileReport.varianceCardTitle")}
              unit="SKU"
              data-testid="rpt02-variance-section-filter"
            />
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>{t("reports.stockReconcileReport.colSkuName")}</th>
                    <th className="num">
                      {t("reports.stockReconcileReport.colBalance")}
                    </th>
                    <th className="num">
                      {t("reports.stockReconcileReport.colLedgerMovement")}
                    </th>
                    <th className="num">
                      {t("reports.stockReconcileReport.colVariance")}
                    </th>
                    <th>{t("reports.stockReconcileReport.colMismatchAt")}</th>
                    <th>{t("reports.stockReconcileReport.colIncident")}</th>
                  </tr>
                </thead>
                <tbody>
                  {varianceFilter.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        {varianceFilter.active
                          ? t("reports.stockReconcileReport.emptyFiltered")
                          : t("reports.stockReconcileReport.varianceEmpty")}
                      </td>
                    </tr>
                  ) : (
                    varianceFilter.rows.map((item) => {
                      const source = snapshot.rows.find(
                        (row) =>
                          row.sku_code === item.code &&
                          row.reconciliation_status === "MISMATCH",
                      );
                      return (
                        <tr key={item.code}>
                          <td>
                            <span className="sku">{item.code}</span>
                            <div className="truncate" title={item.name}>
                              {item.name === "" ? EMPTY_TEXT : item.name}
                            </div>
                          </td>
                          <td className="num">{fmt(item.balance)}</td>
                          <td className="num">{fmt(item.ledger)}</td>
                          <DeltaCell value={item.balance - item.ledger} />
                          <td>
                            <span className="chip chip-error">
                              {checkLabel(item.checks)}
                            </span>
                          </td>
                          <td>
                            {source?.incident_id
                              ? `${source.incident_id} · ${source.incident_status ?? EMPTY_TEXT}`
                              : EMPTY_TEXT}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        {/* ── Kiểm soát lượng khả dụng ──────────────────────────────────── */}
        <section aria-labelledby="rpt02-norm-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.stockReconcileReport.normEyebrow")}
              </span>
              <h2 id="rpt02-norm-title">
                {t("reports.stockReconcileReport.normTitle")}
              </h2>
            </div>
            <span className="section-meta">
              {t("reports.stockReconcileReport.normMeta")}
            </span>
          </div>
          <article className="card report-table-card">
            <header className="card-head">
              <div>
                <h3>{t("reports.stockReconcileReport.normCardTitle")}</h3>
                <span className="card-subtitle">
                  {t("reports.stockReconcileReport.normCardSubtitle")}
                </span>
              </div>
              {belowMinCount > 0 ? (
                <span className="chip chip-warning">
                  {t("reports.stockReconcileReport.belowMinCount", {
                    count: fmt(belowMinCount),
                  })}
                </span>
              ) : (
                <span className="chip chip-success">
                  {t("reports.stockReconcileReport.noBelowMin")}
                </span>
              )}
            </header>
            <SectionFilterBar
              state={normFilter}
              label={t("reports.stockReconcileReport.normCardTitle")}
              unit="SKU"
              data-testid="rpt02-norm-section-filter"
            />
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>{t("reports.stockReconcileReport.colSkuName")}</th>
                    <th>{t("reports.stockReconcileReport.colKind")}</th>
                    <th className="num">
                      {t("reports.stockReconcileReport.colAvailableQty")}
                    </th>
                    <th className="num">
                      {t("reports.stockReconcileReport.colMin")}
                    </th>
                    <th className="num">
                      {t("reports.stockReconcileReport.colMax")}
                    </th>
                    <th className="num">
                      {t("reports.stockReconcileReport.colVariance")}
                    </th>
                    <th>{t("reports.stockReconcileReport.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {normFilter.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        {normFilter.active
                          ? t("reports.stockReconcileReport.emptyFiltered")
                          : t("reports.stockReconcileReport.normEmpty")}
                      </td>
                    </tr>
                  ) : (
                    normFilter.rows.map((row) => (
                      <tr key={row.code}>
                        <td>
                          <span className="sku">{row.code}</span>
                          <div className="truncate" title={row.name}>
                            {row.name === "" ? EMPTY_TEXT : row.name}
                          </div>
                        </td>
                        <td>
                          {row.kind === "" ? EMPTY_TEXT : LABELS[row.kind]}
                        </td>
                        <td className="num">{fmt(row.available)}</td>
                        <td className="num">
                          {row.min === null ? EMPTY_TEXT : fmt(row.min)}
                        </td>
                        <td className="num">
                          {row.max === null ? EMPTY_TEXT : fmt(row.max)}
                        </td>
                        {row.gap === null ? (
                          <td className="num">{EMPTY_TEXT}</td>
                        ) : (
                          <DeltaCell value={row.gap} />
                        )}
                        <td>
                          <NormStatusChip state={row.state} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        {/* ── Chi tiết tồn kho & đối soát ───────────────────────────────── */}
        <section aria-labelledby="rpt02-detail-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.stockReconcileReport.detailEyebrow")}
              </span>
              <h2 id="rpt02-detail-title">
                {t("reports.stockReconcileReport.detailTitle")}
              </h2>
            </div>
            <span className="section-meta">
              {t("reports.stockReconcileReport.detailMeta", {
                count: fmt(rowsInScope.length),
              })}
            </span>
          </div>
          <article className="card report-table-card">
            <header className="card-head">
              <div>
                <h3>{t("reports.stockReconcileReport.detailCardTitle")}</h3>
                <span className="card-subtitle">
                  {t("reports.stockReconcileReport.detailCardSubtitle")}
                </span>
              </div>
              <div
                className="report-view-tabs"
                role="tablist"
                aria-label={t("reports.stockReconcileReport.viewAria")}
              >
                <button
                  ref={tableTabRef}
                  id="rpt02-tab-table"
                  className={`button ${view === "table" ? "button-primary" : "button-ghost"}`}
                  type="button"
                  role="tab"
                  aria-selected={view === "table"}
                  aria-controls="rpt02-panel-table"
                  tabIndex={view === "table" ? 0 : -1}
                  onClick={() => setView("table")}
                  onKeyDown={onTabKeyDown}
                >
                  <VuexyDemoIcon name="chart-column-big" />
                  {t("reports.stockReconcileReport.viewTable")}
                </button>
                <button
                  ref={snapshotTabRef}
                  id="rpt02-tab-snapshot"
                  className={`button ${view === "snapshot" ? "button-primary" : "button-ghost"}`}
                  type="button"
                  role="tab"
                  aria-selected={view === "snapshot"}
                  aria-controls="rpt02-panel-snapshot"
                  tabIndex={view === "snapshot" ? 0 : -1}
                  onClick={() => setView("snapshot")}
                  onKeyDown={onTabKeyDown}
                >
                  <VuexyDemoIcon name="grid-2x2-plus" />
                  {t("reports.stockReconcileReport.viewSnapshot")}
                </button>
              </div>
            </header>

            <SectionFilterBar
              state={detailFilter}
              label={t("reports.stockReconcileReport.detailCardTitle")}
              data-testid="rpt02-detail-section-filter"
            />

            <div
              id="rpt02-panel-table"
              role="tabpanel"
              aria-labelledby="rpt02-tab-table"
              hidden={view !== "table"}
            >
              <div className="table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>{t("reports.stockReconcileReport.colSkuKind")}</th>
                      <th>
                        {t("reports.stockReconcileReport.colStockStatus")}
                      </th>
                      <th className="num">
                        {t("reports.stockReconcileReport.colBalanceQty")}
                      </th>
                      <th className="num">
                        {t("reports.stockReconcileReport.colLedgerQty")}
                      </th>
                      <th className="num">
                        {t("reports.stockReconcileReport.colVariance")}
                      </th>
                      <th className="num">
                        {t("reports.stockReconcileReport.colAvailableQty")}
                      </th>
                      <th>
                        {t("reports.stockReconcileReport.colReconcileStatus")}
                      </th>
                      <th>{t("reports.stockReconcileReport.colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailFilter.rows.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          {detailFilter.active
                            ? t(
                                "reports.stockReconcileReport.detailEmptyFiltered",
                              )
                            : t("reports.stockReconcileReport.detailEmpty")}
                        </td>
                      </tr>
                    ) : (
                      detailFilter.rows.map((row, index) => (
                        <tr key={row.drillKey}>
                          <td>{index + 1}</td>
                          <td>
                            <span className="sku">{row.sku_code}</span>
                            <div className="truncate" title={row.sku_name}>
                              {row.sku_name === "" ? EMPTY_TEXT : row.sku_name}{" "}
                              ·{" "}
                              {row.item_kind === ""
                                ? EMPTY_TEXT
                                : LABELS[row.item_kind]}
                            </div>
                          </td>
                          <td>
                            <span
                              className={stockStatusChipClass(row.stock_status)}
                            >
                              {LABELS[row.stock_status] ?? row.stock_status}
                            </span>
                          </td>
                          <td className="num">{fmt(row.balance_qty)}</td>
                          <td className="num">{fmt(row.ledger_qty)}</td>
                          <DeltaCell value={row.delta_qty} />
                          <td className="num">{fmt(row.available_qty)}</td>
                          <td>
                            <ReconcileChip status={row.reconciliation_status} />
                          </td>
                          <td>
                            <button
                              className="button action-button"
                              type="button"
                              aria-label={t(
                                "reports.stockReconcileReport.viewEvidenceAria",
                                {
                                  sku: row.sku_code,
                                },
                              )}
                              onClick={(event) =>
                                openDrill(row, event.currentTarget)
                              }
                            >
                              <VuexyDemoIcon name="eye" />
                              <span>Xem</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              id="rpt02-panel-snapshot"
              role="tabpanel"
              aria-labelledby="rpt02-tab-snapshot"
              hidden={view !== "snapshot"}
            >
              <div className="report-snapshot-grid">
                {detailFilter.rows.map((row) => (
                  <article className="report-slice" key={row.drillKey}>
                    <div className="report-slice-head">
                      <div>
                        <strong>
                          {row.sku_code} ·{" "}
                          {row.sku_name === "" ? EMPTY_TEXT : row.sku_name}
                        </strong>
                        <span>
                          {row.item_kind === ""
                            ? EMPTY_TEXT
                            : LABELS[row.item_kind]}{" "}
                          · {LABELS[row.stock_status] ?? row.stock_status}
                        </span>
                      </div>
                      <ReconcileChip status={row.reconciliation_status} />
                    </div>
                    <dl className="report-slice-values">
                      <div>
                        <dt>{t("reports.stockReconcileReport.colBalance")}</dt>
                        <dd>{fmt(row.balance_qty)}</dd>
                      </div>
                      <div>
                        <dt>{t("reports.stockReconcileReport.cardLedger")}</dt>
                        <dd>{fmt(row.ledger_qty)}</dd>
                      </div>
                      <div>
                        <dt>{t("reports.stockReconcileReport.cardDelta")}</dt>
                        <dd>{signed(row.delta_qty)}</dd>
                      </div>
                      <div>
                        <dt>
                          {t("reports.stockReconcileReport.cardAvailable")}
                        </dt>
                        <dd>{fmt(row.available_qty)}</dd>
                      </div>
                    </dl>
                    <button
                      className="button action-button"
                      type="button"
                      aria-label={t(
                        "reports.stockReconcileReport.viewEvidenceAria",
                        {
                          sku: row.sku_code,
                        },
                      )}
                      onClick={(event) => openDrill(row, event.currentTarget)}
                    >
                      <VuexyDemoIcon name="eye" />
                      <span>Xem</span>
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </article>
        </section>
      </div>

      {drillRow ? (
        <EvidenceModal titleId="rpt02-detail-modal-title" onClose={closeDrill}>
          <div className="modal-head">
            <div>
              <div className="eyebrow modal-eyebrow">
                {t("reports.stockReconcileReport.modalEyebrow")}
              </div>
              <h2 id="rpt02-detail-modal-title">
                {drillRow.sku_code} ·{" "}
                {drillRow.sku_name === "" ? EMPTY_TEXT : drillRow.sku_name}
              </h2>
              <ReconcileChip status={drillRow.reconciliation_status} />
            </div>
            <ModalCloseButton onClose={closeDrill} />
          </div>
          <div className="modal-grid">
            <div>
              <div className="meta-label">
                {t("reports.stockReconcileReport.colBalanceQty")}
              </div>
              <div className="meta-value">{fmt(drillRow.balance_qty)}</div>
            </div>
            <div>
              <div className="meta-label">
                {t("reports.stockReconcileReport.colLedgerQty")}
              </div>
              <div className="meta-value">{fmt(drillRow.ledger_qty)}</div>
            </div>
            <div>
              <div className="meta-label">
                {t("reports.stockReconcileReport.colAvailableQty")}
              </div>
              <div className="meta-value">{fmt(drillRow.available_qty)}</div>
            </div>
          </div>
          <div className="formula">
            {t("reports.stockReconcileReport.formulaLine", {
              balance: fmt(drillRow.balance_qty),
              ledger: fmt(drillRow.ledger_qty),
              delta: signed(drillRow.delta_qty),
            })}
            <br />
            <small>
              {t("reports.stockReconcileReport.checkLine", {
                checks: checkLabel(drillRow.mismatch_checks),
                incident: drillRow.incident_id ?? EMPTY_TEXT,
              })}
            </small>
          </div>
          <h3>{t("reports.stockReconcileReport.movementsTitle")}</h3>
          <div className="modal-events">
            {movementsLoading ? (
              <div>
                <span>
                  {t("reports.stockReconcileReport.movementsLoading")}
                </span>
              </div>
            ) : movementEvents.length === 0 ? (
              <div>
                <span>{t("reports.stockReconcileReport.movementsEmpty")}</span>
              </div>
            ) : (
              movementEvents.map((event) => (
                <div key={event.id}>
                  <strong>
                    {MOVEMENT_LABELS[event.movement_type] ??
                      event.movement_type}
                  </strong>
                  <span>
                    {event.occurred_at === ""
                      ? EMPTY_TEXT
                      : dayjs(event.occurred_at.replace(" ", "T")).format(
                          "DD-MM-YYYY HH:mm",
                        )}{" "}
                    ·{" "}
                    {event.warehouse_code === ""
                      ? EMPTY_TEXT
                      : event.warehouse_code}
                  </span>
                  <b>{signed(event.qty_delta)}</b>
                </div>
              ))
            )}
          </div>
        </EvidenceModal>
      ) : null}
    </div>
  );
}
