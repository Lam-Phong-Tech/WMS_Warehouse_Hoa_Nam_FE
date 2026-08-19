import { useEffect, useRef } from "react";

/**
 * WWHN-217 · D-217-01/02/03 — Back của trình duyệt phải đóng overlay, không rời màn hình.
 *
 * Các màn hub (IN-01, OUT-01, INV-01) mở chi tiết/scan/trace bằng state React thuần
 * (`useState`), còn deep-link `?screen=&id=` thì bị tiêu thụ ngay bằng
 * `setSearchParams(..., { replace: true })`. Hệ quả: mở overlay KHÔNG đẩy history entry
 * nào, nên Back của trình duyệt (và nút Back cứng/cử chỉ vuốt trên Chrome Android — thiết
 * bị bắt buộc theo NFR-SRS-006/NFR-SRS-021) nhảy thẳng ra khỏi màn hình đang thao tác.
 * Người dùng đang quét dở một phiếu mất toàn bộ ngữ cảnh và phải điều hướng lại từ đầu.
 *
 * Hook đồng bộ trạng thái mở của overlay với history stack:
 * - mở  → push một entry CÙNG URL, gắn marker vào `history.state`;
 * - Back → popstate mang state không còn marker → gọi `onDismiss()` thay vì đổi route;
 * - đóng bằng nút trong UI → `history.back()` để tiêu thụ đúng entry đã push, tránh để
 *   lại rác khiến người dùng phải bấm Back hai lần mới rời được màn hình.
 *
 * Vì sao dùng thẳng History API thay vì `useNavigate()/useLocation()`: entry chèn thêm
 * có CÙNG URL với entry hiện tại nên router coi là cùng một location và không đảm bảo
 * phát lại `location.state` cho consumer — đã đo trên react-router 7.18 trong app này:
 * component re-render với `location.state` mới nhưng effect phụ thuộc `location.state`
 * không chạy, nên nhánh "Back" không bao giờ được kích hoạt. Nguồn sự thật của "người
 * dùng vừa bấm Back" là sự kiện `popstate` của trình duyệt, nên nghe thẳng ở đó.
 * Marker được ghi KÈM — không ghi đè — các khoá router đang giữ trong `history.state`
 * (`idx`, `key`, `usr`); URL không đổi nên router không phải đổi route khi entry bị pop.
 *
 * @param open      overlay đang mở hay không (nguồn sự thật vẫn là state của màn hình).
 * @param onDismiss đóng overlay — chỉ được gọi khi Back thật sự xảy ra.
 * @param overlayId khoá phân biệt overlay giữa các màn (vd "IN-01-overlay").
 */
export const OVERLAY_HISTORY_STATE_KEY = "wmsOverlay";

interface OverlayHistoryState {
  [OVERLAY_HISTORY_STATE_KEY]?: string;
}

function readOverlayMarker(state: unknown): string | undefined {
  if (typeof state !== "object" || state === null) return undefined;
  const marker = (state as OverlayHistoryState)[OVERLAY_HISTORY_STATE_KEY];
  return typeof marker === "string" ? marker : undefined;
}

export function useOverlayBackDismiss(
  open: boolean,
  onDismiss: () => void,
  overlayId: string,
): void {
  // Chỉ hook nào đã tự đẩy entry mới được tiêu thụ nó — tránh việc một overlay đóng lại
  // pop nhầm entry của màn khác.
  const pushedRef = useRef(false);
  const dismissRef = useRef(onDismiss);

  // Gan trong effect chu khong trong than render: `react-hooks/refs` cam cham ref luc
  // render (React Compiler co the chay lai than render nhieu lan). Effect khong co deps
  // nen chay sau MOI lan render, tuc `dismissRef` luon la callback moi nhat truoc khi
  // bat ky popstate nao co the toi.
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (open && !pushedRef.current) {
      pushedRef.current = true;
      const current = window.history.state as Record<string, unknown> | null;
      window.history.pushState(
        {
          ...(typeof current === "object" && current !== null ? current : {}),
          [OVERLAY_HISTORY_STATE_KEY]: overlayId,
        },
        "",
      );
      return;
    }

    if (!open && pushedRef.current) {
      pushedRef.current = false;
      // Chỉ pop khi entry ở đỉnh đúng là entry mình đã đẩy. Nếu overlay đóng vì người
      // dùng đã điều hướng đi nơi khác thì entry đó không còn ở đỉnh và history.back()
      // sẽ kéo họ lùi sai một bước.
      if (readOverlayMarker(window.history.state) === overlayId) {
        window.history.back();
      }
    }
  }, [open, overlayId]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const handlePopState = (event: PopStateEvent) => {
      if (!pushedRef.current) return;
      // Vẫn còn marker của mình = Back chưa chạm tới entry này (vd overlay lồng nhau).
      if (readOverlayMarker(event.state) === overlayId) return;
      pushedRef.current = false;
      dismissRef.current();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [open, overlayId]);
}
