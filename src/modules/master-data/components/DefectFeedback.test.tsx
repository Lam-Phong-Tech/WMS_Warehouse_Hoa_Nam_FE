import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiEnvelopeError, createMockAxiosError } from "@/shared/api/api-error";
import { DASHBOARD_CANONICAL } from "@/shared/constants/routes";
import { useLanguageStore } from "@/shared/i18n/language.store";
import {
  DefectEmptyState,
  DefectNotice,
  type DefectFeedbackProps,
} from "./DefectFeedback";

const route = "/master-data/defects?screen=DEF-01";
function props(
  overrides: Partial<DefectFeedbackProps> = {},
): DefectFeedbackProps {
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
function empty(value: DefectFeedbackProps) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <DefectEmptyState {...value} />
    </MemoryRouter>,
  );
}
function notice(value: DefectFeedbackProps) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <DefectNotice {...value} />
    </MemoryRouter>,
  );
}
beforeEach(() => useLanguageStore.setState({ language: "vi" }));
afterEach(cleanup);

describe("DefectEmptyState", () => {
  it("distinguishes empty data from filtered results and delegates reset", () => {
    const value = props();
    const view = empty(value);
    expect(screen.getByText("Chưa có bệnh/lỗi")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.rerender(
      <MemoryRouter>
        <DefectEmptyState {...value} hasFilters />
      </MemoryRouter>,
    );
    expect(screen.getByText("Không tìm thấy bệnh/lỗi")).toBeInTheDocument();
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
  ])("presents real HTTP %i errors distinctly", (status, state, title) => {
    empty(props({ error: createMockAxiosError({ status }) }));
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-feedback-state",
      state,
    );
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.queryByText("Chưa có bệnh/lỗi")).not.toBeInTheDocument();
    if (status === 404)
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the attempted URL for the real 401 fallback without retrying or changing auth", () => {
    const value = props({ error: createMockAxiosError({ status: 401 }) });
    empty(value);
    expect(screen.getByRole("link", { name: "Đăng nhập lại" })).toHaveAttribute(
      "href",
      `/login?redirect=${encodeURIComponent(route)}`,
    );
    expect(value.onRetry).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("recognizes envelope permission errors and retains their support request ID", () => {
    empty(
      props({
        error: new ApiEnvelopeError({
          status: "error",
          message: "Không có quyền",
          error_code: "WAREHOUSE_SCOPE_DENIED",
          request_id: "trace-defect-403",
        }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-feedback-state",
      "forbidden",
    );
    expect(
      screen.getByRole("link", { name: "Quay lại Tổng quan" }),
    ).toHaveAttribute("href", DASHBOARD_CANONICAL);
    expect(screen.getByText(/trace-defect-403/)).toBeInTheDocument();
  });

  it("does not consume the password-change-required global auth case", () => {
    empty(
      props({
        error: createMockAxiosError({
          status: 403,
          data: {
            error_code: "PASSWORD_CHANGE_REQUIRED",
            message: "Bạn cần đổi mật khẩu.",
          },
        }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-feedback-state",
      "load-error",
    );
    expect(screen.getByText("Bạn cần đổi mật khẩu.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("delegates connection checks and disables duplicate retry while refreshing", () => {
    const value = props({ offline: true });
    const view = empty(value);
    const retry = screen.getByRole("button", { name: "Kiểm tra kết nối" });
    fireEvent.click(retry);
    expect(value.onRetry).toHaveBeenCalledOnce();
    view.rerender(
      <MemoryRouter>
        <DefectEmptyState {...value} refreshing />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "Kiểm tra kết nối" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra kết nối" }));
    expect(value.onRetry).toHaveBeenCalledOnce();
  });

  it("keeps loading and retained rows under the screen's ownership", () => {
    const value = props({ offline: true });
    const view = empty({ ...value, loading: true });
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(
      <MemoryRouter>
        <DefectEmptyState {...value} hasRows />
      </MemoryRouter>,
    );
    expect(view.container).toBeEmptyDOMElement();
  });

  it("retains a real load-error explanation and delegates retry", () => {
    const value = props({
      error: new Error("Kết nối tới danh mục bị gián đoạn."),
    });
    empty(value);
    expect(
      screen.getByText("Kết nối tới danh mục bị gián đoạn."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(value.onRetry).toHaveBeenCalledOnce();
  });
});

describe("DefectNotice", () => {
  it("uses the latest confirmed data timestamp and delegates refresh/dismiss", () => {
    const value = props({
      hasRows: true,
      offline: true,
      onDismiss: vi.fn(),
      updatedAt: new Date("2026-09-22T04:30:00+07:00").getTime(),
    });
    notice(value);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đang hiển thị bản dữ liệu gần nhất đã tải thành công.",
    );
    expect(screen.getByTitle(/22\/09\/2026/)).toHaveAttribute(
      "title",
      expect.stringContaining("04:30"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Thử cập nhật" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(value.onRetry).toHaveBeenCalledOnce();
    expect(value.onDismiss).toHaveBeenCalledOnce();
  });

  it("shows progress while updating and clears the notice after recovery", () => {
    const value = props({ hasRows: true, error: new Error("Unavailable") });
    const view = notice({ ...value, refreshing: true });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đang cập nhật danh sách bệnh/lỗi...",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.rerender(
      <MemoryRouter>
        <DefectNotice {...value} error={undefined} />
      </MemoryRouter>,
    );
    expect(view.container).toBeEmptyDOMElement();
  });

  it.each([
    [401, "session-expired", "Đăng nhập lại"],
    [403, "forbidden", "Quay lại Tổng quan"],
  ])(
    "does not mislabel retained-data HTTP %i as a stale-data warning",
    (status, state, action) => {
      const value = props({
        hasRows: true,
        error: createMockAxiosError({ status }),
        onDismiss: vi.fn(),
      });
      notice(value);
      expect(screen.getByRole("alert")).toHaveAttribute(
        "data-feedback-state",
        state,
      );
      expect(
        screen.queryByText("Dữ liệu có thể chưa mới nhất"),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: action })).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(value.onRetry).not.toHaveBeenCalled();
    },
  );

  it("does not claim retained data when no rows were loaded", () => {
    const view = notice(props({ offline: true }));
    expect(view.container).toBeEmptyDOMElement();
  });
});
