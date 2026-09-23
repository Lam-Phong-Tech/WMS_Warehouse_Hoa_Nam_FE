import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
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
 *  · MỘT BẢN PORT, HAI TRANG (yêu cầu người dùng 2026-09-06). Trang gộp cả ba
 *    câu chuyện Nhập + Xuất + Tồn khiến khách đọc bị loạn, nên màn này nhận
 *    thêm prop `variant` và mỗi route chỉ vẽ phần thuộc CHIỀU của nó:
 *    "Báo cáo nhập kho" (RPT-01) và "Báo cáo xuất kho" (RPT-01B). Phần TỒN
 *    (tồn đầu/cuối kỳ, khối cân đối, biểu đồ tồn cuối ngày, cột đối soát) bỏ
 *    hẳn — RPT-02 "Tồn kho & đối soát" đã lo đúng phần đó.
 *    KHÔNG đổi nguồn số, công thức hay số đo khối nào: chỉ chọn phần hiển thị.
 */
import {
  useDeferredValue,
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useRenderWindow } from "@/shared/components/data-display/useRenderWindow";
import { WindowedMore } from "@/shared/components/data-display/WindowedMore";
import dayjs from "dayjs";
import { UiSelect, UiVuexyDateRangePicker, VuexyDemoIcon } from "@/shared/ui";
import { useTabView } from "@/shared/ui/use-tab-view";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useAuthStore } from "@/shared/store/auth.store";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { axisDayLabel, fmt } from "@/modules/reports/operations/report-format";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import {
  MOVEMENT_LABELS,
  reportStatusLabel,
} from "@/modules/reports/operations/report-labels";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { useReportRangeAdvice } from "@/modules/reports/operations/report-coverage";
import { LEDGER_COVERAGE_PROBE } from "@/modules/reports/operations/report-probes";
import { ReportRangeAdviceBanner } from "@/modules/reports/operations/ReportRangeAdviceBanner";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import { InventoryFlowChart } from "./inventory-flow-chart";
import { DrillDownModal, ModalCloseButton } from "./inventory-flow-overlays";
import {
  ALL_WAREHOUSES_LABEL,
  closingOf,
  INVENTORY_FLOW_REPORT_CODE,
  ISO_DATE,
  sumRows,
  useInventoryFlowSnapshot,
  type FlowDocument,
  type XntRow,
} from "./inventory-flow-api";
import { useT } from "@/shared/i18n/useT";
import InboundFlowReport from "./InboundFlowReport";
import OutboundFlowReport from "./OutboundFlowReport";
import "./inventory-flow-report.css";

/** Thứ tự lựa chọn "Loại hàng"; nhãn đọc qua t() trong component. */
const KIND_VALUES = ["all", "PRODUCT", "COMPONENT"] as const;

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

/** Dấu trừ của mockup là U+2212, không phải dấu gạch nối. */
const MINUS = "−";

type ViewMode = "table" | "snapshot";

type SeriesKey = "inbound" | "product" | "component" | "reversal";

/** Chiều nghiệp vụ của trang — mỗi route dựng đúng một biến thể. */
export type FlowVariant = "inbound" | "outbound";

/**
 * Chuỗi biểu đồ / cột bảng thuộc từng chiều.
 *
 * "Hoàn tác" có mặt ở CẢ hai chiều: `reversal_unlinked_net` là phần hoàn tác
 * KHÔNG truy được chứng từ gốc, nên báo cáo không suy diễn nó thuộc nhập hay
 * xuất — thà hiện ở cả hai còn hơn giấu mất một số đã ghi sổ.
 */
const VARIANT_SERIES: Readonly<Record<FlowVariant, readonly SeriesKey[]>> = {
  inbound: ["inbound", "reversal"],
  outbound: ["product", "component", "reversal"],
};

/** Loại chứng từ hiện ở mục "Lịch sử chứng từ" của từng chiều. */
const VARIANT_DOC_TYPES: Readonly<
  Record<FlowVariant, readonly FlowDocument["doc_type"][]>
> = {
  inbound: ["INBOUND", "REVERSAL"],
  outbound: ["OUTBOUND", "REVERSAL"],
};

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

/** Ba biến thể thẻ chứng từ của mockup, khoá theo loại chứng từ. */
const DOCUMENT_STYLE: Readonly<
  Record<FlowDocument["doc_type"], { className: string; icon: VuexyIconName }>
> = {
  INBOUND: {
    className: "insight-card-warranty",
    icon: "package-plus",
  },
  OUTBOUND: {
    className: "insight-card-ranking",
    icon: "package-minus",
  },
  REVERSAL: {
    className: "insight-card-quality",
    icon: "refresh-cw",
  },
};

function LegacyInventoryFlowXntReport({ variant }: { variant: FlowVariant }) {
  const t = useT();
  const seriesKeys = VARIANT_SERIES[variant];
  const docTypes = VARIANT_DOC_TYPES[variant];
  /** Chữ riêng của từng chiều; mọi nhãn còn lại dùng chung một bộ khoá. */
  const copy = useMemo(
    () =>
      variant === "inbound"
        ? {
            breadcrumb: t("reports.inventoryFlowReport.inboundBreadcrumb"),
            title: t("reports.inventoryFlowReport.inboundTitle"),
            subtitle: t("reports.inventoryFlowReport.inboundSubtitle"),
            quickTitle: t("reports.inventoryFlowReport.inboundQuickTitle"),
            detailTitle: t("reports.inventoryFlowReport.inboundDetailTitle"),
            perSkuTitle: t("reports.inventoryFlowReport.inboundPerSkuTitle"),
            chartTitle: t("reports.inventoryFlowReport.inboundChartTitle"),
            chartSubtitle: t(
              "reports.inventoryFlowReport.inboundChartSubtitle",
            ),
            chartAria: t("reports.inventoryFlowReport.inboundChartAria"),
          }
        : {
            breadcrumb: t("reports.inventoryFlowReport.outboundBreadcrumb"),
            title: t("reports.inventoryFlowReport.outboundTitle"),
            subtitle: t("reports.inventoryFlowReport.outboundSubtitle"),
            quickTitle: t("reports.inventoryFlowReport.outboundQuickTitle"),
            detailTitle: t("reports.inventoryFlowReport.outboundDetailTitle"),
            perSkuTitle: t("reports.inventoryFlowReport.outboundPerSkuTitle"),
            chartTitle: t("reports.inventoryFlowReport.outboundChartTitle"),
            chartSubtitle: t(
              "reports.inventoryFlowReport.outboundChartSubtitle",
            ),
            chartAria: t("reports.inventoryFlowReport.outboundChartAria"),
          },
    [t, variant],
  );
  const kindLabels = useMemo<Readonly<Record<string, string>>>(
    () => ({
      PRODUCT: t("reports.inventoryFlowReport.kindProduct"),
      COMPONENT: t("reports.inventoryFlowReport.kindComponent"),
    }),
    [t],
  );
  const kindOptions = useMemo(
    () =>
      KIND_VALUES.map((value) => ({
        value,
        label:
          value === "all"
            ? t("reports.inventoryFlowReport.kindAll")
            : kindLabels[value],
      })),
    [kindLabels, t],
  );
  /** Tiêu đề ba loại chứng từ — đi kèm DOCUMENT_STYLE nhưng đọc theo ngôn ngữ. */
  const documentTitles = useMemo<
    Readonly<Record<FlowDocument["doc_type"], string>>
  >(
    () => ({
      INBOUND: t("reports.inventoryFlowReport.docInbound"),
      OUTBOUND: t("reports.inventoryFlowReport.docOutbound"),
      REVERSAL: t("reports.inventoryFlowReport.docReversal"),
    }),
    [t],
  );
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);

  /**
   * Kỳ mặc định: hôm qua → hôm nay, đúng bề rộng kỳ mà mockup mở sẵn
   * (01/09 → 02/09 với `as_of` là 02/09).
   */
  const [range, setRange] = useState(() => ({
    from: dayjs().subtract(1, "day").startOf("day"),
    to: dayjs().startOf("day"),
  }));
  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  /**
   * Đổi tab KHÔNG khoá luồng chính: `shownView` (tab đang sáng) cập nhật ở mức GẤP
   * nên người dùng thấy phản hồi ngay, còn `view` — thứ quyết định panel nào
   * được dựng — cập nhật trong transition để React nhường luồng chính. Xem
   * @/shared/ui/use-tab-view.
   */
  const viewTab = useTabView<ViewMode>("table");
  const view = viewTab.view;
  const shownView = viewTab.shown;
  const setView = viewTab.select;
  /**
   * Tab đổi view: nút bấm đọc `view` (cập nhật GẤP → tô sáng tức thì), còn các
   * PANEL nặng đọc `deferredView` (bản trễ, React vẽ ở lượt ngắt được). Đo trước khi
   * sửa (Playwright, CPU x4): một cú bấm "Dạng hộp" khoá luồng chính tới ~930 ms
   * vì panel mới (bảng hàng trăm dòng / lưới thẻ) phải layout + paint trọn một
   * lượt cùng lúc với việc tô sáng tab. Tách hai lượt thì tab phản hồi ngay,
   * panel theo sau.
   */
  const deferredView = useDeferredValue(view);

  /** Bốn chú giải của biểu đồ luồng — mockup để nút chết, đây bật/tắt thật. */
  const [flowSeries, setFlowSeries] = useState<Record<SeriesKey, boolean>>({
    inbound: true,
    product: true,
    component: true,
    reversal: true,
  });

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

  /**
   * Gợi ý bộ lọc kỳ. Ngày "có phát sinh" đọc từ chính sổ movement mà biểu đồ
   * theo ngày đang vẽ — KHÔNG dùng `snapshot.rows` (đã gộp theo SKU, mất mốc
   * thời gian) để lời khuyên và thứ người dùng nhìn thấy luôn cùng một nguồn.
   */
  const dataDays = useMemo(
    () => snapshot.ledger.map((row) => row.posted_at.slice(0, 10)),
    [snapshot.ledger],
  );
  const rangeAdvice = useReportRangeAdvice({
    from: range.from.format(ISO_DATE),
    to: range.to.format(ISO_DATE),
    dataDays,
    loading,
    probe: LEDGER_COVERAGE_PROBE,
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

  // ── Chứng từ trong phạm vi lọc ─────────────────────────────────────────
  const documentsInScope = useMemo(() => {
    const ofVariant = snapshot.documents.filter((document) =>
      docTypes.includes(document.doc_type),
    );
    if (!filtered) return ofVariant;
    return ofVariant.filter(
      (document) =>
        document.drillKey !== "" && codesInScope.has(document.drillKey),
    );
  }, [filtered, snapshot.documents, codesInScope, docTypes]);

  /**
   * Bộ lọc RIÊNG của khối "Đối chiếu từng SKU". Bộ lọc đầu trang đổi luôn KPI,
   * biểu đồ và cả mục chứng từ; ở đây người đọc chỉ muốn thu hẹp đúng bảng/lát
   * cắt đang soi, nên phép lọc này dừng lại trong khối.
   *
   * Áp cho CẢ hai chế độ xem "Dạng ngang" và "Dạng hộp" — hai chế độ chỉ là hai
   * cách vẽ của cùng một tập dòng, lọc lệch nhau sẽ thành hai sự thật.
   */
  const skuSectionFilterConfig = useMemo<SectionFilterConfig<XntRow>>(
    () => ({
      searchPlaceholder: t("reports.inventoryFlowReport.skuSearchPlaceholder"),
      searchText: (row) => [row.sku_code, row.sku_name, row.warehouse_code],
      selects: [
        {
          key: "kind",
          placeholder: t("reports.inventoryFlowReport.anyKind"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.sku_type,
              (value) => kindLabels[value] ?? value,
            ),
          match: (row, value) => row.sku_type === value,
        },
      ],
    }),
    [kindLabels, t],
  );
  const skuSectionFilter = useSectionFilter(
    rowsInScope,
    skuSectionFilterConfig,
  );

  /** Bộ lọc RIÊNG của khối "Lịch sử chứng từ" (lưới thẻ chứng từ). */
  const documentSectionFilterConfig = useMemo<
    SectionFilterConfig<FlowDocument>
  >(
    () => ({
      searchPlaceholder: t("reports.inventoryFlowReport.docSearchPlaceholder"),
      searchText: (row) => [
        row.document_no,
        row.counterpart,
        row.warehouse_code,
      ],
      selects: [
        {
          key: "docType",
          placeholder: t("reports.inventoryFlowReport.anyDocType"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.doc_type,
              (value) =>
                documentTitles[value as FlowDocument["doc_type"]] ?? value,
            ),
          match: (row, value) => row.doc_type === value,
          minWidth: 160,
        },
        {
          key: "status",
          placeholder: t("reports.inventoryFlowReport.anyStatus"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.status,
              (value) => reportStatusLabel(value),
            ),
          match: (row, value) => row.status === value,
          minWidth: 150,
        },
      ],
    }),
    [documentTitles, t],
  );
  const documentSectionFilter = useSectionFilter(
    documentsInScope,
    documentSectionFilterConfig,
  );

  /**
   * Cửa sổ vẽ cho lưới thẻ dài — xem useRenderWindow. Con số ở KPI/biểu đồ và
   * bộ đếm của khối vẫn tính trên TOÀN BỘ tập đã lọc; chỉ số thẻ được vẽ ra DOM
   * là bị cắt, và người đọc luôn thấy "đang hiển thị N/M".
   */
  const skuSectionWindow = useRenderWindow(skuSectionFilter.rows);
  const documentSectionWindow = useRenderWindow(documentSectionFilter.rows);

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
      return {
        tone: "page-alert is-info",
        body: <>{t("reports.inventoryFlowReport.loadingData")}</>,
      };
    }
    return null;
  })();

  /** Bốn chuỗi của biểu đồ luồng, đã lọc theo chú giải đang bật. */
  const flowChartSeries = (
    [
      {
        key: "inbound",
        label: t("reports.inventoryFlowReport.seriesInbound"),
        color: FLOW_COLORS.inbound,
      },
      {
        key: "product",
        label: t("reports.inventoryFlowReport.seriesProduct"),
        color: FLOW_COLORS.product,
      },
      {
        key: "component",
        label: t("reports.inventoryFlowReport.seriesComponent"),
        color: FLOW_COLORS.component,
      },
      {
        key: "reversal",
        label: t("reports.inventoryFlowReport.seriesReversal"),
        color: FLOW_COLORS.reversal,
      },
    ] as Array<{ key: SeriesKey; label: string; color: string }>
  )
    .filter((item) => seriesKeys.includes(item.key) && flowSeries[item.key])
    .map((item) => ({
      key: item.key,
      label: item.label,
      color: item.color,
      values: daily.map((point) => point[item.key]),
    }));

  const hasDays = daily.length > 0;

  const periodMeta = t("reports.inventoryFlowReport.periodMeta", {
    from: formatDate(range.from.toISOString()),
    to: formatDate(range.to.toISOString()),
  });

  return (
    <div className="hn-rpt01" data-mvp-screen="RPT-01">
      <div className="page-wrap">
        <div
          className="breadcrumb"
          aria-label={t("reports.inventoryFlowReport.breadcrumbAria")}
        >
          <span>{t("reports.inventoryFlowReport.breadcrumbHome")}</span>
          <span aria-hidden="true">/</span>
          <span>{t("reports.inventoryFlowReport.breadcrumbReports")}</span>
          <span aria-hidden="true">/</span>
          <strong>{copy.breadcrumb}</strong>
        </div>

        <section className="page-header" aria-labelledby="rpt01-page-title">
          <div>
            <span className="eyebrow">
              {t("reports.inventoryFlowReport.eyebrow", {
                code: INVENTORY_FLOW_REPORT_CODE,
              })}
            </span>
            <h1 id="rpt01-page-title">{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className="scope-block">
            <span className="chip chip-primary">{warehouseLabel}</span>
            <span className="chip chip-neutral">
              {isSuperAdmin
                ? "Super Admin"
                : t("reports.inventoryFlowReport.roleOperator")}
            </span>
            {error !== null && error !== undefined ? (
              <span className="chip chip-error">
                {t("reports.inventoryFlowReport.chipLoadError")}
              </span>
            ) : fetching ? (
              <span className="chip chip-warning">
                {t("reports.inventoryFlowReport.chipUpdating")}
              </span>
            ) : (
              <span className="chip chip-success">
                {t("reports.inventoryFlowReport.chipFresh")}
              </span>
            )}
          </div>
        </section>

        <section
          className="filter-card report-filter-card"
          aria-label={t("reports.inventoryFlowReport.filterAria")}
        >
          <div className="filter-group">
            <span className="filter-label">
              {t("reports.inventoryFlowReport.fieldPeriod")}
            </span>
            <div className="report-date-range">
              {/*
               * Một bộ chọn KHOẢNG thay cho hai ô ngày rời — đồng bộ với các
               * màn Báo cáo còn lại. Picker tự khoá chéo (không cho chọn "đến"
               * trước "từ") nên bỏ được cặp maxDate/minDate của bản hai ô; kỳ
               * đảo chiều vì thế vẫn không dựng ra được (BE trả 422).
               */}
              <UiVuexyDateRangePicker
                aria-label={t("reports.inventoryFlowReport.fieldPeriod")}
                value={[range.from, range.to]}
                format="DD/MM/YYYY"
                placeholder={[
                  t("reports.inventoryFlowReport.periodStart"),
                  t("reports.inventoryFlowReport.periodEnd"),
                ]}
                allowClear={false}
                presets={periodPresets}
                className="hn-vuexy-date-range"
                popupClassName="hn-vuexy-date-popup"
                onChange={(value) => {
                  if (!value?.[0] || !value[1]) return;
                  setRange({
                    from: value[0].startOf("day"),
                    to: value[1].startOf("day"),
                  });
                }}
              />
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">
              {t("reports.inventoryFlowReport.fieldSkuSearch")}
            </span>
            <SearchInput
              width="100%"
              value={query}
              aria-label={t("reports.inventoryFlowReport.fieldSkuSearch")}
              placeholder={t("reports.inventoryFlowReport.skuSearchInput")}
              onChange={setQuery}
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">
              {t("reports.inventoryFlowReport.fieldKind")}
            </span>
            <UiSelect
              fullWidth
              aria-label={t("reports.inventoryFlowReport.fieldKind")}
              value={kind}
              options={kindOptions}
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
                ? t("reports.inventoryFlowReport.refreshing")
                : t("reports.inventoryFlowReport.refresh")}
            </button>
            <div className="refresh-meta">
              <span>
                {t("reports.inventoryFlowReport.dataAt", {
                  time: asOf ? asOf.format("HH:mm") : EMPTY_TEXT,
                })}
              </span>
              <small>
                {t("reports.inventoryFlowReport.postedUntil", {
                  date:
                    watermark && watermark.isValid()
                      ? watermark.format("DD-MM-YYYY")
                      : EMPTY_TEXT,
                })}
              </small>
            </div>
          </div>

          {/* UAT TC_UI_14 (Note): không phơi mã kỹ thuật (snapshot id, tên
              múi giờ IANA) ra màn nghiệp vụ — chỉ giữ con số người dùng cần. */}
          <div className="report-snapshot">
            <strong>{fmt(rowsInScope.length)} SKU</strong> ·{" "}
            {t("reports.inventoryFlowReport.timezoneNote")}
          </div>
        </section>

        <ReportRangeAdviceBanner
          advice={rangeAdvice}
          onApply={(next) =>
            setRange({
              from: dayjs(next.from).startOf("day"),
              to: dayjs(next.to).startOf("day"),
            })
          }
        />

        {pageAlert ? (
          <div className={pageAlert.tone} role="note">
            {pageAlert.body}
          </div>
        ) : null}

        {/* ── Tổng quan cân đối ─────────────────────────────────────────── */}
        <section aria-labelledby="rpt01-quick-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.inventoryFlowReport.quickEyebrow")}
              </span>
              <h2 id="rpt01-quick-title">{copy.quickTitle}</h2>
            </div>
            <span className="section-meta">{periodMeta}</span>
          </div>
          <div
            className={
              variant === "inbound"
                ? "kpi-grid report-kpi-grid is-inbound"
                : "kpi-grid report-kpi-grid is-outbound"
            }
          >
            {variant === "inbound" ? (
              <KpiCard
                tone="inbound"
                icon="package-plus"
                label={t("reports.inventoryFlowReport.kpiInbound")}
                value={summary.receiptNet}
                foot={t("reports.inventoryFlowReport.kpiInboundFoot")}
                spark={daily.map((point) => point.inbound)}
              />
            ) : (
              <>
                <KpiCard
                  tone="product"
                  icon="package-minus"
                  label={t("reports.inventoryFlowReport.kpiProduct")}
                  value={summary.issueNet}
                  foot={t("reports.inventoryFlowReport.kpiProductFoot")}
                  spark={daily.map((point) => point.product)}
                />
                <KpiCard
                  tone="component"
                  icon="briefcase-medical"
                  label={t("reports.inventoryFlowReport.kpiComponent")}
                  value={summary.componentNet}
                  foot={t("reports.inventoryFlowReport.kpiComponentFoot")}
                  spark={daily.map((point) => point.component)}
                />
              </>
            )}
            <KpiCard
              tone="reversal"
              icon="refresh-cw"
              label={t("reports.inventoryFlowReport.kpiReversal")}
              value={summary.reversalUnlinked}
              foot={t("reports.inventoryFlowReport.kpiReversalFoot")}
              spark={daily.map((point) => point.reversal)}
            />
          </div>
        </section>

        {/* ── Chi tiết theo SKU ─────────────────────────────────────────── */}
        <section aria-labelledby="rpt01-detail-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.inventoryFlowReport.detailEyebrow")}
              </span>
              <h2 id="rpt01-detail-title">{copy.detailTitle}</h2>
            </div>
            <span className="section-meta">
              {t("reports.inventoryFlowReport.skuInSnapshot", {
                count: fmt(rowsInScope.length),
              })}
            </span>
          </div>
          <article className="card report-table-card">
            <header className="card-head">
              <div>
                <h3>{copy.perSkuTitle}</h3>
                <span className="card-subtitle">
                  {t("reports.inventoryFlowReport.perSkuSubtitle")}
                </span>
              </div>
            </header>

            <SectionFilterBar
              state={skuSectionFilter}
              label={copy.perSkuTitle}
              unit="SKU"
              data-testid="rpt01-sku-section-filter"
            />

            <div
              className="report-view-tabs"
              role="tablist"
              aria-label={t("reports.inventoryFlowReport.tabsAria")}
            >
              <button
                ref={tableTabRef}
                id="rpt01-tab-table"
                className={
                  shownView === "table"
                    ? "button button-primary"
                    : "button button-ghost"
                }
                type="button"
                role="tab"
                aria-selected={shownView === "table"}
                aria-controls="rpt01-panel-table"
                tabIndex={shownView === "table" ? 0 : -1}
                onClick={() => setView("table")}
                onKeyDown={onTabKeyDown}
              >
                <VuexyDemoIcon name="chart-column-big" />
                {t("reports.inventoryFlowReport.viewTable")}
              </button>
              <button
                ref={snapshotTabRef}
                id="rpt01-tab-snapshot"
                className={
                  shownView === "snapshot"
                    ? "button button-primary"
                    : "button button-ghost"
                }
                type="button"
                role="tab"
                aria-selected={shownView === "snapshot"}
                aria-controls="rpt01-panel-snapshot"
                tabIndex={shownView === "snapshot" ? 0 : -1}
                onClick={() => setView("snapshot")}
                onKeyDown={onTabKeyDown}
              >
                <VuexyDemoIcon name="grid-2x2-plus" />
                {t("reports.inventoryFlowReport.viewSnapshot")}
              </button>
            </div>

            <div
              id="rpt01-panel-table"
              role="tabpanel"
              aria-labelledby="rpt01-tab-table"
              hidden={deferredView !== "table"}
            >
              <div className="table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th className="stt-col">{t("shared.table.rowNumber")}</th>
                      <th>{t("reports.inventoryFlowReport.colSku")}</th>
                      <th>{t("reports.inventoryFlowReport.colKind")}</th>
                      <th>{t("reports.inventoryFlowReport.colUnit")}</th>
                      {variant === "inbound" ? (
                        <th className="num">
                          {t("reports.inventoryFlowReport.colReceiptNet")}
                        </th>
                      ) : (
                        <>
                          <th className="num">
                            {t("reports.inventoryFlowReport.colIssueNet")}
                          </th>
                          <th className="num">
                            {t("reports.inventoryFlowReport.colComponentNet")}
                          </th>
                        </>
                      )}
                      <th className="num">
                        {t("reports.inventoryFlowReport.colReversal")}
                      </th>
                      <th className="num" />
                    </tr>
                  </thead>
                  <tbody>
                    {skuSectionFilter.rows.length === 0 ? (
                      <tr>
                        <td
                          className="table-empty"
                          colSpan={variant === "inbound" ? 7 : 8}
                        >
                          {loading
                            ? t("reports.inventoryFlowReport.loadingData")
                            : skuSectionFilter.active
                              ? t("reports.inventoryFlowReport.emptyFiltered")
                              : t("reports.inventoryFlowReport.emptyPeriod")}
                        </td>
                      </tr>
                    ) : (
                      skuSectionFilter.rows.map((row, index) => (
                        <tr key={row.sku_code}>
                          <td className="stt-col">{index + 1}</td>
                          <td>
                            <span className="sku">
                              <SkuLink code={row.sku_code} />
                            </span>
                            <div className="truncate" title={row.sku_name}>
                              {row.sku_name === "" ? EMPTY_TEXT : row.sku_name}
                            </div>
                          </td>
                          <td>{kindLabels[row.sku_type] ?? EMPTY_TEXT}</td>
                          <td>{row.unit === "" ? EMPTY_TEXT : row.unit}</td>
                          {variant === "inbound" ? (
                            <td className="num">{fmt(row.receipt_net)}</td>
                          ) : (
                            <>
                              <td className="num">{fmt(row.issue_net)}</td>
                              <td className="num">
                                {fmt(row.component_issue_net)}
                              </td>
                            </>
                          )}
                          <td className="num">
                            {fmt(row.reversal_unlinked_net)}
                          </td>
                          <td className="num">
                            <RowActionGroup>
                              <RowActionButton
                                kind="detail"
                                type="button"
                                onClick={(event) =>
                                  openDrill(row.sku_code, event.currentTarget)
                                }
                              >
                                {t("reports.inventoryFlowReport.reconcile")}
                              </RowActionButton>
                            </RowActionGroup>
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
              hidden={deferredView !== "snapshot"}
            >
              {skuSectionFilter.rows.length === 0 ? (
                <div className="state-box">
                  <strong>
                    {skuSectionFilter.active
                      ? t("reports.inventoryFlowReport.emptyFilteredTitle")
                      : t("reports.inventoryFlowReport.emptyNoSkuTitle")}
                  </strong>
                  <span>
                    {skuSectionFilter.active
                      ? t("reports.inventoryFlowReport.emptyFilteredHint")
                      : t("reports.inventoryFlowReport.emptyNoSkuHint")}
                  </span>
                </div>
              ) : (
                <div className="report-snapshot-grid">
                  {skuSectionWindow.visible.map((row, index) => (
                    <article className="report-slice" key={row.sku_code}>
                      <div className="report-slice-head">
                        <div>
                          <span className="stt-badge">
                            {t("shared.table.rowNumber")} {index + 1}
                          </span>
                          <strong>
                            {row.sku_code} ·{" "}
                            {row.sku_name === "" ? EMPTY_TEXT : row.sku_name}
                          </strong>
                          <span>
                            {kindLabels[row.sku_type] ?? EMPTY_TEXT} ·{" "}
                            {row.warehouse_code === ""
                              ? EMPTY_TEXT
                              : row.warehouse_code}
                          </span>
                        </div>
                      </div>
                      <dl className="report-slice-values">
                        {variant === "inbound" ? (
                          <div>
                            <dt>
                              {t("reports.inventoryFlowReport.colReceiptNet")}
                            </dt>
                            <dd>{fmt(row.receipt_net)}</dd>
                          </div>
                        ) : (
                          <>
                            <div>
                              <dt>
                                {t("reports.inventoryFlowReport.colIssueNet")}
                              </dt>
                              <dd>{fmt(row.issue_net)}</dd>
                            </div>
                            <div>
                              <dt>
                                {t(
                                  "reports.inventoryFlowReport.colComponentNet",
                                )}
                              </dt>
                              <dd>{fmt(row.component_issue_net)}</dd>
                            </div>
                          </>
                        )}
                        <div>
                          <dt>
                            {t("reports.inventoryFlowReport.colReversal")}
                          </dt>
                          <dd>{fmt(row.reversal_unlinked_net)}</dd>
                        </div>
                      </dl>
                      <RowActionGroup>
                        <RowActionButton
                          kind="detail"
                          type="button"
                          onClick={(event) =>
                            openDrill(row.sku_code, event.currentTarget)
                          }
                        >
                          {t("reports.inventoryFlowReport.reconcileSku")}
                        </RowActionButton>
                      </RowActionGroup>
                    </article>
                  ))}
                  <WindowedMore window={skuSectionWindow} />
                </div>
              )}
            </div>
          </article>
        </section>

        {/*
         * ── Luồng và xu hướng · Lịch sử chứng từ ────────────────────────
         * Hai khối đứng cạnh nhau 6/6 (yêu cầu người dùng 2026-09-06): trang
         * một chiều không còn đủ nội dung để mỗi khối chiếm trọn bề ngang —
         * biểu đồ bị kéo quá to còn lưới chứng từ thì thưa. Bề rộng nửa trang
         * cũng đúng bằng bề rộng thẻ biểu đồ của mockup 8.1 gốc.
         */}
        <div className="report-split-grid">
          <section aria-labelledby="rpt01-analysis-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {t("reports.inventoryFlowReport.analysisEyebrow")}
                </span>
                <h2 id="rpt01-analysis-title">
                  {t("reports.inventoryFlowReport.analysisTitle")}
                </h2>
              </div>
              <span className="section-meta">
                {t("reports.inventoryFlowReport.analysisMeta")}
              </span>
            </div>
            {/*
             * Chú giải đứng THÀNH THANH RIÊNG phía trên thẻ, không nằm trong thẻ
             * như mockup 8.1: cột bên phải có thanh lọc riêng của khối, nếu cột
             * trái vào thẳng thẻ thì thẻ hai bên lệch nhau đúng một tầng. Chú
             * giải vốn cũng là control (bật/tắt chuỗi) nên đứng cùng hàng với bộ
             * lọc là đúng vai, không phải bày ra cho cân.
             */}
            <div className="report-chart-toolbar">
              <div className="chart-legend">
                {(
                  [
                    {
                      key: "inbound",
                      label: t("reports.inventoryFlowReport.seriesInbound"),
                      dot: "legend-inbound",
                    },
                    {
                      key: "product",
                      label: t("reports.inventoryFlowReport.seriesProduct"),
                      dot: "legend-product",
                    },
                    {
                      key: "component",
                      label: t("reports.inventoryFlowReport.seriesComponent"),
                      dot: "legend-component",
                    },
                    {
                      key: "reversal",
                      label: t("reports.inventoryFlowReport.seriesReversal"),
                      dot: "legend-reversal",
                    },
                  ] as Array<{ key: SeriesKey; label: string; dot: string }>
                )
                  .filter((item) => seriesKeys.includes(item.key))
                  .map((item) => (
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
            </div>
            <div className="analysis-grid is-single">
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
                      <h3>{copy.chartTitle}</h3>
                      <span className="card-subtitle">
                        {copy.chartSubtitle}
                      </span>
                    </div>
                  </div>
                  <div className="chart-head-meta">
                    <span className="chart-unit">
                      {t("reports.inventoryFlowReport.chartUnit")}
                    </span>
                    {variant === "inbound" ? (
                      <span className="chart-current">
                        <small>
                          {t("reports.inventoryFlowReport.colReceiptNet")}
                        </small>
                        <strong>{fmt(summary.receiptNet)}</strong>
                      </span>
                    ) : (
                      <>
                        <span className="chart-current">
                          <small>
                            {t("reports.inventoryFlowReport.colIssueNet")}
                          </small>
                          <strong>{fmt(summary.issueNet)}</strong>
                        </span>
                        <span className="chart-current">
                          <small>
                            {t("reports.inventoryFlowReport.colComponentNet")}
                          </small>
                          <strong>{fmt(summary.componentNet)}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </header>
                <div className="chart-wrap">
                  <div className="chart-plot">
                    {hasDays ? (
                      <InventoryFlowChart
                        labels={axisLabels}
                        series={flowChartSeries}
                        ariaLabel={copy.chartAria}
                      />
                    ) : (
                      <div className="chart-empty">
                        {t("reports.inventoryFlowReport.flowChartEmpty")}
                      </div>
                    )}
                  </div>
                </div>
                <details className="chart-table">
                  <summary>{t("reports.inventoryFlowReport.altTable")}</summary>
                  <table>
                    <thead>
                      <tr>
                        <th className="stt-col">
                          {t("shared.table.rowNumber")}
                        </th>
                        <th>{t("reports.inventoryFlowReport.colDay")}</th>
                        {variant === "inbound" ? (
                          <th>
                            {t("reports.inventoryFlowReport.seriesInbound")}
                          </th>
                        ) : (
                          <>
                            <th>
                              {t("reports.inventoryFlowReport.seriesProduct")}
                            </th>
                            <th>
                              {t("reports.inventoryFlowReport.seriesComponent")}
                            </th>
                          </>
                        )}
                        <th>
                          {t("reports.inventoryFlowReport.seriesReversal")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {daily.map((point, index) => (
                        <tr key={point.date}>
                          <td className="stt-col">{index + 1}</td>
                          <td>{axisDayLabel(point.date)}</td>
                          {variant === "inbound" ? (
                            <td>{fmt(point.inbound)}</td>
                          ) : (
                            <>
                              <td>{fmt(point.product)}</td>
                              <td>{fmt(point.component)}</td>
                            </>
                          )}
                          <td>{fmt(point.reversal)}</td>
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
                <span className="eyebrow">
                  {t("reports.inventoryFlowReport.documentsEyebrow")}
                </span>
                <h2 id="rpt01-documents-title">
                  {t("reports.inventoryFlowReport.documentsTitle")}
                </h2>
              </div>
              <span className="section-meta">
                {t("reports.inventoryFlowReport.documentsInSnapshot", {
                  count: fmt(documentsInScope.length),
                })}
              </span>
            </div>
            {documentsInScope.length > 0 ? (
              <SectionFilterBar
                state={documentSectionFilter}
                label={t("reports.inventoryFlowReport.documentsTitle")}
                unit={t("reports.inventoryFlowReport.documentsUnit")}
                data-testid="rpt01-document-section-filter"
              />
            ) : null}
            {documentSectionFilter.rows.length === 0 ? (
              <article className="card insight-card report-document-card">
                <div className="state-box">
                  <strong>
                    {documentSectionFilter.active
                      ? t("reports.inventoryFlowReport.docEmptyFilteredTitle")
                      : t("reports.inventoryFlowReport.docEmptyTitle")}
                  </strong>
                  <span>
                    {documentSectionFilter.active
                      ? t("reports.inventoryFlowReport.docEmptyFilteredHint")
                      : t("reports.inventoryFlowReport.docEmptyHint")}
                  </span>
                </div>
              </article>
            ) : (
              <div className="insight-grid">
                {documentSectionWindow.visible.map((document, index) => {
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
                            <span className="stt-badge">
                              {t("shared.table.rowNumber")} {index + 1}
                            </span>
                            <span className="eyebrow">
                              {t("reports.inventoryFlowReport.docCardEyebrow")}
                            </span>
                            <h3>{document.document_no}</h3>
                            <span className="card-subtitle">
                              {documentTitles[document.doc_type]} ·{" "}
                              {reportStatusLabel(document.status)}
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
                              ? t("reports.inventoryFlowReport.drillDisabled")
                              : undefined
                          }
                          onClick={(event) =>
                            openDrill(document.drillKey, event.currentTarget)
                          }
                        >
                          {t("reports.inventoryFlowReport.drillDocument")}
                          <VuexyDemoIcon name="arrow-right" />
                        </button>
                      </div>
                    </article>
                  );
                })}
                <WindowedMore window={documentSectionWindow} />
              </div>
            )}
          </section>
        </div>
      </div>

      {drillRow !== null ? (
        <DrillDownModal titleId="rpt01-detail-title-modal" onClose={closeDrill}>
          <div className="modal-head">
            <div>
              <div className="eyebrow">
                {t("reports.inventoryFlowReport.modalEyebrow")}
              </div>
              <h2 id="rpt01-detail-title-modal">
                {drillRow.sku_code} ·{" "}
                {drillRow.sku_name === "" ? EMPTY_TEXT : drillRow.sku_name}
              </h2>
              {drillRow.matched ? (
                <span className="match-chip">
                  {t("reports.inventoryFlowReport.modalFormulaMatched")}
                </span>
              ) : (
                <span className="chip chip-error">
                  {t("reports.inventoryFlowReport.modalFormulaMismatch")}
                </span>
              )}
            </div>
            <ModalCloseButton onClose={closeDrill} />
          </div>
          <div className="modal-grid">
            <div>
              <div className="meta-label">
                {t("reports.inventoryFlowReport.cardOpening")}
              </div>
              <div className="meta-value">{fmt(drillRow.opening)}</div>
            </div>
            <div>
              <div className="meta-label">
                {t("reports.inventoryFlowReport.colReceiptNet")}
              </div>
              <div className="meta-value">{fmt(drillRow.receipt_net)}</div>
            </div>
            <div>
              <div className="meta-label">
                {t("reports.inventoryFlowReport.cardClosing")}
              </div>
              <div className="meta-value">{fmt(drillRow.closing)}</div>
            </div>
          </div>
          <div className="formula">
            {fmt(drillRow.opening)} + {fmt(drillRow.receipt_net)} {MINUS}{" "}
            {fmt(drillRow.issue_net)} {MINUS}{" "}
            {fmt(drillRow.component_issue_net)} +{" "}
            {fmt(drillRow.reversal_unlinked_net)} = {fmt(closingOf(drillRow))}
          </div>
          <h3>{t("reports.inventoryFlowReport.movementsTitle")}</h3>
          <div className="modal-events">
            {drillMovements.length === 0 ? (
              <div>
                <span>{t("reports.inventoryFlowReport.movementsEmpty")}</span>
              </div>
            ) : (
              drillMovements.map((movement, index) => (
                <div key={movement.movement_id}>
                  <strong>
                    {index + 1}.{" "}
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

export default function InventoryFlowXntReport({
  variant,
}: {
  variant: FlowVariant;
}) {
  if (variant === "inbound") return <InboundFlowReport />;
  if (variant === "outbound") return <OutboundFlowReport />;
  return <LegacyInventoryFlowXntReport variant={variant} />;
}
