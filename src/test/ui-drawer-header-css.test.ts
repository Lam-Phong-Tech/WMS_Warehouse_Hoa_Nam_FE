/**
 * Chặn tái phát lỗi "nhóm tab/nút đóng trong UiDrawer header bị đẩy xuống hàng
 * dưới tiêu đề" (2026-11-10, ảnh khoanh đỏ ở drawer chi tiết phiếu xuất).
 *
 * Commit `2d47662f` đặt `.ui-drawer-header .MuiTypography-root { width: 100% }`
 * để ghim hành động bên trong title của reversal-create sang phải. Nhưng hàng
 * header dùng flex + `flexWrap: wrap`, nên width 100% chiếm trọn hàng 1 và
 * `headerEnd` (tab Chứng từ đính kèm / Sản phẩm & NFC + nút đóng) buộc xuống
 * hàng 2.
 *
 * Chuẩn sau khi sửa: title co giãn bằng `flex: 1 1 auto` (vẫn chia sẻ hàng với
 * headerEnd), còn `> span, > div` bên trong title giữ `width: 100%` để
 * reversal-create không bị hồi quy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "index.css"), "utf8");

function ruleFor(selectorFragment: string): string {
  for (const chunk of css.split("}")) {
    const brace = chunk.indexOf("{");
    if (brace === -1) continue;
    if (chunk.slice(0, brace).includes(selectorFragment)) {
      return chunk.slice(brace + 1);
    }
  }
  return "";
}

describe("UiDrawer header CSS (headerEnd cùng hàng với tiêu đề)", () => {
  it("title Typography co giãn (flex) thay vì width 100% để headerEnd cùng hàng", () => {
    const body = ruleFor(".ui-drawer-header .MuiTypography-root");
    expect(body).toMatch(/flex:\s*1 1 auto/);
    expect(body).not.toMatch(/width:\s*100%/);
    expect(body).toMatch(/min-width:\s*0/);
  });

  it("phần tử con trong title vẫn width 100% (giữ ghim phải cho reversal-create)", () => {
    const child = ruleFor(".ui-drawer-header .MuiTypography-root > span");
    expect(child).toMatch(/width:\s*100%/);
    const childDiv = ruleFor(".ui-drawer-header .MuiTypography-root > div");
    expect(childDiv).toMatch(/width:\s*100%/);
  });
});
