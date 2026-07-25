import React from 'react';
import { screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import type { OrgUnitTreeNode } from '../types/org-units.types';

// Mock the barrel export completely to avoid loading real antd components
vi.mock('@/shared/components', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTable: ({ columns, dataSource }: any) => {
    return React.createElement('div', { 'data-testid': 'data-table' }, [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columns?.map((col: any) =>
        React.createElement(
          'div',
          { key: col.key, 'data-testid': `data-col-key-${col.key}` },
          col.title,
        ),
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dataSource?.map((record: any) =>
        React.createElement(
          'div',
          { key: record.id, 'data-record-id': record.id },
          record.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          columns?.map((col: any) =>
            React.createElement(
              'div',
              { key: col.key },
              col.render
                ? col.render(record[col.dataIndex], record)
                : record[col.dataIndex],
            ),
          ),
        ),
      ),
    ]);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StatusTag: ({ status, labelMap }: any) => {
    return React.createElement(
      'span',
      { 'data-testid': `status-${status}` },
      labelMap?.[status] || status,
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ActionDropdown: ({ items }: any) => {
    return React.createElement(
      'div',
      { 'data-testid': 'action-dropdown' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.map((item: any) =>
        React.createElement(
          'button',
          {
            key: item.key,
            'data-testid': `action-${item.key}`,
            onClick: item.onClick,
            disabled: item.disabled || item.loading,
          },
          item.label,
        ),
      ),
    );
  },
  ActionItem: {},
}));

// Mock permission hook
const mockCan = vi.fn(() => true);
vi.mock('@/shared/hooks/usePermission', () => ({
  usePermission: () => ({
    can: mockCan(),
  }),
}));

import { OrgUnitsTable } from './OrgUnitsTable';

// jsdom shims
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

// Fixtures
const MOCK_DATA: OrgUnitTreeNode[] = [
  {
    id: 1,
    code: 'CTY-ME',
    name: 'Công ty mẹ A',
    unitType: 'cong_ty_me',
    parentId: null,
    active: true,
    children: [
      {
        id: 2,
        code: 'CTY-CON',
        name: 'Công ty con B',
        unitType: 'cong_ty_con',
        parentId: 1,
        active: true,
        children: [],
      },
    ],
  },
];

const NAME_BY_ID = new Map([
  [1, 'Công ty mẹ A'],
  [2, 'Công ty con B'],
]);

const BASE_PROPS = {
  data: MOCK_DATA,
  loading: false,
  nameById: NAME_BY_ID,
  onEdit: vi.fn(),
  onDeactivate: vi.fn(),
  onView: vi.fn(),
  onRestore: vi.fn(),
  onArchive: vi.fn(),
  deactivatingId: undefined,
  restoringId: undefined,
  archivingId: undefined,
  serverPagination: undefined,
  onSortChange: undefined,
  permissions: undefined,
  selectedRowKeys: undefined,
  onSelectionChange: undefined,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderTable(props?: Partial<any>) {
  return renderWithProviders(
    React.createElement(OrgUnitsTable, { ...BASE_PROPS, ...props }),
  );
}

// Tests
describe('OrgUnitsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
  });

  it('render bảng với dữ liệu', () => {
    renderTable();
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  it('hiển thị cột Mã, Tên, Loại, Đơn vị cha, Trạng thái, Thao tác', () => {
    renderTable();
    expect(screen.getByTestId('data-col-key-code')).toBeInTheDocument();
    expect(screen.getByTestId('data-col-key-name')).toBeInTheDocument();
    expect(screen.getByTestId('data-col-key-unitType')).toBeInTheDocument();
    expect(screen.getByTestId('data-col-key-parentUnit')).toBeInTheDocument();
    expect(screen.getByTestId('data-col-key-status')).toBeInTheDocument();
    expect(screen.getByTestId('data-col-key-actions')).toBeInTheDocument();
  });

  it('hiển thị trạng thái Hoạt động cho đơn vị active', () => {
    renderTable();
    expect(screen.getByTestId('status-active')).toBeInTheDocument();
  });

  it('ẩn nút Sửa và hiển thị Khôi phục khi đơn vị soft_deleted', () => {
    const softDeletedData: OrgUnitTreeNode[] = [
      {
        id: 1,
        code: 'CTY-ME',
        name: 'Công ty mẹ A',
        unitType: 'cong_ty_me',
        parentId: null,
        active: false,
        deletedAt: '2026-06-28T12:00:00Z',
        children: [],
      },
    ];

    renderTable({ data: softDeletedData, onRestore: vi.fn() });

    // Soft-deleted không hiển thị Sửa, chỉ có Khôi phục
    expect(screen.getByTestId('action-restore')).toBeInTheDocument();
    expect(screen.queryByTestId('action-edit')).not.toBeInTheDocument();
  });

  it('ẩn nút Sửa và hiển thị Lưu trữ khi đơn vị soft_deleted', () => {
    const softDeletedData: OrgUnitTreeNode[] = [
      {
        id: 1,
        code: 'CTY-ME',
        name: 'Công ty mẹ A',
        unitType: 'cong_ty_me',
        parentId: null,
        active: false,
        deletedAt: '2026-06-28T12:00:00Z',
        children: [],
      },
    ];

    renderTable({ data: softDeletedData, onArchive: vi.fn() });

    // Soft-deleted không hiển thị Sửa, chỉ có Lưu trữ
    expect(screen.getByTestId('action-archive')).toBeInTheDocument();
    expect(screen.queryByTestId('action-edit')).not.toBeInTheDocument();
  });

  it('hiển thị trạng thái Ngừng hoạt động cho đơn vị inactive', () => {
    const inactiveData: OrgUnitTreeNode[] = [
      {
        id: 1,
        code: 'CTY-ME',
        name: 'Công ty mẹ A',
        unitType: 'cong_ty_me',
        parentId: null,
        active: false,
        children: [],
      },
    ];

    renderTable({ data: inactiveData });
    expect(screen.getByTestId('status-inactive')).toBeInTheDocument();
  });

  it('hiển thị trạng thái Đã xóa mềm cho đơn vị soft_deleted', () => {
    const softDeletedData: OrgUnitTreeNode[] = [
      {
        id: 1,
        code: 'CTY-ME',
        name: 'Công ty mẹ A',
        unitType: 'cong_ty_me',
        parentId: null,
        active: false,
        deletedAt: '2026-06-28T12:00:00Z',
        children: [],
      },
    ];

    renderTable({ data: softDeletedData });
    expect(screen.getByTestId('status-soft_deleted')).toBeInTheDocument();
  });

  it('ẩn cột Tỉnh/TP khi canViewProvince = false', () => {
    mockCan.mockReturnValue(false);
    renderTable();
    expect(
      screen.queryByTestId('data-col-key-province'),
    ).not.toBeInTheDocument();
  });

  it('ẩn cột Người đại diện khi canViewManager = false', () => {
    mockCan.mockReturnValue(false);
    renderTable();
    expect(
      screen.queryByTestId('data-col-key-representative'),
    ).not.toBeInTheDocument();
  });

  it('hiển thị cột Tỉnh/TP khi canViewProvince = true', () => {
    mockCan.mockReturnValue(true);
    renderTable();
    expect(screen.getByTestId('data-col-key-province')).toBeInTheDocument();
  });

  it('hiển thị cột Người đại diện khi canViewManager = true', () => {
    mockCan.mockReturnValue(true);
    renderTable();
    expect(
      screen.getByTestId('data-col-key-representative'),
    ).toBeInTheDocument();
  });
});
