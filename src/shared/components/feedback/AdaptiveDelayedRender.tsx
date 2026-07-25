import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { PageSkeleton } from '@/shared/components/ui-states/PageSkeleton';

interface Props {
  children: ReactNode;
  /** Delay tối thiểu trước khi render (ms) */
  minDelay?: number;
  /** Delay tối đa để tránh chờ quá lâu (ms) */
  maxDelay?: number;
  /** Callback khi bắt đầu render */
  onRenderStart?: () => void;
}

interface NetworkInformation {
  effectiveType?: string;
  saveData?: boolean;
}

/** Tính delay dựa trên network condition hiện tại (navigator.connection). */
function computeAdaptiveDelay(minDelay: number, maxDelay: number): number {
  let adaptiveDelay = minDelay;

  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const connection = (
      navigator as Navigator & { connection?: NetworkInformation }
    ).connection;

    if (connection) {
      if (connection.effectiveType === '4g') {
        adaptiveDelay = minDelay; // Mạng nhanh - delay ngắn
      } else if (connection.effectiveType === '3g') {
        adaptiveDelay = Math.max(minDelay, 300); // Mạng trung bình
      } else if (
        connection.effectiveType === '2g' ||
        connection.effectiveType === 'slow-2g'
      ) {
        adaptiveDelay = Math.max(minDelay, 500); // Mạng chậm - delay dài hơn
      }

      if (connection.saveData) {
        adaptiveDelay = Math.max(adaptiveDelay, 600);
      }
    }
  }

  return Math.min(adaptiveDelay, maxDelay);
}

/**
 * Adaptive Delayed Render - tự động điều chỉnh delay dựa trên:
 * 1. Network speed (navigator.connection.effectiveType)
 * 2. Trạng thái loading của page
 * 3. Thời gian thực tế cần thiết
 *
 * Cải thiện so với DelayedRender cũ:
 * - Không dùng delay cố định 400ms
 * - Tự động giảm delay trên mạng nhanh
 * - Tăng delay trên mạng chậm
 * - Có maxDelay để không chờ quá lâu
 */
export function AdaptiveDelayedRender({ children, ...rest }: Props) {
  // Remount toàn bộ khi đổi route thay vì tự reset state trong effect —
  // để state (ready/elapsed) luôn khởi tạo sạch cho mỗi lần điều hướng.
  const location = useLocation();
  return (
    <AdaptiveDelayedRenderInner key={location.pathname} {...rest}>
      {children}
    </AdaptiveDelayedRenderInner>
  );
}

function AdaptiveDelayedRenderInner({
  children,
  minDelay = 100,
  maxDelay = 800,
  onRenderStart,
}: Props) {
  const [ready, setReady] = useState(false);
  // Delay được tính 1 lần từ network condition hiện tại khi component mount
  // (không tính lại trong effect để tránh setState đồng bộ trong effect).
  const [currentDelay] = useState(() =>
    computeAdaptiveDelay(minDelay, maxDelay),
  );
  const [elapsed, setElapsed] = useState(0);
  const hasRenderedRef = useRef(false);

  useEffect(() => {
    const startTime = Date.now();

    // Cập nhật elapsed định kỳ (chỉ dùng để hiển thị debug ở chế độ DEV)
    const interval = import.meta.env.DEV
      ? setInterval(() => setElapsed(Date.now() - startTime), 100)
      : undefined;

    const timer = setTimeout(() => {
      if (!hasRenderedRef.current) {
        hasRenderedRef.current = true;
        setReady(true);
        onRenderStart?.();
      }
    }, currentDelay);

    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
      hasRenderedRef.current = false;
    };
  }, [currentDelay, onRenderStart]);

  if (!ready) {
    return (
      <div style={{ padding: 24 }}>
        <PageSkeleton />
        {import.meta.env.DEV && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: '#999',
              textAlign: 'center',
            }}
          >
            Đang tải... ({elapsed}ms / {currentDelay}ms)
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
