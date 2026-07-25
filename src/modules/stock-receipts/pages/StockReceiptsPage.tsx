import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Stock Receipts - Phiếu nhập kho
 */
export function StockReceiptsPage() {
  return (
    <PlaceholderPage
      title="Phiếu nhập kho"
      description="Quản lý phiếu nhập kho, nhà cung cấp"
      features={['Tạo phiếu nhập', 'Danh sách phiếu nhập', 'Xác nhận nhập kho']}
    />
  );
}
