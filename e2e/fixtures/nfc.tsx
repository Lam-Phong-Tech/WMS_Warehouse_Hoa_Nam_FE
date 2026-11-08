import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { Box } from "@/shared/ui";
import { AppPageHeader } from "@/app/layouts/AppPageHeader";
import { OutboundNfcProducts } from "@/modules/outbound/components/OutboundNfcProducts";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true });
// The outbound NFC component and transport are exercised against deterministic GET fixtures.
const tag = {
  physical_code_id: "chip-1",
  hardware_uid: "04A1B2C3D4E5F6",
  code_value: "NFC-04A1B2C3D4E5F6",
  status: "ACTIVE",
  serial_number: "DCPL02-8-000001",
  sku_code: "DCPL02-8",
  sku_name: "Máy khoan pin 20V",
  assigned_at: "2026-10-31T08:30:00+07:00",
  actor_name: "Nguyễn Văn Nam",
};
http.getPage = async (url) => {
  if (url.endsWith("/nfc-history"))
    return {
      data: [
        {
          id: "event-1",
          action: "ASSIGN_ITEM_NFC",
          hardware_uid: tag.hardware_uid,
          actor_name: "Nguyễn Văn Nam",
          reason: null,
          result: "SUCCESS",
          created_at: "2026-10-31T08:30:00+07:00",
        },
      ],
      meta: { total: 1 },
    } as never;
  return {
    data: Array.from({ length: 6 }, (_, index) => ({
      item_id: `item-${index}`,
      item_code: `DCPL02-8-00000${index + 1}`,
      serial_number: `DCPL02-8-00000${index + 1}`,
      document_id: "doc-1",
      document_no: "PX-20261103-0001",
      document_status: "POSTED",
      sku_code: "DCPL02-8",
      sku_name:
        index === 0
          ? "Máy khoan/vặn vít dùng pin không chổi than – DCJZ23-10 (EK/Z), bộ sản phẩm với mô tả chi tiết dài cần được rút gọn trong bảng danh sách"
          : "Máy khoan pin 20V",
      nfc_status: index === 0 ? "ASSIGNED" : "UNASSIGNED",
      nfc: index === 0 ? tag : null,
    })),
    meta: { total: 6, tab_totals: { ALL: 6, ASSIGNED: 1, UNASSIGNED: 5 } },
  } as never;
};
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/outbound?tab=products"]}>
        <Box
          component="main"
          sx={{
            p: { xs: 2, md: 3 },
            minHeight: "100vh",
            bgcolor: "background.default",
          }}
        >
          <AppPageHeader />
          <OutboundNfcProducts />
        </Box>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
