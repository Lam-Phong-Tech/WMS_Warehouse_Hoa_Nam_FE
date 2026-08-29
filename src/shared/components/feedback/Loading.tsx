/**
 * Nội bộ render bằng design-system foundation (Part 3) — public API giữ nguyên.
 */
import { UiSpinner } from "@/shared/ui";
import { SEMANTIC_LIGHT, Z_INDEX } from "@/shared/ui/tokens";

import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";

/**
 * Overlay loading toàn màn hình (bootstrap phiên, chuyển route bảo vệ).
 * WWHN-268: phát `data-ui-state="loading"` cho ma trận bằng chứng QA2.
 */
export function Loading() {
  return (
    <div
      {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-fullscreen")}
      aria-busy="true"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        // Màn trắng mờ trên nền hiện tại (không có token white-alpha riêng).
        background: "rgba(255, 255, 255, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        backdropFilter: "blur(4px)",
        zIndex: Z_INDEX.blockingLoading,
      }}
    >
      <UiSpinner size={40} />
      <div style={{ marginTop: 10, color: SEMANTIC_LIGHT.textMedium }}>
        Đang tải...
      </div>
    </div>
  );
}
