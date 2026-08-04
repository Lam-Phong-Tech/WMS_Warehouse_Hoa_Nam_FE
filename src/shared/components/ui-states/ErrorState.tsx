import type { ReactNode } from "react";
import { Button } from "antd";

export interface ErrorStateProps {
  /** Tiêu đề lỗi. */
  title?: ReactNode;
  /** Mô tả chi tiết lỗi. */
  description?: ReactNode;
  /** Hàm xử lý khi người dùng nhấn thử lại. */
  onRetry?: () => void;
  /** Nhãn nút thử lại. */
  retryLabel?: ReactNode;
  /** Nội dung tùy chỉnh bên dưới. */
  children?: ReactNode;
}

/**
 * Trạng thái lỗi tải dữ liệu theo phong cách wireframe.
 */
export function ErrorState({
  title = "Không tải được dữ liệu",
  description = "Lỗi máy chủ (500) / mất kết nối.",
  onRetry,
  retryLabel = "↻ Thử lại",
  children,
}: ErrorStateProps) {
  return (
    <div
      style={{
        background: "#fff",
        border: "2px solid #2b2b2b",
        borderRadius: 4,
        boxShadow: "4px 5px 0 rgba(43,43,43,.12)",
        padding: 18,
        minHeight: 160,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "#fbe7e6",
            border: "1.5px solid #d8a9a6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
            fontSize: 21,
            color: "#b94a48",
          }}
        >
          ⚠
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: "#a5413f",
            marginBottom: 5,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: "#8c887e", marginBottom: 12 }}>
          {description}
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            style={{
              height: 30,
              padding: "0 13px",
              border: "1.5px solid #2b2b2b",
              borderRadius: 3,
              fontWeight: 600,
              fontSize: 12.5,
            }}
          >
            {retryLabel}
          </Button>
        )}
        {children && <div style={{ marginTop: 12 }}>{children}</div>}
      </div>
    </div>
  );
}
