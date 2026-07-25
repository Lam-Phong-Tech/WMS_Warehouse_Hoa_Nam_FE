import { vi, describe, it, expect, beforeEach } from 'vitest';
import { http } from '@/shared/api/http';
import { departmentsService } from './departments.service';
import type { DepartmentFormValues } from '../schemas/department.schema';
import type { Department, DepartmentType } from '../types/departments.types';

vi.mock('@/shared/api/http');

const MOCK_API_DEPT = {
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
};

const MOCK_CLIENT_DEPT = {
  id: 1,
  code: 'DEPT_CODE',
  name: 'Dept Name',
  departmentType: 'phong_ban' as DepartmentType,
  active: true,
  orgUnitId: 10,
  orgUnitName: 'Org Unit Name',
  parentId: null,
  managerId: 20,
  managerName: 'Manager Name',
  note: 'A note',
  deletedAt: null,
  archivedAt: null,
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

describe('departments.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('P0.7: remap (API -> Client)', () => {
    it('should correctly map API response to client model', () => {
      // This test directly accesses the un-exported `remap` function.
      // In a real scenario, you might test it through a public method like `getById`.
      vi.mocked(http.get).mockResolvedValue(MOCK_API_DEPT);

      // We test the public method which uses the private `remap`
      const promise = departmentsService.getById(1);

      expect(promise).resolves.toEqual(MOCK_CLIENT_DEPT);
    });

    it('should handle null or undefined fields gracefully', () => {
      const incompleteApiDept = {
        id: 2,
        code: 'INCOMPLETE',
        name: 'Incomplete Dept',
        status: 0,
      };
      vi.mocked(http.get).mockResolvedValue(incompleteApiDept);

      const promise = departmentsService.getById(2);

      expect(promise).resolves.toEqual({
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
        deletedAt: undefined,
        archivedAt: undefined,
        restoreDeadline: undefined,
        employeeCount: undefined,
      });
    });
  });

  describe('P0.7: toPayload (Client -> API)', () => {
    it('should correctly map form values to API payload', async () => {
      vi.mocked(http.post).mockResolvedValue(MOCK_API_DEPT);

      await departmentsService.create(MOCK_FORM_VALUES);

      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: 'NEW_DEPT',
          name: 'New Department',
          department_type: 'phong_ban',
          org_unit_id: 10,
          parent_id: 1,
          manager_employee_id: 25,
          description: 'New note',
          status: 1, // from active: true
        }),
      );
    });
  });

  // API doc thật (astrodev.test8.io.vn) không có PATCH /departments/{id}/inactive;
  // vô hiệu hóa/kích hoạt lại đi qua PUT /departments/{id}. BE validate PUT y hệt
  // POST (org_unit_id/department_type/name bắt buộc) — xác nhận qua lỗi 422 thực
  // tế khi chỉ gửi { status } — nên phải gửi kèm toàn bộ dữ liệu phòng ban hiện có.
  describe('P0.2: inactive/activate service call', () => {
    const DEPT: Department = {
      ...MOCK_CLIENT_DEPT,
      id: 123,
      code: 'DEPT_CODE',
      name: 'Dept Name',
      orgUnitId: 10,
      parentId: null,
      managerId: 20,
      note: 'A note',
    };

    it('inactive gửi PUT /departments/{id} kèm đủ field + status=0', async () => {
      vi.mocked(http.put).mockResolvedValue(MOCK_API_DEPT);

      await departmentsService.inactive(DEPT);

      expect(http.put).toHaveBeenCalledOnce();
      expect(http.put).toHaveBeenCalledWith('/departments/123', {
        org_unit_id: 10,
        code: 'DEPT_CODE',
        department_type: 'phong_ban',
        name: 'Dept Name',
        parent_id: null,
        manager_employee_id: 20,
        description: 'A note',
        status: 0,
      });
    });

    it('activate gửi PUT /departments/{id} kèm đủ field + status=1', async () => {
      vi.mocked(http.put).mockResolvedValue(MOCK_API_DEPT);

      await departmentsService.activate(DEPT);

      expect(http.put).toHaveBeenCalledOnce();
      expect(http.put).toHaveBeenCalledWith('/departments/123', {
        org_unit_id: 10,
        code: 'DEPT_CODE',
        department_type: 'phong_ban',
        name: 'Dept Name',
        parent_id: null,
        manager_employee_id: 20,
        description: 'A note',
        status: 1,
      });
    });
  });

  describe('P0.2: soft-delete / restore / force-delete service call', () => {
    it('softDelete gửi DELETE /departments/{id}/soft-delete', async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined);

      await departmentsService.softDelete(123);

      expect(http.delete).toHaveBeenCalledWith('/departments/123/soft-delete');
    });

    it('restore gửi PATCH /departments/{id}/restore', async () => {
      vi.mocked(http.patch).mockResolvedValue(MOCK_API_DEPT);

      await departmentsService.restore(123);

      expect(http.patch).toHaveBeenCalledWith(
        '/departments/123/restore',
        undefined,
      );
    });

    it('forceDelete gửi DELETE /departments/{id}/force-delete', async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined);

      await departmentsService.forceDelete(123);

      expect(http.delete).toHaveBeenCalledWith('/departments/123/force-delete');
    });
  });

  describe('P1: listPaged map đúng query param theo contract thật (limit/q, không phải per_page/keyword)', () => {
    it('map per_page->limit và keyword->q', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [MOCK_API_DEPT],
        meta: { total: 1, current_page: 1, per_page: 15, last_page: 1 },
      });

      await departmentsService.listPaged({
        page: 2,
        per_page: 50,
        keyword: 'test',
        org_unit_id: 3,
        status: 1,
      });

      expect(http.getPage).toHaveBeenCalledWith(
        '/departments?page=2&limit=50&q=test&org_unit_id=3&status=1',
      );
    });

    it('không gửi per_page hay keyword lên query string', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: { total: 0, current_page: 1, per_page: 15, last_page: 1 },
      });

      await departmentsService.listPaged({ per_page: 20, keyword: 'search' });

      const calledUrl = vi.mocked(http.getPage).mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('per_page=');
      expect(calledUrl).not.toContain('keyword=');
    });

    it('P1.3: gửi sort_by/sort_order lên query string khi có sort', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: { total: 0, current_page: 1, per_page: 15, last_page: 1 },
      });

      await departmentsService.listPaged({
        sort_by: 'name',
        sort_order: 'asc',
      });

      const calledUrl = vi.mocked(http.getPage).mock.calls[0][0] as string;
      expect(calledUrl).toContain('sort_by=name');
      expect(calledUrl).toContain('sort_order=asc');
    });

    it('P1.3: không gửi sort_by/sort_order khi không truyền sort', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: { total: 0, current_page: 1, per_page: 15, last_page: 1 },
      });

      await departmentsService.listPaged({ page: 1 });

      const calledUrl = vi.mocked(http.getPage).mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('sort_by=');
      expect(calledUrl).not.toContain('sort_order=');
    });
  });
});
