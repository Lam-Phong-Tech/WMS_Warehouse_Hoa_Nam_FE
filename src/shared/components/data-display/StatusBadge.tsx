import { Tag } from "antd";

export interface StatusBadgeProps {
  /** Trạng thái hoạt động (true) hay ngừng (false). */
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

/**
 * Badge trạng thái hoạt động/ngừng — gom pattern `active ? <Tag green> : <Tag>`
 * lặp ở nhiều bảng (org-units, departments, positions, employees...).
 */
export function StatusBadge({
  active,
  activeLabel = "Hoạt động",
  inactiveLabel = "Ngừng",
}: StatusBadgeProps) {
  return active ? (
    <Tag color="green">{activeLabel}</Tag>
  ) : (
    <Tag>{inactiveLabel}</Tag>
  );
}
