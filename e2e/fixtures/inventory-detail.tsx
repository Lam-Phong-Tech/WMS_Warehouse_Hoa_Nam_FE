import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { BalanceDetailModal } from "@/modules/inventory/components/BalanceDetailModal";
import type { InventoryBalanceRow } from "@/modules/inventory/services/inventoryService";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true });

const balance: InventoryBalanceRow = {
  id: "bal-long",
  sku: "HN-PV-BASE-002-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
  name: "Máy bơm nước PV với tên sản phẩm rất dài, phụ kiện và thông tin nhận diện để kiểm tra bố cục trong thanh chi tiết",
  type: "PRODUCT",
  warehouse: "Kho tổng Hoa Nam — Khu vận hành và tiếp nhận hàng hóa phía Nam",
  stockStatus: "AVAILABLE",
  uom: "cái",
  available: 27,
  onHand: 29,
  serialQty: 20,
  boxQty: 2,
  containerCode: "BOX-LONG-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
  trayCode: "TRAY-LONG-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
  location:
    "Kệ C3-01, khu hàng linh kiện và sản phẩm chờ bàn giao cho bộ phận vận hành",
  reconcile: "MISMATCH",
  reconcileNote: "BALANCE_NOT_EQUAL_SIGNED_LEDGER_SUM",
  ledgerTotal: 30,
  variance: -1,
  reservedQty: 0,
  incidentId: null,
  incidentStatus: null,
  updatedAt: "2026-11-04T10:06:00+07:00",
  dataAsOf: "2026-11-04T10:06:00+07:00",
  lastMovementId: "12345678-1234-4321-8765-123456789012",
};

const longSerial =
  "SERIAL-20261104-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const longPhysicalCode =
  "QR-PHYSICAL-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const longNfc = "NFC-04A2B3C4D5E6F701-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";

// Exercise production hooks and normalizers with deterministic read-only API data.
http.get = async (url) => {
  if (url.endsWith("/subledger"))
    return {
      balance_id: "bal-long",
      product_id: "product-1",
      warehouse_id: "warehouse-1",
      items: Array.from({ length: 20 }, (_, index) => ({
        id: `item-${index + 1}`,
        item_code: `SP-${String(index + 1).padStart(3, "0")}-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789`,
        serial_number: index === 0 ? longSerial : `SERIAL-${index + 1}`,
        status: "IN_STOCK",
        condition: index === 0 ? "DEFECTIVE" : "NORMAL",
        physical_code: index === 0 ? longPhysicalCode : `QR-${index + 1}`,
        rfid_code:
          index === 0 ? "RFID-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789" : null,
        nfc_code: index === 0 ? longNfc : null,
        nfc_hardware_uid: index === 0 ? "04A2B3C4D5E6F701" : null,
        location_hint: "Kệ C3-01 — khu vực sản phẩm chờ xử lý và bàn giao",
        received_at: "2026-11-04T08:06:00+07:00",
      })),
      containers: [
        {
          id: "box-1",
          container_code: "BOX-001-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
          container_type: "BOX",
          quantity: 10,
          container_status: "STORED",
          zone_code: "ZONE-01",
          location_hint: "Kệ C3-01 — kho tổng Hoa Nam",
        },
        {
          id: "box-2",
          container_code: "BOX-002",
          container_type: "BOX",
          quantity: 10,
          container_status: "STORED",
          zone_code: "ZONE-02",
          location_hint: "Kệ C3-02",
        },
      ],
      item_count: 20,
      container_count: 2,
    } as never;
  throw new Error(`Unexpected inventory fixture GET: ${url}`);
};
http.getPage = async (url) => {
  if (url === "/stock-movements")
    return {
      data: [
        {
          id: "movement-1",
          movement_no: "MV-20261104-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
          occurred_at: "2026-11-04T08:06:00+07:00",
          movement_type: "RECEIPT",
          qty_delta: 29,
          document_code: "PN-20261104-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
          document_type: "INBOUND",
          sku_code: balance.sku,
        },
      ],
      meta: { total: 1, current_page: 1, last_page: 1 },
    } as never;
  throw new Error(`Unexpected inventory fixture page GET: ${url}`);
};

export function InventoryDetailFixture() {
  const [open, setOpen] = useState(false);
  const [traced, setTraced] = useState("");
  return (
    <main
      style={{
        padding: 24,
        minHeight: "100vh",
        background: "var(--ops-bg)",
        color: "var(--ops-text)",
      }}
    >
      <h1>Tra cứu tồn &amp; đối soát</h1>
      <button type="button" onClick={() => setOpen(true)}>
        Mở chi tiết tồn kho
      </button>
      <output aria-label="Biến động đã chọn">{traced}</output>
      {open ? (
        <BalanceDetailModal
          balance={balance}
          onClose={() => setOpen(false)}
          onTraceMovement={setTraced}
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
      <MemoryRouter>
        <InventoryDetailFixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
