import { useCallback, useRef, type ReactNode } from "react";
import { Box } from "@/shared/ui";
import { useRenderWindow } from "./useRenderWindow";
import { useVirtualRows } from "./useVirtualRows";
import { WindowedMore } from "./WindowedMore";

/**
 * Danh sách dài CÓ KHUNG CUỘN RIÊNG — bản dành cho danh sách, song sinh với
 * nhánh cuộn ảo của `ResponsiveDataTable`.
 *
 * VÌ SAO TỒN TẠI (thay vì để mỗi màn tự gọi `useVirtualRows`)
 * Cuộn ảo cần bốn thứ đi cùng nhau và rất dễ làm thiếu một: ref của khung cuộn,
 * hai phần tử đệm giữ đúng chiều cao phần chưa vẽ, `measureElement` trên từng
 * phần tử thật, và đường lui khi khung cuộn chưa có chiều cao. Rải bốn thứ đó
 * vào từng màn là đúng kiểu "chép logic hiệu năng đi nhiều nơi" — sai một chỗ
 * thì màn đó lặng lẽ hiện danh sách trống. Ở đây gói lại một lần.
 *
 * DÙNG CHO: dòng thời gian của báo cáo Truy vết hàng hoá, và mọi danh sách dài
 * khác nằm trong khung `max-height` + `overflow-y: auto`.
 *
 * KHÔNG DÙNG CHO: bảng — `<tbody>` cần phần tử đệm là `<tr>` nên nhánh đó nằm
 * trong chính `ResponsiveDataTable`. Cả hai dùng CHUNG `useVirtualRows`.
 */
export interface VirtualListProps<T> {
  rows: T[];
  rowKey: (row: T) => string | number;
  /**
   * @param row   dòng dữ liệu
   * @param index vị trí trong TOÀN tập (không phải trong phần đang vẽ)
   * @param isLast dòng cuối cùng của TOÀN tập — dùng để bỏ nét nối cuối cùng
   */
  renderRow: (row: T, index: number, isLast: boolean) => ReactNode;
  /** Trần chiều cao khung cuộn. Bỏ trống ⇒ không cuộn ảo, giữ đường cũ. */
  maxHeight?: number | string;
  emptyText?: ReactNode;
  /** Thẻ bọc danh sách — mặc định `ol` (dòng thời gian là danh sách có thứ tự). */
  component?: "ol" | "ul" | "div";
  "data-testid"?: string;
}

export function VirtualList<T>({
  rows,
  rowKey,
  renderRow,
  maxHeight,
  emptyText,
  component = "ol",
  "data-testid": dataTestId,
}: VirtualListProps<T>) {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const getScroller = useCallback(() => scrollerRef.current, []);
  const virtual = useVirtualRows(rows, getScroller, maxHeight !== undefined);
  const { enabled: virtualEnabled, measureRow } = virtual;

  // Đường lui khi chưa cuộn ảo được (chưa có chiều cao, dưới ngưỡng, không có
  // khung cuộn riêng): giữ nguyên cơ chế nới dần đã dùng khắp nhóm báo cáo.
  const renderWindow = useRenderWindow(rows);

  const total = rows.length;
  const spacer = (position: "top" | "bottom", height: number) =>
    height > 0 ? (
      <Box
        component={component === "div" ? "div" : "li"}
        aria-hidden="true"
        data-virtual-spacer={position}
        sx={{ height, listStyle: "none" }}
      />
    ) : null;

  const items = virtualEnabled
    ? virtual.items.map((item) => ({ row: item.row, index: item.index }))
    : renderWindow.visible.map((row, index) => ({ row, index }));

  return (
    <Box
      ref={scrollerRef}
      sx={{
        maxHeight,
        overflowY: maxHeight === undefined ? undefined : "auto",
        overscrollBehavior: "contain",
        scrollBehavior: "smooth",
      }}
    >
      {total === 0 ? (
        emptyText
      ) : (
        <>
          <Box
            component={component}
            role="list"
            data-testid={dataTestId}
            sx={{ listStyle: "none", m: 0, p: 0 }}
          >
            {spacer("top", virtualEnabled ? virtual.paddingTop : 0)}
            {items.map(({ row, index }) => (
              <Box
                key={rowKey(row)}
                component={component === "div" ? "div" : "li"}
                // Đo chiều cao THẬT: dòng thời gian có dòng một hàng và dòng hai
                // hàng lẫn lộn, ước lượng cứng sẽ làm thanh cuộn nhảy.
                ref={virtualEnabled ? measureRow : undefined}
                data-index={virtualEnabled ? index : undefined}
                sx={{ listStyle: "none" }}
              >
                {renderRow(row, index, index === total - 1)}
              </Box>
            ))}
            {spacer("bottom", virtualEnabled ? virtual.paddingBottom : 0)}
          </Box>
          {/* Cuộn ảo đã tới được mọi dòng bằng cách cuộn — nút "Hiện thêm" chỉ
              còn ý nghĩa ở đường lui. */}
          {virtualEnabled ? null : <WindowedMore window={renderWindow} />}
        </>
      )}
    </Box>
  );
}
