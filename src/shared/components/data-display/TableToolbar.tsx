import type { ReactNode } from "react";
import { FilterBar } from "./FilterBar";
import { SearchInput } from "./SearchInput";
export interface TableToolbarProps {
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Current search value */
  searchValue?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Filter controls (Select, DatePicker, etc.) */
  filters?: ReactNode;
  /** Action buttons (Export, Add new, etc.) */
  actions?: ReactNode;
  /** Additional class name */
  className?: string;
  /** Additional styles */
  style?: React.CSSProperties;
}

/**
 * Standardized toolbar for table pages: search + filters on the left, actions on the right.
 *
 * @example
 * ```tsx
 * <TableToolbar
 *   searchPlaceholder="Tìm nhân sự..."
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   filters={
 *     <>
 *       <Select placeholder="Chi nhánh" ... />
 *       <Select placeholder="Phòng ban" ... />
 *     </>
 *   }
 *   actions={
 *     <>
 *       <ActionButton
  kind="export"
>Export</ActionButton>
 *       <ActionButton
  kind="create"
>+ Nhân sự</ActionButton>
 *     </>
 *   }
 * />
 * ```
 */
export function TableToolbar({
  searchPlaceholder = "Tìm kiếm...",
  searchValue,
  onSearchChange,
  filters,
  actions,
  className,
  style,
}: TableToolbarProps) {
  return (
    <FilterBar actions={actions} className={className} style={style}>
      {onSearchChange && (
        <SearchInput
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={onSearchChange}
        />
      )}
      {filters}
    </FilterBar>
  );
}
