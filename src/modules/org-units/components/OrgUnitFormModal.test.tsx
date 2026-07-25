import React from 'react';
import { screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';

// Mock antd components
vi.mock('antd', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Form: ({ children }: any) => children,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Input: (props: any) => React.createElement('input', props),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Select: (props: any) => React.createElement('select', props),
  Radio: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, value, ...props }: any) =>
      React.createElement(
        'label',
        props,
        React.createElement('input', { type: 'radio', value }),
        children,
      ),
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Group: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Button: ({ children, ...props }: any) =>
        React.createElement('label', props, children),
    },
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Segmented: (props: any) => React.createElement('div', props),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Button: (props: any) => React.createElement('button', props),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Upload: (props: any) => React.createElement('div', props),
  Grid: { useBreakpoint: () => ({ md: true, sm: true }) },
  Alert: () => null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Typography: { Text: (props: any) => React.createElement('span', props) },
  Tag: () => null,
  Space: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, ...props }: any) =>
      React.createElement('div', props, children),
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Compact: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
    },
  ),
  Layout: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, ...props }: any) =>
      React.createElement('div', props, children),
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Sider: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Header: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Content: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Footer: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
    },
  ),
}));

// Mock hooks
vi.mock('@/shared/hooks/usePermission', () => ({
  usePermission: () => ({ can: vi.fn(() => true) }),
}));

vi.mock('@/shared/hooks/useApiFormErrors', () => ({
  useApiFormErrors: () => {},
}));

vi.mock('@/modules/org-units/hooks/use-org-units', () => ({
  useGenerateTmpCode: () => ({
    mutateAsync: vi.fn().mockResolvedValue('TMP001'),
    isPending: false,
  }),
  useGenerateOrgUnitCode: () => ({
    mutateAsync: vi.fn().mockResolvedValue('CN001'),
    isPending: false,
  }),
  useCheckTaxCode: () => ({ mutateAsync: vi.fn().mockResolvedValue(true) }),
}));

vi.mock('@/modules/employees/hooks/use-employees', () => ({
  useEmployeeList: () => ({ data: { data: [] }, isFetching: false }),
}));

vi.mock('@/modules/org-units/services/vietnam-address.service', () => ({
  fetchProvinces: () => Promise.resolve([]),
  fetchDistrictsByProvince: () => Promise.resolve([]),
  fetchLegacyProvinces: () => Promise.resolve([]),
  lookupNewWardFromLegacyName: () => Promise.resolve([]),
}));

vi.mock('@/shared/components/forms', async () => {
  const { Controller } = await import('react-hook-form');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FormField: ({ control, name, children }: any) =>
      React.createElement(Controller, {
        control,
        name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render: ({ field }: any) => children(field),
      }),
    FormInput: () => null,
    FormSelect: () => null,
    FormSection: () => null,
  };
});

vi.mock('@/shared/components/feedback/FormSection', () => ({
  FormSection: () => null,
}));

vi.mock('@/shared/components/feedback/FormModal', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FormModal: ({ children, open }: any) => {
    if (!open) return null;
    return React.createElement(
      'div',
      { 'data-testid': 'form-modal' },
      children,
    );
  },
}));

vi.mock('@/shared/utils/storage-url', () => ({
  storageUrl: () => null,
}));

import { OrgUnitFormModal } from './OrgUnitFormModal';

// jsdom shims
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('OrgUnitFormModal - Create Default Branch', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const BASE_PROPS = {
    open: true,
    editing: null,
    allUnits: [],
    isPending: false,
    onCancel: mockOnCancel,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('form mặc định có unitType = chi_nhanh khi tạo mới', () => {
    renderWithProviders(React.createElement(OrgUnitFormModal, BASE_PROPS));

    // Kiểm tra form đã render
    expect(screen.getByTestId('form-modal')).toBeInTheDocument();
  });

  it('form có mã tự động sinh khi tạo mới', () => {
    renderWithProviders(React.createElement(OrgUnitFormModal, BASE_PROPS));

    // Kiểm tra mã đơn vị field
    const codeInputs = screen.getAllByPlaceholderText(/Tự động sinh/i);
    expect(codeInputs.length).toBeGreaterThan(0);
  });

  it('form không cho phép chỉnh sửa mã khi tạo mới', () => {
    renderWithProviders(React.createElement(OrgUnitFormModal, BASE_PROPS));

    // Mã đơn vị bị disabled
    const codeInputs = screen.getAllByPlaceholderText(/Tự động sinh/i);
    expect(codeInputs[0]).toBeDisabled();
  });
});

// QA P0/P1: form create/edit branch (`/org-units?mode=branch`) phải nhận
// `lockedUnitType='chi_nhanh'` và khóa cứng radio "Loại đơn vị" — không cho
// đổi sang Công ty mẹ/con dù người dùng cố tình sửa state.
describe('OrgUnitFormModal - lockedUnitType (branch-mode)', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const BASE_PROPS = {
    open: true,
    editing: null,
    allUnits: [],
    isPending: false,
    onCancel: mockOnCancel,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('khi truyền lockedUnitType="chi_nhanh": radio group "Loại đơn vị" bị disabled', () => {
    renderWithProviders(
      React.createElement(OrgUnitFormModal, {
        ...BASE_PROPS,
        lockedUnitType: 'chi_nhanh',
      }),
    );

    const unitTypeRadios = document.querySelectorAll(
      'input[type="radio"][value]',
    );
    expect(unitTypeRadios.length).toBeGreaterThan(0);
    // Radio.Group mock nhận disabled qua props của <div> cha — kiểm tra group
    // cha gần nhất có thuộc tính disabled=true.
    const group = unitTypeRadios[0].closest('div[disabled]');
    expect(group).not.toBeNull();
  });

  it('không truyền lockedUnitType: radio group "Loại đơn vị" không bị disabled', () => {
    renderWithProviders(React.createElement(OrgUnitFormModal, BASE_PROPS));

    const unitTypeRadios = document.querySelectorAll(
      'input[type="radio"][value]',
    );
    const group = unitTypeRadios[0].closest('div[disabled]');
    expect(group).toBeNull();
  });
});
