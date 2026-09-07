import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { SkuLink } from "./SkuLink";

/**
 * Mã SKU hiển thị thuần, KHÔNG bấm được (trang chi tiết App PV đã gỡ 07/09/2026).
 *
 * Hai bất biến còn lại đều là thứ đã hỏng trong thực tế nếu làm sai: ô SKU rỗng
 * không được in chuỗi rỗng, và bấm vào mã không được kích hoạt hành vi nào.
 */
describe("SkuLink", () => {
  it("hiển thị MÃ chứ không phải UUID khi có cả hai", () => {
    renderWithProviders(
      <SkuLink id="11111111-1111-4111-8111-111111111111" code="HN-PRD-001" />,
    );

    expect(screen.getByTestId("sku-code")).toHaveTextContent("HN-PRD-001");
  });

  it("hiển thị mã SKU khi màn hình không có sku_id", () => {
    renderWithProviders(<SkuLink code="HN-COMP-BASE-003" />);

    expect(screen.getByTestId("sku-code")).toHaveTextContent(
      "HN-COMP-BASE-003",
    );
  });

  it("không phải link — không điều hướng đi đâu", () => {
    renderWithProviders(<SkuLink code="HN-PRD-001" />);

    const cell = screen.getByTestId("sku-code");
    expect(cell.tagName).toBe("SPAN");
    expect(cell).not.toHaveAttribute("href");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("bấm vào mã không kích hoạt hành vi riêng nào", () => {
    const onRowClick = vi.fn();
    renderWithProviders(
      <div onClick={onRowClick} role="presentation">
        <SkuLink code="HN-PRD-001" />
      </div>,
    );

    fireEvent.click(screen.getByTestId("sku-code"));
    // Ô chỉ là chữ: sự kiện nổi bọt lên dòng như mọi text khác trong ô.
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("ô rỗng vẫn là ô rỗng chuẩn của dự án", () => {
    renderWithProviders(<SkuLink code="" />);

    expect(screen.queryByTestId("sku-code")).not.toBeInTheDocument();
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it("mã có ký tự đặc biệt hiển thị nguyên văn, không bị encode", () => {
    renderWithProviders(<SkuLink code="HN/PRD 001" />);

    expect(screen.getByTestId("sku-code")).toHaveTextContent("HN/PRD 001");
  });
});
