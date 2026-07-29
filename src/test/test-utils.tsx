import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Theo dõi mọi QueryClient tạo ra bởi renderWithProviders để dọn sau mỗi
// test — mặc định react-query giữ cache mỗi Query qua 1 setTimeout `gcTime`
// (5 phút, không unref) sau khi unmount observer cuối cùng. Test không đợi
// timer đó chạy nên nó tích lũy suốt cả suite (~600+ lần render), gây rò rỉ
// bộ nhớ và góp phần OOM worker vitest khi chạy full `npx vitest run`.
const createdQueryClients = new Set<QueryClient>();

function createWrapper(initialEntries?: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  createdQueryClients.add(queryClient);

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <Toaster />
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

/**
 * Render kèm sẵn QueryClient + Router cho các component cần context.
 * `initialEntries` cho phép giả lập route ban đầu (vd `['/org-units?mode=branch']`)
 * — dùng để test các màn đọc query param qua `useSearchParams` (branch-mode).
 */
export function renderWithProviders(
  ui: ReactElement,
  initialEntries?: string[],
) {
  return render(ui, { wrapper: createWrapper(initialEntries) });
}

/**
 * Cleanup QueryClient sau mỗi test — gọi từ `src/test/setup.ts` (test context)
 * thay vì `afterEach` trực tiếp ở đây (global setup context không có vitest runner).
 */
export function cleanupCreatedQueryClients() {
  if (createdQueryClients.size === 0) return;
  for (const client of createdQueryClients) {
    client.clear();
    client.unmount();
  }
  createdQueryClients.clear();
}
