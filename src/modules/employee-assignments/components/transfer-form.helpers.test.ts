import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  getCurrentAssignment,
  getDeptOptionsForOrgUnit,
  validateAssignmentDateRange,
} from './transfer-form.helpers';
import type { EmployeeAssignment } from '../hooks/use-employee-assignments';
import type { Department } from '@/modules/departments/types/departments.types';

function makeAssignment(
  overrides: Partial<EmployeeAssignment>,
): EmployeeAssignment {
  return {
    id: overrides.id ?? 1,
    employee_id: 5,
    org_unit_id: 5,
    department_id: 4,
    position_id: 3,
    is_primary: false,
    start_date: '2024-01-01',
    status: true,
    ...overrides,
  };
}

describe('getCurrentAssignment (P1 — BR-20)', () => {
  it('không có assignment → null', () => {
    expect(getCurrentAssignment([])).toBeNull();
  });

  it('1 assignment active → trả về chính nó', () => {
    const a = makeAssignment({ id: 1, is_primary: true });
    expect(getCurrentAssignment([a])).toEqual(a);
  });

  it('nhiều assignments, có is_primary=true nhưng KHÔNG phải bản ghi mới nhất → vẫn ưu tiên is_primary', () => {
    const primary = makeAssignment({
      id: 1,
      start_date: '2024-01-01',
      is_primary: true,
    });
    const list = [
      makeAssignment({ id: 3, start_date: '2024-12-01', is_primary: false }),
      makeAssignment({ id: 2, start_date: '2024-06-01', is_primary: false }),
      primary,
    ];
    expect(getCurrentAssignment(list)).toEqual(primary);
  });

  it('BE trả về không sort (ID ASC) — vẫn lấy đúng is_primary=true, không phụ thuộc thứ tự BE', () => {
    const primary = makeAssignment({
      id: 1,
      start_date: '2024-01-01',
      is_primary: true,
    });
    // Giả lập BE trả theo ID ASC — không sort theo start_date
    const list = [
      primary,
      makeAssignment({ id: 2, start_date: '2024-06-01', is_primary: false }),
      makeAssignment({ id: 3, start_date: '2024-12-01', is_primary: false }),
    ];
    expect(getCurrentAssignment(list)).toEqual(primary);
  });

  it('không có assignment nào is_primary=true → fallback lấy bản ghi start_date mới nhất', () => {
    const newest = makeAssignment({
      id: 2,
      start_date: '2024-06-01',
      is_primary: false,
    });
    const list = [
      makeAssignment({ id: 1, start_date: '2024-01-01', is_primary: false }),
      newest,
    ];
    expect(getCurrentAssignment(list)).toEqual(newest);
  });

  it('regression: KHÔNG còn dùng limit=1 nữa — hàm phải tự xử lý đúng khi nhận đủ N bản ghi (đa chi nhánh)', () => {
    // Trước fix: query limit=1 + list[0] có thể lấy nhầm bản ghi không phải primary
    // nếu BE trả về theo ID DESC. Test này mô phỏng chính xác worst-case đó.
    const primary = makeAssignment({
      id: 1,
      start_date: '2024-01-01',
      is_primary: true,
    });
    const listIdDesc = [
      makeAssignment({ id: 3, start_date: '2024-12-01', is_primary: false }),
      makeAssignment({ id: 2, start_date: '2024-06-01', is_primary: false }),
      primary,
    ];
    const result = getCurrentAssignment(listIdDesc);
    expect(result?.id).toBe(1);
    expect(result?.is_primary).toBe(true);
  });
});

const DEPARTMENTS: Department[] = [
  {
    id: 1,
    code: 'PB-KT',
    name: 'Phòng Kế toán',
    departmentType: 'phong_ban',
    orgUnitId: 3,
    orgUnitName: 'Chi Nhánh Hà Nội',
    parentId: null,
    managerId: null,
    active: true,
  },
  {
    id: 4,
    code: 'RND',
    name: 'Phòng R&D',
    departmentType: 'phong_ban',
    orgUnitId: 5,
    orgUnitName: 'Chi Nhánh Đà Nẵng',
    parentId: null,
    managerId: null,
    active: true,
  },
];

describe('getDeptOptionsForOrgUnit', () => {
  it('chưa chọn đơn vị → trả về TẤT CẢ phòng ban (giữ hành vi cũ khi orgUnitId=null)', () => {
    expect(getDeptOptionsForOrgUnit(DEPARTMENTS, null)).toHaveLength(2);
  });

  it('đã chọn đơn vị → chỉ trả về phòng ban thuộc đơn vị đó', () => {
    const result = getDeptOptionsForOrgUnit(DEPARTMENTS, 3);
    expect(result).toEqual([{ value: 1, label: 'Phòng Kế toán' }]);
  });

  it('đơn vị không có phòng ban nào → trả về rỗng', () => {
    expect(getDeptOptionsForOrgUnit(DEPARTMENTS, 999)).toEqual([]);
  });
});

describe('validateAssignmentDateRange (P1 — end_date >= start_date)', () => {
  it('end_date nhỏ hơn start_date → báo lỗi', () => {
    const start = dayjs('2026-06-15');
    const end = dayjs('2026-06-10');
    expect(validateAssignmentDateRange(start, end)).toBe(
      'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu',
    );
  });

  it('end_date bằng start_date → hợp lệ (khoảng effective 1 ngày)', () => {
    const same = dayjs('2026-06-15');
    expect(validateAssignmentDateRange(same, same)).toBeNull();
  });

  it('end_date lớn hơn start_date → hợp lệ', () => {
    const start = dayjs('2026-06-01');
    const end = dayjs('2026-06-30');
    expect(validateAssignmentDateRange(start, end)).toBeNull();
  });

  it('chưa chọn end_date (phân công không thời hạn) → hợp lệ, không báo lỗi', () => {
    expect(validateAssignmentDateRange(dayjs('2026-06-01'), null)).toBeNull();
    expect(
      validateAssignmentDateRange(dayjs('2026-06-01'), undefined),
    ).toBeNull();
  });

  it('chưa chọn start_date → không đủ dữ liệu để so sánh, không báo lỗi ở đây (rule required lo phần start_date)', () => {
    expect(validateAssignmentDateRange(null, dayjs('2026-06-01'))).toBeNull();
  });
});
