import { createContext, useContext } from "react";

/**
 * `true` khi TRANG chứa component đang hiển thị. Mặc định `true`; chỉ
 * `KeepAliveOutlet` (app/layouts) hạ xuống `false` cho màn đang được giữ sống
 * ở trạng thái ẩn (`<Activity mode="hidden">`).
 *
 * Nằm ở `shared/ui` thay vì `app/layouts` vì các overlay của design system
 * (UiDialog/UiDrawer, Drawer/Menu/Popover) cần đọc nó — shared không được kéo
 * app vào.
 */
export const PageVisibilityContext = createContext<boolean>(true);

/**
 * Overlay render qua portal (Dialog/Drawer/Menu/Popover của MUI) nằm NGOÀI cây
 * DOM của trang, nên `display:none` của Activity không ẩn được chúng. Hơn nữa,
 * trong cây bị ẩn React đã gỡ mọi effect, nên KHÔNG thể "đóng" bằng `open=false`
 * — transition thoát của MUI cần effect/timer để hoàn tất, và overlay sẽ đứng
 * im ở trạng thái đang thoát, đè lên trang mới (đã thấy trên bản build thật).
 * Cách đúng là KHÔNG RENDER overlay khi trang ẩn: DOM của portal bị gỡ ngay
 * trong lượt commit, và mount lại nguyên trạng khi trang hiện.
 */
export function usePageVisible(): boolean {
  return useContext(PageVisibilityContext);
}
