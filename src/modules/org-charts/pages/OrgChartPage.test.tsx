import * as React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';
import { OrgChartPage } from './OrgChartPage';
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';
import type { Department } from '@/modules/departments/types/departments.types';
import type { Employee } from '@/modules/employees/types/employees.types';

// ---------------------------------------------------------------------------
// jsdom shims (antd Select/Tooltip cần ResizeObserver + matchMedia)
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

// `src/test/setup.ts` mock cứng '@/modules/auth/utils/permission' (isSuperAdmin
// luôn false, permissionCodes cố định) cho toàn bộ suite — bỏ qua
// useAuthStore thật. File này cần test permission ORG_EXPORT/Super Admin nên
// phải tự vi.mock lại bằng implementation THẬT (đọc từ useAuthStore) như
// comment trong setup.ts đã yêu cầu.
vi.mock('@/modules/auth/utils/permission', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/utils/permission')>();
  return actual;
});

// `setup.ts` mock toàn cục antd stub `Result: () => null` (component nặng,
// hiếm khi cần test nội dung). File này cần assert đúng text + permission
// code hiển thị trong màn 403 nên override cục bộ: giữ nguyên mock chung
// (Button/Tag/Select/Tooltip passthrough...), chỉ thay `Result` bằng bản
// render thật title/subTitle/extra.
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    Result: ({
      title,
      subTitle,
      extra,
    }: {
      title?: React.ReactNode;
      subTitle?: React.ReactNode;
      extra?: React.ReactNode;
    }) => React.createElement('div', null, title, subTitle, extra),
  };
});

vi.mock('@/modules/org-units/hooks/use-org-units', () => ({
  useOrgUnits: vi.fn(),
}));

vi.mock('@/modules/departments/hooks/use-departments', () => ({
  useDepartments: vi.fn(),
}));

const mockCreateAccountMutate = vi.fn();
vi.mock('@/modules/employees/hooks/use-employees', () => ({
  useEmployees: vi.fn(),
  useCreateEmployeeAccount: () => ({
    mutate: mockCreateAccountMutate,
    isPending: false,
  }),
}));

const mockExportChartPdf = vi.fn().mockResolvedValue(new Blob(['pdf']));
vi.mock('@/modules/org-units/services/org-units-export.service', () => ({
  orgUnitsExportService: {
    exportChartPdf: (...args: unknown[]) => mockExportChartPdf(...args),
  },
}));

const { useOrgUnits } = await import('@/modules/org-units/hooks/use-org-units');
const { useDepartments } =
  await import('@/modules/departments/hooks/use-departments');
const { useEmployees } =
  await import('@/modules/employees/hooks/use-employees');

// ---------------------------------------------------------------------------
// Dữ liệu mẫu
// ---------------------------------------------------------------------------
// "Công Ty ERB" (id 1, cong_ty_me) → "Chi Nhánh 1" (id 2, chi_nhanh), có 6
// phòng ban (id 101..106) — vượt ngưỡng preview DEPT_PREVIEW_COUNT=4 để test
// "xem tất cả phòng ban".

const MOCK_ORG_UNITS: OrgUnit[] = [
  {
    id: 1,
    code: 'CTY',
    name: 'Công Ty ERB',
    unitType: 'cong_ty_me',
    parentId: null,
    active: true,
  },
  {
    id: 2,
    code: 'CN1',
    name: 'Chi Nhánh 1',
    unitType: 'chi_nhanh',
    parentId: 1,
    active: true,
  },
];

const MOCK_DEPARTMENTS: Department[] = Array.from({ length: 6 }, (_, i) => ({
  id: 101 + i,
  code: `PB${i + 1}`,
  name: `Phòng Ban ${i + 1}`,
  departmentType: 'phong_ban',
  orgUnitId: 2,
  orgUnitName: 'Chi Nhánh 1',
  parentId: null,
  managerId: null,
  active: true,
}));

const MOCK_EMPLOYEES: Employee[] = [];

function withPermissions(codes: string[], isSuperAdmin = false) {
  useAuthStore.setState({
    permissionCodes: codes,
    isSuperAdmin,
    isProfileLoaded: true,
    currentContext: null,
  });
}

function mockAllHooks(options?: {
  orgUnits?: OrgUnit[];
  departments?: Department[];
  employees?: Employee[];
  orgError?: unknown;
  deptError?: unknown;
  empError?: unknown;
}) {
  const {
    orgUnits = MOCK_ORG_UNITS,
    departments = MOCK_DEPARTMENTS,
    employees = MOCK_EMPLOYEES,
    orgError = null,
    deptError = null,
    empError = null,
  } = options ?? {};

  vi.mocked(useOrgUnits).mockReturnValue({
    data: orgError ? undefined : orgUnits,
    isLoading: false,
    error: orgError,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<OrgUnit[], Error>);

  vi.mocked(useDepartments).mockReturnValue({
    data: deptError ? undefined : departments,
    isLoading: false,
    error: deptError,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<Department[], Error>);

  vi.mocked(useEmployees).mockReturnValue({
    data: empError ? undefined : employees,
    isLoading: false,
    error: empError,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<Employee[], Error>);
}

/** Fake lỗi 403 nhận diện được bởi `axios.isAxiosError` (payload.isAxiosError === true). */
function forbidden403() {
  return { isAxiosError: true, response: { status: 403 } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Vùng cây sơ đồ (#org-chart-card) — dùng để scope query "Phòng Ban N" vì
// tên phòng ban cũng lặp lại trong danh sách "Phòng ban trực thuộc" của
// OrgUnitDetailPanel (render ngoài #org-chart-card).
function tree() {
  return within(document.getElementById('org-chart-card')!);
}

describe('OrgChartPage', () => {
  beforeEach(() => {
    mockAllHooks();
    withPermissions(['ORG_VIEW', 'DEPT_VIEW', 'EMP_VIEW']);
  });

  it('click node đơn vị mở đúng detail panel', async () => {
    renderWithProviders(<OrgChartPage />);

    // "Chi Nhánh 1" là con của root, chỉ hiện trong DOM sau khi root được
    // mở rộng — click "Công Ty ERB" trước (không dùng nút "Mở rộng" toàn
    // cục vì click "Chi Nhánh 1" sau đó sẽ tự toggle luôn "Chi Nhánh 1",
    // xung đột với trạng thái expand-all).
    await userEvent.click(screen.getByText('Công Ty ERB'));
    await userEvent.click(screen.getByText('Chi Nhánh 1'));

    // Header detail panel (font-weight 700, size 20) hiện đúng tên đơn vị
    const headers = document.querySelectorAll(
      'div[style*="font-weight: 700"][style*="font-size: 20"]',
    );
    const headerTexts = Array.from(headers).map((h) => h.textContent);
    expect(headerTexts).toContain('Chi Nhánh 1');
  });

  it('click phòng ban mở đúng detail panel và đóng panel đơn vị đang mở', async () => {
    renderWithProviders(<OrgChartPage />);

    await userEvent.click(screen.getByText('Công Ty ERB'));
    // Mở "Chi Nhánh 1" để lộ phòng ban (node có childDepts>0 nên click sẽ toggle expand)
    await userEvent.click(screen.getByText('Chi Nhánh 1'));
    expect(await tree().findByText('Phòng Ban 1')).toBeInTheDocument();

    await userEvent.click(tree().getByText('Phòng Ban 1'));

    const headers = document.querySelectorAll(
      'div[style*="font-weight: 700"][style*="font-size: 20"]',
    );
    const headerTexts = Array.from(headers).map((h) => h.textContent);
    expect(headerTexts).toContain('Phòng Ban 1');
    // Chỉ 1 detail panel tồn tại tại 1 thời điểm — panel đơn vị phải đóng
    expect(headerTexts).not.toContain('Chi Nhánh 1');
  });

  it('xem tất cả phòng ban: hiện đủ khi bấm, ẩn bớt khi Thu gọn', async () => {
    renderWithProviders(<OrgChartPage />);
    await userEvent.click(screen.getByText('Công Ty ERB'));
    await userEvent.click(screen.getByText('Chi Nhánh 1'));

    // Preview 4/6 phòng ban ban đầu (scope vào #org-chart-card — OrgUnitDetailPanel
    // mở song song cũng liệt kê tên phòng ban, không phân trang, nên phải tách
    // biệt để không đọc nhầm nguồn).
    expect(tree().getByText('Phòng Ban 1')).toBeInTheDocument();
    expect(tree().getByText('Phòng Ban 4')).toBeInTheDocument();
    expect(tree().queryByText('Phòng Ban 5')).not.toBeInTheDocument();
    expect(
      tree().getByText(/\+2 phòng ban khác — xem tất cả/),
    ).toBeInTheDocument();

    await userEvent.click(tree().getByText(/xem tất cả/));
    expect(tree().getByText('Phòng Ban 5')).toBeInTheDocument();
    expect(tree().getByText('Phòng Ban 6')).toBeInTheDocument();

    // "Thu gọn" trùng tên với nút collapse-all ở toolbar — chỉ định selector
    // div (nút toolbar là <button>) để nhắm đúng nút thu gọn phòng ban.
    await userEvent.click(tree().getByText('Thu gọn', { selector: 'div' }));
    expect(tree().queryByText('Phòng Ban 5')).not.toBeInTheDocument();
  });

  it('đổi filter đơn vị sẽ xóa lựa chọn phòng ban đang mở', async () => {
    renderWithProviders(<OrgChartPage />);
    await userEvent.click(screen.getByText('Công Ty ERB'));
    await userEvent.click(screen.getByText('Chi Nhánh 1'));
    await userEvent.click(tree().getByText('Phòng Ban 1'));

    expect(screen.getByText('Danh sách nhân viên')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /mở trang phòng ban/i }),
    ).toBeInTheDocument();

    // Đổi filter "Tất cả đơn vị" sang "Công Ty ERB" — Select antd thật render
    // input[role=combobox] kèm 1 input ẩn hỗ trợ accessibility, dùng input
    // đầu tiên (ô search hiển thị) để mở dropdown.
    const combobox = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(combobox);
    const option = await screen.findByTitle('Công Ty ERB');
    await userEvent.click(option);

    // Panel phòng ban phải đóng (selectedDepartmentId reset về null)
    expect(
      screen.queryByRole('button', { name: /mở trang phòng ban/i }),
    ).not.toBeInTheDocument();
  });

  it('hiện thông báo thiếu quyền khi API trả 403 (đúng permission code còn thiếu)', () => {
    mockAllHooks({ orgError: forbidden403() });
    renderWithProviders(<OrgChartPage />);

    expect(
      screen.getByText(/không có quyền xem sơ đồ tổ chức/i),
    ).toBeInTheDocument();
    expect(screen.getByText('ORG_VIEW')).toBeInTheDocument();
    expect(screen.queryByText('DEPT_VIEW')).not.toBeInTheDocument();
    expect(screen.queryByText('EMP_VIEW')).not.toBeInTheDocument();
  });

  it('403 tổng hợp đủ các permission code thiếu khi nhiều API cùng lỗi', () => {
    mockAllHooks({
      orgError: forbidden403(),
      deptError: forbidden403(),
      empError: forbidden403(),
    });
    renderWithProviders(<OrgChartPage />);

    expect(screen.getByText('ORG_VIEW')).toBeInTheDocument();
    expect(screen.getByText('DEPT_VIEW')).toBeInTheDocument();
    expect(screen.getByText('EMP_VIEW')).toBeInTheDocument();
  });

  it('ẩn nút Xuất PDF khi không có quyền ORG_EXPORT', () => {
    withPermissions(['ORG_VIEW']);
    renderWithProviders(<OrgChartPage />);
    expect(screen.queryByText(/xuất pdf/i)).not.toBeInTheDocument();
  });

  it('hiện nút Xuất PDF khi có quyền ORG_EXPORT và gọi export khi click', async () => {
    withPermissions(['ORG_VIEW', 'ORG_EXPORT']);
    renderWithProviders(<OrgChartPage />);

    const pdfBtn = screen.getByText(/xuất pdf/i);
    expect(pdfBtn).toBeInTheDocument();
    await userEvent.click(pdfBtn);
    expect(mockExportChartPdf).toHaveBeenCalledTimes(1);
  });

  it('Super Admin luôn thấy nút Xuất PDF dù không có permission_codes', () => {
    withPermissions([], true);
    renderWithProviders(<OrgChartPage />);
    expect(screen.getByText(/xuất pdf/i)).toBeInTheDocument();
  });
});
