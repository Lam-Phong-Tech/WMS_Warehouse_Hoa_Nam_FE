import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  IoHistoryFeedback,
  IoHistorySkeleton,
  IoHistoryTableState,
} from "./IoHistoryFeedback";

describe("RPT-08 feedback recovery actions", () => {
  it("announces a load failure and prevents duplicate retries while busy", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <IoHistoryFeedback state="load-error" onRetry={onRetry} busy />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveAttribute("aria-busy", "true");
    await user.click(within(alert).getByRole("button", { name: "Thử lại" }));
    expect(onRetry).not.toHaveBeenCalled();
    rerender(<IoHistoryFeedback state="load-error" onRetry={onRetry} />);
    const retry = screen.getByRole("button", { name: "Thử lại" });
    expect(retry).toBeEnabled();
    retry.focus();
    await user.keyboard("{Enter}");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps stale data recovery and dismissal independent", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(
      <IoHistoryFeedback
        state="stale"
        updatedAt="10/09/2026 16:45"
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByText(/Cập nhật lần cuối: 10\/09\/2026 16:45/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Thử cập nhật" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("acknowledges an uncertain export without offering automatic retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(
      <IoHistoryFeedback
        state="export-unknown"
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText(/kiểm tra các tệp đã tải/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Thử lại" }),
    ).not.toBeInTheDocument();
    const acknowledge = screen.getByRole("button", { name: "Đóng" });
    expect(acknowledge).toHaveTextContent("Đã hiểu");
    await user.click(acknowledge);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it.each(["forbidden", "not-found"] as const)(
    "%s delegates home recovery without retrying",
    async (state) => {
      const user = userEvent.setup();
      const onHome = vi.fn();
      const onRetry = vi.fn();
      render(
        <IoHistoryFeedback state={state} onHome={onHome} onRetry={onRetry} />,
      );
      expect(
        screen.queryByRole("button", { name: "Thử lại" }),
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: "Quay lại Tổng quan" }),
      );
      expect(onHome).toHaveBeenCalledOnce();
      expect(onRetry).not.toHaveBeenCalled();
    },
  );

  it("delegates sign-in to the auth owner and disables duplicate sign-ins", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const { rerender } = render(
      <IoHistoryFeedback state="session-expired" onLogin={onLogin} busy />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Phiên đăng nhập đã hết hạn",
    );
    await user.click(screen.getByRole("button", { name: "Đăng nhập lại" }));
    expect(onLogin).not.toHaveBeenCalled();
    rerender(<IoHistoryFeedback state="session-expired" onLogin={onLogin} />);
    await user.click(screen.getByRole("button", { name: "Đăng nhập lại" }));
    expect(onLogin).toHaveBeenCalledOnce();
  });

  it.each([
    ["empty", "Điều chỉnh khoảng thời gian"],
    ["no-results", "Xóa tìm kiếm"],
  ] as const)("%s provides relevant recovery", async (state, label) => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const { rerender } = render(
      <IoHistoryTableState state={state} onReset={onReset} busy />,
    );
    expect(screen.getByRole("status")).toBeVisible();
    await user.click(screen.getByRole("button", { name: label }));
    expect(onReset).not.toHaveBeenCalled();
    rerender(<IoHistoryTableState state={state} onReset={onReset} />);
    await user.click(screen.getByRole("button", { name: label }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("RPT-08 loading announcements", () => {
  it("exposes one named busy report status without placeholder controls", () => {
    render(<IoHistorySkeleton />);
    expect(
      screen.getByRole("status", { name: "Đang tải báo cáo" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("names table loading independently from report loading", () => {
    render(<IoHistoryTableState state="loading" />);
    expect(
      screen.getByRole("status", { name: "Đang tải lịch sử nhập - xuất kho" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByText("Không tìm thấy kết quả"),
    ).not.toBeInTheDocument();
  });
  it("announces refreshing politely", () => {
    render(<IoHistoryFeedback state="refreshing" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Đang cập nhật dữ liệu...");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
