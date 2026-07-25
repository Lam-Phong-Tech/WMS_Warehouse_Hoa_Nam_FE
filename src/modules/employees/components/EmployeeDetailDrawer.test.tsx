import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer';
import { App } from 'antd';
import type { Employee } from '@/modules/employees/types/employees.types';

// Define a mock function at the top level so it is mockable
const mockUseCreateEmployeeAccount = vi.fn();

vi.mock('@/modules/employees/hooks/use-employees', () => ({
  useCreateEmployeeAccount: () => mockUseCreateEmployeeAccount(),
}));

// Mock usePermission để trả về can=true (super admin) — tránh phụ thuộc authStore
vi.mock('@/shared/hooks/usePermission', () => ({
  usePermission: () => ({
    can: true,
    mode: 'hide',
    isHidden: false,
    isDisabled: false,
    permissionCode: '',
  }),
  useCanAll: () => true,
  useCanAny: () => true,
}));

const mockEmployee: Employee = {
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
  accountStatus: null, // No account yet
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2020-01-01T00:00:00Z',
  managerName: 'Trưởng Phòng B',
  assignments: [
    {
      id: 1,
      employee_id: 1,
      status: 1,
      org_unit_id: 1,
      department_id: 1,
      position_id: 1,
      is_primary: true,
      org_unit: { id: 1, name: 'Đơn vị A' },
      department: { id: 1, name: 'Phòng ban B' },
      position: { id: 1, name: 'Chức danh C' },
    },
  ],
  primaryAssignment: undefined,
};

describe('EmployeeDetailDrawer', () => {
  it('P2.5: should render employee details and primary assignment', () => {
    mockUseCreateEmployeeAccount.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    renderWithProviders(
      <App>
        <EmployeeDetailDrawer
          open={true}
          employee={mockEmployee}
          onClose={vi.fn()}
        />
      </App>,
    );

    // Drawer title combines code and name (rendered as separate text nodes)
    expect(screen.getByText('NV001')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trưởng Phòng B')).toBeInTheDocument();
    expect(screen.getByText('Chưa cấp tài khoản')).toBeInTheDocument();
    expect(screen.getByText('Đơn vị A')).toBeInTheDocument();
    expect(screen.getByText('Phòng ban B')).toBeInTheDocument();
  });

  it('P2.5: should trigger account creation mutation on button click', async () => {
    const mockMutate = vi.fn();
    mockUseCreateEmployeeAccount.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    renderWithProviders(
      <App>
        <EmployeeDetailDrawer
          open={true}
          employee={mockEmployee}
          onClose={vi.fn()}
        />
      </App>,
    );

    const user = userEvent.setup();
    // Click the "Cấp tài khoản" link/button to open the modal
    const createBtn = screen.getByText('Cấp tài khoản');
    expect(createBtn).toBeInTheDocument();
    await user.click(createBtn);

    // Modal cấp tài khoản mở ra — theo BA doc BR-CR-11, BE tự sinh mật khẩu
    // ngẫu nhiên, không cần nhập password
    const accountModalTitle = await screen.findByText(
      'Cấp tài khoản đăng nhập',
    );
    expect(accountModalTitle).toBeInTheDocument();

    // Click nút "Cấp tài khoản" trong modal (BE tự sinh password)
    const accountModal = accountModalTitle.closest(
      '[role="dialog"]',
    ) as HTMLElement;
    await user.click(
      within(accountModal).getByRole('button', { name: 'Cấp tài khoản' }),
    );

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({ id: 1 }, expect.any(Object));
  });
});
