import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";

/**
 * Lối vào DUY NHẤT tới `react-apexcharts` cho 8 chart wrapper dùng chung.
 *
 * Hai việc nó làm, cả hai đều đo được là đáng:
 *
 * 1. NẠP THƯ VIỆN LƯỜI. `react-apexcharts` + `apexcharts` là chunk lớn nhất của
 *    cả app (888 KB, ~254 KB gzip). Import tĩnh trong wrapper nghĩa là màn đầu
 *    tiên có chart (dashboard, mọi màn báo cáo) phải tải + parse nó trước khi vẽ
 *    được BẤT CỨ THỨ GÌ, kể cả phần bảng không liên quan. `lazy()` ở đây tách
 *    nó khỏi đường tải của route: bảng/KPI lên trước, chart theo sau.
 *
 * 2. CHỈ VẼ KHI SẮP NHÌN THẤY. ApexCharts vẽ SVG và đo chữ bằng `getBBox()` cho
 *    từng nhãn — trace một màn báo cáo cho thấy 60% thời gian luồng chính là
 *    style/layout/paint, chart là phần lớn của số đó. Chart nằm dưới màn hình mà
 *    vẫn vẽ ngay là trả tiền cho thứ chưa ai nhìn. IntersectionObserver với
 *    `rootMargin` 200px: chart bắt đầu vẽ khi người dùng cuộn tới cách nó 200px,
 *    đủ sớm để không thấy trống.
 *
 * Ô giữ chỗ có ĐÚNG chiều cao của chart để bố cục không nhảy khi chart vào.
 *
 * Tắt animation vào: mỗi khung animation là một lượt layout SVG nữa, và trên máy
 * chậm nó là thứ làm chart "giật" lúc vào màn. Đây là hiệu ứng trang trí, không
 * phải dữ liệu.
 */
const ApexChart = lazy(() => import("react-apexcharts"));

type ApexChartProps = ComponentProps<typeof ApexChart>;

const NO_ANIMATION = { enabled: false } as const;

export function LazyApexChart(props: ApexChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  /**
   * Bề rộng THẬT của ô chứa, đo bằng ResizeObserver — UAT 09/09: ApexCharts 7
   * với width "100%" chỉ lấy kích thước MỘT LẦN lúc mount; đo thực nghiệm
   * (1500px → 1100px và ngược lại) svg giữ nguyên width cũ, nên mở trang ở
   * cửa sổ to rồi bo nhỏ là cột biểu đồ tràn ra ngoài card, đè cả card đứng
   * cạnh (ảnh RPT-04). Truyền width BẰNG SỐ và cập nhật theo observer thì
   * react-apexcharts mới thật sự vẽ lại đúng cỡ ở cả hai chiều co/giãn.
   */
  const [hostWidth, setHostWidth] = useState(0);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0);
      // 0 = đang ẩn (keep-alive display:none) — giữ số đo cũ, tránh vẽ chart 0px.
      if (next > 0) {
        setHostWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const height = typeof props.height === "number" ? props.height : undefined;
  const options = {
    ...props.options,
    chart: {
      ...props.options?.chart,
      animations: { ...props.options?.chart?.animations, ...NO_ANIMATION },
    },
  };

  // Không bao giờ vẽ rộng hơn ô chứa: caller khai width số (DonutChart 340)
  // thì kẹp theo host; caller để trống/"100%" thì lấy đúng số đo host.
  const width = (() => {
    if (hostWidth <= 0) return props.width;
    if (typeof props.width === "number")
      return Math.min(props.width, hostWidth);
    if (props.width === undefined || props.width === "100%") return hostWidth;
    return props.width;
  })();

  /*
   * `contain: inline-size` là mấu chốt của chiều CO (đo 09/09 bằng Chromium
   * thật, RPT-04 1500→1100px): ApexCharts ghi `style.width=<px>` lên
   * .apexcharts-canvas, còn ô chứa chart ở các màn báo cáo là grid/flex item
   * với `min-width:auto` — min-content của item bị chính cái canvas cũ chống
   * ra nên item KHÔNG co theo cột lưới; host này vì thế giữ nguyên bề rộng,
   * observer không bắn, chart không bao giờ được vẽ lại: vòng tự khoá. Khai
   * kích thước nội tại = 0 thì host chỉ còn đi theo ô chứa và observer bắn
   * đúng cỡ mới. `width:100%` để host vẫn lấp đầy khi nó là flex item (nếu
   * không, containment làm nó co về 0). Host là flex căn giữa để chart hẹp
   * hơn ô (donut 340px) đứng giữa như trước; chart lấp đầy thì không đổi gì.
   */
  const hostStyle: CSSProperties = {
    contain: "inline-size",
    width: "100%",
    minWidth: 0,
    display: "flex",
    justifyContent: "center",
    ...(height !== undefined ? { minHeight: height } : null),
  };

  return (
    <div ref={hostRef} style={hostStyle}>
      {near ? (
        <Suspense
          fallback={
            <div
              style={height !== undefined ? { height } : undefined}
              aria-hidden="true"
            />
          }
        >
          {/* key theo width: react-apexcharts không tin cậy khi update
              width lúc runtime (đo 09/09: svg giữ nguyên cỡ cũ) — remount là
              đường duy nhất chắc chắn ăn ở cả hai chiều co/giãn; animation đã
              tắt nên remount không gây nháy. */}
          <ApexChart
            key={typeof width === "number" ? width : "auto"}
            {...props}
            width={width}
            options={options}
          />
        </Suspense>
      ) : (
        <div
          style={height !== undefined ? { height } : undefined}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
