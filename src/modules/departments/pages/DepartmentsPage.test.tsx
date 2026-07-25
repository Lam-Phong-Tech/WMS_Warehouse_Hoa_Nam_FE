import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';
import { DepartmentsPage } from './DepartmentsPage';

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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInactiveMutate = vi.fn();
const mockActivateMutate = vi.fn();
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockRestoreMutate = vi.fn();
const mockSoftDeleteMutate = vi.fn();

vi.mock('@/modules/departments/hooks/use-departments', () => ({
  DEPARTMENTS_QUERY_KEY: 'departments',
  useDepartments: vi.fn(),
  useDepartmentList: vi.fn(),
  useDepartmentsTree: vi.fn(),
  useDepartment: () => ({ data: undefined, isLoading: false }),
  useCreateDepartment: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateDepartment: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useInactiveDepartment: () => ({
    mutate: mockInactiveMutate,
    isPending: false,
    variables: undefined,
  }),
  useActivateDepartment: () => ({
    mutate: mockActivateMutate,
    isPending: false,
    variables: undefined,
  }),
  useSoftDeleteDepartment: () => ({
    mutate: mockSoftDeleteMutate,
    isPending: false,
    variables: undefined,
  }),
  useRestoreDepartment: () => ({
    mutate: mockRestoreMutate,
    isPending: false,
    variables: undefined,
  }),
}));

vi.mock('@/modules/employees/hooks/use-employees', () => ({
  useEmployees: () => ({ data: [], isLoading: false }),
  useCreateEmployeeAccount: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/modules/org-units/hooks/use-org-units', () => ({
  useOrgUnits: () => ({ data: [] }),
}));

vi.mock('@/shared/utils/export-xlsx', () => ({
  exportXlsx: vi.fn(),
}));

const mockExportExcel = vi.fn().mockResolvedValue(undefined);
const mockExportPdf = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/departments/components/departments.export', () => ({
  exportDepartmentsExcel: (...args: unknown[]) => mockExportExcel(...args),
  exportDepartmentsPdf: (...args: unknown[]) => mockExportPdf(...args),
}));

// Tránh gọi API thật (generate-code) khi mở modal Thêm phòng ban — request
// thật/lỗi 401 không được chờ (fire-and-forget) và có thể còn treo sang test sau.
vi.mock('@/modules/departments/services/departments.service', () => ({
  departmentsService: {
    generateCode: vi.fn().mockResolvedValue('PB-AUTO'),
  },
}));

const { useDepartmentsTree, useDepartments, useDepartmentList } =
  await import('@/modules/departments/hooks/use-departments');
import type {
  Department,
  DepartmentTreeNode,
} from '../types/departments.types';

const MOCK_TREE: DepartmentTreeNode[] = [
  {
    id: 1,
    code: 'PB-KT',
    name: 'Phòng Kế toán',
    departmentType: 'phong_ban',
    orgUnitId: 1,
    orgUnitName: 'Đơn vị A',
    parentId: null,
    managerId: null,
    active: true,
    employeeCount: 3,
    children: [],
  },
  {
    id: 2,
    code: 'PB-NS',
    name: 'Phòng Nhân sự',
    departmentType: 'phong_ban',
    orgUnitId: 1,
    orgUnitName: 'Đơn vị A',
    parentId: 1,
    managerId: null,
    active: false,
    employeeCount: 0,
    children: [],
  },
];

const MOCK_LIST: Department[] = MOCK_TREE;

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

function mockAllHooks(
  treeData?: DepartmentTreeNode[],
  listData?: Department[],
) {
  vi.mocked(useDepartmentsTree).mockReturnValue({
    data: treeData,
    isLoading: false,
    error: null,
    isSuccess: true,
  } as unknown as UseQueryResult<DepartmentTreeNode[], Error>);
  vi.mocked(useDepartments).mockReturnValue({
    data: listData,
    isLoading: false,
    error: null,
    isSuccess: true,
  } as unknown as UseQueryResult<Department[], Error>);
  vi.mocked(useDepartmentList).mockReturnValue({
    data: listData
      ? {
          data: listData,
          meta: {
            total: listData.length,
            current_page: 1,
            per_page: 15,
            last_page: 1,
          },
        }
      : undefined,
    isLoading: false,
    error: null,
    isSuccess: true,
  } as unknown as UseQueryResult<
    {
      data: Department[];
      meta: {
        total: number;
        current_page: number;
        per_page: number;
        last_page: number;
      };
    },
    Error
  >);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DepartmentsPage', () => {
  beforeEach(() => {
    mockAllHooks();
    withPermissions(['DEPT_VIEW', 'DEPT_CREATE', 'DEPT_EDIT', 'DEPT_INACTIVE']);
  });

  it('hien thi trang thai loading', () => {
    vi.mocked(useDepartmentList).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isSuccess: false,
    } as unknown as UseQueryResult<
      {
        data: Department[];
        meta: {
          total: number;
          current_page: number;
          per_page: number;
          last_page: number;
        };
      },
      Error
    >);
    renderWithProviders(<DepartmentsPage />);
    expect(screen.getByText(/đang tải dữ liệu/i)).toBeInTheDocument();
  });

  it('hien thi empty state khi khong co du lieu', () => {
    mockAllHooks([], []);
    renderWithProviders(<DepartmentsPage />);
    expect(screen.getByText(/chưa có phòng ban/i)).toBeInTheDocument();
  });

  it('hien thi nut Them phong ban khi co quyen DEPT_CREATE', () => {
    mockAllHooks([], []);
    renderWithProviders(<DepartmentsPage />);
    expect(screen.getAllByText(/thêm phòng ban/i).length).toBeGreaterThan(0);
  });

  it('an nut Them khi khong co quyen DEPT_CREATE', () => {
    withPermissions(['DEPT_VIEW']);
    mockAllHooks([], []);
    renderWithProviders(<DepartmentsPage />);
    expect(screen.queryByText(/thêm phòng ban/i)).not.toBeInTheDocument();
  });

  it('render bang phong ban khi co du lieu', async () => {
    mockAllHooks(MOCK_TREE, MOCK_LIST);
    renderWithProviders(<DepartmentsPage />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(await screen.findByText('PB-KT')).toBeInTheDocument();
  });

  it('hien nut Xuat Excel', async () => {
    withPermissions([
      'DEPT_VIEW',
      'DEPT_CREATE',
      'DEPT_EDIT',
      'DEPT_INACTIVE',
      'DEPT_EXPORT',
    ]);
    mockAllHooks(MOCK_TREE, MOCK_LIST);
    renderWithProviders(<DepartmentsPage />);
    expect(screen.getByText(/xuất excel/i)).toBeInTheDocument();
  });

  it('mo modal them phong ban khi click nut Them', async () => {
    mockAllHooks([], []);
    const { unmount } = renderWithProviders(<DepartmentsPage />);
    const addBtn = screen.getAllByText(/thêm phòng ban/i)[0];
    await userEvent.click(addBtn);
    expect(
      await screen.findByText(/thêm phòng ban/i, {
        selector: '.ant-modal-title, [class*="title"]',
      }),
    ).toBeInTheDocument();

    // Unmount tường minh để dọn sạch overlay/khóa scroll của modal trước
    // khi sang test khác (antd Modal mở dở có thể để lại style trên <body>).
    unmount();
  });

  it('schema validate ten phong ban toi da 200 ky tu', async () => {
    const { departmentSchema } = await import('../schemas/department.schema');
    const longName = 'a'.repeat(201);
    const result = departmentSchema.safeParse({
      code: 'PB-KT',
      name: longName,
      orgUnitId: 1,
      active: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameErrors = result.error.issues.filter(
        (e: { path: unknown[] }) => e.path[0] === 'name',
      );
      expect(nameErrors.length).toBeGreaterThan(0);
    }
  });

  it('schema validate ten phong ban bat buoc', async () => {
    const { departmentSchema } = await import('../schemas/department.schema');
    const result = departmentSchema.safeParse({
      code: 'PB-KT',
      name: '',
      orgUnitId: 1,
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it('schema yeu cau don vi to chuc', async () => {
    const { departmentSchema } = await import('../schemas/department.schema');
    const result = departmentSchema.safeParse({
      code: 'PB-KT',
      name: 'Phòng Kế toán',
      orgUnitId: null,
      departmentType: 'phong_ban',
      active: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const orgErrors = result.error.issues.filter(
        (e: { path: unknown[] }) => e.path[0] === 'orgUnitId',
      );
      expect(orgErrors.length).toBeGreaterThan(0);
    }
  });

  it('schema accept du lieu hop le', async () => {
    const { departmentSchema } = await import('../schemas/department.schema');
    const result = departmentSchema.safeParse({
      code: 'PB-KT',
      name: 'Phòng Kế toán',
      orgUnitId: 1,
      departmentType: 'phong_ban',
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('P0.2/P0.6: Click Khôi phục mở xác nhận và gọi restore mutation', async () => {
    mockAllHooks(
      [
        {
          ...MOCK_TREE[0],
          active: false,
          deletedAt: '2026-07-01T00:00:00Z',
          restoreDeadline: '2026-07-15T00:00:00Z',
        },
      ],
      [
        {
          ...MOCK_LIST[0],
          active: false,
          deletedAt: '2026-07-01T00:00:00Z',
          restoreDeadline: '2026-07-15T00:00:00Z',
        },
      ],
    );
    renderWithProviders(<DepartmentsPage />);

    // Mở dropdown thao tác của dòng, rồi click "Khôi phục"
    const actionTrigger = await screen.findByTitle('Thao tác');
    await userEvent.click(actionTrigger);
    const restoreBtn = await screen.findByRole('menuitem', {
      name: /khôi phục/i,
    });
    await userEvent.click(restoreBtn);

    // Should show confirm modal
    expect(screen.getByText(/bạn có chắc muốn khôi phục/i)).toBeInTheDocument();

    // Click "OK"
    const okBtn = screen.getByRole('button', { name: 'OK' });
    await userEvent.click(okBtn);

    expect(mockRestoreMutate).toHaveBeenCalled();
  });

  // Không có endpoint PUT /departments/{id}/archive trên API thật — "Lưu trữ"
  // là cronjob backend tự động (theo Wireframe P0), không phải action thủ công.
  // Thay vào đó, "Vô hiệu" (active → inactive) đi qua PUT status=0.
  it('Click Ngừng hoạt động mở xác nhận và gọi inactive mutation', async () => {
    mockAllHooks([MOCK_TREE[0]], [MOCK_LIST[0]]);
    renderWithProviders(<DepartmentsPage />);

    const actionTrigger = await screen.findByTitle('Thao tác');
    await userEvent.click(actionTrigger);
    const inactiveBtn = await screen.findByRole('menuitem', {
      name: /ngừng hoạt động/i,
    });
    await userEvent.click(inactiveBtn);

    // Nội dung xác nhận (title bị lặp do antd render cả template + instance)
    expect(
      screen.getByText(/sẽ chuyển sang trạng thái "Ngừng hoạt động"/i),
    ).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: 'OK' });
    await userEvent.click(okBtn);

    expect(mockInactiveMutate).toHaveBeenCalledWith(
      MOCK_TREE[0],
      expect.any(Object),
    );
  });

  // "Xóa mềm" (active/inactive → soft_deleted) đi qua DELETE .../soft-delete,
  // mở DeactivateDepartmentModal — không còn phụ thuộc API impact-stats.
  it('Click Xóa mềm mở modal xác nhận riêng', async () => {
    mockAllHooks([MOCK_TREE[0]], [MOCK_LIST[0]]);
    renderWithProviders(<DepartmentsPage />);

    const actionTrigger = await screen.findByTitle('Thao tác');
    await userEvent.click(actionTrigger);
    const softDeleteBtn = await screen.findByRole('menuitem', {
      name: /xóa/i,
    });
    await userEvent.click(softDeleteBtn);

    expect(screen.getByText(/xóa phòng ban/i)).toBeInTheDocument();
  });

  it('P2: an nut Xuat Excel/PDF khi khong co quyen DEPT_EXPORT', () => {
    withPermissions(['DEPT_VIEW', 'DEPT_CREATE', 'DEPT_EDIT', 'DEPT_INACTIVE']);
    mockAllHooks(MOCK_TREE, MOCK_LIST);
    renderWithProviders(<DepartmentsPage />);
    expect(screen.queryByText(/xuất excel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/xuất pdf/i)).not.toBeInTheDocument();
  });

  it('P2: hien nut Xuat PDF khi co quyen DEPT_EXPORT, goi exportDepartmentsPdf khi click', async () => {
    withPermissions([
      'DEPT_VIEW',
      'DEPT_CREATE',
      'DEPT_EDIT',
      'DEPT_INACTIVE',
      'DEPT_EXPORT',
    ]);
    mockAllHooks(MOCK_TREE, MOCK_LIST);
    renderWithProviders(<DepartmentsPage />);

    const pdfBtn = screen.getByText(/xuất pdf/i);
    expect(pdfBtn).toBeInTheDocument();
    await userEvent.click(pdfBtn);
    expect(mockExportPdf).toHaveBeenCalledTimes(1);
  });

  it('P2: dang xuat Excel thi disable nut Xuat PDF (tranh bam nhieu lan)', async () => {
    withPermissions([
      'DEPT_VIEW',
      'DEPT_CREATE',
      'DEPT_EDIT',
      'DEPT_INACTIVE',
      'DEPT_EXPORT',
    ]);
    mockAllHooks(MOCK_TREE, MOCK_LIST);
    let resolveExport: () => void = () => {};
    mockExportExcel.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveExport = resolve;
        }),
    );
    renderWithProviders(<DepartmentsPage />);

    const excelBtn = screen.getByText(/xuất excel/i).closest('button')!;
    const pdfBtn = screen.getByText(/xuất pdf/i).closest('button')!;
    await userEvent.click(excelBtn);

    expect(pdfBtn).toBeDisabled();

    resolveExport();
    await screen.findByText(/xuất pdf/i);
  });

  it('P2: che do Dang cay dung useDepartmentsTree (khong render tu du lieu bang phang)', async () => {
    mockAllHooks(MOCK_TREE, MOCK_LIST);
    renderWithProviders(<DepartmentsPage />);

    const treeToggle = screen.getByText('Dạng cây');
    await userEvent.click(treeToggle);

    // Ở view "Dạng cây", page phải gọi useDepartmentsTree() (GET /departments/tree)
    // thay vì chỉ hiển thị lại data phẳng từ useDepartmentList (bảng danh sách).
    expect(vi.mocked(useDepartmentsTree)).toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(document.querySelector('.ant-tree')).toBeInTheDocument();
  });
});
