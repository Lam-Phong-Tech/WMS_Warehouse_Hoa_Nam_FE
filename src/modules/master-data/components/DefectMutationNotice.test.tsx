import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { DefectMutationNotice } from "./DefectMutationNotice";

beforeEach(() => {
  useLanguageStore.setState({ language: "vi" });
});

describe("DefectMutationNotice", () => {
  it("checks an uncertain result without offering retry or submitting the containing form", () => {
    const onCheck = vi.fn();
    const onRetry = vi.fn();
    const onReload = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DefectMutationNotice
          notice={{ kind: "unknown" }}
          onCheck={onCheck}
          onRetry={onRetry}
          onReload={onReload}
        />
      </form>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Yêu cầu đã được gửi nhưng chưa nhận được xác nhận.",
    );
    expect(
      screen.queryByRole("button", { name: "Thử lưu lại" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra kết quả" }));
    expect(onCheck).toHaveBeenCalledOnce();
    expect(onRetry).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reloads a stale record only on request and prevents repeated recovery while busy", () => {
    const onReload = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <DefectMutationNotice
        notice={{ kind: "conflict" }}
        onReload={onReload}
        onRetry={onRetry}
      />,
    );
    expect(onReload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tải dữ liệu mới" }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(onRetry).not.toHaveBeenCalled();
    rerender(
      <DefectMutationNotice
        notice={{ kind: "conflict" }}
        onReload={onReload}
        onRetry={onRetry}
        busy
      />,
    );
    const button = screen.getByRole("button", { name: "Tải dữ liệu mới" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("allows retry only for a known failure when its owner provides the callback", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DefectMutationNotice
        notice={{
          kind: "failed",
          message: "Kết nối đến máy chủ bị gián đoạn.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kết nối đến máy chủ bị gián đoạn.",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <DefectMutationNotice notice={{ kind: "failed" }} onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Thử lưu lại" }));
    expect(onRetry).toHaveBeenCalledOnce();
    rerender(
      <DefectMutationNotice notice={{ kind: "duplicate" }} onRetry={onRetry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Mã lỗi đã tồn tại");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("identifies the saved record, delegates dismissal, and removes a cleared notice", () => {
    const onDismiss = vi.fn();
    const { rerender, container } = render(
      <DefectMutationNotice
        notice={{
          kind: "success",
          editing: true,
          code: "DF-MOTOR-01",
          name: "Không chạy motor",
        }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đã cập nhật bệnh/lỗi",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "DF-MOTOR-01 · Không chạy motor",
    );
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    rerender(<DefectMutationNotice notice={null} onDismiss={onDismiss} />);
    expect(container).toBeEmptyDOMElement();
  });
});
