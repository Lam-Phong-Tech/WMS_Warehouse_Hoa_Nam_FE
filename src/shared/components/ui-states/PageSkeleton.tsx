import { Skeleton } from "antd";

/**
 * Skeleton nhẹ cho Suspense fallback khi lazy-load page chunk.
 * Không gây layout shift, không block UI, chỉ hiển thị khung xương.
 */
export function PageSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <Skeleton active paragraph={{ rows: 1 }} title={{ width: 200 }} />
      <div style={{ height: 24 }} />
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}
