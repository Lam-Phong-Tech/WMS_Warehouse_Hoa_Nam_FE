import { screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import {
  DepartmentFormModal,
  type DepartmentFormModalProps,
} from './DepartmentFormModal';
import type { Employee } from '@/modules/employees/types/employees.types';
import type { Department } from '@/modules/departments/types/departments.types';
import { departmentsService } from '@/modules/departments/services/departments.service';

vi.mock('@/modules/departments/services/departments.service', () => ({
  departmentsService: {
    generateCode: vi.fn(),
  },
}));

// jsdom shims
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({ matches: false })),
});

const MOCK_ORG_UNITS = [
  { value: 1, label: 'Đơn vị 1' },
  { value: 2, label: 'Đơn vị 2' },
];

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 10,
    code: 'NV01',
    fullName: 'Nguyễn Văn Active',
    status: 1, // Active
    employeeStatus: 2, // Official
    phone: null,
    email: 'active@erp.com',
    assignments: [
      {
        id: 1,
        employee_id: 10,
        org_unit_id: 1,
        department_id: 0, // No department
        position_id: 1,
        is_primary: true,
        status: 1,
      },
    ],
  },
  {
    id: 11,
    code: 'NV02',
    fullName: 'Trần Thị Resigned',
    status: 1,
    employeeStatus: 4, // Resigned
    phone: null,
    email: 'resigned@erp.com',
    assignments: [
      {
        id: 2,
        employee_id: 11,
        org_unit_id: 1,
        department_id: 0,
        position_id: 1,
        is_primary: true,
        status: 1,
      },
    ],
  },
  {
    id: 12,
    code: 'NV03',
    fullName: 'Lê Văn OtherOrg',
    status: 1,
    employeeStatus: 2,
    phone: null,
    email: 'other@erp.com',
    assignments: [
      {
        id: 3,
        employee_id: 12,
        org_unit_id: 2, // Different Org Unit
        department_id: 0,
        position_id: 1,
        is_primary: true,
        status: 1,
      },
    ],
  },
  {
    id: 13,
    code: 'NV04',
    fullName: 'Phạm Văn OtherDept',
    status: 1,
    employeeStatus: 2,
    phone: null,
    email: 'otherdept@erp.com',
    assignments: [
      {
        id: 4,
        employee_id: 13,
        org_unit_id: 1,
        department_id: 99, // Belongs to another department
        position_id: 1,
        is_primary: true,
        status: 1,
      },
    ],
  },
];

const MOCK_DEPARTMENTS: Department[] = [
  {
    id: 100,
    code: 'PB-KT',
    name: 'Phòng Kế toán',
    departmentType: 'phong_ban',
    orgUnitId: 1,
    orgUnitName: 'Đơn vị 1',
    parentId: null,
    managerId: null,
    active: true,
  },
  {
    id: 101,
    code: 'NT-THUE',
    name: 'Tổ Thuế',
    departmentType: 'nhom_to',
    orgUnitId: 1,
    orgUnitName: 'Đơn vị 1',
    parentId: 100,
    managerId: null,
    active: true,
  },
  {
    id: 102,
    code: 'PB-KD',
    name: 'Phòng Kinh doanh',
    departmentType: 'phong_ban',
    orgUnitId: 2,
    orgUnitName: 'Đơn vị 2',
    parentId: null,
    managerId: null,
    active: true,
  },
  {
    id: 103,
    code: 'PB-NGUNG',
    name: 'Phòng Ngừng hoạt động',
    departmentType: 'phong_ban',
    orgUnitId: 1,
    orgUnitName: 'Đơn vị 1',
    parentId: null,
    managerId: null,
    active: false,
  },
];

const onSubmit = vi.fn();
const onCancel = vi.fn();

const BASE_PROPS: DepartmentFormModalProps = {
  open: true,
  editing: null,
  allDepartments: MOCK_DEPARTMENTS,
  employees: MOCK_EMPLOYEES,
  employeesLoading: false,
  orgUnitOptions: MOCK_ORG_UNITS,
  orgUnitsLoading: false,
  isPending: false,
  onCancel,
  onSubmit,
};

function renderModal(props?: Partial<DepartmentFormModalProps>) {
  return renderWithProviders(
    <DepartmentFormModal {...BASE_PROPS} {...props} />,
  );
}

describe('DepartmentFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(departmentsService.generateCode).mockResolvedValue('AUTO01');
  });

  it('P2: generate-code lỗi → fallback mã rỗng, không crash form', async () => {
    vi.mocked(departmentsService.generateCode).mockRejectedValue(
      new Error('network error'),
    );
    const onGeneratingCode = vi.fn();

    renderModal({ onGeneratingCode });

    await waitFor(() => {
      expect(onGeneratingCode).toHaveBeenCalledWith(false);
    });

    const codeInput = screen.getByPlaceholderText('Mã sẽ được tự động tạo');
    expect(codeInput).toHaveValue('');

    // P1: sau khi generate-code lỗi, form phải cho nhập mã thủ công + có link "Thử lại"
    expect(codeInput).toBeEnabled();
    const retryLink = await screen.findByText('Thử lại');
    expect(retryLink).toBeInTheDocument();

    fireEvent.change(codeInput, { target: { value: 'MANUAL01' } });
    expect(codeInput).toHaveValue('MANUAL01');

    vi.mocked(departmentsService.generateCode).mockResolvedValue('AUTO02');
    fireEvent.click(retryLink);
    await waitFor(() => {
      expect(codeInput).toHaveValue('AUTO02');
    });
  });

  it('P1.2: Lọc danh sách trưởng phòng theo nhân sự active, cùng đơn vị và không thuộc phòng ban khác', async () => {
    renderModal();

    // Select Org Unit 1
    const orgSelect = screen.getByText('Chọn đơn vị...');
    fireEvent.mouseDown(orgSelect);
    const option1 = await screen.findByText('Đơn vị 1');
    fireEvent.click(option1);

    // Open Manager dropdown (now enabled and showing 'Tìm nhân sự...')
    const managerSelect = screen.getByText('Tìm nhân sự...');
    fireEvent.mouseDown(managerSelect);

    // Should show Nguyễn Văn Active (active, same org, no department)
    expect(await screen.findByText('Nguyễn Văn Active')).toBeInTheDocument();

    // Should NOT show Trần Thị Resigned (resigned)
    expect(screen.queryByText('Trần Thị Resigned')).not.toBeInTheDocument();

    // Should NOT show Lê Văn OtherOrg (different org)
    expect(screen.queryByText('Lê Văn OtherOrg')).not.toBeInTheDocument();

    // Should show Phạm Văn OtherDept (belongs to department 99 but in the same Org Unit)
    expect(screen.getByText('Phạm Văn OtherDept')).toBeInTheDocument();
  });

  it('P2.5: Map lỗi từ API (apiErrors) xuống các trường trong form', async () => {
    const { rerender } = renderModal({ apiErrors: null });

    // `apiErrors` luôn là output của `extractFieldErrors()` (api-error.ts) — đã
    // snake_case → camelCase trước khi tới đây (org_unit_id → orgUnitId,
    // manager_employee_id → managerEmployeeId). Dùng đúng key camelCase để test
    // phản ánh contract thật, tránh lặp lại bug field bị rơi mất trong im lặng.
    rerender(
      <DepartmentFormModal
        {...BASE_PROPS}
        apiErrors={{
          code: 'Mã phòng ban không hợp lệ',
          name: 'Tên phòng ban không hợp lệ',
          orgUnitId: 'Đơn vị trực thuộc không hợp lệ',
          managerEmployeeId: 'Trưởng phòng không hợp lệ',
          description: 'Mô tả quá dài',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Mã phòng ban không hợp lệ')).toBeInTheDocument();
      expect(
        screen.getByText('Tên phòng ban không hợp lệ'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Đơn vị trực thuộc không hợp lệ'),
      ).toBeInTheDocument();
      expect(screen.getByText('Trưởng phòng không hợp lệ')).toBeInTheDocument();
      expect(screen.getByText('Mô tả quá dài')).toBeInTheDocument();
    });
  });

  describe('WF-03: Nhóm/tổ + Phòng ban cha', () => {
    it('chỉ hiện field "Phòng ban cha" khi chọn loại Nhóm/tổ', async () => {
      renderModal();

      expect(screen.queryByText(/Phòng ban cha/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Nhóm/tổ'));

      expect(await screen.findByText(/Phòng ban cha/)).toBeInTheDocument();
    });

    it('lọc "Phòng ban cha" theo đơn vị trực thuộc và chỉ gồm phòng ban (không phải nhóm/tổ)', async () => {
      renderModal();

      // Chọn đơn vị 1 trước
      const orgSelect = screen.getByText('Chọn đơn vị...');
      fireEvent.mouseDown(orgSelect);
      fireEvent.click(await screen.findByText('Đơn vị 1'));

      fireEvent.click(screen.getByText('Nhóm/tổ'));

      const parentSelect = await screen.findByText('Chọn phòng ban cha...');
      fireEvent.mouseDown(parentSelect);

      // Chỉ phòng ban cùng đơn vị 1 (PB-KT), không có nhóm/tổ (NT-THUE) hay khác đơn vị (PB-KD)
      expect(
        await screen.findByText(/PB-KT/, {}, { timeout: 15000 }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/NT-THUE/)).not.toBeInTheDocument();
      expect(screen.queryByText(/PB-KD/)).not.toBeInTheDocument();
    });

    it('loại phòng ban cha đang ngừng hoạt động khỏi danh sách chọn', async () => {
      renderModal();

      const orgSelect = screen.getByText('Chọn đơn vị...');
      fireEvent.mouseDown(orgSelect);
      fireEvent.click(await screen.findByText('Đơn vị 1'));

      fireEvent.click(screen.getByText('Nhóm/tổ'));

      const parentSelect = await screen.findByText('Chọn phòng ban cha...');
      fireEvent.mouseDown(parentSelect);

      // Cùng đơn vị 1, cùng loại phòng ban nhưng đang ngừng hoạt động → không được chọn làm cha
      expect(
        await screen.findByText(/PB-KT/, {}, { timeout: 15000 }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/PB-NGUNG/)).not.toBeInTheDocument();
    });

    it('báo lỗi validation khi tạo Nhóm/tổ mà không chọn Phòng ban cha', async () => {
      renderModal();

      const orgSelect = screen.getByText('Chọn đơn vị...');
      fireEvent.mouseDown(orgSelect);
      fireEvent.click(await screen.findByText('Đơn vị 1'));

      fireEvent.click(screen.getByText('Nhóm/tổ'));

      const nameInput = screen.getByPlaceholderText('Ví dụ: Phòng Kế toán');
      fireEvent.change(nameInput, { target: { value: 'Tổ mới' } });

      const okButton = screen.getByRole('button', { name: /Lưu|OK|Thêm/i });
      fireEvent.click(okButton);

      expect(
        await screen.findByText('Nhóm/tổ phải thuộc về một phòng ban cha'),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
