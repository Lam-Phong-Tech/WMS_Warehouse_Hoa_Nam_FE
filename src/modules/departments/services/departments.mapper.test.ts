import { describe, it, expect } from 'vitest';
import { remap, toPayload } from './departments.mapper';
import type { DepartmentFromApi } from './departments.mapper';
import type { DepartmentFormValues } from '../schemas/department.schema';

const MOCK_API_DEPT: DepartmentFromApi = {
  id: 1,
  code: 'DEPT_CODE',
  name: 'Dept Name',
  department_type: 'phong_ban',
  status: 1,
  org_unit_id: 10,
  org_unit: { id: 10, name: 'Org Unit Name' },
  parent_id: null,
  manager_employee_id: 20,
  manager: { id: 20, full_name: 'Manager Name' },
  description: 'A note',
  deleted_at: null,
  archived_at: null,
  restore_deadline: '2026-07-12T00:00:00Z',
};

const MOCK_CLIENT_DEPT = {
  id: 1,
  code: 'DEPT_CODE',
  name: 'Dept Name',
  departmentType: 'phong_ban',
  active: true,
  orgUnitId: 10,
  orgUnitName: 'Org Unit Name',
  parentId: null,
  managerId: 20,
  managerName: 'Manager Name',
  note: 'A note',
  employeeCount: undefined,
  deletedAt: null,
  archivedAt: null,
  restoreDeadline: '2026-07-12T00:00:00Z',
};

const MOCK_FORM_VALUES: DepartmentFormValues = {
  code: 'NEW_DEPT',
  name: 'New Department',
  orgUnitId: 10,
  departmentType: 'phong_ban',
  parentId: 1,
  managerId: 25,
  note: 'New note',
  active: true,
};

describe('departments.mapper', () => {
  describe('remap (API -> Client)', () => {
    it('should correctly map a full API response to the client model', () => {
      const result = remap(MOCK_API_DEPT);
      expect(result).toEqual(MOCK_CLIENT_DEPT);
    });

    it('should handle null or undefined fields gracefully', () => {
      const incompleteApiDept: DepartmentFromApi = {
        id: 2,
        code: 'INCOMPLETE',
        name: 'Incomplete Dept',
        status: 0,
      };

      const result = remap(incompleteApiDept);

      expect(result).toEqual({
        id: 2,
        code: 'INCOMPLETE',
        name: 'Incomplete Dept',
        departmentType: 'phong_ban',
        active: false,
        orgUnitId: 0,
        orgUnitName: '',
        parentId: null,
        managerId: null,
        managerName: undefined,
        note: undefined,
        employeeCount: undefined,
        deletedAt: undefined,
        restoreDeadline: undefined,
        archivedAt: undefined,
      });
    });

    it('should correctly map status 0 to active: false', () => {
      const result = remap({ ...MOCK_API_DEPT, status: 0 });
      expect(result.active).toBe(false);
    });

    it('should map employees_count from API to employeeCount', () => {
      const result = remap({ ...MOCK_API_DEPT, employees_count: 2 });
      expect(result.employeeCount).toBe(2);
    });
  });

  describe('toPayload (Client -> API)', () => {
    it('should correctly map form values to the API payload', () => {
      const result = toPayload(MOCK_FORM_VALUES);
      expect(result).toEqual({
        code: 'NEW_DEPT',
        name: 'New Department',
        department_type: 'phong_ban',
        org_unit_id: 10,
        parent_id: 1,
        manager_employee_id: 25,
        description: 'New note',
        status: 1,
      });
    });

    it('should map active: false to status: 0', () => {
      const result = toPayload({ ...MOCK_FORM_VALUES, active: false });
      expect(result.status).toBe(0);
    });

    it('should map empty note to null description', () => {
      const result = toPayload({ ...MOCK_FORM_VALUES, note: '' });
      expect(result.description).toBeNull();
    });

    it('should map departmentType nhom_to kèm parent_id', () => {
      const result = toPayload({
        ...MOCK_FORM_VALUES,
        departmentType: 'nhom_to',
        parentId: 4,
      });
      expect(result.department_type).toBe('nhom_to');
      expect(result.parent_id).toBe(4);
    });
  });
});
