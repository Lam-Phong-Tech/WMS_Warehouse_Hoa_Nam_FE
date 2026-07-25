import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Products - Sản phẩm
 */
export function ProductsPage() {
  return (
    <PlaceholderPage
      title="Sản phẩm"
      description="Quản lý danh mục sản phẩm"
      features={[
        'Danh sách sản phẩm',
        'Thông tin sản phẩm',
        'Quản lý danh mục',
      ]}
    />
  );
}
