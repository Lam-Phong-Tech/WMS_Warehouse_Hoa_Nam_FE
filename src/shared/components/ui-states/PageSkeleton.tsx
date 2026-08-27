/**
 * Nội bộ render bằng design-system foundation (Part 3) — public API giữ nguyên.
 */
import Skeleton from "@mui/material/Skeleton";
import { SPACING } from "@/shared/ui/tokens";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";

/** Một thanh xương 16px — mô phỏng dòng skeleton (antd cũ) để không lệch layout. */
function SkeletonRow({
  width,
  marginTop,
}: {
  width?: number | string;
  marginTop?: number;
}) {
  return (
    <Skeleton
      variant="rounded"
      width={width}
      height={SPACING.lg}
      style={marginTop ? { marginTop } : undefined}
    />
  );
}

/**
 * Skeleton nhẹ cho Suspense fallback khi lazy-load page chunk.
 * Không gây layout shift, không block UI, chỉ hiển thị khung xương.
 * Giữ cùng khoảng chiếm chỗ với bản antd cũ (title + 1 dòng; title + 6 dòng).
 */
export function PageSkeleton() {
  return (
    <div
      {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-skeleton")}
      aria-busy="true"
      style={{ padding: SPACING.xl }}
    >
      {/* Khối 1: tiêu đề trang (rộng 200) + 1 dòng nội dung */}
      <SkeletonRow width={200} />
      <SkeletonRow marginTop={SPACING.xl} />
      <div style={{ height: SPACING.xl }} />
      {/* Khối 2: tiêu đề section (38%) + 6 dòng, dòng cuối 61% (như antd) */}
      <SkeletonRow width="38%" />
      <SkeletonRow marginTop={SPACING.xl} />
      <SkeletonRow marginTop={SPACING.lg} />
      <SkeletonRow marginTop={SPACING.lg} />
      <SkeletonRow marginTop={SPACING.lg} />
      <SkeletonRow marginTop={SPACING.lg} />
      <SkeletonRow width="61%" marginTop={SPACING.lg} />
    </div>
  );
}
