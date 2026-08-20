import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/shared/components/feedback/ErrorBoundary";

// Dùng antd thật: stub Result trong setup render null (nội dung nằm ở props
// title/subTitle/extra chứ không phải children) nên không assert fallback được.
vi.unmock("antd");

// WWHN-165/QA1-SEC-001: UI không được leak nội dung lỗi/stack trace. Guard
// chống hồi quy — ai thêm `{String(error)}`/`{error.stack}` vào ErrorBoundary
// sẽ bị test này chặn.
describe("ErrorBoundary no-stack-trace (WWHN-165)", () => {
  it("render thông điệp generic, không leak message/stack của lỗi", () => {
    const SECRET = "boom-secret-token-abc123";
    const Bomb = () => {
      throw new Error(SECRET);
    };
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { container } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Đã xảy ra lỗi")).toBeInTheDocument();
    expect(
      screen.getByText("Có lỗi không mong muốn. Vui lòng thử tải lại trang."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tải lại trang")).toBeInTheDocument();
    // Không một ký tự nào của lỗi gốc hay stack frame lọt ra DOM.
    expect(container.textContent).not.toContain(SECRET);
    expect(container.textContent).not.toMatch(/\bat\s+\w+.*\(/);
    expect(container.textContent).not.toContain("Error:");

    consoleSpy.mockRestore();
  });

  it("render children bình thường khi không có lỗi", () => {
    render(
      <ErrorBoundary>
        <div>Nội dung an toàn</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Nội dung an toàn")).toBeInTheDocument();
  });
});
