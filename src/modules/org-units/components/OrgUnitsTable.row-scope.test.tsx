import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { cleanupTestState } from '@/test/setup';
import { useAuthStore } from '@/shared/store/auth.store';
import { OrgUnitsTable } from './OrgUnitsTable';
import type { OrgUnitTreeNode } from '../types/org-units.types';

const mockUseOrgUnits = {
  data: [] as OrgUnitTreeNode[],
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  pagination: { current: 1, pageSize: 10, total: 0 },
  filters: {},
  setPagination: vi.fn(),
  setFilters: vi.fn(),
  setSorting: vi.fn(),
  sorting: null,
};

vi.mock('@/modules/org-units/hooks/use-org-units', () => ({
  useOrgUnits: () => mockUseOrgUnits,
}));

const baseOrgUnit = (
  overrides?: Partial<OrgUnitTreeNode>,
): OrgUnitTreeNode => ({
  id: 1,
  name: 'Chi nhánh Hà Nội',
  code: 'HN',
  unitType: 'chi_nhanh',
  parentId: null,
  active: true,
  children: [],
  ...overrides,
});

describe('OrgUnitsTable - row-level data scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupTestState();
    useAuthStore.setState({
      permissionCodes: [
        'ORG_VIEW',
        'ORG_EDIT',
        'ORG_INACTIVE',
        'ORG_FORCE_DELETE',
      ],
      isSuperAdmin: false,
      isProfileLoaded: true,
      currentContext: {
        scope_type: 'co_so',
        org_unit_id: 1,
        department_id: 5,
      } as never,
    });
  });

  it('renders in-scope records for user with co_so scope', () => {
    const inScopeRecord = baseOrgUnit({ id: 1, name: 'Chi nhánh Hà Nội' });
    mockUseOrgUnits.data = [inScopeRecord];
    mockUseOrgUnits.pagination.total = 1;

    renderWithProviders(
      <OrgUnitsTable
        data={[inScopeRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );

    expect(screen.getByText('Chi nhánh Hà Nội')).toBeInTheDocument();
  });

  it('hides out-of-scope records for user without permission', () => {
    const outOfScopeRecord = baseOrgUnit({ id: 2, name: 'Chi nhánh TP.HCM' });
    mockUseOrgUnits.data = [outOfScopeRecord];
    mockUseOrgUnits.pagination.total = 0;
    useAuthStore.setState({
      currentContext: {
        scope_type: 'co_so',
        org_unit_id: 99,
        department_id: 5,
      } as never,
    });

    renderWithProviders(
      <OrgUnitsTable
        data={[outOfScopeRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );

    expect(screen.queryByText('Chi nhánh TP.HCM')).not.toBeInTheDocument();
  });

  it('shows empty state when no records in scope', () => {
    mockUseOrgUnits.data = [];
    mockUseOrgUnits.pagination.total = 0;
    useAuthStore.setState({
      currentContext: {
        scope_type: 'co_so',
        org_unit_id: 1,
        department_id: 5,
      } as never,
    });

    renderWithProviders(
      <OrgUnitsTable
        data={[]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );

    expect(screen.getByText(/không có dữ liệu/i)).toBeInTheDocument();
  });

  it('shows action buttons for in-scope active branch (co_so)', () => {
    const inScopeRecord = baseOrgUnit({ id: 1, active: true });
    mockUseOrgUnits.data = [inScopeRecord];
    mockUseOrgUnits.pagination.total = 1;

    renderWithProviders(
      <OrgUnitsTable
        data={[inScopeRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onRestore={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    // Open action dropdown
    const actionButton = screen.getByLabelText(/Xem đơn vị/i);
    actionButton.click();

    // Should see edit and deactivate for active in-scope branch
    expect(screen.getByText('Sửa')).toBeInTheDocument();
    expect(screen.getByText('Vô hiệu')).toBeInTheDocument();
    // Should NOT see restore/archive for active branch
    expect(screen.queryByText('Khôi phục')).not.toBeInTheDocument();
    expect(screen.queryByText('Lưu trữ')).not.toBeInTheDocument();
  });

  it('hides edit/deactivate for out-of-scope active branch (co_so)', () => {
    const outOfScopeRecord = baseOrgUnit({ id: 2, active: true });
    mockUseOrgUnits.data = [outOfScopeRecord];
    mockUseOrgUnits.pagination.total = 0;
    useAuthStore.setState({
      currentContext: {
        scope_type: 'co_so',
        org_unit_id: 99,
        department_id: 5,
      } as never,
    });

    renderWithProviders(
      <OrgUnitsTable
        data={[outOfScopeRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onRestore={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    // Record is hidden entirely due to scope filter
    expect(screen.queryByText('Chi nhánh TP.HCM')).not.toBeInTheDocument();
  });

  it('shows only restore/archive for inactive in-scope branch', () => {
    const inactiveRecord = baseOrgUnit({
      id: 1,
      active: false,
      deletedAt: '2026-07-20T10:00:00Z',
    });
    mockUseOrgUnits.data = [inactiveRecord];
    mockUseOrgUnits.pagination.total = 1;

    renderWithProviders(
      <OrgUnitsTable
        data={[inactiveRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onRestore={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    const actionButton = screen.getByLabelText(/Xem đơn vị/i);
    actionButton.click();

    // Should see restore and archive for inactive in-scope branch
    expect(screen.getByText('Khôi phục')).toBeInTheDocument();
    expect(screen.getByText('Lưu trữ')).toBeInTheDocument();
    // Should NOT see edit/deactivate for inactive branch
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
    expect(screen.queryByText('Vô hiệu')).not.toBeInTheDocument();
  });

  it('allows super admin to see all actions regardless of scope', () => {
    const anyRecord = baseOrgUnit({ id: 1, active: true });
    mockUseOrgUnits.data = [anyRecord];
    mockUseOrgUnits.pagination.total = 1;
    useAuthStore.setState({
      isSuperAdmin: true,
      currentContext: {
        scope_type: 'he_thong',
        org_unit_id: null,
        department_id: null,
      } as never,
    });

    renderWithProviders(
      <OrgUnitsTable
        data={[anyRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onRestore={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    const actionButton = screen.getByLabelText(/Xem đơn vị/i);
    actionButton.click();

    // Super admin sees all actions
    expect(screen.getByText('Sửa')).toBeInTheDocument();
    expect(screen.getByText('Vô hiệu')).toBeInTheDocument();
    expect(screen.getByText('Khôi phục')).toBeInTheDocument();
    expect(screen.getByText('Lưu trữ')).toBeInTheDocument();
  });

  it('filters by phong_ban scope via department_id on record', () => {
    const dept3Record = baseOrgUnit({ id: 1 }) as OrgUnitTreeNode & {
      departmentId?: number | null;
    };
    const dept5Record = baseOrgUnit({
      id: 2,
      name: 'Chi nhánh TP.HCM',
    }) as OrgUnitTreeNode & { departmentId?: number | null };
    dept3Record.departmentId = 3;
    dept5Record.departmentId = 5;
    mockUseOrgUnits.data = [dept3Record, dept5Record];
    mockUseOrgUnits.pagination.total = 2;
    useAuthStore.setState({
      currentContext: {
        scope_type: 'phong_ban',
        org_unit_id: 1,
        department_id: 3,
      } as never,
    });

    renderWithProviders(
      <OrgUnitsTable
        data={[dept3Record, dept5Record]}
        nameById={
          new Map([
            [1, 'Chi nhánh Hà Nội'],
            [2, 'Chi nhánh TP.HCM'],
          ])
        }
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );

    // Only dept3 record should be visible
    expect(screen.getByText('Chi nhánh Hà Nội')).toBeInTheDocument();
    expect(screen.queryByText('Chi nhánh TP.HCM')).not.toBeInTheDocument();
  });

  it('disables actions for company parent/child in branch mode', () => {
    const companyRecord = baseOrgUnit({
      id: 1,
      unitType: 'cong_ty_me',
      name: 'Công ty Mẹ',
    });
    mockUseOrgUnits.data = [companyRecord];
    mockUseOrgUnits.pagination.total = 1;

    renderWithProviders(
      <OrgUnitsTable
        data={[companyRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onRestore={vi.fn()}
        onArchive={vi.fn()}
        isBranchMode={true}
      />,
    );

    const actionButton = screen.getByLabelText(/Xem đơn vị/i);
    actionButton.click();

    // In branch mode, company parent/child should not have business actions
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
    expect(screen.queryByText('Vô hiệu')).not.toBeInTheDocument();
    expect(screen.queryByText('Khôi phục')).not.toBeInTheDocument();
    expect(screen.queryByText('Lưu trữ')).not.toBeInTheDocument();
  });

  it('allows actions for branch record in branch mode', () => {
    const branchRecord = baseOrgUnit({
      id: 1,
      unitType: 'chi_nhanh',
      active: true,
    });
    mockUseOrgUnits.data = [branchRecord];
    mockUseOrgUnits.pagination.total = 1;

    renderWithProviders(
      <OrgUnitsTable
        data={[branchRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onRestore={vi.fn()}
        onArchive={vi.fn()}
        isBranchMode={true}
      />,
    );

    const actionButton = screen.getByLabelText(/Xem đơn vị/i);
    actionButton.click();

    // Branch record should have actions in branch mode
    expect(screen.getByText('Sửa')).toBeInTheDocument();
    expect(screen.getByText('Vô hiệu')).toBeInTheDocument();
  });

  it('hides actions when user lacks permission code even if in scope', () => {
    const inScopeRecord = baseOrgUnit({ id: 1, active: true });
    mockUseOrgUnits.data = [inScopeRecord];
    mockUseOrgUnits.pagination.total = 1;
    // User only has ORG_VIEW, no ORG_EDIT/ORG_INACTIVE
    useAuthStore.setState({
      permissionCodes: ['ORG_VIEW'],
    });

    renderWithProviders(
      <OrgUnitsTable
        data={[inScopeRecord]}
        nameById={new Map()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onRestore={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    const actionButton = screen.getByLabelText(/Xem đơn vị/i);
    actionButton.click();

    // Should only see view button, no edit/deactivate/restore/archive
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
    expect(screen.queryByText('Vô hiệu')).not.toBeInTheDocument();
    expect(screen.queryByText('Khôi phục')).not.toBeInTheDocument();
    expect(screen.queryByText('Lưu trữ')).not.toBeInTheDocument();
  });
});
