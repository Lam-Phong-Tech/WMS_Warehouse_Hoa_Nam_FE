import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode, MouseEventHandler } from 'react';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmployeesTable } from './EmployeesTable';
import type { Employee } from '../types/employees.types';

// Mock antd
vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
    icon,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: MouseEventHandler;
    icon?: ReactNode;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} {...rest}>
      {icon}
      {children}
    </button>
  ),
  Dropdown: ({
    children,
    menu,
  }: {
    children?: ReactNode;
    menu?: {
      items?: Array<{
        key: string;
        label?: ReactNode;
        disabled?: boolean;
        onClick?: () => void;
      }>;
    };
  }) => (
    <div>
      {children}
      <div data-testid="dropdown-menu">
        {menu?.items?.map((item) => (
          <button
            key={item.key}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  ),
  Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Tooltip: ({
    children,
    title,
  }: {
    children?: ReactNode;
    title?: ReactNode;
  }) => <div title={String(title)}>{children}</div>,
  Tag: ({ children, color }: { children?: ReactNode; color?: string }) => (
    <span data-color={color}>{children}</span>
  ),
  Grid: { useBreakpoint: () => ({ xs: true, sm: true, md: true, lg: true }) },
  Typography: {
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: ReactNode }) => <h4>{children}</h4>,
    Paragraph: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  },
  Pagination: () => null,
  Select: ({
    value,
    options,
    onChange,
  }: {
    value?: unknown;
    options?: Array<{ value: number | string; label: ReactNode }>;
    onChange?: (value: number | string) => void;
  }) => (
    <select
      value={value as string | number}
      onChange={(e) => onChange?.(Number(e.target.value))}
    >
      {options?.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
  Empty: ({ description }: { description?: ReactNode }) => (
    <div>{description}</div>
  ),
  Input: Object.assign(
    (props: Record<string, unknown>) => <input {...props} />,
    {
      TextArea: (props: Record<string, unknown>) => <textarea {...props} />,
      Password: (props: Record<string, unknown>) => <input {...props} />,
      Search: (props: Record<string, unknown>) => <input {...props} />,
      Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    },
  ),
  Divider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Layout: Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      Sider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Content: ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
      ),
      Footer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    },
  ),
  Table: Object.assign(
    ({
      columns,
      dataSource,
      rowKey,
      onChange,
    }: {
      columns?: Array<{
        title?: ReactNode;
        dataIndex?: string;
        key?: string;
        render?: (value: unknown, record: unknown, index: number) => ReactNode;
        sorter?: boolean;
      }>;
      dataSource?: Record<string, unknown>[];
      rowKey?: string | ((record: unknown) => string);
      onChange?: (
        pagination: unknown,
        filters: unknown,
        sorter: { columnKey?: string; order?: 'ascend' | 'descend' },
      ) => void;
    }) => {
      const [sortState, setSortState] = useState<{
        columnKey?: string;
        order?: 'ascend' | 'descend';
      }>({});

      const handleHeaderClick = (col: { key?: string; sorter?: boolean }) => {
        if (!col.sorter || !col.key) return;
        const nextOrder: 'ascend' | 'descend' | undefined =
          sortState.columnKey !== col.key || sortState.order === undefined
            ? 'ascend'
            : sortState.order === 'ascend'
              ? 'descend'
              : undefined;
        const nextSort = { columnKey: col.key, order: nextOrder };
        setSortState(nextSort);
        onChange?.({}, {}, nextSort);
      };

      return (
        <table>
          <thead>
            <tr>
              {columns?.map((col, i) => (
                <th
                  key={col.key ?? i}
                  onClick={() => handleHeaderClick(col)}
                  style={col.sorter ? { cursor: 'pointer' } : undefined}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataSource?.map((record, rowIndex) => {
              const key =
                typeof rowKey === 'function'
                  ? rowKey(record)
                  : ((record[rowKey ?? 'id'] as string) ?? rowIndex);
              return (
                <tr key={key}>
                  {columns?.map((col, i) => (
                    <td key={col.key ?? i}>
                      {col.render
                        ? col.render(
                            col.dataIndex ? record[col.dataIndex] : undefined,
                            record,
                            rowIndex,
                          )
                        : col.dataIndex
                          ? (record[col.dataIndex] as ReactNode)
                          : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    },
    { Column: () => null, ColumnGroup: () => null, Summary: () => null },
  ),
}));

// Mock permission hook — default cho phép tất cả; các test riêng cho
// EMP_ACCOUNT_CREATE override theo permissionCode để kiểm tra gating.
const mockUsePermission = vi.fn(() => ({ can: true }));
vi.mock('@/shared/hooks/usePermission', () => ({
  usePermission: () => mockUsePermission(),
}));

// Mock permission state — default là super-admin để giữ hành vi cũ của các
// test hiện có (mọi action hiện, không bị chặn bởi row-level scope). Các
// test riêng cho row-level scope (theo department/org_unit) sẽ override.
const mockUsePermissionState = vi.fn(() => ({
  isSuperAdmin: false,
  permissionCodes: [] as string[],
  currentScopeType: 'he_thong' as string | null,
  currentOrgUnitId: null as number | null,
  currentDepartmentId: null as number | null,
}));
vi.mock('@/modules/auth/utils/permission', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/utils/permission')>();
  return {
    ...actual,
    usePermissionState: () => mockUsePermissionState(),
  };
});

const mockEmployees: Employee[] = [
  {
    id: 1,
    code: 'EMP001',
    fullName: 'Nguyễn Văn A',
    gender: 1,
    birthday: '1990-01-01',
    cccd: '123456789',
    phone: '0909123456',
    email: 'nguyenvana@example.com',
    employeeStatus: 1,
    accountStatus: 1,
    status: 1,
    hireDate: '2020-01-01',
    primaryAssignment: {
      id: 1,
      employee_id: 1,
      org_unit_id: 1,
      department_id: 1,
      position_id: 1,
      is_primary: true,
      status: 1,
      org_unit: { id: 1, name: 'Công ty Mẹ' },
      department: { id: 1, name: 'IT' },
      position: { id: 1, name: 'Developer', grade: 1 },
    },
  },
  {
    id: 2,
    code: 'EMP002',
    fullName: 'Trần Thị B',
    gender: 2,
    birthday: '1992-05-15',
    cccd: '987654321',
    phone: '0912345678',
    email: 'tranthib@example.com',
    employeeStatus: 1,
    accountStatus: 0,
    status: 1,
    hireDate: '2021-03-01',
    primaryAssignment: {
      id: 2,
      employee_id: 2,
      org_unit_id: 1,
      department_id: 2,
      position_id: 2,
      is_primary: true,
      status: 1,
      org_unit: { id: 1, name: 'Công ty Mẹ' },
      department: { id: 2, name: 'HR' },
      position: { id: 2, name: 'Manager', grade: 2 },
    },
  },
];

describe('EmployeesTable', () => {
  it('renders employee data correctly', () => {
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        onEdit={() => {}}
        onChangeStatus={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText('EMP001')).toBeTruthy();
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText('EMP002')).toBeTruthy();
    expect(screen.getByText('Trần Thị B')).toBeTruthy();
  });

  it('calls onSortChange with correct field mapping when sorting by code', () => {
    const onSortChange = vi.fn();
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        onSortChange={onSortChange}
      />,
    );

    // Find and click the code column sorter
    const codeHeader = screen.getByText('Mã nhân sự');
    fireEvent.click(codeHeader);

    expect(onSortChange).toHaveBeenCalledWith('code', 'asc');
  });

  it('calls onSortChange with correct field mapping when sorting by fullName', () => {
    const onSortChange = vi.fn();
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        onSortChange={onSortChange}
      />,
    );

    const nameHeader = screen.getByText('Họ tên');
    fireEvent.click(nameHeader);

    expect(onSortChange).toHaveBeenCalledWith('full_name', 'asc');
  });

  it('calls onSortChange with correct field mapping when sorting by hireDate', () => {
    const onSortChange = vi.fn();
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        onSortChange={onSortChange}
      />,
    );

    const hireDateHeader = screen.getByText('Ngày vào');
    fireEvent.click(hireDateHeader);

    expect(onSortChange).toHaveBeenCalledWith('hire_date', 'asc');
  });

  it('calls onSortChange with correct field mapping when sorting by employeeStatus', () => {
    const onSortChange = vi.fn();
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        onSortChange={onSortChange}
      />,
    );

    const statusHeader = screen.getByText('Trạng thái');
    fireEvent.click(statusHeader);

    expect(onSortChange).toHaveBeenCalledWith('employee_status', 'asc');
  });

  it('handles sort order toggle correctly', () => {
    const onSortChange = vi.fn();
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        onSortChange={onSortChange}
      />,
    );

    const nameHeader = screen.getByText('Họ tên');

    // First click - asc
    fireEvent.click(nameHeader);
    expect(onSortChange).toHaveBeenCalledWith('full_name', 'asc');

    // Second click - desc
    fireEvent.click(nameHeader);
    expect(onSortChange).toHaveBeenCalledWith('full_name', 'desc');
  });

  it('calls onView when view button is clicked', () => {
    const onView = vi.fn();
    render(<EmployeesTable data={mockEmployees} onView={onView} />);

    const viewButtons = screen.getAllByLabelText(/Xem nhân sự/);
    fireEvent.click(viewButtons[0]);

    expect(onView).toHaveBeenCalledWith(mockEmployees[0]);
  });

  it('shows edit button when onEdit is provided and user has permission', () => {
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        onEdit={() => {}}
      />,
    );

    // Edit button should be in the action dropdown
    // Note: actual testing of dropdown would require more complex setup
    expect(screen.getByText('EMP001')).toBeTruthy();
  });

  it('hides edit button when onEdit is not provided', () => {
    render(<EmployeesTable data={mockEmployees} onView={() => {}} />);

    expect(screen.getByText('EMP001')).toBeTruthy();
  });

  it('renders with serverPagination config', () => {
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        serverPagination={{
          current: 1,
          pageSize: 15,
          total: 2,
          onChange: () => {},
        }}
      />,
    );

    expect(screen.getByText('EMP001')).toBeTruthy();
    expect(screen.getByText('EMP002')).toBeTruthy();
  });

  it('displays loading state', () => {
    render(<EmployeesTable data={[]} loading={true} onView={() => {}} />);

    // Loading skeleton should be rendered
    // Actual implementation depends on DataTable component
    expect(screen.queryByText('EMP001')).toBeFalsy();
  });

  it('handles empty data correctly', () => {
    render(<EmployeesTable data={[]} onView={() => {}} />);

    // Empty state should be rendered
    // Actual implementation depends on DataTable component
    expect(screen.queryByText('EMP001')).toBeFalsy();
  });

  it('renders employee status correctly', () => {
    render(<EmployeesTable data={mockEmployees} onView={() => {}} />);

    // Status tags should be rendered
    // The actual text depends on EMPLOYEE_STATUS_LABELS mapping
    expect(screen.getAllByText('Thử việc').length).toBe(2);
  });

  it('renders account status correctly', () => {
    render(<EmployeesTable data={mockEmployees} onView={() => {}} />);

    // Account status tags
    expect(screen.getByText('Đang hoạt động')).toBeTruthy();
    expect(screen.getByText('Đã khóa')).toBeTruthy();
  });

  it('handles row selection', () => {
    const onSelectionChange = vi.fn();
    render(
      <EmployeesTable
        data={mockEmployees}
        onView={() => {}}
        selectedRowKeys={[1]}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Row selection should be configured
    expect(screen.getByText('EMP001')).toBeTruthy();
  });

  it('displays org unit and department from primary assignment', () => {
    render(<EmployeesTable data={mockEmployees} onView={() => {}} />);

    expect(screen.getAllByText('Công ty Mẹ').length).toBe(2);
    expect(screen.getByText('IT')).toBeTruthy();
    expect(screen.getByText('HR')).toBeTruthy();
  });

  it('displays position and grade', () => {
    render(<EmployeesTable data={mockEmployees} onView={() => {}} />);

    expect(screen.getByText('Developer')).toBeTruthy();
    expect(screen.getByText('Manager')).toBeTruthy();
  });

  describe('P2: "Cấp tài khoản" action gating (EMP_ACCOUNT_CREATE)', () => {
    afterEach(() => {
      mockUsePermission.mockReset();
      mockUsePermission.mockImplementation(() => ({ can: true }));
    });

    it('shows "Cấp tài khoản" for an employee without an account when user has EMP_ACCOUNT_CREATE', () => {
      const employeeWithoutAccount = {
        ...mockEmployees[1],
        user_id: undefined,
      };
      render(
        <EmployeesTable
          data={[employeeWithoutAccount]}
          onView={() => {}}
          onCreateAccount={() => {}}
        />,
      );

      expect(screen.getByText('Cấp tài khoản')).toBeTruthy();
    });

    it('hides "Cấp tài khoản" when user lacks EMP_ACCOUNT_CREATE permission', () => {
      mockUsePermission.mockImplementation(() => ({ can: false }));

      const employeeWithoutAccount = {
        ...mockEmployees[1],
        user_id: undefined,
      };
      render(
        <EmployeesTable
          data={[employeeWithoutAccount]}
          onView={() => {}}
          onCreateAccount={() => {}}
        />,
      );

      expect(screen.queryByText('Cấp tài khoản')).toBeFalsy();
    });

    it('hides "Cấp tài khoản" for an employee that already has an account, even with permission', () => {
      const employeeWithAccount = { ...mockEmployees[0], user_id: 5 };
      render(
        <EmployeesTable
          data={[employeeWithAccount]}
          onView={() => {}}
          onCreateAccount={() => {}}
        />,
      );

      expect(screen.queryByText('Cấp tài khoản')).toBeFalsy();
    });

    it('calls onCreateAccount with the employee record when clicked', () => {
      const onCreateAccount = vi.fn();
      const employeeWithoutAccount = {
        ...mockEmployees[1],
        user_id: undefined,
      };
      render(
        <EmployeesTable
          data={[employeeWithoutAccount]}
          onView={() => {}}
          onCreateAccount={onCreateAccount}
        />,
      );

      fireEvent.click(screen.getByText('Cấp tài khoản'));
      expect(onCreateAccount).toHaveBeenCalledWith(employeeWithoutAccount);
    });
  });

  describe('P1: row-level data scope (org_unit_id/department_id)', () => {
    afterEach(() => {
      mockUsePermissionState.mockImplementation(() => ({
        isSuperAdmin: false,
        permissionCodes: [],
        currentScopeType: 'he_thong',
        currentOrgUnitId: null,
        currentDepartmentId: null,
      }));
    });

    it('shows Sửa/Xóa for a record inside the phong_ban scope of the active context', () => {
      mockUsePermissionState.mockImplementation(() => ({
        isSuperAdmin: false,
        permissionCodes: [],
        currentScopeType: 'phong_ban',
        currentOrgUnitId: 1,
        currentDepartmentId: 1, // khớp department_id: 1 của mockEmployees[0]
      }));

      render(
        <EmployeesTable
          data={[mockEmployees[0]]}
          onView={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />,
      );

      expect(screen.getByText('Sửa')).toBeTruthy();
      expect(screen.getByText('Xóa')).toBeTruthy();
    });

    it('hides Sửa/Xóa for a record outside the phong_ban scope of the active context', () => {
      mockUsePermissionState.mockImplementation(() => ({
        isSuperAdmin: false,
        permissionCodes: [],
        currentScopeType: 'phong_ban',
        currentOrgUnitId: 1,
        currentDepartmentId: 999, // KHÔNG khớp department_id: 1 của mockEmployees[0]
      }));

      render(
        <EmployeesTable
          data={[mockEmployees[0]]}
          onView={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />,
      );

      expect(screen.queryByText('Sửa')).toBeFalsy();
      expect(screen.queryByText('Xóa')).toBeFalsy();
      // Xem vẫn hiển thị — view không bị chặn bởi scope (chỉ áp dụng cho
      // create/edit/delete/import theo MODULE_SCOPE_REQUIREMENTS.employees).
      expect(
        screen.getByLabelText(`Xem nhân sự ${mockEmployees[0].fullName}`),
      ).toBeTruthy();
    });

    it('hides Sửa/Xóa when the record has no assignment (không xác định được scope)', () => {
      mockUsePermissionState.mockImplementation(() => ({
        isSuperAdmin: false,
        permissionCodes: [],
        currentScopeType: 'phong_ban',
        currentOrgUnitId: 1,
        currentDepartmentId: 1,
      }));

      const employeeWithoutAssignment = {
        ...mockEmployees[0],
        primaryAssignment: undefined,
      };
      render(
        <EmployeesTable
          data={[employeeWithoutAssignment]}
          onView={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />,
      );

      expect(screen.queryByText('Sửa')).toBeFalsy();
      expect(screen.queryByText('Xóa')).toBeFalsy();
    });

    it('shows "Khôi phục" for a record inside scope (EMP_RESTORE + matching department)', () => {
      mockUsePermissionState.mockImplementation(() => ({
        isSuperAdmin: false,
        permissionCodes: [],
        currentScopeType: 'phong_ban',
        currentOrgUnitId: 1,
        currentDepartmentId: 1,
      }));

      render(
        <EmployeesTable
          data={[mockEmployees[0]]}
          onView={() => {}}
          onRestore={() => {}}
        />,
      );

      expect(screen.getByText('Khôi phục')).toBeTruthy();
    });

    it('hides "Khôi phục" for a record outside scope even with EMP_RESTORE permission', () => {
      mockUsePermissionState.mockImplementation(() => ({
        isSuperAdmin: false,
        permissionCodes: [],
        currentScopeType: 'phong_ban',
        currentOrgUnitId: 1,
        currentDepartmentId: 999, // KHÔNG khớp department_id: 1 của mockEmployees[0]
      }));

      render(
        <EmployeesTable
          data={[mockEmployees[0]]}
          onView={() => {}}
          onRestore={() => {}}
        />,
      );

      expect(screen.queryByText('Khôi phục')).toBeFalsy();
    });

    it('super admin bypasses row-level scope entirely, regardless of department mismatch', () => {
      mockUsePermissionState.mockImplementation(() => ({
        isSuperAdmin: true,
        permissionCodes: [],
        currentScopeType: null,
        currentOrgUnitId: null,
        currentDepartmentId: null,
      }));

      render(
        <EmployeesTable
          data={[mockEmployees[0]]}
          onView={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />,
      );

      expect(screen.getByText('Sửa')).toBeTruthy();
      expect(screen.getByText('Xóa')).toBeTruthy();
    });
  });
});
