import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import PackingLabelPrintReport from "@/modules/reports/packing-label/PackingLabelPrintReport";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/shared/ui/operations-ui.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true });
const scenario = new URLSearchParams(location.search).get("state");
const audit = new URLSearchParams(location.search).get("audit");
const labels = Array.from({ length: 8 }, (_, i) => ({
  id: "label-" + i,
  label_code: "PL-20261105-" + String(i + 1).padStart(4, "0"),
  outbound_document_id: "outbound-" + i,
  outbound_no: "PX-20261105-" + String(i + 1).padStart(4, "0"),
  outbound_date: "2026-11-05",
  recipient: i % 2 ? "Công ty thiết bị Tân Phát" : "Đại lý Minh Anh",
  status:
    i === 6
      ? "READY_TO_PRINT"
      : i === 3 || i === 4
        ? "PRINT_FAILED"
        : "PRINTED",
  created_at: "2026-11-05T08:00:00+07:00",
  item_count: 2,
  sku_count: 1,
  sku_summary: "DCA-ADJZ24 x2",
  applied: i < 3,
}));
const events = labels.flatMap((l, i) =>
  i === 6 || i === 7
    ? []
    : Array.from({ length: i < 3 ? 2 : 1 }, (_, j) => ({
        id: "event-" + i + "-" + j,
        label_snapshot_id: l.id,
        printer_config_id:
          audit === "mixed" && j
            ? "printer-b"
            : i % 2
              ? "printer-b"
              : "printer-a",
        created_by: audit && j ? "actor-2" : "actor-1",
        status: i === 5 ? "SENT" : i === 3 || i === 4 ? "FAILED" : "PRINTED",
        event_type: j ? "REPRINT" : "PRINT",
        attempt_no: j + 1,
        error_code: i === 3 ? "PAPER_OUT" : i === 4 ? "PRINTER_OFFLINE" : null,
        requested_at:
          "2026-11-05T" +
          String(9 + j).padStart(2, "0") +
          ":" +
          String(i * 5).padStart(2, "0") +
          ":00+07:00",
        reason: j ? "Nhãn cũ bị rách, cần thay thế" : null,
      })),
);
const snapshots = labels.map((l, i) => ({
  ...l,
  version: 2,
  applied_at: l.applied ? l.created_at : null,
  label_payload:
    i === 7
      ? { label_code: l.label_code, outbound_no: l.outbound_no }
      : {
          label_code: l.label_code,
          outbound_no: l.outbound_no,
          recipient_name: l.recipient,
          outbound_request_no: "TOA-20261105-001",
          items: [
            {
              sku_code: "DCA-ADJZ24",
              sku_name: "Máy khoan dùng pin 20V",
              quantity: 2,
              unit: "cái",
            },
          ],
        },
  print_events: events.filter((e) => e.label_snapshot_id === l.id),
}));
http.get = (async (url: string) => {
  if (url === "/reports/label-log") {
    if (scenario === "error") throw new Error("Không tải được báo cáo");
    return { rows: scenario === "empty" ? [] : labels, summary: {} };
  }
  if (url.startsWith("/label-snapshots/"))
    return snapshots.find((s) => s.id === url.split("/").pop());
  return {};
}) as typeof http.get;
http.getPage = (async (url: string) => ({
  data:
    url === "/label-print-events"
      ? events
      : url === "/printer-configs"
        ? [
            {
              id: "printer-a",
              printer_name: audit
                ? "Máy in đóng gói chi nhánh Hoa Nam với tên dài cần đọc đầy đủ trên màn hình nhỏ"
                : "Zebra ZT411-01",
              printer_code: "ZEBRA-01",
            },
            {
              id: "printer-b",
              printer_name: "TSC TE200-02",
              printer_code: "TSC-02",
            },
          ]
        : url === "/users"
          ? [
              { user_id: "actor-1", display_name: "Nguyễn Thanh Quang" },
              {
                user_id: "actor-2",
                display_name:
                  "Phạm Quốc Bảo — Quản trị hệ thống chi nhánh Hoa Nam",
              },
            ]
          : [],
  meta: { current_page: 1, last_page: 1 },
})) as typeof http.getPage;
// This fixture never contacts a printer or API. Confirmations are safe to exercise.
http.post = (async () => ({ status: "PRINTED" })) as typeof http.post;
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/reports/packing-label"]}>
        <main style={{ padding: "24px", minWidth: 0 }}>
          <PackingLabelPrintReport />
        </main>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
