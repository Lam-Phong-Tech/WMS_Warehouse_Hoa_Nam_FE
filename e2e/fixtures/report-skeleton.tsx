import { createRef } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { api } from "@/shared/api/axios";
import { CoordinatedLoadingBoundary } from "@/shared/ui/loading/CoordinatedLoadingBoundary";
import { ContentLoadingSkeleton } from "@/shared/ui/loading/ContentLoadingSkeleton";
import { LoadingSkeleton } from "@/shared/ui/loading/LoadingSkeleton";
import { measureSkeletonGeometry } from "@/shared/ui/loading/content-skeleton-geometry";
import { ReportFilterCombobox } from "@/modules/reports/components/ReportFilterCombobox";
import Inventory from "@/modules/reports/pages/InventoryFlowReportPage";
import Outbound from "@/modules/reports/pages/OutboundFlowReportPage";
import Stock from "@/modules/reports/pages/StockReconcileReportPage";
import Trace from "@/modules/reports/pages/TraceabilityReportPage";
import Quality from "@/modules/reports/pages/ImportQualityReportPage";
import Packing from "@/modules/reports/pages/PackingLabelReportPage";
import Warranty from "@/modules/reports/pages/WarrantyReportPage";
import Recipient from "@/modules/reports/pages/RecipientReportPage";
import History from "@/modules/reports/pages/PendingEvidenceReportPage";
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
useAuthStore.setState({
  isSuperAdmin: true,
  isAuthenticated: true,
  isProfileLoaded: true,
  permissionCodes: ["report.view", "report.export"],
  user: { id: 1, name: "Skeleton audit", email: "audit@example.test" } as never,
});
// Hold real report queries pending without contacting a backend or using data.
api.defaults.adapter = () => new Promise(() => {});
Object.assign(window, { measureSkeletonGeometry });

const screens = {
  inventory: Inventory,
  outbound: Outbound,
  stock: Stock,
  trace: Trace,
  quality: Quality,
  packing: Packing,
  warranty: Warranty,
  recipient: Recipient,
  history: History,
  "history-legacy": History,
};
const name = new URLSearchParams(location.search).get("report") ?? "trace";
const Screen = screens[name as keyof typeof screens] ?? Trace;
const contentRef = createRef<HTMLDivElement>();
const fallback = <LoadingSkeleton layout="report" />;

function VisibilityFixture() {
  return (
    <div style={{ position: "relative" }}>
      <div
        ref={contentRef}
        data-testid="visibility-source"
        style={{ visibility: "hidden", height: 600 }}
      >
        <div style={{ display: "grid", gap: 12, width: 300 }}>
          {[1, 2, 3, 4].map((key) => (
            <input
              key={key}
              aria-label={`Field ${key}`}
              style={{ height: 38 }}
            />
          ))}
          <ReportFilterCombobox
            id="visibility-dropdown"
            value="all"
            onChange={() => {}}
            options={[
              { value: "all", label: "All" },
              { value: "one", label: "One" },
              { value: "two", label: "Two" },
            ]}
            icon="warehouse"
            searchPlaceholder="Search"
            ariaLabel="Dropdown"
          />
          <details data-testid="advanced">
            <summary>Advanced filters</summary>
            <div style={{ display: "grid", gap: 12 }}>
              <input aria-label="Advanced field" style={{ height: 38 }} />
              <input
                aria-label="Second advanced field"
                style={{ height: 38 }}
              />
            </div>
          </details>
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0 }}>
        <ContentLoadingSkeleton
          contentRef={contentRef}
          label="Loading"
          fallback={fallback}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[
          name === "history"
            ? "/reports/pending-evidence?screen=RPT-08"
            : "/reports/" + name,
        ]}
      >
        <div style={{ marginLeft: "min(20vw, 370px)", padding: 24 }}>
          {name === "visibility" ? (
            <VisibilityFixture />
          ) : (
            <CoordinatedLoadingBoundary fallback={fallback}>
              <Screen />
            </CoordinatedLoadingBoundary>
          )}
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
