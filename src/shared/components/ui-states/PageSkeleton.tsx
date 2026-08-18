import { Skeleton } from "antd";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";

/**
 * Skeleton nhẹ cho Suspense fallback khi lazy-load page chunk.
 * Không gây layout shift, không block UI, chỉ hiển thị khung xương.
 */
export function PageSkeleton() {
  return (
    <div
      {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-skeleton")}
      aria-busy="true"
      style={{ padding: 24 }}
    >
      <Skeleton active paragraph={{ rows: 1 }} title={{ width: 200 }} />
      <div style={{ height: 24 }} />
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}
