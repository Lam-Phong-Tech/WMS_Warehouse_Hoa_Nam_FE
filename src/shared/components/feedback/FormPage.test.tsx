import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormPage } from "./FormPage";

describe("FormPage", () => {
  it("render title đúng", () => {
    render(
      <FormPage title="Thêm nhân viên" onOk={vi.fn()} onCancel={vi.fn()}>
        <div>form content</div>
      </FormPage>,
    );
    expect(screen.getByText("Thêm nhân viên")).toBeInTheDocument();
    expect(screen.getByText("form content")).toBeInTheDocument();
  });

  it("gọi onOk và onCancel khi bấm nút", () => {
    const onOk = vi.fn();
    const onCancel = vi.fn();
    render(
      <FormPage title="Test" onOk={onOk} onCancel={onCancel}>
        <div>content</div>
      </FormPage>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onOk).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("loading=true hiển thị trạng thái loading trên nút Lưu", () => {
    render(
      <FormPage title="Test" onOk={vi.fn()} onCancel={vi.fn()} loading>
        <div>content</div>
      </FormPage>,
    );
    // Nút hành động chuẩn dùng MUI: trạng thái loading = class MuiButton-loading
    // và nút bị khoá (thay cho class antd "ant-btn-loading" của giao diện cũ).
    const okButton = screen.getByRole("button", { name: "Lưu" });
    expect(okButton).toHaveClass("MuiButton-loading");
    expect(okButton).toBeDisabled();
  });

  it("showOk=false ẩn nút Lưu", () => {
    render(
      <FormPage title="Test" onOk={vi.fn()} onCancel={vi.fn()} showOk={false}>
        <div>content</div>
      </FormPage>,
    );
    expect(
      screen.queryByRole("button", { name: "Lưu" }),
    ).not.toBeInTheDocument();
  });

  it("showCancel=false ẩn nút Hủy", () => {
    render(
      <FormPage
        title="Test"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        showCancel={false}
      >
        <div>content</div>
      </FormPage>,
    );
    expect(
      screen.queryByRole("button", { name: "Hủy" }),
    ).not.toBeInTheDocument();
  });

  it("hiển thị extra content dưới title", () => {
    render(
      <FormPage
        title="Test"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        extra={<div>Breadcrumb</div>}
      >
        <div>content</div>
      </FormPage>,
    );
    expect(screen.getByText("Breadcrumb")).toBeInTheDocument();
  });

  it("custom okText/cancelText hiển thị đúng", () => {
    render(
      <FormPage
        title="Test"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        okText="Lưu lại"
        cancelText="Đóng"
      >
        <div>content</div>
      </FormPage>,
    );
    expect(screen.getByRole("button", { name: "Lưu lại" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument();
  });

  it("okButtonProps.disabled khoá nút Lưu", () => {
    render(
      <FormPage
        title="Test"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        okButtonProps={{ disabled: true }}
      >
        <div>content</div>
      </FormPage>,
    );
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  });
});
