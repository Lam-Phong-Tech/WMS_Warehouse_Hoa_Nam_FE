import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrgUnitsFilter } from './use-org-units-filter';

describe('useOrgUnitsFilter', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    expect(result.current.filters).toEqual({
      keyword: '',
      unitType: undefined,
      province: undefined,
      status: undefined,
      company: undefined,
      page: 1,
      perPage: 15,
    });
  });

  it('initializes with custom perPage', () => {
    const { result } = renderHook(() =>
      useOrgUnitsFilter({ defaultPerPage: 50 }),
    );
    expect(result.current.filters.perPage).toBe(50);
  });

  it('initializes with defaultUnitType', () => {
    const { result } = renderHook(() =>
      useOrgUnitsFilter({ defaultUnitType: 'chi_nhanh' }),
    );
    expect(result.current.filters.unitType).toBe('chi_nhanh');
  });

  it('setKeyword updates keyword and resets page to 1', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => result.current.setKeyword('test'));
    expect(result.current.filters.keyword).toBe('test');
    expect(result.current.filters.page).toBe(1);
  });

  it('setFilterUnitType updates unitType and resets page to 1', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => result.current.setPage(5)); // set page to 5 first
    act(() => result.current.setFilterUnitType('chi_nhanh'));
    expect(result.current.filters.unitType).toBe('chi_nhanh');
    expect(result.current.filters.page).toBe(1);
  });

  it('setFilterProvince updates province and resets page', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => result.current.setPage(3));
    act(() => result.current.setFilterProvince('Hà Nội'));
    expect(result.current.filters.province).toBe('Hà Nội');
    expect(result.current.filters.page).toBe(1);
  });

  it('setFilterStatus updates status and resets page', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => result.current.setPage(2));
    act(() => result.current.setFilterStatus('soft_deleted'));
    expect(result.current.filters.status).toBe('soft_deleted');
    expect(result.current.filters.page).toBe(1);
  });

  it('setFilterCompany updates company and resets page', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => result.current.setPage(2));
    act(() => result.current.setFilterCompany(1));
    expect(result.current.filters.company).toBe(1);
    expect(result.current.filters.page).toBe(1);
  });

  it('setPage updates page without resetting', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => result.current.setPage(5));
    expect(result.current.filters.page).toBe(5);
  });

  it('resetFilters resets to initial state', () => {
    const { result } = renderHook(() =>
      useOrgUnitsFilter({ defaultPerPage: 30 }),
    );
    act(() => {
      result.current.setKeyword('test');
      result.current.setFilterUnitType('chi_nhanh');
      result.current.setFilterCompany(1);
      result.current.setPage(3);
    });
    act(() => result.current.resetFilters());
    expect(result.current.filters).toEqual({
      keyword: '',
      unitType: undefined,
      province: undefined,
      status: undefined,
      company: undefined,
      page: 1,
      perPage: 30, // preserves custom perPage
    });
  });

  it('resetFilters with defaultUnitType resets to that type', () => {
    const { result } = renderHook(() =>
      useOrgUnitsFilter({ defaultUnitType: 'chi_nhanh' }),
    );
    act(() => {
      result.current.setKeyword('test');
      result.current.setFilterUnitType('cong_ty_me');
      result.current.setPage(3);
    });
    act(() => result.current.resetFilters());
    expect(result.current.filters.unitType).toBe('chi_nhanh');
    expect(result.current.filters.keyword).toBe('');
    expect(result.current.filters.page).toBe(1);
  });

  it('lockUnitType forces unitType and ignores setFilterUnitType attempts (branch-mode P1 fix)', () => {
    const { result } = renderHook(() =>
      useOrgUnitsFilter({ lockUnitType: 'chi_nhanh' }),
    );
    expect(result.current.filters.unitType).toBe('chi_nhanh');
    act(() => result.current.setFilterUnitType('cong_ty_me'));
    expect(result.current.filters.unitType).toBe('chi_nhanh');
    act(() => result.current.resetFilters());
    expect(result.current.filters.unitType).toBe('chi_nhanh');
  });

  it('serverParams maps filters correctly (unit_type, no company/province)', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => {
      result.current.setKeyword('search');
      result.current.setFilterUnitType('chi_nhanh');
      result.current.setFilterStatus('active');
    });
    expect(result.current.serverParams).toEqual({
      page: 1,
      per_page: 15,
      keyword: 'search',
      unit_type: 'chi_nhanh',
      status: 'active',
    });
  });

  it('clientFilterParams maps filters correctly (unit_type, includes company/province)', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => {
      result.current.setKeyword('search');
      result.current.setFilterUnitType('chi_nhanh');
      result.current.setFilterStatus('archived');
      result.current.setFilterProvince('Hà Nội');
      result.current.setFilterCompany(1);
    });
    expect(result.current.clientFilterParams).toEqual({
      keyword: 'search',
      unit_type: 'chi_nhanh',
      province: 'Hà Nội',
      status: 'archived',
      company: 1,
    });
  });

  it('clientFilterParams omits undefined fields', () => {
    const { result } = renderHook(() => useOrgUnitsFilter());
    act(() => {
      result.current.setKeyword('search');
      result.current.setFilterStatus('archived');
    });
    expect(result.current.clientFilterParams).toEqual({
      keyword: 'search',
      status: 'archived',
    });
  });
});
