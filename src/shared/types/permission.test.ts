import { describe, it, expect } from 'vitest';
import { PERMISSION_RULES, getPermissionCode } from './permission';

/**
 * Test này xác nhận PERMISSION_RULES map đúng mã quyền thật của BE
 * (xác minh qua GET /api/v1/permissions trên môi trường test 2026-07-09).
 * Mục tiêu: ngăn tái phạm bug "Mapping permission lệch catalog" — từng có
 * DEPT_DELETE/EMP_DELETE/POS_DELETE/ROLE_CREATE/ROLE_EDIT/ROLE_DELETE/
 * ROLE_EXPORT không tồn tại trong catalog, gây ActionButton/PermissionGuard
 * ẩn sai (check mã không tồn tại → luôn false → ẩn/block thao tác).
 *
 * Quy tắc cốt lõi:
 * - "Xóa" ở FE (xóa mềm / ngừng hoạt động) → mã *_INACTIVE của BE,
 *   KHÔNG PHẢI *_DELETE (mã *_DELETE là xóa vĩnh viễn).
 * - roles: BE chỉ có ROLE_VIEW + ROLE_MANAGE (+ ROLE_ASSIGN) → mọi action
 *   create/edit/delete/approve/export đều map về ROLE_MANAGE.
 */
describe('PERMISSION_RULES khớp catalog BE (BA Module 1)', () => {
  it('departments: delete → DEPT_INACTIVE (không phải DEPT_DELETE)', () => {
    expect(PERMISSION_RULES.departments.delete).toBe('DEPT_INACTIVE');
    expect(PERMISSION_RULES.departments.view).toBe('DEPT_VIEW');
    expect(PERMISSION_RULES.departments.create).toBe('DEPT_CREATE');
    expect(PERMISSION_RULES.departments.edit).toBe('DEPT_EDIT');
    expect(PERMISSION_RULES.departments.export).toBe('DEPT_EXPORT');
  });

  it('employees: delete → EMP_INACTIVE (không phải EMP_DELETE)', () => {
    expect(PERMISSION_RULES.employees.delete).toBe('EMP_INACTIVE');
    expect(PERMISSION_RULES.employees.view).toBe('EMP_VIEW');
    expect(PERMISSION_RULES.employees.create).toBe('EMP_CREATE');
    expect(PERMISSION_RULES.employees.edit).toBe('EMP_EDIT');
    expect(PERMISSION_RULES.employees.export).toBe('EMP_EXPORT');
    expect(PERMISSION_RULES.employees.import).toBe('EMP_IMPORT');
  });

  it('positions: delete → POS_INACTIVE (không phải POS_DELETE)', () => {
    expect(PERMISSION_RULES.positions.delete).toBe('POS_INACTIVE');
    expect(PERMISSION_RULES.positions.view).toBe('POS_VIEW');
    expect(PERMISSION_RULES.positions.create).toBe('POS_CREATE');
    expect(PERMISSION_RULES.positions.edit).toBe('POS_EDIT');
    expect(PERMISSION_RULES.positions.export).toBe('POS_EXPORT');
  });

  it('roles: mọi action → ROLE_MANAGE (không có ROLE_CREATE/EDIT/DELETE/EXPORT)', () => {
    expect(PERMISSION_RULES.roles.view).toBe('ROLE_VIEW');
    expect(PERMISSION_RULES.roles.create).toBe('ROLE_MANAGE');
    expect(PERMISSION_RULES.roles.edit).toBe('ROLE_MANAGE');
    expect(PERMISSION_RULES.roles.delete).toBe('ROLE_MANAGE');
    expect(PERMISSION_RULES.roles.approve).toBe('ROLE_MANAGE');
    expect(PERMISSION_RULES.roles.export).toBe('ROLE_MANAGE');
  });

  it('employee_status: action → EMP_STATUS', () => {
    expect(PERMISSION_RULES.employee_status.create).toBe('EMP_STATUS');
    expect(PERMISSION_RULES.employee_status.edit).toBe('EMP_STATUS');
    expect(PERMISSION_RULES.employee_status.delete).toBe('EMP_STATUS');
  });

  it('warehouses: delete → WAREHOUSE_INACTIVE (không có WAREHOUSE_DELETE)', () => {
    expect(PERMISSION_RULES.warehouses.delete).toBe('WAREHOUSE_INACTIVE');
    expect(PERMISSION_RULES.warehouses.view).toBe('WAREHOUSE_VIEW');
    expect(PERMISSION_RULES.warehouses.create).toBe('WAREHOUSE_CREATE');
    expect(PERMISSION_RULES.warehouses.edit).toBe('WAREHOUSE_EDIT');
  });

  it('warehouses: restore → WAREHOUSE_RESTORE (mã riêng, xác nhận qua API thật 2026-07-15)', () => {
    expect(PERMISSION_RULES.warehouses.restore).toBe('WAREHOUSE_RESTORE');
  });

  it('org_units: delete → ORG_INACTIVE (không phải ORG_FORCE_DELETE — P1 FIX)', () => {
    // "Xóa" ở FE (xóa mềm / ngừng hoạt động) là ORG_INACTIVE.
    // ORG_FORCE_DELETE chỉ dùng permissionCode trực tiếp cho archive.
    expect(PERMISSION_RULES.org_units.delete).toBe('ORG_INACTIVE');
    expect(PERMISSION_RULES.org_units.view).toBe('ORG_VIEW');
    expect(PERMISSION_RULES.org_units.create).toBe('ORG_CREATE');
    expect(PERMISSION_RULES.org_units.edit).toBe('ORG_EDIT');
    expect(PERMISSION_RULES.org_units.export).toBe('ORG_EXPORT');
  });

  it('getPermissionCode trả đúng mã catalog cho action+module', () => {
    expect(getPermissionCode('delete', 'departments')).toBe('DEPT_INACTIVE');
    expect(getPermissionCode('delete', 'employees')).toBe('EMP_INACTIVE');
    expect(getPermissionCode('delete', 'positions')).toBe('POS_INACTIVE');
    expect(getPermissionCode('delete', 'org_units')).toBe('ORG_INACTIVE');
    expect(getPermissionCode('create', 'roles')).toBe('ROLE_MANAGE');
    expect(getPermissionCode('edit', 'roles')).toBe('ROLE_MANAGE');
  });

  it('getPermissionCode ưu tiên customCode', () => {
    expect(
      getPermissionCode('delete', 'departments', 'DEPT_FORCE_DELETE'),
    ).toBe('DEPT_FORCE_DELETE');
  });

  it('không còn mã không tồn tại trong catalog', () => {
    const forbidden = [
      'DEPT_DELETE',
      'EMP_DELETE',
      'POS_DELETE',
      'ROLE_CREATE',
      'ROLE_EDIT',
      'ROLE_DELETE',
      'ROLE_EXPORT',
      'WAREHOUSE_DELETE',
      'WAREHOUSE_APPROVE',
    ];
    const allCodes = Object.values(PERMISSION_RULES)
      .flatMap((m) => Object.values(m))
      .filter((c): c is string => typeof c === 'string');
    for (const bad of forbidden) {
      expect(allCodes).not.toContain(bad);
    }
  });
});
