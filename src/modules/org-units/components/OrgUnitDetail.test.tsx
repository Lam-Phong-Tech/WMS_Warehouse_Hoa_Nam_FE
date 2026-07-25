import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { OrgUnitDetail } from './OrgUnitDetail';
import type { OrgUnit } from '../types/org-units.types';

function makeUnit(overrides: Partial<OrgUnit> = {}): OrgUnit {
  return {
    id: 1,
    code: 'CN-001',
    name: 'Chi nhánh Hà Nội',
    unitType: 'chi_nhanh',
    parentId: null,
    active: true,
    ...overrides,
  } as OrgUnit;
}

const baseProps = {
  nameById: new Map<number, string>(),
  stats: { companies: 0, branches: 0 },
  onEdit: vi.fn(),
  onDeactivate: vi.fn(),
  onRestore: vi.fn(),
  onArchive: vi.fn(),
  isDeactivating: false,
};

describe('OrgUnitDetail row-level action visibility', () => {
  it('ẩn Sửa/Vô hiệu khi record ngoài scope (canEdit/canDeactivate=false) dù unit đang active', () => {
    renderWithProviders(
      <OrgUnitDetail
        {...baseProps}
        unit={makeUnit()}
        canEdit={false}
        canDeactivate={false}
      />,
    );
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
    expect(screen.queryByText('Vô hiệu hóa')).not.toBeInTheDocument();
  });

  it('hiện Sửa/Vô hiệu khi record trong scope (canEdit/canDeactivate=true) và unit active', () => {
    renderWithProviders(
      <OrgUnitDetail
        {...baseProps}
        unit={makeUnit()}
        canEdit={true}
        canDeactivate={true}
      />,
    );
    expect(screen.getByText('Sửa')).toBeInTheDocument();
    expect(screen.getByText('Vô hiệu hóa')).toBeInTheDocument();
  });

  it('ẩn Lưu trữ khi canArchive=false dù unit đã soft-deleted', () => {
    renderWithProviders(
      <OrgUnitDetail
        {...baseProps}
        unit={makeUnit({ active: false, deletedAt: '2026-07-01T00:00:00Z' })}
        canRestore={true}
        canArchive={false}
      />,
    );
    expect(screen.getByText('Khôi phục')).toBeInTheDocument();
    expect(screen.queryByText('Lưu trữ')).not.toBeInTheDocument();
  });

  it('hiện Lưu trữ khi canArchive=true và unit đã soft-deleted (row trong scope)', () => {
    renderWithProviders(
      <OrgUnitDetail
        {...baseProps}
        unit={makeUnit({ active: false, deletedAt: '2026-07-01T00:00:00Z' })}
        canRestore={true}
        canArchive={true}
      />,
    );
    expect(screen.getByText('Lưu trữ')).toBeInTheDocument();
  });

  it('readOnly ẩn toàn bộ action bất kể canEdit/canArchive true', () => {
    renderWithProviders(
      <OrgUnitDetail
        {...baseProps}
        unit={makeUnit()}
        readOnly
        canEdit={true}
        canDeactivate={true}
      />,
    );
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
    expect(screen.queryByText('Vô hiệu hóa')).not.toBeInTheDocument();
  });
});
