import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createMockAxiosError } from "@/shared/api/api-error";
import { DASHBOARD_CANONICAL } from "@/shared/constants/routes";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { cleanupTestState } from "@/test/setup";
import {
  SkuListEmptyState,
  SkuListNotice,
  SkuListReadonlyBadge,
  type SkuListFeedbackProps,
} from "./SkuListFeedback";
import {
  SkuListMutationNotice,
  type SkuListMutationNoticeValue,
} from "./SkuListMutationNotice";

function feedbackProps(
  overrides: Partial<SkuListFeedbackProps> = {},
): SkuListFeedbackProps {
  return {
    loading: false,
    refreshing: false,
    hasRows: false,
    hasFilters: false,
    offline: false,
    readonly: false,
    onRetry: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="current-route">
      {location.pathname}
      {location.search}
    </span>
  );
}

function Router({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/master-data/skus?screen=MST-01"]}>
      {children}
      <LocationProbe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useLanguageStore.setState({ language: "vi" });
});

afterEach(() => {
  cleanup();
  useLanguageStore.setState({ language: "vi" });
  cleanupTestState();
});

describe("SKU list loading and empty recovery", () => {
  it("announces initial loading without showing an empty state or actionable placeholder", () => {
    render(<SkuListEmptyState {...feedbackProps({ loading: true })} />, {
      wrapper: Router,
    });
    expect(
      screen.getByRole("status", { name: "Đang tải danh sách SKU" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Chưa có SKU")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("distinguishes an empty catalog from a filtered result without adding another create action", () => {
    const onCreate = vi.fn();
    render(<SkuListEmptyState {...feedbackProps({ onCreate })} />, {
      wrapper: Router,
    });
    expect(screen.getByRole("heading", { name: "Chưa có SKU" })).toBeVisible();
    expect(
      screen.getByText("Danh mục sản phẩm chưa có dữ liệu."),
    ).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("clears an empty filtered result only on activation and blocks reset while refreshing", async () => {
    const user = userEvent.setup();
    const props = feedbackProps({ hasFilters: true, refreshing: true });
    const { rerender } = render(<SkuListEmptyState {...props} />, {
      wrapper: Router,
    });
    expect(
      screen.getByRole("heading", { name: "Không tìm thấy SKU" }),
    ).toBeVisible();
    const reset = screen.getByRole("button", { name: "Xóa tìm kiếm" });
    expect(reset).toBeDisabled();
    await user.click(reset);
    expect(props.onReset).not.toHaveBeenCalled();
    rerender(<SkuListEmptyState {...props} refreshing={false} />);
    screen.getByRole("button", { name: "Xóa tìm kiếm" }).focus();
    await user.keyboard("{Enter}");
    expect(props.onReset).toHaveBeenCalledOnce();
    expect(props.onRetry).not.toHaveBeenCalled();
  });

  it("leaves retained rows visible instead of replacing them with loading or empty feedback", () => {
    render(
      <SkuListEmptyState
        {...feedbackProps({ hasRows: true, loading: true })}
      />,
      { wrapper: Router },
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the read-only badge only when the actual permission state requires it", () => {
    const { rerender } = render(<SkuListReadonlyBadge readonly={false} />);
    expect(screen.queryByText("Chỉ xem")).not.toBeInTheDocument();
    rerender(<SkuListReadonlyBadge readonly />);
    expect(screen.getByText("Chỉ xem")).toBeVisible();
  });
});

describe("SKU list network and API error actions", () => {
  it("offers offline retry without navigating or resetting filters", async () => {
    const user = userEvent.setup();
    const props = feedbackProps({ offline: true });
    render(<SkuListEmptyState {...props} />, { wrapper: Router });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Không có kết nối mạng",
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(props.onReset).not.toHaveBeenCalled();
  });

  it("retains an API explanation and prevents duplicate retry while a request is active", async () => {
    const user = userEvent.setup();
    const props = feedbackProps({
      error: createMockAxiosError({
        status: 400,
        data: { message: "Kho hiện tại không còn khả dụng." },
      }),
      refreshing: true,
    });
    const { rerender } = render(<SkuListEmptyState {...props} />, {
      wrapper: Router,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kho hiện tại không còn khả dụng.",
    );
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(props.onRetry).not.toHaveBeenCalled();
    rerender(<SkuListEmptyState {...props} refreshing={false} />);
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it.each([
    [403, "Bạn không có quyền truy cập"],
    [404, "Không tìm thấy trang"],
  ] as const)(
    "routes HTTP %s back to the canonical overview without retrying",
    async (status, title) => {
      const user = userEvent.setup();
      const props = feedbackProps({ error: createMockAxiosError({ status }) });
      render(<SkuListEmptyState {...props} />, { wrapper: Router });
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Thử lại" }),
      ).not.toBeInTheDocument();
      const overview = screen.getByRole("link", { name: "Quay lại Tổng quan" });
      expect(overview).toHaveAttribute("href", DASHBOARD_CANONICAL);
      await user.click(overview);
      expect(screen.getByTestId("current-route")).toHaveTextContent(
        DASHBOARD_CANONICAL,
      );
      expect(props.onRetry).not.toHaveBeenCalled();
    },
  );

  it.each([
    [500, "Hệ thống đang gặp sự cố", true],
    [503, "Hệ thống đang bảo trì", false],
  ] as const)(
    "shows HTTP %s recovery using the real error status",
    async (status, title, hasOverview) => {
      const user = userEvent.setup();
      const props = feedbackProps({ error: createMockAxiosError({ status }) });
      render(<SkuListEmptyState {...props} />, { wrapper: Router });
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      expect(
        Boolean(screen.queryByRole("link", { name: "Quay lại Tổng quan" })),
      ).toBe(hasOverview);
      expect(props.onRetry).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Thử lại" }));
      expect(props.onRetry).toHaveBeenCalledOnce();
    },
  );
});

describe("SKU list retained-data notices", () => {
  it("announces refresh politely while retaining the current list", () => {
    render(
      <SkuListNotice {...feedbackProps({ hasRows: true, refreshing: true })} />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Đang cập nhật danh sách SKU...");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps retained-data refresh and dismiss actions independent and uses the actual snapshot time", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const props = feedbackProps({
      hasRows: true,
      error: createMockAxiosError({ status: 500 }),
      updatedAt: new Date(2026, 8, 10, 16, 45).getTime(),
      onDismiss,
    });
    render(<SkuListNotice {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Dữ liệu có thể chưa mới nhất",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cập nhật lần cuối: 10/09/2026 · 16:45.",
    );
    expect(props.onRetry).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Thử cập nhật" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not claim retained data exists when the failed query has no rows", () => {
    const { rerender } = render(
      <SkuListNotice
        {...feedbackProps({ error: createMockAxiosError({ status: 500 }) })}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(<SkuListNotice {...feedbackProps({ hasRows: true })} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("SKU creation outcome actions", () => {
  function renderNotice(notice: SkuListMutationNoticeValue | null) {
    const actions = { onDismiss: vi.fn(), onCheck: vi.fn(), onRetry: vi.fn() };
    render(<SkuListMutationNotice notice={notice} {...actions} />);
    return actions;
  }

  it("never retries an unknown creation result and only checks the existing list on activation", async () => {
    const user = userEvent.setup();
    const actions = renderNotice({ kind: "unknown", code: "HN-H20" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("trước khi thử lại để tránh tạo trùng");
    expect(
      screen.queryByRole("button", { name: "Thử lại" }),
    ).not.toBeInTheDocument();
    expect(actions.onCheck).not.toHaveBeenCalled();
    expect(actions.onRetry).not.toHaveBeenCalled();
    within(alert).getByRole("button", { name: "Kiểm tra danh sách" }).focus();
    await user.keyboard("{Enter}");
    expect(actions.onCheck).toHaveBeenCalledOnce();
    expect(actions.onRetry).not.toHaveBeenCalled();
    expect(actions.onDismiss).not.toHaveBeenCalled();
  });

  it.each([
    ["success", "Đóng thông báo", "status"],
    ["duplicate", "Đóng", "alert"],
  ] as const)(
    "dismisses the %s outcome without writing or checking data",
    async (kind, label, role) => {
      const user = userEvent.setup();
      const actions = renderNotice({ kind, code: "HN-H20" });
      expect(screen.getByRole(role)).toHaveTextContent("HN-H20");
      await user.click(screen.getByRole("button", { name: label }));
      expect(actions.onDismiss).toHaveBeenCalledOnce();
      expect(actions.onRetry).not.toHaveBeenCalled();
      expect(actions.onCheck).not.toHaveBeenCalled();
    },
  );

  it("preserves the server failure explanation and delegates recovery only when clicked", async () => {
    const user = userEvent.setup();
    const actions = renderNotice({
      kind: "failed",
      code: "HN-H20",
      message: "Không thể lưu do kho đã đóng.",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Không thể lưu do kho đã đóng.",
    );
    expect(actions.onRetry).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(actions.onRetry).toHaveBeenCalledOnce();
    expect(actions.onDismiss).not.toHaveBeenCalled();
    expect(actions.onCheck).not.toHaveBeenCalled();
  });

  it("does not expose actions when there is no mutation outcome", () => {
    renderNotice(null);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("follows the shared language setting for both feedback and mutation recovery", () => {
    const actions = { onDismiss: vi.fn(), onCheck: vi.fn(), onRetry: vi.fn() };
    render(
      <>
        <SkuListReadonlyBadge readonly />
        <SkuListEmptyState {...feedbackProps({ hasFilters: true })} />
        <SkuListMutationNotice
          notice={{ kind: "unknown", code: "HN-H20" }}
          {...actions}
        />
      </>,
      { wrapper: Router },
    );
    act(() => useLanguageStore.setState({ language: "en" }));
    expect(screen.getByText("Read only")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "No SKUs found" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Check the list" }),
    ).toBeVisible();
    expect(screen.queryByText("Kiểm tra danh sách")).not.toBeInTheDocument();
  });
});
