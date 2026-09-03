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
import "./stock-reconcile-report.css";

/**
 * Nhãn hiển thị — chép nguyên `labels` của demo.
 *
 * CỐ Ý không đọc `INVENTORY_STOCK_STATUS_LABELS`: demo gọi DEFECTIVE là "Lỗi"
 * và QUARANTINE là "Cách ly", ngắn hơn nhãn dùng chung ("Hàng lỗi" / "Chờ kiểm
 * tra") vì chúng nằm trong thanh cơ cấu tồn có bề ngang hẹp. Yêu cầu là giống
 * demo 100%.
 */
const LABELS: Readonly<Record<string, string>> = {
  AVAILABLE: "Khả dụng",
  NON_SELLABLE: "Không thể bán/xuất",
  DEFECTIVE: "Lỗi",
  QUARANTINE: "Cách ly",
  PRODUCT: "Sản phẩm",
  COMPONENT: "Linh kiện",
};

/** Nhãn 4 phép kiểm §7.5 — hai mã đầu lấy từ demo, hai mã sau từ hợp đồng BE. */
const CHECK_LABELS: Readonly<Record<string, string>> = {
  ledger_to_balance: "Sổ cái ↔ số dư",
  serial_subledger: "Sổ serial",
  quantity_subledger: "Số lượng trong thùng",
  container_integrity: "Toàn vẹn thùng chứa",
};

/** Màu từng trạng thái tồn trong thanh cơ cấu — đúng bảng màu Vuexy của demo. */
const STATUS_COLORS: Readonly<Record<StockStatusCode, string>> = {
  AVAILABLE: "var(--wms-success)",
  NON_SELLABLE: "var(--wms-warning)",
  DEFECTIVE: "var(--wms-error)",
  QUARANTINE: "var(--wms-info)",
};

const KIND_OPTIONS = [
  { value: "all", label: "Tất cả loại hàng" },
  { value: "PRODUCT", label: "Sản phẩm" },
  { value: "COMPONENT", label: "Linh kiện" },
];

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
  if (status === "MATCH") return <span className="match-chip">Khớp</span>;
  if (status === "NOT_APPLICABLE") {
    return <span className="chip chip-neutral">Không áp dụng</span>;
  }
  return <span className="chip chip-error">Lệch</span>;
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

type NormState = "LOW" | "OVER" | "NORMAL" | "UNSET";

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

function NormStatusChip({ state }: { state: NormState }) {
  if (state === "LOW") return <span className="chip chip-error">Dưới Min</span>;
  if (state === "OVER") {
    return <span className="chip chip-warning">Vượt Max</span>;
  }
  if (state === "UNSET") {
    return <span className="chip chip-neutral">Chưa đặt định mức</span>;
  }
  return <span className="match-chip">Trong định mức</span>;
}

export default function StockReconcileReport() {
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
    .map(
      (item) =>
        `${LABELS[item.status]} ${fmt(item.value)} cái, ${percentText(item.value, summary.balance)}%`,
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
      return { tone: "page-alert is-info", body: <>Đang tải số liệu…</> };
    }
    if (snapshot.as_of_snapshot) {
      return {
        tone: "page-alert is-info",
        body: (
          <>
            Đang xem ảnh chụp theo sổ tại{" "}
            <strong>{asOf.format("DD-MM-YYYY")}</strong>. Số dư quá khứ không
            đối soát được với sổ hiện tại nên trạng thái đối soát hiển thị
            &quot;Không áp dụng&quot;.
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
        <div className="breadcrumb" aria-label="Đường dẫn">
          <span>Trang chủ</span>
          <span aria-hidden="true">/</span>
          <span>Báo cáo</span>
          <span aria-hidden="true">/</span>
          <strong>Tồn kho &amp; đối soát</strong>
        </div>

        <section className="page-header" aria-labelledby="rpt02-page-title">
          <div>
            <span className="eyebrow">BÁO CÁO VẬN HÀNH · RPT-02</span>
            <h1 id="rpt02-page-title">Báo cáo Tồn kho &amp; đối soát</h1>
            <p>
              Theo dõi số dư theo kho, trạng thái tồn và các điểm lệch cần xử lý
              trước khi ảnh hưởng vận hành.
            </p>
          </div>
          <div className="scope-block">
            <span className="chip chip-primary">
              {snapshot.warehouse_code === ""
                ? ALL_WAREHOUSES_LABEL
                : snapshot.warehouse_code}
            </span>
            <span className="chip chip-neutral">
              {isSuperAdmin ? "Super Admin" : "Người dùng vận hành"}
            </span>
            {mismatchedCount > 0 ? (
              <span className="chip chip-warning">Cần xử lý</span>
            ) : (
              <span className="chip chip-success">Đã khớp</span>
            )}
          </div>
        </section>

        <section
          className="filter-card report-filter-card"
          aria-label="Bộ lọc báo cáo"
        >
          <div className="filter-group">
            <span className="filter-label">Mốc đối soát</span>
            {/*
             * `maxDate` là hôm nay: mốc đối soát phải là ngày ĐÃ ghi sổ, chốt ở
             * tương lai thì không có số dư nào để đối chiếu.
             */}
            <UiVuexyDateField
              id="rpt02-as-of-date"
              field="as-of"
              aria-label="Mốc đối soát"
              value={asOf}
              maxDate={dayjs().startOf("day")}
              onChange={(value) => {
                if (value === null) return;
                setAsOf(value.startOf("day"));
              }}
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">Tìm SKU theo mã hoặc tên</span>
            <SearchInput
              width="100%"
              value={query}
              aria-label="Tìm SKU theo mã hoặc tên"
              placeholder="Mã SKU / tên SKU"
              onChange={setQuery}
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">Loại hàng</span>
            <UiSelect
              fullWidth
              aria-label="Loại hàng"
              value={kind}
              options={KIND_OPTIONS}
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
              {refreshing ? "Đang làm mới…" : "Làm mới"}
            </button>
            <div className="refresh-meta">
              <span>
                Dữ liệu lúc{" "}
                {snapshotMoment ? snapshotMoment.format("HH:mm") : EMPTY_TEXT}
              </span>
              <small>
                Đã ghi sổ đến{" "}
                {watermark && watermark.isValid()
                  ? watermark.format("DD-MM-YYYY")
                  : EMPTY_TEXT}
              </small>
            </div>
          </div>

          <div className="report-snapshot">
            Snapshot:{" "}
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
              <span className="eyebrow">TÌNH HÌNH HIỆN TẠI</span>
              <h2 id="rpt02-overview-title">Tổng quan tồn và đối soát</h2>
            </div>
            <span className="section-meta">
              {snapshot.warehouse_code === ""
                ? ALL_WAREHOUSES_LABEL
                : snapshot.warehouse_code}{" "}
              · Đơn vị: cái
            </span>
          </div>
          <div className="kpi-grid report-kpi-grid">
            <article
              className="card kpi-card report-kpi-card"
              data-tone="opening"
            >
              <div className="kpi-top">
                <span className="kpi-label">Tổng tồn hiện tại</span>
                <span className="kpi-icon" aria-hidden="true">
                  <VuexyDemoIcon name="warehouse" />
                </span>
              </div>
              <div className="kpi-value">{fmt(summary.balance)}</div>
              <div className="kpi-bottom">
                <span className="kpi-foot">Inventory Balance tại mốc chốt</span>
              </div>
            </article>
            <article
              className="card kpi-card report-kpi-card"
              data-tone="inbound"
            >
              <div className="kpi-top">
                <span className="kpi-label">Tồn khả dụng</span>
                <span className="kpi-icon" aria-hidden="true">
                  <VuexyDemoIcon name="package-plus" />
                </span>
              </div>
              <div className="kpi-value">{fmt(summary.available)}</div>
              <div className="kpi-bottom">
                <span className="kpi-foot">Available Qty từ Balance</span>
              </div>
            </article>
            <article
              className="card kpi-card report-kpi-card"
              data-tone="component"
            >
              <div className="kpi-top">
                <span className="kpi-label">Không thể bán/xuất</span>
                <span className="kpi-icon" aria-hidden="true">
                  <VuexyDemoIcon name="briefcase-medical" />
                </span>
              </div>
              <div className="kpi-value">{fmt(summary.nonSellable)}</div>
              <div className="kpi-bottom">
                <span className="kpi-foot">
                  Theo stock_status server trả về
                </span>
              </div>
            </article>
            <article
              className="card kpi-card report-kpi-card"
              data-tone="product"
            >
              <div className="kpi-top">
                <span className="kpi-label">Lỗi / cách ly</span>
                <span className="kpi-icon" aria-hidden="true">
                  <VuexyDemoIcon name="triangle-alert" />
                </span>
              </div>
              <div className="kpi-value">{fmt(summary.risk)}</div>
              <div className="kpi-bottom">
                <span className="kpi-foot">DEFECTIVE và QUARANTINE</span>
              </div>
            </article>
          </div>
        </section>

        {/* ── Cơ cấu và mức độ khớp ─────────────────────────────────────── */}
        <section aria-labelledby="rpt02-status-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">KIỂM SOÁT TỒN</span>
              <h2 id="rpt02-status-title">Cơ cấu và mức độ khớp</h2>
            </div>
            <span className="section-meta">
              Nguồn: Inventory Balance &amp; Inventory Movement
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
                    <h3>Cơ cấu tồn kho hiện tại</h3>
                    <span className="card-subtitle">
                      Tỉ trọng tồn theo trạng thái từ máy chủ
                    </span>
                  </div>
                </div>
                <div className="chart-head-meta">
                  <span className="chart-unit">Đơn vị: cái</span>
                  <span className="chart-current">
                    <small>Tổng tồn</small>
                    <strong>{fmt(summary.balance)}</strong>
                  </span>
                </div>
              </header>
              <div className="chart-wrap">
                <div className="chart-plot structure-plot">
                  <div
                    className="structure-chart"
                    role="img"
                    aria-label={`Cơ cấu tồn kho: ${structureAria}`}
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
                            {fmt(item.value)} cái{" "}
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
                <summary>Xem bảng dữ liệu thay thế</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Trạng thái</th>
                      <th>Số lượng</th>
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
                    <h3>Tỷ lệ đối soát</h3>
                    <span className="card-subtitle">
                      SKU khớp và lệch sau khi gộp trạng thái tồn
                    </span>
                  </div>
                </div>
                <div className="chart-head-meta">
                  {mismatchedCount > 0 ? (
                    <span className="chip chip-warning">Cần xử lý</span>
                  ) : (
                    <span className="chip chip-success">Đã khớp</span>
                  )}
                  <span className="chart-current">
                    <small>Tổng SKU</small>
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
                    MATCH {fmt(matchedCount)}
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
                    MISMATCH {fmt(mismatchedCount)}
                  </button>
                </div>
                <div className="chart-plot">
                  <svg
                    className="chart-svg"
                    viewBox="0 0 360 228"
                    role="img"
                    aria-label={`Biểu đồ tỷ lệ đối soát: ${fmt(shownMatched)} SKU khớp, ${fmt(shownMismatched)} SKU lệch`}
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
                      SKU đã kiểm tra
                    </text>
                  </svg>
                </div>
              </div>
              <details className="chart-table">
                <summary>Xem bảng dữ liệu thay thế</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Trạng thái</th>
                      <th>Số SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>MATCH</td>
                      <td>{fmt(matchedCount)}</td>
                    </tr>
                    <tr>
                      <td>MISMATCH</td>
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
              <span className="eyebrow">ĐIỂM LỆCH ƯU TIÊN</span>
              <h2 id="rpt02-variance-title">Top SKU chênh lệch đối soát</h2>
            </div>
            <span className="section-meta">
              Chênh lệch = Inventory Balance − Movement Calculated
            </span>
          </div>
          <article className="card report-table-card">
            <header className="card-head">
              <div>
                <h3>SKU cần làm rõ</h3>
                <span className="card-subtitle">
                  Chỉ hiển thị SKU có trạng thái MISMATCH trong snapshot.
                </span>
              </div>
              {varianceRows.length > 0 ? (
                <span className="chip chip-error">
                  {fmt(varianceRows.length)} SKU lệch
                </span>
              ) : (
                <span className="chip chip-success">Không có SKU lệch</span>
              )}
            </header>
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>SKU / Tên hàng</th>
                    <th>Balance</th>
                    <th>Movement</th>
                    <th>Chênh lệch</th>
                    <th>Lệch ở</th>
                    <th>Incident</th>
                  </tr>
                </thead>
                <tbody>
                  {varianceRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        Không có SKU lệch đối soát theo bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    varianceRows.map((item) => {
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
              <span className="eyebrow">CẢNH BÁO ĐỊNH MỨC</span>
              <h2 id="rpt02-norm-title">Kiểm soát lượng khả dụng</h2>
            </div>
            <span className="section-meta">
              So Available Qty với Min / Max theo SKU
            </span>
          </div>
          <article className="card report-table-card">
            <header className="card-head">
              <div>
                <h3>Danh sách định mức theo SKU</h3>
                <span className="card-subtitle">
                  Định mức lấy từ danh mục SKU; chỉ Available Qty được so sánh.
                </span>
              </div>
              {belowMinCount > 0 ? (
                <span className="chip chip-warning">
                  {fmt(belowMinCount)} dưới Min
                </span>
              ) : (
                <span className="chip chip-success">Không có SKU dưới Min</span>
              )}
            </header>
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>SKU / Tên hàng</th>
                    <th>Loại</th>
                    <th className="num">Available Qty</th>
                    <th className="num">Min Qty</th>
                    <th className="num">Max Qty</th>
                    <th className="num">Chênh lệch</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {normRows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        Không có SKU nào theo bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    normRows.map((row) => (
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
              <span className="eyebrow">DỮ LIỆU CHI TIẾT</span>
              <h2 id="rpt02-detail-title">Chi tiết tồn kho &amp; đối soát</h2>
            </div>
            <span className="section-meta">
              {fmt(rowsInScope.length)} dòng SKU × trạng thái tồn
            </span>
          </div>
          <article className="card report-table-card">
            <header className="card-head">
              <div>
                <h3>Dòng tồn kho theo trạng thái</h3>
                <span className="card-subtitle">
                  Một dòng là một bucket kho × SKU × trạng thái tồn; dùng Button
                  chuẩn để mở bằng chứng đối soát.
                </span>
              </div>
              <div
                className="report-view-tabs"
                role="tablist"
                aria-label="Chế độ xem dữ liệu"
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
                  Bảng
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
                  Lát cắt
                </button>
              </div>
            </header>

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
                      <th>SKU / loại hàng</th>
                      <th>Trạng thái tồn</th>
                      <th className="num">Balance Qty</th>
                      <th className="num">Ledger Qty</th>
                      <th className="num">Chênh lệch</th>
                      <th className="num">Available Qty</th>
                      <th>Trạng thái đối soát</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsInScope.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          Không có dòng tồn kho nào theo bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      rowsInScope.map((row, index) => (
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
                              aria-label={`Xem chi tiết đối soát ${row.sku_code}`}
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
                {rowsInScope.map((row) => (
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
                        <dt>Balance</dt>
                        <dd>{fmt(row.balance_qty)}</dd>
                      </div>
                      <div>
                        <dt>Ledger</dt>
                        <dd>{fmt(row.ledger_qty)}</dd>
                      </div>
                      <div>
                        <dt>Chênh</dt>
                        <dd>{signed(row.delta_qty)}</dd>
                      </div>
                      <div>
                        <dt>Available</dt>
                        <dd>{fmt(row.available_qty)}</dd>
                      </div>
                    </dl>
                    <button
                      className="button action-button"
                      type="button"
                      aria-label={`Xem chi tiết đối soát ${row.sku_code}`}
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
              <div className="eyebrow modal-eyebrow">Bằng chứng đối soát</div>
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
              <div className="meta-label">Balance Qty</div>
              <div className="meta-value">{fmt(drillRow.balance_qty)}</div>
            </div>
            <div>
              <div className="meta-label">Ledger Qty</div>
              <div className="meta-value">{fmt(drillRow.ledger_qty)}</div>
            </div>
            <div>
              <div className="meta-label">Available Qty</div>
              <div className="meta-value">{fmt(drillRow.available_qty)}</div>
            </div>
          </div>
          <div className="formula">
            Balance Qty {fmt(drillRow.balance_qty)} − Ledger Qty{" "}
            {fmt(drillRow.ledger_qty)} = Chênh lệch {signed(drillRow.delta_qty)}
            <br />
            <small>
              Kiểm tra lệch: {checkLabel(drillRow.mismatch_checks)} · Incident:{" "}
              {drillRow.incident_id ?? EMPTY_TEXT}
            </small>
          </div>
          <h3>Movement liên quan</h3>
          <div className="modal-events">
            {movementsLoading ? (
              <div>
                <span>Đang tải movement…</span>
              </div>
            ) : movementEvents.length === 0 ? (
              <div>
                <span>
                  Không có movement trong mẫu trace 90 ngày của SKU này.
                </span>
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
