import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionConfirmationGate } from "@/modules/auth/components/SessionConfirmationGate";
import { WORK_SESSION_IDLE_MS } from "@/shared/lib/session-idle";

const USER = { id: 1, name: "Warehouse operator", email: "operator@example.com", code: "HN-01" };
const CONTEXT = {
  role_id: "role-warehouse", role_name: "Quản lý kho", scope_type: "kho",
  org_unit_id: null, org_unit_name: null, department_id: null, department_name: null,
  warehouse_id: null, warehouse_name: "WH-HN-01", context_type: "WAREHOUSE",
  context_id: "WH-HN-01", scope_ref: "WH-HN-01",
};
describe("SessionConfirmationGate", () => {
  beforeEach(() => { window.sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it("cho phép vào ứng dụng ngay sau đăng nhập và chỉ khóa sau một giờ không thao tác", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<SessionConfirmationGate user={USER} contexts={[CONTEXT]} />}>
              <Route path="/" element={<div>Warehouse dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Warehouse dashboard")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(WORK_SESSION_IDLE_MS / 2));
    fireEvent.pointerDown(document);
    act(() => vi.advanceTimersByTime(WORK_SESSION_IDLE_MS / 2));
    expect(screen.getByText("Warehouse dashboard")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(WORK_SESSION_IDLE_MS / 2));
    expect(screen.getByRole("heading", { name: /xác nhận phiên làm việc/i })).toBeInTheDocument();
    client.clear();
  });
});
