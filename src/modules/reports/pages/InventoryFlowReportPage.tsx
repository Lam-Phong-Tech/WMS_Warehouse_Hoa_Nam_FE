import InventoryFlowXntReport from "@/modules/reports/inventory-flow/InventoryFlowXntReport";

/**
 * RPT-01 — route /reports/inventory-flow, nay là "Báo cáo nhập kho".
 *
 * Trang dựng nguyên khối theo mockup UI/UX đã chốt 8.1 (breadcrumb +
 * page-header + padding riêng của mockup), nên KHÔNG bọc trong
 * `hn-mvp-source-screen`: lớp đó áp style riêng cho `.card` / `table` / `.chip`
 * và sẽ đè lên bản port. `data-testid` giữ nguyên làm mốc cho bộ E2E báo cáo.
 *
 * Phần XUẤT tách sang `OutboundFlowReportPage` (RPT-01B) theo yêu cầu người
 * dùng 2026-09-06; phần TỒN bỏ hẳn — RPT-02 lo phần đó.
 */
export default function InventoryFlowReportPage() {
  return (
    <div data-testid="wwhn-258-report-screen">
      <InventoryFlowXntReport variant="inbound" />
    </div>
  );
}
