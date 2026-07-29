import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { QueryProvider } from "./app/providers/query-provider";
import { bootstrapAuth } from "./app/bootstrap-auth";
import "./index.css";

// auth.store dùng skipHydration để tránh rehydrate cookie chạy ngầm không
// xác định thời điểm (xem ghi chú trong auth.store.ts) — gọi 1 lần ở đây,
// trước khi render, để đảm bảo state đã sẵn sàng và không bị ghi đè bất ngờ.
// `isBootstrapped` chỉ bật sau khi rehydrate + thử refresh xong (kể cả lỗi) —
// ProtectedRoute chờ cờ này trước khi quyết định redirect /login.
void bootstrapAuth();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
