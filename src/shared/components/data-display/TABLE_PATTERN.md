# Table/List Pattern chuẩn ERP (v2 - Container-level)

Pattern này cung cấp bộ công cụ tái sử dụng để xây dựng màn hình danh sách (list/table) một cách nhất quán trên toàn hệ thống ERP.

## ✅ Pattern chuẩn (P1.4) — 5 thành phần bắt buộc cho mọi page mới

Mọi page danh sách mới (1 page = 1 table độc lập) **phải** ghép đúng 5 thành phần sau,
theo đúng thứ tự trách nhiệm — không tự chế state quản lý riêng hay container riêng:

1. **`useTablePattern`** — nguồn sự thật duy nhất cho `search`/`filters`/`sort`/`page`/`pageSize`,
   tự reset `page` về 1 khi filter/search/sort/pageSize đổi, và sinh `getApiParams()` để gọi BE.
2. **`TableContainer`** — container duy nhất bọc toolbar + loading + error + empty-state + table,
   nhận `search`/`filters`/`page`/`pageSize` từ `useTablePattern` ở trên.
3. **`DataTable` với prop `serverPagination`** — **không** tự bọc `TopPagination`/`pagination` prop
   cũ; `DataTable` chỉ hiển thị đúng trang/tổng số đã nhận, không tự cắt trang.
4. **`TableToolbar`/`FilterBar`** (hoặc component filter riêng theo module, vd `EmployeesFilter`)
   — truyền vào `toolbar` slot của `TableContainer`, đọc/ghi state qua `useTablePattern`.
5. **`ActionDropdown`** cho cột "Thao tác" + **`FilteredEmptyState`** khi bảng rỗng do filter (khác
   `EmptyState` khi rỗng do chưa có dữ liệu gốc).

Employees và Departments là 2 tham chiếu chuẩn 100% đúng pattern này (server-side thật). Org Units
Table view là **exception đã ghi nhận** (xem 2 mục ⚠️ bên dưới) — không dùng làm mẫu khi tạo page mới.

## 📦 Components đã có sẵn

### 1. `useTablePattern` Hook

Hook quản lý state cho table: search, filter, sort, pagination.

```tsx
import { useTablePattern } from '@/shared/components';

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
  sort,
  setSort,
  getApiParams,
} = useTablePattern({
  initialPageSize: 20,
  onFetch: (params) => {
    fetchData(params);
  },
});
```

### 2. `TableContainer` Component (Container chuẩn duy nhất)

**Đây là container DUY NHẤT được dùng cho tất cả page có table/list.**

Hỗ trợ 2 dạng toolbar:

- **Object (ToolbarConfig):** dùng `TableToolbar` component chuẩn
- **ReactNode:** custom component (vd: `DepartmentsFilter`, `OrgUnitsToolbar`, `EmployeesFilter`)

```tsx
import { TableContainer } from '@/shared/components';

// Cách 1: ToolbarConfig object
<TableContainer
  title="Danh sách nhân sự"
  toolbar={{
    searchPlaceholder: 'Tìm nhân sự...',
    searchValue: search,
    onSearchChange: setSearch,
    filters: <Select placeholder="Chi nhánh" />,
    actions: <Button type="primary">+ Nhân sự</Button>,
  }}
  loading={loading}
  error={error}
  emptyState={{
    title: 'Chưa có nhân sự',
    description: 'Tạo hồ sơ nhân sự đầu tiên.',
    action: <Button>+ Nhân sự</Button>,
  }}
>
  <DataTable ... />
</TableContainer>

// Cách 2: Custom ReactNode (khuyên dùng khi có filter phức tạp)
<TableContainer
  toolbar={<DepartmentsFilter keyword={keyword} ... />}
  loading={isLoading}
  error={error}
  errorTitle="Không thể tải dữ liệu"
  isFilterActive={isFilterActive}
  onClearFilters={resetFilters}
  emptyState={{
    title: isFilterActive ? 'Không có kết quả' : 'Chưa có dữ liệu',
    action: <Button>Thêm mới</Button>,
  }}
>
  <DepartmentsTable ... />
</TableContainer>
```

**Các page đã migrate dùng TableContainer:**

| Page                         | Custom Toolbar        | File                                                |
| ---------------------------- | --------------------- | --------------------------------------------------- |
| DepartmentsPage (table view) | `<DepartmentsFilter>` | `src/modules/departments/pages/DepartmentsPage.tsx` |
| EmployeesPage                | `<EmployeesFilter>`   | `src/modules/employees/pages/EmployeesPage.tsx`     |

### Exception đã được ghi nhận: OrgUnitsPage

`src/modules/org-units/pages/OrgUnitsPage.tsx` **không** dùng `TableContainer` — đây
là deviation có chủ đích đã document, không phải thiếu sót cần fix.

**Lý do:** OrgUnitsPage có `viewMode` toggle giữa **Cây** (`OrgUnitTree` + split
detail panel) và **Bảng** (`OrgUnitsTable`), dùng chung 1 toolbar
(`OrgUnitsToolbar`) và chung loading/error state (`isTreeLoading`/`treeError`) cho
cả 2 view. `TableContainer` được thiết kế cho 1 page = 1 table độc lập với
toolbar/loading/error/empty-state riêng của chính nó:

- Nhánh `viewMode === 'tree'` không phải table — không có gì để bọc trong
  `TableContainer`.
- Nhánh `viewMode === 'table'` không đứng độc lập được vì toolbar và
  loading/error đến từ state dùng chung với Cây (ép tách riêng sẽ phải nhân đôi
  `OrgUnitsToolbar` hoặc tách state, thay đổi UX hiện tại mà không có lợi ích rõ
  ràng).

Vì vậy OrgUnitsPage tự quản lý `ApiErrorAlert`/`EmptyState`/`FilteredEmptyState`
và layout split tree/detail thay vì dùng `TableContainer`. Nếu sau này tách
Cây/Bảng thành 2 route hoặc 2 component độc lập, nhánh Bảng nên migrate sang
`TableContainer` theo pattern chuẩn.

### ⚠️ Exception: OrgUnits sort/pagination là client-side, KHÔNG phải server-side

**Khác với Employees/Departments**, sort và pagination của OrgUnits Table view
**không** gửi `sort_by`/`sort_order`/`page` lên BE để lọc/sắp xếp. Cụ thể:

- Toàn bộ cây được tải 1 lần từ `GET /org_units/tree` (không có query sort/filter/page).
- Sort (`sortOrgUnitTree`) và filter chạy **client-side** trên cây đã tải, sau đó mới cắt
  trang (`sortedTreeForTable.slice(...)`) — xem
  `src/modules/org-units/pages/OrgUnitsPage.tsx` (biến `sortedTreeForTable`/`pagedTreeForTable`).
- `serverPagination`/`onSortChange` truyền vào `DataTable`/`OrgUnitsTable` chỉ điều khiển
  **UI component** (không tự phân trang/sort data được truyền vào) — chúng **không** kích hoạt
  request BE mới với query sort/page tương ứng, khác hẳn Employees/Departments.

**Lý do:** `GET /org_units` (flat, có sort/pagination BE thật) làm mất cấu trúc cây cha-con bắt
buộc phải hiển thị; còn `GET /org_units/tree` (giữ cây) không hỗ trợ bất kỳ tham số sort/filter/
page nào ở BE. Bằng chứng test API thật: `docs/tickets/BE_ORG_UNIT_SORT_TICKET.md`. Đây là
**accepted deviation** đã được ghi trong
`docs/tickets/ACCEPTED_DEVIATION_ORG_UNITS_TABLE_PATTERN.md`, chờ BE bổ sung `sort_by`/`sort_order`
thật hoặc endpoint `tree-paged`.

**Khi review/QA:** không coi đây là "đã đạt AC pagination/sort server-side" chỉ vì UI có phân
trang và sort hoạt động đúng trên màn hình — hành vi đúng nhưng cơ chế là client-side trên dữ
liệu đã tải toàn bộ, không phải BE trả đúng trang/đúng thứ tự theo query.

### 3. `TableToolbar` / `FilterBar` Components

Dùng trong toolbar slot hoặc standalone. `FilterBar` là wrapper layout chuẩn.

```tsx
<FilterBar actions={<Button>Thêm mới</Button>}>
  <SearchInput ... />
  <Select ... />
</FilterBar>
```

### 4. `FilteredEmptyState` Component

Empty state khi không có kết quả khớp filter (tự động dùng bởi `TableContainer` khi `isFilterActive=true`).

```tsx
<FilteredEmptyState
  onClearFilters={resetFilters}
  activeFilters={
    <Tag>
      Chi nhánh Hà Nội <CloseCircleOutlined />
    </Tag>
  }
/>
```

### 5. `DataTable` Component

Table component với server-side pagination, STT column, row selection.

```tsx
<DataTable
  columns={columns}
  dataSource={data}
  serverPagination={{
    total: 100,
    current: page,
    pageSize: pageSize,
    onChange: (p, ps) => {
      setPage(p);
      setPageSize(ps);
    },
  }}
  loading={loading}
/>
```

## 🎯 Pattern hoàn chỉnh

### Example: Employee List Page

```tsx
export function EmployeesPage() {
  const {
    search: keyword,
    setSearch: setKeyword,
    filters, setFilter,
    page, setPage,
    pageSize: perPage, setPageSize: setPerPage,
    resetFilters,
    getApiParams,
  } = useTablePattern({ initialPageSize: 15 });

  const debouncedKeyword = getApiParams().search;
  const isFiltering = Boolean(keyword || filters.orgFilter !== 'all' || ...);
  const { data, isLoading, error, refetch } = useEmployeeList(listParams);
  const tableData = data?.data ?? [];

  return (
    <TableContainer
      toolbar={
        <EmployeesFilter
          keyword={keyword}
          onKeywordChange={setKeyword}
          orgFilter={orgFilter}
          onOrgFilterChange={(v) => setFilter('orgFilter', v)}
          // ... các filter props khác
          actions={
            <>
              <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
              <Button type="primary" icon={<PlusOutlined />}>Thêm nhân sự</Button>
            </>
          }
        />
      }
      loading={isLoading && tableData.length === 0}
      error={isError ? error : null}
      errorTitle="Không tải được danh sách"
      onRetry={refetch}
      isFilterActive={isFiltering}
      onClearFilters={resetFilters}
      emptyState={{
        title: isFiltering ? 'Không có kết quả' : 'Chưa có nhân sự',
        description: isFiltering ? 'Thử xóa bộ lọc' : 'Tạo mới nhân sự.',
        action: !isFiltering ? <Button>+ Thêm nhân sự</Button> : undefined,
      }}
    >
      <EmployeesTable
        data={tableData}
        loading={isLoading}
        serverPagination={{
          current: page,
          pageSize: perPage,
          total,
          onChange: (p, ps) => { setPage(p); setPerPage(ps); },
        }}
        // ... các props khác
      />
    </TableContainer>
  );
}
```

## 🔑 Key Principles

### 1. **ONE Standard Container** - Chỉ dùng `TableContainer`

- Không dùng `Card` thủ công
- Không dùng `Card + DepartmentsFilter` riêng rẽ
- Tận dụng `loading`, `error`, `emptyState` props của `TableContainer`

### 2. Custom Toolbar cho filter phức tạp

- Page có nhiều filter (3+): dùng ReactNode (vd: `DepartmentsFilter`, `EmployeesFilter`)
- Page có ít filter: dùng ToolbarConfig object

### 3. Server-side Pagination (Pattern chuẩn)

```tsx
// Cách đúng: dùng DataTable.serverPagination + showTopPagination
<DataTable
  serverPagination={{ total, current: page, pageSize: perPage, onChange: ... }}
  showTopPagination={true}
  topPaginationConfig={{
    total,
    current: page,
    pageSize: perPage,
    unitName: 'nhân sự',
    pageSizeOptions: [15, 20, 50, 100],
    onChange: ...
  }}
/>
```

**Lưu ý quan trọng:**

- **KHÔNG** tự render `TopPagination` bên ngoài `DataTable` rồi truyền `pagination={false}`
- **KHÔNG** dùng `pagination` prop (cũ) trên table component
- Chỉ dùng `serverPagination` prop — đây là pattern chuẩn đã được refactor cho Employees, Departments,
  OrgUnits. **Lưu ý:** `serverPagination` ở đây chỉ nói về _cơ chế UI component_ (`DataTable` nhận
  `total`/`current`/`pageSize` từ ngoài thay vì tự phân trang toàn bộ data truyền vào) — với
  OrgUnits Table view, dữ liệu đứng sau `serverPagination` **không** đến từ BE query params như
  Employees/Departments. Xem chi tiết ở mục "Exception: OrgUnits sort/pagination là client-side"
  ngay dưới.

### 4. Empty States

- `emptyState.title` + `emptyState.description` + `emptyState.action`
- `isFilterActive` + `onClearFilters` cho filtered empty state

### 5. Column Actions cố định ở cột cuối, fixed right

```tsx
{ title: 'Thao tác', key: 'actions', width: 160, fixed: 'right' }
```

## 📋 Checklist khi tạo màn hình Table mới

- [ ] Dùng `useTablePattern` hook để quản lý state
- [ ] Dùng `TableContainer` làm wrapper (KHÔNG dùng Card thủ công)
- [ ] Dùng custom toolbar component hoặc `ToolbarConfig` object
- [ ] Dùng `DataTable` với `serverPagination` + `showTopPagination={true}` + `topPaginationConfig`
- [ ] **KHÔNG** tự render TopPagination bên ngoài DataTable
- [ ] **KHÔNG** truyền `pagination={false}` vào DataTable
- [ ] Có empty state cho "chưa có dữ liệu" và "không có kết quả filter"
- [ ] Actions cột cuối, fixed right
- [ ] Sortable columns có `sorter: true`
- [ ] Responsive: dùng `responsive: ['md']` để ẩn cột trên mobile

## 🎨 Wireframe Reference

Xem wireframe P0 để hiểu UI/UX chuẩn:

- `Wireframe P0/BA Wireframe P0 - 01 Org Unit.dc.html` - Org Unit table
- `Wireframe P0/BA Wireframe P0 - 02 Department.dc.html` - Department table
- `Wireframe P0/BA Wireframe P0 - 04 Employee.dc.html` - Employee table
