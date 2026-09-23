import { useSearchParams } from "react-router-dom";
import IoHistoryReport from "@/modules/reports/io-history/IoHistoryReport";
import Rpt08HistoryReport from "@/modules/reports/io-history/rpt08/Rpt08HistoryReport";

/**
 * RPT-08 — route /reports/pending-evidence.
 *
 * `screen=RPT-08` chỉ chọn lớp trình bày đã đồng bộ Golden Master.
 * Cả hai nhánh đều đọc dữ liệu qua API thật; query `state`/preview không còn
 * quyền ép loading/empty/error hoặc chèn dữ liệu mẫu vào runtime.
 */
export default function PendingEvidenceReportPage() {
  const [params] = useSearchParams();
  const useRPT08Presentation =
    params.get("screen")?.trim().toUpperCase() === "RPT-08";

  return (
    <div data-testid="wwhn-258-report-screen">
      {useRPT08Presentation ? <Rpt08HistoryReport /> : <IoHistoryReport />}
    </div>
  );
}
