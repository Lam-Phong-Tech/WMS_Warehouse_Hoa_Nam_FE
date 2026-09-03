/**
 * MÀN "BÁO CÁO NHẬP – XUẤT – TỒN" (RPT-01) — port 1:1 mockup UI/UX đã chốt
 * `8.1.WMS_Hoa_Nam_Bao_Cao_Xuat_Nhap_Ton.html`: cùng cấu trúc khối, cùng class,
 * cùng số đo (CSS port ở `./inventory-flow-report.css`), cùng hành vi
 * (`Other/Report01_HTML_Export/report-01-offline.js`).
 *
 * KHÁC MOCKUP Ở ĐÂU (và vì sao):
 *  · Mockup chạy trên một khối JSON cứng nhúng trong trang. Ở đây MỌI con số
 *    đến từ endpoint thật (xem `./inventory-flow-api.ts`); không KPI nào được
 *    suy diễn, nguồn nào chưa trả thì ô hiện "Chưa có" theo `EMPTY_TEXT`.
 *  · Mockup có ba nhóm nút CHẾT: bốn nút chú giải biểu đồ luồng, nút chú giải
 *    biểu đồ tồn cuối, và ô "Tìm SKU" không lọc gì. Bản này gắn hành vi thật
 *    cho tất cả (bật/tắt chuỗi; lọc bảng, lát cắt, KPI, phương trình và cả hai
 *    biểu đồ theo từ khoá).
 *  · BỘ LỌC DÙNG CONTROL CHUNG, KHÔNG PHẢI CONTROL TỰ DỰNG CỦA MOCKUP: hai ô
 *    "Kỳ báo cáo" là `UiVuexyDateField`, "Tìm SKU" là `SearchInput`, "Loại hàng" là
 *    `UiSelect` — cùng bộ với màn "Nhập liệu, đối chiếu & lỗi" (RPT-04). Yêu cầu
 *    người dùng 2026-09-03: thao tác trên 8 màn Báo cáo phải đồng bộ, nên lịch
 *    và listbox tự dựng của mockup (kèm chuyển động riêng của chúng) bị thay.
 *    Bố cục lưới của thanh lọc giữ NGUYÊN theo mockup.
 *  · Thêm `.page-alert` (đang tải / lỗi tải). Mockup không có vì dữ liệu của nó
 *    là hằng số; màn thật buộc phải nói ra khi số liệu chưa về hoặc gọi hỏng.
 *  · Ngày hiển thị theo quy chuẩn dd-mm-yyyy của dự án (`formatDate`) thay vì
 *    dd/mm/yyyy của mockup — cùng quy ước với RPT-02..RPT-07 và mọi màn khác.
 *  · Đường sparkline trong thẻ KPI: mockup vẽ hình trang trí cứng. Ở đây mỗi
 *    thẻ vẽ đúng chuỗi theo ngày của CHÍNH chỉ số đó; kỳ không có ngày nào có
 *    số liệu thì không vẽ (thà trống còn hơn một đường bịa).
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import dayjs from "dayjs";
import { UiSelect, UiVuexyDateField, VuexyDemoIcon } from "@/shared/ui";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useAuthStore } from "@/shared/store/auth.store";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { axisDayLabel, fmt } from "@/modules/reports/operations/report-format";
import {
  MOVEMENT_LABELS,
  reportStatusLabel,
} from "@/modules/reports/operations/report-labels";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { InventoryFlowChart } from "./inventory-flow-chart";
import { DrillDownModal, ModalCloseButton } from "./inventory-flow-overlays";
import {
  ALL_WAREHOUSES_LABEL,
  closingOf,
  INVENTORY_FLOW_REPORT_CODE,
  INVENTORY_FLOW_TIMEZONE,
  ISO_DATE,
  sumRows,
  useInventoryFlowSnapshot,
  type FlowDocument,
  type XntRow,
} from "./inventory-flow-api";
import "./inventory-flow-report.css";

/** Nhãn loại hàng — chép nguyên cột "Loại" của mockup. */
const KIND_LABELS: Readonly<Record<string, string>> = {
  PRODUCT: "Sản phẩm",
  COMPONENT: "Linh kiện",
};

const KIND_OPTIONS = [
  { value: "all", label: "Tất cả loại hàng" },
  { value: "PRODUCT", label: "Sản phẩm" },
  { value: "COMPONENT", label: "Linh kiện" },
];

/**
 * Bốn màu nét vẽ của biểu đồ luồng — giá trị THẬT khai trong
 * `./inventory-flow-report.css` (`--hnf-chart-*`), ở đây chỉ tham chiếu biến
 * nên màu vẫn là một nguồn duy nhất cùng chỗ với phần còn lại của bản port.
 */
const FLOW_COLORS = {
  inbound: "var(--hnf-chart-inbound)",
  product: "var(--hnf-chart-product)",
  component: "var(--hnf-chart-component)",
  reversal: "var(--hnf-chart-reversal)",
} as const;

/** Màu nét biểu đồ "Xu hướng tồn cuối ngày". */
const CLOSING_COLOR = "var(--hnf-chart-closing)";

/** Dấu trừ của mockup là U+2212, không phải dấu gạch nối. */
const MINUS = "−";

type ViewMode = "table" | "snapshot";

type SeriesKey = "inbound" | "product" | "component" | "reversal";

/** Khung sparkline `viewBox="0 0 46 18"` của mockup. */
const SPARK = { left: 2, right: 44, top: 4, bottom: 15 };

/**
 * Polyline của một chuỗi trong khung sparkline.
 *
 * Chuỗi phẳng (mọi giá trị bằng nhau, kể cả toàn 0) vẽ thành đường giữa khung —
 * đúng nghĩa "không biến động", không phải một hình bịa.
 */
function sparkPoints(values: number[]): string | null {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  return values
    .map((value, index) => {
      const x =
        SPARK.left + ((SPARK.right - SPARK.left) * index) / (values.length - 1);
      const y =
        span === 0
          ? (SPARK.top + SPARK.bottom) / 2
          : SPARK.bottom - ((value - min) / span) * (SPARK.bottom - SPARK.top);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function KpiSpark({ values }: { values: number[] }) {
  const points = sparkPoints(values);
  if (points === null) return null;
  return (
    <span className="kpi-spark" aria-hidden="true">
      <svg viewBox="0 0 46 18">
        <polyline points={points} />
      </svg>
    </span>
  );
}

type KpiTone =
  | "opening"
  | "inbound"
  | "product"
  | "component"
  | "reversal"
  | "closing";

type VuexyIconName = Parameters<typeof VuexyDemoIcon>[0]["name"];

function KpiCard({
  tone,
  icon,
  label,
  value,
  foot,
  spark,
}: {
  tone: KpiTone;
  icon: VuexyIconName;
  label: string;
  value: number;
  foot: string;
  spark: number[];
}) {
  return (
    <article className="card kpi-card report-kpi-card" data-tone={tone}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon" aria-hidden="true">
          <VuexyDemoIcon name={icon} />
        </span>
      </div>
      <div className="kpi-value">{fmt(value)}</div>
      <div className="kpi-bottom">
        <span className="kpi-foot">{foot}</span>
        <KpiSpark values={spark} />
      </div>
    </article>
  );
}

function EquationItem({
  tone,
  operator,
  label,
  impact,
  value,
  result = false,
}: {
  tone: KpiTone;
  operator?: string;
  label: string;
  impact: string;
  value: number;
  result?: boolean;
}) {
  return (
    <article
      className={result ? "equation-item result" : "equation-item"}
      data-tone={tone}
      data-operator={operator}
    >
      <div className="equation-item-head">
        <span className="equation-label">{label}</span>
        <span className="equation-impact">{impact}</span>
      </div>
      <strong className="equation-value">{fmt(value)}</strong>
    </article>
  );
}

/** Ba biến thể thẻ chứng từ của mockup, khoá theo loại chứng từ. */
const DOCUMENT_STYLE: Readonly<
  Record<
    FlowDocument["doc_type"],
    { className: string; icon: VuexyIconName; title: string }
  >
> = {
  INBOUND: {
    className: "insight-card-warranty",
    icon: "package-plus",
    title: "Phiếu nhập",
  },
  OUTBOUND: {
    className: "insight-card-ranking",
    icon: "package-minus",
    title: "Phiếu xuất",
  },
  REVERSAL: {
    className: "insight-card-quality",
    icon: "refresh-cw",
    title: "Phiếu hoàn tác",
  },
};

export default function InventoryFlowXntReport() {
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);

  /**
   * Kỳ mặc định: hôm qua → hôm nay, đúng bề rộng kỳ mà mockup mở sẵn
   * (01/09 → 02/09 với `as_of` là 02/09).
   */
  const [range, setRange] = useState(() => ({
    from: dayjs().subtract(1, "day").startOf("day"),
    to: dayjs().startOf("day"),
  }));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [view, setView] = useState<ViewMode>("table");
  /** Bốn chú giải của biểu đồ luồng — mockup để nút chết, đây bật/tắt thật. */
  const [flowSeries, setFlowSeries] = useState<Record<SeriesKey, boolean>>({
    inbound: true,
    product: true,
    component: true,
    reversal: true,
  });
  const [closingVisible, setClosingVisible] = useState(true);

  /**
   * Dòng đang mở hộp thoại được CHỤP tại thời điểm bấm (mockup cũng vậy:
   * `payload.xntRows.find(...)` chạy trong handler), nên đổi bộ lọc phía sau
   * không làm nội dung hộp thoại nhảy số.
   */
  const [drill, setDrill] = useState<{
    row: XntRow;
    trigger: HTMLElement;
  } | null>(null);

  const { snapshot, loading, fetching, error, refetch } =
    useInventoryFlowSnapshot({
      from: range.from.format(ISO_DATE),
      to: range.to.format(ISO_DATE),
    });

  // ── Tập dòng trong phạm vi bộ lọc ──────────────────────────────────────
  const rowsInScope = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.rows.filter((row) => {
      const byKind = kind === "all" || row.sku_type === kind;
      const haystack = `${row.sku_code} ${row.sku_name}`.toLowerCase();
      return byKind && haystack.includes(needle);
    });
  }, [snapshot.rows, kind, query]);

  /** Sáu con số của KPI và của phương trình — cùng một phép cộng. */
  const summary = useMemo(() => sumRows(rowsInScope), [rowsInScope]);

  /** Mã SKU còn trong phạm vi lọc — dùng để cắt luôn hai biểu đồ theo ngày. */
  const codesInScope = useMemo(
    () => new Set(rowsInScope.map((row) => row.sku_code)),
    [rowsInScope],
  );
  const filtered = kind !== "all" || query.trim() !== "";

  /**
   * Chuỗi theo ngày của kỳ, đã cắt theo bộ lọc.
   *
   * Khi có lọc thì phải dựng lại từ ledger (chuỗi tổng của snapshot bao mọi
   * SKU); không lọc thì dùng thẳng chuỗi đã tính sẵn ở adapter.
   */
  const daily = useMemo(() => {
    if (!filtered) return snapshot.daily;
    const typeById = new Map(
      snapshot.ledger.map((row) => [row.movement_id, row.movement_type]),
    );
    const byDate = new Map<
      string,
      {
        date: string;
        inbound: number;
        product: number;
        component: number;
        reversal: number;
        closing: number;
      }
    >();
    for (const point of snapshot.daily) {
      byDate.set(point.date, {
        date: point.date,
        inbound: 0,
        product: 0,
        component: 0,
        reversal: 0,
        closing: 0,
      });
    }
    for (const row of snapshot.ledger) {
      if (!codesInScope.has(row.sku_code)) continue;
      const date = row.posted_at.slice(0, 10);
      const point = byDate.get(date);
      if (point === undefined) continue;
      if (row.movement_type === "RECEIPT") point.inbound += row.qty_delta;
      else if (row.movement_type === "ISSUE") point.product += -row.qty_delta;
      else if (row.movement_type === "COMPONENT_ISSUE")
        point.component += -row.qty_delta;
      else if (row.movement_type === "REVERSAL") {
        const origin = typeById.get(row.reversal_of_movement_id);
        if (origin === "RECEIPT") point.inbound += row.qty_delta;
        else if (origin === "ISSUE") point.product -= row.qty_delta;
        else if (origin === "COMPONENT_ISSUE") point.component -= row.qty_delta;
        else point.reversal += row.qty_delta;
      }
    }
    const points = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    let running = summary.opening;
    for (const point of points) {
      running +=
        point.inbound - point.product - point.component + point.reversal;
      point.closing = running;
    }
    return points;
  }, [
    filtered,
    snapshot.daily,
    snapshot.ledger,
    codesInScope,
    summary.opening,
  ]);

  const axisLabels = useMemo(
    () => daily.map((point) => axisDayLabel(point.date)),
    [daily],
  );

  /** Sparkline "Tồn đầu kỳ": số dư mở của TỪNG ngày trong kỳ. */
  const openingSpark = useMemo(() => {
    const values = [summary.opening];
    for (let index = 0; index < daily.length - 1; index += 1) {
      values.push(daily[index].closing);
    }
    return values;
  }, [daily, summary.opening]);

  // ── Đối soát phương trình của cả kỳ ────────────────────────────────────
  const expectedClosing =
    summary.opening +
    summary.receiptNet -
    summary.issueNet -
    summary.componentNet +
    summary.reversalUnlinked;
  const periodDelta = summary.closing - expectedClosing;
  const periodMatched = Math.abs(periodDelta) <= 1e-6;
  const allRowsMatched = rowsInScope.every((row) => row.matched);

  // ── Chứng từ trong phạm vi lọc ─────────────────────────────────────────
  const documentsInScope = useMemo(() => {
    if (!filtered) return snapshot.documents;
    return snapshot.documents.filter(
      (document) =>
        document.drillKey !== "" && codesInScope.has(document.drillKey),
    );
  }, [filtered, snapshot.documents, codesInScope]);

  // ── Hộp thoại đối soát ─────────────────────────────────────────────────
  const drillRow = drill?.row ?? null;
  const drillMovements = useMemo(
    () =>
      drillRow === null
        ? []
        : snapshot.ledger.filter((row) => row.sku_code === drillRow.sku_code),
    [snapshot.ledger, drillRow],
  );

  const closeDrill = () => {
    drill?.trigger.focus({ preventScroll: true });
    setDrill(null);
  };

  const openDrill = (skuCode: string, trigger: HTMLElement) => {
    const row = snapshot.rows.find((item) => item.sku_code === skuCode);
    if (row === undefined) return;
    setDrill({ row, trigger });
  };

  /**
   * Nút "Làm mới" (`offline-reset` của mockup) đưa MỌI bộ lọc về mặc định rồi
   * vẽ lại; ở đây thêm một lượt gọi lại số liệu vì dữ liệu là thật.
   */
  const resetFilters = useCallback(() => {
    setRange({
      from: dayjs().subtract(1, "day").startOf("day"),
      to: dayjs().startOf("day"),
    });
    setQuery("");
    setKind("all");
    setView("table");
    setFlowSeries({
      inbound: true,
      product: true,
      component: true,
      reversal: true,
    });
    setClosingVisible(true);
  }, []);

  const { refreshing, refresh } = useReportRefresh({
    refetch,
    readError: () => error,
    beforeRefetch: resetFilters,
  });

  // Đổi tab bằng bàn phím thì focus phải đi theo tab đang chọn (như mockup).
  const tableTabRef = useRef<HTMLButtonElement>(null);
  const snapshotTabRef = useRef<HTMLButtonElement>(null);

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

  const asOf = snapshot.as_of === "" ? null : dayjs(snapshot.as_of);
  const watermark =
    snapshot.source_watermark === ""
      ? null
      : dayjs(snapshot.source_watermark.replace(" ", "T"));
  const warehouseLabel =
    snapshot.warehouse_code === ""
      ? ALL_WAREHOUSES_LABEL
      : snapshot.warehouse_code;

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
    if (!periodMatched) {
      return {
        tone: "page-alert",
        body: (
          <>
            Tồn cuối kỳ máy chủ trả về lệch <strong>{fmt(periodDelta)}</strong>{" "}
            so với phương trình cân đối của kỳ. Số liệu vẫn hiển thị nguyên như
            máy chủ trả về; cần đối soát lại sổ trước khi dùng.
          </>
        ),
      };
    }
    return null;
  })();

  /** Bốn chuỗi của biểu đồ luồng, đã lọc theo chú giải đang bật. */
  const flowChartSeries = (
    [
      { key: "inbound", label: "Nhập", color: FLOW_COLORS.inbound },
      { key: "product", label: "Xuất SP", color: FLOW_COLORS.product },
      { key: "component", label: "Xuất LK", color: FLOW_COLORS.component },
      { key: "reversal", label: "Hoàn tác", color: FLOW_COLORS.reversal },
    ] as Array<{ key: SeriesKey; label: string; color: string }>
  )
    .filter((item) => flowSeries[item.key])
    .map((item) => ({
      key: item.key,
      label: item.label,
      color: item.color,
      values: daily.map((point) => point[item.key]),
    }));

  const hasDays = daily.length > 0;

  const periodMeta = `Kỳ ${formatDate(range.from.toISOString())} – ${formatDate(
    range.to.toISOString(),
  )} · Đơn vị: cái`;

  return (
    <div className="hn-rpt01" data-mvp-screen="RPT-01">
      <div className="page-wrap">
        <div className="breadcrumb" aria-label="Đường dẫn">
          <span>Trang chủ</span>
          <span aria-hidden="true">/</span>
          <span>Báo cáo</span>
          <span aria-hidden="true">/</span>
          <strong>Nhập – Xuất – Tồn</strong>
        </div>

        <section className="page-header" aria-labelledby="rpt01-page-title">
          <div>
            <span className="eyebrow">
              BÁO CÁO VẬN HÀNH · {INVENTORY_FLOW_REPORT_CODE}
            </span>
            <h1 id="rpt01-page-title">Báo cáo Nhập – Xuất – Tồn</h1>
            <p>
              Cân đối tồn đầu, phát sinh đã ghi sổ và tồn cuối theo kỳ. Dữ liệu
              chưa ghi sổ không được tính vào tồn kho.
            </p>
          </div>
          <div className="scope-block">
            <span className="chip chip-primary">{warehouseLabel}</span>
            <span className="chip chip-neutral">
              {isSuperAdmin ? "Super Admin" : "Người dùng vận hành"}
            </span>
            {error !== null && error !== undefined ? (
              <span className="chip chip-error">Lỗi tải dữ liệu</span>
            ) : fetching ? (
              <span className="chip chip-warning">Đang cập nhật</span>
            ) : (
              <span className="chip chip-success">Dữ liệu mới</span>
            )}
          </div>
        </section>

        <section
          className="filter-card report-filter-card"
          aria-label="Bộ lọc báo cáo"
        >
          <div className="filter-group">
            <span className="filter-label">Kỳ báo cáo</span>
            <div className="report-date-range">
              {/*
               * `maxDate` / `minDate` khoá chéo hai ô: kỳ đảo chiều bị BE trả
               * 422, chặn ngay ở lịch thì người dùng không chọn ra được một
               * khoảng không hợp lệ.
               */}
              <UiVuexyDateField
                id="rpt01-from-date"
                field="from"
                aria-label="Ngày bắt đầu kỳ"
                value={range.from}
                maxDate={range.to}
                onChange={(value) => {
                  if (value === null) return;
                  setRange((current) => ({
                    ...current,
                    from: value.startOf("day"),
                  }));
                }}
              />
              <UiVuexyDateField
                id="rpt01-to-date"
                field="to"
                aria-label="Ngày kết thúc kỳ"
                value={range.to}
                minDate={range.from}
                onChange={(value) => {
                  if (value === null) return;
                  setRange((current) => ({
                    ...current,
                    to: value.startOf("day"),
                  }));
                }}
              />
            </div>
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
                Dữ liệu lúc {asOf ? asOf.format("HH:mm") : EMPTY_TEXT}
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
            · {fmt(rowsInScope.length)} SKU · {INVENTORY_FLOW_TIMEZONE}
          </div>
        </section>

        {pageAlert ? (
          <div className={pageAlert.tone} role="note">
            {pageAlert.body}
          </div>
        ) : null}

        {/* ── Tổng quan cân đối ─────────────────────────────────────────── */}
        <section aria-labelledby="rpt01-quick-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TÌNH HÌNH HIỆN TẠI</span>
              <h2 id="rpt01-quick-title">Tổng quan cân đối</h2>
            </div>
            <span className="section-meta">{periodMeta}</span>
          </div>
          <div className="kpi-grid report-kpi-grid">
            <KpiCard
              tone="opening"
              icon="warehouse"
              label="Tồn đầu kỳ"
              value={summary.opening}
              foot="Số dư mở trước ngày bắt đầu kỳ"
              spark={openingSpark}
            />
            <KpiCard
              tone="inbound"
              icon="package-plus"
              label="Nhập đã Post"
              value={summary.receiptNet}
              foot="Đã trừ phần nhập bị đảo"
              spark={daily.map((point) => point.inbound)}
            />
            <KpiCard
              tone="product"
              icon="package-minus"
              label="Xuất sản phẩm"
              value={summary.issueNet}
              foot="Xuất bán / giao đã ghi nhận"
              spark={daily.map((point) => point.product)}
            />
            <KpiCard
              tone="component"
              icon="briefcase-medical"
              label="Xuất linh kiện"
              value={summary.componentNet}
              foot="Linh kiện bảo hành đã Post"
              spark={daily.map((point) => point.component)}
            />
            <KpiCard
              tone="reversal"
              icon="refresh-cw"
              label="Ảnh hưởng hoàn tác (+/−)"
              value={summary.reversalUnlinked}
              foot="Điều chỉnh ngoài cột nguồn"
              spark={daily.map((point) => point.reversal)}
            />
            <KpiCard
              tone="closing"
              icon="warehouse"
              label="Tồn cuối kỳ"
              value={summary.closing}
              foot="Số dư chốt theo phương trình cân đối"
              spark={daily.map((point) => point.closing)}
            />
          </div>
        </section>

        {/* ── Cân đối tồn theo kỳ ───────────────────────────────────────── */}
        <section aria-labelledby="rpt01-reconcile-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ĐỐI SOÁT TỒN</span>
              <h2 id="rpt01-reconcile-title">Cân đối tồn theo kỳ</h2>
            </div>
            <span className="section-meta">Công thức chốt theo từng SKU</span>
          </div>
          <article className="card equation-card">
            <EquationItem
              tone="opening"
              label="Tồn đầu kỳ"
              impact="Số dư mở kỳ"
              value={summary.opening}
            />
            <EquationItem
              tone="inbound"
              operator="+"
              label="Nhập đã Post"
              impact="Tăng tồn"
              value={summary.receiptNet}
            />
            <EquationItem
              tone="product"
              operator={MINUS}
              label="Xuất sản phẩm"
              impact="Giảm tồn"
              value={summary.issueNet}
            />
            <EquationItem
              tone="component"
              operator={MINUS}
              label="Xuất linh kiện"
              impact="Giảm tồn"
              value={summary.componentNet}
            />
            <EquationItem
              tone="reversal"
              operator="+"
              label="Ảnh hưởng hoàn tác (+/−)"
              impact="Điều chỉnh tồn"
              value={summary.reversalUnlinked}
            />
            <EquationItem
              tone="closing"
              operator="="
              label="Tồn cuối kỳ"
              impact="Số dư chốt kỳ"
              value={summary.closing}
              result
            />
            <div className="equation-note">
              <div className="equation-formula">
                <span className="equation-note-label">Công thức đối soát</span>
                <strong>
                  {fmt(summary.opening)} + {fmt(summary.receiptNet)} {MINUS}{" "}
                  {fmt(summary.issueNet)} {MINUS} {fmt(summary.componentNet)} +{" "}
                  {fmt(summary.reversalUnlinked)} = {fmt(expectedClosing)}
                </strong>
              </div>
              <div
                className={
                  periodMatched
                    ? "equation-status"
                    : "equation-status is-mismatch"
                }
              >
                <span className="equation-status-icon" aria-hidden="true">
                  <VuexyDemoIcon
                    name={periodMatched ? "circle-dot" : "triangle-alert"}
                  />
                </span>
                <div>
                  <span>Trạng thái đối soát</span>
                  <strong>
                    {periodMatched ? "Đã khớp" : "Lệch"} · Chênh lệch{" "}
                    {fmt(periodDelta)}
                  </strong>
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* ── Chi tiết cân đối tồn kho ──────────────────────────────────── */}
        <section aria-labelledby="rpt01-detail-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PHÂN TÍCH THEO SKU</span>
              <h2 id="rpt01-detail-title">Chi tiết cân đối tồn kho</h2>
            </div>
            <span className="section-meta">
              {fmt(rowsInScope.length)} SKU trong snapshot
            </span>
          </div>
          <article className="card report-table-card">
            <header className="card-head">
              <div>
                <h3>Đối chiếu từng SKU</h3>
                <span className="card-subtitle">
                  Bảng mặc định và lát cắt dùng cùng dữ liệu, cùng khóa
                  drill-down.
                </span>
              </div>
              {allRowsMatched ? (
                <span className="chip chip-success">Khớp công thức</span>
              ) : (
                <span className="chip chip-error">Lệch công thức</span>
              )}
            </header>

            <div
              className="report-view-tabs"
              role="tablist"
              aria-label="Chế độ đối soát"
            >
              <button
                ref={tableTabRef}
                id="rpt01-tab-table"
                className={
                  view === "table"
                    ? "button button-primary"
                    : "button button-ghost"
                }
                type="button"
                role="tab"
                aria-selected={view === "table"}
                aria-controls="rpt01-panel-table"
                tabIndex={view === "table" ? 0 : -1}
                onClick={() => setView("table")}
                onKeyDown={onTabKeyDown}
              >
                <VuexyDemoIcon name="chart-column-big" />
                Bảng
              </button>
              <button
                ref={snapshotTabRef}
                id="rpt01-tab-snapshot"
                className={
                  view === "snapshot"
                    ? "button button-primary"
                    : "button button-ghost"
                }
                type="button"
                role="tab"
                aria-selected={view === "snapshot"}
                aria-controls="rpt01-panel-snapshot"
                tabIndex={view === "snapshot" ? 0 : -1}
                onClick={() => setView("snapshot")}
                onKeyDown={onTabKeyDown}
              >
                <VuexyDemoIcon name="grid-2x2-plus" />
                Lát cắt
              </button>
            </div>

            <div
              id="rpt01-panel-table"
              role="tabpanel"
              aria-labelledby="rpt01-tab-table"
              hidden={view !== "table"}
            >
              <div className="table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>SKU / Tên hàng</th>
                      <th>Loại</th>
                      <th>Đơn vị</th>
                      <th className="num">Đầu kỳ</th>
                      <th className="num">Nhập thuần</th>
                      <th className="num">Xuất SP</th>
                      <th className="num">Xuất LK</th>
                      <th className="num">Hoàn tác</th>
                      <th className="num">Cuối kỳ</th>
                      <th>Đối soát</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rowsInScope.length === 0 ? (
                      <tr>
                        <td className="table-empty" colSpan={11}>
                          {loading
                            ? "Đang tải số liệu…"
                            : "Không có SKU nào trong kỳ và bộ lọc đang chọn."}
                        </td>
                      </tr>
                    ) : (
                      rowsInScope.map((row) => (
                        <tr key={row.sku_code}>
                          <td>
                            <span className="sku">{row.sku_code}</span>
                            <div className="truncate" title={row.sku_name}>
                              {row.sku_name === "" ? EMPTY_TEXT : row.sku_name}
                            </div>
                          </td>
                          <td>{KIND_LABELS[row.sku_type] ?? EMPTY_TEXT}</td>
                          <td>{row.unit === "" ? EMPTY_TEXT : row.unit}</td>
                          <td className="num">{fmt(row.opening)}</td>
                          <td className="num">{fmt(row.receipt_net)}</td>
                          <td className="num">{fmt(row.issue_net)}</td>
                          <td className="num">
                            {fmt(row.component_issue_net)}
                          </td>
                          <td className="num">
                            {fmt(row.reversal_unlinked_net)}
                          </td>
                          <td className="num">
                            <strong>{fmt(row.closing)}</strong>
                          </td>
                          <td>
                            {row.matched ? (
                              <span className="match-chip">Khớp</span>
                            ) : (
                              <span className="chip chip-error">Lệch</span>
                            )}
                          </td>
                          <td className="num">
                            <button
                              className="mini-action"
                              type="button"
                              onClick={(event) =>
                                openDrill(row.sku_code, event.currentTarget)
                              }
                            >
                              Đối soát
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
              id="rpt01-panel-snapshot"
              role="tabpanel"
              aria-labelledby="rpt01-tab-snapshot"
              hidden={view !== "snapshot"}
            >
              {rowsInScope.length === 0 ? (
                <div className="state-box">
                  <strong>Chưa có SKU nào để đối soát</strong>
                  <span>
                    Đổi kỳ báo cáo hoặc bỏ bớt bộ lọc để xem lát cắt theo SKU.
                  </span>
                </div>
              ) : (
                <div className="report-snapshot-grid">
                  {rowsInScope.map((row) => (
                    <article className="report-slice" key={row.sku_code}>
                      <div className="report-slice-head">
                        <div>
                          <strong>
                            {row.sku_code} ·{" "}
                            {row.sku_name === "" ? EMPTY_TEXT : row.sku_name}
                          </strong>
                          <span>
                            {KIND_LABELS[row.sku_type] ?? EMPTY_TEXT} ·{" "}
                            {row.warehouse_code === ""
                              ? EMPTY_TEXT
                              : row.warehouse_code}
                          </span>
                        </div>
                        {row.matched ? (
                          <span className="match-chip">Khớp</span>
                        ) : (
                          <span className="chip chip-error">Lệch</span>
                        )}
                      </div>
                      <dl className="report-slice-values">
                        <div>
                          <dt>Tồn đầu</dt>
                          <dd>{fmt(row.opening)}</dd>
                        </div>
                        <div>
                          <dt>Nhập thuần</dt>
                          <dd>{fmt(row.receipt_net)}</dd>
                        </div>
                        <div>
                          <dt>Xuất SP</dt>
                          <dd>{fmt(row.issue_net)}</dd>
                        </div>
                        <div>
                          <dt>Xuất LK</dt>
                          <dd>{fmt(row.component_issue_net)}</dd>
                        </div>
                        <div>
                          <dt>Tồn cuối</dt>
                          <dd>{fmt(row.closing)}</dd>
                        </div>
                      </dl>
                      <button
                        className="mini-action"
                        type="button"
                        onClick={(event) =>
                          openDrill(row.sku_code, event.currentTarget)
                        }
                      >
                        Đối soát SKU
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </article>
        </section>

        {/* ── Luồng và xu hướng ─────────────────────────────────────────── */}
        <section aria-labelledby="rpt01-analysis-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PHÂN TÍCH VẬN HÀNH</span>
              <h2 id="rpt01-analysis-title">Luồng và xu hướng</h2>
            </div>
            <span className="section-meta">
              Chỉ hiển thị dữ liệu thực tế đã ghi sổ
            </span>
          </div>
          <div className="analysis-grid">
            <article
              className="card chart-card report-chart-card"
              data-chart-series="movement"
            >
              <header className="card-head chart-card-head">
                <div className="chart-heading">
                  <span className="chart-icon" aria-hidden="true">
                    <VuexyDemoIcon name="chart-column-big" />
                  </span>
                  <div>
                    <h3>Luồng nhập – xuất theo ngày</h3>
                    <span className="card-subtitle">
                      Biến động ròng của 4 nhóm nghiệp vụ
                    </span>
                  </div>
                </div>
                <div className="chart-head-meta">
                  <span className="chart-unit">Đơn vị: cái</span>
                  <span className="chart-current">
                    <small>Nhập thuần</small>
                    <strong>{fmt(summary.receiptNet)}</strong>
                  </span>
                </div>
              </header>
              <div className="chart-wrap">
                <div className="chart-legend">
                  {(
                    [
                      { key: "inbound", label: "Nhập", dot: "legend-inbound" },
                      {
                        key: "product",
                        label: "Xuất SP",
                        dot: "legend-product",
                      },
                      {
                        key: "component",
                        label: "Xuất LK",
                        dot: "legend-component",
                      },
                      {
                        key: "reversal",
                        label: "Hoàn tác",
                        dot: "legend-reversal",
                      },
                    ] as Array<{ key: SeriesKey; label: string; dot: string }>
                  ).map((item) => (
                    <button
                      key={item.key}
                      className="legend-button"
                      type="button"
                      aria-pressed={flowSeries[item.key]}
                      onClick={() =>
                        setFlowSeries((current) => ({
                          ...current,
                          [item.key]: !current[item.key],
                        }))
                      }
                    >
                      <span
                        className={`legend-dot ${item.dot}`}
                        aria-hidden="true"
                      />
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="chart-plot">
                  {hasDays ? (
                    <InventoryFlowChart
                      labels={axisLabels}
                      series={flowChartSeries}
                      ariaLabel="Biểu đồ luồng nhập xuất theo ngày"
                    />
                  ) : (
                    <div className="chart-empty">
                      Không có movement nào đã ghi sổ trong kỳ đang chọn.
                    </div>
                  )}
                </div>
              </div>
              <details className="chart-table">
                <summary>Xem bảng dữ liệu thay thế</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Nhập</th>
                      <th>Xuất SP</th>
                      <th>Xuất LK</th>
                      <th>Hoàn tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((point) => (
                      <tr key={point.date}>
                        <td>{axisDayLabel(point.date)}</td>
                        <td>{fmt(point.inbound)}</td>
                        <td>{fmt(point.product)}</td>
                        <td>{fmt(point.component)}</td>
                        <td>{fmt(point.reversal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </article>

            <article
              className="card chart-card report-chart-card"
              data-chart-series="closing"
            >
              <header className="card-head chart-card-head">
                <div className="chart-heading">
                  <span
                    className="chart-icon chart-icon-success"
                    aria-hidden="true"
                  >
                    <VuexyDemoIcon name="warehouse" />
                  </span>
                  <div>
                    <h3>Xu hướng tồn cuối ngày</h3>
                    <span className="card-subtitle">
                      Số liệu đã chốt theo từng ngày
                    </span>
                  </div>
                </div>
                <div className="chart-head-meta">
                  {periodMatched ? (
                    <span className="chip chip-success">Đã khớp</span>
                  ) : (
                    <span className="chip chip-error">Lệch</span>
                  )}
                  <span className="chart-current">
                    <small>Tồn cuối</small>
                    <strong>{fmt(summary.closing)}</strong>
                  </span>
                </div>
              </header>
              <div className="chart-wrap">
                <div className="chart-legend">
                  <button
                    className="legend-button"
                    type="button"
                    aria-pressed={closingVisible}
                    onClick={() => setClosingVisible((open) => !open)}
                  >
                    <span
                      className="legend-dot legend-reversal"
                      aria-hidden="true"
                    />
                    Tồn cuối ngày
                  </button>
                </div>
                <div className="chart-plot">
                  {hasDays ? (
                    <InventoryFlowChart
                      labels={axisLabels}
                      series={
                        closingVisible
                          ? [
                              {
                                key: "closing",
                                label: "Tồn cuối ngày",
                                color: CLOSING_COLOR,
                                values: daily.map((point) => point.closing),
                              },
                            ]
                          : []
                      }
                      filled
                      gradientId="rpt01-closing-fill"
                      labelBelow
                      strokeWidth={3}
                      ariaLabel="Biểu đồ tồn cuối ngày"
                    />
                  ) : (
                    <div className="chart-empty">
                      Không có ngày nào đã chốt số trong kỳ đang chọn.
                    </div>
                  )}
                </div>
              </div>
              <details className="chart-table">
                <summary>Xem bảng dữ liệu thay thế</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Tồn cuối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((point) => (
                      <tr key={point.date}>
                        <td>{axisDayLabel(point.date)}</td>
                        <td>{fmt(point.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </article>
          </div>
        </section>

        {/* ── Lịch sử chứng từ ──────────────────────────────────────────── */}
        <section aria-labelledby="rpt01-documents-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THEO DÕI BỔ SUNG</span>
              <h2 id="rpt01-documents-title">Lịch sử chứng từ</h2>
            </div>
            <span className="section-meta">
              {fmt(documentsInScope.length)} chứng từ trong snapshot
            </span>
          </div>
          {documentsInScope.length === 0 ? (
            <article className="card insight-card report-document-card">
              <div className="state-box">
                <strong>Chưa có chứng từ nào đã ghi sổ trong kỳ</strong>
                <span>
                  Nguồn: /reports/document-history và /reversal-documents.
                </span>
              </div>
            </article>
          ) : (
            <div className="insight-grid">
              {documentsInScope.map((document) => {
                const style = DOCUMENT_STYLE[document.doc_type];
                return (
                  <article
                    key={`${document.doc_type}-${document.id}`}
                    className={`card insight-card ${style.className} report-document-card`}
                  >
                    <header className="card-head insight-card-head">
                      <div className="insight-heading">
                        <span className="insight-icon" aria-hidden="true">
                          <VuexyDemoIcon name={style.icon} />
                        </span>
                        <div>
                          <span className="eyebrow">NHẬT KÝ NGHIỆP VỤ</span>
                          <h3>{document.document_no}</h3>
                          <span className="card-subtitle">
                            {style.title} · {reportStatusLabel(document.status)}
                          </span>
                        </div>
                      </div>
                    </header>
                    <div className="insight-body">
                      <div className="document-line">
                        <strong>
                          {document.counterpart === ""
                            ? EMPTY_TEXT
                            : document.counterpart}
                        </strong>
                        <span>
                          {formatDateTime(document.posted_at)} ·{" "}
                          {document.warehouse_code === ""
                            ? EMPTY_TEXT
                            : document.warehouse_code}
                        </span>
                      </div>
                      <button
                        className="button insight-action"
                        type="button"
                        disabled={document.drillKey === ""}
                        /* Nút chỉ tắt khi chứng từ chưa truy được SKU nào (phiếu
                           chưa Post nên chưa sinh movement) — nói rõ lý do thay
                           vì để người dùng bấm vào một nút không phản hồi. */
                        title={
                          document.drillKey === ""
                            ? "Chứng từ chưa sinh movement nào trong kỳ nên chưa có dòng SKU để đối chiếu."
                            : undefined
                        }
                        onClick={(event) =>
                          openDrill(document.drillKey, event.currentTarget)
                        }
                      >
                        Đối chiếu dòng chứng từ
                        <VuexyDemoIcon name="arrow-right" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {drillRow !== null ? (
        <DrillDownModal titleId="rpt01-detail-title-modal" onClose={closeDrill}>
          <div className="modal-head">
            <div>
              <div className="eyebrow">Đối soát SKU</div>
              <h2 id="rpt01-detail-title-modal">
                {drillRow.sku_code} ·{" "}
                {drillRow.sku_name === "" ? EMPTY_TEXT : drillRow.sku_name}
              </h2>
              {drillRow.matched ? (
                <span className="match-chip">Công thức khớp</span>
              ) : (
                <span className="chip chip-error">Công thức lệch</span>
              )}
            </div>
            <ModalCloseButton onClose={closeDrill} />
          </div>
          <div className="modal-grid">
            <div>
              <div className="meta-label">Tồn đầu</div>
              <div className="meta-value">{fmt(drillRow.opening)}</div>
            </div>
            <div>
              <div className="meta-label">Nhập thuần</div>
              <div className="meta-value">{fmt(drillRow.receipt_net)}</div>
            </div>
            <div>
              <div className="meta-label">Tồn cuối</div>
              <div className="meta-value">{fmt(drillRow.closing)}</div>
            </div>
          </div>
          <div className="formula">
            {fmt(drillRow.opening)} + {fmt(drillRow.receipt_net)} {MINUS}{" "}
            {fmt(drillRow.issue_net)} {MINUS}{" "}
            {fmt(drillRow.component_issue_net)} +{" "}
            {fmt(drillRow.reversal_unlinked_net)} = {fmt(closingOf(drillRow))}
          </div>
          <h3>Movement liên quan</h3>
          <div className="modal-events">
            {drillMovements.length === 0 ? (
              <div>
                <span>Không có movement trong kỳ.</span>
              </div>
            ) : (
              drillMovements.map((movement) => (
                <div key={movement.movement_id}>
                  <strong>
                    {MOVEMENT_LABELS[movement.movement_type] ??
                      movement.movement_type}
                  </strong>
                  <span>
                    {movement.source_document_no === ""
                      ? EMPTY_TEXT
                      : movement.source_document_no}{" "}
                    · {formatDateTime(movement.posted_at)}
                  </span>
                  <b>
                    {movement.qty_delta > 0 ? "+" : ""}
                    {fmt(movement.qty_delta)}
                  </b>
                </div>
              ))
            )}
          </div>
        </DrillDownModal>
      ) : null}
    </div>
  );
}
