import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppProviders } from "./app/providers/AppProviders";
import { bootstrapAuth } from "./app/bootstrap-auth";
import { registerPwa } from "./shared/pwa/register-pwa";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
// Canonical design tokens (DEC-UI-BASELINE-01) — PHẢI đứng trước mọi CSS khác.
// Đây là entrypoint CSS global DUY NHẤT của dự án (guard: yarn ui:styles).
// Part 4 teardown: các lớp wireframe (hoa-nam-wireframe, hoa-nam-ant-overrides,
// hn-wms-mvp-exact, hn-wms-sidebar-account) đã XOÁ — shell/screen style nằm
// trong UiAppShell/sx token; chỉ giữ 3 lớp hỗ trợ màn raw-table + motion.
import "./shared/ui/tokens/css-vars.css";
import "./index.css";
import "./styles/hn-wms-page-normalize.css";
import "./styles/hn-wms-source-screen.css";
// hn-responsive.css đứng gần cuối: lớp responsive foundation thắng cascade
// của các lớp scoped phía trên mà không sửa nội dung gốc.
import "./styles/hn-responsive.css";
// hn-motion.css đứng sau cùng: chỉ khai báo transition/animation (không đụng
// layout) nên không tranh chấp lớp responsive ở trên, nhưng vẫn thắng cascade
// nếu một file cũ lỡ đặt transition riêng cho cùng selector.
import "./styles/hn-motion.css";

// auth.store dùng skipHydration để tránh rehydrate cookie chạy ngầm không
// xác định thời điểm (xem ghi chú trong auth.store.ts) — gọi 1 lần ở đây,
// trước khi render, để đảm bảo state đã sẵn sàng và không bị ghi đè bất ngờ.
// `isBootstrapped` chỉ bật sau khi rehydrate + thử refresh xong (kể cả lỗi) —
// ProtectedRoute chờ cờ này trước khi quyết định redirect /login.
void bootstrapAuth();
void registerPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
