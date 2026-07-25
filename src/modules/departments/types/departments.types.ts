export type DepartmentType = 'phong_ban' | 'nhom_to';

export interface Department {
  id: number;
  code: string;
  name: string;
  /** 'phong_ban' (phòng ban) | 'nhom_to' (nhóm/tổ — bắt buộc có parentId). */
  departmentType: DepartmentType;
  orgUnitId: number;
  orgUnitName: string;
  parentId: number | null;
  /** Tên phòng ban cha (nếu là nhóm/tổ trực thuộc phòng ban khác). */
  parentName?: string;
  managerId: number | null;
  managerName?: string;
  note?: string;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** ISO timestamp — BE trả khi phòng ban bị xóa mềm (trong cửa sổ 14 ngày). */
  deletedAt?: string | null;
  /** P1.4: Hạn chót để khôi phục (ISO timestamp). */
  restoreDeadline?: string | null;
  /** ISO timestamp — BE trả khi phòng ban đã lưu trữ vĩnh viễn. */
  archivedAt?: string | null;
  employeeCount?: number;
}

export type DepartmentStatus =
  | 'active'
  | 'inactive'
  | 'soft_deleted'
  | 'archived';

export const DEPARTMENT_STATUS_LABELS: Record<DepartmentStatus, string> = {
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
  soft_deleted: 'Đã xóa chờ khôi phục',
  archived: 'Lưu trữ',
};

/** Tính trạng thái hiển thị từ các trường BE. */
export function getDepartmentStatus(dept: {
  active: boolean;
  deletedAt?: string | null;
  archivedAt?: string | null;
}): DepartmentStatus {
  if (dept.archivedAt) return 'archived';
  if (dept.deletedAt) return 'soft_deleted';
  if (dept.active) return 'active';
  return 'inactive';
}

/** P1.4: Tính số ngày còn lại để khôi phục. */
export function getDaysRemaining(
  isoDate: string | null | undefined,
): number | null {
  if (!isoDate) return null;
  const deadline = new Date(isoDate);
  const now = new Date();
  // Ignore time part for day difference calculation
  deadline.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - now.getTime();
  if (diffTime < 0) return 0;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export interface DepartmentTreeNode extends Department {
  children?: DepartmentTreeNode[];
}
