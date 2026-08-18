import { Spin } from "antd";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";

export interface LoadingStateProps {
  /** Nhãn hiển thị dưới spinner. */
  tip?: string;
  /** Chiều cao tối thiểu của vùng loading. */
  minHeight?: number;
  /** Ghi đè testid khi một màn có nhiều vùng loading cần phân biệt. */
  testId?: string;
}

/**
 * Trạng thái đang tải cho một khối/nội dung (inline, căn giữa).
 * Khác với `Loading` (phủ toàn màn hình); dùng trong card/section.
 *
 * WWHN-268: phát `data-ui-state="loading"` để QA2 chụp đúng trạng thái.
 */
export function LoadingState({
  tip = "Đang tải…",
  minHeight = 160,
  testId,
}: LoadingStateProps) {
  return (
    <div
      {...uiStateProps(UI_STATE.LOADING, testId)}
      aria-busy="true"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
      }}
    >
      <Spin description={tip}>
        <div style={{ padding: 8 }} />
      </Spin>
    </div>
  );
}
