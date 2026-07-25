import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Warehouses - Kho hàng
 */
export function WarehousesPage() {
  return (
    <PlaceholderPage
      title="Kho hàng"
      description="Quản lý thông tin kho hàng, vị trí lưu trữ"
      features={[
        'Danh sách kho hàng',
        'Thông tin chi tiết kho',
        'Vị trí lưu trữ',
      ]}
    />
  );
}
