import { PlaceholderPage } from '@/shared/components/ui-states/PlaceholderPage';

/**
 * Placeholder page cho Sales Channels - Kênh bán hàng
 */
export function SalesChannelsPage() {
  return (
    <PlaceholderPage
      title="Kênh bán hàng"
      description="Quản lý kênh bán hàng, cửa hàng"
      features={['Danh sách kênh bán', 'Cấu hình kênh', 'Báo cáo theo kênh']}
    />
  );
}
