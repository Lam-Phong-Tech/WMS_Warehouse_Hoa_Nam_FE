import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';

// Define mock functions at the top level
const mockMutateCreateEmployee = vi.fn();
const mockMutateUpdateEmployee = vi.fn();
const mockMutateChangeEmployeeStatus = vi.fn();
const mockMutateCreateEmployeeAccount = vi.fn();
const mockMutateDeleteEmployee = vi.fn();
const mockMutateRestoreEmployee = vi.fn();
const mockMutateCreateAssignment = vi.fn();
const mockMutateImportEmployeesExcel = vi.fn();

vi.mock(
  '@/modules/employee-assignments/hooks/use-employee-assignments',
  () => ({
    useCreateAssignment: () => ({
      mutate: mockMutateCreateAssignment,
      mutateAsync: mockMutateCreateAssignment,
      isPending: false,
    }),
  }),
);

// Mocks must be registered before importing the component under test
vi.mock('@/modules/employees/hooks/use-employees', () => ({
  useEmployees: vi.fn(),
  useEmployeeList: vi.fn(),
  // P0.9/trash view: EmployeesPage cũng gọi song song danh sách đã xóa mềm
  // để phục vụ chế độ xem "Thùng rác" — mock rỗng, không dùng trong các test
  // hiện có (không test chế độ trash view).
  useEmployeeTrashedList: () => ({
    data: { data: [], meta: { total: 0 } },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useEmployeeAssignments: () => ({ data: [] }),
  useCreateEmployee: () => ({
    mutate: mockMutateCreateEmployee,
    // EmployeesPage tạo nhân sự atomic qua mutateAsync (await trực tiếp kết
    // quả để lấy id nhân sự vừa tạo trước khi gọi tiếp API assignment) —
    // xem comment "P0 FIX" trong EmployeesPage.tsx.
    mutateAsync: mockMutateCreateEmployee,
    isPending: false,
  }),
  useUpdateEmployee: () => ({
    mutate: mockMutateUpdateEmployee,
    isPending: false,
  }),
  useChangeEmployeeStatus: () => ({
    mutate: mockMutateChangeEmployeeStatus,
    isPending: false,
  }),
  useCreateEmployeeAccount: () => ({
    mutate: mockMutateCreateEmployeeAccount,
    isPending: false,
  }),
  useDeleteEmployee: () => ({
    mutate: mockMutateDeleteEmployee,
    // EmployeesPage rollback (tạo employee thành công nhưng gán assignment
    // thất bại) dùng `await deleteEmployee.mutateAsync(id)` để soft-delete
    // employee vừa tạo — mock phải hỗ trợ cả 2 API như react-query thật.
    mutateAsync: mockMutateDeleteEmployee,
    isPending: false,
  }),
  useRestoreEmployee: () => ({
    mutate: mockMutateRestoreEmployee,
    isPending: false,
  }),
  useImportEmployeesExcel: () => ({
    mutate: mockMutateImportEmployeesExcel,
    isPending: false,
  }),
}));

// Mock confirmDialog to auto-confirm
vi.mock('@/shared/components/feedback/ConfirmDialog', () => ({
  confirmDialog: ({ onOk }: { onOk: () => void }) => {
    onOk();
  },
}));

vi.mock('@/modules/org-units/hooks/use-org-units', () => ({
  useOrgUnits: () => ({ data: [] }),
}));

vi.mock('@/modules/departments/hooks/use-departments', () => ({
  useDepartments: () => ({ data: [] }),
}));

vi.mock('@/modules/positions/hooks/use-positions', () => ({
  usePositions: () => ({ data: [] }),
}));

vi.mock('@/modules/employees/components/EmployeeFormModal', () => ({
  EmployeeFormModal: ({
    open,
    onSubmit,
  }: {
    open: boolean;
    onSubmit: (values: Record<string, unknown>) => void;
  }) => {
    if (!open) return null;
    return (
      <button
        data-testid="submit-employee-form"
        onClick={() =>
          onSubmit({
            fullName: 'Test Employee',
            email: 'test@company.com',
            phone: '0987654321',
            gender: 1,
            birthday: null,
            cccd: '123456789012',
            address: 'Hà Nội',
            orgUnitId: 1,
            departmentId: 1,
            positionId: 1,
            managerId: 1,
            hireDate: null,
            active: true,
            employeeStatus: 2,
            password: 'matkhau123',
          })
        }
      >
        Submit
      </button>
    );
  },
}));

vi.mock('@/modules/employees/components/EmployeeStatusModal', () => ({
  EmployeeStatusModal: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (payload: Record<string, unknown>) => void;
  }) => {
    if (!open) return null;
    return (
      <div>
        <button
          data-testid="confirm-suspend-status"
          onClick={() =>
            onConfirm({
              employeeStatus: 4, // RESIGNED
              effectiveDate: '2026-07-01',
              note: 'Nghỉ việc theo nguyện vọng',
            })
          }
        >
          Confirm Suspend
        </button>
        <button
          data-testid="confirm-reactivate-status"
          onClick={() =>
            onConfirm({
              employeeStatus: 2, // OFFICIAL
              effectiveDate: '2026-07-01',
              note: 'Tái kích hoạt',
            })
          }
        >
          Confirm Reactivate
        </button>
      </div>
    );
  },
}));

import { EmployeesPage } from './EmployeesPage';
import type { EmployeeListParams } from '@/modules/employees/services/employees.service';

// ---------------------------------------------------------------------------
// jsdom shims
// ---------------------------------------------------------------------------

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const { useEmployees, useEmployeeList } =
  await import('@/modules/employees/hooks/use-employees');

const MOCK_EMPLOYEES = [
  {
    id: 1,
    code: 'NV001',
    fullName: 'Nguyen Van A',
    email: 'a@company.vn',
    phone: '0901000001',
    status: 1,
    employeeStatus: 2,
    gender: 0,
    assignments: [
      {
        id: 1,
        org_unit_id: 1,
        department_id: 1,
        position_id: 1,
        is_primary: true,
        status: 1,
      },
    ],
  },
  {
    id: 2,
    code: 'NV002',
    fullName: 'Tran Thi B',
    email: 'b@company.vn',
    phone: '0901000002',
    status: 1,
    employeeStatus: 4,
    gender: 1,
    assignments: [],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withPermissions(codes: string[]) {
  useAuthStore.setState({
    permissionCodes: codes,
    isSuperAdmin: false,
    isProfileLoaded: true,
  });
}

/**
 * ActionDropdown (antd Dropdown) đôi khi không mở kịp trong lần click đầu do
 * timing của rc-trigger dưới jsdom — click lại tới khi menu item xuất hiện.
 */
async function openActionMenuItem(trigger: HTMLElement, itemName: RegExp) {
  await waitFor(
    async () => {
      fireEvent.click(trigger);
      const item = await waitFor(
        () => screen.getByRole('menuitem', { name: itemName, hidden: true }),
        { timeout: 200 },
      );
      expect(item).toBeInTheDocument();
    },
    { timeout: 3000, interval: 300 },
  );
  return screen.getByRole('menuitem', { name: itemName, hidden: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmployeesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(useEmployees).mockReset();
    vi.mocked(useEmployees).mockReturnValue({
      data: MOCK_EMPLOYEES,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployees>);

    vi.mocked(useEmployeeList).mockReset();
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);

    withPermissions([
      'EMP_VIEW',
      'EMP_CREATE',
      'EMP_EDIT',
      'EMP_STATUS',
      'EMP_EXPORT',
    ]);
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('hien thi trang thai loading', () => {
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    renderWithProviders(<EmployeesPage />);
    expect(screen.getByText(/đang tải/i)).toBeInTheDocument();
  });

  it('hien thi empty state khi khong co nhan su', () => {
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    renderWithProviders(<EmployeesPage />);
    expect(screen.getByText(/chưa có nhân sự/i)).toBeInTheDocument();
  });

  it('hien thi nut Them nhan su khi co quyen EMP_CREATE', () => {
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    renderWithProviders(<EmployeesPage />);
    expect(screen.getAllByText(/thêm nhân sự/i).length).toBeGreaterThan(0);
  });

  it('an nut Them khi khong co quyen EMP_CREATE', () => {
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    withPermissions(['EMP_VIEW']);
    renderWithProviders(<EmployeesPage />);
    expect(screen.queryByText(/thêm nhân sự/i)).not.toBeInTheDocument();
  });

  it('render bang nhan su khi co du lieu', async () => {
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: MOCK_EMPLOYEES, meta: { total: MOCK_EMPLOYEES.length } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    renderWithProviders(<EmployeesPage />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(await screen.findByText('NV001')).toBeInTheDocument();
    expect(await screen.findByText('NV002')).toBeInTheDocument();
  });

  it('khong co nut Xoa trong bang khi khong co quyen EMP_INACTIVE', async () => {
    withPermissions([
      'EMP_VIEW',
      'EMP_CREATE',
      'EMP_EDIT',
      'EMP_STATUS',
      'EMP_EXPORT',
    ]);
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: MOCK_EMPLOYEES, meta: { total: MOCK_EMPLOYEES.length } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    renderWithProviders(<EmployeesPage />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText(/^Xoá$|^Xóa$/)).not.toBeInTheDocument();
  });

  it('hien thi nut Xoa trong bang khi co quyen EMP_INACTIVE', async () => {
    withPermissions([
      'EMP_VIEW',
      'EMP_CREATE',
      'EMP_EDIT',
      'EMP_STATUS',
      'EMP_INACTIVE',
      'EMP_EXPORT',
    ]);
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: MOCK_EMPLOYEES, meta: { total: MOCK_EMPLOYEES.length } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    const { unmount } = renderWithProviders(<EmployeesPage />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    // Should have 2 action dropdowns (one for each employee), each with a Xóa item
    const actionTriggers = await screen.findAllByTitle('Thao tác');
    expect(actionTriggers.length).toBe(2);
    const deleteItem = await openActionMenuItem(actionTriggers[0], /xóa/i);
    expect(deleteItem).toBeInTheDocument();

    unmount();
  });

  it('goi ham xoa khi nhan nut Xoa va xac nhan', async () => {
    withPermissions([
      'EMP_VIEW',
      'EMP_CREATE',
      'EMP_EDIT',
      'EMP_STATUS',
      'EMP_INACTIVE',
      'EMP_EXPORT',
    ]);
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: MOCK_EMPLOYEES, meta: { total: MOCK_EMPLOYEES.length } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);

    renderWithProviders(<EmployeesPage />);

    // Mở dropdown thao tác của nhân sự đầu tiên rồi click "Xóa"
    // (confirmDialog được mock để tự động gọi onOk, không cần xác nhận thêm)
    const actionTrigger = (await screen.findAllByTitle('Thao tác'))[0];
    const deleteBtn = await openActionMenuItem(actionTrigger, /xóa/i);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockMutateDeleteEmployee).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      );
    });
  });

  it('loc keyword chi hien nhan su khop', async () => {
    vi.mocked(useEmployeeList).mockImplementation(
      (params?: EmployeeListParams) => {
        const keyword = params?.keyword?.toLowerCase();
        const filtered = keyword
          ? MOCK_EMPLOYEES.filter(
              (e) =>
                e.fullName.toLowerCase().includes(keyword) ||
                e.code.toLowerCase().includes(keyword),
            )
          : MOCK_EMPLOYEES;
        return {
          data: { data: filtered, meta: { total: filtered.length } },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        } as unknown as ReturnType<typeof useEmployeeList>;
      },
    );
    renderWithProviders(<EmployeesPage />);
    const searchInput = screen.getByPlaceholderText(/tìm tên/i);
    await userEvent.type(searchInput, 'NV001');
    expect(await screen.findByText('NV001')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('NV002')).not.toBeInTheDocument();
    });
  });

  it('P1.3: hien thi nut Xuat Excel', async () => {
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: MOCK_EMPLOYEES, meta: { total: MOCK_EMPLOYEES.length } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    renderWithProviders(<EmployeesPage />);
    expect(await screen.findByText(/xuất excel/i)).toBeInTheDocument();
  });

  it('P0.7: nut Doi TT khong bi disable khi nhan su da Nghi viec (status=4) de cho phep tai kich hoat', async () => {
    withPermissions([
      'EMP_VIEW',
      'EMP_CREATE',
      'EMP_EDIT',
      'EMP_STATUS',
      'EMP_EXPORT',
    ]);
    vi.mocked(useEmployeeList).mockReturnValue({
      data: { data: MOCK_EMPLOYEES, meta: { total: MOCK_EMPLOYEES.length } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);
    renderWithProviders(<EmployeesPage />);
    await screen.findByRole('table');
    // NV002 co employeeStatus=4 (Nghi viec) -> Doi TT khong bi disabled
    const actionTriggers = await screen.findAllByTitle('Thao tác');
    const changeStatusItem = await openActionMenuItem(
      actionTriggers[1],
      /đổi tt/i,
    );
    expect(changeStatusItem).toHaveAttribute('aria-disabled', 'false');
  });

  describe('RBAC evidence: nut "Dieu chuyen" theo quyen EMP_ASSIGNMENT_CREATE', () => {
    beforeEach(() => {
      vi.mocked(useEmployeeList).mockReturnValue({
        data: { data: MOCK_EMPLOYEES, meta: { total: MOCK_EMPLOYEES.length } },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useEmployeeList>);
    });

    it('hien thi nut Dieu chuyen khi user co quyen EMP_ASSIGNMENT_CREATE', async () => {
      withPermissions([
        'EMP_VIEW',
        'EMP_EDIT',
        'EMP_STATUS',
        'EMP_ASSIGNMENT_CREATE',
      ]);
      renderWithProviders(<EmployeesPage />);
      await screen.findByRole('table');

      const actionTriggers = await screen.findAllByTitle('Thao tác');
      const transferItem = await openActionMenuItem(
        actionTriggers[0],
        /điều chuyển/i,
      );
      expect(transferItem).toBeInTheDocument();
    });

    it('an nut Dieu chuyen khi user KHONG co quyen EMP_ASSIGNMENT_CREATE', async () => {
      // User HR co quyen sua/doi trang thai nhung khong co quyen tao dieu
      // chuyen — nut "Dieu chuyen" phai bi an hoan toan (default deny).
      withPermissions(['EMP_VIEW', 'EMP_EDIT', 'EMP_STATUS']);
      renderWithProviders(<EmployeesPage />);
      await screen.findByRole('table');

      const actionTriggers = await screen.findAllByTitle('Thao tác');
      fireEvent.click(actionTriggers[0]);
      expect(
        screen.queryByRole('menuitem', {
          name: /điều chuyển/i,
          hidden: true,
        }),
      ).not.toBeInTheDocument();
      // "Sửa" va "Đổi TT" van con vi user co quyen EMP_EDIT/EMP_STATUS —
      // chung minh day la loc theo tung quyen, khong phai an het dropdown.
      expect(
        screen.getByRole('menuitem', { name: /sửa/i, hidden: true }),
      ).toBeInTheDocument();
    });

    it('nut Doi TT (EMP_STATUS) van hien thi doc lap voi quyen Dieu chuyen', async () => {
      withPermissions(['EMP_VIEW', 'EMP_STATUS']);
      renderWithProviders(<EmployeesPage />);
      await screen.findByRole('table');

      const actionTriggers = await screen.findAllByTitle('Thao tác');
      const changeStatusItem = await openActionMenuItem(
        actionTriggers[0],
        /đổi tt/i,
      );
      expect(changeStatusItem).toBeInTheDocument();
    });

    it('user chi co EMP_VIEW: khong thay nut Dieu chuyen lan Doi TT trong bang', async () => {
      withPermissions(['EMP_VIEW']);
      renderWithProviders(<EmployeesPage />);
      await screen.findByRole('table');

      // Khong con action nao (Sua/Dieu chuyen/Doi TT/Xoa) duoc phep ->
      // ActionDropdown tra ve null, khong con nut "Thao tác" nao trong bang.
      expect(screen.queryAllByTitle('Thao tác')).toHaveLength(0);
    });
  });

  describe('P0.9: M9 Account Flow Integration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should create employee + account atomically via password in payload (no separate create-account modal)', async () => {
      // BE tạo tài khoản atomic ngay trong POST /employees khi có `password`
      // (xác minh thật 2026-07-05) — không còn bước 2 gọi riêng
      // POST /employees/{id}/account như luồng cũ. EmployeesPage dùng
      // `await createEmployee.mutateAsync(payload)` (không truyền options,
      // không callback onSuccess) nên mock phải trả về 1 Promise.
      mockMutateCreateEmployee.mockImplementation(async () => ({
        id: 99,
        code: 'NV099',
        fullName: 'Test Employee',
        user_id: 5,
        account_status: 1,
      }));

      renderWithProviders(<EmployeesPage />);

      // Open the modal
      const addBtn = screen.getAllByText(/thêm nhân sự/i)[0];
      addBtn.click();

      // Click the mock submit button (wait for it to render)
      const submitBtn = await screen.findByTestId('submit-employee-form');
      submitBtn.click();

      await waitFor(() => {
        expect(mockMutateCreateEmployee).toHaveBeenCalledTimes(1);
      });

      // password đã có trong payload gửi lên POST /employees
      expect(mockMutateCreateEmployee.mock.calls[0][0]).toMatchObject({
        password: 'matkhau123',
      });

      // Không mở lại modal cấp tài khoản riêng nữa, không gọi createAccount API
      expect(
        screen.queryByText('Cấp tài khoản đăng nhập'),
      ).not.toBeInTheDocument();
      expect(mockMutateCreateEmployeeAccount).not.toHaveBeenCalled();

      // Flush pending microtasks to avoid act warnings and state pollution
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    });

    it('should call usersService.inactive when an employee is suspended or resigned', async () => {
      const { usersService } =
        await import('@/modules/users/services/users.service');
      const spyInactive = vi
        .spyOn(usersService, 'inactive')
        .mockResolvedValue(undefined);

      // Set mock employee with user_id and active account
      const employeeWithUser = {
        ...MOCK_EMPLOYEES[0],
        user_id: 10,
        accountStatus: 1, // Active
      };

      withPermissions([
        'EMP_VIEW',
        'EMP_CREATE',
        'EMP_EDIT',
        'EMP_STATUS',
        'EMP_EXPORT',
      ]);
      vi.mocked(useEmployeeList).mockReturnValue({
        data: { data: [employeeWithUser], meta: { total: 1 } },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useEmployeeList>);

      mockMutateChangeEmployeeStatus.mockImplementation((_, options) => {
        options?.onSuccess?.();
      });

      renderWithProviders(<EmployeesPage />);

      await screen.findByRole('table');
      const actionTrigger = (await screen.findAllByTitle('Thao tác'))[0];
      const statusBtn = await openActionMenuItem(actionTrigger, /đổi tt/i);
      fireEvent.click(statusBtn);

      const confirmBtn = await screen.findByTestId('confirm-suspend-status');
      confirmBtn.click();

      await waitFor(() => {
        expect(mockMutateChangeEmployeeStatus).toHaveBeenCalledTimes(1);
        expect(spyInactive).toHaveBeenCalledWith(10, {
          reason: 'Nghỉ việc theo nguyện vọng',
          effective_date: '2026-07-01',
        });
      });

      // Flush pending microtasks to avoid act warnings and state pollution
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    });

    it('should call usersService.restore when a suspended/resigned employee is reactivated', async () => {
      const { usersService } =
        await import('@/modules/users/services/users.service');
      const spyRestore = vi
        .spyOn(usersService, 'restore')
        .mockResolvedValue(undefined);

      // Set mock employee with user_id and disabled account (status = RESIGNED)
      const resignedEmployee = {
        ...MOCK_EMPLOYEES[1], // Tran Thi B (employeeStatus = 4 - RESIGNED)
        user_id: 20,
        accountStatus: 0, // Disabled
      };

      withPermissions([
        'EMP_VIEW',
        'EMP_CREATE',
        'EMP_EDIT',
        'EMP_STATUS',
        'EMP_EXPORT',
      ]);
      vi.mocked(useEmployeeList).mockReturnValue({
        data: { data: [resignedEmployee], meta: { total: 1 } },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useEmployeeList>);

      mockMutateChangeEmployeeStatus.mockImplementation((_, options) => {
        options?.onSuccess?.();
      });

      renderWithProviders(<EmployeesPage />);

      await screen.findByRole('table');
      const actionTrigger = (await screen.findAllByTitle('Thao tác'))[0];
      const statusBtn = await openActionMenuItem(actionTrigger, /đổi tt/i);
      fireEvent.click(statusBtn);

      const confirmBtn = await screen.findByTestId('confirm-reactivate-status');
      confirmBtn.click();

      await waitFor(() => {
        expect(mockMutateChangeEmployeeStatus).toHaveBeenCalledTimes(1);
        expect(spyRestore).toHaveBeenCalledWith(20);
      });

      // Flush pending microtasks to avoid act warnings and state pollution
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    });
  });

  describe('P1: Create Employee + Assignment rollback on failure', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('rolls back (soft-deletes) the newly created employee when assignment creation fails', async () => {
      mockMutateCreateEmployee.mockImplementation(async () => ({
        id: 99,
        code: 'NV099',
        fullName: 'Test Employee',
      }));
      mockMutateCreateAssignment.mockImplementation(async () => {
        throw new Error('Assignment API failed');
      });
      mockMutateDeleteEmployee.mockImplementation(async () => undefined);

      renderWithProviders(<EmployeesPage />);

      const addBtn = screen.getAllByText(/thêm nhân sự/i)[0];
      addBtn.click();

      const submitBtn = await screen.findByTestId('submit-employee-form');
      submitBtn.click();

      await waitFor(() => {
        expect(mockMutateCreateEmployee).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(mockMutateCreateAssignment).toHaveBeenCalledTimes(1);
      });

      // Employee vừa tạo phải được rollback (soft-delete) vì gán assignment thất bại
      await waitFor(() => {
        expect(mockMutateDeleteEmployee).toHaveBeenCalledWith(99);
      });

      // Không được toast success khi rollback xảy ra
      expect(screen.queryByText(/đã thêm nhân sự/i)).not.toBeInTheDocument();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    });

    it('falls back to opening the edit modal when rollback delete also fails', async () => {
      mockMutateCreateEmployee.mockImplementation(async () => ({
        id: 100,
        code: 'NV100',
        fullName: 'Test Employee Two',
      }));
      mockMutateCreateAssignment.mockImplementation(async () => {
        throw new Error('Assignment API failed');
      });
      mockMutateDeleteEmployee.mockImplementation(async () => {
        throw new Error('Delete API failed');
      });

      renderWithProviders(<EmployeesPage />);

      const addBtn = screen.getAllByText(/thêm nhân sự/i)[0];
      addBtn.click();

      const submitBtn = await screen.findByTestId('submit-employee-form');
      submitBtn.click();

      await waitFor(() => {
        expect(mockMutateDeleteEmployee).toHaveBeenCalledWith(100);
      });

      // Rollback thất bại → phải giữ lại đường thoát "Sửa ngay" cho user xử lý thủ công.
      // FE retry rollback 3 lần với backoff (500ms/1000ms) trước khi coi là thất bại hẳn.
      await waitFor(
        () => {
          expect(
            screen.getByText(/hoàn tác tự động cũng thất bại/i),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    });
  });
});
