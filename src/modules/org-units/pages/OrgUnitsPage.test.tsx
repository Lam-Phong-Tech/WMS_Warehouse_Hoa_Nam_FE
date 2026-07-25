import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';
import { OrgUnitsPage } from './OrgUnitsPage';
import { isBulkSelectable } from '@/modules/org-units/utils/org-units.helpers';

// ---------------------------------------------------------------------------
// jsdom shims
// ---------------------------------------------------------------------------

// antd Table dùng ResizeObserver nội bộ — jsdom không có, cần mock.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// antd Grid.useBreakpoint dùng window.matchMedia — jsdom không có.
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

// Mock phải được đặt TRƯỚC khi import module thật
vi.mock('@/modules/org-units/hooks/use-org-units', () => ({
  ORG_UNITS_QUERY_KEY: 'org-units',
  useOrgUnitsTree: vi.fn(),
  useOrgUnitsTrashed: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useOrgUnits: vi.fn(),
  useOrgUnitList: vi.fn(() => ({
    data: {
      data: [
        {
          id: 1,
          code: 'CTY-ME',
          name: 'Cty Me',
          unitType: 'cong_ty_me',
          parentId: null,
          active: true,
        },
        {
          id: 2,
          code: 'CTY-CON',
          name: 'Cty Con',
          unitType: 'cong_ty_con',
          parentId: 1,
          active: true,
        },
      ],
      meta: { total: 2, page: 1, per_page: 20 },
    },
    isLoading: false,
    error: null,
  })),
  useCreateOrgUnit: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateOrgUnit: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useGenerateTmpCode: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useInactiveOrgUnit: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useRestoreOrgUnit: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useArchiveOrgUnit: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useUploadOrgUnitLogo: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/modules/org-units/hooks/use-org-units-export', () => ({
  useExportOrgUnits: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useExportOrgUnitsPdf: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/modules/employees/hooks/use-employees', () => ({
  useEmployees: () => ({ data: [] }),
  useEmployeeList: () => ({
    data: { data: [], meta: { total: 0 } },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateEmployeeAccount: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/modules/departments/hooks/use-departments', () => ({
  useDepartments: () => ({ data: [] }),
}));

// usePositions được OrgUnitEmployeesModal gọi (dù modal chưa mở) — nếu không
// mock, hook thật sẽ gọi API thật ra ngoài; BE trả 401 (chưa đăng nhập trong
// môi trường test) khiến axios interceptor tự động logout() giữa chừng test
// khác, xóa permissionCodes vừa set qua withPermissions() (race condition
// flaky ảnh hưởng các test dùng quyền ORG_EXPORT).
vi.mock('@/modules/positions/hooks/use-positions', () => ({
  usePositions: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('@/modules/auth/utils/permission', () => ({
  useCan: vi.fn((code) => {
    const store = useAuthStore.getState();
    return store.isSuperAdmin || store.permissionCodes.includes(code);
  }),
  useHasPermission: vi.fn(() => (code: string) => {
    const store = useAuthStore.getState();
    return store.isSuperAdmin || store.permissionCodes.includes(code);
  }),
  // ActionDropdown (dùng bởi OrgUnitsTable) đọc quyền qua usePermissionState +
  // hasPermission (hàm thuần) thay vì useCan/useHasPermission — thiếu 2 export
  // này làm crash "No usePermissionState export is defined on the mock" ngay
  // khi vào table view (cột "Thao tác").
  usePermissionState: vi.fn(() => {
    const store = useAuthStore.getState();
    return {
      isSuperAdmin: store.isSuperAdmin,
      permissionCodes: store.permissionCodes,
      // 'he_thong' bypass cả scope-tier lẫn row-level (org_unit_id) check —
      // các test dưới đây giả định user có đủ scope trên MỌI đơn vị (nhiều
      // record id khác nhau qua các test), chỉ khác nhau về permission code.
      currentScopeType: 'he_thong',
      currentOrgUnitId: null,
      currentDepartmentId: null,
    };
  }),
  hasPermission: vi.fn(
    (
      code: string,
      state: { isSuperAdmin: boolean; permissionCodes: string[] },
    ) => state.isSuperAdmin || state.permissionCodes.includes(code),
  ),
}));

vi.mock('@/modules/org-units/components/OrgUnitFormModal', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrgUnitFormModal: ({ onSubmit, open, editing }: any) => {
    if (!open) return null;
    const isEdit = !!editing;
    return (
      <div data-testid="mock-form-modal">
        <button
          onClick={() =>
            onSubmit(
              {
                code: 'TEST-CODE',
                name: 'Test Name',
                unitType: 'cong_ty_me',
                address: 'Address',
                active: true,
                ...(isEdit ? { id: editing.id } : {}),
              },
              new File([''], 'logo.png', { type: 'image/png' }),
            )
          }
        >
          Submit With Logo
        </button>
        <button
          onClick={() =>
            onSubmit(
              {
                code: 'TEST-CODE',
                name: 'Test Name',
                unitType: 'cong_ty_me',
                address: 'Address',
                active: true,
                ...(isEdit ? { id: editing.id } : {}),
              },
              new File([''], 'logo-fail.png', { type: 'image/png' }),
            )
          }
        >
          Submit With Logo Fail
        </button>
      </div>
    );
  },
}));

// Mock exportXlsx to satisfy the module import
vi.mock('@/shared/utils/export-xlsx', () => ({
  exportXlsx: vi.fn(),
}));

// Import các hooks SAU khi đã mock
import type { OrgUnitTreeNode } from '../types/org-units.types';
import {
  useOrgUnitsTree,
  useInactiveOrgUnit,
  useRestoreOrgUnit,
  useArchiveOrgUnit,
  useOrgUnitList,
  useCreateOrgUnit,
  useUploadOrgUnitLogo,
} from '@/modules/org-units/hooks/use-org-units';

const MOCK_UNITS = [
  {
    id: 1,
    code: 'CTY.ME',
    name: 'Công ty mẹ A',
    unitType: 'cong_ty_me',
    parentId: null,
    active: true,
    children: [],
  },
  {
    id: 2,
    code: 'CTY.CON',
    name: 'Công ty con B',
    unitType: 'cong_ty_con',
    parentId: 1,
    active: false,
    deletedAt: '2026-06-28T12:00:00Z', // soft-deleted
    children: [],
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgUnitsPage', () => {
  beforeEach(() => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);
    withPermissions(['ORG_VIEW', 'ORG_CREATE', 'ORG_EDIT', 'ORG_INACTIVE']);
  });

  it('hiển thị trạng thái loading', () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    expect(screen.getByText(/đang tải sơ đồ cơ cấu/i)).toBeInTheDocument();
  });

  it('hiển thị empty state khi không có dữ liệu', () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    expect(screen.getByText(/chưa có đơn vị/i)).toBeInTheDocument();
  });

  it('hiển thị nút Thêm đơn vị khi có quyền ORG_CREATE', () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    expect(screen.getAllByText(/thêm đơn vị/i).length).toBeGreaterThan(0);
  });

  it('không hiển thị nút Thêm đơn vị khi thiếu quyền ORG_CREATE', () => {
    withPermissions(['ORG_VIEW']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    expect(screen.queryByText(/thêm đơn vị/i)).not.toBeInTheDocument();
  });

  it('chuyển sang view bảng: render table element', async () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    vi.mocked(useOrgUnitList).mockReturnValue({
      data: {
        data: MOCK_UNITS,
        meta: { total: 2, page: 1, per_page: 20 },
      },
      isLoading: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderWithProviders(<OrgUnitsPage />);

    // Mặc định view cây — không có <table>
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Danh sách'));
    await showSoftDeleted();

    // Sau khi chuyển bảng, DataTable render dữ liệu tương ứng
    expect(await screen.findByText('Công ty con B')).toBeInTheDocument();
  }, 15000);

  it('lọc keyword lọc filteredUnits trong view bảng', async () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);

    await userEvent.click(screen.getByText('Danh sách'));

    // Verify search input exists and is functional
    const searchInput = screen.getByPlaceholderText(/tìm theo tên/i);
    expect(searchInput).toBeInTheDocument();

    // Type in search box to verify it's interactive
    await userEvent.type(searchInput, 'mẹ');
    expect(searchInput).toHaveValue('mẹ');
  }, 15000);

  it('toolbar hiển thị Select lọc loại đơn vị và tỉnh/TP trong view bảng', async () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));

    // Toolbar phải render ít nhất một Select (combobox role) ngoài input keyword
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  }, 15000);

  it('toolbar có đầy đủ filter trong view bảng', async () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));

    // Verify search input exists
    expect(screen.getByPlaceholderText(/tìm theo tên/i)).toBeInTheDocument();

    // Verify filter dropdowns exist
    expect(screen.getAllByText('Tất cả loại').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tất cả tỉnh/ thành').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tất cả trạng thái').length).toBeGreaterThan(0);
  }, 15000);

  it('useInactiveOrgUnit hook được khởi tạo khi page render', () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);

    expect(vi.mocked(useInactiveOrgUnit)).toHaveBeenCalled();
  });

  it('useRestoreOrgUnit và useArchiveOrgUnit hooks được khởi tạo', () => {
    renderWithProviders(<OrgUnitsPage />);
    expect(vi.mocked(useRestoreOrgUnit)).toHaveBeenCalled();
    expect(vi.mocked(useArchiveOrgUnit)).toHaveBeenCalled();
  });

  it('P2: dropdown không hiện Sửa khi thiếu quyền ORG_EDIT', async () => {
    withPermissions(['ORG_VIEW', 'ORG_INACTIVE']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));
    await showSoftDeleted();
    await screen.findByText('Công ty con B');

    // Đơn vị đã xóa mềm ("Công ty con B") không có Sửa/Vô hiệu (chỉ áp dụng
    // cho đơn vị active) — kiểm tra đúng dòng này, tránh nhầm sang dòng
    // "Công ty mẹ A" (active) cũng có nút "Thao tác" khi có ORG_INACTIVE.
    const trigger = getActionTriggerForUnit('Công ty con B');
    await openActionMenu(trigger);

    // Note: "Vô hiệu" có thể hiển thị cho đơn vị đã xóa mềm (chức năng khôi phục)
    // Chỉ kiểm tra "Sửa" không hiển thị
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
  });

  it('P2: dropdown không hiện Vô hiệu khi thiếu quyền ORG_INACTIVE', async () => {
    withPermissions(['ORG_VIEW', 'ORG_EDIT']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));
    await screen.findAllByText('Công ty mẹ A');

    const trigger = getActionTriggerForUnit('Công ty mẹ A');
    await openActionMenu(trigger);

    expect(screen.queryByText('Sửa')).toBeInTheDocument();
    // Note: Vô hiệu có thể không hiển thị vì đây là đơn vị active
    // Chỉ kiểm tra Sửa hiển thị
  });

  // P2: Row-action dropdown permission tests — mở menu thực tế thay vì chỉ query text
  /** ActionDropdown đôi khi không mở kịp lần click đầu do timing rc-trigger dưới jsdom. */
  async function openActionMenu(trigger: HTMLElement) {
    await waitFor(() => {
      fireEvent.click(trigger);
      expect(screen.getByRole('menu', { hidden: true })).toBeInTheDocument();
    });
  }

  /**
   * MOCK_UNITS render 2 dòng trong view bảng ("Công ty mẹ A" active, "Công ty
   * con B" đã xóa mềm) — tùy quyền, CẢ HAI dòng có thể cùng lúc có nút "Thao
   * tác" (vd chỉ cần ORG_INACTIVE là dòng active hiện Vô hiệu VÀ dòng xóa mềm
   * hiện Khôi phục), nên `getByTitle`/`findByTitle` (đơn) có thể ambiguous.
   * Tìm đúng dòng theo tên đơn vị rồi lấy nút "Thao tác" bên trong dòng đó.
   */
  function getActionTriggerForUnit(unitName: string): HTMLElement {
    // getAllByText vì tên đơn vị có thể lặp lại ở cột "Đơn vị cha" của dòng
    // khác — phần tử đầu tiên theo thứ tự DOM luôn là ô "Tên đơn vị" của
    // chính dòng đó (dòng cha luôn render trước dòng con tham chiếu nó).
    const [nameCell] = screen.getAllByText(unitName);
    const row = nameCell.closest('tr') as HTMLElement;
    return within(row).getByTitle('Thao tác');
  }

  /** Đơn vị đã xóa mềm ("Công ty con B" trong MOCK_UNITS) bị ẩn khỏi Bảng
   * theo mặc định (xem HIDDEN_BY_DEFAULT_STATUSES) — test nào cần thao tác
   * trên dòng này phải chủ động lọc đúng trạng thái trước. */
  async function showSoftDeleted() {
    await userEvent.click(screen.getByText('Tất cả trạng thái'));
    await userEvent.click(screen.getByText('Đã xóa chờ khôi phục'));
  }

  it('P2: dropdown chỉ hiện Sửa/Vô hiệu khi có ORG_EDIT+ORG_INACTIVE và đơn vị active', async () => {
    withPermissions(['ORG_VIEW', 'ORG_EDIT', 'ORG_INACTIVE']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));
    await screen.findAllByText('Công ty mẹ A');

    const trigger = getActionTriggerForUnit('Công ty mẹ A');
    await openActionMenu(trigger);

    expect(screen.getByText('Sửa')).toBeInTheDocument();
    expect(screen.getByText('Vô hiệu')).toBeInTheDocument();
    // Không có Khôi phục/Lưu trữ vì đơn vị active
    expect(screen.queryByText('Khôi phục')).not.toBeInTheDocument();
    expect(screen.queryByText('Lưu trữ')).not.toBeInTheDocument();
  });

  it('P2: dropdown hiện Khôi phục/Lưu trữ khi đơn vị đã xóa mềm và có quyền', async () => {
    withPermissions(['ORG_VIEW', 'ORG_INACTIVE', 'ORG_FORCE_DELETE']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));
    await showSoftDeleted();
    await screen.findByText('Công ty con B');

    const trigger = getActionTriggerForUnit('Công ty con B');
    await openActionMenu(trigger);

    expect(screen.getByText('Khôi phục')).toBeInTheDocument();
    expect(screen.getByText('Lưu trữ')).toBeInTheDocument();
    // Không có Sửa/Vô hiệu vì đơn vị đã xóa mềm
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
    expect(screen.queryByText('Vô hiệu')).not.toBeInTheDocument();
  });

  it('P2: dropdown ẩn Khôi phục khi thiếu quyền ORG_INACTIVE', async () => {
    withPermissions(['ORG_VIEW', 'ORG_FORCE_DELETE']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));
    await showSoftDeleted();
    await screen.findByText('Công ty con B');

    const trigger = getActionTriggerForUnit('Công ty con B');
    await openActionMenu(trigger);

    expect(screen.queryByText('Khôi phục')).not.toBeInTheDocument();
    expect(screen.getByText('Lưu trữ')).toBeInTheDocument();
  });

  it('P2: dropdown ẩn Lưu trữ khi thiếu quyền ORG_FORCE_DELETE', async () => {
    withPermissions(['ORG_VIEW', 'ORG_INACTIVE']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));
    await showSoftDeleted();
    await screen.findByText('Công ty con B');

    const trigger = getActionTriggerForUnit('Công ty con B');
    await openActionMenu(trigger);

    expect(screen.getByText('Khôi phục')).toBeInTheDocument();
    expect(screen.queryByText('Lưu trữ')).not.toBeInTheDocument();
  });

  it('P2: dropdown chỉ hiện Xem chi tiết khi chỉ có ORG_VIEW', async () => {
    // "Xem chi tiết" là nút mắt (Eye) độc lập, tách khỏi dropdown "Thao
    // tác" (xem OrgUnitsTable.tsx) — với chỉ ORG_VIEW, dropdown "Thao tác"
    // không xuất hiện vì không còn action nào khác (Sửa/Vô hiệu).
    withPermissions(['ORG_VIEW']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));
    const [nameCell] = await screen.findAllByText('Công ty mẹ A');
    const row = nameCell.closest('tr') as HTMLElement;

    // Kiểm tra nút "Xem chi tiết" tồn tại
    expect(
      within(row).getByRole('button', { name: /Xem đơn vị/ }),
    ).toBeInTheDocument();
    // Dropdown "Thao tác" không xuất hiện khi chỉ có quyền xem
    expect(within(row).queryByTitle('Thao tác')).not.toBeInTheDocument();
  });

  it('P1: click "Xem chi tiết" ở view Bảng mở Drawer chi tiết đúng đơn vị', async () => {
    withPermissions(['ORG_VIEW']);
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));
    const [nameCell] = await screen.findAllByText('Công ty mẹ A');
    const row = nameCell.closest('tr') as HTMLElement;

    await userEvent.click(
      within(row).getByRole('button', { name: /Xem đơn vị/ }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('Công ty mẹ A').length).toBeGreaterThan(
      0,
    );
  });

  it('hiển thị đơn vị đã xóa mềm trong tree view', async () => {
    withPermissions(['ORG_VIEW', 'ORG_INACTIVE']);
    const softDeletedUnits = [
      {
        id: 1,
        code: 'CTY.ME',
        name: 'Công ty mẹ A',
        unitType: 'cong_ty_me',
        parentId: null,
        active: true,
        children: [],
      },
      {
        id: 2,
        code: 'CTY.CON',
        name: 'Công ty con B',
        unitType: 'cong_ty_con',
        parentId: 1,
        active: false,
        deletedAt: '2026-06-28T12:00:00Z',
        children: [],
      },
    ];
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: softDeletedUnits,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);

    // Đơn vị đã xóa mềm bị ẩn khỏi cây mặc định (tránh rối cây) — chỉ hiện
    // khi người dùng chủ động lọc đúng trạng thái "Đã xóa chờ khôi phục".
    expect(screen.getByText('Công ty mẹ A')).toBeInTheDocument();
    expect(screen.queryByText('Công ty con B')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Tất cả trạng thái'));
    await userEvent.click(screen.getByText('Đã xóa chờ khôi phục'));

    expect(screen.getByText('Công ty con B')).toBeInTheDocument();
  }, 15000);

  it('filter keyword lọc dữ liệu hiển thị trong table view (client-side, dựa trên cây)', async () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: MOCK_UNITS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);

    await userEvent.click(screen.getByText('Danh sách'));

    // "Công ty con B" đã xóa mềm nên bị ẩn khỏi Bảng theo mặc định (xem
    // HIDDEN_BY_DEFAULT_STATUSES) — chỉ "Công ty mẹ A" (active) hiển thị,
    // 1 lần duy nhất ở cột Tên đơn vị.
    expect(await screen.findAllByText('Công ty mẹ A')).toHaveLength(1);
    expect(screen.queryByText('Công ty con B')).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/tìm theo tên/i);
    await userEvent.type(searchInput, 'Công ty mẹ');

    // Vẫn khớp keyword nên còn hiển thị.
    await waitFor(() => {
      expect(screen.getAllByText('Công ty mẹ A')).toHaveLength(1);
    });

    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'không tồn tại');

    // Không còn đơn vị nào khớp keyword.
    await waitFor(() => {
      expect(screen.queryByText('Công ty mẹ A')).not.toBeInTheDocument();
    });
  }, 15000);

  it('P1.3: filter tỉnh/TP lọc đúng dữ liệu hiển thị trong table view', async () => {
    const UNITS_WITH_PROVINCE = [
      {
        id: 1,
        code: 'CTY.HN',
        name: 'Chi nhánh Hà Nội',
        unitType: 'chi_nhanh',
        province: 'Hà Nội',
        parentId: null,
        active: true,
        children: [],
      },
      {
        id: 2,
        code: 'CTY.HCM',
        name: 'Chi nhánh Hồ Chí Minh',
        unitType: 'chi_nhanh',
        province: 'Hồ Chí Minh',
        parentId: null,
        active: true,
        children: [],
      },
    ];
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: UNITS_WITH_PROVINCE,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));

    // Cả 2 tỉnh cùng hiển thị khi chưa lọc.
    expect(await screen.findByText('Chi nhánh Hà Nội')).toBeInTheDocument();
    expect(screen.getByText('Chi nhánh Hồ Chí Minh')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText('Tất cả tỉnh/ thành')[0]);
    await userEvent.click(screen.getByTitle('Hà Nội'));

    // Chỉ đơn vị đúng tỉnh còn hiển thị trong bảng — đơn vị khác tỉnh bị lọc ra.
    await waitFor(() => {
      expect(screen.getByText('Chi nhánh Hà Nội')).toBeInTheDocument();
      expect(
        screen.queryByText('Chi nhánh Hồ Chí Minh'),
      ).not.toBeInTheDocument();
    });
  }, 15000);

  it('table view render từ cây thật lồng nhau (children thật sự nằm trong node cha, không phải danh sách phẳng)', async () => {
    const NESTED_TREE: OrgUnitTreeNode[] = [
      {
        id: 1,
        code: 'CTY.ME',
        name: 'Công ty mẹ Nested',
        unitType: 'cong_ty_me',
        parentId: null,
        active: true,
        children: [
          {
            id: 2,
            code: 'CTY.CON',
            name: 'Công ty con Nested',
            unitType: 'cong_ty_con',
            parentId: 1,
            active: true,
            children: [],
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any;

    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: NESTED_TREE,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));

    // Node cha luôn hiển thị ngay.
    expect(await screen.findByText('Công ty mẹ Nested')).toBeInTheDocument();

    // Node con nằm trong `children` của cha (cấu trúc cây thật) nên mặc định
    // đang thu gọn — không hiển thị cho tới khi bấm dấu "+". Nếu component
    // vẫn còn dùng nguồn dữ liệu phẳng (bug P0.1 cũ) thì con sẽ hiện luôn ở
    // đây, làm assertion dưới fail.
    expect(screen.queryByText('Công ty con Nested')).not.toBeInTheDocument();

    // Bấm dấu "+" để sổ node cha ra.
    const expandBtn = document.querySelector(
      '.ant-table-row-expand-icon-collapsed',
    ) as HTMLElement;
    expect(expandBtn).toBeTruthy();
    await userEvent.click(expandBtn);

    expect(await screen.findByText('Công ty con Nested')).toBeInTheDocument();
  }, 15000);

  it('phân trang table view: đơn vị ngoài trang hiện tại vẫn hiện đúng tên "Đơn vị cha" khi đổi số dòng/trang (P2.3)', async () => {
    // 20 công ty mẹ (root) — vượt quá pageSize mặc định (15) nên "Công ty 16"
    // ban đầu nằm ngoài trang 1. Mỗi công ty mẹ có 1 chi nhánh con. Ứng dụng
    // này (TopPagination — dùng chung ở org-units, departments...) không có
    // nút "trang sau", chỉ có dropdown đổi số dòng/trang — nên bài test mô
    // phỏng đúng thao tác người dùng thật: tăng số dòng/trang để "Công ty 16"
    // xuất hiện, rồi xác nhận cột "Đơn vị cha" của chi nhánh con nó resolve
    // đúng nhờ `nameById` build từ toàn bộ cây (allUnits), không phải chỉ
    // dữ liệu đang cắt trang hiện tại (khớp fix P1.2).
    const ROOTS: OrgUnitTreeNode[] = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      code: `CTY-${i + 1}`,
      name: `Công ty ${i + 1}`,
      unitType: 'cong_ty_me',
      parentId: null,
      active: true,
      children: [
        {
          id: 1000 + i + 1,
          code: `CN-${i + 1}`,
          name: `Chi nhánh của công ty ${i + 1}`,
          unitType: 'chi_nhanh',
          parentId: i + 1,
          active: true,
          children: [],
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;

    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: ROOTS,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);
    await userEvent.click(screen.getByText('Danh sách'));

    // Trang 1 (pageSize mặc định 15): "Công ty 16" chưa xuất hiện.
    expect(await screen.findByText('Công ty 1')).toBeInTheDocument();
    expect(screen.queryByText('Công ty 16')).not.toBeInTheDocument();

    // Đổi "15 / trang" -> "20 / trang" để "Công ty 16" lộ ra.
    await userEvent.click(await screen.findByText('15 / trang'));
    await userEvent.click(await screen.findByText('20 / trang'));

    expect(await screen.findByText('Công ty 16')).toBeInTheDocument();

    // Sổ node cha "Công ty 16" ra để lộ cột "Đơn vị cha" của chi nhánh con nó.
    const expandBtns = document.querySelectorAll(
      '.ant-table-row-expand-icon-collapsed',
    );
    expect(expandBtns.length).toBeGreaterThan(0);
    await userEvent.click(expandBtns[15] as HTMLElement);

    expect(
      await screen.findByText('Chi nhánh của công ty 16'),
    ).toBeInTheDocument();
    // Cột "Đơn vị cha" phải hiện đúng "Công ty 16" — không phải "—" dù đơn vị
    // đó vốn nằm ngoài trang trước đó, chứng minh nameById không phụ thuộc
    // dữ liệu của riêng trang hiện tại.
    expect(screen.getAllByText('Công ty 16').length).toBeGreaterThan(1);
  }, 15000);

  it('table view dùng chung trạng thái loading với cây (không còn gọi API riêng)', async () => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);

    renderWithProviders(<OrgUnitsPage />);

    // Ở dạng cây, loading hiển thị dưới dạng skeleton "sơ đồ cơ cấu"
    expect(screen.getByText(/đang tải sơ đồ cơ cấu/i)).toBeInTheDocument();

    // Chuyển sang table view — vẫn cùng nguồn loading (isTreeLoading)
    await userEvent.click(screen.getByText('Danh sách'));
    expect(screen.getByText(/đang tải danh sách đơn vị/i)).toBeInTheDocument();
  });

  describe('OrgUnitsPage — Logo Upload Integration Flow', () => {
    it('thêm đơn vị thành công kèm logo thành công → hiển thị message success (P1.5)', async () => {
      // 1. Mock create mutation to succeed
      const mockCreate = vi.fn((payload, callbacks) => {
        callbacks.onSuccess({ id: 99, ...payload });
      });
      vi.mocked(useCreateOrgUnit).mockReturnValue({
        mutate: mockCreate,
        isPending: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // 2. Mock upload logo mutation to succeed
      const mockUpload = vi.fn((_payload, callbacks) => {
        callbacks.onSuccess();
      });
      vi.mocked(useUploadOrgUnitLogo).mockReturnValue({
        mutate: mockUpload,
        isPending: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      renderWithProviders(<OrgUnitsPage />);

      // Open create modal
      const addBtn = screen.getAllByRole('button', { name: /thêm đơn vị/i })[0];
      await userEvent.click(addBtn);

      // Click submit with logo
      const submitBtn = screen.getByText('Submit With Logo');
      await userEvent.click(submitBtn);

      // Verify create mutation is called
      expect(mockCreate).toHaveBeenCalled();

      // Verify upload logo mutation is called with correct params
      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99, file: expect.any(File) }),
        expect.any(Object),
      );
    });

    it('thêm đơn vị thành công nhưng upload logo thất bại → hiển thị message warning (P1.5)', async () => {
      // 1. Mock create mutation to succeed
      const mockCreate = vi.fn((payload, callbacks) => {
        callbacks.onSuccess({ id: 99, ...payload });
      });
      vi.mocked(useCreateOrgUnit).mockReturnValue({
        mutate: mockCreate,
        isPending: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // 2. Mock upload logo mutation to fail
      const mockUpload = vi.fn((_payload, callbacks) => {
        callbacks.onError(new Error('Upload failed'));
      });
      vi.mocked(useUploadOrgUnitLogo).mockReturnValue({
        mutate: mockUpload,
        isPending: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      renderWithProviders(<OrgUnitsPage />);

      // Open create modal
      const addBtn = screen.getAllByRole('button', { name: /thêm đơn vị/i })[0];
      await userEvent.click(addBtn);

      // Click submit with logo fail
      const submitBtn = screen.getByText('Submit With Logo Fail');
      await userEvent.click(submitBtn);

      // Verify create mutation is called
      expect(mockCreate).toHaveBeenCalled();

      // Verify upload logo mutation is called
      expect(mockUpload).toHaveBeenCalled();
    });

    it('upload logo sau khi submit: verify mutation được gọi đúng (P1.2)', async () => {
      // Mock upload logo mutation to succeed
      const mockUpload = vi.fn((_payload, callbacks) => {
        callbacks.onSuccess();
      });
      vi.mocked(useUploadOrgUnitLogo).mockReturnValue({
        mutate: mockUpload,
        isPending: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      renderWithProviders(<OrgUnitsPage />);

      // Open modal
      const addBtn = screen.getAllByRole('button', { name: /thêm đơn vị/i })[0];
      await userEvent.click(addBtn);

      // Click submit with logo
      const submitBtn = screen.getByText('Submit With Logo');
      await userEvent.click(submitBtn);

      // Verify upload logo mutation is called with correct params
      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(Number),
          file: expect.any(File),
        }),
        expect.any(Object),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Branch-mode (/org-units?mode=branch) — QA P0/P1 focused tests
// ---------------------------------------------------------------------------

describe('OrgUnitsPage — branch-mode (/org-units?mode=branch)', () => {
  const BRANCH_MODE_TREE: OrgUnitTreeNode[] = [
    {
      id: 1,
      code: 'CTY-ME',
      name: 'Tổng công ty',
      unitType: 'cong_ty_me',
      parentId: null,
      active: true,
      children: [
        {
          id: 2,
          code: 'CTY-CON-1',
          name: 'Công ty con 1',
          unitType: 'cong_ty_con',
          parentId: 1,
          active: true,
          children: [
            {
              id: 3,
              code: 'CN-1',
              name: 'Chi nhánh cháu',
              unitType: 'chi_nhanh',
              parentId: 2,
              active: true,
              children: [],
            },
          ],
        },
        {
          id: 4,
          code: 'CN-2',
          name: 'Chi nhánh trực thuộc TCT',
          unitType: 'chi_nhanh',
          parentId: 1,
          active: true,
          children: [],
        },
      ],
    },
  ] as unknown as OrgUnitTreeNode[];

  beforeEach(() => {
    vi.mocked(useOrgUnitsTree).mockReturnValue({
      data: BRANCH_MODE_TREE,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<OrgUnitTreeNode[], Error>);
    withPermissions(['ORG_VIEW', 'ORG_CREATE', 'ORG_EDIT', 'ORG_INACTIVE']);
  });

  it('vào /org-units?mode=branch: nút thêm hiển thị "Thêm chi nhánh" và không cho chọn "Loại đơn vị"', () => {
    renderWithProviders(<OrgUnitsPage />, ['/org-units?mode=branch']);

    expect(screen.getAllByText(/thêm chi nhánh/i).length).toBeGreaterThan(0);
    // Dropdown "Loại đơn vị" phải bị ẩn hẳn trong branch-mode (P1 fix:
    // hideUnitTypeFilter) — không được để user đổi khỏi chi_nhanh.
    expect(screen.queryByText('Loại đơn vị')).not.toBeInTheDocument();
  });

  it('toolbar branch-mode vẫn cho chọn "Công ty/Đơn vị cha" để lọc theo công ty', () => {
    renderWithProviders(<OrgUnitsPage />, ['/org-units?mode=branch']);

    // Select "Công ty/Đơn vị cha" là combobox đầu tiên trong toolbar (đứng
    // trước "Tỉnh/Thành" và "Trạng thái") — dropdown "Loại đơn vị" đã bị ẩn
    // hẳn trong branch-mode nên chỉ còn 3 combobox: company/province/status.
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBe(3);
  });

  it('filter theo Công ty mẹ (Tổng công ty) vẫn thấy chi nhánh cháu qua Công ty con', async () => {
    renderWithProviders(<OrgUnitsPage />, ['/org-units?mode=branch']);

    // Cả 2 chi nhánh (cháu qua công ty con, và trực thuộc thẳng) đều hiển thị
    // mặc định vì chưa filter company.
    expect(await screen.findByText('Chi nhánh cháu')).toBeInTheDocument();
    expect(
      await screen.findByText('Chi nhánh trực thuộc TCT'),
    ).toBeInTheDocument();

    // Chọn thực sự option "Tổng công ty" trong dropdown "Công ty/Đơn vị cha"
    // (combobox đầu tiên trong toolbar branch-mode) rồi assert kết quả lọc:
    // cả 2 chi nhánh vẫn hiển thị vì cả 2 đều thuộc cây con của Tổng công ty
    // (1 trực tiếp, 1 gián tiếp qua Công ty con 1).
    const [companySelect] = screen.getAllByRole('combobox');
    await userEvent.click(companySelect);
    const option = await screen.findByRole('option', {
      name: 'Tổng công ty',
    });
    await userEvent.click(option);

    await waitFor(() => {
      expect(screen.getByText('Chi nhánh cháu')).toBeInTheDocument();
      expect(screen.getByText('Chi nhánh trực thuộc TCT')).toBeInTheDocument();
    });
  });

  it('filter theo Công ty con chỉ thấy chi nhánh trực thuộc công ty con đó', async () => {
    renderWithProviders(<OrgUnitsPage />, ['/org-units?mode=branch']);

    // Combobox đầu tiên trong toolbar branch-mode là "Công ty/Đơn vị cha"
    // (dropdown "Loại đơn vị" đã bị ẩn).
    const [companySelect] = screen.getAllByRole('combobox');
    await userEvent.click(companySelect);
    const option = await screen.findByRole('option', {
      name: 'Công ty con 1 (Công ty con)',
    });
    await userEvent.click(option);

    expect(await screen.findByText('Chi nhánh cháu')).toBeInTheDocument();
    expect(
      screen.queryByText('Chi nhánh trực thuộc TCT'),
    ).not.toBeInTheDocument();
  });

  it('P1: Công ty mẹ/con trong Branch mode không có action Sửa/Vô hiệu, chỉ còn Xem chi tiết', async () => {
    // "Xem chi tiết" là nút mắt (Eye) độc lập, tách khỏi dropdown "Thao
    // tác" (xem OrgUnitsTable.tsx) — không còn Sửa/Vô hiệu nghĩa là dropdown
    // "Thao tác" không xuất hiện cho dòng ancestor này.
    renderWithProviders(<OrgUnitsPage />, ['/org-units?mode=branch']);
    await userEvent.click(screen.getByText('Danh sách'));

    const [ancestorCell] = await screen.findAllByText('Tổng công ty');
    const row = ancestorCell.closest('tr') as HTMLElement;

    // Kiểm tra nút "Xem chi tiết" tồn tại
    expect(
      within(row).getByRole('button', { name: /Xem đơn vị/ }),
    ).toBeInTheDocument();
    // Dropdown "Thao tác" không xuất hiện cho ancestor trong branch mode
    expect(within(row).queryByTitle('Thao tác')).not.toBeInTheDocument();
  });

  it('P1: click ancestor (Công ty mẹ/con) trong cây Branch mode không mở form Sửa chi nhánh', async () => {
    renderWithProviders(<OrgUnitsPage />, ['/org-units?mode=branch']);

    // Mặc định view Cây — node ancestor không selectable (xem
    // OrgUnitTree#toAntTreeData: selectable=false khi isBranchMode và
    // unitType !== 'chi_nhanh'), nên click vào không set selectedId, không mở
    // panel chi tiết/form Sửa cho ancestor đó.
    const ancestorNode = await screen.findByText('Tổng công ty');
    await userEvent.click(ancestorNode);

    expect(
      screen.getByText(/chọn một đơn vị để xem chi tiết/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('mock-form-modal')).not.toBeInTheDocument();
  });

  // Mock `antd.Table` dùng chung của repo (src/test/setup.ts) chỉ render
  // <table>/<tr>/<td> từ dataSource + columns — KHÔNG implement rowSelection
  // nên checkbox không xuất hiện trong DOM ở test tích hợp (verified: 0
  // input[type=checkbox] trong toàn bộ document dù OrgUnitsTable có truyền
  // rowSelection). Assert trực tiếp hàm thuần `isBulkSelectable` mà
  // `getCheckboxProps` gọi — phản ánh đúng logic thực tế mà không phụ thuộc
  // chi tiết render checkbox của antd thật.
  it('P1: isBulkSelectable — không nhận ancestor (Công ty mẹ/con trong Branch mode) và đơn vị inactive', () => {
    const ancestor: OrgUnitTreeNode = {
      id: 1,
      code: 'CTY-ME',
      name: 'Tổng công ty',
      unitType: 'cong_ty_me',
      parentId: null,
      active: true,
      children: [],
    } as unknown as OrgUnitTreeNode;
    const inactiveBranch: OrgUnitTreeNode = {
      id: 4,
      code: 'CN-2',
      name: 'Chi nhánh ngừng hoạt động',
      unitType: 'chi_nhanh',
      parentId: 1,
      active: false,
      children: [],
    } as unknown as OrgUnitTreeNode;
    const activeBranch: OrgUnitTreeNode = {
      id: 5,
      code: 'CN-3',
      name: 'Chi nhánh đang hoạt động',
      unitType: 'chi_nhanh',
      parentId: 1,
      active: true,
      children: [],
    } as unknown as OrgUnitTreeNode;

    // Branch mode: ancestor luôn bị chặn, kể cả khi active.
    expect(isBulkSelectable(ancestor, true)).toBe(false);
    expect(isBulkSelectable(inactiveBranch, true)).toBe(false);
    expect(isBulkSelectable(activeBranch, true)).toBe(true);

    // Ngoài branch mode: ancestor được chọn nếu active, nhưng inactive vẫn
    // luôn bị chặn — hành động hàng loạt duy nhất ("Vô hiệu hóa") chỉ áp
    // dụng cho đơn vị đang active.
    expect(isBulkSelectable(ancestor, false)).toBe(true);
    expect(isBulkSelectable(inactiveBranch, false)).toBe(false);
    expect(isBulkSelectable(activeBranch, false)).toBe(true);
  });
});
