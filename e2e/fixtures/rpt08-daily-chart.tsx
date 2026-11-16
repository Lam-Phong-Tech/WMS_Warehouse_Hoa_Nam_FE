import { createRoot } from "react-dom/client";
import dayjs from "dayjs";
import { DailyChart } from "@/modules/reports/io-history/rpt08/widgets";
import {
  buildDaily,
  type HistoryRow,
} from "@/modules/reports/io-history/rpt08/model";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/styles/hn-icon-font.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";
import "@/modules/reports/io-history/io-history-report.css";

const days = Number(new URLSearchParams(location.search).get("days") ?? 7);
const from = "2026-01-01";
const to = dayjs(from)
  .add(days - 1, "day")
  .format("YYYY-MM-DD");
const row: HistoryRow = {
  id: "last-day",
  timestamp: `${to}T12:00:00+07:00`,
  documentNo: "PN-LAST",
  type: "INBOUND",
  objectPrimary: "SKU",
  objectSecondary: "Product",
  quantity: 1,
  actor: "Tester",
  department: "Kho",
  createdAt: to,
  movementCount: 1,
  movementNo: "MV-LAST",
  lines: [],
};
createRoot(document.getElementById("root")!).render(
  <main
    id="rpt08-history-report"
    className="rpt08-report"
    style={{ padding: 24 }}
  >
    <div className="rpt08-analysis-grid">
      <DailyChart daily={buildDaily([row], from, to)} total={1} />
      <section className="rpt08-card">Activity</section>
    </div>
    <section
      className="rpt08-card"
      data-testid="following-table"
      style={{ height: 160 }}
    >
      Lịch sử nhập - xuất kho
    </section>
  </main>,
);
