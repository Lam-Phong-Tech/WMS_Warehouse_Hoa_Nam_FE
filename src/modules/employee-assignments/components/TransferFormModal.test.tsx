import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { TransferFormModal } from './TransferFormModal';
import type { EmployeeAssignment } from '../hooks/use-employee-assignments';
import type { Employee } from '@/modules/employees/types/employees.types';
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';
import type { Department } from '@/modules/departments/types/departments.types';
import type { Position } from '@/modules/positions/types/positions.types';

const mockMutateAsyncCreate = vi.fn();
const mockMutateAsyncUpdate = vi.fn();
const mockUseEmployeeAssignments = vi.fn();

vi.mock('../hooks/use-employee-assignments', async () => {
  const actual = await vi.importActual<
    typeof import('../hooks/use-employee-assignments')
  >('../hooks/use-employee-assignments');
  return {
    ...actual,
    useEmployeeAssignments: (...args: unknown[]) =>
      mockUseEmployeeAssignments(...args),
    useCreateAssignment: () => ({
      mutateAsync: mockMutateAsyncCreate,
      isPending: false,
    }),
    useUpdateAssignment: () => ({
      mutateAsync: mockMutateAsyncUpdate,
      isPending: false,
    }),
  };
});

const employees: Employee[] = [
  {
    id: 1,
    code: 'NV001',
    fullName: 'Nguyễn Văn A',
    email: 'a@test.com',
    phone: '0987654321',
    status: 1,
    employeeStatus: 2,
    gender: 1,
    birthday: '1990-01-01',
    cccd: '123456789',
    address: 'Hà Nội',
    hireDate: '2020-01-01',
    manager_id: null,
    user_id: null,
    accountStatus: 1,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2020-01-01T00:00:00Z',
    managerName: null,
    assignments: [],
    primaryAssignment: undefined,
  },
];

const orgUnits: OrgUnit[] = [{ id: 10, name: 'Chi nhánh Hà Nội' } as OrgUnit];
const departments: Department[] = [
  { id: 100, name: 'Phòng Kinh doanh', orgUnitId: 10 } as Department,
];
const positions: Position[] = [{ id: 1000, name: 'Nhân viên' } as Position];

const currentAssignment: EmployeeAssignment = {
  id: 1,
  employee_id: 1,
  org_unit_id: 10,
  department_id: 100,
  position_id: 1000,
  is_primary: true,
  start_date: '2020-01-01',
  end_date: null,
  status: true,
};

function renderModal(
  props: Partial<Parameters<typeof TransferFormModal>[0]> = {},
) {
  return renderWithProviders(
    <TransferFormModal
      open={true}
      editing={null}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      employees={employees}
      orgUnits={orgUnits}
      departments={departments}
      positions={positions}
      {...props}
    />,
  );
}

/**
 * Chọn nhân sự trong combobox "Nhân sự" (index 0). Chỉ chọn field này vì đây
 * là field duy nhất mà state cục bộ (`selectedEmployeeId`) không bị effect
 * đồng bộ hoá của TransferFormModal ghi đè ngay lập tức trong môi trường
 * test — mock `Form.useForm()` ở src/test/setup.ts trả một instance mới mỗi
 * lần render (không ổn định như antd thật), khiến effect phụ thuộc `form`
 * chạy lại và reset các state khác (org/step) mỗi khi component re-render.
 * Vì vậy các tương tác nhiều tầng (đơn vị → phòng ban, bước xác nhận) không
 * kiểm chứng đáng tin cậy ở mức unit test này — cần test path thủ công/E2E.
 */
function selectEmployee(fullNameOptionText: string) {
  const combobox = screen.getAllByRole('combobox')[0];
  fireEvent.mouseDown(combobox);
  const listbox = document.querySelector('[role="listbox"]') as HTMLElement;
  fireEvent.click(
    Array.from(listbox.querySelectorAll('[role="option"]')).find((el) =>
      el.textContent?.includes(fullNameOptionText),
    ) as HTMLElement,
  );
}

describe('TransferFormModal', () => {
  beforeEach(() => {
    mockMutateAsyncCreate.mockReset();
    mockMutateAsyncUpdate.mockReset();
    mockUseEmployeeAssignments.mockReset();
    mockUseEmployeeAssignments.mockReturnValue({ data: { data: [] } });
  });

  it('P1 (BR-20): hiển thị phân công hiện tại khi nhân sự đã chọn có assignment active', () => {
    mockUseEmployeeAssignments.mockReturnValue({
      data: { data: [currentAssignment] },
    });
    renderModal();

    selectEmployee('Nguyễn Văn A');

    expect(screen.getByText('Phân công hiện tại')).toBeInTheDocument();
    expect(screen.getByText(/Chi nhánh Hà Nội/)).toBeInTheDocument();
  });

  it('không hiển thị phân công hiện tại khi nhân sự chưa có assignment active', () => {
    mockUseEmployeeAssignments.mockReturnValue({ data: { data: [] } });
    renderModal();

    selectEmployee('Nguyễn Văn A');

    expect(screen.queryByText('Phân công hiện tại')).not.toBeInTheDocument();
  });

  it('hiển thị đúng tiêu đề cho chế độ tạo mới và chỉnh sửa', () => {
    const { unmount } = renderModal({ editing: null });
    expect(
      screen.getByText('Điều chuyển / phân công nhân sự'),
    ).toBeInTheDocument();
    unmount();

    renderModal({ editing: currentAssignment });
    expect(screen.getByText('Cập nhật phân công nhân sự')).toBeInTheDocument();
  });

  it('gọi onCancel khi bấm Hủy', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });

    fireEvent.click(screen.getByText('Hủy'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
