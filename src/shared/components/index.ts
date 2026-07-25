/**
 * Barrel cho toàn bộ shared components, gom theo nhóm chức năng.
 * Điểm import DUY NHẤT để màn nghiệp vụ dùng nhất quán, tránh copy UI vào page:
 *
 *   import { PageHeader, DataTable, FormModal, StatCard } from '@/shared/components';
 *   import { FormInput, TextField } from '@/shared/components/forms';
 *
 * Cấu trúc thư mục theo taxonomy:
 *   layout/ · forms/ · data-display/ · feedback/ · navigation/ · cards/
 * Quy ước: file PascalCase, mỗi component export kèm `<Tên>Props`.
 */

// layout/ — khung bố cục
export { AppShell, type AppShellProps } from './layout/AppShell';
export { Sidebar, type SidebarProps } from './layout/Sidebar';
export { Header, type HeaderProps } from './layout/Header';
export {
  Breadcrumb,
  type BreadcrumbProps,
  type BreadcrumbItemType,
} from './layout/Breadcrumb';
export { PageHeader, type PageHeaderProps } from './layout/PageHeader';

// data-display/ — hiển thị dữ liệu
export {
  DataTable,
  type DataTableProps,
  type ServerPagination,
} from './data-display/DataTable';
export { EmptyState, type EmptyStateProps } from './data-display/EmptyState';
export { StatusBadge, type StatusBadgeProps } from './data-display/StatusBadge';
export { StatusTag, type StatusTagProps } from './data-display/StatusTag';
export {
  EMPLOYEE_STATUS_COLOR_MAP,
  EMPLOYEE_STATUS_LABEL_MAP,
} from './data-display/status-tag.constants';
export {
  LoadingState,
  type LoadingStateProps,
} from './data-display/LoadingState';
export { SearchInput, type SearchInputProps } from './data-display/SearchInput';
export { FilterBar, type FilterBarProps } from './data-display/FilterBar';
export {
  useSortTooltipColumns,
  type ColumnWithSortType,
} from './data-display/useSortTooltipColumns';
export {
  useTablePattern,
  type TableFilters,
  type TableSort,
} from '@/shared/hooks/useTablePattern';
export {
  TopPagination,
  type TopPaginationProps,
} from './data-display/TopPagination';
export {
  PageSizeSelector,
  type PageSizeSelectorProps,
} from './data-display/PageSizeSelector';
export {
  TableToolbar,
  type TableToolbarProps,
} from './data-display/TableToolbar';
export {
  TableContainer,
  FilteredEmptyState,
  type TableContainerProps,
} from './data-display/TableContainer';

// feedback/ — trạng thái, lỗi, modal
export { Loading } from './feedback/Loading';
export { Modal, type ModalProps } from './feedback/Modal';
export { FormModal, type FormModalProps } from './feedback/FormModal';
export { FormDrawer, type FormDrawerProps } from './feedback/FormDrawer';
export { DetailDrawer, type DetailDrawerProps } from './feedback/DetailDrawer';
export { FormPage, type FormPageProps } from './feedback/FormPage';
export { FormSection, type FormSectionProps } from './feedback/FormSection';
export { FormActions, type FormActionsProps } from './feedback/FormActions';
export {
  ConfirmButton,
  type ConfirmButtonProps,
} from './feedback/ConfirmButton';
export {
  confirmDialog,
  type ConfirmDialogOptions,
} from './feedback/ConfirmDialog';
export { Alert, type AlertProps } from './feedback/Alert';
export {
  ApiErrorAlert,
  type ApiErrorAlertProps,
} from './feedback/ApiErrorAlert';
export { FieldError, type FieldErrorProps } from './feedback/FieldError';
export {
  ErrorBoundary,
  type ErrorBoundaryProps,
} from './feedback/ErrorBoundary';
export {
  ActionDropdown,
  type ActionDropdownProps,
  type ActionItem,
} from './feedback/ActionDropdown';
export { NoPermissionState } from './feedback/NoPermissionState';
export type { NoPermissionStateProps } from './feedback/NoPermissionState';

// permission/ — kiểm soát quyền truy cập
export { PermissionGuard } from './permission/PermissionGuard';
export type { PermissionGuardProps } from './permission/PermissionGuard';
export { ActionButton } from './permission/ActionButton';
export type { ActionButtonProps } from './permission/ActionButton';

// navigation/ — điều hướng
export { MenuItem, type MenuItemProps } from './navigation/MenuItem';
export { Pagination, type PaginationProps } from './navigation/Pagination';
export { Tabs, type TabsProps } from './navigation/Tabs';

// cards/ — thẻ thông tin
export { StatCard, type StatCardProps } from './cards/StatCard';
export { InfoCard, type InfoCardProps } from './cards/InfoCard';

// forms/ — field nhập liệu (cũng có barrel riêng tại './forms')
export * from './forms';
export { type CommonProps, type FieldProps } from './lib/common-props';
