import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  remap,
  toEmployeePayload,
  type EmployeeFromApi,
} from './employee.mapper';
import type { EmployeeFormValues } from '@/modules/employees/schemas/employee.schema';
import { EmployeeStatus } from '@/modules/employees/types/employees.types';

describe('employee.mapper', () => {
  describe('remap', () => {
    const BASE: EmployeeFromApi = {
      id: 1,
      code: 'NV001',
      full_name: 'Nguyễn Văn A',
      phone: '0987654321',
      email: 'a@example.com',
      status: 1,
      employee_status: 2,
      user_id: 6,
      account_status: 1,
    };

    it('should read accountStatus from nested user.status when present (source of truth)', () => {
      // BE denormalized `account_status` không đồng bộ khi disable/restore qua
      // PUT /users/{id} (xác minh thật 2026-07-05) — `user.status` mới đúng.
      const employee = remap({
        ...BASE,
        account_status: 1, // stale — BE chưa đồng bộ sau khi disable
        user: { id: 6, email: 'a@example.com', status: 0 }, // trạng thái thật
      });
      expect(employee.accountStatus).toBe(0);
    });

    it('should fall back to top-level account_status when user is absent', () => {
      const employee = remap({ ...BASE, account_status: 1, user: undefined });
      expect(employee.accountStatus).toBe(1);
    });
  });

  describe('toEmployeePayload', () => {
    const MOCK_FORM_VALUES: EmployeeFormValues = {
      code: 'NV001',
      fullName: 'Nguyễn Văn A',
      email: 'a@example.com',
      phone: '0987654321',
      gender: 1,
      birthday: dayjs('2000-01-15'),
      cccd: '123456789012',
      personalTaxCode: '',
      address: 'Hà Nội',
      orgUnitId: 1,
      departmentId: 2,
      positionId: 3,
      managerId: 4,
      hireDate: dayjs('2024-01-01'),
      active: true,
      employeeStatus: EmployeeStatus.OFFICIAL,
    };

    it('should correctly map form values to API payload', () => {
      const payload = toEmployeePayload(MOCK_FORM_VALUES);

      // org_unit_id/department_id/position_id không được gửi: BE bỏ qua các field
      // này trên /employees (xác minh thật 2026-07-05) — phải tạo qua
      // /employee-assignments riêng (xem EmployeesPage.handleSubmit).
      expect(payload).toEqual({
        code: 'NV001',
        full_name: 'Nguyễn Văn A',
        email: 'a@example.com',
        phone: '0987654321',
        gender: 1,
        birthday: '2000-01-15',
        cccd: '123456789012',
        personal_tax_code: null,
        address: 'Hà Nội',
        manager_id: 4,
        hire_date: '2024-01-01',
        status: 1,
        employee_status: EmployeeStatus.OFFICIAL,
      });
    });

    it('should map active: false to status: 0', () => {
      const payload = toEmployeePayload({ ...MOCK_FORM_VALUES, active: false });
      expect(payload.status).toBe(0);
    });

    it('should map empty optional fields to null or undefined', () => {
      const payload = toEmployeePayload({
        ...MOCK_FORM_VALUES,
        phone: '',
        address: '',
        managerId: null,
      });
      expect(payload.phone).toBeNull();
      expect(payload.address).toBeNull();
      expect(payload.manager_id).toBeNull();
    });

    it('should include password when creating (atomic account creation)', () => {
      const payload = toEmployeePayload({
        ...MOCK_FORM_VALUES,
        password: 'matkhau123',
      });
      expect(payload.password).toBe('matkhau123');
    });

    it('should not send password when not provided (edit mode)', () => {
      const payload = toEmployeePayload(MOCK_FORM_VALUES);
      expect(payload.password).toBeUndefined();
    });
  });
});
