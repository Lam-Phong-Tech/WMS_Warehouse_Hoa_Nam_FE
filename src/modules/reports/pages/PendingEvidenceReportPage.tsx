import IoHistoryReport from "@/modules/reports/io-history/IoHistoryReport";

/**
 * RPT-08 — route /reports/pending-evidence.
 *
 * Trang dựng nguyên khối theo mockup UI/UX đã chốt 8.3 "Báo cáo Lịch sử nhập –
 * xuất kho" (breadcrumb + page-header + padding riêng của mockup), nên KHÔNG
 * bọc trong `hn-mvp-source-screen`: lớp đó áp style riêng cho `.card` /
 * `table` / `.chip` và sẽ đè lên bản port. `data-testid` giữ nguyên làm mốc
 * cho bộ E2E báo cáo.
 *
 * Đường dẫn `/reports/pending-evidence` và screen-id `RPT-08` được GIỮ NGUYÊN:
 * đó là hợp đồng URL mà deep-link và guard E2E đang neo vào (xem
 * `flow06-report-pagination-export.test.ts`); chỉ nội dung màn đổi.
 */
export default function PendingEvidenceReportPage() {
  return (
    <div data-testid="wwhn-258-report-screen">
      <IoHistoryReport />
    </div>
  );
}
