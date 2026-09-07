/**
 * DÒ "DỮ LIỆU THẬT NẰM Ở ĐÂU" cho gợi ý bộ lọc kỳ (`report-range-advice.ts`).
 *
 * Câu hỏi cần trả lời khi màn báo cáo trống: kho có dữ liệu không, và nếu có
 * thì ở khoảng nào? Không endpoint nào trả thẳng câu đó, nên ở đây gọi LẠI
 * chính endpoint của màn với một cửa sổ rộng rồi rút ra tập ngày có phát sinh.
 *
 * BA RÀNG BUỘC ĐÃ CÂN NHẮC:
 *
 *  · Mỗi màn dò bằng ENDPOINT CỦA CHÍNH NÓ. Dùng chung một nguồn (vd sổ
 *    movement) sẽ rẻ hơn nhưng nói sai: hồ sơ bảo hành và nhật ký in nhãn không
 *    sinh movement, báo "dữ liệu tập trung 06→08" cho màn bảo hành dựa trên
 *    movement là bịa.
 *  · Cửa sổ dò ≤ 366 ngày — đúng trần khoảng ngày mà BE nhận. Vì vậy câu chữ
 *    của banner luôn nói rõ "trong 12 tháng gần đây", không tuyên bố về dữ liệu
 *    cũ hơn thế.
 *  · Chỉ chạy khi `enabled` (xem `shouldProbeCoverage`), tức đúng lúc kỳ đang
 *    trống hoặc lác đác. Người dùng bình thường không phải trả thêm request nào.
 */
import { useMemo } from "react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { CACHE_POLICIES } from "@/shared/cache/cache-policy";
import { http } from "@/shared/api/http";
import { fetchAllPages } from "@/shared/api/paginate-all";
import { useT } from "@/shared/i18n/useT";
import { API_DATE, type Raw } from "./report-format";
import {
  buildRangeAdvice,
  shouldProbeCoverage,
  type RangeAdvice,
  type RangeCoverage,
} from "./report-range-advice";

/** Bề rộng cửa sổ dò, tính cả ngày hôm nay. 365 ≤ trần 366 ngày của BE. */
export const COVERAGE_WINDOW_DAYS = 365;

/** Con số đưa vào câu chữ ("trong 12 tháng gần đây"). */
export const COVERAGE_LOOKBACK_MONTHS = 12;

/**
 * Cửa sổ dò, tính TẠI THỜI ĐIỂM GỌI (cùng lý do với `presetRange`: một tab mở
 * qua nửa đêm không được giữ cửa sổ của hôm qua).
 */
export function coverageWindow(now = dayjs()): { from: string; to: string } {
  const today = now.startOf("day");
  return {
    from: today.subtract(COVERAGE_WINDOW_DAYS - 1, "day").format(API_DATE),
    to: today.format(API_DATE),
  };
}

/** Coverage "chưa biết gì" — dùng khi không dò, để nơi gọi không phải if/else. */
export const UNKNOWN_COVERAGE: RangeCoverage = {
  days: [],
  ready: false,
  lookbackMonths: COVERAGE_LOOKBACK_MONTHS,
};

export type CoverageProbe = {
  /** Định danh ổn định của màn — tách cache giữa các báo cáo. */
  key: string;
  /** Endpoint dò; nhận `from_date` / `to_date` như mọi báo cáo khác. */
  endpoint: string;
  /** Tham số cố định kèm theo (vd `status: "POSTED"`). */
  params?: Raw;
  /**
   * Rút tập ngày có dữ liệu ra khỏi payload. Trả về chuỗi bất kỳ có 10 ký tự
   * đầu là `YYYY-MM-DD`; giá trị rỗng/không hợp lệ được lọc ở đây.
   *
   * Với probe có `paginate`, payload là MẢNG các trang.
   */
  extractDays: (payload: unknown) => readonly string[];
  /**
   * Endpoint cắt trang ở tầng SQL (không có kiểu "bỏ per_page để lấy trọn tập")
   * thì phải cuốn hết trang — lấy một trang rồi kết luận "dữ liệu nằm ở 06→08"
   * là kết luận trên một mẫu, tức là bịa.
   */
  paginate?: { perPage: number; maxPages: number };
};

/**
 * Chạy phép dò và trả về `RangeCoverage` để đưa thẳng vào `buildRangeAdvice`.
 *
 * `ready` chỉ bật khi query đã có dữ liệu THẬT — đang tải hoặc lỗi đều giữ
 * `ready: false` để banner im lặng thay vì kết luận "kho không có gì".
 */
export function useReportCoverage(
  probe: CoverageProbe,
  enabled: boolean,
): RangeCoverage {
  // Tên riêng thay vì `window` để không che biến toàn cục cùng tên.
  const probeWindow = useMemo(() => coverageWindow(), []);
  const paramsKey = JSON.stringify(probe.params ?? {});

  const query = useQuery({
    queryKey: [
      "rpt-coverage",
      probe.key,
      probeWindow.from,
      probeWindow.to,
      paramsKey,
    ] as const,
    queryFn: () => {
      const baseParams = {
        ...(probe.params ?? {}),
        from_date: probeWindow.from,
        to_date: probeWindow.to,
      };
      const paginate = probe.paginate;
      if (!paginate) {
        return http.get<unknown>(probe.endpoint, { params: baseParams });
      }
      return fetchAllPages<Raw>(
        (page) =>
          http.get<Raw>(probe.endpoint, {
            params: { ...baseParams, page, per_page: paginate.perPage },
          }),
        (payload) =>
          Number((payload.pagination as Raw | undefined)?.last_page ?? 1) || 1,
        paginate.maxPages,
      ) as Promise<unknown>;
    },
    enabled,
    staleTime: CACHE_POLICIES.report.staleTime,
    gcTime: CACHE_POLICIES.report.gcTime,
    // Dò là việc phụ: hỏng thì banner im, không thử lại để khỏi kéo theo ba
    // request nữa trên một màn vốn đã không có dữ liệu để hiển thị.
    retry: false,
  });

  const { data, isSuccess } = query;
  const extractDays = probe.extractDays;

  return useMemo<RangeCoverage>(() => {
    if (!isSuccess || data === undefined) return UNKNOWN_COVERAGE;
    const seen = new Set<string>();
    for (const value of extractDays(data)) {
      const day = String(value ?? "").slice(0, 10);
      if (
        day.length === 10 &&
        day >= probeWindow.from &&
        day <= probeWindow.to
      ) {
        seen.add(day);
      }
    }
    return {
      days: [...seen].sort(),
      ready: true,
      lookbackMonths: COVERAGE_LOOKBACK_MONTHS,
    };
    // `extractDays` đến từ literal tại nơi gọi nên đổi tham chiếu mỗi render;
    // gói trong useMemo ở nơi gọi là thừa vì kết quả chỉ phụ thuộc `data`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isSuccess, probeWindow.from, probeWindow.to]);
}

export type ReportRangeAdviceArgs = {
  /** Kỳ đang chọn (ISO `YYYY-MM-DD`). */
  from: string;
  to: string;
  /** Ngày có dữ liệu mà màn đang cầm — thô cũng được, hàm tự chuẩn hoá. */
  dataDays: readonly string[];
  /** Đang tải kỳ hiện tại: chưa biết có dữ liệu hay không nên chưa khuyên gì. */
  loading: boolean;
  probe: CoverageProbe;
  /**
   * Đường tắt cho màn mà endpoint KHÔNG lọc theo ngày (màn tự cắt kỳ ở client):
   * ở đó tập ngày ngoài kỳ đã nằm sẵn trong tay, dò thêm một vòng mạng là thừa.
   * Truyền vào thì `probe` không chạy. Vẫn bị cắt về cửa sổ 12 tháng để câu chữ
   * "trong {months} tháng gần đây" không nói quá phạm vi.
   */
  knownCoverageDays?: readonly string[] | null;
};

/**
 * MỘT lời gọi cho cả màn: quyết định có dò không, dò, rồi dựng lời khuyên.
 *
 * Màn báo cáo chỉ cần đưa vào kỳ đang chọn + tập ngày có dữ liệu, và đưa kết
 * quả cho `<ReportRangeAdviceBanner>`.
 */
export function useReportRangeAdvice({
  from,
  to,
  dataDays,
  loading,
  probe,
  knownCoverageDays = null,
}: ReportRangeAdviceArgs): RangeAdvice | null {
  const t = useT();
  const probeWindow = useMemo(() => coverageWindow(), []);
  const needed = shouldProbeCoverage({ from, to, dataDays, loading });
  const probing = needed && knownCoverageDays === null;
  const probed = useReportCoverage(probe, probing);

  const known = useMemo<RangeCoverage | null>(() => {
    if (knownCoverageDays === null) return null;
    const seen = new Set<string>();
    for (const value of knownCoverageDays) {
      const day = String(value ?? "").slice(0, 10);
      if (
        day.length === 10 &&
        day >= probeWindow.from &&
        day <= probeWindow.to
      ) {
        seen.add(day);
      }
    }
    return {
      days: [...seen].sort(),
      ready: true,
      lookbackMonths: COVERAGE_LOOKBACK_MONTHS,
    };
  }, [knownCoverageDays, probeWindow.from, probeWindow.to]);

  return useMemo(
    () =>
      loading
        ? null
        : buildRangeAdvice({
            from,
            to,
            dataDays,
            // Không cần biết dữ liệu ngoài kỳ thì đừng đưa coverage vào —
            // `buildRangeAdvice` sẽ bỏ qua mọi kết luận dựa trên nó.
            coverage: needed ? (known ?? probed) : null,
            t,
          }),
    [from, to, dataDays, loading, needed, known, probed, t],
  );
}

/**
 * Gom `rows[]` của payload báo cáo rồi lấy một trường ngày. Dùng cho
 * `extractDays`.
 *
 * Chấp nhận cả payload đơn lẻ lẫn MẢNG trang (probe có `paginate`), và nhận
 * nhiều tên trường theo thứ tự ưu tiên — bản ghi cũ chưa backfill `requested_at`
 * thì còn `printed_at`/`created_at`, bỏ qua chúng là báo nhầm "không có dữ liệu".
 */
export function daysFromRows(
  payload: unknown,
  fields: string | readonly string[],
  listKey = "rows",
): string[] {
  const pages = Array.isArray(payload) ? payload : [payload];
  const names = typeof fields === "string" ? [fields] : fields;
  const out: string[] = [];
  for (const page of pages) {
    const list = (page as Record<string, unknown> | null)?.[listKey];
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const record = row as Record<string, unknown> | null;
      for (const name of names) {
        const value = record?.[name];
        if (typeof value === "string" && value !== "") {
          out.push(value);
          break;
        }
      }
    }
  }
  return out;
}
