import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { Box } from "@/shared/ui";
import { AppPageHeader } from "@/app/layouts/AppPageHeader";
import NfcPage from "@/modules/nfc/pages/NfcPage";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true });
// The production page and transport are exercised against deterministic GET fixtures.
const tag = {
  physical_code_id: "chip-1",
  hardware_uid: "04A1B2C3D4E5F6",
  code_value: "NFC-04A1B2C3D4E5F6",
  status: "ACTIVE",
  serial_number: "DCPL02-8-000001",
  sku_code: "DCPL02-8",
  sku_name: "Máy khoan pin 20V",
  assigned_at: "2026-10-31T08:30:00+07:00",
};
http.get = async () => tag as never;
http.getPage = async (url) => {
  if (url.endsWith("/events"))
    return {
      data: [
        {
          id: "event-1",
          action: "ASSIGN_ITEM_NFC",
          actor_name: "Nguyễn Văn Nam",
          reason: null,
          result: "SUCCESS",
          created_at: "2026-10-31T08:30:00+07:00",
        },
      ],
      meta: { total: 1 },
    } as never;
  if (url === "/mini-app/nfc-tags")
    return {
      data: [
        tag,
        {
          ...tag,
          physical_code_id: "chip-2",
          hardware_uid: "04A1B2C3D4E5F5",
          status: "LOST",
        },
      ],
      meta: { total: 2 },
    } as never;
  return {
    data: Array.from({ length: 6 }, (_, index) => ({
      item_id: `item-${index}`,
      serial_number: `DCPL02-8-00000${index + 1}`,
      item_status: "IN_STOCK",
      sku: { sku_code: "DCPL02-8", sku_name: "Máy khoan pin 20V" },
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
      <MemoryRouter initialEntries={["/nfc"]}>
        <Box
          component="main"
          sx={{
            p: { xs: 2, md: 3 },
            minHeight: "100vh",
            bgcolor: "background.default",
          }}
        >
          <AppPageHeader />
          <NfcPage />
        </Box>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
