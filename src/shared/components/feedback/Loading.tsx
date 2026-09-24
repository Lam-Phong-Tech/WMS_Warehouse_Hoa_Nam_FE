import { Z_INDEX } from "@/shared/ui/tokens";
import { UnifiedLoading } from "@/shared/ui/loading/UnifiedLoading";
import { useLoadingParticipant } from "@/shared/ui/loading/loading-context";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";

/**
 * Overlay loading toàn màn hình: bootstrap phiên, chặn quyền, chuyển route bảo vệ.
 * WWHN-268: phát `data-ui-state="loading"` cho ma trận bằng chứng QA2.
 *
 * Dùng chung một hình ảnh `UnifiedLoading` với PageSkeleton/LoadingState/
 * UiStateSurface, đồng thời tự đăng ký như một tác vụ chuẩn bị của barrier gần
 * nhất nên overlay không biến mất sớm hơn phần còn lại của màn.
 */
export function Loading() {
  useLoadingParticipant(true);
  return (
    <div
      {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-fullscreen")}
      aria-busy="true"
      style={{
        position: "fixed",
        inset: 0,
        // Màn trắng mờ trên nền hiện tại (không có token white-alpha riêng).
        background: "rgba(255, 255, 255, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        zIndex: Z_INDEX.blockingLoading,
      }}
    >
      <UnifiedLoading />
    </div>
  );
}
