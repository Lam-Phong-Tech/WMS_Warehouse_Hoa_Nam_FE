import { screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { DepartmentTree } from './DepartmentTree';
import type { DepartmentTreeNode } from '../types/departments.types';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({ matches: false })),
});

const TREE: DepartmentTreeNode[] = [
  {
    id: 1,
    code: 'PB1',
    name: 'Phòng Kinh doanh',
    departmentType: 'phong_ban',
    orgUnitId: 10,
    orgUnitName: 'Công ty A',
    parentId: null,
    managerId: null,
    active: true,
    children: [
      {
        id: 2,
        code: 'NT1',
        name: 'Nhóm bán hàng',
        departmentType: 'nhom_to',
        orgUnitId: 10,
        orgUnitName: 'Công ty A',
        parentId: 1,
        managerId: null,
        active: true,
      },
    ],
  },
  {
    id: 3,
    code: 'PB2',
    name: 'Phòng Nhân sự',
    departmentType: 'phong_ban',
    orgUnitId: 20,
    orgUnitName: 'Công ty B',
    parentId: null,
    managerId: null,
    active: false,
  },
];

describe('DepartmentTree filter', () => {
  it('shows all nodes when no filter is applied', () => {
    renderWithProviders(
      <DepartmentTree
        treeData={TREE}
        keyword=""
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/PB1/)).toBeInTheDocument();
    expect(screen.getByText(/PB2/)).toBeInTheDocument();
  });

  it('filters by orgFilter even without a keyword', () => {
    renderWithProviders(
      <DepartmentTree
        treeData={TREE}
        keyword=""
        orgFilter={20}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByText(/PB1/)).not.toBeInTheDocument();
    expect(screen.getByText(/PB2/)).toBeInTheDocument();
  });

  it('filters by statusFilter even without a keyword', () => {
    renderWithProviders(
      <DepartmentTree
        treeData={TREE}
        keyword=""
        statusFilter="inactive"
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByText(/PB1/)).not.toBeInTheDocument();
    expect(screen.getByText(/PB2/)).toBeInTheDocument();
  });

  it('P1: loại bỏ child không khớp statusFilter dù parent khớp (không giữ nguyên cả nhánh)', () => {
    const treeWithMixedStatusChild: DepartmentTreeNode[] = [
      {
        id: 1,
        code: 'PB1',
        name: 'Phòng Kinh doanh',
        departmentType: 'phong_ban',
        orgUnitId: 10,
        orgUnitName: 'Công ty A',
        parentId: null,
        managerId: null,
        active: true, // parent khớp statusFilter="active"
        children: [
          {
            id: 2,
            code: 'NT1',
            name: 'Nhóm bán hàng',
            departmentType: 'nhom_to',
            orgUnitId: 10,
            orgUnitName: 'Công ty A',
            parentId: 1,
            managerId: null,
            active: false, // child KHÔNG khớp statusFilter="active"
          },
        ],
      },
    ];

    renderWithProviders(
      <DepartmentTree
        treeData={treeWithMixedStatusChild}
        keyword=""
        statusFilter="active"
        selectedId={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText(/PB1/)).toBeInTheDocument();
    expect(screen.queryByText(/NT1/)).not.toBeInTheDocument();
  });

  it('P1: loại bỏ child không khớp orgFilter dù parent khớp (không giữ nguyên cả nhánh)', () => {
    const treeWithMixedOrgChild: DepartmentTreeNode[] = [
      {
        id: 1,
        code: 'PB1',
        name: 'Phòng Kinh doanh',
        departmentType: 'phong_ban',
        orgUnitId: 10,
        orgUnitName: 'Công ty A',
        parentId: null,
        managerId: null,
        active: true,
        children: [
          {
            id: 2,
            code: 'NT1',
            name: 'Nhóm bán hàng',
            departmentType: 'nhom_to',
            orgUnitId: 99, // KHÔNG khớp orgFilter=10
            orgUnitName: 'Công ty khác',
            parentId: 1,
            managerId: null,
            active: true,
          },
        ],
      },
    ];

    renderWithProviders(
      <DepartmentTree
        treeData={treeWithMixedOrgChild}
        keyword=""
        orgFilter={10}
        selectedId={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText(/PB1/)).toBeInTheDocument();
    expect(screen.queryByText(/NT1/)).not.toBeInTheDocument();
  });

  it('combines keyword, org and status filters', () => {
    renderWithProviders(
      <DepartmentTree
        treeData={TREE}
        keyword="NT1"
        orgFilter={10}
        statusFilter="active"
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/NT1/)).toBeInTheDocument();
    expect(screen.queryByText(/PB2/)).not.toBeInTheDocument();
  });
});
