import type { ReactNode } from "react";
import { Card } from "antd";
import type { CommonProps } from "./types";

export interface InfoCardProps extends CommonProps {
  title?: ReactNode;
  /** Vùng thao tác góc phải (nút, link…). */
  extra?: ReactNode;
  loading?: boolean;
}

/** Thẻ thông tin chung: tiêu đề + nội dung, có trạng thái loading. */
export function InfoCard({
  title,
  extra,
  loading,
  className,
  children,
}: InfoCardProps) {
  return (
    <Card title={title} extra={extra} loading={loading} className={className}>
      {children}
    </Card>
  );
}
