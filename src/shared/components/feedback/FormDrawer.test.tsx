import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormDrawer } from "./FormDrawer";

describe("FormDrawer", () => {
  it("width truyền vào FormDrawer được chuyển thành prop `size` cho antd Drawer (antd v6 bỏ `width` cho placement ngang)", () => {
    render(
      <FormDrawer
        open
        title="Thêm mới"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        width={720}
      >
        <div>content</div>
      </FormDrawer>,
    );
    const panel = document.querySelector(".ant-drawer") as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.style.width).toBe("720px");
  });

  it('placement="left" vẫn áp dụng width lên chiều ngang, không bị bỏ qua', () => {
    render(
      <FormDrawer
        open
        title="Thêm mới"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        width={480}
        placement="left"
      >
        <div>content</div>
      </FormDrawer>,
    );
    const panel = document.querySelector(".ant-drawer") as HTMLElement;
    expect(panel.style.width).toBe("480px");
  });

  it("gọi afterClose sau khi drawer đóng hẳn, không gọi khi vẫn đang mở", async () => {
    const afterClose = vi.fn();
    const { rerender } = render(
      <FormDrawer
        open
        title="Thêm mới"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        afterClose={afterClose}
      >
        <div>content</div>
      </FormDrawer>,
    );
    expect(afterClose).not.toHaveBeenCalled();

    rerender(
      <FormDrawer
        open={false}
        title="Thêm mới"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        afterClose={afterClose}
      >
        <div>content</div>
      </FormDrawer>,
    );

    await waitFor(() => expect(afterClose).toHaveBeenCalledTimes(1));
  });

  it('mode="view" ẩn nút Lưu/Hủy mặc định (showActions=false)', () => {
    render(
      <FormDrawer
        open
        title="Chi tiết"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        mode="view"
      >
        <div>content</div>
      </FormDrawer>,
    );
    expect(
      screen.queryByRole("button", { name: "Lưu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Hủy" }),
    ).not.toBeInTheDocument();
  });

  it('mode="create"/"edit" hiển thị nút Lưu/Hủy và title đúng mặc định', () => {
    const { rerender } = render(
      <FormDrawer open onOk={vi.fn()} onCancel={vi.fn()} mode="create">
        <div>content</div>
      </FormDrawer>,
    );
    expect(screen.getByText("Thêm mới")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu" })).toBeInTheDocument();

    rerender(
      <FormDrawer open onOk={vi.fn()} onCancel={vi.fn()} mode="edit">
        <div>content</div>
      </FormDrawer>,
    );
    expect(screen.getByText("Chỉnh sửa")).toBeInTheDocument();
  });

  it("loading=true khoá nút Lưu và hiện trạng thái loading", () => {
    render(
      <FormDrawer
        open
        title="Thêm mới"
        onOk={vi.fn()}
        onCancel={vi.fn()}
        loading
      >
        <div>content</div>
      </FormDrawer>,
    );
    const okButton = screen.getByRole("button", { name: "Lưu" });
    expect(okButton).toHaveClass("ant-btn-loading");
  });

  it("bấm nút Lưu gọi onOk, bấm Hủy gọi onCancel", () => {
    const onOk = vi.fn();
    const onCancel = vi.fn();
    render(
      <FormDrawer open title="Thêm mới" onOk={onOk} onCancel={onCancel}>
        <div>content</div>
      </FormDrawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onOk).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("title dạng function nhận đúng mode hiện tại", () => {
    render(
      <FormDrawer
        open
        title={(mode) => `Tiêu đề: ${mode}`}
        onOk={vi.fn()}
        onCancel={vi.fn()}
        mode="edit"
      >
        <div>content</div>
      </FormDrawer>,
    );
    expect(screen.getByText("Tiêu đề: edit")).toBeInTheDocument();
  });
});
