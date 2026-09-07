import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { SkuThumbnail } from "./SkuThumbnail";

/**
 * Ảnh thu nhỏ của mã hàng.
 *
 * Ba bất biến khoá ở đây đều là thứ hỏng thật khi làm sai: ảnh sản phẩm
 * DongCheng là ảnh 4:3 nền trắng nên `cover` sẽ cắt cụt máy; URL chết phải rơi
 * về ô giữ chỗ chứ không để icon ảnh vỡ lọt vào bảng; và bảng 100 dòng không
 * được kéo về 100 ảnh cùng lúc.
 */
describe("SkuThumbnail", () => {
  it("hiện ảnh sản phẩm, giữ trọn khung và tải trễ", () => {
    renderWithProviders(
      <SkuThumbnail
        url="https://images.bigk.click/Handtool/D070101.jpg"
        name="Kìm mũi dài 8 inch"
      />,
    );

    const img = screen.getByRole("img", { name: "Kìm mũi dài 8 inch" });
    expect(img).toHaveAttribute(
      "src",
      "https://images.bigk.click/Handtool/D070101.jpg",
    );
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveStyle({ objectFit: "contain" });
  });

  it("mã chưa có ảnh -> ô giữ chỗ, không phải ảnh rỗng", () => {
    renderWithProviders(<SkuThumbnail url={null} name="Chổi than thay thế" />);

    expect(screen.getByTestId("sku-thumbnail-empty")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("URL chết -> chuyển về ô giữ chỗ thay vì icon ảnh vỡ", () => {
    renderWithProviders(
      <SkuThumbnail url="https://images.bigk.click/khong-ton-tai.jpg" />,
    );

    fireEvent.error(screen.getByRole("img"));

    expect(screen.getByTestId("sku-thumbnail-empty")).toBeInTheDocument();
  });
});
