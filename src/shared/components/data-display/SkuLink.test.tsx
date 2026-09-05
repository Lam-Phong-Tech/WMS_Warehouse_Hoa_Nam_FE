import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { SkuLink } from "./SkuLink";

/**
 * Mã SKU bấm được ở mọi màn nghiệp vụ -> mở App xem sản phẩm.
 *
 * Ba bất biến khoá ở đây đều là thứ đã hỏng trong thực tế nếu làm sai: link
 * điều hướng tại chỗ sẽ ném người dùng ra khỏi shell WMS, bấm trong bảng sẽ
 * kích hoạt luôn onClick của dòng, và ô SKU rỗng không được thành link chết.
 */
describe("SkuLink", () => {
  it("ưu tiên sku_id khi có, để trang PV khỏi phải tra lại mã", () => {
    renderWithProviders(
      <SkuLink id="11111111-1111-4111-8111-111111111111" code="HN-PRD-001" />,
    );

    const link = screen.getByTestId("sku-link");
    expect(link).toHaveAttribute(
      "href",
      "/pv/products/11111111-1111-4111-8111-111111111111",
    );
    // Chữ hiển thị vẫn là MÃ chứ không phải UUID.
    expect(link).toHaveTextContent("HN-PRD-001");
  });

  it("dùng mã SKU khi màn hình không có sku_id", () => {
    renderWithProviders(<SkuLink code="HN-COMP-BASE-003" />);

    expect(screen.getByTestId("sku-link")).toHaveAttribute(
      "href",
      "/pv/products/HN-COMP-BASE-003",
    );
  });

  it("mở tab mới — App PV nằm ngoài shell WMS đang thao tác dở", () => {
    renderWithProviders(<SkuLink code="HN-PRD-001" />);

    const link = screen.getByTestId("sku-link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("không kích hoạt onClick của dòng bảng bao ngoài", () => {
    const onRowClick = vi.fn();
    renderWithProviders(
      <div onClick={onRowClick} role="presentation">
        <SkuLink code="HN-PRD-001" />
      </div>,
    );

    fireEvent.click(screen.getByTestId("sku-link"));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("ô rỗng vẫn là ô rỗng, không phải link chết", () => {
    renderWithProviders(<SkuLink code="" />);

    expect(screen.queryByTestId("sku-link")).not.toBeInTheDocument();
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it("mã có ký tự đặc biệt được encode đúng trong URL", () => {
    renderWithProviders(<SkuLink code="HN/PRD 001" />);

    expect(screen.getByTestId("sku-link")).toHaveAttribute(
      "href",
      "/pv/products/HN%2FPRD%20001",
    );
  });
});
