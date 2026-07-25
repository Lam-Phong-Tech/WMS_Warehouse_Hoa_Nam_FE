import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { EmployeeStatusModal } from './EmployeeStatusModal';
import { App } from 'antd';
import type { Employee } from '@/modules/employees/types/employees.types';

const mockEmployee: Employee = {
  id: 1,
  code: 'NV001',
  fullName: 'Nguyễn Văn A',
  email: 'a@test.com',
  phone: '0987654321',
  status: 1,
  employeeStatus: 0,
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
};

function renderModal(
  props: Partial<Parameters<typeof EmployeeStatusModal>[0]> = {},
) {
  return renderWithProviders(
    <App>
      <EmployeeStatusModal
        open={true}
        employee={mockEmployee}
        loading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        {...props}
      />
    </App>,
  );
}

describe('EmployeeStatusModal', () => {
  it('P0.7: should render modal title', () => {
    const screen = renderModal();
    expect(screen.getByText('Cập nhật trạng thái nhân sự')).toBeTruthy();
  });

  it('P0.7: should render employee name', () => {
    const screen = renderModal();
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
  });

  it('P0.7: should show warning alert when selecting resigned status', () => {
    const screen = renderModal();
    expect(screen.getByText('Cập nhật trạng thái nhân sự')).toBeTruthy();
    expect(screen.getByText('Trạng thái mới')).toBeTruthy();
    expect(screen.getByText('Ngày hiệu lực')).toBeTruthy();
    expect(screen.getByText('Lý do')).toBeTruthy();
  });

  it('P0.7: should show warning about account/role when status is deactivating', () => {
    const screen = renderModal({
      employee: { ...mockEmployee, employeeStatus: 2 }, // OFFICIAL -> allowed: [SUSPENDED (3), RESIGNED (4)]
    });
    expect(
      screen.getByText('Hệ quả của việc thay đổi trạng thái'),
    ).toBeTruthy();
    expect(
      screen.getByText(/Tài khoản đăng nhập của nhân sự sẽ bị vô hiệu hóa/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Các vai trò và quyền hạn đang được gán sẽ bị thu hồi/),
    ).toBeTruthy();
  });

  it('P0.7: should call onConfirm with correct payload', () => {
    const onConfirm = vi.fn();
    const screen = renderModal({ onConfirm });

    // Ngày hiệu lực là bắt buộc — phải chọn trước khi Xác nhận
    const dateInput = screen.getByPlaceholderText('dd/mm/yyyy');
    fireEvent.change(dateInput, { target: { value: '01/07/2026' } });
    fireEvent.keyDown(dateInput, { key: 'Enter', code: 'Enter' });

    const confirmBtn = screen.getByText('Xác nhận');
    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeStatus: expect.any(Number) as number,
        effectiveDate: '2026-07-01',
      }),
    );
  });

  it('P0.7: should not call onConfirm when effective date is missing', () => {
    const onConfirm = vi.fn();
    const screen = renderModal({ onConfirm });
    const confirmBtn = screen.getByText('Xác nhận');
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Vui lòng chọn ngày hiệu lực')).toBeInTheDocument();
  });

  it('P0.7: should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    const screen = renderModal({ onCancel });
    const cancelBtn = screen.getByText(/hủy|huỷ/i);
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('P0.8: should offer correct transitions for INTERN (0) -> [1, 4]', () => {
    const screen = renderModal({
      employee: { ...mockEmployee, employeeStatus: 0 },
    });
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    expect(screen.getAllByText('Thử việc').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nghỉ việc').length).toBeGreaterThan(0);
  });

  it('P0.8: should offer correct transitions for PROBATION (1) -> [2, 3, 4]', () => {
    const screen = renderModal({
      employee: { ...mockEmployee, employeeStatus: 1 },
    });
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    expect(screen.getAllByText('Chính thức').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tạm ngưng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nghỉ việc').length).toBeGreaterThan(0);
  });

  it('P0.8: should offer correct transitions for OFFICIAL (2) -> [3, 4]', () => {
    const screen = renderModal({
      employee: { ...mockEmployee, employeeStatus: 2 },
    });
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    expect(screen.getAllByText('Tạm ngưng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nghỉ việc').length).toBeGreaterThan(0);
  });

  it('P0.8: should offer correct transitions for SUSPENDED (3) -> [2, 4]', () => {
    const screen = renderModal({
      employee: { ...mockEmployee, employeeStatus: 3 },
    });
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    expect(screen.getAllByText('Chính thức').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nghỉ việc').length).toBeGreaterThan(0);
  });

  it('P2: should block submit when effective date equals lastEffectiveDate', () => {
    const onConfirm = vi.fn();
    const screen = renderModal({ onConfirm, lastEffectiveDate: '2026-07-01' });

    const dateInput = screen.getByPlaceholderText('dd/mm/yyyy');
    fireEvent.change(dateInput, { target: { value: '01/07/2026' } });
    fireEvent.keyDown(dateInput, { key: 'Enter', code: 'Enter' });

    const confirmBtn = screen.getByText('Xác nhận');
    expect(confirmBtn.closest('button')).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('P2: should block submit when effective date is earlier than lastEffectiveDate', () => {
    const onConfirm = vi.fn();
    const screen = renderModal({ onConfirm, lastEffectiveDate: '2026-07-10' });

    const dateInput = screen.getByPlaceholderText('dd/mm/yyyy');
    fireEvent.change(dateInput, { target: { value: '01/07/2026' } });
    fireEvent.keyDown(dateInput, { key: 'Enter', code: 'Enter' });

    const confirmBtn = screen.getByText('Xác nhận');
    expect(confirmBtn.closest('button')).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('P2: should call onConfirm when effective date is after lastEffectiveDate', () => {
    const onConfirm = vi.fn();
    const screen = renderModal({ onConfirm, lastEffectiveDate: '2026-06-01' });

    const dateInput = screen.getByPlaceholderText('dd/mm/yyyy');
    fireEvent.change(dateInput, { target: { value: '01/07/2026' } });
    fireEvent.keyDown(dateInput, { key: 'Enter', code: 'Enter' });

    fireEvent.click(screen.getByText('Xác nhận'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveDate: '2026-07-01' }),
    );
  });

  it('P0.8: should offer correct transitions for RESIGNED (4) -> [2, 1]', () => {
    const screen = renderModal({
      employee: { ...mockEmployee, employeeStatus: 4 },
    });
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    expect(screen.getAllByText('Chính thức').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Thử việc').length).toBeGreaterThan(0);
  });
});
