import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppProviders } from "./app/providers/AppProviders";
import { bootstrapAuth } from "./app/bootstrap-auth";
import { preloadRoute } from "./app/router/route-preload";
import { MainLayout } from "./app/router/route-components";
import { warmIdb } from "./shared/cache/idb";
import { mark } from "./shared/perf/marks";
import { initWebVitals } from "./shared/perf/rum";
import { registerPwa } from "./shared/pwa/register-pwa";
import { initializeLanguage } from "./shared/i18n/language.store";
import { initializeTheme } from "./shared/ui/theme/theme.store";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
// Canonical design tokens (DEC-UI-BASELINE-01) — PHẢI đứng trước mọi CSS khác.
// Đây là entrypoint CSS global DUY NHẤT của dự án (guard: yarn ui:styles).
// Part 4 teardown: các lớp wireframe (hoa-nam-wireframe, hoa-nam-ant-overrides,
// hn-wms-mvp-exact, hn-wms-sidebar-account) đã XOÁ — shell/screen style nằm
// trong UiAppShell/sx token; chỉ giữ 3 lớp hỗ trợ màn raw-table + motion.
import "./shared/ui/tokens/css-vars.css";
// Lớp override chế độ tối — phải đứng NGAY SAU bảng sáng và TRƯỚC mọi lớp khác,
// vì nó chỉ đổi giá trị biến chứ không đổi selector nào của app.
import "./shared/ui/tokens/css-vars-dark.css";
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
mark("boot");
// RUM: đo Web Vitals THẬT trên máy người dùng (lấy mẫu; xem shared/perf/rum.ts).
// Đặt ngay sau mark("boot") để observer "largest-contentful-paint" có mặt trước
// khi trình duyệt vẽ khung hình đầu tiên — cài muộn hơn sẽ bỏ lỡ chính LCP.
initWebVitals();
void bootstrapAuth();

// TẢI SONG SONG shell + chunk của trang đích, KHÔNG chờ xác thực xong.
//
// ĐO ĐƯỢC: mỗi lần F5 ở trang cần đăng nhập là một chuỗi NỐI TIẾP 5 chặng —
// bundle chính chạy → POST /auth/refresh → ProtectedRoute mở cổng → lúc đó mới
// bắt đầu import() MainLayout (62 KB) → MainLayout render outlet mới bắt đầu
// import() trang đích (~57 KB+). Bốn chặng sau chỉ là TẢI FILE TĨNH, không phụ
// thuộc kết quả xác thực, nên chúng có thể chạy cùng lúc với vòng mạng refresh.
//
// KHÔNG đụng tới thứ tự cổng của ProtectedRoute: đây chỉ là tải trước MÃ NGUỒN.
// Trang vẫn chỉ được render sau khi có hồ sơ người dùng và cache sẵn sàng —
// bảo đảm phạm vi dữ liệu giữ nguyên. Người chưa đăng nhập tải thừa hai chunk;
// đổi lại người đã đăng nhập (tuyệt đại đa số lượt tải) bớt được hai vòng.
//
// Từ 07/09/2026 dùng `MainLayout.preload()` thay cho `import()` trần: cùng một
// đối tượng mà router render, nên khi chunk về xong thì lần render đầu KHÔNG
// treo Suspense — đó là chỗ React 19 chặn commit thêm 300 ms (xem lazy-route.tsx).
void MainLayout.preload();
if (typeof window !== "undefined") preloadRoute(window.location.pathname);
// Mở IndexedDB SONG SONG với vòng mạng refresh. Cổng nạp cache chỉ đọc sau khi
// máy chủ xác nhận danh tính, nhưng việc MỞ kết nối thì không cần chờ ai.
warmIdb();
void registerPwa();
// Đặt <html lang> và data-theme TRƯỚC lần render đầu tiên: nếu để React làm sau
// khi mount, người dùng chọn "Tối" sẽ thấy một nhịp trắng loá lúc tải trang.
initializeLanguage();
initializeTheme();

// Màn ĐẦU TIÊN sau khi tải trang không chạy hiệu ứng "chuyển trang": lúc F5
// không có trang cũ nào để chuyển đi, mà hiệu ứng thì hoãn nội dung thêm ~0,3 s.
// MainLayout gỡ thuộc tính này ngay sau khung hình đầu, nên mọi lần điều hướng
// SAU đó vẫn có hiệu ứng như cũ (xem hn-motion.css).
document.documentElement.setAttribute("data-hn-first-load", "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
