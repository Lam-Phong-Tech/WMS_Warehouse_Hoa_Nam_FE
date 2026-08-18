import { Spin } from "antd";
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
        background: "rgba(255,255,255,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
      }}
    >
      <Spin size="large" />
      <div style={{ marginTop: 10, color: "#555" }}>Đang tải...</div>
    </div>
  );
}
