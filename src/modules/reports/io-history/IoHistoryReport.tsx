/**
 * MÀN "BÁO CÁO LỊCH SỬ NHẬP – XUẤT KHO" (RPT-IO-01) — port 1:1 mockup UI/UX đã
 * chốt `8.3.WMS_Hoa_Nam_Bao_Cao_Lich_Su_Nhap_Xuat.html`: cùng cấu trúc khối,
 * cùng class, cùng số đo (CSS port ở `./io-history-report.css`), cùng công thức
 * tính và cùng bộ hành vi (`rows()` / `kpis()` / `chart()` / `table()` /
 * `slices()` / `controls()` / `dialog()` của khối script trong mockup).
 *
 * KHÁC MOCKUP Ở ĐÂU (và vì sao):
 *  · Mockup chạy trên một mảng 5 chứng từ cứng nhúng trong trang. Ở đây MỌI con
 *    số đến từ endpoint thật (xem `./io-history-api.ts`); nguồn nào chưa trả
 *    thì ô hiện "Chưa có" theo `EMPTY_TEXT`, không suy diễn.
 *  · Mockup có bốn nút chết: hai nút ‹ › của lịch (chỉ là ký tự trong một
 *    `<span>`) và hai nút "Xuất XLSX/PDF" (chỉ hiện toast). Bản này gắn hành vi
 *    thật cho cả bốn — đổi tháng, và chạy job export Annex C
 *    (`/reports/export`, `report_code=document-history`).
 *  · Lịch của mockup vẽ cứng 30 ô "Tháng 09/2026" chạy thẳng từ ngày 1 dù có
 *    hàng thứ trong tuần T2…CN ở trên. Bản này chèn ô đệm để ngày rơi đúng cột
 *    thứ của nó — nếu không, hàng thứ ngay phía trên sẽ chỉ sai. Ngày ở TƯƠNG
 *    LAI bị vô hiệu vì không thể có chứng từ đã ghi nhận ở đó.
 *  · Chip "Dữ liệu mock" ở đầu biểu đồ đổi thành "Nguồn: sổ movement": dán nhãn
 *    "mock" lên số liệu thật là nói sai về dữ liệu đang xem.
 *  · Chân bảng của mockup ghi "Phân trang server-side · 25 dòng/trang" trong
 *    khi bản mockup không hề cắt trang. Màn này CỐ Ý không gửi `per_page` (KPI,
 *    biểu đồ, bảng và lát cắt phải mô tả cùng một tập dòng), nên hai ô đó ghi
 *    đúng điều đang xảy ra thay vì chép lại câu sai.
 *  · Thêm một dải `.page-alert` cho trạng thái đang tải / lỗi mạng — mockup
 *    offline không có hai trạng thái này nhưng dữ liệu thật thì có.
 *  · Bỏ `<footer class="app-footer">` của mockup: vỏ ứng dụng đã render footer
 *    dùng chung, thêm nữa sẽ thành hai chân trang chồng nhau.
 */
import {
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import dayjs from "dayjs";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { fitAxisDensity } from "@/shared/components/charts/axis-density";
import { useAuthStore } from "@/shared/store/auth.store";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import { fmt, presetRange } from "@/modules/reports/operations/report-format";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import { useReportExport } from "@/modules/reports/operations/report-export";
import { reportStatusLabel } from "@/modules/reports/operations/report-labels";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { useReportRangeAdvice } from "@/modules/reports/operations/report-coverage";
import { DOCUMENT_HISTORY_COVERAGE_PROBE } from "@/modules/reports/operations/report-probes";
import { ReportRangeAdviceBanner } from "@/modules/reports/operations/ReportRangeAdviceBanner";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import { IoIcon } from "./io-history-icons";
import {
  IO_HISTORY_EXPORT_CODE,
  IO_HISTORY_REPORT_CODE,
  IO_HISTORY_STATUS,
  ISO_DATE,
  ioSnapshotId,
  useIoHistorySnapshot,
  type IoDocType,
  type IoHistoryRow,
  type IoTypeFilter,
} from "./io-history-api";
import { UiVuexyDateRangePicker } from "@/shared/ui";
import { useTabView } from "@/shared/ui/use-tab-view";
import { useT } from "@/shared/i18n/useT";
import "./io-history-report.css";

/** Thứ tự bốn lựa chọn menu "Loại chứng từ"; nhãn đọc qua t(). */
const TYPE_FILTER_VALUES: ReadonlyArray<IoTypeFilter> = [
  "",
  "INBOUND",
  "OUTBOUND",
  "REVERSAL",
];

/** Ba chuỗi của biểu đồ, đúng thứ tự và màu của mockup. */
const CHART_SERIES: ReadonlyArray<{
  type: IoDocType;
  className: string;
}> = [
  { type: "INBOUND", className: "series-inbound" },
  {
    type: "OUTBOUND",
    className: "series-outbound",
  },
  {
    type: "REVERSAL",
    className: "series-reversal",
  },
];

// ── Hình học biểu đồ — đúng các hằng trong hàm `chart()` của mockup ────────
const CHART_MIN_WIDTH = 360;
/** Bề ngang dự phòng của mockup khi chưa đo được (`|| 920`). */
const CHART_FALLBACK_WIDTH = 920;
const CHART_LEFT = 52;
const CHART_RIGHT_INSET = 18;
const CHART_BOTTOM = 204;
const CHART_TOP = 28;
const CHART_VIEW_HEIGHT = 245;
const CHART_AXIS_Y = 232;
const CHART_EMPTY_Y = 120;
const CHART_POINT_RADIUS = 4;
/** Cỡ chữ mọi nhãn trong SVG — khớp `.hn-rpt-io .chartsvg text` trong CSS. */
const CHART_FONT_SIZE = 11;
/**
 * UAT TC_UI_25 — khoảng cách dọc tối thiểu giữa nhãn giá trị CUỐI KỲ của các
 * chuỗi (cùng thuật toán spread với inventory-flow-chart): 4 chuỗi cùng x,
 * giá trị gần nhau là 4 con số in đè lên nhau thành một cụm không đọc được.
 */
const END_VALUE_MIN_GAP = 14;

/** Đẩy các nhãn cuối cách nhau tối thiểu rồi kéo cả cụm lên nếu tràn đáy. */
function spreadEndValues(rawY: ReadonlyArray<number>): number[] {
  const order = rawY
    .map((y, index) => ({ y, index }))
    .sort((a, b) => a.y - b.y);
  const resolved = new Array<number>(rawY.length);
  let previous = -Infinity;
  for (const item of order) {
    const y = Math.max(item.y, previous + END_VALUE_MIN_GAP);
    resolved[item.index] = y;
    previous = y;
  }
  const overflow = Math.max(...resolved, CHART_BOTTOM) - CHART_BOTTOM;
  if (overflow <= 0) return resolved;
  return resolved.map((y) => Math.max(CHART_TOP + CHART_FONT_SIZE, y - overflow));
}

type ViewMode = "table" | "slice";

/** `(v>=0?"+":"−") + |v|` — đúng hàm `sign` của mockup (dấu trừ U+2212). */
function signed(value: number): string {
  return (value >= 0 ? "+" : "−") + fmt(Math.abs(value));
}

/** Số lượng chưa xác định được dấu thì hiện "Chưa có" thay vì một con số bịa. */
function signedOrEmpty(value: number | null): string {
  return value === null ? EMPTY_TEXT : signed(value);
}

function absOrEmpty(value: number | null): string {
  return value === null ? EMPTY_TEXT : fmt(Math.abs(value));
}

/**
 * Sắc viên của ô "SL đã ghi nhận": tăng = xanh, giảm = đỏ, không đổi = trung tính.
 *
 * NGOÀI MOCKUP (yêu cầu người dùng): mockup in số trần, ở đây tô nền như cột
 * "Trạng thái" để phân biệt chiều ngay khi lướt.
 */
function qtyToneOf(value: number): string {
  if (value > 0) return "is-pos";
  if (value < 0) return "is-neg";
  return "is-zero";
}

/** "01/09/2026" — đúng hàm `day` của mockup. */
function fmtDay(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : EMPTY_TEXT;
}

/**
 * "01/09" — dạng rút gọn CHỈ dùng cho nhãn trục X khi kỳ dài.
 *
 * Nhãn đủ năm chiếm gần gấp đôi bề ngang; ở kỳ 30–365 ngày, bỏ phần năm cho
 * phép giữ gấp đôi số mốc trên trục mà vẫn không chồng chữ. Năm vẫn đọc được
 * ở dải "kỳ đang xem" của bộ lọc và ở bảng chi tiết bên dưới.
 */
function fmtDayShort(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM") : EMPTY_TEXT;
}

/**
 * "01/09/2026 09:02" — đúng hàm `time` của mockup.
 *
 * Mockup luôn có phần giờ vì dữ liệu cứng là ISO đầy đủ. BE có trường chỉ mang
 * NGÀY (`document_date`); khi đó in đúng ngày chứ không gắn thêm "00:00" —
 * giờ đó không phải giờ máy chủ trả về.
 */
function fmtStamp(value: string): string {
  if (value === "") return EMPTY_TEXT;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return EMPTY_TEXT;
  return value.length <= 10
    ? parsed.format("DD/MM/YYYY")
    : parsed.format("DD/MM/YYYY HH:mm");
}

/** Sắc chip theo loại chứng từ — đúng hàm `kind` của mockup. */
function toneOf(type: IoDocType): string {
  if (type === "INBOUND") return "ok";
  if (type === "OUTBOUND") return "warn";
  return "info";
}

/**
 * Nhãn cột "Biến động kho".
 *
 * Một chứng từ nhiều dòng SKU sinh nhiều movement; chọn bừa một cái làm đại
 * diện là bịa, nên chỉ hiện MÃ (`movement_no`) khi đúng một movement. Thiếu mã
 * thì "Chưa có" — không rơi xuống UUID.
 */
function movementLabelOf(row: IoHistoryRow): string {
  if (row.movementCount === 0) return EMPTY_TEXT;
  if (row.movementCount === 1) {
    return row.movementNo === "" ? EMPTY_TEXT : row.movementNo;
  }
  return `${fmt(row.movementCount)} movement`;
}

/** Tổng lượng ghi nhận của một nhóm dòng, bỏ qua dòng chưa xác định dấu. */
function sumQty(rows: IoHistoryRow[]): number {
  return rows.reduce((total, row) => total + (row.qty ?? 0), 0);
}

function ofType(rows: IoHistoryRow[], type: IoDocType): IoHistoryRow[] {
  return rows.filter((row) => row.type === type);
}

export default function IoHistoryReport() {
  const t = useT();
  const typeLabels = useMemo<Readonly<Record<IoDocType, string>>>(
    () => ({
      INBOUND: t("reports.ioHistory.typeInbound"),
      OUTBOUND: t("reports.ioHistory.typeOutbound"),
      REVERSAL: t("reports.ioHistory.typeReversal"),
    }),
    [t],
  );
  /**
   * Kỳ nhanh nay nằm TRONG lịch chọn khoảng, không còn hàng nút "Kỳ báo cáo"
   * riêng bên cạnh: hai control cùng ghi một khoảng ngày là chỗ người dùng
   * không biết cái nào thắng cái nào. Bản mockup 8.3 có hàng nút đó vì nó
   * chưa có lịch chọn khoảng dùng chung.
   */
  const periodPresets = useMemo(() => reportRangePresets(t), [t]);
  const allTypesLabel = t("reports.ioHistory.allTypes");
  const typeOptions = useMemo(
    () =>
      TYPE_FILTER_VALUES.map((value) => ({
        value,
        label: value === "" ? allTypesLabel : typeLabels[value],
      })),
    [allTypesLabel, typeLabels],
  );
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canExport = hasAnyWmsPermission(
    permissionCodes,
    WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
    isSuperAdmin,
  );

  // ── State của mockup (`st`) ────────────────────────────────────────────
  /*
   * Không còn state "kỳ" riêng: kỳ nhanh nằm trong lịch nên KHOẢNG NGÀY là
   * nguồn sự thật duy nhất. Giữ thêm một biến `preset` song song chỉ tạo ra
   * hai thứ có thể lệch nhau — bấm kỳ nhanh rồi sửa tay một ngày thì tên kỳ
   * vẫn còn đó nhưng đã nói sai về khoảng đang xem.
   */
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const [start, end] = presetRange("this-month");
    return { from: start.format(ISO_DATE), to: end.format(ISO_DATE) };
  });
  const [type, setType] = useState<IoTypeFilter>("");
  const [query, setQuery] = useState("");
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

  const [filterVisible, setFilterVisible] = useState(true);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [drillId, setDrillId] = useState<string | null>(null);

  const { snapshot, loading, fetching, error, refetch } = useIoHistorySnapshot({
    from: range.from,
    to: range.to,
    type,
  });
  const exporter = useReportExport();

  // ── Tập dòng trong phạm vi bộ lọc (hàm `rows()` của mockup) ────────────
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return snapshot.rows.filter((row) => {
      const day = row.postedAt.slice(0, 10);
      if (day < range.from || day > range.to) return false;
      if (type !== "" && row.type !== type) return false;
      if (needle === "") return true;
      return [row.documentNo, row.actor, row.party, movementLabelOf(row)]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(needle);
    });
  }, [snapshot.rows, range.from, range.to, type, query]);

  /**
   * Gợi ý bộ lọc kỳ. Đọc `snapshot.rows` (TRƯỚC bộ lọc loại/tìm kiếm) chứ
   * không đọc `rows`: kỳ trống vì người dùng gõ nhầm từ khoá là chuyện khác
   * hẳn với kỳ trống vì kho không phát sinh, và chỉ chuyện thứ hai mới đáng
   * khuyên đổi kỳ.
   */
  const dataDays = useMemo(
    () => snapshot.rows.map((row) => row.postedAt.slice(0, 10)),
    [snapshot.rows],
  );
  const rangeAdvice = useReportRangeAdvice({
    from: range.from,
    to: range.to,
    dataDays,
    loading,
    probe: DOCUMENT_HISTORY_COVERAGE_PROBE,
  });

  // ── Bốn thẻ KPI (hàm `kpis()` của mockup) ──────────────────────────────
  const inboundRows = ofType(rows, "INBOUND");
  const outboundRows = ofType(rows, "OUTBOUND");
  const reversalRows = ofType(rows, "REVERSAL");
  const netEffect = sumQty(rows);

  // ── Biểu đồ theo ngày (hàm `chart()` của mockup) ───────────────────────
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(CHART_FALLBACK_WIDTH);

  useEffect(() => {
    const node = chartRef.current;
    if (node === null) return;
    // Mockup đo `getBoundingClientRect().width` rồi vẽ lại mỗi lần resize
    // (debounce 100ms); ResizeObserver bắt luôn cả lần thu/mở sidebar.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setChartWidth(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chart = useMemo(() => {
    const days = [
      ...new Set(
        rows
          .map((row) => row.postedAt.slice(0, 10))
          .filter((day) => day !== ""),
      ),
    ].sort();
    const values = CHART_SERIES.map((series) =>
      days.map((day) =>
        rows
          .filter(
            (row) =>
              row.type === series.type && row.postedAt.slice(0, 10) === day,
          )
          .reduce((total, row) => total + Math.abs(row.qty ?? 0), 0),
      ),
    );
    const max = Math.max(1, ...values.flat());
    const width = Math.max(
      CHART_MIN_WIDTH,
      Math.round(chartWidth || CHART_FALLBACK_WIDTH),
    );
    const right = width - CHART_RIGHT_INSET;
    const plotHeight = CHART_BOTTOM - CHART_TOP;
    const plotWidth = right - CHART_LEFT;
    const xOf = (index: number) =>
      days.length === 1
        ? CHART_LEFT + plotWidth / 2
        : CHART_LEFT + (plotWidth * index) / (days.length - 1);
    const yOf = (value: number) => CHART_BOTTOM - (value / max) * plotHeight;

    /*
     * Mật độ trục X. Mockup có 7 mốc cứng nên vẽ đủ nhãn "01/09/2026" là vừa
     * khung; dữ liệu thật cho chọn kỳ tuỳ ý và ở kỳ 30–365 ngày thì nhãn đủ
     * năm chồng khít lên nhau, chấm điểm dính thành dải đặc, số trên điểm đè
     * lên đường. Thử nhãn đủ năm trước; nếu không đủ chỗ thì rút gọn về
     * "01/09" rồi mới thưa nhãn — mất phần năm rẻ hơn mất mốc.
     */
    const fitFull = fitAxisDensity({
      count: days.length,
      plotWidth,
      labelChars: 10,
      fontSize: CHART_FONT_SIZE,
      markerRadius: CHART_POINT_RADIUS,
    });
    const compactLabels = fitFull.stride > 1;
    const density = compactLabels
      ? fitAxisDensity({
          count: days.length,
          plotWidth,
          labelChars: 5,
          fontSize: CHART_FONT_SIZE,
          markerRadius: CHART_POINT_RADIUS,
        })
      : fitFull;
    const dayLabel = compactLabels ? fmtDayShort : fmtDay;

    return { days, values, max, width, right, xOf, yOf, density, dayLabel };
  }, [rows, chartWidth]);

  // ── Lát cắt đối soát (hàm `slices()` của mockup) ───────────────────────
  const reversalsOf = useMemo(() => {
    const map = new Map<string, IoHistoryRow[]>();
    for (const row of rows) {
      if (row.type !== "REVERSAL" || row.originalDocumentNo === "") continue;
      const bucket = map.get(row.originalDocumentNo) ?? [];
      bucket.push(row);
      map.set(row.originalDocumentNo, bucket);
    }
    return map;
  }, [rows]);

  /**
   * Bộ lọc RIÊNG của khối "Lịch sử chứng từ đã ghi nhận".
   *
   * Bộ lọc đầu trang dựng lại cả KPI, biểu đồ và snapshot; ở đây người đọc chỉ
   * cần khoanh đúng danh sách chứng từ đang soi trong CÙNG lát cắt đã chốt —
   * nên phép lọc này dừng lại trong khối và KHÔNG đụng số liệu phía trên.
   *
   * Áp cho CẢ "Dạng ngang" lẫn "Dạng hộp": hai chế độ là hai cách vẽ của cùng
   * một tập chứng từ, lọc lệch nhau sẽ thành hai sự thật.
   */
  const documentFilterConfig = useMemo<SectionFilterConfig<IoHistoryRow>>(
    () => ({
      searchPlaceholder: t("reports.ioHistory.searchPlaceholder"),
      searchText: (row) => [
        row.documentNo,
        row.party,
        row.actor,
        row.department,
        row.movementNo,
        row.originalDocumentNo,
        row.skuLines.join(" "),
      ],
      selects: [
        {
          key: "type",
          placeholder: t("reports.ioHistory.anyDocType"),
          options: (list) =>
            optionsFromRows(
              list,
              (row) => row.type,
              (value) => typeLabels[value as IoDocType] ?? value,
            ),
          match: (row, value) => row.type === value,
          minWidth: 185,
        },
        {
          key: "department",
          placeholder: t("reports.ioHistory.anyDepartment"),
          options: (list) => optionsFromRows(list, (row) => row.department),
          match: (row, value) => row.department === value,
          minWidth: 175,
        },
        {
          key: "actor",
          placeholder: t("reports.ioHistory.anyActor"),
          options: (list) => optionsFromRows(list, (row) => row.actor),
          match: (row, value) => row.actor === value,
          minWidth: 195,
        },
      ],
    }),
    [t, typeLabels],
  );
  const documentFilter = useSectionFilter(rows, documentFilterConfig);

  const slices = useMemo(
    () =>
      documentFilter.rows
        .filter((row) => row.type !== "REVERSAL")
        .map((row) => {
          const linked = reversalsOf.get(row.documentNo) ?? [];
          return {
            row,
            linked,
            reversalQty: linked.reduce(
              (total, item) => total + Math.abs(item.qty ?? 0),
              0,
            ),
            net: row.qty === null ? null : row.qty + sumQty(linked),
          };
        }),
    [documentFilter.rows, reversalsOf],
  );

  // ── Hộp thoại chi tiết (hàm `dialog()` của mockup) ─────────────────────
  const drill = useMemo(() => {
    if (drillId === null) return null;
    const row = snapshot.rows.find((item) => item.id === drillId);
    if (row === undefined) return null;
    const source =
      row.type === "REVERSAL" && row.originalDocumentNo !== ""
        ? (snapshot.rows.find(
            (item) => item.documentNo === row.originalDocumentNo,
          ) ?? row)
        : row;
    const linked = snapshot.rows.filter(
      (item) =>
        item.type === "REVERSAL" &&
        item.originalDocumentNo !== "" &&
        item.originalDocumentNo === source.documentNo,
    );
    return {
      row,
      source,
      linked,
      reversalQty: linked.reduce(
        (total, item) => total + Math.abs(item.qty ?? 0),
        0,
      ),
      net: source.qty === null ? null : source.qty + sumQty(linked),
    };
  }, [drillId, snapshot.rows]);

  // ── Điều khiển bộ lọc (hàm `controls()` + các handler của mockup) ──────
  const snapshotId = ioSnapshotId(range.from, range.to, type);
  const typeLabel =
    typeOptions.find((option) => option.value === type)?.label ?? allTypesLabel;
  const filterSummary = [
    `${fmtDay(range.from)} → ${fmtDay(range.to)}`,
    type === "" ? t("reports.ioHistory.allDocTypes") : typeLabels[type],
    ...(query.trim() === "" ? [] : [t("reports.ioHistory.filterSearchPrefix")]),
    t("reports.ioHistory.postedOnly"),
  ].join(" · ");

  const resetFilters = useCallback(() => {
    const [start, end] = presetRange("this-month");
    const value = { from: start.format(ISO_DATE), to: end.format(ISO_DATE) };
    setRange(value);
    setType("");
    setQuery("");
    setTypeMenuOpen(false);
  }, []);

  /**
   * Dữ liệu là thật nên "Đặt lại" gọi lại luôn một lượt (mockup chỉ vẽ lại) —
   * và báo cho người dùng biết là đã gọi: lượt gọi lại xong trong ~50ms, chỉ
   * `disabled` thì nút trông như chết (xem `useReportRefresh`).
   */
  const { refreshing, refresh: resetAll } = useReportRefresh({
    refetch,
    readError: () => error,
    beforeRefetch: resetFilters,
  });

  // Đổi tab bằng bàn phím thì focus phải đi theo tab đang chọn (như mockup).
  const tableTabRef = useRef<HTMLButtonElement>(null);
  const sliceTabRef = useRef<HTMLButtonElement>(null);

  const switchView = (next: ViewMode) => {
    setView(next);
    // Sang "Lát cắt" thì mockup thu bộ lọc lại để nhường chỗ cho lưới thẻ.
    if (next === "slice") setFilterVisible(false);
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: ViewMode = view === "table" ? "slice" : "table";
    switchView(next);
    (next === "table" ? tableTabRef : sliceTabRef).current?.focus();
  };

  // Escape: đóng hộp thoại nếu đang mở, nếu không thì đóng hai lớp nổi.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (drillId !== null) {
        setDrillId(null);
        return;
      }
      setTypeMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drillId]);

  const runExport = (format: "xlsx" | "pdf") => {
    void exporter.exportReport(format, {
      reportCode: IO_HISTORY_EXPORT_CODE,
      fileStem: "lich-su-nhap-xuat-kho",
      fileSuffix: `-${range.from}-${range.to}`,
      filters: {
        from_date: range.from,
        to_date: range.to,
        doc_type:
          type === "INBOUND"
            ? "inbound"
            : type === "OUTBOUND"
              ? "outbound"
              : "all",
        status: IO_HISTORY_STATUS,
        ...(query.trim() === "" ? {} : { keyword: query.trim() }),
      },
    });
  };

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
        body: <>{t("reports.ioHistory.loadingData")}</>,
      };
    }
    return null;
  })();

  const kpiCards = [
    {
      tone: "inbound",
      icon: "file",
      label: t("reports.ioHistory.kpiInbound"),
      value: fmt(inboundRows.length),
      note: t("reports.ioHistory.kpiInboundNote", {
        qty: fmt(sumQty(inboundRows)),
      }),
    },
    {
      tone: "outbound",
      icon: "swap",
      label: t("reports.ioHistory.kpiOutbound"),
      value: fmt(outboundRows.length),
      note: t("reports.ioHistory.kpiOutboundNote", {
        qty: fmt(Math.abs(sumQty(outboundRows))),
      }),
    },
    {
      tone: "reversal",
      icon: "undo",
      label: t("reports.ioHistory.kpiReversal"),
      value: fmt(reversalRows.length),
      note: t("reports.ioHistory.kpiReversalNote", {
        qty: fmt(Math.abs(sumQty(reversalRows))),
      }),
    },
    {
      tone: "net",
      icon: "check",
      label: t("reports.ioHistory.kpiNet"),
      value: signed(netEffect),
      note: t("reports.ioHistory.kpiNetNote"),
    },
  ] as const;

  return (
    <div className="hn-rpt-io" data-mvp-screen="RPT-08">
      <div className="content page-wrap">
        <div
          className="breadcrumb"
          aria-label={t("reports.ioHistory.breadcrumbAria")}
        >
          <span>{t("reports.ioHistory.breadcrumbHome")}</span>
          <span aria-hidden="true">/</span>
          <span>{t("reports.ioHistory.breadcrumbReports")}</span>
          <span aria-hidden="true">/</span>
          <strong>{t("reports.ioHistory.title")}</strong>
        </div>

        <section className="reporthead page-header">
          <div className="headtop">
            <div>
              <div className="eyebrow">
                {t("reports.ioHistory.eyebrow", {
                  code: IO_HISTORY_REPORT_CODE,
                })}
              </div>
              <h1>{t("reports.ioHistory.title")}</h1>
            </div>
            <div className="chips scope-block">
              <span className="chip chip-success">
                {t("reports.ioHistory.postedOnly")}
              </span>
            </div>
          </div>
          <div className="meta">
            <b>
              {t("reports.ioHistory.metaCount", { count: fmt(rows.length) })}
            </b>
            <span>
              {t("reports.ioHistory.metaAsOf", {
                time: fmtStamp(snapshot.dataAsOf),
              })}
            </span>
            <span className="truncate">
              {t("reports.ioHistory.metaSlice", { id: snapshotId })}
            </span>
          </div>
        </section>

        {/* ── Bộ lọc báo cáo ────────────────────────────────────────────── */}
        {filterVisible ? (
          <section
            className="card filters filter-card"
            aria-label={t("reports.ioHistory.filterAria")}
          >
            <div className="cardhead">
              <div className="cardhead-l">
                <i className="headicon">
                  <IoIcon name="search" />
                </i>
                <div>
                  <div className="title">
                    {t("reports.ioHistory.filterTitle")}
                  </div>
                  {/*
                   * Ghi thẳng KHOẢNG NGÀY đang xem thay vì tên kỳ. Kỳ nhanh
                   * giờ nằm trong lịch nên tên kỳ không còn là thứ người dùng
                   * vừa bấm; hai mốc ngày thì luôn đúng, kể cả khoảng tự đặt.
                   */}
                  <div className="note">
                    {t("reports.ioHistory.filterNote", {
                      preset: `${fmtDay(range.from)} → ${fmtDay(range.to)}`,
                    })}
                  </div>
                </div>
              </div>
              <span className="chip chip-success">
                {t("reports.ioHistory.postedOnly")}
              </span>
            </div>

            <div className="filtergrid">
              <div className="field">
                <label htmlFor="rptio-from">
                  {t("reports.ioHistory.fieldDateRange")}
                </label>
                <div className="rangewrap">
                  {/*
                   * Bộ chọn khoảng dùng CHUNG với 7 màn Báo cáo còn lại (yêu
                   * cầu 04/09/2026: mọi picker "từ ngày → đến ngày" phải cùng
                   * một giao diện). Trước đây màn này tự dựng lịch riêng —
                   * cùng chức năng nhưng khác hẳn phần còn lại.
                   * `maxDate` giữ đúng ràng buộc của lịch cũ: báo cáo lịch sử
                   * không có dữ liệu tương lai nên không cho chọn quá hôm nay.
                   */}
                  <UiVuexyDateRangePicker
                    aria-label={t("reports.ioHistory.fieldDateRange")}
                    value={[dayjs(range.from), dayjs(range.to)]}
                    format="DD/MM/YYYY"
                    placeholder={[
                      t("reports.ioHistory.fromDate"),
                      t("reports.ioHistory.toDate"),
                    ]}
                    allowClear={false}
                    presets={periodPresets}
                    maxDate={dayjs().startOf("day")}
                    className="hn-vuexy-date-range"
                    popupClassName="hn-vuexy-date-popup"
                    onChange={(value) => {
                      if (!value?.[0] || !value[1]) return;
                      setRange({
                        from: value[0].format(ISO_DATE),
                        to: value[1].format(ISO_DATE),
                      });
                    }}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="rptio-type">
                  {t("reports.ioHistory.fieldDocType")}
                </label>
                <div className="selectwrap">
                  <button
                    id="rptio-type"
                    className="control"
                    type="button"
                    role="combobox"
                    aria-controls="rptio-type-menu"
                    aria-expanded={typeMenuOpen}
                    onClick={() => setTypeMenuOpen((open) => !open)}
                  >
                    {typeLabel}
                    <i className="down" aria-hidden="true">
                      ⌄
                    </i>
                  </button>
                  {typeMenuOpen ? (
                    <div
                      className="menu"
                      id="rptio-type-menu"
                      role="listbox"
                      aria-label={t("reports.ioHistory.fieldDocType")}
                    >
                      {typeOptions.map((option) => (
                        <button
                          key={option.value === "" ? "all" : option.value}
                          className={
                            type === option.value ? "opt active" : "opt"
                          }
                          type="button"
                          role="option"
                          aria-selected={type === option.value}
                          onClick={() => {
                            setType(option.value);
                            setTypeMenuOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="field search">
                <label htmlFor="rptio-query">
                  {t("reports.ioHistory.fieldQuickSearch")}
                </label>
                <div className="control">
                  <IoIcon name="search" />
                  <input
                    id="rptio-query"
                    aria-label={t("reports.ioHistory.quickSearchAria")}
                    placeholder={t("reports.ioHistory.quickSearchPlaceholder")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="actions">
              <button
                className="btn secondary"
                type="button"
                disabled={refreshing || fetching}
                aria-busy={refreshing || undefined}
                onClick={resetAll}
              >
                <span
                  className={
                    refreshing ? "refresh-icon is-spinning" : "refresh-icon"
                  }
                  aria-hidden="true"
                >
                  <IoIcon name="refresh" />
                </span>
                {refreshing
                  ? t("reports.ioHistory.resetting")
                  : t("reports.ioHistory.reset")}
              </button>
              <button
                className="btn excel"
                type="button"
                disabled={!canExport || exporter.exporting !== null}
                title={
                  canExport ? undefined : t("reports.ioHistory.exportDenied")
                }
                onClick={() => runExport("xlsx")}
              >
                <IoIcon name="download" />
                {t("reports.ioHistory.exportXlsx")}
              </button>
              <button
                className="btn pdf"
                type="button"
                disabled={!canExport || exporter.exporting !== null}
                title={
                  canExport ? undefined : t("reports.ioHistory.exportDenied")
                }
                onClick={() => runExport("pdf")}
              >
                <IoIcon name="download" />
                {t("reports.ioHistory.exportPdf")}
              </button>
            </div>
          </section>
        ) : null}

        <ReportRangeAdviceBanner
          advice={rangeAdvice}
          onApply={(next) => setRange({ from: next.from, to: next.to })}
        />

        {pageAlert !== null ? (
          <div className={pageAlert.tone} role="note">
            {pageAlert.body}
          </div>
        ) : null}

        {/* ── Tổng quan ─────────────────────────────────────────────────── */}
        <section
          className="report-section-block"
          aria-labelledby="rptio-summary"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.ioHistory.summaryEyebrow")}
              </span>
              <h2 id="rptio-summary">{t("reports.ioHistory.summaryTitle")}</h2>
            </div>
            <span className="section-meta">
              {t("reports.ioHistory.summaryMeta")}
            </span>
          </div>
          <div
            className="kpis"
            role="region"
            aria-label={t("reports.ioHistory.kpisAria")}
          >
            {kpiCards.map((card) => (
              <article
                key={card.label}
                className="card kpi"
                data-tone={card.tone}
              >
                <div className="kpitop">
                  <span className="kpilabel">{card.label}</span>
                  <i className="kpiicon">
                    <IoIcon name={card.icon} />
                  </i>
                </div>
                <div className="kpivalue">{card.value}</div>
                <div className="kpinote">{card.note}</div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Biểu đồ theo ngày ─────────────────────────────────────────── */}
        <section
          className="report-section-block"
          aria-labelledby="rptio-movement"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t("reports.ioHistory.movementEyebrow")}
              </span>
              <h2 id="rptio-movement">
                {t("reports.ioHistory.movementTitle")}
              </h2>
            </div>
            <span className="section-meta">
              {/* UAT TC_UI_14 (Note): không phơi tên múi giờ IANA ra màn
                  nghiệp vụ. */}
              {t("reports.ioHistory.movementMeta")}
            </span>
          </div>
          <section className="card chart">
            <div className="cardhead">
              <div className="cardhead-l">
                <i className="headicon is-info">
                  <IoIcon name="trend" />
                </i>
                <div>
                  <div className="title">
                    {t("reports.ioHistory.chartTitle")}
                  </div>
                  <div className="note">{t("reports.ioHistory.chartNote")}</div>
                </div>
              </div>
              <span className="chip chip-info">
                {t("reports.ioHistory.chartSource")}
              </span>
            </div>
            <div className="chartbody" ref={chartRef}>
              <div className="legend">
                {CHART_SERIES.map((series) => (
                  <span key={series.type} className={series.className}>
                    <i aria-hidden="true" />
                    {typeLabels[series.type]}
                  </span>
                ))}
              </div>
              <svg
                className="chartsvg"
                viewBox={`0 0 ${chart.width} ${CHART_VIEW_HEIGHT}`}
                role="img"
                aria-label={t("reports.ioHistory.chartAria")}
              >
                {[0, 0.5, 1].map((ratio) => {
                  const y = CHART_BOTTOM - (CHART_BOTTOM - CHART_TOP) * ratio;
                  return (
                    <g key={ratio}>
                      <line
                        className="chart-grid"
                        x1={CHART_LEFT}
                        y1={y}
                        x2={chart.right}
                        y2={y}
                      />
                      <text x={CHART_LEFT - 10} y={y + 4} textAnchor="end">
                        {fmt(Math.round(chart.max * ratio))}
                      </text>
                    </g>
                  );
                })}

                {chart.days.length === 0 ? (
                  <text
                    x={chart.width / 2}
                    y={CHART_EMPTY_Y}
                    textAnchor="middle"
                  >
                    {t("reports.ioHistory.chartEmpty")}
                  </text>
                ) : (
                  <>
                    {(() => {
                      /*
                       * UAT TC_UI_25: nhãn giá trị chỉ còn ở ĐIỂM CUỐI mỗi
                       * chuỗi — bản trước in số trên mọi điểm của cả 4 chuỗi,
                       * kỳ mặc định 9 ngày là ~36 con số giẫm lên nhau và lên
                       * cả đường vẽ (đúng lời phàn nàn "biểu đồ không phù
                       * hợp"). Nhãn cuối của 4 chuỗi cùng hoành độ nên phải
                       * GIÃN DỌC (spreadEndValues) + viền nền (halo, CSS
                       * .chart-endvalue) — đồng bộ đúng mẫu biểu đồ RPT-01 đã
                       * qua UAT.
                       */
                      const lastIndex = chart.days.length - 1;
                      const endValueY = spreadEndValues(
                        chart.values.map((points) =>
                          chart.yOf(points[lastIndex] ?? 0),
                        ),
                      );
                      return CHART_SERIES.map((series, seriesIndex) => {
                      const points = chart.values[seriesIndex];
                      return (
                        <g key={series.type} className={series.className}>
                          <polyline
                            className="chart-line"
                            data-series={series.type}
                            points={points
                              .map(
                                (value, index) =>
                                  `${chart.xOf(index)},${chart.yOf(value)}`,
                              )
                              .join(" ")}
                          />
                          {points.map((value, index) => {
                            const x = chart.xOf(index);
                            const y = chart.yOf(value);
                            const last = index === lastIndex;
                            const showPoint = chart.density.showMarkers || last;
                            const showValue = last && value !== 0;
                            if (!showPoint && !showValue) return null;
                            return (
                              <g key={chart.days[index]}>
                                {showPoint ? (
                                  <circle
                                    className="chart-point"
                                    cx={x}
                                    cy={y}
                                    r={
                                      chart.density.showMarkers
                                        ? chart.density.markerRadius
                                        : CHART_POINT_RADIUS
                                    }
                                  />
                                ) : null}
                                {showValue ? (
                                  <text
                                    className="chart-endvalue"
                                    x={x - 7}
                                    y={endValueY[seriesIndex]}
                                    textAnchor="end"
                                  >
                                    {fmt(value)}
                                  </text>
                                ) : null}
                              </g>
                            );
                          })}
                        </g>
                      );
                      });
                    })()}
                    {chart.days.map((day, index) =>
                      chart.density.showLabel(index) ? (
                        <text
                          key={day}
                          x={chart.xOf(index)}
                          y={CHART_AXIS_Y}
                          textAnchor={
                            index === 0
                              ? "start"
                              : index === chart.days.length - 1
                                ? "end"
                                : "middle"
                          }
                        >
                          {chart.dayLabel(day)}
                        </text>
                      ) : null,
                    )}
                  </>
                )}
              </svg>
            </div>
          </section>
        </section>

        {/* ── Dải bộ lọc đang áp dụng (khi bộ lọc bị thu) ───────────────── */}
        {filterVisible ? null : (
          <div className="card collapsed">
            <div className="summary">
              <b>{t("reports.ioHistory.collapsedTitle")}</b>
              <span>{filterSummary}</span>
            </div>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setFilterVisible(true)}
            >
              <IoIcon name="search" />
              {t("reports.ioHistory.showFilters")}
            </button>
          </div>
        )}

        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {t("reports.ioHistory.detailEyebrow")}
            </span>
            <h2>{t("reports.ioHistory.detailTitle")}</h2>
          </div>
          <span className="section-meta">
            {t("reports.ioHistory.detailMeta")}
          </span>
        </div>

        <div
          className="tabs"
          role="tablist"
          aria-label={t("reports.ioHistory.tabsAria")}
          onKeyDown={onTabKeyDown}
        >
          <button
            ref={tableTabRef}
            id="rptio-tab-table"
            className="tab"
            type="button"
            role="tab"
            aria-selected={shownView === "table"}
            aria-controls="rptio-panel-table"
            onClick={() => switchView("table")}
          >
            <IoIcon name="list" />
            {t("reports.ioHistory.viewTable")}
          </button>
          <button
            ref={sliceTabRef}
            id="rptio-tab-slice"
            className="tab"
            type="button"
            role="tab"
            aria-selected={shownView === "slice"}
            aria-controls="rptio-panel-slice"
            onClick={() => switchView("slice")}
          >
            <IoIcon name="grid-2x2-plus" />
            {t("reports.ioHistory.viewSlice")}
          </button>
        </div>

        <SectionFilterBar
          state={documentFilter}
          label={t("reports.ioHistory.detailTitle")}
          unit={t("reports.ioHistory.tableUnit")}
          showCount={false}
          data-testid="rptio-document-section-filter"
        />

        {/* ── Bảng ──────────────────────────────────────────────────────── */}
        {deferredView === "table" ? (
          <section
            id="rptio-panel-table"
            className="card"
            role="tabpanel"
            aria-labelledby="rptio-tab-table"
            data-report-view-panel="table"
          >
            <div className="cardhead">
              <div className="cardhead-l">
                <i className="headicon is-info">
                  <IoIcon name="list" />
                </i>
                <div>
                  <div className="title">
                    {t("reports.ioHistory.detailTitle")}
                  </div>
                  <div className="note">
                    {t("reports.ioHistory.tableNote", {
                      id: snapshotId,
                      time: fmtStamp(snapshot.dataAsOf),
                    })}
                  </div>
                </div>
              </div>
              <span className="chip chip-info">
                {t("reports.ioHistory.docCount", {
                  count: fmt(documentFilter.rows.length),
                })}
              </span>
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th className="stt-col">{t("shared.table.rowNumber")}</th>
                    <th>{t("reports.ioHistory.colDocument")}</th>
                    <th>{t("reports.ioHistory.colType")}</th>
                    <th>{t("reports.ioHistory.colStatus")}</th>
                    <th>{t("reports.ioHistory.colCreatedAt")}</th>
                    <th>{t("reports.ioHistory.colPostedAt")}</th>
                    <th className="qty">{t("reports.ioHistory.colQty")}</th>
                    <th>{t("reports.ioHistory.colActor")}</th>
                    <th>{t("reports.ioHistory.colParty")}</th>
                    <th>{t("reports.ioHistory.colMovement")}</th>
                    <th>{t("reports.ioHistory.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {documentFilter.rows.length === 0 ? (
                    <tr>
                      <td className="empty-row" colSpan={11}>
                        {t("reports.ioHistory.tableEmpty")}
                      </td>
                    </tr>
                  ) : (
                    documentFilter.rows.map((row, index) => (
                      <tr key={row.id} data-drill-key={row.id}>
                        <td className="stt-col">{index + 1}</td>
                        <td>
                          <div className="cell">
                            {row.documentNo === ""
                              ? EMPTY_TEXT
                              : row.documentNo}
                          </div>
                          <div className="sub">{movementLabelOf(row)}</div>
                        </td>
                        <td>
                          <span className={`type ${toneOf(row.type)}`}>
                            {typeLabels[row.type]}
                          </span>
                        </td>
                        <td>
                          <span className="chip ok">
                            {reportStatusLabel(
                              row.status === ""
                                ? IO_HISTORY_STATUS
                                : row.status,
                            )}
                          </span>
                        </td>
                        <td>{fmtStamp(row.createdAt)}</td>
                        <td>{fmtStamp(row.postedAt)}</td>
                        <td className="qty">
                          {row.qty === null ? (
                            EMPTY_TEXT
                          ) : (
                            <span className={`qty-chip ${qtyToneOf(row.qty)}`}>
                              {signed(row.qty)}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="cell">
                            {row.actor === "" ? EMPTY_TEXT : row.actor}
                          </div>
                          <div className="sub">
                            {row.department === ""
                              ? EMPTY_TEXT
                              : row.department}
                          </div>
                        </td>
                        <td>
                          <div className="cell">
                            {row.party === "" ? EMPTY_TEXT : row.party}
                          </div>
                        </td>
                        <td>
                          <div className="cell">{movementLabelOf(row)}</div>
                          <div className="sub">
                            {row.originalDocumentNo === ""
                              ? ""
                              : t("reports.ioHistory.originalPrefix", {
                                  code: row.originalDocumentNo,
                                })}
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => setDrillId(row.id)}
                          >
                            {t("reports.ioHistory.view")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="tfoot">
              <span>
                {t("reports.ioHistory.tfootNoPaging", {
                  count: fmt(rows.length),
                })}
              </span>
              <span>{t("reports.ioHistory.tfootSameRows")}</span>
            </div>
          </section>
        ) : (
          /* ── Lát cắt ─────────────────────────────────────────────────── */
          <section
            id="rptio-panel-slice"
            className="card"
            role="tabpanel"
            aria-labelledby="rptio-tab-slice"
            data-report-view-panel="slice"
          >
            <div className="cardhead">
              <div className="cardhead-l">
                <i className="headicon">
                  <IoIcon name="grid-2x2-plus" />
                </i>
                <div>
                  <div className="title">
                    {t("reports.ioHistory.sliceTitle")}
                  </div>
                  <div className="note">{t("reports.ioHistory.sliceNote")}</div>
                </div>
              </div>
              <span className="chip chip-info">
                {t("reports.ioHistory.sourceRowCount", {
                  count: fmt(rows.length),
                })}
              </span>
            </div>
            <div className="slices">
              {slices.length === 0 ? (
                <div className="empty-row">
                  {t("reports.ioHistory.sliceEmpty")}
                </div>
              ) : (
                slices.map((slice, index) => (
                  <article
                    key={slice.row.id}
                    className="slice"
                    data-drill-key={slice.row.id}
                  >
                    <div className="slicetop">
                      <div>
                        <div className="stt-badge">
                          {t("shared.table.rowNumber")} {index + 1}
                        </div>
                        <div className="cell">
                          {slice.row.documentNo === ""
                            ? EMPTY_TEXT
                            : slice.row.documentNo}
                        </div>
                        <div className="sub">
                          {slice.row.party === ""
                            ? EMPTY_TEXT
                            : slice.row.party}
                        </div>
                      </div>
                      <span className={`type ${toneOf(slice.row.type)}`}>
                        {typeLabels[slice.row.type]}
                      </span>
                    </div>
                    <div className="slicemetrics">
                      <div>
                        <small>{t("reports.ioHistory.sliceTotal")}</small>
                        <b>{absOrEmpty(slice.row.qty)}</b>
                      </div>
                      <div>
                        <small>{t("reports.ioHistory.sliceReversal")}</small>
                        <b>{fmt(slice.reversalQty)}</b>
                      </div>
                      <div>
                        <small>{t("reports.ioHistory.sliceNet")}</small>
                        <b>{signedOrEmpty(slice.net)}</b>
                      </div>
                    </div>
                    <div className="slicefoot">
                      <span>
                        {t("reports.ioHistory.sliceMilestones", {
                          count: 1 + slice.linked.length,
                        })}
                      </span>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => setDrillId(slice.row.id)}
                      >
                        {t("reports.ioHistory.reconcile")}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── Hộp thoại chi tiết chứng từ ─────────────────────────────────── */}
      {drill === null ? null : (
        <div
          className="backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDrillId(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rptio-detail-title"
          >
            <div className="modalhead">
              <div>
                <h2 id="rptio-detail-title">
                  {drill.row.documentNo === ""
                    ? EMPTY_TEXT
                    : drill.row.documentNo}
                </h2>
                <div className="note">{t("reports.ioHistory.drawerNote")}</div>
              </div>
              <button
                className="btn secondary"
                type="button"
                aria-label={t("reports.ioHistory.drawerClose")}
                onClick={() => setDrillId(null)}
              >
                ×
              </button>
            </div>
            <div className="modalbody">
              <section className="detail-summary">
                <div>
                  <small>{t("reports.ioHistory.selectedDoc")}</small>
                  <strong>
                    {drill.row.documentNo === ""
                      ? EMPTY_TEXT
                      : drill.row.documentNo}
                  </strong>
                  <span className={`chip ${toneOf(drill.row.type)}`}>
                    {typeLabels[drill.row.type]} ·{" "}
                    {reportStatusLabel(
                      drill.row.status === ""
                        ? IO_HISTORY_STATUS
                        : drill.row.status,
                    )}
                  </span>
                </div>
                <div className="detail-qty">{signedOrEmpty(drill.row.qty)}</div>
              </section>

              <section className="detail-section">
                <h3>{t("reports.ioHistory.sectionDocInfo")}</h3>
                <div className="detail-grid">
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldSourceDoc")}</small>
                    <b>
                      {drill.source.documentNo === ""
                        ? EMPTY_TEXT
                        : drill.source.documentNo}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldActorDept")}</small>
                    <b>
                      {[drill.row.actor, drill.row.department]
                        .filter((part) => part !== "")
                        .join(" · ") || EMPTY_TEXT}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldParty")}</small>
                    <b>
                      {drill.row.party === "" ? EMPTY_TEXT : drill.row.party}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldSkuLines")}</small>
                    <b>
                      {drill.row.skuLines.length === 0
                        ? EMPTY_TEXT
                        : drill.row.skuLines.join(" · ")}
                    </b>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>{t("reports.ioHistory.sectionTiming")}</h3>
                <div className="detail-grid">
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldCreatedAt")}</small>
                    <b>{fmtStamp(drill.row.createdAt)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldPostedAt")}</small>
                    <b>{fmtStamp(drill.row.postedAt)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldMovement")}</small>
                    <b>{movementLabelOf(drill.row)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldLinked")}</small>
                    <b>
                      {drill.row.originalDocumentNo === ""
                        ? t("reports.ioHistory.none")
                        : drill.row.originalDocumentNo}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>{t("reports.ioHistory.fieldHistory")}</small>
                    <b>
                      {t("reports.ioHistory.historyValue", {
                        count: 1 + drill.linked.length,
                        type: typeLabels[drill.row.type],
                      })}
                    </b>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>{t("reports.ioHistory.sectionQtyRecon")}</h3>
                <div className="detail-recon">
                  <div>
                    <small>{t("reports.ioHistory.totalPosted")}</small>
                    <b>{absOrEmpty(drill.source.qty)}</b>
                  </div>
                  <div>
                    <small>{t("reports.ioHistory.sliceReversal")}</small>
                    <b>{fmt(drill.reversalQty)}</b>
                  </div>
                  <div>
                    <small>{t("reports.ioHistory.kpiNet")}</small>
                    <b>{signedOrEmpty(drill.net)}</b>
                  </div>
                </div>
              </section>

              <p className="detail-hint">{t("reports.ioHistory.drawerHint")}</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
