import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Sales Orders - Đơn hàng
 */
export function SalesOrdersPage() {
  return (
    <PlaceholderPage
      title="Đơn hàng"
      description="Quản lý đơn hàng bán hàng"
      features={['Danh sách đơn hàng', 'Tạo đơn hàng', 'Trạng thái đơn hàng']}
    />
  );
}
