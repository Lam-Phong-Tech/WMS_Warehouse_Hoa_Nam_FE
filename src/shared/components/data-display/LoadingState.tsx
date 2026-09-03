/**
 * Nội bộ render bằng design-system foundation (Part 3) — public API giữ nguyên.
 */
import { UiStateSurface } from "@/shared/ui";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { useT } from "@/shared/i18n/useT";

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
  tip,
  minHeight = 160,
  testId,
}: LoadingStateProps) {
  const t = useT();
  const resolvedTip = tip ?? t("shared.states.loading");
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
      <UiStateSurface kind="loading" title={resolvedTip} />
    </div>
  );
}
