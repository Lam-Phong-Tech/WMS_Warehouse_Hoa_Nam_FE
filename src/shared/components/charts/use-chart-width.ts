import { useEffect, useRef, useState } from "react";

/**
 * Bề rộng dự phòng khi chưa đo được (lần render đầu, môi trường test không có
 * layout). Chọn theo bề ngang thực tế của một panel biểu đồ trên desktop để
 * lần vẽ đầu tiên đã ra mật độ nhãn gần đúng thay vì nhảy một nhịp.
 */
const FALLBACK_WIDTH = 640;

/**
 * Đo bề rộng thật của khung biểu đồ.
 *
 * ApexCharts tự co giãn theo container nhưng KHÔNG cho biết nó đang rộng bao
 * nhiêu, trong khi mật độ nhãn trục lại phụ thuộc đúng con số đó (cùng một kỳ
 * 90 ngày: vừa khung trên desktop, chồng chữ khi thu sidebar hay trên tablet).
 * Vì vậy phải tự đo bằng `ResizeObserver` — bắt được cả thay đổi do thu/mở
 * sidebar chứ không chỉ resize cửa sổ.
 */
export function useChartWidth(fallback: number = FALLBACK_WIDTH): {
  ref: React.RefObject<HTMLDivElement | null>;
  width: number;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/**
 * Bề rộng vùng vẽ của ApexCharts = bề rộng khung trừ máng nhãn trục Y bên trái
 * và khoảng thở bên phải. Apex không công bố số này; ước lượng dư một chút để
 * nhãn trục X không bao giờ tràn ra ngoài.
 */
export function apexPlotWidth(containerWidth: number): number {
  return Math.max(120, containerWidth - 78);
}
