/**
 * Bộ tính của tab "So sánh đối tượng nhận hàng" (RPT-07 · tab 2).
 *
 * Module này CỐ Ý thuần tuý: vào là sổ sự kiện xuất (`RecipientAgencyLedgerEvent`
 * — chính sổ mà tab lát cắt đang dùng) + bộ lọc, ra là toàn bộ mô hình mà màn
 * hình cần vẽ. Không React, không i18n, không gọi mạng — để phần khó nhất của
 * màn này (xếp hạng, so kỳ, nhận xét tự động) kiểm được bằng unit test thay vì
 * phải mở trình duyệt nhìn bằng mắt.
 *
 * Ba quy ước xuyên suốt, viết ra đây vì chúng quyết định mọi con số bên dưới:
 *
 * 1. SỐ LƯỢNG LÀ **XUẤT THUẦN** (net = đã ghi sổ − đã hoàn tác), cùng công thức
 *    với tab lát cắt. Sổ sự kiện đã tách sẵn hai loại `ISSUE_POSTED` /
 *    `ISSUE_REVERSED`, nên ở đây chỉ cần cộng có dấu. Hai tab trên cùng một
 *    trang mà lệch nhau một đơn vị là mất niềm tin vào cả trang.
 *
 * 2. KHÔNG KẾT LUẬN KHI DỮ LIỆU KHÔNG ĐỦ. Đại lý chưa phát sinh ở kỳ trước thì
 *    `delta = null` (màn hình in "Chưa đủ dữ liệu"), KHÔNG in +100%. Đại lý bắt
 *    đầu có dữ liệu giữa kỳ thì bị đánh dấu `comparable = false` và mọi nhận xét
 *    xếp hạng đều kèm cảnh báo — đúng ca "đại lý A từ tháng 1, đại lý B từ
 *    tháng 5" trong yêu cầu.
 *
 * 3. NHẬN XÉT LÀ DỮ LIỆU, KHÔNG PHẢI CÂU CHỮ. `buildInsights` trả về
 *    `{ kind, messageKey, values }`; câu tiếng Việt/tiếng Anh nằm ở messages.ts.
 *    Nhờ vậy không có chuỗi cứng nào lọt vào tầng tính toán, và test kiểm được
 *    "có ra đúng nhận xét đó không" mà không phụ thuộc vào chữ.
 */
import dayjs, { type Dayjs } from "dayjs";
import type { MessageKey } from "@/shared/i18n/messages";
import type { MessageVars } from "@/shared/i18n/useT";
import {
  COMPARISON_CHART_SERIES_LIMIT,
  COMPARISON_MIN_OBJECTS,
} from "@/modules/reports/operations/comparison-display";
import type { RecipientAgencyLedgerEvent } from "./recipient-agency-api";

export const API_DATE_FORMAT = "YYYY-MM-DD";

/**
 * Hai con số dưới đây KHÔNG còn được chốt tại đây. Luật "so mấy đối tượng thì
 * đọc bằng hình gì" là luật chung của mọi màn so sánh và nằm ở
 * `@/modules/reports/operations/comparison-display`; ở đây chỉ giữ lại tên cũ
 * để nơi gọi không phải đổi một lượt.
 */
export const COMPARISON_SERIES_LIMIT = COMPARISON_CHART_SERIES_LIMIT;
export const COMPARISON_MIN_PARTIES = COMPARISON_MIN_OBJECTS;

export type ComparisonGranularity = "day" | "week" | "month";

export type ComparisonWindow = { from: string; to: string };

export type ComparisonBucket = {
  key: string;
  label: string;
  from: string;
  to: string;
  /** false = mốc bị cắt bởi mép cửa sổ dữ liệu ⇒ không dùng để so tăng/giảm. */
  complete: boolean;
};

export type ComparisonSkuScope = "TOP10" | "TOP20" | "ALL";

export type ComparisonFilters = {
  /** Kỳ đang xem. */
  from: string;
  to: string;
  recipientTypes: string[];
  markets: string[];
  regions: string[];
  /** Đối tượng nhận hàng đang so sánh. Rỗng ⇒ chưa chọn, màn hình gợi ý top. */
  partyIds: string[];
  categoryIds: string[];
  skuIds: string[];
  skuScope: ComparisonSkuScope;
  /** "TOTAL" hoặc id của một đối tượng — trục sắp xếp của ma trận SKU. */
  matrixSortBy: string;
  /** "ALL" | `sku:<id>` | `cat:<id>` — chỉ số vẽ trên biểu đồ xu hướng. */
  trendMetric: string;
};

export const DEFAULT_COMPARISON_FILTERS: Omit<
  ComparisonFilters,
  "from" | "to"
> = {
  recipientTypes: [],
  markets: [],
  regions: [],
  partyIds: [],
  categoryIds: [],
  skuIds: [],
  skuScope: "TOP10",
  matrixSortBy: "TOTAL",
  trendMetric: "ALL",
};

export type ComparisonParty = {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  market: string;
  region: string;
  /** Màu cố định của đối tượng này trên MỌI biểu đồ của tab. */
  color: string;
  qty: number;
  prevQty: number;
  /** null = kỳ trước không phát sinh ⇒ không có tỉ lệ nào để nói. */
  delta: number | null;
  documents: number;
  skuCount: number;
  share: number;
  topSku: { id: string; code: string; name: string; qty: number } | null;
  /** Mốc phát sinh sớm nhất TRONG cửa sổ dữ liệu đã tải (YYYY-MM-DD). */
  firstActivity: string;
  lastActivity: string;
  /** Tháng bắt đầu có dữ liệu (YYYY-MM) — nguồn của cảnh báo "lệch kỳ". */
  coverageMonth: string;
  /** true = mốc đầu chạm mép cửa sổ ⇒ chỉ biết "ít nhất từ", không phải "bắt đầu từ". */
  coverageAtWindowEdge: boolean;
  /** false = chưa có dữ liệu từ đầu kỳ ⇒ so sánh trực tiếp là không tương đương. */
  comparable: boolean;
  activeMonths: number;
  avgPerMonth: number;
  bestBucket: { key: string; label: string; qty: number } | null;
  trend: number[];
  trendDirection: "up" | "down" | "flat" | "unknown";
};

export type ComparisonSku = {
  id: string;
  code: string;
  name: string;
  categoryId: string | null;
  qty: number;
  prevQty: number;
  delta: number | null;
  rank: number;
  prevRank: number | null;
  /** Số lượng theo từng đối tượng, cùng thứ tự với `parties`. */
  byParty: number[];
  prevByParty: number[];
  topPartyId: string | null;
  lowPartyId: string | null;
  partyCount: number;
};

export type SlowMoverReason = "NO_MOVEMENT" | "DECLINED" | "LOW_VOLUME";

export type ComparisonSlowMover = ComparisonSku & {
  reason: SlowMoverReason;
};

export type ComparisonInsightKind =
  | "highlight"
  | "growth"
  | "decline"
  | "slow"
  | "anomaly"
  | "data";

export type ComparisonInsight = {
  id: string;
  kind: ComparisonInsightKind;
  messageKey: MessageKey;
  values: MessageVars;
  /** Độ đáng chú ý — chỉ dùng để xếp thứ tự, không hiển thị. */
  weight: number;
};

export type MonthOverMonth = {
  currentKey: string;
  currentLabel: string;
  currentQty: number;
  previousKey: string;
  previousLabel: string;
  previousQty: number;
  delta: number;
  /** true = tháng hiện tại chưa hết, hai vế đều cắt ở ngày `throughDay`. */
  partial: boolean;
  throughDay: number;
  /** Số đối tượng có mặt ở CẢ HAI tháng — nền tính của tỉ lệ trên. */
  partyCount: number;
  /** Số đối tượng bị loại vì chỉ có mặt ở một trong hai tháng. */
  excludedPartyCount: number;
};

export type ComparisonTotals = {
  qty: number;
  prevQty: number;
  delta: number | null;
  documents: number;
  skuCount: number;
  partyCount: number;
  /** Số đối tượng thật sự có phát sinh trong kỳ. */
  activePartyCount: number;
  avgPerMonth: number;
  monthsInPeriod: number;
};

export type ComparisonModel = {
  period: ComparisonWindow;
  previous: ComparisonWindow;
  window: ComparisonWindow;
  granularity: ComparisonGranularity;
  buckets: ComparisonBucket[];
  parties: ComparisonParty[];
  skus: ComparisonSku[];
  /** SKU đã cắt theo `skuScope` — tập vẽ trên biểu đồ so sánh & heatmap. */
  scopedSkus: ComparisonSku[];
  fastMovers: ComparisonSku[];
  slowMovers: ComparisonSlowMover[];
  /**
   * Chuỗi vẽ trên biểu đồ xu hướng, cùng thứ tự với `parties`.
   *
   * Tách khỏi `party.trend` vì hai chuỗi trả lời hai câu khác nhau: `party.trend`
   * luôn là TỔNG của đối tượng (nguồn của mũi tên xu hướng và điểm bất thường
   * trong bảng xếp hạng), còn chuỗi này đổi theo ô "Chỉ số" — người dùng chọn
   * một SKU hoặc một nhóm hàng thì chỉ biểu đồ đổi, bảng xếp hạng giữ nguyên.
   */
  metricTrend: number[][];
  /**
   * "Tháng này so với tháng trước" — tính RIÊNG, không lấy từ hai mốc cuối của
   * biểu đồ xu hướng.
   *
   * Vì mốc của biểu đồ đổi theo độ dài kỳ (ngày / tuần / tháng), lấy hai mốc
   * cuối sẽ cho ra "tuần 24/08 so với tuần 17/08" khi người dùng chọn kỳ hai
   * tháng — đúng về số nhưng không phải câu hỏi mà quản lý đang hỏi. Ở đây luôn
   * là THÁNG, và khi tháng hiện tại chưa hết thì so ĐÚNG SỐ NGÀY đã trôi qua
   * của tháng trước (01–06/09 với 01–06/08) chứ không đem nửa tháng so cả tháng.
   */
  monthOverMonth: MonthOverMonth | null;
  totals: ComparisonTotals;
  insights: ComparisonInsight[];
  /** Đối tượng bị bỏ khỏi biểu đồ vì vượt trần series (vẫn còn trong bảng). */
  hiddenPartyCount: number;
  /** true = có ít nhất một đối tượng chưa có dữ liệu từ đầu kỳ. */
  hasCoverageGap: boolean;
};

// ── Khoảng thời gian ─────────────────────────────────────────────────────

function toDay(value: string): Dayjs {
  return dayjs(value, API_DATE_FORMAT);
}

/**
 * Kỳ liền trước: CÙNG ĐỘ DÀI, kết thúc ngay trước ngày đầu kỳ đang xem.
 *
 * Cố ý không "lùi một tháng lịch": kỳ đang xem có thể là 7 ngày, 45 ngày hay
 * một quý, và người đọc so sánh "kỳ này với kỳ trước cùng độ dài" thì con số
 * mới có nghĩa. Riêng nhận xét "tháng này so với tháng trước" được tính từ các
 * mốc THÁNG đầy đủ trong biểu đồ xu hướng, không lấy từ cặp kỳ này.
 */
export function previousWindowOf(window: ComparisonWindow): ComparisonWindow {
  const from = toDay(window.from);
  const to = toDay(window.to);
  const lengthInDays = Math.max(1, to.diff(from, "day") + 1);
  const previousTo = from.subtract(1, "day");
  return {
    from: previousTo.subtract(lengthInDays - 1, "day").format(API_DATE_FORMAT),
    to: previousTo.format(API_DATE_FORMAT),
  };
}

/**
 * Cửa sổ dữ liệu cần tải = kỳ đang xem + kỳ liền trước, MỞ RỘNG về đầu tháng.
 *
 * Vì sao phải mở rộng: nhận xét "tháng 8 tăng so với tháng 7" chỉ đúng khi cả
 * hai tháng nằm TRỌN trong cửa sổ. Kỳ "Tháng này" (01/09 → hôm nay) có kỳ
 * trước bắt đầu từ 02/08 — thiếu đúng ngày 01/08, đủ để câu nhận xét sai.
 */
export function analysisWindowOf(period: ComparisonWindow): ComparisonWindow {
  const previous = previousWindowOf(period);
  return {
    from: toDay(previous.from).startOf("month").format(API_DATE_FORMAT),
    to: period.to,
  };
}

/** Mốc thời gian của biểu đồ xu hướng, chọn theo ĐỘ DÀI kỳ chứ không theo số điểm. */
export function granularityOf(period: ComparisonWindow): ComparisonGranularity {
  const days = toDay(period.to).diff(toDay(period.from), "day") + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

function bucketKeyOf(date: Dayjs, granularity: ComparisonGranularity): string {
  if (granularity === "day") return date.format(API_DATE_FORMAT);
  if (granularity === "month") return date.format("YYYY-MM");
  return date.startOf("week").format(API_DATE_FORMAT);
}

function bucketLabelOf(
  start: Dayjs,
  granularity: ComparisonGranularity,
): string {
  if (granularity === "day") return start.format("DD/MM");
  if (granularity === "month") return start.format("MM/YYYY");
  return start.format("DD/MM");
}

export function bucketsOf(
  period: ComparisonWindow,
  granularity: ComparisonGranularity,
  today: Dayjs = dayjs(),
): ComparisonBucket[] {
  const unit = granularity === "day" ? "day" : granularity;
  const first = toDay(period.from).startOf(unit);
  const last = toDay(period.to).startOf(unit);
  const buckets: ComparisonBucket[] = [];
  let cursor = first;
  // Trần cứng: kỳ vài năm ở mốc "ngày" sẽ dựng hàng nghìn cột và treo trình
  // duyệt trước khi kịp vẽ. `granularityOf` đã ngăn ca đó, đây là chốt chặn.
  for (let guard = 0; !cursor.isAfter(last) && guard < 400; guard += 1) {
    const start = cursor;
    const end = cursor.endOf(unit).startOf("day");
    buckets.push({
      key: bucketKeyOf(start, granularity),
      label: bucketLabelOf(start, granularity),
      from: start.format(API_DATE_FORMAT),
      to: end.format(API_DATE_FORMAT),
      complete:
        !start.isBefore(toDay(period.from), "day") &&
        !end.isAfter(toDay(period.to), "day") &&
        !end.isAfter(today, "day"),
    });
    cursor = cursor.add(1, unit);
  }
  return buckets;
}

// ── Lọc & gộp ────────────────────────────────────────────────────────────

/** Lượng CÓ DẤU của một sự kiện: ghi sổ cộng vào, hoàn tác trừ ra. */
function signedQty(event: RecipientAgencyLedgerEvent): number {
  return event.event_type === "ISSUE_POSTED" ? event.quantity : -event.quantity;
}

function partyIdOf(event: RecipientAgencyLedgerEvent): string {
  return event.recipient.id || "";
}

function inWindow(occurredAt: string, window: ComparisonWindow): boolean {
  if (!occurredAt) return false;
  const day = occurredAt.slice(0, 10);
  return day >= window.from && day <= window.to;
}

export type ComparisonContext = {
  /** sku_id → category_id, lấy từ danh mục SKU. */
  categoryOfSku: (skuId: string) => string | null;
  /** party_id → { market, region } của master data đại lý. */
  marketOfParty: (partyId: string) => { market: string; region: string };
  palette: string[];
  today?: Dayjs;
};

function matchesDimensionFilters(
  event: RecipientAgencyLedgerEvent,
  filters: ComparisonFilters,
  context: ComparisonContext,
): boolean {
  if (
    filters.recipientTypes.length > 0 &&
    !filters.recipientTypes.includes(event.recipient.type ?? "")
  ) {
    return false;
  }
  if (filters.markets.length > 0 || filters.regions.length > 0) {
    const place = context.marketOfParty(partyIdOf(event));
    if (filters.markets.length > 0 && !filters.markets.includes(place.market)) {
      return false;
    }
    if (filters.regions.length > 0 && !filters.regions.includes(place.region)) {
      return false;
    }
  }
  if (filters.skuIds.length > 0 && !filters.skuIds.includes(event.sku.id)) {
    return false;
  }
  if (filters.categoryIds.length > 0) {
    const category = context.categoryOfSku(event.sku.id);
    if (!category || !filters.categoryIds.includes(category)) return false;
  }
  return true;
}

function percentChange(current: number, previous: number): number | null {
  // Kỳ trước bằng 0 thì KHÔNG có tỉ lệ nào đúng cả: "+100%" và "+∞" đều là bịa.
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function directionOf(series: number[]): ComparisonParty["trendDirection"] {
  const points = series.filter((value) => Number.isFinite(value));
  if (points.length < 2) return "unknown";
  const half = Math.floor(points.length / 2);
  const earlier = points.slice(0, half);
  const later = points.slice(points.length - half);
  const mean = (values: number[]) =>
    values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  const before = mean(earlier);
  const after = mean(later);
  if (before === 0 && after === 0) return "flat";
  const change = before === 0 ? 1 : (after - before) / before;
  if (change > 0.05) return "up";
  if (change < -0.05) return "down";
  return "flat";
}

// ── Mô hình chính ────────────────────────────────────────────────────────

type Accumulator = {
  qty: number;
  documents: Set<string>;
  skus: Set<string>;
  first: string;
  last: string;
};

function emptyAccumulator(): Accumulator {
  return { qty: 0, documents: new Set(), skus: new Set(), first: "", last: "" };
}

function accumulate(target: Accumulator, event: RecipientAgencyLedgerEvent) {
  target.qty += signedQty(event);
  const day = event.occurred_at.slice(0, 10);
  if (event.event_type === "ISSUE_POSTED") {
    target.documents.add(event.outbound_document_id);
    target.skus.add(event.sku.id);
    if (day && (!target.first || day < target.first)) target.first = day;
    if (day && (!target.last || day > target.last)) target.last = day;
  }
}

export function buildComparison(
  events: RecipientAgencyLedgerEvent[],
  filters: ComparisonFilters,
  context: ComparisonContext,
): ComparisonModel {
  const period: ComparisonWindow = { from: filters.from, to: filters.to };
  const previous = previousWindowOf(period);
  const window = analysisWindowOf(period);
  const granularity = granularityOf(period);
  const today = context.today ?? dayjs();
  const buckets = bucketsOf(period, granularity, today);

  const relevant = events.filter((event) =>
    matchesDimensionFilters(event, filters, context),
  );

  // Đối tượng nào được so sánh: người dùng chọn thì theo lựa chọn, chưa chọn
  // thì lấy top theo sản lượng trong kỳ — màn hình luôn có gì đó để đọc thay vì
  // một khung rỗng bắt người dùng đoán phải bấm gì trước.
  const periodEvents = relevant.filter((event) =>
    inWindow(event.occurred_at, period),
  );
  const previousEvents = relevant.filter((event) =>
    inWindow(event.occurred_at, previous),
  );

  const qtyByParty = new Map<string, number>();
  for (const event of periodEvents) {
    const id = partyIdOf(event);
    if (!id) continue;
    qtyByParty.set(id, (qtyByParty.get(id) ?? 0) + signedQty(event));
  }
  const rankedPartyIds = [...qtyByParty.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => id);

  const selectedIds =
    filters.partyIds.length > 0
      ? filters.partyIds
      : rankedPartyIds.slice(0, COMPARISON_SERIES_LIMIT);
  const selectedSet = new Set(selectedIds);

  const scopedPeriod = periodEvents.filter((event) =>
    selectedSet.has(partyIdOf(event)),
  );
  const scopedPrevious = previousEvents.filter((event) =>
    selectedSet.has(partyIdOf(event)),
  );
  const scopedWindow = relevant.filter((event) =>
    selectedSet.has(partyIdOf(event)),
  );

  // ── Đối tượng nhận hàng ────────────────────────────────────────────────
  const currentByParty = new Map<string, Accumulator>();
  const previousByParty = new Map<string, Accumulator>();
  const windowByParty = new Map<string, Accumulator>();
  const identityByParty = new Map<string, RecipientAgencyLedgerEvent>();
  const skuQtyByParty = new Map<string, Map<string, number>>();
  const bucketQtyByParty = new Map<string, Map<string, number>>();

  const bucketKeys = new Set(buckets.map((bucket) => bucket.key));

  for (const [source, target] of [
    [scopedPeriod, currentByParty],
    [scopedPrevious, previousByParty],
    [scopedWindow, windowByParty],
  ] as const) {
    for (const event of source) {
      const id = partyIdOf(event);
      if (!id) continue;
      let bucket = target.get(id);
      if (!bucket) {
        bucket = emptyAccumulator();
        target.set(id, bucket);
      }
      accumulate(bucket, event);
      if (!identityByParty.has(id)) identityByParty.set(id, event);
    }
  }

  for (const event of scopedPeriod) {
    const id = partyIdOf(event);
    if (!id) continue;
    let skuMap = skuQtyByParty.get(id);
    if (!skuMap) {
      skuMap = new Map();
      skuQtyByParty.set(id, skuMap);
    }
    skuMap.set(
      event.sku.id,
      (skuMap.get(event.sku.id) ?? 0) + signedQty(event),
    );

    const bucketKey = bucketKeyOf(
      dayjs(event.occurred_at.slice(0, 10), API_DATE_FORMAT),
      granularity,
    );
    if (!bucketKeys.has(bucketKey)) continue;
    let series = bucketQtyByParty.get(id);
    if (!series) {
      series = new Map();
      bucketQtyByParty.set(id, series);
    }
    series.set(bucketKey, (series.get(bucketKey) ?? 0) + signedQty(event));
  }

  const groupQty = [...currentByParty.values()].reduce(
    (sum, item) => sum + Math.max(0, item.qty),
    0,
  );
  const windowFirstMonth = window.from.slice(0, 7);
  const periodStartMonth = period.from.slice(0, 7);

  const parties: ComparisonParty[] = selectedIds.map((id, index) => {
    const identity = identityByParty.get(id);
    const current = currentByParty.get(id) ?? emptyAccumulator();
    const prior = previousByParty.get(id) ?? emptyAccumulator();
    const across = windowByParty.get(id) ?? emptyAccumulator();
    const place = context.marketOfParty(id);
    const skuMap = skuQtyByParty.get(id) ?? new Map<string, number>();
    const topSkuEntry = [...skuMap.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0];
    const topSkuEvent = topSkuEntry
      ? scopedPeriod.find(
          (event) => partyIdOf(event) === id && event.sku.id === topSkuEntry[0],
        )
      : undefined;
    const series = buckets.map(
      (bucket) => bucketQtyByParty.get(id)?.get(bucket.key) ?? 0,
    );
    const bestIndex = series.reduce(
      (best, value, at) => (value > series[best] ? at : best),
      0,
    );
    const coverageMonth = across.first ? across.first.slice(0, 7) : "";
    const activeMonths = new Set(
      buckets
        .filter((_, at) => series[at] > 0)
        .map((bucket) => bucket.from.slice(0, 7)),
    ).size;

    return {
      id,
      code: identity?.recipient.code ?? null,
      name: identity?.recipient.name ?? "",
      type: identity?.recipient.type ?? null,
      market: place.market,
      region: place.region,
      color: context.palette[index % context.palette.length],
      qty: current.qty,
      prevQty: prior.qty,
      delta: percentChange(current.qty, prior.qty),
      documents: current.documents.size,
      skuCount: current.skus.size,
      share: groupQty > 0 ? (Math.max(0, current.qty) / groupQty) * 100 : 0,
      topSku:
        topSkuEntry && topSkuEvent
          ? {
              id: topSkuEntry[0],
              code: topSkuEvent.sku.code ?? "",
              name: topSkuEvent.sku.name ?? "",
              qty: topSkuEntry[1],
            }
          : null,
      firstActivity: across.first,
      lastActivity: across.last,
      coverageMonth,
      coverageAtWindowEdge: Boolean(
        coverageMonth && coverageMonth === windowFirstMonth,
      ),
      // "Tương đương" = đã có phát sinh từ trước hoặc ngay đầu kỳ đang xem.
      // Đại lý mở tháng 5 mà đem so cả quý I với đại lý mở tháng 1 là so sai.
      comparable: Boolean(coverageMonth) && coverageMonth <= periodStartMonth,
      activeMonths,
      avgPerMonth: activeMonths > 0 ? current.qty / activeMonths : current.qty,
      bestBucket:
        series[bestIndex] > 0
          ? {
              key: buckets[bestIndex].key,
              label: buckets[bestIndex].label,
              qty: series[bestIndex],
            }
          : null,
      trend: series,
      trendDirection: directionOf(series),
    };
  });

  // ── SKU ────────────────────────────────────────────────────────────────
  const skuIndexOfParty = new Map(parties.map((party, at) => [party.id, at]));
  const skuAccumulator = new Map<
    string,
    {
      code: string;
      name: string;
      qty: number;
      prevQty: number;
      byParty: number[];
      prevByParty: number[];
    }
  >();

  const touchSku = (event: RecipientAgencyLedgerEvent) => {
    let entry = skuAccumulator.get(event.sku.id);
    if (!entry) {
      entry = {
        code: event.sku.code ?? "",
        name: event.sku.name ?? "",
        qty: 0,
        prevQty: 0,
        byParty: parties.map(() => 0),
        prevByParty: parties.map(() => 0),
      };
      skuAccumulator.set(event.sku.id, entry);
    }
    return entry;
  };

  for (const event of scopedPeriod) {
    const entry = touchSku(event);
    const at = skuIndexOfParty.get(partyIdOf(event));
    entry.qty += signedQty(event);
    if (at !== undefined) entry.byParty[at] += signedQty(event);
  }
  for (const event of scopedPrevious) {
    const entry = touchSku(event);
    const at = skuIndexOfParty.get(partyIdOf(event));
    entry.prevQty += signedQty(event);
    if (at !== undefined) entry.prevByParty[at] += signedQty(event);
  }

  const previousRankOfSku = new Map(
    [...skuAccumulator.entries()]
      .filter(([, entry]) => entry.prevQty > 0)
      .sort((left, right) => right[1].prevQty - left[1].prevQty)
      .map(([id], at) => [id, at + 1]),
  );

  const skus: ComparisonSku[] = [...skuAccumulator.entries()]
    .sort((left, right) => right[1].qty - left[1].qty)
    .map(([id, entry], at) => {
      const active = entry.byParty
        .map((qty, index) => ({ qty, index }))
        .filter((item) => item.qty > 0);
      const highest = active.reduce<{ qty: number; index: number } | null>(
        (best, item) => (best === null || item.qty > best.qty ? item : best),
        null,
      );
      const lowest = active.reduce<{ qty: number; index: number } | null>(
        (worst, item) =>
          worst === null || item.qty < worst.qty ? item : worst,
        null,
      );
      return {
        id,
        code: entry.code,
        name: entry.name,
        categoryId: context.categoryOfSku(id),
        qty: entry.qty,
        prevQty: entry.prevQty,
        delta: percentChange(entry.qty, entry.prevQty),
        rank: at + 1,
        prevRank: previousRankOfSku.get(id) ?? null,
        byParty: entry.byParty,
        prevByParty: entry.prevByParty,
        topPartyId: highest ? (parties[highest.index]?.id ?? null) : null,
        lowPartyId: lowest ? (parties[lowest.index]?.id ?? null) : null,
        partyCount: active.length,
      };
    });

  const movedSkus = skus.filter((sku) => sku.qty > 0);
  const scopeSize =
    filters.skuScope === "TOP10" ? 10 : filters.skuScope === "TOP20" ? 20 : 0;
  const sortedForMatrix = sortSkusForMatrix(
    movedSkus,
    filters.matrixSortBy,
    skuIndexOfParty,
  );
  const scopedSkus =
    scopeSize > 0 ? sortedForMatrix.slice(0, scopeSize) : sortedForMatrix;

  const fastMovers = movedSkus.slice(0, 10);
  const slowMovers = pickSlowMovers(skus);

  const monthsInPeriod = Math.max(
    1,
    toDay(period.to)
      .startOf("month")
      .diff(toDay(period.from).startOf("month"), "month") + 1,
  );
  const totalQty = parties.reduce((sum, party) => sum + party.qty, 0);
  const totalPrevQty = parties.reduce((sum, party) => sum + party.prevQty, 0);

  const totals: ComparisonTotals = {
    qty: totalQty,
    prevQty: totalPrevQty,
    delta: percentChange(totalQty, totalPrevQty),
    documents: new Set(
      scopedPeriod
        .filter((event) => event.event_type === "ISSUE_POSTED")
        .map((event) => event.outbound_document_id),
    ).size,
    skuCount: movedSkus.length,
    partyCount: parties.length,
    activePartyCount: parties.filter((party) => party.qty !== 0).length,
    avgPerMonth: totalQty / monthsInPeriod,
    monthsInPeriod,
  };

  const model: Omit<ComparisonModel, "insights"> = {
    period,
    previous,
    window,
    granularity,
    buckets,
    parties,
    skus,
    scopedSkus,
    fastMovers,
    slowMovers,
    metricTrend: metricTrendOf(
      scopedPeriod,
      filters.trendMetric,
      parties,
      buckets,
      granularity,
      context,
    ),
    // Đọc trên `scopedWindow` (cả cửa sổ) chứ không phải `scopedPeriod`: khi kỳ
    // đang xem đúng bằng một tháng thì tháng liền trước nằm NGOÀI kỳ, và đó
    // chính là vế cần so.
    monthOverMonth: monthOverMonthOf(scopedWindow, period, window),
    totals,
    hiddenPartyCount: Math.max(0, parties.length - COMPARISON_SERIES_LIMIT),
    hasCoverageGap: parties.some(
      (party) => party.qty !== 0 && !party.comparable,
    ),
  };

  return { ...model, insights: buildInsights(model) };
}

/**
 * "Tháng này so với tháng trước" trên toàn nhóm đang so sánh.
 *
 * Hai vế LUÔN cùng số ngày: nếu tháng đang xem mới trôi tới ngày 6 thì vế kia
 * cũng chỉ lấy tới ngày 6. So nửa tháng với cả tháng là cách nhanh nhất để một
 * bản báo cáo tự bịa ra một cú "giảm 50%" không có thật.
 *
 * Trả `null` khi tháng trước không nằm trọn trong cửa sổ đã tải hoặc không có
 * phát sinh — thà không nói gì còn hơn nói một tỉ lệ dựng trên dữ liệu thiếu.
 */
function monthOverMonthOf(
  events: RecipientAgencyLedgerEvent[],
  period: ComparisonWindow,
  window: ComparisonWindow,
): MonthOverMonth | null {
  const end = toDay(period.to);
  const currentStart = end.startOf("month");
  const previousStart = currentStart.subtract(1, "month");
  if (previousStart.format(API_DATE_FORMAT) < window.from) return null;

  const monthEnd = end.endOf("month").startOf("day");
  const partial = end.isBefore(monthEnd, "day");
  const throughDay = partial ? end.date() : monthEnd.date();

  /** Số lượng của từng đối tượng trong `throughDay` ngày đầu của một tháng. */
  const sumByParty = (start: Dayjs) => {
    // `min(...)` cho tháng ngắn hơn: 31/01 so với tháng 2 thì vế tháng 2 dừng ở
    // ngày cuối tháng đó, không tràn sang tháng 3.
    const last = Math.min(throughDay, start.daysInMonth());
    const slice = {
      from: start.format(API_DATE_FORMAT),
      to: start.date(last).format(API_DATE_FORMAT),
    };
    const totals = new Map<string, number>();
    for (const event of events) {
      if (!inWindow(event.occurred_at, slice)) continue;
      const id = partyIdOf(event);
      if (!id) continue;
      totals.set(id, (totals.get(id) ?? 0) + signedQty(event));
    }
    return totals;
  };

  const current = sumByParty(currentStart);
  const previous = sumByParty(previousStart);

  /*
   * CHỈ tính trên những đối tượng có mặt ở CẢ HAI tháng.
   *
   * Vì sao: một đại lý vừa mở trong tháng này làm tổng nhóm nhảy vọt — đo thật
   * trên dữ liệu mẫu là "+4.998%" — và con số đó không nói gì về việc kinh
   * doanh đang tốt lên hay xấu đi, nó chỉ nói rằng danh sách đối tượng đã đổi.
   * Phần "danh sách đã đổi" đã được nói riêng ở nhận xét Cảnh báo dữ liệu.
   */
  const shared = [...current.keys()].filter(
    (id) => (previous.get(id) ?? 0) > 0,
  );
  if (shared.length === 0) return null;

  const currentQty = shared.reduce(
    (sum, id) => sum + (current.get(id) ?? 0),
    0,
  );
  const previousQty = shared.reduce(
    (sum, id) => sum + (previous.get(id) ?? 0),
    0,
  );
  const delta = percentChange(currentQty, previousQty);
  if (delta === null) return null;

  return {
    currentKey: currentStart.format("YYYY-MM"),
    currentLabel: currentStart.format("MM/YYYY"),
    currentQty,
    previousKey: previousStart.format("YYYY-MM"),
    previousLabel: previousStart.format("MM/YYYY"),
    previousQty,
    delta,
    partial,
    throughDay,
    partyCount: shared.length,
    excludedPartyCount:
      new Set([...current.keys(), ...previous.keys()]).size - shared.length,
  };
}

/**
 * Chuỗi xu hướng theo chỉ số đang chọn: tổng, một SKU, hoặc một nhóm hàng.
 *
 * Chỉ số "một SKU" KHÔNG lọc lại toàn bộ mô hình — nếu lọc, bảng xếp hạng và
 * KPI cũng đổi theo và người dùng mất mất ngữ cảnh "toàn kỳ" mà họ vừa đọc ở
 * trên. Ở đây chỉ thu hẹp đúng tập sự kiện dùng để vẽ đường.
 */
function metricTrendOf(
  events: RecipientAgencyLedgerEvent[],
  metric: string,
  parties: ComparisonParty[],
  buckets: ComparisonBucket[],
  granularity: ComparisonGranularity,
  context: ComparisonContext,
): number[][] {
  const scoped =
    metric === "ALL"
      ? events
      : metric.startsWith("sku:")
        ? events.filter((event) => event.sku.id === metric.slice(4))
        : metric.startsWith("cat:")
          ? events.filter(
              (event) =>
                context.categoryOfSku(event.sku.id) === metric.slice(4),
            )
          : events;

  const indexOfBucket = new Map(buckets.map((bucket, at) => [bucket.key, at]));
  const indexOfParty = new Map(parties.map((party, at) => [party.id, at]));
  const series = parties.map(() => buckets.map(() => 0));

  for (const event of scoped) {
    const partyAt = indexOfParty.get(partyIdOf(event));
    if (partyAt === undefined) continue;
    const bucketAt = indexOfBucket.get(
      bucketKeyOf(
        dayjs(event.occurred_at.slice(0, 10), API_DATE_FORMAT),
        granularity,
      ),
    );
    if (bucketAt === undefined) continue;
    series[partyAt][bucketAt] += signedQty(event);
  }
  return series;
}

function sortSkusForMatrix(
  skus: ComparisonSku[],
  sortBy: string,
  indexOfParty: Map<string, number>,
): ComparisonSku[] {
  if (sortBy === "TOTAL") return skus;
  const at = indexOfParty.get(sortBy);
  if (at === undefined) return skus;
  return [...skus].sort(
    (left, right) => (right.byParty[at] ?? 0) - (left.byParty[at] ?? 0),
  );
}

/**
 * "Bán chậm" KHÔNG phải là "số lượng = 0".
 *
 * Ba nhóm khác nhau về hành động: hàng đứng hẳn (có kỳ trước, kỳ này không phát
 * sinh), hàng đang rơi (giảm từ 40% trở lên), và hàng vẫn chạy nhưng nằm đáy.
 * Gộp cả ba vào một danh sách "SKU = 0" thì quản lý mất đúng thông tin cần để
 * biết nên xử lý cái nào trước.
 */
function pickSlowMovers(skus: ComparisonSku[]): ComparisonSlowMover[] {
  const stalled = skus
    .filter((sku) => sku.qty <= 0 && sku.prevQty > 0)
    .map((sku) => ({ ...sku, reason: "NO_MOVEMENT" as const }))
    .sort((left, right) => right.prevQty - left.prevQty);

  const declined = skus
    .filter((sku) => sku.qty > 0 && sku.delta !== null && sku.delta <= -40)
    .map((sku) => ({ ...sku, reason: "DECLINED" as const }))
    .sort((left, right) => (left.delta ?? 0) - (right.delta ?? 0));

  const declinedIds = new Set(declined.map((sku) => sku.id));
  const moved = skus.filter((sku) => sku.qty > 0);
  // Ngưỡng "đáy" theo PHÂN VỊ chứ không theo một con số tuyệt đối: mỗi kho một
  // quy mô, "dưới 10 cái" ở kho này là bình thường còn kho kia là báo động.
  const cutoff = quantile(
    moved.map((sku) => sku.qty),
    0.25,
  );
  const low = moved
    .filter((sku) => !declinedIds.has(sku.id) && sku.qty <= cutoff)
    .map((sku) => ({ ...sku, reason: "LOW_VOLUME" as const }))
    .sort((left, right) => left.qty - right.qty);

  return [...stalled, ...declined, ...low].slice(0, 10);
}

function quantile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const at = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * fraction)),
  );
  return sorted[at];
}

// ── Nhận xét tự động ─────────────────────────────────────────────────────

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Sinh 3–6 nhận xét ĐÁNG CHÚ Ý NHẤT từ chính mô hình vừa dựng.
 *
 * Nguyên tắc: mỗi nhận xét phải có số làm căn cứ và nêu rõ kỳ; không có nhận
 * xét nào được sinh ra từ suy diễn. Cảnh báo dữ liệu luôn đứng đầu — nếu kỳ so
 * sánh không tương đương thì mọi nhận xét xếp hạng bên dưới phải được đọc kèm
 * cảnh báo đó, không phải đọc rồi mới thấy cảnh báo ở cuối.
 */
export function buildInsights(
  model: Omit<ComparisonModel, "insights">,
): ComparisonInsight[] {
  const { parties, skus, slowMovers } = model;
  const insights: ComparisonInsight[] = [];
  const activeParties = parties.filter((party) => party.qty !== 0);

  if (activeParties.length < COMPARISON_MIN_PARTIES) return insights;

  // 1 · Cảnh báo kỳ không tương đương.
  const late = activeParties.filter((party) => !party.comparable);
  if (late.length > 0) {
    /*
     * Ghi mốc của TỪNG đối tượng, không phải mốc của đối tượng đầu tiên.
     *
     * Bản đầu in "A, B chỉ có dữ liệu từ 09/2026" trong khi A bắt đầu 08 còn B
     * bắt đầu 09 — câu đó sai với A. Cặp "tên (mm/yyyy)" giữ được thông tin
     * riêng của từng bên mà vẫn không phải dựng câu chữ trong tầng tính toán.
     */
    const shown = late.slice(0, 3);
    const details = shown
      .map((party) => `${party.name} (${formatMonth(party.coverageMonth)})`)
      .join(", ");
    insights.push({
      id: "coverage-gap",
      kind: "data",
      messageKey: "reports.agencyComparison.insightCoverageGap",
      values: {
        details:
          late.length > shown.length
            ? `${details} +${late.length - shown.length}`
            : details,
        periodMonth: formatMonth(model.period.from.slice(0, 7)),
      },
      weight: 1000,
    });
  }

  // 2 · Đối tượng dẫn đầu.
  const leader = [...activeParties].sort(
    (left, right) => right.qty - left.qty,
  )[0];
  if (leader && leader.qty > 0) {
    insights.push({
      id: "leader",
      kind: "highlight",
      messageKey: "reports.agencyComparison.insightLeader",
      values: {
        name: leader.name,
        qty: leader.qty,
        share: round(leader.share),
      },
      weight: 500 + leader.share,
    });
  }

  // 3 · SKU nổi bật — chỉ nói khi thật sự cách biệt với SKU thứ hai.
  const movedSkus = skus.filter((sku) => sku.qty > 0);
  if (movedSkus.length >= 2 && movedSkus[1].qty > 0) {
    const gap =
      ((movedSkus[0].qty - movedSkus[1].qty) / movedSkus[1].qty) * 100;
    if (gap >= 15) {
      insights.push({
        id: "top-sku",
        kind: "highlight",
        messageKey: "reports.agencyComparison.insightTopSku",
        values: {
          sku: skuLabel(movedSkus[0]),
          qty: movedSkus[0].qty,
          gap: round(gap),
        },
        weight: 400 + Math.min(gap, 200),
      });
    }
  }

  // 4 · Tăng trưởng / suy giảm mạnh nhất so với kỳ trước.
  const withDelta = activeParties.filter(
    (party) => party.delta !== null && party.comparable,
  );
  const rising = [...withDelta].sort(
    (left, right) => (right.delta ?? 0) - (left.delta ?? 0),
  )[0];
  if (rising && (rising.delta ?? 0) >= 10) {
    insights.push({
      id: `growth-${rising.id}`,
      kind: "growth",
      messageKey: "reports.agencyComparison.insightGrowth",
      values: {
        name: rising.name,
        delta: round(rising.delta ?? 0),
        qty: rising.qty,
        prevQty: rising.prevQty,
      },
      weight: 300 + Math.min(rising.delta ?? 0, 300),
    });
  }
  const falling = [...withDelta].sort(
    (left, right) => (left.delta ?? 0) - (right.delta ?? 0),
  )[0];
  if (falling && (falling.delta ?? 0) <= -10 && falling.id !== rising?.id) {
    insights.push({
      id: `decline-${falling.id}`,
      kind: "decline",
      messageKey: "reports.agencyComparison.insightDecline",
      values: {
        name: falling.name,
        delta: round(Math.abs(falling.delta ?? 0)),
        qty: falling.qty,
        prevQty: falling.prevQty,
      },
      weight: 320 + Math.min(Math.abs(falling.delta ?? 0), 300),
    });
  }

  // 5 · Một SKU bật lên ở đúng một đối tượng (cơ cấu đang đổi, không phải nền chung lên).
  const surge = strongestCellChange(model);
  if (surge) {
    insights.push(surge);
  }

  // 6 · Tháng này so với tháng trước.
  const monthly = model.monthOverMonth;
  if (monthly && Math.abs(monthly.delta) >= 10) {
    insights.push({
      id: "month-over-month",
      kind: monthly.delta > 0 ? "growth" : "decline",
      messageKey: monthly.partial
        ? "reports.agencyComparison.insightMonthChangePartial"
        : "reports.agencyComparison.insightMonthChange",
      values: {
        current: monthly.currentLabel,
        previous: monthly.previousLabel,
        delta: round(Math.abs(monthly.delta)),
        direction: monthly.delta > 0 ? "▲" : "▼",
        qty: monthly.currentQty,
        day: monthly.throughDay,
        parties: monthly.partyCount,
      },
      weight: 280 + Math.min(Math.abs(monthly.delta), 200),
    });
  }

  // 7 · Hàng bán chậm.
  const stalled = slowMovers.find((sku) => sku.reason === "NO_MOVEMENT");
  if (stalled) {
    insights.push({
      id: `slow-${stalled.id}`,
      kind: "slow",
      messageKey: "reports.agencyComparison.insightStalled",
      values: { sku: skuLabel(stalled), prevQty: stalled.prevQty },
      weight: 260,
    });
  } else {
    const declining = slowMovers.find((sku) => sku.reason === "DECLINED");
    if (declining) {
      insights.push({
        id: `slow-${declining.id}`,
        kind: "slow",
        messageKey: "reports.agencyComparison.insightSlowing",
        values: {
          sku: skuLabel(declining),
          delta: round(Math.abs(declining.delta ?? 0)),
          qty: declining.qty,
        },
        weight: 240,
      });
    }
  }

  // 8 · Điểm bất thường trong chuỗi thời gian.
  const anomaly = strongestAnomaly(model);
  if (anomaly) insights.push(anomaly);

  return insights.sort((left, right) => right.weight - left.weight).slice(0, 6);
}

function skuLabel(sku: ComparisonSku): string {
  return sku.code && sku.name
    ? `${sku.code} · ${sku.name}`
    : sku.code || sku.name;
}

function formatMonth(value: string): string {
  if (!value || value.length < 7) return "";
  return `${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

/** Ô (đối tượng × SKU) đổi mạnh nhất so với kỳ trước — nơi cơ cấu thật sự dịch. */
function strongestCellChange(
  model: Omit<ComparisonModel, "insights">,
): ComparisonInsight | null {
  let best: {
    delta: number;
    qty: number;
    party: ComparisonParty;
    sku: ComparisonSku;
  } | null = null;

  for (const sku of model.skus) {
    model.parties.forEach((party, at) => {
      const current = sku.byParty[at] ?? 0;
      const prior = sku.prevByParty[at] ?? 0;
      // Ngưỡng sàn 10 đơn vị: 2 → 6 cái là +200% nhưng không đáng để chiếm một
      // dòng nhận xét của quản lý.
      if (prior < 10 || current <= 0) return;
      const change = percentChange(current, prior);
      if (change === null || change < 25) return;
      if (!best || change > best.delta) {
        best = { delta: change, qty: current, party, sku };
      }
    });
  }

  if (!best) return null;
  const found = best as {
    delta: number;
    qty: number;
    party: ComparisonParty;
    sku: ComparisonSku;
  };
  return {
    id: `cell-${found.party.id}-${found.sku.id}`,
    kind: "growth",
    messageKey: "reports.agencyComparison.insightSkuSurge",
    values: {
      sku: skuLabel(found.sku),
      name: found.party.name,
      delta: round(found.delta),
      qty: found.qty,
    },
    weight: 200 + Math.min(found.delta, 200),
  };
}

/** Mốc lệch khỏi mặt bằng của chính đối tượng đó quá 2,5 độ lệch chuẩn. */
function strongestAnomaly(
  model: Omit<ComparisonModel, "insights">,
): ComparisonInsight | null {
  let best: {
    score: number;
    party: ComparisonParty;
    at: number;
    value: number;
  } | null = null;

  for (const party of model.parties) {
    const series = party.trend;
    if (series.length < 4) continue;
    const mean = series.reduce((sum, value) => sum + value, 0) / series.length;
    const variance =
      series.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      series.length;
    const deviation = Math.sqrt(variance);
    if (deviation <= 0 || mean <= 0) continue;
    series.forEach((value, at) => {
      if (!model.buckets[at]?.complete) return;
      const score = (value - mean) / deviation;
      if (score < 2.5) return;
      if (!best || score > best.score) {
        best = { score, party, at, value };
      }
    });
  }

  if (!best) return null;
  const found = best as {
    score: number;
    party: ComparisonParty;
    at: number;
    value: number;
  };
  return {
    id: `anomaly-${found.party.id}-${found.at}`,
    kind: "anomaly",
    messageKey: "reports.agencyComparison.insightAnomaly",
    values: {
      name: found.party.name,
      label: model.buckets[found.at].label,
      qty: found.value,
    },
    weight: 150 + found.score * 10,
  };
}
