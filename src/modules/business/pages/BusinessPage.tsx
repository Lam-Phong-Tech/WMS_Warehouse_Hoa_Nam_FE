import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Business - Quản lý kinh doanh
 */
export function BusinessPage() {
  return (
    <PlaceholderPage
      title="Module 3 · Kinh doanh"
      description="Quản lý sản phẩm, khách hàng, đơn hàng"
      features={[
        'Sản phẩm',
        'Bảng giá',
        'Khách hàng',
        'Đơn hàng',
        'Kênh bán hàng',
      ]}
    />
  );
}
