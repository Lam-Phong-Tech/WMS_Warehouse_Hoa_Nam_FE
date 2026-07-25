import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Stock Movements - Biến động tồn
 */
export function StockMovementsPage() {
  return (
    <PlaceholderPage
      title="Biến động tồn"
      description="Lịch sử biến động tồn kho"
      features={[
        'Lịch sử biến động',
        'Lọc theo sản phẩm',
        'Lọc theo thời gian',
      ]}
    />
  );
}
