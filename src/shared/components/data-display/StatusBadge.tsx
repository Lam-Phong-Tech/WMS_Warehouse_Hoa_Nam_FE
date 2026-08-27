import { Chip } from "@mui/material";

export interface StatusBadgeProps {
  /** Trạng thái hoạt động (true) hay ngừng (false). */
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

/**
 * Badge trạng thái hoạt động/ngừng — gom pattern `active ? <Chip success> : <Chip>`
 * lặp ở nhiều bảng (org-units, departments, positions, employees...).
 */
export function StatusBadge({
  active,
  activeLabel = "Hoạt động",
  inactiveLabel = "Ngừng",
}: StatusBadgeProps) {
  return active ? (
    <Chip label={activeLabel} color="success" size="small" />
  ) : (
    <Chip label={inactiveLabel} size="small" />
  );
}
