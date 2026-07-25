# Table/List Pattern - Quick Start

## 🚀 Usage

### 1. Import pattern components

```tsx
import {
  useTablePattern,
  TableContainer,
  DataTable,
  FilteredEmptyState,
} from '@/shared/components';
```

### 2. Use the hook

```tsx
const {
  search,
  setSearch,
  filters,
  setFilter,
  resetFilters,
  page,
  setPage,
  pageSize,
  setPageSize,
  getApiParams,
} = useTablePattern({
  initialPageSize: 20,
  onFetch: (params) => fetchData(params),
});
```

### 3. Build your page

```tsx
<TableContainer
  title="Danh sách nhân sự"
  toolbar={{
    searchPlaceholder: 'Tìm nhân sự...',
    searchValue: search,
    onSearchChange: setSearch,
    filters: <Select placeholder="Chi nhánh" />,
    actions: <Button type="primary">+ Nhân sự</Button>,
  }}
  emptyState={{
    title: 'Chưa có nhân sự',
    description: 'Tạo hồ sơ nhân sự đầu tiên.',
    action: <Button>+ Nhân sự</Button>,
  }}
  loading={loading}
>
  <DataTable
    columns={columns}
    dataSource={data}
    serverPagination={{
      total: total,
      current: page,
      pageSize: pageSize,
      onChange: (p, ps) => {
        setPage(p);
        setPageSize(ps);
      },
    }}
  />
</TableContainer>
```

## 📚 Full Documentation

See [TABLE_PATTERN.md](./TABLE_PATTERN.md) for complete guide.

## 🎯 Key Components

| Component            | Purpose                                      | Location                                          |
| -------------------- | -------------------------------------------- | ------------------------------------------------- |
| `useTablePattern`    | Hook for search/filter/sort/pagination state | `@/shared/hooks/useTablePattern`                  |
| `TableToolbar`       | Search + filters + actions bar               | `@/shared/components/data-display/TableToolbar`   |
| `TableContainer`     | Card wrapper with toolbar support            | `@/shared/components/data-display/TableContainer` |
| `FilteredEmptyState` | Empty state for filtered results             | `@/shared/components/data-display/TableContainer` |
| `DataTable`          | Table with pagination, STT, selection        | `@/shared/components/data-display/DataTable`      |

## ✅ Acceptance Criteria

- ✅ M1 Company/Branch/Employee dùng chung table pattern
- ✅ Pagination/filter truyền đúng query backend
- ✅ Reusable trên quy mô toàn dự án

## 📦 Evidence

See [EVIDENCE.md](../../EVIDENCE.md) for complete deliverables and API contract.
