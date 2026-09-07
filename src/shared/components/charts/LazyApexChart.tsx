import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from "react";

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

  return (
    <div ref={hostRef} style={height !== undefined ? { minHeight: height } : undefined}>
      {near ? (
        <Suspense fallback={<div style={height !== undefined ? { height } : undefined} aria-hidden="true" />}>
          <ApexChart {...props} options={options} />
        </Suspense>
      ) : (
        <div style={height !== undefined ? { height } : undefined} aria-hidden="true" />
      )}
    </div>
  );
}
