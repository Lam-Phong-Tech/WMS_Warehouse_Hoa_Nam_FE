import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/app/providers/query-provider";
import { AppThemeProvider } from "@/shared/ui/theme";
import { TOAST_ICONS } from "@/shared/ui/icons";
import { ErrorBoundary } from "@/shared/components/feedback/ErrorBoundary";

export interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Single composition root for app-level providers.
 *
 * Theme (MUI ThemeProvider + antd ConfigProvider/App + locale) nằm trọn trong
 * `AppThemeProvider` (@/shared/ui/theme) — nơi DUY NHẤT được mount theme
 * providers. Production, tests và mọi shell entry point dùng chung setup này.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <AppThemeProvider>
        <ErrorBoundary>
          <Toaster
            position="top-right"
            richColors
            closeButton
            expand
            gap={12}
            visibleToasts={5}
            // Sonner tự vẽ icon severity + nút đóng bằng bộ SVG riêng —
            // ép về Flaticon Uicons cho đồng bộ toàn app.
            icons={TOAST_ICONS}
            swipeDirections={["bottom"]}
            className="app-toaster"
          />
          {children}
        </ErrorBoundary>
      </AppThemeProvider>
    </QueryProvider>
  );
}
