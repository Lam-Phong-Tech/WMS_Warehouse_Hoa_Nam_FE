import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createMockAxiosError } from "@/shared/api/api-error";
import { DASHBOARD_CANONICAL } from "@/shared/constants/routes";
import { useLanguageStore } from "@/shared/i18n/language.store";
import {
  CatalogFeedback,
  CatalogNotice,
  type CatalogFeedbackProps,
} from "./CatalogFeedback";

function props(
  overrides: Partial<CatalogFeedbackProps> = {},
): CatalogFeedbackProps {
  return {
    loading: false,
    refreshing: false,
    hasRows: false,
    hasFilters: false,
    offline: false,
    onRetry: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
}

function renderFeedback(value: CatalogFeedbackProps) {
  return render(
    <MemoryRouter>
      <CatalogFeedback {...value} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useLanguageStore.setState({ language: "vi" });
});

describe("CatalogFeedback", () => {
  it("distinguishes an empty catalog from a filtered result and resets only on request", () => {
    const value = props();
    const { rerender } = renderFeedback(value);
    expect(screen.getByText("Chưa có dữ liệu danh mục")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <CatalogFeedback {...value} hasFilters />
      </MemoryRouter>,
    );
    expect(screen.getByText("Không tìm thấy danh mục")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(value.onReset).toHaveBeenCalledOnce();
    expect(value.onRetry).not.toHaveBeenCalled();
  });

  it.each([
    [401, "session-expired", "Phiên đăng nhập đã hết hạn"],
    [403, "forbidden", "Bạn không có quyền truy cập"],
    [404, "not-found", "Không tìm thấy trang"],
    [500, "server-error", "Hệ thống đang gặp sự cố"],
    [503, "maintenance", "Hệ thống đang bảo trì"],
  ])(
    "presents HTTP %i without turning it into an empty catalog",
    (status, state, title) => {
      renderFeedback(props({ error: createMockAxiosError({ status }) }));
      expect(screen.getByRole("alert")).toHaveAttribute(
        "data-feedback-state",
        state,
      );
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(
        screen.queryByText("Chưa có dữ liệu danh mục"),
      ).not.toBeInTheDocument();
    },
  );

  it("retains the API explanation, delegates retry, and blocks another click while refreshing", () => {
    const value = props({
      error: new Error("Kết nối tới danh mục bị gián đoạn."),
    });
    const { rerender } = renderFeedback(value);
    expect(
      screen.getByText("Kết nối tới danh mục bị gián đoạn."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(value.onRetry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Quay lại Tổng quan" }),
    ).toHaveAttribute("href", DASHBOARD_CANONICAL);
    rerender(
      <MemoryRouter>
        <CatalogFeedback {...value} refreshing />
      </MemoryRouter>,
    );
    const retry = screen.getByRole("button", { name: "Thử lại" });
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(value.onRetry).toHaveBeenCalledOnce();
  });

  it("uses offline feedback while leaving loading and retained rows to their owning components", () => {
    const value = props({ offline: true });
    const { rerender, container } = renderFeedback(value);
    expect(screen.getByText("Không có kết nối mạng")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <CatalogFeedback {...value} loading />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <MemoryRouter>
        <CatalogFeedback {...value} hasRows />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CatalogNotice", () => {
  it("shows the real retained-data timestamp with working refresh and dismiss callbacks", () => {
    const value = props({
      hasRows: true,
      offline: true,
      updatedAt: new Date("2026-09-22T04:30:00+07:00").getTime(),
    });
    const onDismiss = vi.fn();
    render(<CatalogNotice {...value} onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toHaveTextContent("22/09/2026 · 04:30");
    fireEvent.click(screen.getByRole("button", { name: "Thử cập nhật" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(value.onRetry).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("replaces stale feedback with progress during refresh and clears it after recovery", () => {
    const value = props({ hasRows: true, error: new Error("Unavailable") });
    const { rerender, container } = render(
      <CatalogNotice {...value} refreshing />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đang cập nhật danh mục sản phẩm...",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<CatalogNotice {...value} error={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    [
      401,
      "session-expired",
      "Phiên đăng nhập đã hết hạn",
      "Vui lòng đăng nhập lại để tiếp tục.",
    ],
    [
      403,
      "forbidden",
      "Bạn không có quyền truy cập",
      "Tài khoản hiện tại không được phép xem danh mục sản phẩm.",
    ],
  ])(
    "preserves HTTP %i feedback after rows were loaded and delegates recovery to the existing callback",
    (status, state, title, description) => {
      const value = props({
        hasRows: true,
        updatedAt: new Date("2026-09-22T04:30:00+07:00").getTime(),
      });
      const { rerender } = render(<CatalogNotice {...value} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      rerender(
        <CatalogNotice {...value} error={createMockAxiosError({ status })} />,
      );
      const notice = screen.getByRole("alert");
      expect(notice).toHaveAttribute("data-feedback-state", state);
      expect(notice).toHaveTextContent(title);
      expect(notice).toHaveTextContent(description);
      expect(notice).not.toHaveTextContent("Dữ liệu có thể chưa mới nhất");
      expect(notice).not.toHaveTextContent("Cập nhật lần cuối:");
      fireEvent.click(screen.getByRole("button", { name: "Thử cập nhật" }));
      expect(value.onRetry).toHaveBeenCalledOnce();
      expect(value.onReset).not.toHaveBeenCalled();
      rerender(
        <CatalogNotice
          {...value}
          refreshing
          error={createMockAxiosError({ status })}
        />,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Đang cập nhật danh mục sản phẩm...",
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      rerender(<CatalogNotice {...value} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("does not present stale data when no confirmed rows exist", () => {
    const { container } = render(
      <CatalogNotice {...props({ offline: true })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
