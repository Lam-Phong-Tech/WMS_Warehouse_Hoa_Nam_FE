/**
 * COMPOSITION ROOT của theme — nơi DUY NHẤT được mount MUI ThemeProvider và
 * antd ConfigProvider (guard: provider-uniqueness test + `yarn ui:architecture`).
 *
 * Hai ngoại lệ portal được allowlist (xem
 * docs/ui/vuexy-sync/allowlists/themeprovider-exceptions.json):
 * feature/screen KHÔNG được tự wrap ThemeProvider.
 *
 * Chế độ sáng/tối: đọc `useThemeStore().mode` rồi đổi bộ theme của CẢ MUI lẫn
 * antd. Lớp CSS variable (`--wms-*`) đổi độc lập qua `<html data-theme>` nên
 * hai đường không phụ thuộc nhau — kể cả khi provider chưa mount lại kịp thì
 * màu nền/chữ vẫn đúng.
 */
import { App as AntdApp, ConfigProvider } from "antd";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import viVN from "antd/locale/vi_VN";
import type { ReactNode } from "react";
import { ANTD_THEMES } from "./antd-adapter";
import { MUI_THEMES } from "./mui-adapter";
import { useThemeStore } from "./theme.store";

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
  // `mode` đã giải quyết xong "theo hệ thống" ở store; ở đây chỉ việc chọn bộ
  // theme dựng sẵn — không dựng theme mới mỗi lần render.
  const mode = useThemeStore((state) => state.mode);
  return (
    <MuiThemeProvider theme={MUI_THEMES[mode]}>
      <ConfigProvider theme={ANTD_THEMES[mode]} locale={locale}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </MuiThemeProvider>
  );
}
