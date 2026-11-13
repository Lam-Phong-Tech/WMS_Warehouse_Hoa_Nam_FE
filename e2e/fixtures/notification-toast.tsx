import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppProviders } from "@/app/providers/AppProviders";
import { queryClient } from "@/app/providers/query-client";
import { normalizeMeResponse } from "@/modules/auth/services/auth.service";
import { useNotificationSocket } from "@/modules/notifications/hooks/useNotificationSocket";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";
import { useAuthStore } from "@/shared/store/auth.store";
import { useNotificationStore } from "@/shared/store/notification.store";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { initializeLanguage } from "@/shared/i18n/language.store";
import { installProfileTransport } from "./profile-account-data";
import {
  emitNotification,
  hasNotificationConnection,
} from "./notification-toast-echo";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";

initializeTheme();
initializeLanguage();
const me = normalizeMeResponse(installProfileTransport());
useAuthStore
  .getState()
  .setAuth({ token: "notification-fixture-only", user: me });
const HISTORY_KEY = "notification-fixture-history";
const readHistory = (): NotificationItem[] =>
  JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");

declare global {
  interface Window {
    __notificationFixture: {
      emit(count: number): void;
      replay(): void;
      isLeader(): boolean;
    };
  }
}
window.__notificationFixture = {
  emit(count) {
    const rows = readHistory();
    const next = Array.from(
      { length: count },
      (_, i) =>
        ({
          id: `fixture-${rows.length + i}`,
          notification_id: `fixture-${rows.length + i}`,
          event_key: "fixture.notice",
          source_module: "warehouse",
          title: `Thông báo kho ${rows.length + i}`,
          body: "Chi tiết vẫn được giữ trong lịch sử.",
          severity: "info",
          subject_type: null,
          subject_id: null,
          actor_id: null,
          actor_name: null,
          payload: null,
          read_at: null,
          created_at: new Date().toISOString(),
        }) as NotificationItem,
    );
    const all = [...rows, ...next];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    queryClient.setQueryData(["notifications", "list"], all);
    next.forEach(emitNotification);
  },
  replay() {
    const first = readHistory()[0];
    if (first) emitNotification(first);
  },
  isLeader: hasNotificationConnection,
};

export function Fixture() {
  useNotificationSocket();
  const unread = useNotificationStore((s) => s.unreadCount);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data = [] } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => readHistory(),
  });
  return (
    <main
      style={{
        padding: 24,
        color: "var(--ops-heading)",
        background: "var(--ops-canvas)",
        minHeight: "100vh",
      }}
    >
      <h1>Kiểm tra thông báo</h1>
      <p data-testid="ready">Đã khởi tạo</p>
      <p>
        Chưa đọc: <output data-testid="badge">{unread}</output>
      </p>
      <p>
        Lịch sử: <output data-testid="history">{data.length}</output>
      </p>
      <p data-testid="route">{pathname}</p>
      <div style={{ marginTop: 500 }}>
        <button onClick={() => navigate("/notifications")}>Xem lịch sử</button>
        <button onClick={() => navigate("/dashboard")}>Về tổng quan</button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Fixture />
    </MemoryRouter>
  </AppProviders>,
);
