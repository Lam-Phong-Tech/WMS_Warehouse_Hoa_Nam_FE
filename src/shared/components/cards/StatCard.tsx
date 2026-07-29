import type { ReactNode } from "react";
import { Card, Statistic } from "antd";
import type { CommonProps } from "./types";

export interface StatCardProps extends CommonProps {
  title: ReactNode;
  value: number;
  icon: ReactNode;
  /** Màu nhấn cho icon (badge nền dùng cùng màu, độ mờ thấp). */
  color: string;
  prefix?: ReactNode;
}

/**
 * Thẻ thống kê: icon + số liệu, dùng cho dashboard/tổng quan.
 * Tách từ UI lặp trong DashboardPage để các trang khác tái dùng.
 */
export function StatCard({
  title,
  value,
  icon,
  color,
  prefix,
  className,
}: StatCardProps) {
  return (
    <Card variant="borderless" style={{ height: "100%" }} className={className}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            color,
            background: `${color}1a`,
          }}
        >
          {icon}
        </div>
        <Statistic
          title={title}
          value={value}
          prefix={prefix}
          formatter={(val) =>
            typeof val === "number" ? val.toLocaleString("vi-VN") : val
          }
        />
      </div>
    </Card>
  );
}
