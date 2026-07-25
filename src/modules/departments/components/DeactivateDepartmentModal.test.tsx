import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import {
  DeactivateDepartmentModal,
  type DeactivateDepartmentModalProps,
} from './DeactivateDepartmentModal';
import type { Department } from '../types/departments.types';

// Mocks and shims
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({ matches: false })),
});

const MOCK_DEPT: Department = {
  id: 101,
  code: 'MKT',
  name: 'Phòng Marketing',
  departmentType: 'phong_ban',
  orgUnitId: 1,
  orgUnitName: 'Đơn vị chính',
  parentId: null,
  managerId: null,
  active: true,
  employeeCount: 5,
};

const onConfirm = vi.fn();
const onCancel = vi.fn();

const BASE_PROPS: DeactivateDepartmentModalProps = {
  open: true,
  department: MOCK_DEPT,
  loading: false,
  onCancel,
  onConfirm,
};

function renderModal(props?: Partial<DeactivateDepartmentModalProps>) {
  return renderWithProviders(
    <DeactivateDepartmentModal {...BASE_PROPS} {...props} />,
  );
}

// API thật (DELETE /departments/{id}/soft-delete) không nhận body — modal chỉ
// còn vai trò xác nhận 2 checkbox rồi gọi onConfirm() không tham số.
describe('DeactivateDepartmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Nút xác nhận bị vô hiệu hóa khi chưa check các checkbox (còn nhân sự)', () => {
    renderModal();
    const confirmBtn = screen.getByRole('button', { name: 'Xóa' });
    expect(confirmBtn).toBeDisabled();
  });

  it('Nút xác nhận được kích hoạt khi đã check đủ các checkbox', async () => {
    renderModal();
    const confirmBtn = screen.getByRole('button', { name: 'Xóa' });

    await userEvent.click(screen.getByText(/Tôi hiểu rằng/));
    await userEvent.click(screen.getByText(/Tôi đã đọc và hiểu quy định/));

    expect(confirmBtn).not.toBeDisabled();
  });

  it('Gọi onConfirm() không tham số khi nhấn nút xác nhận', async () => {
    renderModal();

    await userEvent.click(screen.getByText(/Tôi hiểu rằng/));
    await userEvent.click(screen.getByText(/Tôi đã đọc và hiểu quy định/));
    await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
      expect(onConfirm).toHaveBeenCalledWith();
    });
  });

  it('Phòng ban không còn nhân sự: chỉ cần check quy định 14 ngày', async () => {
    renderModal({
      department: { ...MOCK_DEPT, employeeCount: 0 },
    });

    await userEvent.click(screen.getByText(/Tôi đã đọc và hiểu quy định/));
    await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  it('Hiển thị số nhân sự lấy từ Department.employeeCount (không gọi API impact-stats)', () => {
    renderModal();
    expect(
      screen.getByText(/Tôi hiểu rằng phòng ban này đang có/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/5\s*nhân sự/).length).toBeGreaterThan(0);
  });
});
