import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { ReversalCreateModal } from "@/modules/reverse/components/ReversalCreateModal";
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
import "@/modules/reverse/pages/reversal-list.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true });

declare global {
  interface Window {
    __reversalCreatePosts: { url: string; body: unknown; headers: unknown }[];
  }
}
window.__reversalCreatePosts = [];

const itemSku = "SKU-SERIAL-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";
const qtySku = "SKU-QTY-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";
const serials = [
  "SERIAL-CANDIDATE-001-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
  "SERIAL-CANDIDATE-002-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
];
const lines = [
  {
    id: "line-qty",
    sku: qtySku,
    sku_name:
      "Linh kiện với tên dài để kiểm tra bố cục, số lượng gốc và các giới hạn điều chỉnh trong thanh bên",
    original_qty: 10,
    reversed_qty: 2,
    reversible_qty: 8,
    remaining_qty: 8,
    uom: "cái",
    can_reverse: true,
    item_scoped: false,
    items: [],
  },
  {
    id: "line-item",
    sku: itemSku,
    sku_name:
      "Sản phẩm quản lý theo từng hiện vật, có mã máy và số sê-ri nhận diện đầy đủ",
    original_qty: 3,
    reversed_qty: 1,
    reversible_qty: 2,
    remaining_qty: 2,
    uom: "cái",
    can_reverse: true,
    is_serial_tracked: true,
    item_scoped: true,
    items: serials.map((serial_number, index) => ({
      item_id: `item-${index + 1}`,
      sku_id: "sku-item",
      item_code: `ITEM-${index + 1}`,
      serial_number,
      item_status: "IN_STOCK",
    })),
  },
  {
    id: "line-blocked",
    sku: "SKU-BLOCKED-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    sku_name: "Dòng có nghiệp vụ phụ thuộc chưa đủ điều kiện điều chỉnh",
    original_qty: 4,
    reversed_qty: 0,
    reversible_qty: 0,
    remaining_qty: 0,
    uom: "cái",
    can_reverse: false,
    dependency_guard: "Còn nghiệp vụ phụ thuộc cần xử lý trước",
    item_scoped: false,
    items: [],
  },
];
const movements = Array.from({ length: 8 }, (_, index) => ({
  id:
    index === 0
      ? "receipt-1"
      : index === 1
        ? "issue-1"
        : index === 2
          ? "blocked-1"
          : `receipt-${index + 1}`,
  movement_code: `${index === 1 ? "ISSUE" : index === 2 ? "BLOCKED" : "RCPT"}-${String(index + 1).padStart(3, "0")}-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789`,
  movement_type: index === 1 ? "ISSUE" : "RECEIPT",
  source_document_type: index === 1 ? "OUTBOUND" : "INBOUND",
  source_document_id: index === 1 ? "outbound-1" : `inbound-${index + 1}`,
  source_document_code: `${index === 1 ? "PX" : "PN"}-20261104-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-${index + 1}`,
  warehouse_id: "warehouse-1",
  warehouse_name: "Kho tổng Hoa Nam — Khu tiếp nhận và vận hành phía Nam",
  posted_at: "2026-11-04T08:06:00+07:00",
  posted_by_name: "Quản trị viên vận hành kho",
  version: "7",
  can_reverse: index !== 2,
  dependency_guard:
    index === 2 ? "Còn nghiệp vụ phụ thuộc cần xử lý trước" : undefined,
  lines,
}));

// Every API call stays local: GET data and POST capture exercise production services without writes.
http.getPage = async (url, config) => {
  if (url !== "/stock-movements/reversible")
    throw new Error(`Unexpected create fixture GET: ${url}`);
  const search = String(config?.params?.search ?? "").toLowerCase();
  return {
    data: movements.filter(
      (movement) =>
        !search ||
        `${movement.movement_code} ${movement.source_document_code}`
          .toLowerCase()
          .includes(search),
    ),
    meta: { total: movements.length },
  } as never;
};
http.post = async (url, body, config) => {
  if (url !== "/reversal-documents")
    throw new Error(`Unexpected create fixture POST: ${url}`);
  window.__reversalCreatePosts.push({ url, body, headers: config?.headers });
  return {
    id: "created-reversal",
    reversal_code: "RV-FIXTURE-CREATED",
    status: "DRAFT",
    total_qty: 10,
    reversed_lines: 3,
  } as never;
};

export function ReversalCreateFixture() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState("");
  return (
    <main
      style={{
        padding: 24,
        minHeight: "100vh",
        background: "var(--ops-canvas)",
        color: "var(--ops-text)",
      }}
    >
      <h1>Danh sách phiếu đảo</h1>
      <button type="button" onClick={() => setOpen(true)}>
        Mở tạo phiếu đảo
      </button>
      <output aria-label="Phiếu vừa tạo">{created}</output>
      {open ? (
        <ReversalCreateModal
          onClose={() => setOpen(false)}
          onCreated={(code) => {
            setCreated(code);
            setOpen(false);
          }}
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
      <MemoryRouter initialEntries={["/reverse?screen=REV-00"]}>
        <ReversalCreateFixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
