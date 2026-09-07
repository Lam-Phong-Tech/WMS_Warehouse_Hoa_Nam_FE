import { UiButton } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { useAutoLoadMore, type RenderWindow } from "./useRenderWindow";

/**
 * Dòng chân bảng cho các bảng dựng TAY (`<table>`/`<tbody>` viết thẳng trong màn
 * báo cáo, không đi qua ResponsiveDataTable). Nói rõ đang vẽ bao nhiêu trên tổng
 * bao nhiêu, cho nới thêm bằng nút, và tự nới khi cuộn tới nơi.
 *
 * Con số `total` là tổng của tập ĐÃ LỌC, không phải phần đang vẽ — mọi KPI/biểu
 * đồ của khối vẫn tính trên tập đầy đủ, đây chỉ là cửa sổ vẽ.
 */
export function WindowedRowsFooter<T>({
  window: renderWindow,
  colSpan,
}: {
  window: RenderWindow<T>;
  colSpan: number;
}) {
  const t = useT();
  const sentinelRef = useAutoLoadMore(
    renderWindow.hasMore,
    renderWindow.showMore,
  );
  if (!renderWindow.hasMore) return null;
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: "center" }}>
        <span ref={sentinelRef} aria-hidden="true" />
        <span style={{ marginRight: 12 }}>
          {t("shared.table.showingSome", {
            shown: renderWindow.shown,
            total: renderWindow.total,
          })}
        </span>
        <UiButton
          size="small"
          appearance="outlined"
          onClick={renderWindow.showMore}
        >
          {t("shared.table.showMore")}
        </UiButton>
      </td>
    </tr>
  );
}
