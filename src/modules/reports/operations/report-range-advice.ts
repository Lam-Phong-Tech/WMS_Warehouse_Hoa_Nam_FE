/**
 * GỢI Ý BỘ LỌC KỲ của các màn báo cáo.
 *
 * Vấn đề thật: kho chỉ có dữ liệu từ 06 đến 08/2026, nhưng mọi màn báo cáo mở
 * sẵn kỳ "đến nay". Sang mùng 1 tháng 9, người dùng bấm "Tháng này" và nhận về
 * một màn TRỐNG TRƠN — không có gì phân biệt "kho chưa phát sinh trong kỳ này"
 * với "báo cáo hỏng". Người dùng phải tự đoán rồi mò lùi từng tháng.
 *
 * Lớp này đọc chính những ngày CÓ dữ liệu để nói thẳng ra điều đó, kèm một
 * khoảng đề xuất bấm được. Ba nguyên tắc:
 *
 *  1. KHÔNG BỊA. Chỉ kết luận "dữ liệu nằm ở 06→08" khi thật sự đã dò và biết;
 *     chưa dò xong (`coverage.ready === false`) thì im lặng, không đoán.
 *  2. Chỉ nói khi có ích. Kỳ ngắn mà thưa dữ liệu là chuyện bình thường của
 *     kho — các ngưỡng dưới đây cố ý cao để banner không thành tiếng ồn.
 *  3. Mọi câu chữ đi qua `t()`; hàm này KHÔNG tự nối chuỗi tiếng Việt.
 *
 * Hàm thuần, không hook, không mạng — test khoá ở `report-range-advice.test.ts`.
 */
import dayjs from "dayjs";
import type { TranslateFn } from "@/shared/i18n/useT";
import { formatDate } from "@/shared/utils/format-date";
import { API_DATE } from "./report-format";

/** Kỳ ngắn hơn ngần này thì không gợi ý thu hẹp — vài ngày trống là bình thường. */
export const MIN_RANGE_DAYS_FOR_NARROW = 14;

/** Dữ liệu phải dồn vào ≤ nửa bề rộng kỳ mới đáng gọi là "dồn cục". */
export const NARROW_COVER_RATIO = 0.5;

/** Phần trống phải từ 7 ngày trở lên — dưới mức đó thu hẹp chẳng đổi được gì. */
export const MIN_EMPTY_DAYS = 7;

/**
 * Ngưỡng của câu "nên xem theo tuần": dữ liệu gói trong một tuần mà kỳ đang
 * chọn rộng cỡ một tháng. Đây chính là ca người dùng mô tả — dữ liệu chưa đầy
 * một tháng nhưng đang xem theo tháng.
 */
export const WEEKLY_HINT_MAX_SPAN = 8;
export const WEEKLY_HINT_MIN_RANGE = 28;

/**
 * Trần vẽ chart theo ngày (`dateSpan` trong report-format.ts cắt ở đây). Kỳ dài
 * hơn thì biểu đồ theo ngày mất phần đuôi mà không có gì báo.
 */
export const MAX_DAILY_CHART_DAYS = 366;

/** Kỳ có ≤ ngần này ngày-có-dữ-liệu thì đáng dò xem dữ liệu thật nằm ở đâu. */
export const SPARSE_DATA_DAYS = 3;

/** Dữ liệu ngoài kỳ phải gấp ngần này lần trong kỳ mới đáng khuyên đổi kỳ. */
export const OUTSIDE_DOMINANCE = 3;

export type RangeAdviceKind =
  /** Kỳ trống, nhưng cửa sổ dò thấy dữ liệu ở khoảng khác. */
  | "empty-with-coverage"
  /** Kỳ trống và cả cửa sổ dò cũng trống — không phải lỗi bộ lọc. */
  | "empty-no-coverage"
  /** Kỳ có vài ngày lác đác, phần lớn dữ liệu nằm ngoài kỳ. */
  | "sparse-outside"
  /** Dữ liệu dồn vào một đoạn ngắn bên trong kỳ. */
  | "narrow-to-data"
  /** Kỳ dài quá trần vẽ theo ngày. */
  | "range-too-long";

export type SuggestedRange = { from: string; to: string };

export type RangeAdvice = {
  kind: RangeAdviceKind;
  tone: "info" | "warning";
  title: string;
  message: string;
  /** null = chỉ thông báo, không có gì để bấm. */
  suggested: SuggestedRange | null;
  actionLabel: string | null;
};

/** Kết quả dò "dữ liệu thật nằm ở đâu" (xem `report-coverage.ts`). */
export type RangeCoverage = {
  /** Ngày có dữ liệu trong cửa sổ dò, ISO `YYYY-MM-DD`, đã sắp tăng dần. */
  days: string[];
  /** false = chưa dò xong / không dò; lúc này TUYỆT ĐỐI không kết luận gì. */
  ready: boolean;
  /** Cửa sổ đã dò, để câu chữ nói đúng "trong N tháng gần đây". */
  lookbackMonths: number;
};

export type RangeAdviceInput = {
  /** Kỳ đang chọn, ISO `YYYY-MM-DD`. */
  from: string;
  to: string;
  /**
   * Ngày CÓ dữ liệu mà màn đang cầm. Không cần sắp xếp, không cần khử trùng,
   * không cần cắt theo kỳ — hàm tự lo; chuỗi rỗng/không hợp lệ bị bỏ qua.
   */
  dataDays: readonly string[];
  coverage?: RangeCoverage | null;
  t: TranslateFn;
};

/** Chuẩn hoá về danh sách ngày ISO duy nhất, tăng dần, nằm trong [from, to]. */
function daysWithin(
  values: readonly string[],
  from: string,
  to: string,
): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const day = String(value ?? "").slice(0, 10);
    // So sánh chuỗi là đủ và rẻ: ISO `YYYY-MM-DD` cùng độ dài, đã đệm số 0.
    if (day.length !== 10 || day < from || day > to) continue;
    seen.add(day);
  }
  return [...seen].sort();
}

function spanDays(from: string, to: string): number {
  const start = dayjs(from);
  const end = dayjs(to);
  if (!start.isValid() || !end.isValid()) return 0;
  return end.startOf("day").diff(start.startOf("day"), "day") + 1;
}

/** `01-06-2026 → 31-08-2026` — một khoảng ngày đọc được, đúng chuẩn hiển thị. */
export function formatRangeLabel(range: SuggestedRange): string {
  return `${formatDate(range.from)} → ${formatDate(range.to)}`;
}

/**
 * Gợi ý cho kỳ đang chọn, hoặc `null` khi không có gì đáng nói.
 *
 * Thứ tự xét quan trọng: ca "trống" nói trước (người dùng đang bí thật), rồi
 * mới tới các ca "có dữ liệu nhưng chọn chưa khéo".
 */
export function buildRangeAdvice(input: RangeAdviceInput): RangeAdvice | null {
  const { from, to, t } = input;
  if (from === "" || to === "" || from > to) return null;

  const rangeDays = spanDays(from, to);
  if (rangeDays <= 0) return null;

  const inRange = daysWithin(input.dataDays, from, to);
  const coverage = input.coverage?.ready === true ? input.coverage : null;
  const coverageDays = coverage ? [...new Set(coverage.days)].sort() : [];
  const lookback = coverage?.lookbackMonths ?? 0;

  const rangeLabel = formatRangeLabel({ from, to });

  // ── Kỳ hoàn toàn không có dữ liệu ──────────────────────────────────────
  if (inRange.length === 0) {
    // Chưa dò xong thì không nói gì: khối "không có dữ liệu" sẵn có của mỗi màn
    // vẫn hiện, còn banner này chỉ xuất hiện khi ĐÃ biết dữ liệu nằm ở đâu.
    if (!coverage) return null;

    if (coverageDays.length === 0) {
      return {
        kind: "empty-no-coverage",
        tone: "info",
        title: t("reports.rangeAdvice.emptyNoCoverageTitle"),
        message: t("reports.rangeAdvice.emptyNoCoverageBody", {
          range: rangeLabel,
          months: lookback,
        }),
        suggested: null,
        actionLabel: null,
      };
    }

    const suggested = {
      from: coverageDays[0],
      to: coverageDays[coverageDays.length - 1],
    };
    return {
      kind: "empty-with-coverage",
      tone: "warning",
      title: t("reports.rangeAdvice.emptyWithCoverageTitle"),
      message: t("reports.rangeAdvice.emptyWithCoverageBody", {
        range: rangeLabel,
        months: lookback,
        dataRange: formatRangeLabel(suggested),
        days: coverageDays.length,
      }),
      suggested,
      actionLabel: t("reports.rangeAdvice.applySuggested"),
    };
  }

  // ── Kỳ lác đác vài ngày, dữ liệu thật nằm chỗ khác ─────────────────────
  const outsideCount = coverageDays.filter(
    (day) => day < from || day > to,
  ).length;
  if (
    coverage &&
    inRange.length <= SPARSE_DATA_DAYS &&
    outsideCount >= inRange.length * OUTSIDE_DOMINANCE &&
    outsideCount > 0
  ) {
    const suggested = {
      from: coverageDays[0],
      to: coverageDays[coverageDays.length - 1],
    };
    return {
      kind: "sparse-outside",
      tone: "info",
      title: t("reports.rangeAdvice.sparseOutsideTitle"),
      message: t("reports.rangeAdvice.sparseOutsideBody", {
        inRangeDays: inRange.length,
        months: lookback,
        dataRange: formatRangeLabel(suggested),
        days: coverageDays.length,
      }),
      suggested,
      actionLabel: t("reports.rangeAdvice.applySuggested"),
    };
  }

  // ── Dữ liệu dồn cục trong kỳ ───────────────────────────────────────────
  const first = inRange[0];
  const last = inRange[inRange.length - 1];
  const dataSpan = spanDays(first, last);
  const emptyDays = rangeDays - dataSpan;
  if (
    rangeDays >= MIN_RANGE_DAYS_FOR_NARROW &&
    emptyDays >= MIN_EMPTY_DAYS &&
    dataSpan <= rangeDays * NARROW_COVER_RATIO
  ) {
    const suggested = { from: first, to: last };
    // Dữ liệu gói trong một tuần mà đang xem cả tháng: nói thẳng "xem theo
    // tuần" — đó là cách người dùng nghĩ, không phải "thu hẹp 23 ngày".
    const weekly =
      dataSpan <= WEEKLY_HINT_MAX_SPAN && rangeDays >= WEEKLY_HINT_MIN_RANGE;
    return {
      kind: "narrow-to-data",
      tone: "info",
      title: weekly
        ? t("reports.rangeAdvice.weeklyTitle")
        : t("reports.rangeAdvice.narrowTitle"),
      message: weekly
        ? t("reports.rangeAdvice.weeklyBody", {
            rangeDays,
            dataSpan,
            dataRange: formatRangeLabel(suggested),
          })
        : t("reports.rangeAdvice.narrowBody", {
            rangeDays,
            dataSpan,
            emptyDays,
            dataRange: formatRangeLabel(suggested),
          }),
      suggested,
      actionLabel: t("reports.rangeAdvice.applySuggested"),
    };
  }

  // ── Kỳ dài hơn trần vẽ theo ngày ───────────────────────────────────────
  if (rangeDays > MAX_DAILY_CHART_DAYS) {
    const suggested = {
      from: dayjs(to)
        .subtract(MAX_DAILY_CHART_DAYS - 1, "day")
        .format(API_DATE),
      to,
    };
    return {
      kind: "range-too-long",
      tone: "warning",
      title: t("reports.rangeAdvice.tooLongTitle"),
      message: t("reports.rangeAdvice.tooLongBody", {
        rangeDays,
        max: MAX_DAILY_CHART_DAYS,
      }),
      suggested,
      actionLabel: t("reports.rangeAdvice.applySuggested"),
    };
  }

  return null;
}

/**
 * Có nên dò "dữ liệu thật nằm ở đâu" không?
 *
 * Dò tốn một request phủ 12 tháng nên chỉ bật đúng lúc người dùng cần: kỳ trống
 * hẳn, hoặc kỳ dài mà chỉ lác đác vài ngày có dữ liệu. Kỳ ngắn (2-3 ngày) mà ít
 * dữ liệu là chuyện bình thường — không dò.
 */
export function shouldProbeCoverage({
  from,
  to,
  dataDays,
  loading,
}: {
  from: string;
  to: string;
  dataDays: readonly string[];
  loading: boolean;
}): boolean {
  if (loading || from === "" || to === "" || from > to) return false;
  const inRange = daysWithin(dataDays, from, to);
  if (inRange.length === 0) return true;
  return (
    spanDays(from, to) >= MIN_RANGE_DAYS_FOR_NARROW &&
    inRange.length <= SPARSE_DATA_DAYS
  );
}
