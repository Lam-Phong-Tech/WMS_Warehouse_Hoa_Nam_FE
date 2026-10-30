import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { UiTextField } from "@/shared/ui/components/UiTextField";
import { UiAutocomplete } from "@/shared/ui/forms/UiAutocomplete";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/app/layouts/system-shell.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/styles/hn-wms-source-screen.css";
import "@/shared/ui/operations-ui.css";
import "@/styles/hn-responsive.css";
import "@/styles/hn-motion.css";
import "@/shared/ui/sku-aligned-settings.css";
import "@/modules/master-data/pages/catalog-master.css";
import "@/modules/master-data/pages/sku-list.css";
import "@/modules/master-data/pages/defect-list.css";
import "@/modules/reports/inventory-flow/inventory-flow-report.css";
import "@/modules/reports/inventory-flow/inbound-flow-report.css";
import "@/modules/reports/inventory-flow/outbound-flow-report.css";
import "@/modules/inbound/pages/inbound-list.css";
import "@/modules/outbound/pages/outbound-list.css";
import "@/modules/reverse/pages/reversal-list.css";
import "@/modules/inventory/components/inventory-dialog.css";
import "@/modules/iam/pages/iam-users.css";
import "@/modules/putaway/pages/putaway-queue.css";
import "@/modules/warranty/pages/warranty-component-issues.css";

const params = new URLSearchParams(location.search);
useThemeStore
  .getState()
  .setPreference(params.get("theme") === "dark" ? "dark" : "light");

export function Fields() {
  const [show, setShow] = useState(false);
  const [province, setProvince] = useState<string | number | null>(null);
  return (
    <main
      className={`hn-system-shell ${params.get("skin") ?? "hn-settings-screen"}`}
      style={{ padding: 24 }}
    >
      <div
        style={{
          display: "grid",
          gap: 24,
          maxWidth: 800,
          padding: 16,
          background: "var(--wms-bg-surface)",
        }}
      >
        <button data-testid="before">Bắt đầu</button>
        <UiTextField
          data-testid="filled"
          label="Tên kho"
          required
          defaultValue="Kho tổng Hoa Nam"
          fullWidth
        />
        <UiTextField
          data-testid="long"
          label="Địa chỉ cụ thể của kho tổng Hoa Nam"
          defaultValue="Hà Nội"
          fullWidth
        />
        <UiTextField data-testid="empty" label="Người liên hệ" fullWidth />
        <UiTextField
          data-testid="select"
          select
          label="Trạng thái"
          defaultValue="active"
          fullWidth
        >
          <MenuItem value="active">Đang hoạt động</MenuItem>
          <MenuItem value="inactive">Ngừng hoạt động</MenuItem>
        </UiTextField>
        <div data-testid="autocomplete">
          <UiAutocomplete
            label="Tỉnh / Thành phố"
            options={[{ value: "hn", label: "Hà Nội" }]}
            value={province}
            onChange={setProvince}
          />
        </div>
        <UiTextField
          data-testid="multiline"
          label="Ghi chú"
          multiline
          minRows={2}
          defaultValue="Thông tin kho"
          fullWidth
        />
        <UiTextField
          data-testid="error"
          label="Số điện thoại"
          error
          helperText="Số điện thoại không hợp lệ"
          defaultValue="abc"
          fullWidth
        />
        <UiTextField
          data-testid="disabled"
          label="Mã kho"
          disabled
          defaultValue="KHO-TONG-HN"
          fullWidth
        />
        <UiTextField
          data-testid="password"
          label="Mật khẩu"
          type={show ? "text" : "password"}
          defaultValue="secret"
          fullWidth
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Hiện mật khẩu"
                    onClick={() => setShow(!show)}
                  >
                    Hiện
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <input aria-label="Ô nhập gốc" />
        <button data-testid="after">Kết thúc</button>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <Fields />
  </AppThemeProvider>,
);
