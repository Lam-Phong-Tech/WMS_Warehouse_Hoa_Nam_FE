import type { ReactNode } from "react";
vi.mock("@/app/providers/AccountPreferencesProvider", () => ({
  AccountPreferencesProvider: ({ children }: { children: ReactNode }) =>
    children,
}));
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import type { UiAppShellProps } from "@/shared/ui/layout/UiAppShell";

const viewport = vi.hoisted(() => ({ width: 1440 }));
const capturedKeys = vi.hoisted(() => [] as string[]);

// Keep MainLayout's real route/state behavior; replace unrelated application work.
vi.mock("@/modules/auth/hooks/use-me", () => ({
  useMe: () => ({ isLoading: false }),
}));
vi.mock("@/modules/notifications/hooks/useNotificationSocket", () => ({
  useNotificationSocket: () => {},
}));
vi.mock("@/shared/realtime/use-warehouse-realtime", () => ({
  useWarehouseRealtime: () => {},
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
  KeepAliveOutlet: ({ transitionKey }: { transitionKey?: string }) => {
    capturedKeys.push(transitionKey ?? "");
    return <output data-testid="keep-alive-outlet">{transitionKey}</output>;
  },
}));
vi.mock("@/app/layouts/AppPageHeader", () => ({
  AppPageHeader: () => null,
}));
vi.mock("@/app/layouts/WarehousePausedBanner", () => ({
  WarehousePausedBanner: () => null,
}));
vi.mock("@/shared/components", () => ({ Loading: () => null }));
vi.mock("@/app/layouts/SideNav", () => ({
  SideNav: () => <nav />,
}));
vi.mock("@/app/layouts/topbar/AppTopbar", () => ({
  AppTopbar: () => null,
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
    open ? <div>{children}</div> : null,
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
    footer,
    collapsed = false,
    sidebarHidden = false,
    sidebarWidth = 340,
    sidebarCollapsedWidth = 76,
  }: UiAppShellProps) => (
    <div>
      {!sidebarHidden && (
        <aside
          style={{ width: collapsed ? sidebarCollapsedWidth : sidebarWidth }}
        >
          {sidebar}
        </aside>
      )}
      {topbar}
      {children}
      {footer}
    </div>
  ),
}));

import { MainLayout } from "./MainLayout";

// Mô phỏng đúng cách các màn deep-link (WAR-03, IN-02, MST-02…) "tiêu thụ"
// ?screen=: mở overlay rồi viết lại URL về màn nền bằng replace.
function ConsumeDeepLink() {
  const navigate = useNavigate();
  return (
    <>
      <button
        onClick={() => navigate("/warranty?screen=WAR-01", { replace: true })}
      >
        consume-deep-link
      </button>
      <button onClick={() => navigate("/master-data/skus")}>go-master-data</button>
    </>
  );
}

function setup(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ConsumeDeepLink />
      <MainLayout />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  viewport.width = 1440;
  capturedKeys.length = 0;
});

afterEach(() => {
  cleanup();
});

describe("MainLayout transitionKey", () => {
  it("stays stable when a deep-link consumer rewrites ?screen (WAR-03 → WAR-01)", () => {
    setup("/warranty?screen=WAR-03&id=case-1");
    expect(capturedKeys.at(-1)).toBe("/warranty");

    fireEvent.click(
      screen.getByRole("button", { name: "consume-deep-link" }),
    );

    // Key chỉ được đổi khi pathname đổi; lớp query `?screen=` không được
    // phép remount trang — nếu key đổi thì state (overlay vừa mở) bị hủy.
    expect(new Set(capturedKeys)).toEqual(new Set(["/warranty"]));
  });

  it("produces a pathname-scoped key for the next screen", () => {
    setup("/warranty?screen=WAR-01");
    fireEvent.click(screen.getByRole("button", { name: "go-master-data" }));
    expect(capturedKeys.at(-1)).toBe("/master-data/skus");
  });
});
