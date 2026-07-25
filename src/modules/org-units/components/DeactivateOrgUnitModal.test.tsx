import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';
import {
  DeactivateOrgUnitModal,
  type DeactivateOrgUnitModalProps,
} from './DeactivateOrgUnitModal';
import type { OrgUnit } from '../types/org-units.types';

// ResizeObserver shim
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

const MOCK_UNIT: OrgUnit = {
  id: 1,
  code: 'CTY-ME',
  name: 'Tổng công ty',
  unitType: 'cong_ty_me',
  parentId: null,
  active: true,
};

const onConfirm = vi.fn();
const onCancel = vi.fn();

const BASE_PROPS: DeactivateOrgUnitModalProps = {
  open: true,
  unit: MOCK_UNIT,
  loading: false,
  onCancel,
  onConfirm,
};

function renderModal(props?: Partial<DeactivateOrgUnitModalProps>) {
  return renderWithProviders(
    <DeactivateOrgUnitModal {...BASE_PROPS} {...props} />,
  );
}

describe('DeactivateOrgUnitModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', async () => {
    renderModal();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Vô hiệu hóa đơn vị tổ chức')).toBeInTheDocument();
    expect(screen.getByText(/Tổng công ty/)).toBeInTheDocument();
  });

  it('displays the 14-day soft-delete BRD rules', () => {
    renderModal();
    expect(
      screen.getByText(/Quy định xóa mềm đơn vị \(14 ngày\):/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Toàn bộ nhân sự đang hoạt động/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Đã xóa chờ khôi phục/)).toBeInTheDocument();
    expect(screen.getByText(/Xóa vĩnh viễn/)).toBeInTheDocument();
  });

  it('triggers onCancel when Huỷ is clicked', async () => {
    renderModal();
    const cancelBtn = screen.getByText('Huỷ');
    await userEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows only the 14-day rule checkbox', () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);
  });

  it('submits correct payload on deactivate flow', async () => {
    renderModal();

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);

    const confirmBtn = screen.getByRole('button', {
      name: 'Xác nhận vô hiệu',
    });
    expect(confirmBtn).toBeEnabled();

    await userEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith({});
  });
});
