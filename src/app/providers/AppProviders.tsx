import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/app/providers/query-provider";
import { AppThemeProvider } from "@/shared/ui/theme";
import { TOAST_ICONS } from "@/shared/ui/icons";
import { ErrorBoundary } from "@/shared/components/feedback/ErrorBoundary";
import { useT } from "@/shared/i18n/useT";

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
  const t = useT();
  return (
    <QueryProvider>
      <AppThemeProvider>
        <ErrorBoundary>
          <Toaster
            position="top-right"
            duration={3000}
            richColors
            closeButton
            expand
            gap={10}
            visibleToasts={4}
            offset={{ top: 84, right: "clamp(12px, 2.2vw, 32px)" }}
            mobileOffset={{ top: 74, right: 12 }}
            containerAriaLabel={t("topbar.notificationLabel")}
            toastOptions={{ closeButtonAriaLabel: t("common.close") }}
            // Sonner tự vẽ icon severity + nút đóng bằng bộ SVG riêng —
            // ép về Flaticon Uicons cho đồng bộ toàn app.
            icons={TOAST_ICONS}
            swipeDirections={["right"]}
            className="app-toaster"
          />
          {children}
        </ErrorBoundary>
      </AppThemeProvider>
    </QueryProvider>
  );
}
