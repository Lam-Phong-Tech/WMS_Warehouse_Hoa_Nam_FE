import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PageSkeleton } from "@/shared/components/ui-states/PageSkeleton";

/**
 * Delay render children tối thiểu `delay` ms.
 * Khi chuyển trang, component sẽ show skeleton trong khoảng thời gian này
 * để dữ liệu (React Query) có thời gian load, tránh flash trắng/loading.
 *
 * Giúp ổn định UX khi có nhiều concurrent users (300 users):
 * data đã được fetch và cache trước khi page content render.
 */
interface Props {
  children: ReactNode;
  delay?: number;
}

export function DelayedRender({ children, delay = 400 }: Props) {
  const [ready, setReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(timer);
  }, [delay, location.pathname]);

  if (!ready) return <PageSkeleton />;
  return <>{children}</>;
}
