/**
 * RPT-07 · tab "So sánh đối tượng nhận hàng".
 *
 * Màn dành cho QUẢN LÝ, không phải cho người nhập liệu: câu hỏi nó phải trả lời
 * trong vài giây là "đại lý nào đang mạnh/yếu, mặt hàng nào chạy nhanh/chậm, xu
 * hướng đang lên hay xuống, chỗ nào cần để mắt" — rồi mới tới việc soi số.
 * Thứ tự các mục bám đúng thứ tự đó:
 *
 *   Bộ lọc → KPI → Nhận xét → So sánh SKU × đại lý → Xu hướng → Nhanh/Chậm
 *   → Ma trận · Heatmap · Bảng → Xếp hạng đại lý → Bảng chi tiết
 *
 * Ba ràng buộc đi xuyên cả file:
 *
 * · MỘT MÀU CHO MỘT ĐỐI TƯỢNG. `model.parties[i].color` được dùng ở cột chart,
 *   đường xu hướng, chấm trong bảng và heatmap. Người đọc học màu một lần.
 * · KHÔNG BỊA SỐ. Kỳ trước không có dữ liệu ⇒ in "Chưa đủ dữ liệu" chứ không
 *   phải +100%; chưa chọn đủ 2 đối tượng ⇒ nói thẳng là chưa so sánh được.
 * · KHÔNG NHỒI CHART. Mỗi mục một câu hỏi, tối đa 6 chuỗi trên một biểu đồ;
 *   phần dư nằm ở bảng chứ không nhét thêm vào chart.
 */
import { useCallback, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiSelect,
  UiStatusBadge,
  UiVuexyDateRangePicker,
  RADIUS,
  SEMANTIC_LIGHT as S,
} from "@/shared/ui";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { LineChart } from "@/shared/components/charts/LineChart";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import {
  AppstoreOutlined,
  BarChartOutlined,
  FilterOutlined,
  FundOutlined,
  ReloadOutlined,
  ShopOutlined,
  StockOutlined,
  TagOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { agencyPlaceLine } from "@/shared/constants/agency-place-labels";
import { formatDate } from "@/shared/utils/format-date";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import { reportRangePresets } from "@/modules/reports/operations/report-range-presets";
import {
  PAIRED_CHART_FRAME_HEIGHT,
  PAIRED_CHART_HEIGHT,
  RPT_SCROLL_MAX_HEIGHT,
} from "@/modules/reports/operations/report-tokens";
import {
  COMPARISON_SIDE_BY_SIDE_MAX,
  comparisonDefaultView,
  comparisonLayout,
} from "@/modules/reports/operations/comparison-display";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import { SectionFilterBar } from "@/modules/reports/operations/SectionFilterBar";
import {
  useSectionFilter,
  type SectionFilterConfig,
} from "@/modules/reports/operations/report-section-filter";
import { rowIndexOf } from "@/shared/components/data-display/row-index";
import {
  drillRowsOf,
  useAgencyComparison,
  type ComparisonDrillRow,
} from "./agency-comparison-api";
import {
  COMPARISON_MIN_PARTIES,
  COMPARISON_SERIES_LIMIT,
  DEFAULT_COMPARISON_FILTERS,
  type ComparisonParty,
  type ComparisonSku,
  type ComparisonSkuScope,
  type ComparisonSlowMover,
  type SlowMoverReason,
} from "./agency-comparison-model";
import {
  ComparableMark,
  ComparisonHeatmap,
  ComparisonKpiCard,
  ComparisonPicker,
  InsightList,
  PartyDot,
  SectionCard,
  SegmentedControl,
  TrendArrow,
} from "./agency-comparison-views";
import {
  SURFACE_SX,
  deltaText,
  deltaTone,
  monthLabel,
  quantityText,
} from "./agency-comparison-format";

const RECIPIENT_TYPE_LABELS: Record<string, MessageKey> = {
  DISTRIBUTOR: "reports.recipientAgency.typeDistributor",
  AGENCY: "reports.recipientAgency.typeAgency",
  PROJECT_CUSTOMER: "reports.recipientAgency.typeProjectCustomerFull",
  RETAIL_CUSTOMER: "reports.recipientAgency.typeRetailCustomerFull",
};

const SLOW_REASON_LABELS: Record<SlowMoverReason, MessageKey> = {
  NO_MOVEMENT: "reports.agencyComparison.slowReasonStalled",
  DECLINED: "reports.agencyComparison.slowReasonDeclined",
  LOW_VOLUME: "reports.agencyComparison.slowReasonLow",
};

type MatrixView = "chart" | "heatmap" | "table";

/**
 * Bề dày của MỘT thanh (px).
 *
 * Đặt 4px thì ở Top 10 × 6 đối tượng biểu đồ vừa khít khung 460 và KHÔNG sinh
 * thanh cuộn — nhưng mỗi thanh chỉ còn ~4px, mảnh như sợi chỉ (người dùng báo
 * 06/09/2026). Đổi ưu tiên: thanh phải dày đủ đọc trước, khung cuộn trong chỗ
 * của nó sau — thẻ vẫn cao đúng bằng thẻ bên cạnh vì khung đã khoá chiều cao.
 */
const MATRIX_BAR_PX = 10;
/** Khoảng hở giữa hai nhóm SKU. */
const MATRIX_GROUP_GAP_PX = 14;
/** Chỗ chừa cho trục hoành + nhãn. */
const MATRIX_AXIS_PX = 96;

/** Mảng rỗng dùng chung — xem ghi chú ở chỗ dùng. */
const EMPTY_PARTIES: ComparisonParty[] = [];
const EMPTY_SKUS: ComparisonSku[] = [];

type DrillScope = {
  title: string;
  subtitle: string;
  partyId?: string;
  skuId?: string;
  from: string;
  to: string;
};

/**
 * Kỳ nhanh riêng của tab so sánh: dải dùng chung của trang báo cáo + hai mốc
 * "3 tháng / 6 tháng gần nhất".
 *
 * Không thêm hai mốc này vào `reportRangePresets` dùng chung vì bảy màn còn lại
 * đọc dữ liệu vận hành theo ngày — mở mặc định một kỳ nửa năm ở đó chỉ làm
 * chậm trang mà không ai dùng tới. Ở đây thì ngược lại: so sánh đại lý gần như
 * luôn cần nhiều tháng liền nhau mới thấy được xu hướng.
 */
function comparisonRangePresets(t: TranslateFn) {
  const rollingMonths = (count: number) => () => {
    const today = dayjs().startOf("day");
    return [today.subtract(count - 1, "month").startOf("month"), today] as [
      dayjs.Dayjs,
      dayjs.Dayjs,
    ];
  };
  const shared = reportRangePresets(t);
  const calendarGroup = t("reports.period.groupCalendar");
  const at = shared.findIndex((preset) => preset.group === calendarGroup);
  const extras = [
    {
      key: "last-3-months",
      label: t("reports.agencyComparison.periodLast3Months"),
      group: t("reports.period.groupRolling"),
      range: rollingMonths(3),
    },
    {
      key: "last-6-months",
      label: t("reports.agencyComparison.periodLast6Months"),
      group: t("reports.period.groupRolling"),
      range: rollingMonths(6),
    },
  ];
  // Chèn vào CUỐI nhóm "Gần đây" chứ không nối đuôi danh sách: nối đuôi sẽ đẩy
  // hai mốc này xuống dưới nhóm "Theo lịch" và làm vỡ tiêu đề nhóm.
  return at < 0
    ? [...shared, ...extras]
    : [...shared.slice(0, at), ...extras, ...shared.slice(at)];
}

export default function AgencyComparisonTab() {
  const t = useT();
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    const today = dayjs().startOf("day");
    return [today.subtract(2, "month").startOf("month"), today];
  });
  const [recipientTypes, setRecipientTypes] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [partyIds, setPartyIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [skuIds, setSkuIds] = useState<string[]>([]);
  const [skuScope, setSkuScope] = useState<ComparisonSkuScope>("TOP10");
  const [matrixSortBy, setMatrixSortBy] = useState("TOTAL");
  const [trendMetric, setTrendMetric] = useState("ALL");
  /**
   * `null` = ĐỂ MÀN TỰ CHỌN theo luật `comparison-display` (2–3 đối tượng đọc
   * bằng cột nhóm, từ 4 trở lên đọc bằng heatmap). Bấm tay vào bộ ba nút thì
   * lựa chọn đó thắng cho tới khi bấm "Đặt lại bộ lọc" — người dùng đã nói rõ
   * mình muốn nhìn kiểu gì thì màn không được tự đổi sau lưng họ.
   */
  const [matrixView, setMatrixView] = useState<MatrixView | null>(null);
  const [drill, setDrill] = useState<DrillScope | null>(null);

  const invalidRange = range[0].isAfter(range[1], "day");
  const filters = useMemo(
    () => ({
      ...DEFAULT_COMPARISON_FILTERS,
      from: invalidRange ? "" : range[0].format("YYYY-MM-DD"),
      to: invalidRange ? "" : range[1].format("YYYY-MM-DD"),
      recipientTypes,
      markets,
      regions,
      partyIds,
      categoryIds,
      skuIds,
      skuScope,
      matrixSortBy,
      trendMetric,
    }),
    [
      invalidRange,
      range,
      recipientTypes,
      markets,
      regions,
      partyIds,
      categoryIds,
      skuIds,
      skuScope,
      matrixSortBy,
      trendMetric,
    ],
  );

  const comparison = useAgencyComparison(filters);
  const model = comparison.model;

  const presets = useMemo(() => comparisonRangePresets(t), [t]);
  // `??[]` dựng MẢNG MỚI mỗi lần render, kéo theo mọi useMemo phía dưới
  // tính lại dù mô hình không đổi — giữ một mảng rỗng dùng chung thay vì vậy.
  const parties = model?.parties ?? EMPTY_PARTIES;
  /**
   * Số đối tượng thật sự lên biểu đồ. Ô chọn ở bộ lọc đã chặn trần, nhưng khi
   * người dùng CHƯA chọn ai thì mô hình tự lấy top — vẫn phải cắt lại ở đây để
   * không bao giờ vẽ quá trần, dù mô hình có trả về nhiều hơn.
   */
  const visibleParties = useMemo(
    () => parties.slice(0, COMPARISON_SERIES_LIMIT),
    [parties],
  );
  // Memo hoá vì `leader` bên dưới nhận mảng này làm dependency: mảng mới ở mỗi
  // lần render làm React Compiler bỏ luôn việc tối ưu component (guard lint
  // "Existing memoization could not be preserved").
  const activeParties = useMemo(
    () => parties.filter((party) => party.qty !== 0),
    [parties],
  );
  const notEnoughParties = activeParties.length < COMPARISON_MIN_PARTIES;

  /**
   * Đếm trên đối tượng CÓ PHÁT SINH trong kỳ, không phải số ô đã tích: chọn 5
   * đại lý mà 3 trong đó không xuất gì thì màn vẫn chỉ đang so 2 đối tượng, và
   * cột nhóm vẫn là cách đọc đúng.
   */
  const comparedCount = activeParties.length;
  const comparisonMode = comparisonLayout(comparedCount);
  const effectiveMatrixView: MatrixView =
    matrixView ?? comparisonDefaultView(comparedCount);

  const activeFilterCount =
    recipientTypes.length +
    markets.length +
    regions.length +
    partyIds.length +
    categoryIds.length +
    skuIds.length;

  const resetFilters = useCallback(() => {
    setRecipientTypes([]);
    setMarkets([]);
    setRegions([]);
    setPartyIds([]);
    setCategoryIds([]);
    setSkuIds([]);
    setSkuScope("TOP10");
    setMatrixSortBy("TOTAL");
    setTrendMetric("ALL");
    // Trả khối ma trận về "tự chọn theo số đối tượng".
    setMatrixView(null);
  }, []);

  const periodLabel = `${formatDate(filters.from)} → ${formatDate(filters.to)}`;
  const previousLabel = model
    ? `${formatDate(model.previous.from)} → ${formatDate(model.previous.to)}`
    : EMPTY_TEXT;

  const openDrill = useCallback((scope: DrillScope) => setDrill(scope), []);

  const drillRows = useMemo<ComparisonDrillRow[]>(() => {
    if (!drill) return [];
    return drillRowsOf(comparison.events, {
      partyId: drill.partyId,
      skuId: drill.skuId,
      from: drill.from,
      to: drill.to,
    });
  }, [drill, comparison.events]);

  // ── KPI ────────────────────────────────────────────────────────────────
  const leader = useMemo(
    () => [...activeParties].sort((left, right) => right.qty - left.qty)[0],
    [activeParties],
  );
  const topSku = model?.skus.find((sku) => sku.qty > 0);

  // ── Biểu đồ so sánh SKU × đối tượng ────────────────────────────────────
  const matrixSkus = model?.scopedSkus ?? EMPTY_SKUS;

  /**
   * id đối tượng → vị trí cột trong `sku.byParty`.
   *
   * Dựng MỘT LẦN thay vì dò tuyến tính ở mỗi ô: bảng ma trận gọi hàm render cho
   * từng ô, nên `findIndex` trong đó biến mỗi lượt vẽ thành O(số SKU × số đối
   * tượng²) — đúng lớp lỗi mà hàng rào `render-perf-guards` sinh ra để chặn.
   */
  const partyColumnAt = useMemo(
    () => new Map(parties.map((party, at) => [party.id, at])),
    [parties],
  );

  const barSeries = useMemo(
    () =>
      visibleParties.map((party) => {
        const at = partyColumnAt.get(party.id) ?? -1;
        return {
          name: party.name,
          color: party.color,
          data: matrixSkus.map((sku) => Math.max(0, sku.byParty[at] ?? 0)),
        };
      }),
    [visibleParties, matrixSkus, partyColumnAt],
  );
  const barCategories = matrixSkus.map((sku) => sku.code || sku.name);

  // ── Xu hướng ───────────────────────────────────────────────────────────
  // Chuỗi vẽ lấy từ `model.metricTrend` — đã được bộ tính dựng theo đúng chỉ số
  // đang chọn. KHÔNG dựng thêm một mô hình thứ hai chỉ để đổi chỉ số: làm vậy
  // thì KPI và bảng xếp hạng cũng phải chọn xem đọc mô hình nào, và hai nửa màn
  // hình sẽ nói hai chuyện khác nhau.
  const trendSeries = useMemo(
    () =>
      (model?.parties ?? [])
        .map((party, at) => ({ party, data: model?.metricTrend[at] ?? [] }))
        .slice(0, COMPARISON_SERIES_LIMIT)
        .map(({ party, data }) => ({
          name: party.name,
          color: party.color,
          data,
        })),
    [model],
  );
  const trendBuckets = model?.buckets ?? [];
  const trendHasValue = trendSeries.some((series) =>
    series.data.some((value) => value !== 0),
  );

  const trendMetricOptions = useMemo(() => {
    const skuChoices = (model?.skus ?? [])
      .filter((sku) => sku.qty > 0)
      .slice(0, 20)
      .map((sku) => ({
        value: `sku:${sku.id}`,
        label: `${t("reports.agencyComparison.metricSkuPrefix")} ${sku.code || sku.name}`,
      }));
    const categoryChoices = comparison.options.categories.map((option) => ({
      value: `cat:${option.value}`,
      label: `${t("reports.agencyComparison.metricCategoryPrefix")} ${option.label}`,
    }));
    return [
      { value: "ALL", label: t("reports.agencyComparison.metricAll") },
      ...skuChoices,
      ...categoryChoices,
    ];
  }, [model?.skus, comparison.options.categories, t]);

  // ── Bảng chi tiết đại lý × SKU ─────────────────────────────────────────
  type DetailRow = {
    key: string;
    party: ComparisonParty;
    sku: ComparisonSku;
    qty: number;
    prevQty: number;
    delta: number | null;
    share: number;
  };

  const detailRows = useMemo<DetailRow[]>(() => {
    if (!model) return [];
    const rows: DetailRow[] = [];
    model.skus.forEach((sku) => {
      model.parties.forEach((party, at) => {
        const qty = sku.byParty[at] ?? 0;
        const prevQty = sku.prevByParty[at] ?? 0;
        if (qty === 0 && prevQty === 0) return;
        rows.push({
          key: `${party.id}::${sku.id}`,
          party,
          sku,
          qty,
          prevQty,
          delta: prevQty > 0 ? ((qty - prevQty) / prevQty) * 100 : null,
          share: sku.qty > 0 ? (Math.max(0, qty) / sku.qty) * 100 : 0,
        });
      });
    });
    return rows.sort((left, right) => right.qty - left.qty);
  }, [model]);

  const detailFilterConfig = useMemo<SectionFilterConfig<DetailRow>>(
    () => ({
      searchPlaceholder: t("reports.agencyComparison.detailSearchPlaceholder"),
      searchText: (row) => [
        row.party.name,
        row.party.code,
        row.sku.code,
        row.sku.name,
      ],
      selects: [
        {
          key: "party",
          placeholder: t("reports.agencyComparison.anyParty"),
          options: () =>
            (model?.parties ?? []).map((party) => ({
              value: party.id,
              label: party.name,
            })),
          match: (row, value) => row.party.id === value,
          minWidth: 220,
        },
        {
          key: "movement",
          placeholder: t("reports.agencyComparison.anyMovement"),
          options: [
            {
              value: "UP",
              label: t("reports.agencyComparison.movementUp"),
            },
            {
              value: "DOWN",
              label: t("reports.agencyComparison.movementDown"),
            },
            {
              value: "NEW",
              label: t("reports.agencyComparison.movementNew"),
            },
          ],
          match: (row, value) =>
            value === "NEW"
              ? row.prevQty === 0 && row.qty > 0
              : value === "UP"
                ? (row.delta ?? 0) > 0
                : (row.delta ?? 0) < 0,
          minWidth: 200,
        },
      ],
    }),
    [t, model?.parties],
  );
  const detailFilter = useSectionFilter(detailRows, detailFilterConfig);

  // ── Trạng thái chung ───────────────────────────────────────────────────
  const loading = comparison.isLoading;
  const emptyText = t("reports.common.noData");

  if (comparison.error) {
    return (
      <Box data-testid="report-08-comparison" sx={{ display: "grid", gap: 2 }}>
        <ApiErrorAlert
          error={comparison.error}
          title={t("reports.agencyComparison.loadError")}
          onRetry={() => void comparison.refetch()}
        />
      </Box>
    );
  }

  return (
    <Box
      data-testid="report-08-comparison"
      sx={{
        display: "grid",
        gap: { xs: 1.5, md: 2.25 },
        minWidth: 0,
        "& > *": { minWidth: 0 },
      }}
    >
      {/* ── Bộ lọc ─────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label={t("reports.agencyComparison.filterAria")}
        sx={{
          ...SURFACE_SX,
          p: { xs: 1.75, md: 2 },
          // KHÔNG dính (sticky): khối này cao ~200px, dính lên đầu thì nó ăn
          // mất một phần tư màn hình suốt cả lượt cuộn và luôn nằm đè lên khối
          // đang đọc. Yêu cầu người dùng 2026-09-06: bộ lọc cuộn đi cùng trang.
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
            mb: 1.5,
          }}
        >
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                borderRadius: `${RADIUS.control}px`,
                bgcolor: S.primarySoft,
                color: S.primaryDark,
                fontSize: 13,
              }}
            >
              <FilterOutlined />
            </Box>
            <Box>
              <Box sx={{ fontSize: 13, fontWeight: 700, color: S.textHigh }}>
                {t("reports.agencyComparison.filterTitle")}
              </Box>
              <Box sx={{ fontSize: 11.5, color: S.textMedium }}>
                {t("reports.agencyComparison.filterHint")}
              </Box>
            </Box>
          </Stack>
          <Stack
            direction="row"
            sx={{ alignItems: "center", gap: 0.75, flexWrap: "wrap" }}
          >
            <UiStatusBadge
              size="small"
              tone={activeFilterCount > 0 ? "primary" : "neutral"}
              label={t("reports.agencyComparison.filterCount", {
                count: activeFilterCount,
              })}
            />
            <UiButton
              appearance="text"
              color="secondary"
              size="small"
              disabled={activeFilterCount === 0}
              onClick={resetFilters}
            >
              {t("reports.recipientAgency.reset")}
            </UiButton>
            <UiButton
              appearance="outlined"
              size="small"
              startIcon={<ReloadOutlined />}
              loading={comparison.isFetching}
              onClick={() => void comparison.refetch()}
            >
              {t("reports.recipientAgency.refresh")}
            </UiButton>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(3, minmax(0, 1fr))",
              xl: "repeat(4, minmax(0, 1fr))",
            },
            "& .MuiFormControl-root, & .MuiButton-root": {
              width: "100%",
              minWidth: 0,
            },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <FieldLabel>{t("reports.agencyComparison.fieldPeriod")}</FieldLabel>
            <UiVuexyDateRangePicker
              value={range}
              presets={presets}
              maxDate={dayjs().startOf("day")}
              aria-label={t("reports.agencyComparison.fieldPeriod")}
              onChange={(next) => {
                if (next?.[0] && next?.[1]) setRange([next[0], next[1]]);
              }}
            />
            <Box sx={{ mt: 0.5, fontSize: 11, color: S.textMedium }}>
              {t("reports.agencyComparison.previousPeriod", {
                range: previousLabel,
              })}
            </Box>
          </Box>

          {/*
           * Ba bộ lọc PHẠM VI dưới đây chọn được NHIỀU giá trị. Trước đây mỗi ô
           * chỉ giữ một giá trị (`value[0]`) dù mô hình và API vẫn nhận mảng —
           * nghĩa là không thể hỏi "gộp đại lý ở hai thị trường miền Bắc và
           * miền Trung", đúng câu hỏi mà một màn so sánh phải trả lời được.
           */}
          <Box sx={{ minWidth: 0 }}>
            <ComparisonPicker
              label={t("reports.agencyComparison.fieldType")}
              options={comparison.options.recipientTypes.map((type) => ({
                value: type,
                label: RECIPIENT_TYPE_LABELS[type]
                  ? t(RECIPIENT_TYPE_LABELS[type])
                  : type,
              }))}
              value={recipientTypes}
              onChange={setRecipientTypes}
              placeholder={t("reports.agencyComparison.anyType")}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <ComparisonPicker
              label={t("reports.agencyComparison.fieldMarket")}
              options={comparison.options.markets}
              value={markets}
              onChange={setMarkets}
              placeholder={t("reports.agencyComparison.anyMarket")}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <ComparisonPicker
              label={t("reports.agencyComparison.fieldRegion")}
              options={comparison.options.regions}
              value={regions}
              onChange={setRegions}
              placeholder={t("reports.agencyComparison.anyRegion")}
            />
          </Box>

          <Box sx={{ gridColumn: { sm: "span 2" }, minWidth: 0 }}>
            <ComparisonPicker
              label={t("reports.agencyComparison.fieldParties")}
              options={comparison.options.parties}
              value={partyIds}
              onChange={setPartyIds}
              placeholder={t("reports.agencyComparison.partiesPlaceholder")}
              searchPlaceholder={t("reports.agencyComparison.partiesSearch")}
              emptyText={t("reports.common.noOptions")}
              maxSelectable={COMPARISON_SERIES_LIMIT}
              searchable
              showQty
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <ComparisonPicker
              label={t("reports.agencyComparison.fieldCategory")}
              options={comparison.options.categories}
              value={categoryIds}
              onChange={setCategoryIds}
              placeholder={t("reports.agencyComparison.categoryPlaceholder")}
              searchPlaceholder={t("reports.agencyComparison.categorySearch")}
              emptyText={t("reports.common.noOptions")}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <ComparisonPicker
              label={t("reports.agencyComparison.fieldSkus")}
              options={comparison.options.skus}
              value={skuIds}
              onChange={setSkuIds}
              placeholder={t("reports.agencyComparison.skusPlaceholder")}
              searchPlaceholder={t("reports.agencyComparison.skusSearch")}
              emptyText={t("reports.common.noOptions")}
              searchable
              showQty
            />
          </Box>
        </Box>
      </Box>

      {/* ── Cảnh báo ───────────────────────────────────────────────── */}
      {invalidRange ? (
        <UiAlert tone="warning">
          {t("reports.agencyComparison.invalidRange")}
        </UiAlert>
      ) : null}
      {comparison.truncated ? (
        <UiAlert tone="warning">
          {t("reports.agencyComparison.truncated", {
            loaded: quantityText(comparison.loadedRowCount),
            total: quantityText(comparison.serverRowTotal),
          })}
        </UiAlert>
      ) : null}
      {!loading && notEnoughParties ? (
        <UiAlert tone="info">
          {t("reports.agencyComparison.needMoreParties", {
            count: COMPARISON_MIN_PARTIES,
          })}
        </UiAlert>
      ) : null}
      {model?.hasCoverageGap ? (
        <UiAlert tone="warning">
          {t("reports.agencyComparison.coverageWarning")}
        </UiAlert>
      ) : null}

      {/* ── KPI ────────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label={t("reports.agencyComparison.kpiAria")}
        sx={{
          display: "grid",
          gap: { xs: 1.25, md: 1.5 },
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
            xl: "repeat(6, minmax(0, 1fr))",
          },
        }}
      >
        <ComparisonKpiCard
          tone="primary"
          icon={<StockOutlined />}
          label={t("reports.agencyComparison.kpiTotal")}
          value={quantityText(model?.totals.qty ?? 0)}
          hint={t("reports.agencyComparison.kpiTotalHint", {
            range: periodLabel,
          })}
          badge={
            model?.totals.delta === null
              ? t("reports.agencyComparison.noBaseline")
              : deltaText(model?.totals.delta ?? null)
          }
          badgeTone={
            model?.totals.delta === null
              ? "neutral"
              : deltaTone(model?.totals.delta ?? null)
          }
        />
        <ComparisonKpiCard
          tone="info"
          icon={<TeamOutlined />}
          label={t("reports.agencyComparison.kpiParties")}
          value={quantityText(model?.totals.activePartyCount ?? 0)}
          hint={t("reports.agencyComparison.kpiPartiesHint", {
            total: model?.totals.partyCount ?? 0,
          })}
        />
        <ComparisonKpiCard
          tone="neutral"
          icon={<TagOutlined />}
          label={t("reports.agencyComparison.kpiSkus")}
          value={quantityText(model?.totals.skuCount ?? 0)}
          hint={t("reports.agencyComparison.kpiSkusHint", {
            documents: model?.totals.documents ?? 0,
          })}
        />
        <ComparisonKpiCard
          tone="success"
          icon={<ShopOutlined />}
          label={t("reports.agencyComparison.kpiLeader")}
          value={leader?.name || EMPTY_TEXT}
          hint={
            leader
              ? t("reports.agencyComparison.kpiLeaderHint", {
                  qty: quantityText(leader.qty),
                  share: Math.round(leader.share),
                })
              : t("reports.agencyComparison.noComparable")
          }
        />
        <ComparisonKpiCard
          tone="warning"
          icon={<ThunderboltOutlined />}
          label={t("reports.agencyComparison.kpiTopSku")}
          value={topSku ? topSku.code || topSku.name : EMPTY_TEXT}
          hint={
            topSku
              ? t("reports.agencyComparison.kpiTopSkuHint", {
                  qty: quantityText(topSku.qty),
                  parties: topSku.partyCount,
                })
              : t("reports.agencyComparison.noComparable")
          }
        />
        {/*
          Ô thứ 6 CHỈ nói về sản lượng trung bình. Bản đầu nhét thêm "SKU đang
          chậm" vào dòng chú thích, nên chú thích không còn mô tả con số ngay
          trên nó — mà mặt hàng chậm thì đã có hẳn một mục riêng và một nhận xét
          riêng ở dưới.
        */}
        <ComparisonKpiCard
          tone="neutral"
          icon={<FundOutlined />}
          label={t("reports.agencyComparison.kpiAvgMonth")}
          value={quantityText(Math.round(model?.totals.avgPerMonth ?? 0))}
          hint={t("reports.agencyComparison.kpiAvgMonthHint", {
            months: model?.totals.monthsInPeriod ?? 0,
          })}
        />
      </Box>

      {/* ── Nhận xét ───────────────────────────────────────────────── */}
      <SectionCard
        id="report-08-cmp-insight"
        icon={<ThunderboltOutlined />}
        title={t("reports.agencyComparison.insightTitle")}
        subtitle={t("reports.agencyComparison.insightSubtitle")}
        scope={periodLabel}
        loading={loading}
        empty={!loading && (model?.insights.length ?? 0) === 0}
        emptyText={
          notEnoughParties
            ? t("reports.agencyComparison.insightNeedParties")
            : t("reports.agencyComparison.insightEmpty")
        }
        minHeight={140}
      >
        <InsightList
          insights={model?.insights ?? []}
          emptyText={t("reports.agencyComparison.insightEmpty")}
        />
      </SectionCard>

      {/* ── So sánh SKU × đối tượng + Xu hướng (6/6) ───────────────── */}
      {/*
        Hai khối HÌNH đứng cạnh nhau: "ai nhận nhiều mặt hàng nào" và "diễn biến
        theo thời gian" là hai câu hỏi người dùng đọc kèm nhau, tách hai màn
        cuộn thì phải nhớ số.

        Chỉ chia đôi TỪ xl (1280px) — cùng ngưỡng với cặp Nhanh/Chậm bên dưới.
        Hẹp hơn thì mỗi cột không còn đủ chỗ cho nhãn SKU của biểu đồ ngang
        (nhãn dạng "PUMP-HUS-0003 · Máy bơm nước …" bị cắt cụt), nên xuống một
        cột chứ không bóp.

        Hai thẻ KÉO BẰNG NHAU (grid stretch mặc định) và thân biểu đồ dùng chung
        `PAIRED_CHART_HEIGHT`. Thả tự do thì thẻ ma trận cao theo số SKU (tới
        980px) còn thẻ xu hướng cố định, chênh nhau gần gấp đôi.
      */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <SectionCard
          id="report-08-cmp-matrix"
          icon={<BarChartOutlined />}
          title={t("reports.agencyComparison.matrixTitle")}
          subtitle={t("reports.agencyComparison.matrixSubtitle")}
          scope={t("reports.agencyComparison.matrixScope", {
            skus: matrixSkus.length,
            parties: visibleParties.length,
            range: periodLabel,
          })}
          loading={loading}
          empty={!loading && (matrixSkus.length === 0 || parties.length === 0)}
          emptyText={emptyText}
          minHeight={320}
          actions={
            <>
              <SegmentedControl<ComparisonSkuScope>
                ariaLabel={t("reports.agencyComparison.scopeAria")}
                value={skuScope}
                onChange={setSkuScope}
                options={[
                  {
                    value: "TOP10",
                    label: t("reports.agencyComparison.top10"),
                  },
                  {
                    value: "TOP20",
                    label: t("reports.agencyComparison.top20"),
                  },
                  {
                    value: "ALL",
                    label: t("reports.agencyComparison.allSkus"),
                  },
                ]}
              />
              <UiSelect
                value={matrixSortBy}
                onChange={setMatrixSortBy}
                minWidth={190}
                aria-label={t("reports.agencyComparison.sortAria")}
                options={[
                  {
                    value: "TOTAL",
                    label: t("reports.agencyComparison.sortTotal"),
                  },
                  ...parties.map((party) => ({
                    value: party.id,
                    label: t("reports.agencyComparison.sortByParty", {
                      name: party.name,
                    }),
                  })),
                ]}
              />
              <SegmentedControl<MatrixView>
                ariaLabel={t("reports.agencyComparison.viewAria")}
                value={effectiveMatrixView}
                onChange={setMatrixView}
                options={[
                  {
                    value: "chart",
                    label: t("reports.agencyComparison.viewChart"),
                    icon: <BarChartOutlined />,
                  },
                  {
                    value: "heatmap",
                    label: t("reports.agencyComparison.viewHeatmap"),
                    icon: <AppstoreOutlined />,
                  },
                  {
                    value: "table",
                    label: t("reports.agencyComparison.viewTable"),
                    icon: <UnorderedListOutlined />,
                  },
                ]}
              />
            </>
          }
        >
          {/*
           * Nói ra LUẬT ĐỌC ngay tại chỗ, vì khối này tự đổi hình theo số đối
           * tượng: không có câu này thì người dùng bỏ bớt một đại lý, thấy màn
           * nhảy từ heatmap về cột nhóm và tưởng mình bấm nhầm.
           */}
          {comparisonMode !== "insufficient" ? (
            <Box sx={{ fontSize: 11.5, color: S.textMedium }}>
              {comparisonMode === "sideBySide"
                ? t("reports.agencyComparison.layoutSideBySide", {
                    count: comparedCount,
                  })
                : t("reports.agencyComparison.layoutMatrix", {
                    count: comparedCount,
                    threshold: COMPARISON_SIDE_BY_SIDE_MAX + 1,
                    limit: COMPARISON_SERIES_LIMIT,
                  })}
            </Box>
          ) : null}
          {effectiveMatrixView === "chart" ? (
            // Cùng chiều cao thân với thẻ "Xu hướng" bên cạnh; danh sách dài
            // hơn thì cuộn tại chỗ chứ không kéo dài thẻ (xem PAIRED_CHART_HEIGHT).
            <Box
              sx={{
                mt: 1,
                maxHeight: PAIRED_CHART_FRAME_HEIGHT,
                overflowY: "auto",
              }}
            >
              <MultiSeriesBarChart
                horizontal
                // Khung cuộn (xem `height` ngay dưới) nên trục giá trị phải nằm
                // TRÊN: để ở đáy thì cuộn một nhịp là mất thang đo.
                valueAxisOnTop
                categories={barCategories}
                series={barSeries}
                valueFormatter={quantityText}
                /*
                 * SÀN là chiều cao khung (PAIRED_CHART_HEIGHT) để biểu đồ ít
                 * dòng không co rúm ở giữa thẻ. Trên sàn, mỗi SKU được cấp
                 * `MATRIX_BAR_PX` cho MỖI đối tượng: ở Top 10 × 6 đối tượng ra
                 * ~836px, tức là khung 460px sẽ cuộn — chấp nhận đánh đổi đó vì
                 * thanh dày đọc được quan trọng hơn việc trục hoành luôn nằm
                 * trong tầm nhìn (thang đo vẫn còn ở đường lưới và tooltip).
                 *
                 * Trần 1600: đủ cho Top 20 vẽ đúng bề dày thật, còn "Tất cả" có
                 * thể ra hàng trăm SKU — vẽ SVG dài vô hạn thì treo máy, cỡ đó
                 * đọc bằng Heatmap/Bảng.
                 */
                height={Math.min(
                  1600,
                  Math.max(
                    PAIRED_CHART_HEIGHT,
                    barCategories.length *
                      (barSeries.length * MATRIX_BAR_PX + MATRIX_GROUP_GAP_PX) +
                      MATRIX_AXIS_PX,
                  ),
                )}
                onSelect={(point) => {
                  const sku = matrixSkus[point.categoryIndex];
                  const party = visibleParties[point.seriesIndex];
                  if (!sku || !party || !model) return;
                  openDrill({
                    title: t("reports.agencyComparison.drillCellTitle", {
                      party: party.name,
                      sku: sku.code || sku.name,
                    }),
                    subtitle: periodLabel,
                    partyId: party.id,
                    skuId: sku.id,
                    from: model.period.from,
                    to: model.period.to,
                  });
                }}
              />
            </Box>
          ) : effectiveMatrixView === "heatmap" ? (
            <Box
              sx={{
                mt: 1,
                maxHeight: RPT_SCROLL_MAX_HEIGHT,
                overflowY: "auto",
              }}
            >
              <ComparisonHeatmap
                skus={matrixSkus}
                parties={visibleParties}
                rowLabel={t("reports.agencyComparison.colSku")}
                totalLabel={t("reports.agencyComparison.colTotal")}
                topLabel={t("reports.agencyComparison.colTopParty")}
                onSelect={(sku, party) => {
                  if (!model) return;
                  openDrill({
                    title: t("reports.agencyComparison.drillCellTitle", {
                      party: party.name,
                      sku: sku.code || sku.name,
                    }),
                    subtitle: periodLabel,
                    partyId: party.id,
                    skuId: sku.id,
                    from: model.period.from,
                    to: model.period.to,
                  });
                }}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              <ResponsiveDataTable
                rows={matrixSkus}
                rowKey={(row) => row.id}
                maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
                emptyText={emptyText}
                columns={[
                  {
                    key: "sku",
                    header: t("reports.agencyComparison.colSku"),
                    width: 240,
                    truncate: 2,
                    render: (row) => (
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ fontWeight: 700 }}>
                          {row.code || EMPTY_TEXT}
                        </Box>
                        <Box sx={{ fontSize: 11.5, color: S.textMedium }}>
                          {row.name || EMPTY_TEXT}
                        </Box>
                      </Box>
                    ),
                  },
                  ...visibleParties.map((party) => ({
                    key: `party-${party.id}`,
                    header: party.name,
                    align: "right" as const,
                    render: (row: ComparisonSku) => {
                      const qty =
                        row.byParty[partyColumnAt.get(party.id) ?? -1] ?? 0;
                      return (
                        <Box
                          sx={{
                            fontWeight: row.topPartyId === party.id ? 700 : 400,
                            color:
                              row.topPartyId === party.id
                                ? S.primaryDark
                                : S.textHigh,
                          }}
                        >
                          {qty === 0 ? EMPTY_TEXT : quantityText(qty)}
                        </Box>
                      );
                    },
                  })),
                  {
                    key: "total",
                    header: t("reports.agencyComparison.colTotal"),
                    align: "right" as const,
                    render: (row) => (
                      <Box sx={{ fontWeight: 700 }}>
                        {quantityText(row.qty)}
                      </Box>
                    ),
                  },
                  {
                    key: "top",
                    header: t("reports.agencyComparison.colTopParty"),
                    render: (row) => {
                      const party = parties.find(
                        (item) => item.id === row.topPartyId,
                      );
                      if (!party) return EMPTY_TEXT;
                      return (
                        <Stack
                          direction="row"
                          sx={{ alignItems: "center", gap: 0.5, minWidth: 0 }}
                        >
                          <PartyDot color={party.color} />
                          <Box sx={{ minWidth: 0 }}>{party.name}</Box>
                        </Stack>
                      );
                    },
                  },
                ]}
              />
            </Box>
          )}
        </SectionCard>

        <SectionCard
          id="report-08-cmp-trend"
          icon={<FundOutlined />}
          title={t("reports.agencyComparison.trendTitle")}
          subtitle={t("reports.agencyComparison.trendSubtitle")}
          scope={t("reports.agencyComparison.trendScope", {
            unit: t(
              model?.granularity === "day"
                ? "reports.agencyComparison.unitDay"
                : model?.granularity === "week"
                  ? "reports.agencyComparison.unitWeek"
                  : "reports.agencyComparison.unitMonth",
            ),
            range: periodLabel,
          })}
          loading={loading}
          empty={
            !loading &&
            (trendSeries.length === 0 ||
              trendBuckets.length === 0 ||
              !trendHasValue)
          }
          emptyText={
            trendMetric === "ALL"
              ? emptyText
              : t("reports.agencyComparison.trendMetricEmpty")
          }
          minHeight={300}
          actions={
            <UiSelect
              value={trendMetric}
              onChange={setTrendMetric}
              minWidth={230}
              aria-label={t("reports.agencyComparison.metricAria")}
              options={trendMetricOptions}
            />
          }
        >
          <Box sx={{ mt: 1 }}>
            <LineChart
              categories={trendBuckets.map((bucket) => bucket.label)}
              series={trendSeries}
              valueFormatter={quantityText}
              height={PAIRED_CHART_HEIGHT}
              onSelect={(point) => {
                const bucket = trendBuckets[point.categoryIndex];
                const party = parties.find(
                  (item) => item.name === point.seriesName,
                );
                if (!bucket || !party) return;
                openDrill({
                  title: t("reports.agencyComparison.drillBucketTitle", {
                    party: party.name,
                    label: bucket.label,
                  }),
                  subtitle: `${formatDate(bucket.from)} → ${formatDate(bucket.to)}`,
                  partyId: party.id,
                  skuId: trendMetric.startsWith("sku:")
                    ? trendMetric.slice(4)
                    : undefined,
                  from: bucket.from,
                  to: bucket.to,
                });
              }}
            />
          </Box>
          {model && model.parties.length > COMPARISON_SERIES_LIMIT ? (
            <Box sx={{ mt: 1, fontSize: 11.5, color: S.textMedium }}>
              {t("reports.agencyComparison.seriesLimited", {
                limit: COMPARISON_SERIES_LIMIT,
              })}
            </Box>
          ) : null}
        </SectionCard>
      </Box>

      {/* ── Nhanh / Chậm ───────────────────────────────────────────── */}
      {/*
        Xếp cạnh nhau CHỈ từ xl trở lên. Ở lg (~1280px) mỗi thẻ chỉ còn ~600px,
        không đủ cho bảng xuất chậm 6 cột — mã SKU bị cắt thành "ENG-HOA…" và
        chính cột quan trọng nhất của bảng trở nên vô dụng.
      */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <SectionCard
          id="report-08-cmp-fast"
          icon={<ThunderboltOutlined />}
          title={t("reports.agencyComparison.fastTitle")}
          subtitle={t("reports.agencyComparison.fastSubtitle")}
          scope={periodLabel}
          loading={loading}
          empty={!loading && (model?.fastMovers.length ?? 0) === 0}
          emptyText={emptyText}
          minHeight={280}
        >
          <HorizontalBarChart
            items={(model?.fastMovers ?? []).map((sku) => ({
              label: sku.code || sku.name,
              value: Math.max(0, sku.qty),
            }))}
            limit={10}
            valueFormatter={quantityText}
            onSelect={(item) => {
              const sku = model?.fastMovers.find(
                (entry) => (entry.code || entry.name) === item.label,
              );
              if (!sku || !model) return;
              openDrill({
                title: t("reports.agencyComparison.drillSkuTitle", {
                  sku: sku.code || sku.name,
                }),
                subtitle: periodLabel,
                skuId: sku.id,
                from: model.period.from,
                to: model.period.to,
              });
            }}
          />
        </SectionCard>

        <SectionCard
          id="report-08-cmp-slow"
          icon={<WarningOutlined />}
          title={t("reports.agencyComparison.slowTitle")}
          subtitle={t("reports.agencyComparison.slowSubtitle")}
          scope={periodLabel}
          loading={loading}
          empty={!loading && (model?.slowMovers.length ?? 0) === 0}
          emptyText={t("reports.agencyComparison.slowEmpty")}
          minHeight={280}
        >
          <ResponsiveDataTable<ComparisonSlowMover>
            rows={model?.slowMovers ?? []}
            rowKey={(row) => row.id}
            emptyText={t("reports.agencyComparison.slowEmpty")}
            maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
            onRowClick={(row) => {
              if (!model) return;
              openDrill({
                title: t("reports.agencyComparison.drillSkuTitle", {
                  sku: row.code || row.name,
                }),
                subtitle: periodLabel,
                skuId: row.id,
                from: model.period.from,
                to: model.period.to,
              });
            }}
            columns={[
              {
                key: "sku",
                header: t("reports.agencyComparison.colSku"),
                width: 210,
                truncate: 2,
                render: (row) => (
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontWeight: 700 }}>{row.code || EMPTY_TEXT}</Box>
                    <Box sx={{ fontSize: 11.5, color: S.textMedium }}>
                      {row.name || EMPTY_TEXT}
                    </Box>
                  </Box>
                ),
              },
              {
                key: "reason",
                header: t("reports.agencyComparison.colReason"),
                render: (row) => (
                  <UiStatusBadge
                    size="small"
                    tone={
                      row.reason === "NO_MOVEMENT"
                        ? "error"
                        : row.reason === "DECLINED"
                          ? "warning"
                          : "neutral"
                    }
                    label={t(SLOW_REASON_LABELS[row.reason])}
                  />
                ),
              },
              {
                key: "qty",
                header: t("reports.agencyComparison.colQty"),
                align: "right",
                render: (row) => quantityText(row.qty),
              },
              {
                key: "prev",
                header: t("reports.agencyComparison.colPrevQty"),
                align: "right",
                hideOnMobile: true,
                render: (row) => quantityText(row.prevQty),
              },
              {
                key: "delta",
                header: t("reports.agencyComparison.colDelta"),
                align: "right",
                render: (row) => (
                  <Box
                    sx={{
                      fontWeight: 700,
                      color:
                        row.delta === null
                          ? S.textMedium
                          : row.delta >= 0
                            ? S.successText
                            : S.errorText,
                    }}
                  >
                    {deltaText(row.delta)}
                  </Box>
                ),
              },
              {
                key: "rank",
                header: t("reports.agencyComparison.colRankShift"),
                align: "center",
                hideOnMobile: true,
                render: (row) =>
                  row.prevRank === null
                    ? EMPTY_TEXT
                    : `${row.prevRank} → ${row.rank}`,
              },
            ]}
          />
        </SectionCard>
      </Box>

      {/* ── Xếp hạng đối tượng ─────────────────────────────────────── */}
      <SectionCard
        id="report-08-cmp-ranking"
        icon={<TeamOutlined />}
        title={t("reports.agencyComparison.rankingTitle")}
        subtitle={t("reports.agencyComparison.rankingSubtitle")}
        scope={t("reports.agencyComparison.rankingScope", {
          range: periodLabel,
          previous: previousLabel,
        })}
        loading={loading}
        empty={!loading && activeParties.length === 0}
        emptyText={emptyText}
        minHeight={220}
      >
        <ResponsiveDataTable<ComparisonParty>
          rows={[...parties].sort((left, right) => right.qty - left.qty)}
          rowKey={(row) => row.id}
          emptyText={emptyText}
          maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
          onRowClick={(row) => {
            if (!model) return;
            openDrill({
              title: t("reports.agencyComparison.drillPartyTitle", {
                party: row.name,
              }),
              subtitle: periodLabel,
              partyId: row.id,
              from: model.period.from,
              to: model.period.to,
            });
          }}
          columns={[
            {
              key: "rank",
              header: t("reports.agencyComparison.colRank"),
              align: "center",
              width: 62,
              render: (row) =>
                rowIndexOf(
                  [...parties].sort((left, right) => right.qty - left.qty),
                  row,
                ) + 1,
            },
            {
              key: "party",
              header: t("reports.agencyComparison.colParty"),
              width: 230,
              truncate: 2,
              render: (row) => (
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", gap: 0.75, minWidth: 0 }}
                >
                  <PartyDot color={row.color} />
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      sx={{ alignItems: "center", gap: 0.5, minWidth: 0 }}
                    >
                      <Box sx={{ fontWeight: 700, minWidth: 0 }}>
                        {row.name || EMPTY_TEXT}
                      </Box>
                      <ComparableMark
                        ok={row.comparable}
                        label={
                          row.comparable
                            ? t("reports.agencyComparison.comparableOk")
                            : t("reports.agencyComparison.comparableWarn", {
                                month: monthLabel(row.coverageMonth),
                              })
                        }
                      />
                    </Stack>
                    <Box sx={{ fontSize: 11.5, color: S.textMedium }}>
                      {agencyPlaceLine(row.market, row.region) || EMPTY_TEXT}
                    </Box>
                  </Box>
                </Stack>
              ),
            },
            {
              key: "qty",
              header: t("reports.agencyComparison.colQty"),
              align: "right",
              render: (row) => (
                <Box sx={{ fontWeight: 700 }}>{quantityText(row.qty)}</Box>
              ),
            },
            {
              key: "share",
              header: t("reports.agencyComparison.colShare"),
              align: "right",
              hideOnMobile: true,
              render: (row) => `${Math.round(row.share)}%`,
            },
            {
              key: "topSku",
              header: t("reports.agencyComparison.colTopSku"),
              truncate: 2,
              render: (row) =>
                row.topSku ? (
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontWeight: 600 }}>
                      {row.topSku.code || row.topSku.name}
                    </Box>
                    <Box sx={{ fontSize: 11.5, color: S.textMedium }}>
                      {quantityText(row.topSku.qty)}
                    </Box>
                  </Box>
                ) : (
                  EMPTY_TEXT
                ),
            },
            {
              key: "skuCount",
              header: t("reports.agencyComparison.colSkuCount"),
              align: "right",
              hideOnMobile: true,
              render: (row) => quantityText(row.skuCount),
            },
            {
              key: "avg",
              header: t("reports.agencyComparison.colAvgMonth"),
              align: "right",
              hideOnMobile: true,
              render: (row) => quantityText(Math.round(row.avgPerMonth)),
            },
            {
              key: "best",
              header: t("reports.agencyComparison.colBestBucket"),
              align: "right",
              hideOnMobile: true,
              render: (row) =>
                row.bestBucket
                  ? `${row.bestBucket.label} · ${quantityText(row.bestBucket.qty)}`
                  : EMPTY_TEXT,
            },
            {
              key: "delta",
              header: t("reports.agencyComparison.colVsPrev"),
              align: "right",
              render: (row) =>
                row.delta === null ? (
                  <Box
                    sx={{ fontSize: 11.5, color: S.textMedium }}
                    title={t("reports.agencyComparison.noBaselineHint")}
                  >
                    {t("reports.agencyComparison.noBaseline")}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      fontWeight: 700,
                      color: row.delta >= 0 ? S.successText : S.errorText,
                    }}
                  >
                    {deltaText(row.delta)}
                  </Box>
                ),
            },
            {
              key: "trend",
              header: t("reports.agencyComparison.colTrend"),
              align: "center",
              render: (row) => <TrendArrow direction={row.trendDirection} />,
            },
          ]}
        />
        <Box sx={{ mt: 1.25, fontSize: 11.5, color: S.textMedium }}>
          {t("reports.agencyComparison.rankingNote")}
        </Box>
      </SectionCard>

      {/* ── Bảng chi tiết ──────────────────────────────────────────── */}
      <SectionCard
        id="report-08-cmp-detail"
        icon={<UnorderedListOutlined />}
        title={t("reports.agencyComparison.detailTitle")}
        subtitle={t("reports.agencyComparison.detailSubtitle")}
        scope={t("reports.agencyComparison.detailScope", {
          count: detailFilter.rows.length,
          total: detailRows.length,
        })}
        loading={loading}
        empty={!loading && detailRows.length === 0}
        emptyText={emptyText}
        minHeight={220}
      >
        <SectionFilterBar
          state={detailFilter}
          label={t("reports.agencyComparison.detailTitle")}
          unit={t("reports.common.unitRow")}
          showCount={false}
        />
        <Box sx={{ mt: 1.25 }}>
          <ResponsiveDataTable<DetailRow>
            rows={detailFilter.rows}
            rowKey={(row) => row.key}
            emptyText={emptyText}
            maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
            onRowClick={(row) => {
              if (!model) return;
              openDrill({
                title: t("reports.agencyComparison.drillCellTitle", {
                  party: row.party.name,
                  sku: row.sku.code || row.sku.name,
                }),
                subtitle: periodLabel,
                partyId: row.party.id,
                skuId: row.sku.id,
                from: model.period.from,
                to: model.period.to,
              });
            }}
            columns={[
              {
                key: "stt",
                header: t("shared.table.rowNumber"),
                align: "center",
                width: 56,
                render: (row) => rowIndexOf(detailFilter.rows, row) + 1,
              },
              {
                key: "party",
                header: t("reports.agencyComparison.colParty"),
                width: 220,
                truncate: 2,
                render: (row) => (
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", gap: 0.75, minWidth: 0 }}
                  >
                    <PartyDot color={row.party.color} />
                    <Box sx={{ minWidth: 0 }}>{row.party.name}</Box>
                  </Stack>
                ),
              },
              {
                key: "sku",
                header: t("reports.agencyComparison.colSku"),
                width: 260,
                truncate: 2,
                render: (row) => (
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontWeight: 700 }}>
                      {row.sku.code || EMPTY_TEXT}
                    </Box>
                    <Box sx={{ fontSize: 11.5, color: S.textMedium }}>
                      {row.sku.name || EMPTY_TEXT}
                    </Box>
                  </Box>
                ),
              },
              {
                key: "qty",
                header: t("reports.agencyComparison.colQty"),
                align: "right",
                render: (row) => (
                  <Box sx={{ fontWeight: 700 }}>{quantityText(row.qty)}</Box>
                ),
              },
              {
                key: "prev",
                header: t("reports.agencyComparison.colPrevQty"),
                align: "right",
                hideOnMobile: true,
                render: (row) => quantityText(row.prevQty),
              },
              {
                key: "delta",
                header: t("reports.agencyComparison.colDelta"),
                align: "right",
                render: (row) =>
                  row.delta === null ? (
                    <Box sx={{ fontSize: 11.5, color: S.textMedium }}>
                      {t("reports.agencyComparison.noBaseline")}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        fontWeight: 700,
                        color: row.delta >= 0 ? S.successText : S.errorText,
                      }}
                    >
                      {deltaText(row.delta)}
                    </Box>
                  ),
              },
              {
                key: "share",
                header: t("reports.agencyComparison.colSkuShare"),
                align: "right",
                hideOnMobile: true,
                render: (row) => `${Math.round(row.share)}%`,
              },
            ]}
          />
        </Box>
      </SectionCard>

      {drill ? (
        <DrillDownDialog
          title={drill.title}
          subtitle={drill.subtitle}
          onClose={() => setDrill(null)}
        >
          <ResponsiveDataTable<ComparisonDrillRow>
            rows={drillRows}
            rowKey={(row) => row.eventId}
            emptyText={t("reports.agencyComparison.drillEmpty")}
            maxBodyHeight={RPT_SCROLL_MAX_HEIGHT}
            columns={[
              {
                key: "occurredAt",
                header: t("reports.agencyComparison.colOccurredAt"),
                render: (row) => formatDate(row.occurredAt),
              },
              {
                key: "document",
                header: t("reports.agencyComparison.colDocument"),
                render: (row) => row.outboundNo || EMPTY_TEXT,
              },
              {
                key: "party",
                header: t("reports.agencyComparison.colParty"),
                truncate: 2,
                render: (row) => row.partyName || EMPTY_TEXT,
              },
              {
                key: "sku",
                header: t("reports.agencyComparison.colSku"),
                truncate: 2,
                render: (row) =>
                  [row.skuCode, row.skuName].filter(Boolean).join(" · ") ||
                  EMPTY_TEXT,
              },
              {
                key: "type",
                header: t("reports.agencyComparison.colEventType"),
                render: (row) => (
                  <UiStatusBadge
                    size="small"
                    tone={
                      row.eventType === "ISSUE_POSTED" ? "success" : "warning"
                    }
                    label={t(
                      row.eventType === "ISSUE_POSTED"
                        ? "reports.recipientAgency.eventPosted"
                        : "reports.recipientAgency.eventReversed",
                    )}
                  />
                ),
              },
              {
                key: "qty",
                header: t("reports.agencyComparison.colQty"),
                align: "right",
                render: (row) => quantityText(row.quantity),
              },
            ]}
          />
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        mb: 0.65,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: "18px",
        color: S.textMedium,
      }}
    >
      {children}
    </Box>
  );
}
