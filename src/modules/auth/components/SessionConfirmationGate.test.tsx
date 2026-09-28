import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionConfirmationGate } from "./SessionConfirmationGate";
import { readWorkSessionActivity, startWorkSession, WORK_SESSION_IDLE_MS } from "@/shared/lib/session-idle";
const USER = { id: 1, name: "Warehouse operator", email: "operator@example.test", code: "HN-01" };
const CONTEXT = { role_id: "role-warehouse", role_name: "Quản lý kho", scope_type: "kho",
  org_unit_id: null, org_unit_name: null, department_id: null, department_name: null,
  warehouse_id: null, warehouse_name: "WH-HN-01", context_type: "WAREHOUSE", context_id: "WH-HN-01", scope_ref: "WH-HN-01" };
function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/"]}><Routes>
    <Route element={<SessionConfirmationGate user={USER} contexts={[CONTEXT]} />}>
      <Route path="/" element={<div>Warehouse dashboard</div>} />
    </Route>
  </Routes></MemoryRouter></QueryClientProvider>);
}
describe("TC_UI_LOGIN_09 — explicit work-session gate", () => {
  beforeEach(() => { window.sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it("does not mount protected content or record incidental clicks before Start work", () => {
    renderGate();
    expect(screen.queryByText("Warehouse dashboard")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Xác nhận phiên đăng nhập" })).toBeInTheDocument();
    fireEvent.pointerDown(document);
    expect(readWorkSessionActivity()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu làm việc" }));
    expect(screen.getByText("Warehouse dashboard")).toBeInTheDocument();
    expect(readWorkSessionActivity()).not.toBeNull();
  });
  it("preserves a confirmed session on refresh and the one-hour idle limit", () => {
    startWorkSession(); renderGate();
    expect(screen.getByText("Warehouse dashboard")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(WORK_SESSION_IDLE_MS / 2));
    fireEvent.pointerDown(document);
    act(() => vi.advanceTimersByTime(WORK_SESSION_IDLE_MS / 2));
    expect(screen.getByText("Warehouse dashboard")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(WORK_SESSION_IDLE_MS / 2));
    expect(screen.queryByText("Warehouse dashboard")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bắt đầu làm việc" })).toBeInTheDocument();
  });
  it("does not let the first click after browser sleep bypass expiry", () => {
    startWorkSession(); renderGate();
    vi.setSystemTime(Date.now() + WORK_SESSION_IDLE_MS + 1);
    fireEvent.pointerDown(document);
    expect(screen.queryByText("Warehouse dashboard")).not.toBeInTheDocument();
  });
  it("does not show a fabricated active warehouse status", () => {
    renderGate();
    expect(screen.getByText("WH-HN-01")).toBeInTheDocument();
    expect(screen.queryByText(/^đang hoạt động$/i)).not.toBeInTheDocument();
  });
});
