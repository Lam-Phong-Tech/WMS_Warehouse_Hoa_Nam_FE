import InventoryFlowXntReport from "@/modules/reports/inventory-flow/InventoryFlowXntReport";

/**
 * RPT-01B — route /reports/outbound-flow, "Báo cáo xuất kho".
 *
 * Cùng một bản port với RPT-01 (cùng nguồn số, cùng khối, cùng số đo), chỉ khác
 * biến thể: trang này vẽ phần XUẤT (xuất sản phẩm + xuất linh kiện). Giữ nguyên
 * `data-testid` của vỏ trang báo cáo để bộ E2E dùng chung một mốc.
 */
export default function OutboundFlowReportPage() {
  return (
    <div data-testid="wwhn-258-report-screen">
      <InventoryFlowXntReport variant="outbound" />
    </div>
  );
}
