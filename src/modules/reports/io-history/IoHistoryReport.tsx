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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useAuthStore } from "@/shared/store/auth.store";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import { shortId } from "@/shared/utils/shortId";
import {
  fmt,
  presetRange,
  type PeriodPreset,
} from "@/modules/reports/operations/report-format";
import { useReportExport } from "@/modules/reports/operations/report-export";
import { useReportRefresh } from "@/modules/reports/operations/report-refresh";
import { IoIcon } from "./io-history-icons";
import {
  IO_HISTORY_EXPORT_CODE,
  IO_HISTORY_REPORT_CODE,
  IO_HISTORY_STATUS,
  IO_HISTORY_TIMEZONE,
  ISO_DATE,
  ioSnapshotId,
  useIoHistorySnapshot,
  type IoDocType,
  type IoHistoryRow,
  type IoTypeFilter,
} from "./io-history-api";
import "./io-history-report.css";

/** Nhãn loại chứng từ — chép nguyên `labels` của mockup. */
const TYPE_LABELS: Readonly<Record<IoDocType, string>> = {
  INBOUND: "Nhập kho",
  OUTBOUND: "Xuất kho",
  REVERSAL: "Hoàn tác",
};

/** Nhãn kỳ báo cáo — chép nguyên `pl` của mockup. */
const PRESET_LABELS: Readonly<Record<PeriodPreset, string>> = {
  "this-week": "Tuần này",
  "this-month": "Tháng này",
  "this-quarter": "Quý này",
  "this-year": "Năm nay",
  custom: "Tùy chọn",
};

/** Năm nút kỳ báo cáo, đúng thứ tự và nhãn ngắn của mockup. */
const PERIOD_BUTTONS: ReadonlyArray<{ value: PeriodPreset; label: string }> = [
  { value: "this-week", label: "Tuần" },
  { value: "this-month", label: "Tháng" },
  { value: "this-quarter", label: "Quý" },
  { value: "this-year", label: "Năm" },
  { value: "custom", label: "Tùy chọn" },
];

const ALL_TYPES_LABEL = "Tất cả loại đã ghi nhận";

/** Bốn lựa chọn của menu "Loại chứng từ". */
const TYPE_OPTIONS: ReadonlyArray<{ value: IoTypeFilter; label: string }> = [
  { value: "", label: ALL_TYPES_LABEL },
  { value: "INBOUND", label: TYPE_LABELS.INBOUND },
  { value: "OUTBOUND", label: TYPE_LABELS.OUTBOUND },
  { value: "REVERSAL", label: TYPE_LABELS.REVERSAL },
];

/** Hàng thứ trong tuần của lịch — mockup bắt đầu từ Thứ Hai. */
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

/** Ba chuỗi của biểu đồ, đúng thứ tự và màu của mockup. */
const CHART_SERIES: ReadonlyArray<{
  type: IoDocType;
  label: string;
  className: string;
}> = [
  { type: "INBOUND", label: TYPE_LABELS.INBOUND, className: "series-inbound" },
  {
    type: "OUTBOUND",
    label: TYPE_LABELS.OUTBOUND,
    className: "series-outbound",
  },
  {
    type: "REVERSAL",
    label: TYPE_LABELS.REVERSAL,
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

/** "01/09/2026" — đúng hàm `day` của mockup. */
function fmtDay(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : EMPTY_TEXT;
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
 * Nhãn cột "Movement".
 *
 * Một chứng từ nhiều dòng SKU sinh nhiều movement; chọn bừa một cái làm đại
 * diện là bịa, nên chỉ hiện id khi đúng một movement.
 */
function movementLabelOf(row: IoHistoryRow): string {
  if (row.movementCount === 0) return EMPTY_TEXT;
  if (row.movementCount === 1) {
    return shortId(row.movementId) === ""
      ? EMPTY_TEXT
      : shortId(row.movementId);
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
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canExport = hasAnyWmsPermission(
    permissionCodes,
    WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
    isSuperAdmin,
  );

  // ── State của mockup (`st`) ────────────────────────────────────────────
  const [preset, setPreset] = useState<PeriodPreset>("this-month");
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const [start, end] = presetRange("this-month");
    return { from: start.format(ISO_DATE), to: end.format(ISO_DATE) };
  });
  const [type, setType] = useState<IoTypeFilter>("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("table");
  const [filterVisible, setFilterVisible] = useState(true);
  const [dateOpen, setDateOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  /** Khoảng ngày đang chọn tạm trong lịch — chỉ "Áp dụng" mới đổi bộ lọc. */
  const [draft, setDraft] = useState<{ from: string; to: string }>(() => range);
  const [choosing, setChoosing] = useState<"from" | "to">("from");
  const [pickerMonth, setPickerMonth] = useState<Dayjs>(() =>
    dayjs(range.from).startOf("month"),
  );
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
    return { days, values, max, width, right, xOf, yOf };
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

  const slices = useMemo(
    () =>
      rows
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
    [rows, reversalsOf],
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
    TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    ALL_TYPES_LABEL;
  const filterSummary = [
    `${fmtDay(range.from)} → ${fmtDay(range.to)}`,
    type === "" ? "Tất cả loại chứng từ" : TYPE_LABELS[type],
    ...(query.trim() === "" ? [] : [`Tìm: ${query.trim()}`]),
    "POSTED only",
  ].join(" · ");

  const applyPreset = (next: PeriodPreset) => {
    setPreset(next);
    if (next === "custom") {
      // Mockup mở luôn phần chọn tay khi bấm "Tùy chọn" — giữ nguyên khoảng
      // đang xem làm khoảng nháp để người dùng chỉnh tiếp.
      setDraft(range);
      setPickerMonth(dayjs(range.from).startOf("month"));
      setChoosing("from");
      setDateOpen(true);
      setTypeMenuOpen(false);
      return;
    }
    const [start, end] = presetRange(next);
    const value = { from: start.format(ISO_DATE), to: end.format(ISO_DATE) };
    setRange(value);
    setDraft(value);
    setPickerMonth(start.startOf("month"));
  };

  const resetFilters = useCallback(() => {
    const [start, end] = presetRange("this-month");
    const value = { from: start.format(ISO_DATE), to: end.format(ISO_DATE) };
    setPreset("this-month");
    setRange(value);
    setDraft(value);
    setPickerMonth(start.startOf("month"));
    setType("");
    setQuery("");
    setDateOpen(false);
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

  const toggleDatePicker = () => {
    setDateOpen((open) => {
      if (open) return false;
      setDraft(range);
      setPickerMonth(dayjs(range.from).startOf("month"));
      setChoosing("from");
      return true;
    });
    setTypeMenuOpen(false);
  };

  const pickDay = (day: string) => {
    if (choosing === "from") {
      setDraft((current) => ({ ...current, from: day }));
      setChoosing("to");
      return;
    }
    setDraft((current) => {
      // Chọn ngược thì đảo lại hai đầu — đúng nhánh swap của mockup.
      const swapped = day < current.from;
      return swapped
        ? { from: day, to: current.from }
        : { ...current, to: day };
    });
    setChoosing("from");
  };

  const applyDate = () => {
    setRange(draft);
    setPreset("custom");
    setDateOpen(false);
    setChoosing("from");
  };

  const cancelDate = () => {
    setDraft(range);
    setDateOpen(false);
    setChoosing("from");
  };

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
      setDateOpen(false);
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
      return { tone: "page-alert is-info", body: <>Đang tải số liệu…</> };
    }
    return null;
  })();

  // ── Lịch chọn khoảng ngày ──────────────────────────────────────────────
  const today = dayjs().startOf("day");
  const daysInMonth = pickerMonth.daysInMonth();
  /** Số ô đệm để ngày 1 rơi đúng cột thứ của nó (lịch bắt đầu từ Thứ Hai). */
  const leadingBlanks = (pickerMonth.date(1).day() + 6) % 7;
  const canGoNextMonth = pickerMonth
    .endOf("month")
    .isBefore(today.endOf("month"));

  const kpiCards = [
    {
      tone: "inbound",
      icon: "file",
      label: "Phiếu nhập",
      value: fmt(inboundRows.length),
      note: `${fmt(sumQty(inboundRows))} đơn vị tăng`,
    },
    {
      tone: "outbound",
      icon: "swap",
      label: "Xuất kho",
      value: fmt(outboundRows.length),
      note: `${fmt(Math.abs(sumQty(outboundRows)))} đơn vị giảm`,
    },
    {
      tone: "reversal",
      icon: "undo",
      label: "Hoàn tác",
      value: fmt(reversalRows.length),
      note: `${fmt(Math.abs(sumQty(reversalRows)))} đơn vị đã xác định dấu`,
    },
    {
      tone: "net",
      icon: "check",
      label: "Ảnh hưởng ròng",
      value: signed(netEffect),
      note: "Chỉ cộng movement/qty có dấu xác định",
    },
  ] as const;

  return (
    <div className="hn-rpt-io" data-mvp-screen="RPT-08">
      <div className="content page-wrap">
        <div className="breadcrumb" aria-label="Đường dẫn">
          <span>Trang chủ</span>
          <span aria-hidden="true">/</span>
          <span>Báo cáo</span>
          <span aria-hidden="true">/</span>
          <strong>Lịch sử nhập – xuất kho</strong>
        </div>

        <section className="reporthead page-header">
          <div className="headtop">
            <div>
              <div className="eyebrow">
                BÁO CÁO VẬN HÀNH · {IO_HISTORY_REPORT_CODE}
              </div>
              <h1>Lịch sử nhập – xuất kho</h1>
              <p>
                Theo dõi biến động theo <b>posted_at</b>; chỉ hiển thị chứng từ
                đã ghi nhận theo timezone <b>{IO_HISTORY_TIMEZONE}</b>.
              </p>
            </div>
            <div className="chips scope-block">
              <span className="chip chip-info">{IO_HISTORY_REPORT_CODE}</span>
              <span className="chip chip-success">POSTED only</span>
            </div>
          </div>
          <div className="meta">
            <b>{fmt(rows.length)} chứng từ đã ghi nhận</b>
            <span>Data as-of: {fmtStamp(snapshot.dataAsOf)}</span>
            <span className="truncate">Snapshot: {snapshotId}</span>
          </div>
        </section>

        {/* ── Bộ lọc báo cáo ────────────────────────────────────────────── */}
        {filterVisible ? (
          <section
            className="card filters filter-card"
            aria-label="Bộ lọc báo cáo"
          >
            <div className="cardhead">
              <div className="cardhead-l">
                <i className="headicon">
                  <IoIcon name="search" />
                </i>
                <div>
                  <div className="title">Bộ lọc báo cáo</div>
                  <div className="note">
                    {PRESET_LABELS[preset]} · Sắp xếp mặc định: mới nhất trước
                  </div>
                </div>
              </div>
              <span className="chip chip-success">POSTED only</span>
            </div>

            <div className="filtergrid">
              <div className="field">
                <label htmlFor="rptio-period">Kỳ báo cáo</label>
                <div
                  className="periods"
                  id="rptio-period"
                  role="group"
                  aria-label="Kỳ báo cáo"
                >
                  {PERIOD_BUTTONS.map((item) => (
                    <button
                      key={item.value}
                      className={
                        preset === item.value ? "period active" : "period"
                      }
                      type="button"
                      aria-pressed={preset === item.value}
                      onClick={() => applyPreset(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="rptio-from">Từ ngày / Đến ngày</label>
                <div className="rangewrap">
                  <div className="range">
                    <button
                      id="rptio-from"
                      className="control"
                      type="button"
                      aria-expanded={dateOpen}
                      onClick={() => {
                        setChoosing("from");
                        toggleDatePicker();
                      }}
                    >
                      {fmtDay(range.from)}
                    </button>
                    <i aria-hidden="true">→</i>
                    <button
                      className="control"
                      type="button"
                      aria-label="Đến ngày"
                      aria-expanded={dateOpen}
                      onClick={() => {
                        setChoosing("to");
                        toggleDatePicker();
                      }}
                    >
                      {fmtDay(range.to)}
                    </button>
                  </div>

                  {dateOpen ? (
                    <div
                      className="picker"
                      role="dialog"
                      aria-label="Chọn khoảng ngày"
                    >
                      <div className="pickhead">
                        <span>{pickerMonth.format("[Tháng] MM / YYYY")}</span>
                        <span className="picknav">
                          <button
                            type="button"
                            aria-label="Tháng trước"
                            onClick={() =>
                              setPickerMonth((month) =>
                                month.subtract(1, "month"),
                              )
                            }
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            aria-label="Tháng sau"
                            disabled={!canGoNextMonth}
                            onClick={() =>
                              setPickerMonth((month) => month.add(1, "month"))
                            }
                          >
                            ›
                          </button>
                        </span>
                      </div>
                      <div className="pickstate">
                        Đang chọn {choosing === "from" ? "Từ ngày" : "Đến ngày"}
                      </div>
                      <div className="cal">
                        {WEEKDAYS.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                        {Array.from({ length: leadingBlanks }, (_, index) => (
                          <span
                            key={`pad-${index}`}
                            className="day-pad"
                            aria-hidden="true"
                          />
                        ))}
                        {Array.from({ length: daysInMonth }, (_, index) => {
                          const date = pickerMonth.date(index + 1);
                          const iso = date.format(ISO_DATE);
                          const selected =
                            iso === draft.from || iso === draft.to;
                          const between = iso >= draft.from && iso <= draft.to;
                          return (
                            <button
                              key={iso}
                              className={[
                                "day",
                                between ? "between" : "",
                                selected ? "selected" : "",
                              ]
                                .filter((token) => token !== "")
                                .join(" ")}
                              type="button"
                              disabled={date.isAfter(today, "day")}
                              aria-label={date.format("DD/MM/YYYY")}
                              onClick={() => pickDay(iso)}
                            >
                              {String(index + 1).padStart(2, "0")}
                            </button>
                          );
                        })}
                      </div>
                      <div className="pickfoot">
                        <button
                          className="btn secondary"
                          type="button"
                          onClick={cancelDate}
                        >
                          Hủy
                        </button>
                        <button
                          className="btn primary"
                          type="button"
                          onClick={applyDate}
                        >
                          Áp dụng
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="field">
                <label htmlFor="rptio-type">Loại chứng từ</label>
                <div className="selectwrap">
                  <button
                    id="rptio-type"
                    className="control"
                    type="button"
                    role="combobox"
                    aria-controls="rptio-type-menu"
                    aria-expanded={typeMenuOpen}
                    onClick={() => {
                      setTypeMenuOpen((open) => !open);
                      setDateOpen(false);
                    }}
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
                      aria-label="Loại chứng từ"
                    >
                      {TYPE_OPTIONS.map((option) => (
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
                <label htmlFor="rptio-query">Tìm nhanh</label>
                <div className="control">
                  <IoIcon name="search" />
                  <input
                    id="rptio-query"
                    aria-label="Tìm lịch sử nhập xuất"
                    placeholder="Mã phiếu / yêu cầu / người nhận"
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
                {refreshing ? "Đang đặt lại…" : "Đặt lại"}
              </button>
              <button
                className="btn excel"
                type="button"
                disabled={!canExport || exporter.exporting !== null}
                title={
                  canExport
                    ? undefined
                    : "Cần quyền xuất báo cáo (REPORT_EXPORT)"
                }
                onClick={() => runExport("xlsx")}
              >
                <IoIcon name="download" />
                Xuất XLSX
              </button>
              <button
                className="btn pdf"
                type="button"
                disabled={!canExport || exporter.exporting !== null}
                title={
                  canExport
                    ? undefined
                    : "Cần quyền xuất báo cáo (REPORT_EXPORT)"
                }
                onClick={() => runExport("pdf")}
              >
                <IoIcon name="download" />
                Xuất PDF
              </button>
            </div>
          </section>
        ) : null}

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
              <span className="eyebrow">TÌNH HÌNH HIỆN TẠI</span>
              <h2 id="rptio-summary">Tổng quan lịch sử nhập – xuất</h2>
            </div>
            <span className="section-meta">
              Chỉ tính chứng từ POSTED · Đơn vị: chứng từ
            </span>
          </div>
          <div className="kpis" role="region" aria-label="Tổng quan vận hành">
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
              <span className="eyebrow">PHÂN TÍCH VẬN HÀNH</span>
              <h2 id="rptio-movement">Biến động nhập – xuất theo ngày</h2>
            </div>
            <span className="section-meta">
              Theo posted_at · {IO_HISTORY_TIMEZONE}
            </span>
          </div>
          <section className="card chart">
            <div className="cardhead">
              <div className="cardhead-l">
                <i className="headicon is-info">
                  <IoIcon name="trend" />
                </i>
                <div>
                  <div className="title">Khối lượng ghi nhận theo ngày</div>
                  <div className="note">
                    Xu hướng số lượng theo posted_at; chỉ tính chứng từ POSTED
                    có số lượng xác định.
                  </div>
                </div>
              </div>
              <span className="chip chip-info">Nguồn: sổ movement</span>
            </div>
            <div className="chartbody" ref={chartRef}>
              <div className="legend">
                {CHART_SERIES.map((series) => (
                  <span key={series.type} className={series.className}>
                    <i aria-hidden="true" />
                    {series.label}
                  </span>
                ))}
              </div>
              <svg
                className="chartsvg"
                viewBox={`0 0 ${chart.width} ${CHART_VIEW_HEIGHT}`}
                role="img"
                aria-label="Biểu đồ đường khối lượng nhập xuất"
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
                    Không có dữ liệu POSTED theo bộ lọc
                  </text>
                ) : (
                  <>
                    {CHART_SERIES.map((series, seriesIndex) => {
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
                            const last = index === chart.days.length - 1;
                            return (
                              <g key={chart.days[index]}>
                                <circle
                                  className="chart-point"
                                  cx={x}
                                  cy={y}
                                  r={CHART_POINT_RADIUS}
                                />
                                {value === 0 ? null : (
                                  <text
                                    x={last ? x - 7 : x + 7}
                                    y={y - 8}
                                    textAnchor={last ? "end" : "start"}
                                  >
                                    {fmt(value)}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}
                    {chart.days.map((day, index) => (
                      <text
                        key={day}
                        x={chart.xOf(index)}
                        y={CHART_AXIS_Y}
                        textAnchor="middle"
                      >
                        {fmtDay(day)}
                      </text>
                    ))}
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
              <b>Bộ lọc đang áp dụng</b>
              <span>{filterSummary}</span>
            </div>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setFilterVisible(true)}
            >
              <IoIcon name="search" />
              Hiện bộ lọc
            </button>
          </div>
        )}

        <div className="section-heading">
          <div>
            <span className="eyebrow">CHI TIẾT NGHIỆP VỤ</span>
            <h2>Lịch sử chứng từ đã ghi nhận</h2>
          </div>
          <span className="section-meta">Cùng snapshot với KPI và biểu đồ</span>
        </div>

        <div
          className="tabs"
          role="tablist"
          aria-label="Chế độ đối soát"
          onKeyDown={onTabKeyDown}
        >
          <button
            ref={tableTabRef}
            id="rptio-tab-table"
            className="tab"
            type="button"
            role="tab"
            aria-selected={view === "table"}
            aria-controls="rptio-panel-table"
            onClick={() => switchView("table")}
          >
            <IoIcon name="list" />
            Bảng
          </button>
          <button
            ref={sliceTabRef}
            id="rptio-tab-slice"
            className="tab"
            type="button"
            role="tab"
            aria-selected={view === "slice"}
            aria-controls="rptio-panel-slice"
            onClick={() => switchView("slice")}
          >
            <IoIcon name="grid-2x2-plus" />
            Lát cắt
          </button>
        </div>

        {/* ── Bảng ──────────────────────────────────────────────────────── */}
        {view === "table" ? (
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
                  <div className="title">Lịch sử chứng từ đã ghi nhận</div>
                  <div className="note">
                    Snapshot {snapshotId} · Data as-of{" "}
                    {fmtStamp(snapshot.dataAsOf)}
                  </div>
                </div>
              </div>
              <span className="chip chip-info">
                {fmt(rows.length)} chứng từ
              </span>
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Chứng từ / nguồn</th>
                    <th>Loại</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Ngày ghi nhận kho</th>
                    <th className="qty">Qty posted</th>
                    <th>Người thực hiện / phòng ban</th>
                    <th>Nguồn hàng / nơi nhận</th>
                    <th>Movement</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="empty-row" colSpan={10}>
                        Không có chứng từ POSTED theo bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} data-drill-key={row.id}>
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
                            {TYPE_LABELS[row.type]}
                          </span>
                        </td>
                        <td>
                          <span className="chip ok">
                            {row.status === "" ? IO_HISTORY_STATUS : row.status}
                          </span>
                        </td>
                        <td>{fmtStamp(row.createdAt)}</td>
                        <td>{fmtStamp(row.postedAt)}</td>
                        <td className="qty">{signedOrEmpty(row.qty)}</td>
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
                              : `Gốc: ${row.originalDocumentNo}`}
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => setDrillId(row.id)}
                          >
                            Xem
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
                Không phân trang · {fmt(rows.length)} dòng trong snapshot
              </span>
              <span>Cùng tập dòng với KPI và biểu đồ</span>
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
                  <div className="title">Lát cắt đối soát</div>
                  <div className="note">
                    Gom theo chứng từ gốc và các hoàn tác có cùng movement liên
                    kết.
                  </div>
                </div>
              </div>
              <span className="chip chip-info">
                {fmt(rows.length)} dòng nguồn
              </span>
            </div>
            <div className="slices">
              {slices.length === 0 ? (
                <div className="empty-row">
                  Không có lát cắt POSTED theo bộ lọc.
                </div>
              ) : (
                slices.map((slice) => (
                  <article
                    key={slice.row.id}
                    className="slice"
                    data-drill-key={slice.row.id}
                  >
                    <div className="slicetop">
                      <div>
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
                        {TYPE_LABELS[slice.row.type]}
                      </span>
                    </div>
                    <div className="slicemetrics">
                      <div>
                        <small>Tổng</small>
                        <b>{absOrEmpty(slice.row.qty)}</b>
                      </div>
                      <div>
                        <small>Hoàn tác</small>
                        <b>{fmt(slice.reversalQty)}</b>
                      </div>
                      <div>
                        <small>Thuần</small>
                        <b>{signedOrEmpty(slice.net)}</b>
                      </div>
                    </div>
                    <div className="slicefoot">
                      <span>{1 + slice.linked.length} mốc nghiệp vụ</span>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => setDrillId(slice.row.id)}
                      >
                        Đối soát
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
                <div className="note">
                  Chi tiết chứng từ đã ghi nhận · chỉ đọc
                </div>
              </div>
              <button
                className="btn secondary"
                type="button"
                aria-label="Đóng chi tiết"
                onClick={() => setDrillId(null)}
              >
                ×
              </button>
            </div>
            <div className="modalbody">
              <section className="detail-summary">
                <div>
                  <small>Chứng từ đã chọn</small>
                  <strong>
                    {drill.row.documentNo === ""
                      ? EMPTY_TEXT
                      : drill.row.documentNo}
                  </strong>
                  <span className={`chip ${toneOf(drill.row.type)}`}>
                    {TYPE_LABELS[drill.row.type]} ·{" "}
                    {drill.row.status === ""
                      ? IO_HISTORY_STATUS
                      : drill.row.status}
                  </span>
                </div>
                <div className="detail-qty">{signedOrEmpty(drill.row.qty)}</div>
              </section>

              <section className="detail-section">
                <h3>Thông tin chứng từ</h3>
                <div className="detail-grid">
                  <div className="detail-fact">
                    <small>Chứng từ nguồn</small>
                    <b>
                      {drill.source.documentNo === ""
                        ? EMPTY_TEXT
                        : drill.source.documentNo}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>Người thực hiện / phòng ban</small>
                    <b>
                      {[drill.row.actor, drill.row.department]
                        .filter((part) => part !== "")
                        .join(" · ") || EMPTY_TEXT}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>Nguồn hàng / nơi nhận</small>
                    <b>
                      {drill.row.party === "" ? EMPTY_TEXT : drill.row.party}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>Dòng SKU</small>
                    <b>
                      {drill.row.skuLines.length === 0
                        ? EMPTY_TEXT
                        : drill.row.skuLines.join(" · ")}
                    </b>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>Thời điểm và luồng kho</h3>
                <div className="detail-grid">
                  <div className="detail-fact">
                    <small>Ngày tạo chứng từ</small>
                    <b>{fmtStamp(drill.row.createdAt)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>Thời điểm ghi nhận kho</small>
                    <b>{fmtStamp(drill.row.postedAt)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>Movement</small>
                    <b>{movementLabelOf(drill.row)}</b>
                  </div>
                  <div className="detail-fact">
                    <small>Liên kết gốc / reversal</small>
                    <b>
                      {drill.row.originalDocumentNo === ""
                        ? "Không có"
                        : drill.row.originalDocumentNo}
                    </b>
                  </div>
                  <div className="detail-fact">
                    <small>Lịch sử nghiệp vụ</small>
                    <b>
                      {1 + drill.linked.length} mốc ·{" "}
                      {TYPE_LABELS[drill.row.type]}
                    </b>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>Đối soát số lượng</h3>
                <div className="detail-recon">
                  <div>
                    <small>Tổng ghi nhận</small>
                    <b>{absOrEmpty(drill.source.qty)}</b>
                  </div>
                  <div>
                    <small>Hoàn tác</small>
                    <b>{fmt(drill.reversalQty)}</b>
                  </div>
                  <div>
                    <small>Ảnh hưởng ròng</small>
                    <b>{signedOrEmpty(drill.net)}</b>
                  </div>
                </div>
              </section>

              <p className="detail-hint">
                Đối soát lấy đúng khóa chứng từ đã bấm. Chỉ movement và dòng SKU
                máy chủ trả về mới được hiển thị; không suy diễn dữ liệu thiếu.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
