import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { lazy, Suspense } from "react";
import { installIamAuditTransport } from "./iam-audit-data";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/app/layouts/system-shell.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/styles/hn-wms-source-screen.css";
import "@/shared/ui/operations-ui.css";
import "@/styles/hn-responsive.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true, isProfileLoaded: true });
installIamAuditTransport();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const view = new URLSearchParams(location.search).get("view") ?? "users";
const IamUsersGd1Page = lazy(() =>
  import("@/modules/iam/pages/IamUsersGd1Page").then((module) => ({
    default: module.IamUsersGd1Page,
  })),
);
const IamRolePermissionScreen = lazy(() =>
  import("@/modules/iam/pages/IamRolePermissionScreen").then((module) => ({
    default: module.IamRolePermissionScreen,
  })),
);
const AuditLogsPage = lazy(() =>
  import("@/modules/audit-logs/pages/AuditLogsPage").then((module) => ({
    default: module.AuditLogsPage,
  })),
);

export function IamAuditFixture() {
  return (
    <div className="hn-system-shell">
      <style>{`
    .fixture-iam-main { min-width:0; box-sizing:border-box; padding:24px; min-height:100vh; background:var(--ops-canvas); }
    @media(max-width:767px) { .fixture-iam-main { padding:16px; } }
  `}</style>
      <main className="fixture-iam-main">
        <div className="hn-mvp-screen">
          <Suspense fallback={<p>Đang tải giao diện...</p>}>
            {view === "audit" ? (
              <AuditLogsPage />
            ) : view === "roles" ? (
              <IamRolePermissionScreen />
            ) : (
              <IamUsersGd1Page />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          view === "audit" ? "/audit-logs" : "/iam/users?screen=IAM-01",
        ]}
      >
        <IamAuditFixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
