import type { ReactNode } from "react";
import { Drawer, Skeleton } from "antd";

export interface DetailDrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Title of the drawer */
  title?: ReactNode;
  /** Handler for close */
  onClose: () => void;
  /** Width of the drawer (default: 420) */
  width?: number | string;
  /** Placement of the drawer */
  placement?: "left" | "right" | "top" | "bottom";
  /** Loading state - shows skeleton when true */
  loading?: boolean;
  /** Skeleton paragraph rows when loading (default: 6) */
  skeletonRows?: number;
  /** Extra content to render at the top-right of the drawer header (action buttons) */
  extra?: ReactNode;
  /** Whether to destroy the drawer content when closed */
  destroyOnClose?: boolean;
  /** Callback after drawer is closed */
  afterClose?: () => void;
  /** Children content */
  children: ReactNode;
}

/**
 * Drawer wrapper for detail/view mode - read-only content display
 * Supports loading state with skeleton, custom width, and header actions
 *
 * @example
 * ```tsx
 * <DetailDrawer
 *   open={open}
 *   title="Chi tiết phòng ban"
 *   onClose={onClose}
 *   loading={loading}
 *   extra={<Button onClick={onEdit}>Chỉnh sửa</Button>}
 * >
 *   <Descriptions>
 *     <Descriptions.Item label="Mã">DEP-001</Descriptions.Item>
 *   </Descriptions>
 * </DetailDrawer>
 * ```
 */
export function DetailDrawer({
  open,
  title,
  onClose,
  width = 420,
  placement = "right",
  loading = false,
  skeletonRows = 6,
  extra,
  destroyOnClose = true,
  afterClose,
  children,
}: DetailDrawerProps) {
  return (
    <Drawer
      open={open}
      title={title}
      onClose={onClose}
      size={width}
      placement={placement}
      destroyOnClose={destroyOnClose}
      afterOpenChange={(isOpen) => {
        if (!isOpen) afterClose?.();
      }}
      extra={extra}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: skeletonRows }} />
      ) : (
        children
      )}
    </Drawer>
  );
}
