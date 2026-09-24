import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loading } from "@/shared/components/feedback/Loading";
import { useActiveRequestCount } from "@/shared/api/request-activity";

const SETTLE_WINDOW_MS = 160;

/**
 * Chỉ công bố route sau khi toàn bộ nguồn dữ liệu khởi tạo đã lắng.
 *
 * Component con vẫn được mount phía sau overlay để tất cả query/request có thể
 * chạy song song. Khi nguồn cuối cùng hoàn tất, chờ thêm một cửa sổ ngắn để bắt
 * dependent query vừa được tạo từ response trước. Sau khi đã mở trang, boundary
 * không khoá lại bởi refetch nền hay thao tác người dùng.
 */
export function PageLoadBoundary({ children }: { children: ReactNode }) {
  const activeRequests = useActiveRequestCount();
  const initialQueryFetches = useIsFetching({
    predicate: (query) => query.state.data === undefined,
  });
  const [ready, setReady] = useState(false);
  const observedWork = useRef(false);
  const busy = activeRequests > 0 || initialQueryFetches > 0;

  useEffect(() => {
    if (busy) observedWork.current = true;
  }, [busy]);

  useEffect(() => {
    if (ready || busy) return;

    if (observedWork.current) {
      const timeout = window.setTimeout(() => setReady(true), SETTLE_WINDOW_MS);
      return () => window.clearTimeout(timeout);
    }

    // Trang không có dữ liệu vẫn đợi hai frame: effect/query của cây con có cơ
    // hội đăng ký trước khi quyết định rằng route thực sự không có việc phải chờ.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setReady(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [busy, ready]);

  return (
    <>
      {children}
      {!ready ? <Loading opaque /> : null}
    </>
  );
}
