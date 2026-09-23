/** Single composition root for the existing MUI and Ant Design themes. */
import { App as AntdApp, ConfigProvider } from "antd";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import viVN from "antd/locale/vi_VN";
import enUS from "antd/locale/en_US";
import { useMemo, type ReactNode } from "react";
import { ANTD_THEMES } from "./antd-adapter";
import { MUI_THEMES } from "./mui-adapter";
import { useThemeStore } from "./theme.store";
import { useT } from "@/shared/i18n/useT";
import { useLanguageStore } from "@/shared/i18n/language.store";

export interface AppThemeProviderProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const mode = useThemeStore((state) => state.mode);
  const language = useLanguageStore((state) => state.language);
  const t = useT();
  // Translate built-in calendar, pagination, select and modal controls as well
  // as application labels. Theme tokens and provider structure are unchanged.
  const locale = useMemo(() => {
    const base = language === "en" ? enUS : viVN;
    return {
      ...base,
      Table: {
        ...base.Table,
        triggerAsc: t("shared.table.triggerAsc"),
        triggerDesc: t("shared.table.triggerDesc"),
        cancelSort: t("shared.table.cancelSort"),
      },
    };
  }, [language, t]);
  return (
    <MuiThemeProvider theme={MUI_THEMES[mode]}>
      <ConfigProvider theme={ANTD_THEMES[mode]} locale={locale}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </MuiThemeProvider>
  );
}
