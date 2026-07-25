import { describe, it, expect } from 'vitest';
import {
  getDescendantIds,
  getValidParentDeptOptions,
} from './department.helpers';
import type { Department } from '../types/departments.types';

const MOCK_DEPTS: Department[] = [
  {
    id: 1,
    name: 'Ban Giám đốc',
    departmentType: 'phong_ban',
    orgUnitId: 10,
    parentId: null,
    managerId: null,
    active: true,
    code: 'BOD',
    orgUnitName: 'Công ty A',
  },
  {
    id: 2,
    name: 'Phòng Kế toán',
    departmentType: 'phong_ban',
    orgUnitId: 10,
    parentId: 1,
    managerId: null,
    active: true,
    code: 'ACC',
    orgUnitName: 'Công ty A',
  },
  {
    id: 3,
    name: 'Phòng Nhân sự',
    departmentType: 'phong_ban',
    orgUnitId: 10,
    parentId: 1,
    managerId: null,
    active: true,
    code: 'HR',
    orgUnitName: 'Công ty A',
  },
  {
    id: 4,
    name: 'Tổ tính lương',
    departmentType: 'nhom_to',
    orgUnitId: 10,
    parentId: 2,
    managerId: null,
    active: false,
    code: 'PAY',
    orgUnitName: 'Công ty A',
  },
  {
    id: 5,
    name: 'Phòng Marketing',
    departmentType: 'phong_ban',
    orgUnitId: 20,
    parentId: null,
    managerId: null,
    active: true,
    code: 'MKT',
    orgUnitName: 'Công ty B',
  },
];

describe('getDescendantIds', () => {
  it('should return an empty set for a leaf node', () => {
    const result = getDescendantIds(MOCK_DEPTS, 4);
    expect(result.size).toBe(0);
  });

  it('should return all descendants for a root node', () => {
    const result = getDescendantIds(MOCK_DEPTS, 1);
    expect(result).toEqual(new Set([2, 3, 4]));
  });

  it('should return direct and indirect descendants', () => {
    const result = getDescendantIds(MOCK_DEPTS, 2);
    expect(result).toEqual(new Set([4]));
  });

  it('should not include the rootId itself', () => {
    const result = getDescendantIds(MOCK_DEPTS, 1);
    expect(result.has(1)).toBe(false);
  });
});

describe('getValidParentDeptOptions (P1.1)', () => {
  it('should return an empty array if currentOrgUnitId is null', () => {
    const result = getValidParentDeptOptions(MOCK_DEPTS, null, null);
    expect(result).toEqual([]);
  });

  it('should only show departments from the same org unit', () => {
    const result = getValidParentDeptOptions(MOCK_DEPTS, 10, null);
    const orgUnitIds = result.map(
      (opt) => MOCK_DEPTS.find((d) => d.id === opt.value)?.orgUnitId,
    );
    expect(orgUnitIds.every((id) => id === 10)).toBe(true);
    expect(result.some((opt) => opt.label.includes('Marketing'))).toBe(false);
  });

  it('should exclude the editing department itself', () => {
    const editingDept = MOCK_DEPTS.find((d) => d.id === 2)!; // Phòng Kế toán
    const result = getValidParentDeptOptions(MOCK_DEPTS, 10, editingDept);
    expect(result.some((opt) => opt.value === 2)).toBe(false);
  });

  it('should exclude all descendants of the editing department', () => {
    const editingDept = MOCK_DEPTS.find((d) => d.id === 2)!; // Phòng Kế toán
    const result = getValidParentDeptOptions(MOCK_DEPTS, 10, editingDept);
    // Tổ tính lương (id: 4) is a descendant of Phòng Kế toán
    expect(result.some((opt) => opt.value === 4)).toBe(false);
  });

  it('should disable and label inactive departments', () => {
    // In this mock, there are no other inactive depts in orgUnit 10 to be a parent.
    // Let's modify the mock.
    const localMock = [...MOCK_DEPTS];
    localMock.push({
      id: 6,
      name: 'Phòng Test Inactive',
      departmentType: 'phong_ban',
      orgUnitId: 10,
      parentId: null,
      managerId: null,
      active: false,
      code: 'TEST',
      orgUnitName: 'Công ty A',
    });

    const resultWithInactive = getValidParentDeptOptions(localMock, 10, null);
    const inactiveOpt = resultWithInactive.find((opt) => opt.value === 6);
    expect(inactiveOpt).toBeDefined();
    expect(inactiveOpt?.disabled).toBe(true);
    expect(inactiveOpt?.label).toContain('(Ngừng hoạt động)');
  });
});
