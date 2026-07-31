import { App as AntdApp, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/app/providers/query-provider";
import { themeConfig } from "@/app/theme";
import { ErrorBoundary } from "@/shared/components/feedback/ErrorBoundary";

const locale = {
  ...viVN,
  Table: {
    ...viVN.Table,
    triggerAsc: "Nhấp để sắp xếp A-Z",
    triggerDesc: "Nhấp để sắp xếp Z-A",
    cancelSort: "Nhấp để bỏ sắp xếp",
  },
};

export interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Single composition root for app-level providers.
 *
 * Keep shared runtime concerns here so production, tests, and future shell
 * entry points can use the same Ant Design theme/locale, QueryClient, toast,
 * and error boundary setup.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ConfigProvider theme={themeConfig} locale={locale}>
        <AntdApp>
          <ErrorBoundary>
            <Toaster
              position="top-right"
              richColors
              closeButton
              expand
              gap={12}
              visibleToasts={5}
              swipeDirections={["bottom"]}
              className="app-toaster"
            />
            {children}
          </ErrorBoundary>
        </AntdApp>
      </ConfigProvider>
    </QueryProvider>
  );
}
