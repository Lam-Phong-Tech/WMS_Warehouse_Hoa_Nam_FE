import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { TraceModal } from "@/modules/inventory/components/TraceModal";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/app/layouts/system-shell.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/styles/hn-wms-source-screen.css";
import "@/shared/ui/operations-ui.css";
import "@/styles/hn-responsive.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true });
const longName =
  "Máy khoan với tên sản phẩm dài để kiểm tra đầy đủ dữ liệu truy vết, thông tin nhận diện và trạng thái đối chiếu trong thanh bên";
const longSuffix =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const sourceLines = Array.from({ length: 12 }, (_, index) => ({
  id: `line-${index + 1}`,
  sku_code: `SKU-TRACE-${String(index + 1).padStart(3, "0")}-${longSuffix}`,
  sku_name: longName,
  quantity: index === 0 ? null : index + 1,
  status: index === 0 ? "UNKNOWN_STATE" : "POSTED",
}));
const chain = Array.from({ length: 12 }, (_, index) => ({
  id: `chain-${index + 1}`,
  movement_no: `CHAIN-${String(index + 1).padStart(3, "0")}-${longSuffix}`,
  movement_type: index === 0 ? "ISSUE" : "REVERSAL",
  role: index === 0 ? "ORIGINAL" : "REVERSAL",
  depth: index,
  is_subject: index === 0,
  occurred_at: "2026-11-04T08:10:00+07:00",
  warehouse_code: "WH-HOA-NAM",
  product_code: "SKU-TRACE-001",
  stock_status: "AVAILABLE",
  quantity: index === 0 ? 10 : 1,
  qty_delta: index === 0 ? -10 : 1,
  qty_before: null,
  qty_after: null,
  actor: "Nguyễn Văn Quản Trị Viên Với Tên Dài Để Kiểm Tra Dữ Liệu Truy Vết",
  original_movement_id: index === 0 ? null : "mv-out",
  correction_chain_id: "correction-chain-1",
  reversal_document_no:
    index === 0 ? null : `RV-20261104-${index}-${longSuffix}`,
  reversal_status: index === 0 ? null : "POSTED",
  reason_code: null,
  reason_text:
    "Điều chỉnh theo kết quả kiểm tra chứng từ và đối chiếu số lượng thực tế đã ghi nhận",
}));
const attempts = { source: 0, physical: 0 };

function traceSource(id: string) {
  const inbound = id !== "mv-out";
  return {
    source: {
      source_type: inbound ? "INBOUND" : "OUTBOUND",
      source_code: `${inbound ? "PN" : "PX"}-TRACE-${longSuffix}`,
      status: "POSTED",
      posted_at: "2026-11-04T08:06:00+07:00",
      actor_name: "Quản trị viên vận hành và đối chiếu chứng từ Hoa Nam",
    },
    request_id: "technical-request-id-must-not-appear",
    lines: sourceLines,
    timeline: [
      {
        from_status: "DRAFT",
        to_status: "POSTED",
        created_at: "2026-11-04T08:06:00+07:00",
      },
    ],
    correction_chain: {
      nodes: chain,
      root_movement_id: "mv-out",
      truncated: false,
    },
    net_effect: {
      basis: "SIGNED_STOCK_LEDGER",
      original_movement_id: "mv-out",
      original_movement_type: inbound ? "RECEIPT" : "ISSUE",
      original_qty: 10,
      reversed_qty: 6,
      remaining_reversible_qty: 4,
      net_qty_delta: -4,
      fully_reversed: false,
      reversal_count: 11,
    },
  };
}

function physicalTrace(code: string) {
  const box = code === "BOX-CODE";
  return {
    physical_code: {
      code_value: code,
      carrier_type: box ? "RFID" : "QR",
      status: "ACTIVE",
    },
    resolved_type: box ? "CONTAINER" : "ITEM",
    resolved_id: box ? "box-1" : "item-1",
    resolved_by: "PHYSICAL_CODE",
    resolved_object: box
      ? {
          container_code: `BOX-RESOLVED-${longSuffix}`,
          container_type: "BOX",
          status: "SEALED",
        }
      : {
          sku_code: `SKU-PHYSICAL-${longSuffix}`,
          sku_name: "Máy khoan được nhận diện chính xác bằng mã vật lý",
          status: "IN_STOCK",
        },
    container_items: [
      {
        id: "box-1",
        container_code: `BOX-PHYSICAL-001-${longSuffix}`,
        container_type: "BOX",
        quantity: null,
        status: "SEALED",
      },
      {
        id: "box-2",
        container_code: "BOX-PHYSICAL-002",
        container_type: "BOX",
        quantity: 4,
        status: "SEALED",
      },
    ],
    movements: [
      {
        id: "physical-movement-1",
        movement_no: `MV-PHYSICAL-${longSuffix}`,
        movement_type: "RECEIPT",
        product_code: "SKU-PHYSICAL-001",
        qty_delta: null,
        doc_no: `PN-PHYSICAL-${longSuffix}`,
        occurred_at: "2026-11-04T08:06:00+07:00",
      },
    ],
    warranty_history: box
      ? []
      : [
          {
            warranty_case_id: "warranty-1",
            warranty_case_code: `WC-PHYSICAL-${longSuffix}`,
            status: "CHECKING",
            received_at: "2026-11-04T08:06:00+07:00",
            customer_name: "Khách hàng kiểm tra truy vết",
            customer_phone: "0901234567",
            defect_name: "Máy không khởi động khi kiểm tra nguồn điện",
            events: [
              {
                warranty_event_id: "event-1",
                event_at: "2026-11-04T08:10:00+07:00",
                to_status: "CHECKING",
                note: "Đã tiếp nhận kiểm tra sản phẩm",
              },
            ],
          },
        ],
  };
}

// Production hooks/service normalizers run against deterministic, read-only local responses.
http.get = async (url, config) => {
  if (url === "/stock-movements/trace-by-code") {
    const code = String(config?.params?.code ?? "");
    if (code === "ERR-RETRY" && attempts.physical++ === 0)
      throw new Error("Fixture physical lookup unavailable");
    return physicalTrace(code) as never;
  }
  if (url.endsWith("/trace-source")) {
    const id = url.split("/").at(-2)!;
    if (id === "mv-error" && attempts.source++ === 0)
      throw new Error("Fixture source unavailable");
    return traceSource(id) as never;
  }
  if (url.startsWith("/stock-movements/")) {
    const id = url.split("/").at(-1)!;
    return {
      id,
      movement_no: `MOVE-${id}-${longSuffix}`,
      movement_type: id === "mv-out" ? "ISSUE" : "RECEIPT",
      sku_code: `SKU-MOVE-${longSuffix}`,
      warehouse_name: "Kho tổng Hoa Nam — Khu tiếp nhận và vận hành phía Nam",
      qty_delta: id === "mv-out" ? -10 : 10,
      qty_before: null,
      qty_after: 29,
      occurred_at: "2026-11-04T08:06:00+07:00",
      document_type: id === "mv-out" ? "OUTBOUND" : "INBOUND",
      document_code: `${id === "mv-out" ? "PX" : "PN"}-MOVE-${longSuffix}`,
    } as never;
  }
  throw new Error(`Unexpected trace fixture GET: ${url}`);
};
http.post = async () => {
  throw new Error("Trace fixture does not permit writes");
};

export function TraceDrawerFixture() {
  const [selected, setSelected] = useState<{
    movementId: string | null;
  } | null>(null);
  return (
    <main
      style={{
        padding: 24,
        minHeight: "100vh",
        background: "var(--ops-canvas)",
        color: "var(--ops-text)",
      }}
    >
      <h1>Tra cứu tồn &amp; đối soát</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <button
          type="button"
          onClick={() => setSelected({ movementId: "mv-out" })}
        >
          Truy vết phiếu xuất
        </button>
        <button
          type="button"
          onClick={() => setSelected({ movementId: "mv-in" })}
        >
          Truy vết phiếu nhập
        </button>
        <button
          type="button"
          onClick={() => setSelected({ movementId: "mv-error" })}
        >
          Thử lỗi nguồn
        </button>
        <button type="button" onClick={() => setSelected({ movementId: null })}>
          Mở tra cứu mã vật lý
        </button>
      </div>
      {selected ? (
        <TraceModal
          movementId={selected.movementId}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </main>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/inventory?screen=INV-01"]}>
        <TraceDrawerFixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
