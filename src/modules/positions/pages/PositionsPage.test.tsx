import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';

const mockMutateInactive = vi.fn();
const mockMutateRestore = vi.fn();
const mockExportXlsx = vi.fn();

vi.mock('@/shared/utils/export-xlsx', () => ({
  exportXlsx: (...args: unknown[]) => mockExportXlsx(...args),
}));

vi.mock('@/modules/positions/hooks/use-positions', () => ({
  usePositions: () => ({ data: [] }),
  usePositionsPaged: vi.fn(),
  usePositionsTrashedPaged: vi.fn(),
  usePositionById: () => ({ data: null, isLoading: false }),
  useCreatePosition: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePosition: () => ({ mutate: vi.fn(), isPending: false }),
  useInactivePosition: () => ({
    mutate: mockMutateInactive,
    isPending: false,
  }),
  useRestorePosition: () => ({
    mutate: mockMutateRestore,
    isPending: false,
  }),
}));

// PositionsTable dùng antd Table thật (mocked) mà mock dùng chung của repo
// không implement rowSelection (không render checkbox) — thay vào đó expose
// 1 nút test bấm là "chọn tất cả" để có thể test luồng bulk-delete mà không
// phụ thuộc vào chi tiết UI checkbox của antd.
vi.mock('@/modules/positions/components/PositionsTable', () => ({
  PositionsTable: ({
    data,
    selectedRowKeys,
    onSelectionChange,
  }: {
    data: { id: number }[];
    selectedRowKeys?: React.Key[];
    onSelectionChange?: (keys: React.Key[], rows: unknown[]) => void;
  }) => (
    <div role="table">
      <button
        type="button"
        onClick={() =>
          onSelectionChange?.(
            data.map((p) => p.id),
            data,
          )
        }
      >
        chon-tat-ca-test
      </button>
      {data.map((p) => (
        <div key={p.id}>{JSON.stringify(p)}</div>
      ))}
      <div data-testid="selected-count">{selectedRowKeys?.length ?? 0}</div>
    </div>
  ),
}));

import { PositionsPage } from './PositionsPage';
import {
  usePositionsPaged,
  usePositionsTrashedPaged,
} from '@/modules/positions/hooks/use-positions';

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

const MOCK_POSITIONS = [
  {
    id: 1,
    code: 'CV001',
    name: 'Trưởng phòng',
    grade: 'M3',
    active: true,
    employeeCount: 5,
  },
  {
    id: 2,
    code: 'CV002',
    name: 'Nhân viên',
    grade: 'S1',
    active: true,
    employeeCount: 0,
  },
];

function withPermissions(codes: string[]) {
  useAuthStore.setState({
    permissionCodes: codes,
    isSuperAdmin: false,
    isProfileLoaded: true,
  });
}

function selectStatusFilter(label: RegExp) {
  const comboboxes = screen.getAllByRole('combobox');
  // Thứ tự trong PositionsFilter: [Cấp bậc, Trạng thái]
  const statusCombobox = comboboxes[comboboxes.length - 1];
  fireEvent.mouseDown(statusCombobox);
  const option = screen.getByRole('option', { name: label });
  fireEvent.click(option);
}

describe('PositionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withPermissions([
      'POS_VIEW',
      'POS_CREATE',
      'POS_EDIT',
      'POS_INACTIVE',
      'POS_EXPORT',
    ]);

    vi.mocked(usePositionsPaged).mockReturnValue({
      data: { data: MOCK_POSITIONS, meta: { total: MOCK_POSITIONS.length } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePositionsPaged>);

    vi.mocked(usePositionsTrashedPaged).mockReturnValue({
      data: { data: MOCK_POSITIONS, meta: { total: MOCK_POSITIONS.length } },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePositionsTrashedPaged>);
  });

  it('P1: canh bao tong so nhan su khi bulk-delete cac chuc vu dang co nguoi', async () => {
    renderWithProviders(<PositionsPage />);
    await screen.findByRole('table');

    fireEvent.click(screen.getByText('chon-tat-ca-test'));

    const bulkDeleteBtn = await screen.findByText(/vô hiệu hóa \(2\)/i);
    fireEvent.click(bulkDeleteBtn);

    // Cảnh báo phải cộng dồn employeeCount của các chức vụ đã chọn (5 + 0 = 5),
    // không chỉ đếm số dòng đã chọn như trước.
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        /có 1 chức vụ đang được gán cho tổng cộng 5 nhân sự/i,
      ),
    ).toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole('button', {
      name: /vô hiệu hóa/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateInactive).toHaveBeenCalledTimes(2);
    });
  });

  it('P1: xuat Excel o view "Vo hieu" dung du lieu client-side, khong lech voi UI', async () => {
    renderWithProviders(<PositionsPage />);

    selectStatusFilter(/vô hiệu/i);

    const exportExcelBtn = await screen.findByText(/xuất excel/i);
    fireEvent.click(exportExcelBtn);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /xuất/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockExportXlsx).toHaveBeenCalledTimes(1);
    });
    // Dữ liệu xuất phải lấy từ danh sách trashed đang hiển thị, không gọi
    // API export-excel?status=0 (sẽ lệch với danh sách trên UI).
    expect(mockExportXlsx.mock.calls[0][1]).toEqual(
      MOCK_POSITIONS.map((p) => [p.code, p.name, p.grade, p.employeeCount]),
    );
  });

  it('P1: chan xuat PDF o view "Vo hieu" va bao ro ly do thay vi xuat sai du lieu', async () => {
    renderWithProviders(<PositionsPage />);

    selectStatusFilter(/vô hiệu/i);

    const exportPdfBtn = await screen.findByText(/xuất pdf/i);
    fireEvent.click(exportPdfBtn);

    expect(
      await screen.findByText(/chưa hỗ trợ xuất pdf cho view/i),
    ).toBeInTheDocument();
  });
});
