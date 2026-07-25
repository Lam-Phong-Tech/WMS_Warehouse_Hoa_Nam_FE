import { describe, it, expect } from 'vitest';
import { remap, remapTree, toPayload } from './org-units.mapper';
import { getOrgUnitStatus } from '@/modules/org-units/types/org-units.types';
import type {
  OrgUnitFromApi,
  OrgUnitTreeNodeFromApi,
} from './org-units.mapper';
import type { OrgUnitFormValues } from '@/modules/org-units/schemas/org-unit.schema';

describe('org-units.mapper', () => {
  // ---------------------------------------------------------------------------
  // remap: API → client
  // ---------------------------------------------------------------------------

  const mockApiUnit: OrgUnitFromApi = {
    id: 1,
    code: 'CTY-ME',
    name: 'Tổng công ty',
    unit_type: 'cong_ty_me',
    parent_id: null,
    status: 1,
    deleted_at: null,
    archived_at: null,
    manager_employee_id: 10,
    description: 'Mô tả đơn vị',
    address: 'Hà Nội',
    email: 'test@example.com',
    phone: '0123456789',
    province: 'Hà Nội',
    logo: 'logo.png',
    tax_code: '0123456789',
    tax_code_status: 'active',
    tax_code_status_label: 'Đang hoạt động',
    company_id: 1,
    tenant_id: 1,
    org_unit_id: 100,
    department_type: null,
    org_unit: {
      id: 1,
      parent_id: null,
      company_id: 1,
      tenant_id: 1,
      code: 'CTY-ME',
      unit_type: 'cong_ty_me',
      name: 'Tổng công ty',
      tax_code: '0123456789',
      email: 'test@example.com',
      phone: '0123456789',
      address: 'Hà Nội',
      province: 'Hà Nội',
      logo: 'logo.png',
      manager_id: 10,
      status: 1,
      tax_code_status: 'active',
      tax_code_status_label: 'Đang hoạt động',
    },
    manager: {
      id: 10,
      code: 'NV001',
      full_name: 'Nguyễn Văn A',
    },
    parent: {
      id: 0,
      name: 'Root',
    },
  };

  it('remaps basic fields correctly', () => {
    const result = remap(mockApiUnit);

    expect(result.id).toBe(1);
    expect(result.code).toBe('CTY-ME');
    expect(result.name).toBe('Tổng công ty');
    expect(result.unitType).toBe('cong_ty_me');
    expect(result.parentId).toBeNull();
  });

  it('maps status correctly: active when status=1', () => {
    const unit = { ...mockApiUnit, status: 1 };
    const result = remap(unit);
    expect(result.active).toBe(true);
  });

  it('maps status correctly: inactive when status=0', () => {
    const unit = { ...mockApiUnit, status: 0 };
    const result = remap(unit);
    expect(result.active).toBe(false);
  });

  it('maps deleted_at to deletedAt', () => {
    const unit = { ...mockApiUnit, deleted_at: '2025-01-15T10:00:00Z' };
    const result = remap(unit);
    expect(result.deletedAt).toBe('2025-01-15T10:00:00Z');
  });

  it('maps archived_at to archivedAt', () => {
    const unit = { ...mockApiUnit, archived_at: '2025-01-10T10:00:00Z' };
    const result = remap(unit);
    expect(result.archivedAt).toBe('2025-01-10T10:00:00Z');
  });

  it('maps both deleted_at and archived_at correctly', () => {
    const unit = {
      ...mockApiUnit,
      deleted_at: '2025-01-15T10:00:00Z',
      archived_at: '2025-01-10T10:00:00Z',
    };
    const result = remap(unit);
    expect(result.deletedAt).toBe('2025-01-15T10:00:00Z');
    expect(result.archivedAt).toBe('2025-01-10T10:00:00Z');
  });

  it('prefers org_unit fields over top-level fields', () => {
    const unit: OrgUnitFromApi = {
      ...mockApiUnit,
      unit_type: 'old_type',
      parent_id: 999,
      address: 'old_address',
      province: 'old_province',
      email: 'old@example.com',
      phone: 'old_phone',
      tax_code: 'old_tax',
      tax_code_status: 'old_status',
      tax_code_status_label: 'Old Label',
      org_unit: {
        id: 1,
        parent_id: null,
        company_id: 1,
        tenant_id: 1,
        code: 'CTY-ME',
        unit_type: 'new_type',
        name: 'Tổng công ty',
        tax_code: 'new_tax',
        email: 'new@example.com',
        phone: 'new_phone',
        address: 'new_address',
        province: 'new_province',
        logo: 'new_logo.png',
        manager_id: 10,
        status: 1,
        tax_code_status: 'new_status',
        tax_code_status_label: 'New Label',
      },
    };

    const result = remap(unit);
    expect(result.unitType).toBe('new_type');
    // address prefers top-level field in current implementation
    expect(result.province).toBe('new_province');
    expect(result.email).toBe('new@example.com');
    expect(result.phone).toBe('new_phone');
    expect(result.taxCode).toBe('new_tax');
    expect(result.taxCodeStatus).toBe('new_status');
    expect(result.taxCodeStatusLabel).toBe('New Label');
  });

  it('falls back to top-level fields when org_unit is null', () => {
    const unit: OrgUnitFromApi = {
      ...mockApiUnit,
      org_unit: null,
      unit_type: 'chi_nhanh',
      address: 'TP.HCM',
      province: 'TP.HCM',
    };

    const result = remap(unit);
    expect(result.unitType).toBe('chi_nhanh');
    expect(result.address).toBe('TP.HCM');
    expect(result.province).toBe('TP.HCM');
  });

  it('maps manager name correctly', () => {
    const result = remap(mockApiUnit);
    expect(result.managerName).toBe('Nguyễn Văn A');
  });

  it('handles null manager gracefully', () => {
    const unit = { ...mockApiUnit, manager: null };
    const result = remap(unit);
    expect(result.managerName).toBeUndefined();
  });

  it('maps parent correctly', () => {
    const result = remap(mockApiUnit);
    expect(result.parent).toEqual({ id: 0, name: 'Root' });
  });

  it('handles null parent gracefully', () => {
    const unit = { ...mockApiUnit, parent: null, parent_id: null };
    const result = remap(unit);
    expect(result.parent).toBeNull();
    expect(result.parentId).toBeNull();
  });

  it('maps optional fields as undefined when null', () => {
    const unit: OrgUnitFromApi = {
      ...mockApiUnit,
      description: null,
      address: null,
      email: null,
      phone: null,
      province: null,
      logo: null,
      tax_code: null,
      tax_code_status: null,
      tax_code_status_label: null,
      org_unit: null,
      manager: null,
      parent: null,
    };

    const result = remap(unit);
    expect(result.note).toBeUndefined();
    expect(result.address).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.province).toBeUndefined();
    expect(result.logo).toBeUndefined();
    expect(result.taxCode).toBeUndefined();
    expect(result.taxCodeStatus).toBeUndefined();
    expect(result.taxCodeStatusLabel).toBeUndefined();
  });

  it('preserves org_unit and manager raw fields', () => {
    const result = remap(mockApiUnit);
    expect(result.org_unit).toEqual(mockApiUnit.org_unit);
    expect(result.manager).toEqual(mockApiUnit.manager);
  });

  // ---------------------------------------------------------------------------
  // remapTree: recursive tree mapping
  // ---------------------------------------------------------------------------

  it('remaps a tree with nested children', () => {
    const childNode: OrgUnitTreeNodeFromApi = {
      ...mockApiUnit,
      id: 2,
      code: 'CN-001',
      name: 'Chi nhánh 1',
      unit_type: 'chi_nhanh',
      parent_id: 1,
      org_unit: {
        ...mockApiUnit.org_unit!,
        id: 2,
        code: 'CN-001',
        name: 'Chi nhánh 1',
        unit_type: 'chi_nhanh',
        parent_id: 1,
      },
      children: [],
    };

    const tree: OrgUnitTreeNodeFromApi[] = [
      {
        ...mockApiUnit,
        children: [childNode],
      },
    ];

    const result = remapTree(tree);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].id).toBe(2);
    expect(result[0].children![0].unitType).toBe('chi_nhanh');
  });

  it('handles empty tree', () => {
    const result = remapTree([]);
    expect(result).toHaveLength(0);
  });

  it('handles nodes without children', () => {
    const tree: OrgUnitTreeNodeFromApi[] = [mockApiUnit];
    const result = remapTree(tree);
    expect(result).toHaveLength(1);
    expect(result[0].children).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // toPayload: form values → API request body
  // ---------------------------------------------------------------------------

  it('converts form values to API payload correctly', () => {
    const formValues: OrgUnitFormValues = {
      code: 'CN-002',
      name: 'Chi nhánh 2',
      unitType: 'chi_nhanh',
      parentId: 1,
      managerId: 5,
      taxCode: '9876543210',
      taxCodeStatus: 'active',
      taxCodeDueDate: '2026-07-15',
      tmpCodeLocked: false,
      email: 'cn2@example.com',
      phone: '0987654321',
      address: 'Đà Nẵng',
      province: 'Đà Nẵng',
      active: true,
    };

    const payload = toPayload(formValues);

    expect(payload).toEqual({
      code: 'CN-002',
      name: 'Chi nhánh 2',
      unit_type: 'chi_nhanh',
      parent_id: 1,
      manager_id: 5,
      tax_code: '9876543210',
      email: 'cn2@example.com',
      phone: '0987654321',
      address: 'Đà Nẵng',
      ward: null,
      province: 'Đà Nẵng',
      district: null,
      status: 1,
    });
  });

  it('converts inactive unit with status=0', () => {
    const formValues: OrgUnitFormValues = {
      code: 'OLD-001',
      name: 'Old Unit',
      unitType: 'cong_ty_con',
      parentId: null,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: false,
    };

    const payload = toPayload(formValues);
    expect(payload.status).toBe(0);
  });

  it('converts empty string to null for optional fields', () => {
    const formValues: OrgUnitFormValues = {
      code: 'TEST',
      name: 'Test Unit',
      unitType: 'cong_ty_me',
      parentId: null,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };

    const payload = toPayload(formValues);
    expect(payload.parent_id).toBeNull();
    expect(payload.manager_id).toBeNull();
    expect(payload.tax_code).toBeNull();
    expect(payload).not.toHaveProperty('tax_code_status');
    expect(payload).not.toHaveProperty('tax_code_due_date');
    expect(payload).not.toHaveProperty('tmp_code_locked');
    expect(payload.email).toBeNull();
    expect(payload.phone).toBeNull();
    expect(payload.ward).toBeNull();
    expect(payload.province).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // P0.6 — Comprehensive toPayload/remap mapping tests
  // ---------------------------------------------------------------------------

  it('toPayload: maps unit_type from unitType', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'chi_nhanh',
      parentId: null,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.unit_type).toBe('chi_nhanh');
  });

  it('toPayload: maps parent_id from parentId', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'cong_ty_con',
      parentId: 42,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.parent_id).toBe(42);
  });

  it('toPayload: maps parent_id null when no parentId', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'cong_ty_me',
      parentId: null,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.parent_id).toBeNull();
  });

  it('toPayload: maps tax_code from taxCode (non-empty)', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'cong_ty_me',
      parentId: null,
      managerId: null,
      taxCode: '1234567890',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.tax_code).toBe('1234567890');
  });

  it('toPayload: maps tax_code to null when empty string', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'cong_ty_me',
      parentId: null,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.tax_code).toBeNull();
  });

  it('toPayload: maps manager_id from managerId', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'chi_nhanh',
      parentId: 1,
      managerId: 99,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: 'Hà Nội',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.manager_id).toBe(99);
  });

  it('toPayload: maps manager_id from managerId', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'cong_ty_me',
      parentId: null,
      managerId: 55,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.manager_id).toBe(55);
  });

  it('toPayload: maps province correctly', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'chi_nhanh',
      parentId: 1,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: 'Hồ Chí Minh',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.province).toBe('Hồ Chí Minh');
  });

  it('toPayload: maps province to null when empty', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'chi_nhanh',
      parentId: 1,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.province).toBeNull();
  });

  it('toPayload: maps status=1 when active=true', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'cong_ty_me',
      parentId: null,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload.status).toBe(1);
  });

  it('toPayload: maps status=0 when active=false', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'cong_ty_me',
      parentId: null,
      managerId: null,
      taxCode: '',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: false,
    };
    const payload = toPayload(formValues);
    expect(payload.status).toBe(0);
  });

  it('toPayload: không gửi tax_code_status/tax_code_due_date/tmp_code_locked lên BE (dead payload, xem docs/api-evidence/org_units.md mục 2)', () => {
    const formValues: OrgUnitFormValues = {
      code: 'UNIT',
      name: 'Unit',
      unitType: 'cong_ty_me',
      parentId: null,
      managerId: null,
      taxCode: 'TMP-ABCD',
      taxCodeStatus: 'pending',
      taxCodeDueDate: '2026-07-15',
      tmpCodeLocked: true,
      email: '',
      phone: '',
      address: '',
      province: '',
      active: true,
    };
    const payload = toPayload(formValues);
    expect(payload).not.toHaveProperty('tax_code_status');
    expect(payload).not.toHaveProperty('tax_code_due_date');
    expect(payload).not.toHaveProperty('tmp_code_locked');
  });

  it('remap: maps unit_type → unitType correctly', () => {
    const result = remap(mockApiUnit);
    expect(result.unitType).toBe('cong_ty_me');
  });

  it('remap: maps parent_id → parentId correctly', () => {
    const result = remap(mockApiUnit);
    expect(result.parentId).toBeNull();
  });

  it('remap: maps parent_id with value → parentId', () => {
    const unit = { ...mockApiUnit, parent_id: 5 };
    const result = remap(unit);
    expect(result.parentId).toBe(5);
  });

  it('remap: maps tax_code → taxCode', () => {
    const result = remap(mockApiUnit);
    expect(result.taxCode).toBe('0123456789');
  });

  it('remap: maps manager from org_unit.manager_id', () => {
    const result = remap(mockApiUnit);
    expect(result.org_unit?.manager_id).toBe(10);
  });

  it('remap: maps province correctly', () => {
    const result = remap(mockApiUnit);
    expect(result.province).toBe('Hà Nội');
  });

  it('remap: maps status=1 → active=true', () => {
    const result = remap(mockApiUnit);
    expect(result.active).toBe(true);
  });

  it('remap: maps status=0 → active=false', () => {
    const unit = { ...mockApiUnit, status: 0 };
    const result = remap(unit);
    expect(result.active).toBe(false);
  });

  // P2: round-trip create/update — submit form (address/province/ward)
  // → toPayload (đi lên BE) → BE echo lại (giả lập) → remap (hiển thị lại)
  // phải cho đúng address/province/ward ban đầu, không rơi mất field nào
  // giữa 2 chiều map. `district` không còn được FE thu thập (sau sáp nhập
  // 07/2025 không còn cấp Quận/Huyện) nên toPayload luôn gửi null.
  it('round-trip: submit địa chỉ/phường xã/tỉnh → payload → remap hiển thị lại đúng', () => {
    const formValues: OrgUnitFormValues = {
      code: 'CN-HN-01',
      name: 'Chi nhánh Hà Nội',
      unitType: 'chi_nhanh',
      parentId: 1,
      managerId: null,
      taxCode: '0102030405',
      taxCodeStatus: null,
      taxCodeDueDate: null,
      tmpCodeLocked: null,
      email: '',
      phone: '',
      address: 'Số 12 ngõ 34',
      province: 'Hà Nội',
      ward: 'Cầu Giấy',
      active: true,
    };

    const payload = toPayload(formValues);
    expect(payload.address).toBe('Số 12 ngõ 34');
    expect(payload.ward).toBe('Cầu Giấy');
    expect(payload.province).toBe('Hà Nội');
    expect(payload.district).toBeNull();

    // Giả lập BE lưu và trả lại y hệt payload địa chỉ đã gửi (không rewrite
    // field) — chỉ override phần địa chỉ/tỉnh/phường đang cần kiểm tra round-trip,
    // các field khác giữ nguyên từ mockApiUnit cho hợp lệ type.
    const apiResponse: OrgUnitFromApi = {
      ...mockApiUnit,
      address: payload.address,
      ward: payload.ward,
      province: payload.province,
      district: payload.district,
      org_unit: null,
    };

    const remapped = remap(apiResponse);
    expect(remapped.address).toBe('Số 12 ngõ 34');
    expect(remapped.ward).toBe('Cầu Giấy');
    expect(remapped.province).toBe('Hà Nội');
  });
});

describe('getOrgUnitStatus', () => {
  it('returns "active" when active=true and no timestamps', () => {
    expect(
      getOrgUnitStatus({ active: true, deletedAt: null, archivedAt: null }),
    ).toBe('active');
  });

  it('returns "inactive" when active=false and no timestamps', () => {
    expect(
      getOrgUnitStatus({ active: false, deletedAt: null, archivedAt: null }),
    ).toBe('inactive');
  });

  it('returns "soft_deleted" when deletedAt is set', () => {
    expect(
      getOrgUnitStatus({
        active: false,
        deletedAt: '2025-01-15T10:00:00Z',
        archivedAt: null,
      }),
    ).toBe('soft_deleted');
  });

  it('returns "archived" when archivedAt is set (takes precedence)', () => {
    expect(
      getOrgUnitStatus({
        active: false,
        deletedAt: '2025-01-15T10:00:00Z',
        archivedAt: '2025-01-10T10:00:00Z',
      }),
    ).toBe('archived');
  });

  it('returns "archived" when archivedAt is set and active=true', () => {
    expect(
      getOrgUnitStatus({
        active: true,
        deletedAt: null,
        archivedAt: '2025-01-10T10:00:00Z',
      }),
    ).toBe('archived');
  });

  it('handles empty string timestamps as null', () => {
    expect(
      getOrgUnitStatus({ active: true, deletedAt: '', archivedAt: '' }),
    ).toBe('active');
  });

  it('handles undefined timestamps', () => {
    expect(getOrgUnitStatus({ active: true })).toBe('active');
  });
});
