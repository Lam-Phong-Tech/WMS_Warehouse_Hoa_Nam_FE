import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { EmployeeFormModal } from './EmployeeFormModal';
import { App } from 'antd';
import { EmployeeStatus } from '@/modules/employees/types/employees.types';
import type { Employee } from '@/modules/employees/types/employees.types';

function renderModal(
  props: Partial<Parameters<typeof EmployeeFormModal>[0]> = {},
) {
  return renderWithProviders(
    <App>
      <EmployeeFormModal
        open={true}
        editing={null}
        submitting={false}
        orgUnitOptions={[{ value: 1, label: 'Đơn vị A' }]}
        departments={[
          {
            id: 1,
            code: 'PB1',
            name: 'Phòng ban B',
            departmentType: 'phong_ban',
            orgUnitId: 1,
            orgUnitName: 'Đơn vị A',
            parentId: null,
            managerId: null,
            active: true,
          },
        ]}
        positionOptions={[{ value: 1, label: 'Chức vụ C' }]}
        employees={[]}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        apiErrors={null}
        {...props}
      />
    </App>,
  );
}

describe('EmployeeFormModal', () => {
  it('P0.6: should render the form title for creating', () => {
    const screen = renderModal();
    expect(screen.getByText('Thêm nhân sự')).toBeTruthy();
  });

  it('P0.6: should render the form title for editing', () => {
    const screen = renderModal({
      editing: {
        id: 1,
        code: 'NV001',
        fullName: 'Nguyễn Văn A',
        email: 'a@test.com',
        phone: '0987654321',
        status: 1,
        employeeStatus: EmployeeStatus.OFFICIAL,
      },
    });
    expect(screen.getByText('Sửa nhân sự')).toBeTruthy();
  });

  it('P0.6: should render required fields', () => {
    const screen = renderModal();
    expect(screen.getByText('Họ và tên')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Số điện thoại')).toBeTruthy();
    expect(screen.getByText('Ngày sinh')).toBeTruthy();
    expect(screen.getByText('Giới tính')).toBeTruthy();
    expect(screen.getByText('Địa chỉ')).toBeTruthy();
    expect(screen.getByText('Số CCCD / CMND')).toBeTruthy();
    expect(screen.getByText('Chi nhánh / Đơn vị')).toBeTruthy();
    expect(screen.getByText('Phòng ban')).toBeTruthy();
    expect(screen.getByText('Chức vụ')).toBeTruthy();
    expect(screen.getByText('Người quản lý')).toBeTruthy();
    expect(screen.getByText('Ngày vào làm')).toBeTruthy();
    expect(screen.getByText('Trạng thái')).toBeTruthy();
  });

  it('P0.6: should display API field errors', () => {
    const screen = renderModal({
      apiErrors: { email: 'Email đã tồn tại trong hệ thống' },
    });
    expect(screen.getByText('Email đã tồn tại trong hệ thống')).toBeTruthy();
  });

  it('P0.6: should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    const screen = renderModal({ onCancel });
    const cancelBtn = screen.getByText(/hủy|huỷ/i);
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('P0.1: should show manager options matching the selected org unit assignment', async () => {
    const user = userEvent.setup();
    const managerCandidate: Employee = {
      id: 2,
      code: 'NV002',
      fullName: 'Trần Thị B',
      email: 'b@test.com',
      phone: '0987654322',
      status: 1,
      employeeStatus: EmployeeStatus.OFFICIAL,
      assignments: [
        {
          id: 1,
          employee_id: 2,
          org_unit_id: 1,
          department_id: 1,
          position_id: 1,
          manager_id: null,
          is_primary: true,
          status: 1,
        },
      ],
    };
    const screen = renderModal({ employees: [managerCandidate] });

    // Chọn "Chi nhánh / Đơn vị" trước — managerOptions chỉ lọc được khi có orgUnitId
    const orgUnitCombobox = screen.baseElement.querySelector(
      'div[name="orgUnitId"] input[role="combobox"]',
    ) as HTMLElement;
    fireEvent.mouseDown(orgUnitCombobox);
    const orgUnitOption = await screen.findByTitle('Đơn vị A');
    await user.click(orgUnitOption);

    // Gõ vào ô "Người quản lý" để kích hoạt autocomplete (minSearchLength: 1)
    const managerInput = screen.baseElement.querySelector(
      '.ant-select-auto-complete input[role="combobox"]',
    ) as HTMLElement;
    await user.type(managerInput, 'B');

    expect(
      await screen.findByText('NV002 — Trần Thị B', {}, { timeout: 20000 }),
    ).toBeInTheDocument();
  });
});
