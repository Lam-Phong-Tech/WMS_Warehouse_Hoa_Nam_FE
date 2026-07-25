import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Inventory Balance - Tồn kho
 */
export function InventoryBalancePage() {
  return (
    <PlaceholderPage
      title="Tồn kho"
      description="Xem báo cáo tồn kho hiện tại"
      features={['Báo cáo tồn kho', 'Lọc theo kho', 'Lọc theo sản phẩm']}
    />
  );
}
