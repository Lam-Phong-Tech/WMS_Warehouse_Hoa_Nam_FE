import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Module 2 - Quản lý Kho
 * Sẽ được thay thế bằng giao diện thực tế khi triển khai
 */
export function WarehousePage() {
  return (
    <PlaceholderPage
      title="Module 2 · Quản lý Kho"
      description="Quản lý kho đa tầng, phiếu nhập/xuất/chuyển, tồn kho"
      features={[
        'Quản lý kho hàng',
        'Phiếu nhập kho',
        'Phiếu xuất kho',
        'Điều chuyển kho',
        'Tồn kho',
        'Biến động tồn',
      ]}
    />
  );
}
