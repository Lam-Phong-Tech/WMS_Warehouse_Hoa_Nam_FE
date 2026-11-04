import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { AccountPreferencesProvider } from "@/app/providers/AccountPreferencesProvider";
import { normalizeMeResponse } from "@/modules/auth/services/auth.service";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { initializeLanguage } from "@/shared/i18n/language.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { ActionButton } from "@/shared/components/actions";
import { UiStatusBadge } from "@/shared/ui";
import { installProfileTransport } from "./profile-account-data";
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
initializeLanguage();
const me = normalizeMeResponse(installProfileTransport());
useAuthStore
  .getState()
  .setAuth({ token: "profile-fixture-access-token", user: me });
useAuthStore.getState().setProfile(me);
const ProfilePage = lazy(() =>
  import("@/modules/auth/pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
declare global {
  interface Window {
    __profileGlobalSnapshot: () => {
      hasToken: boolean;
      authenticated: boolean;
      displayName: string | undefined;
      date: string;
      datetime: string;
    };
  }
}
window.__profileGlobalSnapshot = () => {
  const state = useAuthStore.getState();
  return {
    hasToken: Boolean(state.token),
    authenticated: state.isAuthenticated,
    displayName: state.profile?.display_name,
    date: formatDate("2026-11-03T03:15:00Z"),
    datetime: formatDateTime("2026-11-03T03:15:00Z"),
  };
};

export function ProfileAccountFixture() {
  return (
    <div className="hn-system-shell">
      <style>{`
  .fixture-profile-main { min-width:0; box-sizing:border-box; padding:24px; min-height:100vh; background:var(--ops-canvas); }
  .fixture-profile-probe { position:fixed; left:-10000px; top:0; pointer-events:none; }
  @media(max-width:767px) { .fixture-profile-main { padding:16px; } }
 `}</style>
      <main className="fixture-profile-main">
        <div className="hn-mvp-screen">
          <Suspense fallback={<p>Đang tải hồ sơ cá nhân...</p>}>
            <ProfilePage />
          </Suspense>
        </div>
        <div
          className="fixture-profile-probe"
          aria-hidden="true"
          data-testid="profile-global-probe"
        >
          <ActionButton kind="save">Nút dùng chung</ActionButton>
          <UiStatusBadge tone="error" label="Lỗi dùng chung" />
          <table>
            <thead>
              <tr>
                <th>Cột dùng chung</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Ngày dùng chung</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <MemoryRouter initialEntries={["/profile"]}>
    <AppProviders>
      <Routes>
        <Route
          path="/profile"
          element={
            <AccountPreferencesProvider>
              <ProfileAccountFixture />
            </AccountPreferencesProvider>
          }
        />
        <Route path="/login" element={<h1>Đăng nhập lại</h1>} />
        <Route path="*" element={<h1>Trang đích mẫu</h1>} />
      </Routes>
    </AppProviders>
  </MemoryRouter>,
);
