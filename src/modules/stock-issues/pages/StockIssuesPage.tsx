import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Stock Issues - Phiếu xuất kho
 */
export function StockIssuesPage() {
  return (
    <PlaceholderPage
      title="Phiếu xuất kho"
      description="Quản lý phiếu xuất kho, yêu cầu xuất"
      features={['Tạo phiếu xuất', 'Danh sách phiếu xuất', 'Xác nhận xuất kho']}
    />
  );
}
