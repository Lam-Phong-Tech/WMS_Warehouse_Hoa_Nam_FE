import type { Dayjs } from 'dayjs';
import type { EmployeeAssignment } from '../hooks/use-employee-assignments';
import type { Department } from '@/modules/departments/types/departments.types';

/**
 * P1 (BR-20): Xác định assignment hiện tại (chính) của nhân sự từ danh sách
 * assignments active trả về từ BE.
 *
 * BE có thể không đảm bảo thứ tự → luôn sort FE theo `start_date` DESC rồi
 * ưu tiên `is_primary=true`; nếu không có bản ghi nào `is_primary=true` thì
 * lấy bản ghi có `start_date` mới nhất.
 */
export function getCurrentAssignment(
  list: EmployeeAssignment[],
): EmployeeAssignment | null {
  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => {
    const dateA = new Date(a.start_date ?? 0).getTime();
    const dateB = new Date(b.start_date ?? 0).getTime();
    return dateB - dateA; // DESC — mới nhất trước
  });

  return sorted.find((a) => a.is_primary) ?? sorted[0];
}

/** Lọc phòng ban theo đơn vị đã chọn (chưa chọn đơn vị → danh sách rỗng). */
export function getDeptOptionsForOrgUnit(
  departments: Department[],
  selectedOrgUnitId: number | null,
): { value: number; label: string }[] {
  return departments
    .filter((d) => !selectedOrgUnitId || d.orgUnitId === selectedOrgUnitId)
    .map((d) => ({ value: d.id, label: d.name }));
}

/**
 * P1: Xác thực khoảng ngày hiệu lực của một phân công — `end_date`, nếu có,
 * phải >= `start_date` (assignment là dữ liệu effective-date, sai mốc ngày
 * sẽ phá lịch sử công tác).
 *
 * Trả về thông báo lỗi (string) nếu không hợp lệ, `null` nếu hợp lệ hoặc
 * không đủ dữ liệu để so sánh (một trong hai mốc còn trống).
 */
export function validateAssignmentDateRange(
  startDate: Dayjs | null | undefined,
  endDate: Dayjs | null | undefined,
): string | null {
  if (!startDate || !endDate) return null;
  if (endDate.isBefore(startDate, 'day')) {
    return 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu';
  }
  return null;
}
