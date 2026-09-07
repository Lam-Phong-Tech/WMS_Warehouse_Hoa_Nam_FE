/**
 * Barrel cho shared components LEGACY/ADAPTER còn hoạt động sau Part 3.
 *
 * BỀ MẶT CANONICAL của design system là `@/shared/ui` (tokens/theme/foundation/
 * forms/layout) — code MỚI import từ đó. Các component dưới đây thuộc 2 nhóm:
 *  1. ADAPTER-CANONICAL: API giữ nguyên, ruột đã render bằng foundation
 *     (EmptyState, LoadingState, ErrorState, NoPermissionState, ApiErrorAlert,
 *     Loading, PageSkeleton, StatusTag, TopPagination…).
 *  2. ADAPTER antd còn lại (FilterBar, ScanInput, PageHeader…) — consumer bị
 *     đóng băng bằng guard `deprecated-components`
 *     (docs/ui/vuexy-sync/allowlists/deprecated-components.json).
 *     Part 5: DataTable/PageSizeSelector/useSortTooltipColumns/SubmitButton
 *     đã XOÁ (consumer = 0).
 */

// layout/ — chỉ còn PageHeader (adapter, consumer đóng băng)
export { PageHeader, type PageHeaderProps } from "./layout/PageHeader";

// data-display/ — hiển thị dữ liệu
export { EmptyState, type EmptyStateProps } from "./data-display/EmptyState";
export { StatusTag, type StatusTagProps } from "./data-display/StatusTag";
export {
  EMPLOYEE_STATUS_COLOR_MAP,
  EMPLOYEE_STATUS_LABEL_MAP,
} from "./data-display/status-tag.constants";
export {
  LoadingState,
  type LoadingStateProps,
} from "./data-display/LoadingState";
export { SearchInput, type SearchInputProps } from "./data-display/SearchInput";
export { FilterBar, type FilterBarProps } from "./data-display/FilterBar";
export {
  ResponsiveDataTable,
  type ResponsiveDataTableProps,
  type ResponsiveTableColumn,
} from "./data-display/ResponsiveDataTable";
export {
  useTablePattern,
  type TableFilters,
  type TableSort,
} from "@/shared/hooks/useTablePattern";
export {
  TopPagination,
  type TopPaginationProps,
} from "./data-display/TopPagination";
export { CopyableId, type CopyableIdProps } from "./data-display/CopyableId";
export { SkuLink, type SkuLinkProps } from "./data-display/SkuLink";
export { shortId } from "@/shared/utils/shortId";

// feedback/ — trạng thái, lỗi
export { Loading } from "./feedback/Loading";
export {
  ApiErrorAlert,
  type ApiErrorAlertProps,
} from "./feedback/ApiErrorAlert";
export {
  ErrorBoundary,
  type ErrorBoundaryProps,
} from "./feedback/ErrorBoundary";
export {
  ActionDropdown,
  type ActionDropdownProps,
  type ActionItem,
} from "./feedback/ActionDropdown";
export { NoPermissionState } from "./feedback/NoPermissionState";
export type { NoPermissionStateProps } from "./feedback/NoPermissionState";

// ui-states/ - page-level loading, empty, error
export { PageSkeleton } from "./ui-states/PageSkeleton";
export { ErrorState, type ErrorStateProps } from "./ui-states/ErrorState";

// permission/ — kiểm soát quyền truy cập
export { PermissionGuard } from "./permission/PermissionGuard";
export type { PermissionGuardProps } from "./permission/PermissionGuard";

// motion/ — chuyển động dùng chung (token là mirror của @/shared/ui/tokens)
export {
  AnimatedList,
  AnimatedListItem,
  type AnimatedListProps,
  type AnimatedListItemProps,
} from "./motion/AnimatedList";
export { createRowKey } from "./motion/row-key";
export { useReducedMotion } from "./motion/useReducedMotion";
export {
  MOTION_DURATION,
  MOTION_EASING,
  MOTION_ENABLED,
  motionDuration,
} from "./motion/motion-tokens";

// actions/ — nút thao tác chuẩn (icon + nhãn, màu theo nghiệp vụ)
export {
  ActionButton,
  type ActionButtonProps,
  ActionIconButton,
  type ActionIconButtonProps,
  ActionGroup,
  type ActionGroupProps,
  ACTION_KINDS,
  actionColor,
  actionIcon,
  type ActionKind,
} from "./actions";

// forms/ — chỉ còn scan components (xem ./forms/index.ts)
export * from "./forms";
export { type CommonProps, type FieldProps } from "./lib/common-props";
