import { UiButton } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { useAutoLoadMore, type RenderWindow } from "./useRenderWindow";

/**
 * Chân danh sách KHÔNG phải bảng — lưới thẻ của các màn báo cáo
 * (`report-snapshot-grid`, `insight-grid`, lưới thẻ đối soát…).
 *
 * Vừa là nút bấm tường minh, vừa là sentinel: cuộn tới đây thì tự nới thêm, nên
 * người đọc cuộn bình thường không phải bấm gì. Bản dành cho `<tbody>` là
 * `WindowedRowsFooter` (phải phát ra `<tr>`); trộn hai cái sẽ sinh HTML không
 * hợp lệ.
 *
 * Số `total` là tổng của tập ĐÃ LỌC. Mọi KPI/biểu đồ vẫn tính trên tập đầy đủ —
 * cửa sổ này chỉ giới hạn số thẻ được vẽ ra DOM.
 */
export function WindowedMore<T>({
  window: renderWindow,
}: {
  window: RenderWindow<T>;
}) {
  const t = useT();
  const sentinelRef = useAutoLoadMore(
    renderWindow.hasMore,
    renderWindow.showMore,
  );
  if (!renderWindow.hasMore) return null;
  return (
    <div style={{ textAlign: "center", padding: 12, gridColumn: "1 / -1" }}>
      <span ref={sentinelRef} aria-hidden="true" />
      <span style={{ marginRight: 12, fontSize: 13 }}>
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
    </div>
  );
}
