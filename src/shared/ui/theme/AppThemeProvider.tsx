/**
 * COMPOSITION ROOT của theme — nơi DUY NHẤT được mount MUI ThemeProvider và
 * antd ConfigProvider (guard: provider-uniqueness test + `yarn ui:architecture`).
 *
 * Hai ngoại lệ portal được allowlist (xem
 * docs/ui/vuexy-sync/allowlists/themeprovider-exceptions.json):
 * feature/screen KHÔNG được tự wrap ThemeProvider.
 */
import { App as AntdApp, ConfigProvider } from "antd";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import viVN from "antd/locale/vi_VN";
import type { ReactNode } from "react";
import { antdTheme } from "./antd-adapter";
import { muiTheme } from "./mui-adapter";

const locale = {
  ...viVN,
  Table: {
    ...viVN.Table,
    triggerAsc: "Nhấp để sắp xếp A-Z",
    triggerDesc: "Nhấp để sắp xếp Z-A",
    cancelSort: "Nhấp để bỏ sắp xếp",
  },
};

export interface AppThemeProviderProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <MuiThemeProvider theme={muiTheme}>
      <ConfigProvider theme={antdTheme} locale={locale}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </MuiThemeProvider>
  );
}
