/**
 * RUM — đo Core Web Vitals TRÊN MÁY NGƯỜI DÙNG THẬT rồi bắn về BE.
 *
 * LAB ≠ RUM. `scripts/perf/bench` và `scripts/perf/measure-reload.mjs` là phòng
 * thí nghiệm: một máy, một cấu hình, CPU bị bóp theo hệ số cố định — chúng trả
 * lời "thay đổi này có tác dụng không". File này trả lời một câu KHÁC: "người
 * dùng trong kho đang thực sự thấy gì" — máy văn phòng cũ, wifi kho, nhiều tab.
 * Hai nguồn số không được trộn vào nhau trong bất kỳ báo cáo nào.
 *
 * VÌ SAO KHÔNG DÙNG THƯ VIỆN `web-vitals`
 * Ba chỉ số cần đo đều đọc được từ `PerformanceObserver` có sẵn của trình duyệt;
 * phần khó là ĐỊNH NGHĨA (cửa sổ phiên của CLS, cách chọn mẫu của INP) chứ không
 * phải phần API. Tự viết ~150 dòng rẻ hơn một dependency runtime nữa cho một dự
 * án vừa cắt 174 KB antd và 137 KB CSS icon, và tránh phải khai thêm ngoại lệ ở
 * `scripts/check-ui-dependencies.mjs`.
 *
 * CHI PHÍ TRÊN LUỒNG CHÍNH
 * · 3 observer thụ động, callback chỉ cộng dồn vài số — không đọc DOM, không đo
 *   bố cục, không tạo object trong vòng lặp cuộn;
 * · gửi ĐÚNG MỘT LẦN cho mỗi lần trang bị ẩn, bằng `navigator.sendBeacon` (trình
 *   duyệt tự gửi nền, không chặn unload, không giữ tab sống);
 * · lấy mẫu theo phiên: mặc định 10% người dùng, quyết định MỘT lần lúc khởi
 *   động — phần còn lại không cài observer nào.
 *
 * TẮT KHI KHÔNG CẤU HÌNH: thiếu `VITE_API_BASE_URL` hoặc tỉ lệ mẫu = 0 thì
 * `initWebVitals()` không làm gì cả.
 */

/** Ba chỉ số Core Web Vitals — BE chỉ nhận đúng ba tên này. */
type MetricName = "LCP" | "INP" | "CLS";

type LayoutShift = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
};

/**
 * Ngưỡng cửa sổ phiên của CLS (định nghĩa của Google): một cú dịch được gộp vào
 * cửa sổ đang mở nếu cách cú trước < 1s VÀ cửa sổ chưa dài quá 5s. CLS cuối cùng
 * là cửa sổ có TỔNG lớn nhất — KHÔNG phải tổng của cả trang. Cộng tất cả lại sẽ
 * phạt oan những phiên mở lâu, đúng kiểu 9 màn báo cáo giữ sống của app này.
 */
const CLS_WINDOW_GAP_MS = 1000;
const CLS_WINDOW_MAX_MS = 5000;

/**
 * INP lấy tương tác chậm thứ (n/50) thay vì tương tác chậm NHẤT: một phiên dài
 * hàng nghìn tương tác thì cú chậm nhất là ngoại lệ, không mô tả trải nghiệm.
 * Dưới 50 tương tác thì lấy đúng cú chậm nhất.
 */
const INP_INTERACTIONS_PER_OUTLIER = 50;

/** Chỉ giữ ngần này tương tác chậm nhất — đủ cho công thức trên, không phình bộ nhớ. */
const INP_KEEP_SLOWEST = 10;

/** Sự kiện dưới ngưỡng này không được ghi nhận (mặc định của Event Timing API). */
const INP_DURATION_THRESHOLD_MS = 40;

type State = {
  lcp: number;
  clsWindows: { value: number; first: number; last: number }[];
  slowestInteractions: number[];
  interactionCount: number;
  sent: boolean;
};

function createState(): State {
  return {
    lcp: 0,
    clsWindows: [],
    slowestInteractions: [],
    interactionCount: 0,
    sent: false,
  };
}

/** CLS = cửa sổ phiên có tổng lớn nhất. */
export function clsFrom(windows: { value: number }[]): number {
  let max = 0;
  for (const window of windows) if (window.value > max) max = window.value;
  return Math.round(max * 10000) / 10000;
}

/** INP = tương tác chậm thứ (số tương tác / 50), đếm từ chậm nhất. */
export function inpFrom(slowest: number[], interactionCount: number): number {
  if (slowest.length === 0) return 0;
  const sorted = [...slowest].sort((a, b) => b - a);
  const index = Math.min(
    sorted.length - 1,
    Math.floor(interactionCount / INP_INTERACTIONS_PER_OUTLIER),
  );
  return Math.round(sorted[index]);
}

/**
 * Đưa đường dẫn thật về MẪU route: bỏ mọi đoạn định danh động.
 *
 * Bắt buộc, vì hai lý do độc lập nhau: (1) id hàng hoá/người dùng không được rời
 * khỏi máy người dùng qua đường telemetry; (2) khoá thống kê phải gộp được —
 * `/pv/<uuid>` mỗi lượt một khoá thì không đếm được gì. BE cũng từ chối các
 * đoạn như vậy (TelemetryController), đây là lớp chặn phía trong.
 */
export function routePatternOf(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const normalized = segments.map((segment) => {
    const isIdLike =
      /^[0-9a-f-]{8,}$/i.test(segment) || /^\d{4,}$/.test(segment);
    return isIdLike ? ":id" : segment;
  });
  // BE chỉ nhận [a-z0-9/_-]; ":id" bị loại — cắt route TẠI đoạn động đầu tiên,
  // vì phần sau nó không còn ý nghĩa thống kê.
  const cut = normalized.indexOf(":id");
  const kept = cut === -1 ? normalized : normalized.slice(0, cut);
  return `/${kept.join("/")}`;
}

/** Tỉ lệ lấy mẫu, kẹp về [0,1]; giá trị sai cú pháp coi như tắt. */
function sampleRate(): number {
  const raw = import.meta.env.VITE_RUM_SAMPLE_RATE;
  if (raw === undefined || raw === "") return 0.1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(1, Math.max(0, parsed));
}

function observe(
  type: string,
  callback: (entries: PerformanceEntryList) => void,
  options: Record<string, unknown> = {},
): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) =>
      callback(list.getEntries()),
    );
    observer.observe({ type, buffered: true, ...options });
    return observer;
  } catch {
    // Trình duyệt không hỗ trợ loại entry này (Safari chưa có `event`/`longtask`).
    // Thiếu một chỉ số không được làm hỏng hai chỉ số còn lại, càng không được
    // làm hỏng app.
    return null;
  }
}

/**
 * Bắt đầu thu Web Vitals. Gọi MỘT lần lúc khởi động app.
 *
 * @returns hàm dừng thu (dùng trong test; app thật không cần gọi).
 */
export function initWebVitals(): () => void {
  const noop = () => {};
  if (
    typeof window === "undefined" ||
    typeof PerformanceObserver === "undefined"
  ) {
    return noop;
  }

  const rate = sampleRate();
  // Quyết định MỘT lần cho cả phiên: người không nằm trong mẫu không phải trả
  // bất kỳ chi phí nào, kể cả chi phí cài observer.
  if (rate <= 0 || Math.random() >= rate) return noop;

  const endpoint = `${import.meta.env.VITE_API_BASE_URL ?? ""}/telemetry/vitals`;
  if (!import.meta.env.VITE_API_BASE_URL) return noop;

  const state = createState();
  const observers: (PerformanceObserver | null)[] = [];

  observers.push(
    observe("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1];
      if (last) state.lcp = last.startTime;
    }),
  );

  observers.push(
    observe("layout-shift", (entries) => {
      for (const entry of entries as LayoutShift[]) {
        // Dịch chuyển NGAY SAU thao tác của người dùng là hệ quả có chủ đích
        // (mở accordion, đổi tab) — định nghĩa CLS loại chúng ra.
        if (entry.hadRecentInput) continue;
        const current = state.clsWindows[state.clsWindows.length - 1];
        if (
          current &&
          entry.startTime - current.last < CLS_WINDOW_GAP_MS &&
          entry.startTime - current.first < CLS_WINDOW_MAX_MS
        ) {
          current.value += entry.value;
          current.last = entry.startTime;
        } else {
          state.clsWindows.push({
            value: entry.value,
            first: entry.startTime,
            last: entry.startTime,
          });
        }
      }
    }),
  );

  observers.push(
    observe(
      "event",
      (entries) => {
        for (const entry of entries) {
          state.interactionCount += 1;
          state.slowestInteractions.push(entry.duration);
          if (state.slowestInteractions.length > INP_KEEP_SLOWEST * 3) {
            state.slowestInteractions = state.slowestInteractions
              .sort((a, b) => b - a)
              .slice(0, INP_KEEP_SLOWEST);
          }
        }
      },
      { durationThreshold: INP_DURATION_THRESHOLD_MS },
    ),
  );

  const send = () => {
    if (state.sent) return;
    const metrics: Partial<Record<MetricName, number>> = {};
    if (state.lcp > 0) metrics.LCP = Math.round(state.lcp);
    const inp = inpFrom(state.slowestInteractions, state.interactionCount);
    if (inp > 0) metrics.INP = inp;
    const cls = clsFrom(state.clsWindows);
    if (cls > 0) metrics.CLS = cls;
    if (Object.keys(metrics).length === 0) return;

    state.sent = true;
    const body = JSON.stringify({
      build_id: __APP_BUILD_ID__,
      route: routePatternOf(window.location.pathname),
      metrics,
    });
    try {
      // sendBeacon: trình duyệt gửi ở nền kể cả khi tab đã đóng, và KHÔNG giữ
      // luồng chính lại. `fetch(keepalive)` cũng được nhưng vẫn đi qua vòng đời
      // của trang; ở đây không cần đọc phản hồi nên beacon là đúng công cụ.
      navigator.sendBeacon?.(
        endpoint,
        new Blob([body], { type: "application/json" }),
      );
    } catch {
      // Mất một mẫu telemetry không đáng để làm hỏng lúc đóng tab.
    }
  };

  // `visibilitychange -> hidden` là mốc DUY NHẤT đáng tin trên mobile: `unload`
  // và `beforeunload` không bắn khi hệ điều hành thu hồi tab nền.
  const onHidden = () => {
    if (document.visibilityState === "hidden") send();
  };
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", send);

  return () => {
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", send);
    for (const observer of observers) observer?.disconnect();
  };
}
