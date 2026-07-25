import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Stock Transfers - Điều chuyển kho
 */
export function StockTransfersPage() {
  return (
    <PlaceholderPage
      title="Điều chuyển kho"
      description="Quản lý điều chuyển hàng giữa các kho"
      features={[
        'Tạo điều chuyển',
        'Danh sách điều chuyển',
        'Xác nhận điều chuyển',
      ]}
    />
  );
}
