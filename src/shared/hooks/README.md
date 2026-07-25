# Table Pattern Hook

## Overview

`useTablePattern` là hook chuẩn để quản lý state cho table/list pages với các tính năng:

- Debounced search
- Multiple filters
- Server-side pagination
- Sorting
- Auto-fetch khi params thay đổi

## Installation

Hook này đã được đặt trong `src/shared/hooks/useTablePattern.ts` và có thể import trực tiếp:

```typescript
import { useTablePattern } from '@/shared/hooks/useTablePattern';
```

## Basic Usage

```typescript
import { useTablePattern } from '@/shared/hooks/useTablePattern';

function MyPage() {
  const {
    search,
    setSearch,
    filters,
    setFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    sort,
    setSort,
    getApiParams,
    resetFilters,
  } = useTablePattern({
    initialPageSize: 15,
    searchDebounceMs: 400,
    onFetch: (params) => {
      // Fetch data khi params thay đổi
      fetchData(params);
    },
  });

  // Sử dụng trong component
  return (
    <div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
      />
      {/* ... */}
    </div>
  );
}
```

## API Reference

### Options

```typescript
interface UseTablePatternOptions {
  initialSearch?: string; // Default: ''
  initialFilters?: TableFilters; // Default: {}
  initialPageSize?: number; // Default: 10
  searchDebounceMs?: number; // Default: 400
  onFetch?: (params: ApiParams) => void; // Callback khi params thay đổi
}
```

### Return Values

```typescript
interface UseTablePatternReturn {
  // Search
  search: string;
  setSearch: (value: string) => void;

  // Filters
  filters: TableFilters;
  setFilter: (key: string, value: any) => void;
  setFilters: (filters: TableFilters) => void;
  resetFilters: () => void;

  // Pagination
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;

  // Sort
  sort: TableSort | undefined;
  setSort: (sort: TableSort | undefined) => void;

  // Utilities
  resetPage: () => void;
  getApiParams: () => ApiParams;
}
```

### Types

```typescript
type TableFilters = {
  [key: string]: string | number | boolean | string[] | undefined;
};

interface TableSort {
  field: string;
  order: 'asc' | 'desc';
}

interface ApiParams {
  search: string;
  filters: TableFilters;
  page: number;
  pageSize: number;
  sort?: TableSort;
}
```

## Usage Patterns

### Pattern 1: Simple List with Search

```typescript
const {
  search,
  setSearch,
  page,
  setPage,
  pageSize,
  setPageSize,
  getApiParams,
} = useTablePattern({
  initialPageSize: 15,
  onFetch: (params) => fetchData(params),
});

// Build API params
const listParams = {
  page: page,
  per_page: pageSize,
  keyword: getApiParams().search || undefined,
};
```

### Pattern 2: List with Multiple Filters

```typescript
const { search, setSearch, filters, setFilter, page, setPage, pageSize, setPageSize, getApiParams, resetFilters } = useTablePattern({
  initialPageSize: 15,
  onFetch: (params) => fetchData(params),
});

// Set individual filters
setFilter('orgFilter', 1);
setFilter('statusFilter', 'active');
setFilter('deptFilter', 5);

// Read filters
const orgFilter = filters.orgFilter as number | 'all';
const statusFilter = filters.statusFilter as string;

// Build API params
const listParams = {
  page: page,
  per_page: pageSize,
  keyword: getApiParams().search || undefined,
  org_unit_id: orgFilter !== 'all' ? orgFilter : undefined,
  status: statusFilter !== 'all' ? statusFilter : undefined,
};

// Reset all filters
<Button onClick={resetFilters}>Xóa bộ lọc</Button>
```

### Pattern 3: List with Sort

```typescript
const { search, setSearch, filters, setFilter, page, setPage, pageSize, setPageSize, sort, setSort, getApiParams } = useTablePattern({
  initialPageSize: 15,
  onFetch: (params) => fetchData(params),
});

const [sortBy, setSortBy] = useState<string>();
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>();

// Build list params with sort
const listParams = {
  page: page,
  per_page: pageSize,
  keyword: getApiParams().search || undefined,
  sort_by: sortBy,
  sort_order: sortOrder,
};

// Handle sort change from table
const handleSortChange = (field: string, order: 'asc' | 'desc') => {
  setSortBy(field);
  setSortOrder(order);
  setPage(1); // Reset to page 1 when sort changes
};

<Table
  onSortChange={handleSortChange}
  // ...
/>
```

### Pattern 4: Pagination onChange

```typescript
const { page, setPage, pageSize, setPageSize } = useTablePattern({
  initialPageSize: 15,
  onFetch: (params) => fetchData(params),
});

// Pagination onChange handler
const handlePaginationChange = (newPage: number, newPageSize: number) => {
  setPage(newPage);
  setPageSize(newPageSize); // Automatically resets page to 1
};

<Table
  serverPagination={{
    current: page,
    pageSize: pageSize,
    total: total,
    onChange: handlePaginationChange,
  }}
/>
```

## Key Features

### 1. Debounced Search

Search input được debounce 400ms (mặc định) để tránh gọi API quá nhiều lần:

```typescript
const { search, setSearch, getApiParams } = useTablePattern();

// User types "abc"
<Input value={search} onChange={(e) => setSearch(e.target.value)} />

// getApiParams().search sẽ chỉ update sau 400ms
// Trong khoảng thời gian đó, page được reset về 1
```

### 2. Auto Page Reset

Page tự động reset về 1 khi:

- Search thay đổi (sau debounce)
- Filter thay đổi
- Page size thay đổi
- Sort thay đổi

```typescript
// Không cần manual reset
setFilter('status', 'active'); // page tự động reset về 1
setPageSize(20); // page tự động reset về 1
setSort({ field: 'name', order: 'asc' }); // page tự động reset về 1
```

### 3. Auto Fetch

Hook tự động gọi `onFetch` khi params thay đổi:

```typescript
const { getApiParams } = useTablePattern({
  onFetch: (params) => {
    // Được gọi tự động khi:
    // - search thay đổi (debounced)
    // - filters thay đổi
    // - page thay đổi
    // - pageSize thay đổi
    // - sort thay đổi
    fetchData(params);
  },
});
```

### 4. Reset Filters

```typescript
const { resetFilters } = useTablePattern({
  initialSearch: '',
  initialFilters: { status: 'all' },
  initialPageSize: 15,
});

// Reset về initial state
resetFilters();
// - search → ''
// - filters → { status: 'all' }
// - page → 1
// - pageSize → 15
```

## Integration with TableContainer

```typescript
import { TableContainer } from '@/shared/components';
import { useTablePattern } from '@/shared/hooks/useTablePattern';

function MyPage() {
  const { search, setSearch, filters, setFilter, page, setPage, pageSize, setPageSize, getApiParams, resetFilters } = useTablePattern({
    initialPageSize: 15,
    onFetch: (params) => fetchData(params),
  });

  const isFiltering = search !== '' || filters.status !== 'all';

  return (
    <TableContainer
      toolbar={{
        searchPlaceholder: "Tìm kiếm...",
        searchValue: search,
        onSearchChange: setSearch,
        filters: <MyFilters filters={filters} setFilter={setFilter} />,
        actions: <Button>Thêm mới</Button>,
      }}
      loading={isLoading}
      error={error}
      isFilterActive={isFiltering}
      onClearFilters={resetFilters}
      emptyState={{
        title: isFiltering ? 'Không có kết quả' : 'Chưa có dữ liệu',
        description: isFiltering ? 'Thử xóa bộ lọc' : 'Tạo mới để bắt đầu',
      }}
    >
      <MyTable
        data={data}
        serverPagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </TableContainer>
  );
}
```

## Best Practices

### 1. Always Reset Page on Sort Change

```typescript
const handleSortChange = (field: string, order: 'asc' | 'desc') => {
  setSortBy(field);
  setSortOrder(order);
  setPage(1); // Important: reset to page 1
};
```

### 2. Use getApiParams() for API Calls

```typescript
// Good
const params = getApiParams();
fetchData(params);

// Avoid - manual construction prone to errors
const params = {
  page: page,
  pageSize: pageSize,
  search: search, // This is immediate search, not debounced!
};
```

### 3. Reset Filters for Clear Button

```typescript
<Button onClick={resetFilters}>
  Xóa bộ lọc
</Button>
```

### 4. Use isFilterActive for Empty States

```typescript
const isFiltering = search !== '' || Object.values(filters).some(v => v !== undefined && v !== '');

<TableContainer
  isFilterActive={isFiltering}
  onClearFilters={resetFilters}
  emptyState={...}
>
```

## Common Pitfalls

### ❌ Don't: Use Immediate Search for API

```typescript
// Wrong - search is immediate, causes too many API calls
const listParams = {
  keyword: search, // This changes on every keystroke
};
```

### ✅ Do: Use Debounced Search

```typescript
// Correct - getApiParams returns debounced search
const listParams = {
  keyword: getApiParams().search || undefined,
};
```

### ❌ Don't: Forget to Reset Page on Filter Change

```typescript
// Wrong - page stays at 10, user sees empty page
const handleFilterChange = (value) => {
  setFilter('status', value);
  // Missing: setPage(1)
};
```

### ✅ Do: Let Hook Handle Page Reset

```typescript
// Correct - hook automatically resets page to 1
const handleFilterChange = (value) => {
  setFilter('status', value); // page automatically resets to 1
};
```

## Testing

See `useTablePattern.test.ts` for comprehensive test examples.

Key test scenarios:

- Search debounce behavior
- Filter changes reset page
- Page size change resets page
- Sort changes
- Reset filters
- getApiParams returns correct values
- Pagination onChange pattern

## Migration Guide

### From Manual State Management

**Before:**

```typescript
const [search, setSearch] = useState('');
const [filters, setFilters] = useState({});
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(10);
const [sort, setSort] = useState({});

// Manual debounce
useEffect(() => {
  const timer = setTimeout(() => {
    fetchData({ search, filters, page, pageSize, sort });
  }, 400);
  return () => clearTimeout(timer);
}, [search, filters, page, pageSize, sort]);
```

**After:**

```typescript
const {
  search,
  setSearch,
  filters,
  setFilter,
  page,
  setPage,
  pageSize,
  setPageSize,
  sort,
  setSort,
  getApiParams,
} = useTablePattern({
  onFetch: (params) => fetchData(params),
});
```

## Related Files

- Hook: `src/shared/hooks/useTablePattern.ts`
- Tests: `src/shared/hooks/useTablePattern.test.ts`
- TableContainer: `src/shared/components/data-display/TableContainer.tsx`
- Examples:
  - `src/modules/employees/pages/EmployeesPage.tsx`
  - `src/modules/departments/pages/DepartmentsPage.tsx`
  - `src/modules/org-units/pages/OrgUnitsPage.tsx`
