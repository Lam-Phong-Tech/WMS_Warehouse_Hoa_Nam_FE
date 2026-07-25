import { Spin } from 'antd';

export interface LoadingStateProps {
  /** Nhãn hiển thị dưới spinner. */
  tip?: string;
  /** Chiều cao tối thiểu của vùng loading. */
  minHeight?: number;
}

/**
 * Trạng thái đang tải cho một khối/nội dung (inline, căn giữa).
 * Khác với `Loading` (phủ toàn màn hình); dùng trong card/section.
 */
export function LoadingState({
  tip = 'Đang tải…',
  minHeight = 160,
}: LoadingStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
      }}
    >
      <Spin description={tip}>
        <div style={{ padding: 8 }} />
      </Spin>
    </div>
  );
}
