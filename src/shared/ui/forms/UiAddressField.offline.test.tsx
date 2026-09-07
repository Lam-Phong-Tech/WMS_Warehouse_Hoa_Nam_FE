/**
 * Nhánh HỎNG của danh mục: chunk phường/xã không nạp được (deploy mới xoá
 * file cũ, mạng rớt đúng lúc trình duyệt kéo chunk lười).
 *
 * Yêu cầu: ô "Tỉnh/Thành" VẪN chạy bình thường (nó nằm trong bundle chính),
 * ô "Địa chỉ cụ thể" vẫn gõ được, và có cảnh báo + nút tải lại — chứ không
 * phải danh sách xã trống trơn im lặng như bản gọi API cũ.
 *
 * Phải tách file: `vi.mock` được hoisted nên áp cho cả tệp test.
 */
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { __resetVnAddressCache } from "@/shared/lib/vn-address/vn-address.api";
import { UiAddressField } from "./UiAddressField";

const chunk = vi.hoisted(() => ({ attempts: 0 }));

vi.mock("@/shared/lib/vn-address/data/vn-wards.json", () => {
  chunk.attempts += 1;
  throw new Error("Failed to fetch dynamically imported module");
});

function Host() {
  const [value, setValue] = useState(
    JSON.stringify({
      detail: "",
      ward_code: null,
      ward: "",
      province_code: 1,
      province: "Thành phố Hà Nội",
    }),
  );
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiAddressField data-testid="addr" value={value} onChange={setValue} />
      <output data-testid="raw">{value}</output>
    </MuiThemeProvider>
  );
}

describe("UiAddressField — chunk phường/xã hỏng", () => {
  beforeEach(() => {
    __resetVnAddressCache();
    chunk.attempts = 0;
  });
  afterEach(() => {
    __resetVnAddressCache();
  });

  it("cảnh báo + nút tải lại, tỉnh/thành và địa chỉ cụ thể vẫn dùng được", async () => {
    const user = userEvent.setup();
    render(<Host />);

    expect(await screen.findByRole("alert")).toBeTruthy();

    // Ô tỉnh/thành nằm trong bundle chính → không bị kéo theo.
    expect(
      (screen.getByTestId("addr-province") as HTMLInputElement).value,
    ).toBe("Thành phố Hà Nội");

    await user.type(screen.getByTestId("addr-detail"), "Ngõ 5");
    expect(
      JSON.parse(screen.getByTestId("raw").textContent ?? "{}").detail,
    ).toBe("Ngõ 5");

    const before = chunk.attempts;
    await user.click(screen.getByRole("button", { name: /Tải lại/ }));
    await waitFor(() => expect(chunk.attempts).toBeGreaterThan(before));
  });
});
