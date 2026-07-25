import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Price Lists - Bảng giá
 */
export function PriceListsPage() {
  return (
    <PlaceholderPage
      title="Bảng giá"
      description="Quản lý bảng giá bán hàng"
      features={['Danh sách bảng giá', 'Cấu hình giá', 'Lịch sử giá']}
    />
  );
}
