import { useCallback, useEffect, useRef, useState } from 'react';

export interface TableFilters {
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface TableSort {
  field: string;
  order: 'asc' | 'desc';
}

export interface UseTablePatternOptions {
  /** Initial search term */
  initialSearch?: string;
  /** Initial filters */
  initialFilters?: TableFilters;
  /** Initial page size */
  initialPageSize?: number;
  /** Debounce delay (ms) applied to search before it affects API params / onFetch. Default 400. */
  searchDebounceMs?: number;
  /** Callback when filters change (for API call) */
  onFetch?: (params: {
    search: string;
    filters: TableFilters;
    page: number;
    pageSize: number;
    sort?: TableSort;
  }) => void;
}

export interface UseTablePatternReturn {
  /** Current search term (immediate, bind to input) */
  search: string;
  /** Set search term */
  setSearch: (value: string) => void;
  /** Current filters */
  filters: TableFilters;
  /** Set a specific filter (resets page to 1) */
  setFilter: (
    key: string,
    value: string | number | boolean | string[] | undefined,
  ) => void;
  /** Set multiple filters at once (resets page to 1) */
  setFilters: (filters: TableFilters) => void;
  /** Reset all filters to initial state */
  resetFilters: () => void;
  /** Current page (1-based) */
  page: number;
  /** Set current page */
  setPage: (page: number) => void;
  /** Current page size */
  pageSize: number;
  /** Set page size */
  setPageSize: (size: number) => void;
  /** Current sort configuration */
  sort: TableSort | undefined;
  /** Set sort configuration */
  setSort: (sort: TableSort | undefined) => void;
  /** Reset page to 1 when filters/search change */
  resetPage: () => void;
  /** Get all params for API call (search is the debounced value) */
  getApiParams: () => {
    search: string;
    filters: TableFilters;
    page: number;
    pageSize: number;
    sort?: TableSort;
  };
}

/**
 * Reusable hook for table pattern: search (debounced), filter, sort, pagination
 *
 * @example
 * ```tsx
 * const {
 *   search, setSearch,
 *   filters, setFilter, resetFilters,
 *   page, setPage, pageSize, setPageSize,
 *   sort, setSort,
 *   getApiParams
 * } = useTablePattern({
 *   initialPageSize: 20,
 *   onFetch: (params) => fetchData(params)
 * });
 * ```
 */
export function useTablePattern(
  options: UseTablePatternOptions = {},
): UseTablePatternReturn {
  const {
    initialSearch = '',
    initialFilters = {},
    initialPageSize = 10,
    searchDebounceMs = 400,
    onFetch,
  } = options;

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [filters, setFiltersState] = useState<TableFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sort, setSort] = useState<TableSort | undefined>(undefined);

  // Chỉ reset về trang 1 khi pageSize THỰC SỰ đổi. antd Pagination.onChange
  // luôn gửi kèm (page, pageSize) hiện tại kể cả khi chỉ chuyển trang — nếu
  // reset vô điều kiện, gọi setPage(p) rồi setPageSize(ps) cùng lúc sẽ khiến
  // setPage(1) ở đây đè lên setPage(p), làm việc chuyển trang không có tác dụng.
  const setPageSizeWithReset = useCallback((size: number) => {
    setPageSize((prev) => {
      if (prev !== size) setPage(1);
      return size;
    });
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  // Debounce search -> debouncedSearch, resetting page when it settles
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, searchDebounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchDebounceMs]);

  const setFilter = useCallback(
    (key: string, value: string | number | boolean | string[] | undefined) => {
      setFiltersState((prev) => ({
        ...prev,
        [key]: value,
      }));
      setPage(1);
    },
    [],
  );

  const setFilters = useCallback((next: TableFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setSearch(initialSearch);
    setDebouncedSearch(initialSearch);
    setPage(1);
  }, [initialFilters, initialSearch]);

  const getApiParams = useCallback(() => {
    const params = {
      search: debouncedSearch,
      filters,
      page,
      pageSize,
      ...(sort && { sort }),
    };
    return params;
  }, [debouncedSearch, filters, page, pageSize, sort]);

  // Auto-fetch when params change
  useEffect(() => {
    if (onFetch) {
      onFetch(getApiParams());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters, page, pageSize, sort]);

  return {
    search,
    setSearch,
    filters,
    setFilter,
    setFilters,
    resetFilters,
    page,
    setPage,
    pageSize,
    setPageSize: setPageSizeWithReset,
    sort,
    setSort,
    resetPage,
    getApiParams,
  };
}
