import { vi, describe, it, expect, beforeEach } from 'vitest';
import { http } from '@/shared/api/http';
import { employeesService } from './employees.service';

vi.mock('@/shared/api/http');

describe('employees.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('P0.8: listPaged', () => {
    it('should append all filter parameters to the query string', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: {},
      } as never);

      await employeesService.listPaged({
        page: 2,
        per_page: 20,
        keyword: 'test',
        org_unit_id: 1,
        department_id: 2,
        position_id: 3,
        employee_status: 'working',
        account_status: '1',
        include_assignments: true,
      });

      const callUrl = vi.mocked(http.getPage).mock.calls[0][0];
      expect(callUrl).toContain('page=2');
      expect(callUrl).toContain('per_page=20');
      expect(callUrl).toContain('keyword=test');
      expect(callUrl).toContain('org_unit_id=1');
      expect(callUrl).toContain('department_id=2');
      expect(callUrl).toContain('position_id=3');
      expect(callUrl).toContain('employee_status=working');
      // BE (swagger /api/documentation) dùng query key `status`, không phải
      // `account_status`, cho filter trạng thái tài khoản đăng nhập.
      expect(callUrl).toContain('status=1');
      expect(callUrl).not.toContain('account_status=');
      expect(callUrl).toContain('include%5B%5D=assignments');
    });

    it('P1.3: gửi sort_by/sort_order lên query string khi có sort', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: {},
      } as never);

      await employeesService.listPaged({
        sort_by: 'name',
        sort_order: 'desc',
      });

      const callUrl = vi.mocked(http.getPage).mock.calls[0][0];
      expect(callUrl).toContain('sort_by=name');
      expect(callUrl).toContain('sort_order=desc');
    });

    it('P1.3: không gửi sort_by/sort_order khi không truyền sort', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: {},
      } as never);

      await employeesService.listPaged({ page: 1 });

      const callUrl = vi.mocked(http.getPage).mock.calls[0][0];
      expect(callUrl).not.toContain('sort_by=');
      expect(callUrl).not.toContain('sort_order=');
    });
  });

  describe('P0.8: changeStatus', () => {
    // API doc thật (astrodev.test8.io.vn) không có PATCH /employees/{id}/status;
    // đổi trạng thái đi qua PUT /employees/{id} với employee_status/reason/effective_date.
    it('should call PUT /employees/{id} with employee_status, reason, effective_date', async () => {
      const payload = {
        employee_status: 4 as const, // RESIGNED
        effective_date: '2025-12-31',
        note: 'Nghỉ hưu',
      };

      vi.mocked(http.put).mockResolvedValue({ id: 1 } as never);

      await employeesService.changeStatus(123, payload);

      expect(http.put).toHaveBeenCalledOnce();
      expect(http.put).toHaveBeenCalledWith('/employees/123', {
        employee_status: 4,
        reason: 'Nghỉ hưu',
        effective_date: '2025-12-31',
      });
    });
  });
});
