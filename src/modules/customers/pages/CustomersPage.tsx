import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Customers - Khách hàng
 */
export function CustomersPage() {
  return (
    <PlaceholderPage
      title="Khách hàng"
      description="Quản lý danh mục khách hàng"
      features={[
        'Danh sách khách hàng',
        'Thông tin khách hàng',
        'Lịch sử mua hàng',
      ]}
    />
  );
}
