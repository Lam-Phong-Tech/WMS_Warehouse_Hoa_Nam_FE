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
import { useMemo, type ReactNode } from "react";
import { ANTD_THEMES } from "./antd-adapter";
import { MUI_THEMES } from "./mui-adapter";
import { useThemeStore } from "./theme.store";
import { useT } from "@/shared/i18n/useT";

export interface AppThemeProviderProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  // `mode` đã giải quyết xong "theo hệ thống" ở store; ở đây chỉ việc chọn bộ
  // theme dựng sẵn — không dựng theme mới mỗi lần render.
  const mode = useThemeStore((state) => state.mode);
  const t = useT();
  // Câu tooltip sắp xếp của antd Table đi qua i18n; phần còn lại của locale
  // giữ nguyên gói vi_VN (hành vi cũ).
  const locale = useMemo(
    () => ({
      ...viVN,
      Table: {
        ...viVN.Table,
        triggerAsc: t("shared.table.triggerAsc"),
        triggerDesc: t("shared.table.triggerDesc"),
        cancelSort: t("shared.table.cancelSort"),
      },
    }),
    [t],
  );
  return (
    <MuiThemeProvider theme={MUI_THEMES[mode]}>
      <ConfigProvider theme={ANTD_THEMES[mode]} locale={locale}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </MuiThemeProvider>
  );
}
