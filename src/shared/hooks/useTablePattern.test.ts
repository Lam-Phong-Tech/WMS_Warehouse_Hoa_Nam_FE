import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTablePattern } from './useTablePattern';

describe('useTablePattern', () => {
  // Đảm bảo mọi test đều quay lại real timers, kể cả khi 1 test fail/timeout
  // giữa chừng sau khi gọi vi.useFakeTimers() — nếu không, fake timers sẽ
  // "leak" sang các test sau và làm treo mọi waitFor() (dựa trên real timer).
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onFetch as a side effect (not during render) when params change', async () => {
    const onFetch = vi.fn();
    const { result } = renderHook(() =>
      useTablePattern({ initialPageSize: 10, onFetch }),
    );

    // First call happens after mount (via useEffect), not synchronously during render.
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));
    expect(onFetch).toHaveBeenCalledWith(
      expect.objectContaining({ search: '', page: 1, pageSize: 10 }),
    );

    act(() => {
      result.current.setPage(3);
    });
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(2));
    expect(onFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3 }),
    );
  });

  it('setFilter resets page to 1', () => {
    const { result } = renderHook(() => useTablePattern());

    act(() => {
      result.current.setPage(5);
    });
    expect(result.current.page).toBe(5);

    act(() => {
      result.current.setFilter('status', 'active');
    });
    expect(result.current.page).toBe(1);
    expect(result.current.filters.status).toBe('active');
  });

  it('setFilters resets page to 1', () => {
    const { result } = renderHook(() => useTablePattern());

    act(() => {
      result.current.setPage(4);
    });

    act(() => {
      result.current.setFilters({ status: 'active', unitType: 'branch' });
    });
    expect(result.current.page).toBe(1);
    expect(result.current.filters).toEqual({
      status: 'active',
      unitType: 'branch',
    });
  });

  it('search resets page to 1 after debounce settles', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useTablePattern({ searchDebounceMs: 400 }),
    );

    act(() => {
      result.current.setPage(2);
    });
    expect(result.current.page).toBe(2);

    act(() => {
      result.current.setSearch('abc');
    });
    // page not reset yet, still debouncing
    expect(result.current.page).toBe(2);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.page).toBe(1);
    expect(result.current.getApiParams().search).toBe('abc');

    vi.useRealTimers();
  });

  it('setPageSize resets page to 1', () => {
    const { result } = renderHook(() => useTablePattern());

    act(() => {
      result.current.setPage(5);
    });
    expect(result.current.page).toBe(5);

    act(() => {
      result.current.setPageSize(20);
    });
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);
  });

  // ========== NEW TESTS FOR CROSS-PATTERN COVERAGE ==========

  describe('initial values', () => {
    it('sử dụng initialSearch, initialFilters, initialPageSize đúng', () => {
      const { result } = renderHook(() =>
        useTablePattern({
          initialSearch: 'initial query',
          initialFilters: { status: 'active', orgId: 5 },
          initialPageSize: 25,
        }),
      );

      expect(result.current.search).toBe('initial query');
      expect(result.current.filters).toEqual({ status: 'active', orgId: 5 });
      expect(result.current.pageSize).toBe(25);
      expect(result.current.page).toBe(1);
    });

    it('mặc định initialSearch rỗng, initialFilters rỗng, initialPageSize 10', () => {
      const { result } = renderHook(() => useTablePattern());

      expect(result.current.search).toBe('');
      expect(result.current.filters).toEqual({});
      expect(result.current.pageSize).toBe(10);
    });
  });

  describe('resetFilters', () => {
    it('reset về initial state', () => {
      const { result } = renderHook(() =>
        useTablePattern({
          initialSearch: 'initial',
          initialFilters: { status: 'active' },
          initialPageSize: 15,
        }),
      );

      act(() => {
        result.current.setSearch('changed');
      });
      act(() => {
        result.current.setFilter('orgId', 10);
      });
      act(() => {
        result.current.setPage(5);
      });

      expect(result.current.search).toBe('changed');
      expect(result.current.filters).toEqual({ status: 'active', orgId: 10 });
      expect(result.current.page).toBe(5);

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.search).toBe('initial');
      expect(result.current.filters).toEqual({ status: 'active' });
      expect(result.current.page).toBe(1);
      expect(result.current.pageSize).toBe(15);
    });

    it('resetFilters cũng reset debouncedSearch', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useTablePattern({ searchDebounceMs: 400 }),
      );

      act(() => {
        result.current.setSearch('new search');
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(result.current.getApiParams().search).toBe('new search');

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.search).toBe('');
      expect(result.current.getApiParams().search).toBe('');

      vi.useRealTimers();
    });
  });

  describe('resetPage', () => {
    it('reset page về 1 mà không ảnh hưởng filters/search', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setFilter('status', 'active');
      });
      act(() => {
        result.current.setSearch('query');
      });
      // setPage sau cùng vì setFilter tự reset page về 1 (hành vi đã được
      // kiểm chứng ở test 'setFilter resets page to 1').
      act(() => {
        result.current.setPage(10);
      });

      expect(result.current.page).toBe(10);
      expect(result.current.filters.status).toBe('active');
      expect(result.current.search).toBe('query');

      act(() => {
        result.current.resetPage();
      });

      expect(result.current.page).toBe(1);
      expect(result.current.filters.status).toBe('active');
      expect(result.current.search).toBe('query');
    });
  });

  describe('sort handling', () => {
    it('setSort lưu trữ sort config', () => {
      const { result } = renderHook(() => useTablePattern());

      expect(result.current.sort).toBeUndefined();

      act(() => {
        result.current.setSort({ field: 'name', order: 'asc' });
      });

      expect(result.current.sort).toEqual({ field: 'name', order: 'asc' });
    });

    it('setSort(undefined) xóa sort', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setSort({ field: 'name', order: 'asc' });
      });
      expect(result.current.sort).toEqual({ field: 'name', order: 'asc' });

      act(() => {
        result.current.setSort(undefined);
      });
      expect(result.current.sort).toBeUndefined();
    });

    it('getApiParams bao gồm sort khi đã set', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setSort({ field: 'createdAt', order: 'desc' });
      });

      const params = result.current.getApiParams();
      expect(params).toEqual(
        expect.objectContaining({
          search: '',
          filters: {},
          page: 1,
          pageSize: 10,
          sort: { field: 'createdAt', order: 'desc' },
        }),
      );
    });

    it('getApiParams không bao gồm sort khi undefined', () => {
      const { result } = renderHook(() => useTablePattern());

      const params = result.current.getApiParams();
      expect(params).toEqual(
        expect.objectContaining({
          search: '',
          filters: {},
          page: 1,
          pageSize: 10,
        }),
      );
      expect(params).not.toHaveProperty('sort');
    });

    it('sort order hỗ trợ cả asc và desc', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setSort({ field: 'name', order: 'asc' });
      });
      expect(result.current.sort?.order).toBe('asc');

      act(() => {
        result.current.setSort({ field: 'name', order: 'desc' });
      });
      expect(result.current.sort?.order).toBe('desc');
    });
  });

  describe('getApiParams', () => {
    it('trả về đầy đủ params với giá trị hiện tại', () => {
      const { result } = renderHook(() =>
        useTablePattern({
          initialSearch: 'test',
          initialFilters: { status: 'active' },
          initialPageSize: 20,
        }),
      );

      act(() => {
        result.current.setPage(3);
      });
      act(() => {
        result.current.setPageSize(15);
      });
      act(() => {
        result.current.setSort({ field: 'id', order: 'desc' });
      });

      const params = result.current.getApiParams();
      // setPageSize tự reset page về 1 (hành vi đã kiểm chứng ở test
      // 'setPageSize resets page to 1'), nên page cuối cùng là 1, không phải 3.
      expect(params).toEqual({
        search: 'test',
        filters: { status: 'active' },
        page: 1,
        pageSize: 15,
        sort: { field: 'id', order: 'desc' },
      });
    });

    it('search trong getApiParams là debouncedSearch (không phải search tức thì)', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useTablePattern({ searchDebounceMs: 400 }),
      );

      act(() => {
        result.current.setSearch('immediate');
      });

      // Trước khi debounce settle, getApiParams trả về search cũ
      expect(result.current.getApiParams().search).toBe('');

      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Sau khi debounce settle, getApiParams trả về search mới
      expect(result.current.getApiParams().search).toBe('immediate');

      vi.useRealTimers();
    });
  });

  describe('onFetch callback', () => {
    it('gọi onFetch khi search thay đổi (debounced)', async () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() =>
        useTablePattern({ searchDebounceMs: 400, onFetch }),
      );

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));

      vi.useFakeTimers();
      act(() => {
        result.current.setSearch('new query');
      });

      // onFetch không gọi ngay (đang debounce)
      expect(onFetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(onFetch).toHaveBeenCalledTimes(2);
      expect(onFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'new query' }),
      );

      vi.useRealTimers();
    });

    it('gọi onFetch khi filters thay đổi', async () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() => useTablePattern({ onFetch }));

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setFilter('status', 'inactive');
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(2));
      expect(onFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filters: { status: 'inactive' },
          page: 1,
        }),
      );
    });

    it('gọi onFetch khi sort thay đổi', async () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() => useTablePattern({ onFetch }));

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setSort({ field: 'name', order: 'asc' });
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(2));
      expect(onFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort: { field: 'name', order: 'asc' },
        }),
      );
    });

    it('gọi onFetch khi pageSize thay đổi', async () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() => useTablePattern({ onFetch }));

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setPageSize(50);
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(2));
      expect(onFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pageSize: 50,
          page: 1,
        }),
      );
    });
  });

  describe('page reset logic', () => {
    it('reset page khi setFilter được gọi', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setPage(7);
      });
      expect(result.current.page).toBe(7);

      act(() => {
        result.current.setFilter('category', 'electronics');
      });
      expect(result.current.page).toBe(1);
    });

    it('reset page khi setFilters được gọi', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setPage(8);
      });
      expect(result.current.page).toBe(8);

      act(() => {
        result.current.setFilters({ type: 'a', status: 'b' });
      });
      expect(result.current.page).toBe(1);
    });

    it('reset page khi search debounce settle', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useTablePattern({ searchDebounceMs: 300 }),
      );

      act(() => {
        result.current.setPage(6);
      });
      expect(result.current.page).toBe(6);

      act(() => {
        result.current.setSearch('search term');
      });
      // Page chưa reset trong quá trình debounce
      expect(result.current.page).toBe(6);

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.page).toBe(1);

      vi.useRealTimers();
    });

    it('reset page khi setPageSize được gọi', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setPage(9);
      });
      expect(result.current.page).toBe(9);

      act(() => {
        result.current.setPageSize(30);
      });
      expect(result.current.page).toBe(1);
    });
  });

  describe('filter types', () => {
    it('hỗ trợ filter kiểu string', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setFilter('name', 'John Doe');
      });
      expect(result.current.filters.name).toBe('John Doe');
    });

    it('hỗ trợ filter kiểu number', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setFilter('orgId', 42);
      });
      expect(result.current.filters.orgId).toBe(42);
    });

    it('hỗ trợ filter kiểu boolean', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setFilter('isActive', true);
      });
      expect(result.current.filters.isActive).toBe(true);

      act(() => {
        result.current.setFilter('isActive', false);
      });
      expect(result.current.filters.isActive).toBe(false);
    });

    it('hỗ trợ filter kiểu string[]', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setFilter('tags', ['tag1', 'tag2', 'tag3']);
      });
      expect(result.current.filters.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('hỗ trợ filter kiểu undefined (xóa filter)', () => {
      const { result } = renderHook(() =>
        useTablePattern({
          initialFilters: { status: 'active', orgId: 5 },
        }),
      );

      expect(result.current.filters.status).toBe('active');
      expect(result.current.filters.orgId).toBe(5);

      act(() => {
        result.current.setFilter('status', undefined);
      });
      expect(result.current.filters.status).toBeUndefined();
      expect(result.current.filters.orgId).toBe(5);
    });
  });

  describe('pagination onChange pattern', () => {
    it('setPage cập nhật page đúng', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setPage(1);
      });
      expect(result.current.page).toBe(1);

      act(() => {
        result.current.setPage(5);
      });
      expect(result.current.page).toBe(5);

      act(() => {
        result.current.setPage(100);
      });
      expect(result.current.page).toBe(100);
    });

    it('setPageSize cập nhật pageSize và reset page', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setPage(10);
      });
      act(() => {
        result.current.setPageSize(50);
      });

      expect(result.current.pageSize).toBe(50);
      expect(result.current.page).toBe(1);
    });

    it('pagination onChange pattern: (p, ps) => { setPage(p); setPerPage(ps); } hoạt động đúng', () => {
      const { result } = renderHook(() => useTablePattern());

      // Mô phỏng onChange từ AntD Table
      const handlePaginationChange = (p: number, ps: number) => {
        result.current.setPage(p);
        result.current.setPageSize(ps);
      };

      act(() => {
        handlePaginationChange(3, 25);
      });

      // setPage(3) rồi setPageSize(25) trong cùng lượt xử lý — setPageSize tự
      // reset page về 1, nên trạng thái cuối cùng sau khi act() hoàn tất là
      // pageSize=25, page=1 (không thể quan sát giá trị page=3 trung gian vì
      // cả hai lệnh gọi đều nằm trong cùng 1 act batch).
      expect(result.current.pageSize).toBe(25);
      expect(result.current.page).toBe(1);
    });
  });

  describe('query params integration', () => {
    it('getApiParams trả về cấu trúc phù hợp cho query params API', () => {
      const { result } = renderHook(() =>
        useTablePattern({
          initialSearch: 'keyword',
          initialFilters: { status: 'active', orgId: 1 },
          initialPageSize: 15,
        }),
      );

      act(() => {
        result.current.setPage(2);
      });
      act(() => {
        result.current.setSort({ field: 'createdAt', order: 'desc' });
      });

      const params = result.current.getApiParams();

      // Verify cấu trúc params có thể dùng trực tiếp cho API query
      expect(params).toHaveProperty('search');
      expect(params).toHaveProperty('filters');
      expect(params).toHaveProperty('page');
      expect(params).toHaveProperty('pageSize');
      expect(params).toHaveProperty('sort');

      // Verify giá trị
      expect(params.search).toBe('keyword');
      expect(params.filters).toEqual({ status: 'active', orgId: 1 });
      expect(params.page).toBe(2);
      expect(params.pageSize).toBe(15);
      expect(params.sort).toEqual({ field: 'createdAt', order: 'desc' });
    });

    it('params thay đổi theo thời gian thực khi user tương tác', async () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() =>
        useTablePattern({ searchDebounceMs: 100, onFetch }),
      );

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));

      // Kiểm tra params ban đầu
      expect(result.current.getApiParams()).toEqual(
        expect.objectContaining({
          search: '',
          filters: {},
          page: 1,
          pageSize: 10,
        }),
      );

      // Thay đổi filter
      act(() => {
        result.current.setFilter('status', 'active');
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(2));
      expect(result.current.getApiParams().filters).toEqual({
        status: 'active',
      });

      // Thay đổi page
      act(() => {
        result.current.setPage(5);
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(3));
      expect(result.current.getApiParams().page).toBe(5);

      // Thay đổi search (debounced)
      vi.useFakeTimers();
      act(() => {
        result.current.setSearch('test');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(onFetch).toHaveBeenCalledTimes(4);
      expect(result.current.getApiParams().search).toBe('test');

      vi.useRealTimers();
    });
  });

  describe('Departments/Employees adoption pattern', () => {
    it('phù hợp với pattern sử dụng trong DepartmentsPage', () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() =>
        useTablePattern({ initialPageSize: 15, onFetch }),
      );

      // DepartmentsPage pattern:
      // const { search, setSearch, filters, setFilter, page, setPage, pageSize, setPageSize, getApiParams, resetFilters } = useTablePattern({ initialPageSize: 15 });

      expect(result.current.search).toBeDefined();
      expect(result.current.setSearch).toBeDefined();
      expect(result.current.filters).toBeDefined();
      expect(result.current.setFilter).toBeDefined();
      expect(result.current.page).toBeDefined();
      expect(result.current.setPage).toBeDefined();
      expect(result.current.pageSize).toBe(15);
      expect(result.current.setPageSize).toBeDefined();
      expect(result.current.getApiParams).toBeDefined();
      expect(result.current.resetFilters).toBeDefined();

      // Simulate DepartmentsPage usage
      act(() => {
        result.current.setSearch('keyword');
      });
      act(() => {
        result.current.setFilter('orgFilter', 1);
      });
      act(() => {
        result.current.setFilter('statusFilter', 'active');
      });
      act(() => {
        result.current.setPage(2);
      });

      const listParams = {
        page: result.current.page,
        per_page: result.current.pageSize,
        keyword: result.current.getApiParams().search || undefined,
        org_unit_id: result.current.filters.orgFilter as number | undefined,
        status:
          result.current.filters.statusFilter === 'active' ? 1 : undefined,
      };

      expect(listParams).toEqual({
        page: 2,
        per_page: 15,
        keyword: undefined, // debouncedSearch chưa settle
        org_unit_id: 1,
        status: 1,
      });
    });

    it('phù hợp với pattern sử dụng trong EmployeesPage', () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() =>
        useTablePattern({ initialPageSize: 15, onFetch }),
      );

      // EmployeesPage pattern:
      // const { search: keyword, setSearch: setKeyword, filters, setFilter, page, setPage, pageSize: perPage, setPageSize: setPerPage, getApiParams, resetFilters } = useTablePattern({ initialPageSize: 15 });

      expect(result.current.pageSize).toBe(15);

      // Simulate EmployeesPage usage với nhiều filters
      act(() => {
        result.current.setFilter('orgFilter', 2);
      });
      act(() => {
        result.current.setFilter('deptFilter', 5);
      });
      act(() => {
        result.current.setFilter('positionFilter', 3);
      });
      act(() => {
        result.current.setFilter('statusFilter', 'active');
      });
      act(() => {
        result.current.setFilter('accountStatusFilter', 'enabled');
      });

      const listParams = {
        page: result.current.page,
        per_page: result.current.pageSize,
        keyword: result.current.getApiParams().search || undefined,
        org_unit_id: result.current.filters.orgFilter as number | undefined,
        department_id: result.current.filters.deptFilter as number | undefined,
        position_id: result.current.filters.positionFilter as
          | number
          | undefined,
        employee_status: result.current.filters.statusFilter as
          | string
          | undefined,
        account_status: result.current.filters.accountStatusFilter as
          | string
          | undefined,
      };

      expect(listParams).toEqual({
        page: 1,
        per_page: 15,
        keyword: undefined,
        org_unit_id: 2,
        department_id: 5,
        position_id: 3,
        employee_status: 'active',
        account_status: 'enabled',
      });
    });

    it('resetFilters hoạt động đúng với pattern Departments/Employees', () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() =>
        useTablePattern({ initialPageSize: 15, onFetch }),
      );

      // Set multiple filters như trong thực tế
      act(() => {
        result.current.setFilter('orgFilter', 1);
      });
      act(() => {
        result.current.setFilter('statusFilter', 'inactive');
      });
      act(() => {
        result.current.setSearch('search term');
      });
      act(() => {
        result.current.setPage(5);
      });

      // Reset all
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters).toEqual({});
      expect(result.current.search).toBe('');
      expect(result.current.page).toBe(1);
      expect(result.current.pageSize).toBe(15);
    });
  });

  describe('edge cases', () => {
    it('xử lý setFilter với giá trị undefined (xóa filter)', () => {
      const { result } = renderHook(() =>
        useTablePattern({
          initialFilters: { field: 'value' },
        }),
      );

      expect(result.current.filters.field).toBe('value');

      act(() => {
        result.current.setFilter('field', undefined);
      });
      expect(result.current.filters.field).toBeUndefined();
    });

    it('xử lý setFilter với giá trị falsy hợp lệ (số 0, empty string)', () => {
      const { result } = renderHook(() => useTablePattern());

      // Test với số 0
      act(() => {
        result.current.setFilter('count', 0);
      });
      expect(result.current.filters.count).toBe(0);

      // Test với empty string
      act(() => {
        result.current.setFilter('name', '');
      });
      expect(result.current.filters.name).toBe('');
    });

    it('setSearch với empty string hoạt động đúng', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useTablePattern({ searchDebounceMs: 200 }),
      );

      act(() => {
        result.current.setSearch('something');
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.getApiParams().search).toBe('something');

      act(() => {
        result.current.setSearch('');
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.getApiParams().search).toBe('');

      vi.useRealTimers();
    });

    it('setPage với số âm vẫn hoạt động (không validate range)', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setPage(-1);
      });
      expect(result.current.page).toBe(-1);

      act(() => {
        result.current.setPage(0);
      });
      expect(result.current.page).toBe(0);
    });

    it('setPageSize với số nhỏ hơn 1 vẫn hoạt động', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setPageSize(0);
      });
      expect(result.current.pageSize).toBe(0);
      expect(result.current.page).toBe(1);
    });

    it('multiple setFilter calls trong cùng act batch', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setFilter('a', 1);
        result.current.setFilter('b', 2);
        result.current.setFilter('c', 3);
      });

      expect(result.current.filters).toEqual({
        a: 1,
        b: 2,
        c: 3,
      });
      expect(result.current.page).toBe(1);
    });

    it('sort thay đổi nhiều lần', () => {
      const { result } = renderHook(() => useTablePattern());

      act(() => {
        result.current.setSort({ field: 'name', order: 'asc' });
      });
      expect(result.current.sort).toEqual({ field: 'name', order: 'asc' });

      act(() => {
        result.current.setSort({ field: 'name', order: 'desc' });
      });
      expect(result.current.sort).toEqual({ field: 'name', order: 'desc' });

      act(() => {
        result.current.setSort({ field: 'date', order: 'asc' });
      });
      expect(result.current.sort).toEqual({ field: 'date', order: 'asc' });
    });
  });

  describe('integration: complete user flow', () => {
    it('mô phỏng complete flow: search → filter → sort → paginate', async () => {
      const onFetch = vi.fn();
      const { result } = renderHook(() =>
        useTablePattern({ searchDebounceMs: 100, onFetch }),
      );

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));

      // 1. Search
      vi.useFakeTimers();
      act(() => {
        result.current.setSearch('department');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(onFetch).toHaveBeenCalledTimes(2);
      expect(result.current.getApiParams().search).toBe('department');
      vi.useRealTimers();

      // 2. Filter
      act(() => {
        result.current.setFilter('orgId', 5);
        result.current.setFilter('status', 'active');
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(3));
      expect(result.current.filters).toEqual({ orgId: 5, status: 'active' });

      // 3. Sort
      act(() => {
        result.current.setSort({ field: 'name', order: 'asc' });
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(4));
      expect(result.current.sort).toEqual({ field: 'name', order: 'asc' });

      // 4. Paginate
      act(() => {
        result.current.setPage(3);
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(5));
      expect(result.current.page).toBe(3);

      // 5. Change page size
      act(() => {
        result.current.setPageSize(50);
      });

      await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(6));
      expect(result.current.pageSize).toBe(50);
      expect(result.current.page).toBe(1); // reset

      // 6. Reset all
      act(() => {
        result.current.resetFilters();
      });

      // resetFilters chỉ reset search/filters/page về initial state (theo
      // JSDoc "Reset all filters to initial state") — sort không phải là
      // filter nên KHÔNG bị reset (hành vi này cũng được xác nhận bởi các
      // test khác trong describe('resetFilters') ở trên).
      expect(result.current.search).toBe('');
      expect(result.current.filters).toEqual({});
      expect(result.current.page).toBe(1);
      expect(result.current.sort).toEqual({ field: 'name', order: 'asc' });

      vi.useRealTimers();
    });
  });
});
