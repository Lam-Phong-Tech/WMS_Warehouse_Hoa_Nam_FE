import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import type { UiAppShellProps } from "@/shared/ui/layout/UiAppShell";
import { ROUTES } from "@/shared/constants/routes";

const viewport = vi.hoisted(() => ({ width: 1440 }));

// Keep MainLayout's real route/state behavior; replace unrelated application work.
vi.mock("@/modules/auth/hooks/use-me", () => ({
  useMe: () => ({ isLoading: false }),
}));
vi.mock("@/modules/notifications/hooks/useNotificationSocket", () => ({
  useNotificationSocket: () => {},
}));
vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (select: (state: { isProfileLoaded: boolean }) => unknown) =>
    select({ isProfileLoaded: true }),
}));
vi.mock("@/app/router/route-preload", () => ({
  preloadCommonRoutesWhenIdle: () => {},
}));
vi.mock("@/app/layouts/nav-data", () => ({ getBreadcrumbTrail: () => [] }));
vi.mock("@/shared/i18n/nav-labels", () => ({
  useNavLabel: () => (_key: string, fallback: string) => fallback,
}));
vi.mock("@/app/layouts/KeepAliveOutlet", () => ({
  KeepAliveOutlet: () => null,
}));
vi.mock("@/app/layouts/AppPageHeader", () => ({ AppPageHeader: () => null }));
vi.mock("@/app/layouts/WarehousePausedBanner", () => ({
  WarehousePausedBanner: () => null,
}));
vi.mock("@/shared/components", () => ({ Loading: () => null }));
vi.mock("@/app/layouts/SideNav", () => ({
  SideNav: ({
    onToggle,
    onExpand,
  }: {
    onToggle?: () => void;
    onExpand?: () => void;
  }) => (
    <nav>
      <button onClick={onToggle}>Toggle sidebar</button>
      <button onClick={onExpand}>Expand sidebar</button>
    </nav>
  ),
}));
vi.mock("@/app/layouts/topbar/AppTopbar", () => ({
  AppTopbar: ({
    showMenuButton,
    onOpenMenu,
  }: {
    showMenuButton: boolean;
    onOpenMenu: () => void;
  }) =>
    showMenuButton ? <button onClick={onOpenMenu}>Open menu</button> : null,
}));
vi.mock("@/shared/ui", () => ({
  AUTH_BASELINE: {},
  SPACING: { xl: 24 },
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  UiBreadcrumb: () => null,
  UiFooter: ({ children }: { children: ReactNode }) => (
    <footer>{children}</footer>
  ),
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label="Navigation">
        {children}
      </div>
    ) : null,
  useMediaQuery: (
    query:
      | string
      | ((theme: { breakpoints: { up: (key: string) => string } }) => string),
  ) => {
    const value =
      typeof query === "function"
        ? query({ breakpoints: { up: () => "(min-width: 980px)" } })
        : query;
    const min = /min-width:\s*(\d+)px/.exec(value);
    const max = /max-width:\s*(\d+)px/.exec(value);
    return (
      (!min || viewport.width >= Number(min[1])) &&
      (!max || viewport.width <= Number(max[1]))
    );
  },
  UiAppShell: ({
    sidebar,
    topbar,
    children,
    collapsed = false,
    sidebarHidden = false,
    sidebarWidth = 340,
    sidebarCollapsedWidth = 76,
  }: UiAppShellProps) => (
    <div>
      {!sidebarHidden && (
        <aside
          data-testid="shell-sidebar"
          style={{ width: collapsed ? sidebarCollapsedWidth : sidebarWidth }}
        >
          {sidebar}
        </aside>
      )}
      {topbar}
      {children}
    </div>
  ),
}));

import { MainLayout } from "./MainLayout";

const STORAGE_KEY = "hn-wms-sidebar-collapsed";
const ROUTE_SEQUENCE = [
  ROUTES.DASHBOARD,
  ROUTES.MASTER_DATA,
  ROUTES.SKU_CREATE,
  ROUTES.DEFECTS,
  ROUTES.AGENCIES,
  ROUTES.AGENCY_CREATE,
  ROUTES.PV_PRODUCT_CATALOG,
  ROUTES.CATALOG_MASTER,
  ROUTES.REPORTS_INVENTORY_FLOW,
  ROUTES.REPORTS_OUTBOUND_FLOW,
  ROUTES.REPORTS_STOCK_RECONCILE,
  ROUTES.REPORTS_TRACEABILITY,
  ROUTES.REPORTS_PENDING_EVIDENCE,
  ROUTES.DEFECTS,
];

function NavigationControls() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <output data-testid="current-route">{location.pathname}</output>
      {Array.from(new Set(ROUTE_SEQUENCE)).map((path) => (
        <button key={path} onClick={() => navigate(path)}>
          {path}
        </button>
      ))}
    </div>
  );
}

function setup(path: string = ROUTES.DASHBOARD) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavigationControls />
      <MainLayout />
    </MemoryRouter>,
  );
}

function navigateTo(path: string) {
  fireEvent.click(screen.getByRole("button", { name: path }));
  expect(screen.getByTestId("current-route")).toHaveTextContent(path);
}

beforeEach(() => {
  viewport.width = 1440;
  localStorage.removeItem(STORAGE_KEY);
});
afterEach(() => {
  cleanup();
  localStorage.removeItem(STORAGE_KEY);
});

describe("MainLayout sidebar remains stable across navigation", () => {
  it.each([980, 1280, 1440])(
    "keeps the expanded width and state on every route at %ipx",
    (width) => {
      viewport.width = width;
      setup();
      for (const path of ROUTE_SEQUENCE) {
        navigateTo(path);
        expect(screen.getByTestId("shell-sidebar")).toHaveStyle({
          width: "300px",
        });
        expect(
          screen.queryByRole("button", { name: "Open menu" }),
        ).not.toBeInTheDocument();
      }
      // Merely navigating must not rewrite the user's saved preference.
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    },
  );

  it.each([980, 1280, 1440])(
    "keeps the stored collapsed width on every route at %ipx",
    (width) => {
      viewport.width = width;
      localStorage.setItem(STORAGE_KEY, "1");
      setup();
      for (const path of ROUTE_SEQUENCE) {
        navigateTo(path);
        expect(screen.getByTestId("shell-sidebar")).toHaveStyle({
          width: "76px",
        });
      }
      expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    },
  );

  it("retains an explicit collapse/expand choice through navigation and remount", () => {
    viewport.width = 1280;
    const firstMount = setup(ROUTES.MASTER_DATA);
    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(screen.getByTestId("shell-sidebar")).toHaveStyle({ width: "76px" });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    navigateTo(ROUTES.DEFECTS);
    expect(screen.getByTestId("shell-sidebar")).toHaveStyle({ width: "76px" });
    firstMount.unmount();

    setup(ROUTES.PV_PRODUCT_CATALOG);
    expect(screen.getByTestId("shell-sidebar")).toHaveStyle({ width: "76px" });
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("0");
    navigateTo(ROUTES.REPORTS_INVENTORY_FLOW);
    expect(screen.getByTestId("shell-sidebar")).toHaveStyle({ width: "300px" });
    navigateTo(ROUTES.MASTER_DATA);
    expect(screen.getByTestId("shell-sidebar")).toHaveStyle({ width: "300px" });
  });

  it.each([390, 768, 979])(
    "uses the same drawer mode on every route at %ipx and closes it after navigation",
    (width) => {
      viewport.width = width;
      setup();
      for (const path of ROUTE_SEQUENCE) {
        navigateTo(path);
        expect(screen.queryByTestId("shell-sidebar")).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Open menu" }),
        ).toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
      expect(
        screen.getByRole("dialog", { name: "Navigation" }),
      ).toBeInTheDocument();
      navigateTo(ROUTES.MASTER_DATA);
      expect(
        screen.queryByRole("dialog", { name: "Navigation" }),
      ).not.toBeInTheDocument();
    },
  );
});
