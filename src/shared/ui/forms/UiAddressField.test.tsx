/**
 * Test UiAddressField trên DỮ LIỆU THẬT trong repo (không mock danh mục):
 * ô tỉnh/thành có sẵn ngay lần render đầu, chọn tỉnh → mở xã, đổi tỉnh reset
 * xã, gõ địa chỉ cụ thể → onChange nhận JSON; chuỗi cũ hiện ở ô địa chỉ cụ thể.
 *
 * `fetch` bị chặn cứng: chạm mạng là fail — đây là bảo chứng cho việc ô địa
 * chỉ không còn phụ thuộc dịch vụ ngoài. Nhánh danh mục hỏng nằm ở
 * UiAddressField.offline.test.tsx (phải mock chunk nên tách file riêng).
 */
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { __resetVnAddressCache } from "@/shared/lib/vn-address/vn-address.api";
import { UiAddressField } from "./UiAddressField";

const HA_NOI = { code: 1, name: "Thành phố Hà Nội" };
const DA_NANG = { code: 48, name: "Thành phố Đà Nẵng" };
const BA_DINH = { code: 4, name: "Phường Ba Đình" };

function Host({ initial = "", label }: { initial?: string; label?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiAddressField
        data-testid="addr"
        label={label}
        value={value}
        onChange={setValue}
      />
      <output data-testid="raw">{value}</output>
    </MuiThemeProvider>
  );
}

describe("UiAddressField", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetVnAddressCache();
    window.localStorage.clear();
    fetchSpy = vi.fn(() => {
      throw new Error("ô địa chỉ KHÔNG được gọi mạng");
    });
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chọn tỉnh → xã → gõ địa chỉ cụ thể, onChange nhận JSON đúng thứ tự khoá", async () => {
    const user = userEvent.setup();
    render(<Host label="Địa chỉ nhận" />);

    expect(screen.getByRole("group", { name: "Địa chỉ nhận" })).toBeTruthy();
    const ward = screen.getByTestId("addr-ward") as HTMLInputElement;
    expect(ward.disabled).toBe(true);

    const province = screen.getByTestId("addr-province");
    await user.click(province);
    await user.type(province, "ha noi");
    await user.click(await screen.findByRole("option", { name: HA_NOI.name }));

    await waitFor(() => expect(ward.disabled).toBe(false));
    await user.click(ward);
    await user.type(ward, "ba dinh");
    await user.click(await screen.findByRole("option", { name: BA_DINH.name }));

    await user.type(screen.getByTestId("addr-detail"), "Số 12 Kim Mã");

    const raw = JSON.parse(screen.getByTestId("raw").textContent ?? "{}");
    expect(raw).toEqual({
      detail: "Số 12 Kim Mã",
      ward_code: BA_DINH.code,
      ward: BA_DINH.name,
      province_code: HA_NOI.code,
      province: HA_NOI.name,
    });
    expect(Object.keys(raw)[0]).toBe("detail");
    expect(
      within(screen.getByTestId("addr-preview")).getByText(
        `Số 12 Kim Mã, ${BA_DINH.name}, ${HA_NOI.name}`,
      ),
    ).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("danh sách tỉnh/thành đầy đủ ngay lần render đầu, không có trạng thái tải", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // Không chờ đợi gì: mở ra là đã có toàn bộ tỉnh/thành.
    await user.click(screen.getByTestId("addr-province"));
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(30);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lọc không dấu khớp cả chữ Đ (MUI mặc định không bỏ được)", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const province = screen.getByTestId("addr-province");
    await user.click(province);
    await user.type(province, "da nang");
    expect(
      await screen.findByRole("option", { name: DA_NANG.name }),
    ).toBeTruthy();
  });

  it("đổi tỉnh thì xã bị reset", async () => {
    const user = userEvent.setup();
    const initial = JSON.stringify({
      detail: "1 Lê Duẩn",
      ward_code: BA_DINH.code,
      ward: BA_DINH.name,
      province_code: HA_NOI.code,
      province: HA_NOI.name,
    });
    render(<Host initial={initial} />);

    const ward = screen.getByTestId("addr-ward") as HTMLInputElement;
    await waitFor(() => expect(ward.value).toBe(BA_DINH.name));

    const province = screen.getByTestId("addr-province");
    await user.click(province);
    await user.clear(province);
    await user.type(province, "da nang");
    await user.click(await screen.findByRole("option", { name: DA_NANG.name }));

    await waitFor(() => expect(ward.value).toBe(""));
    const raw = JSON.parse(screen.getByTestId("raw").textContent ?? "{}");
    expect(raw.province_code).toBe(DA_NANG.code);
    expect(raw.ward_code).toBeNull();
    expect(raw.detail).toBe("1 Lê Duẩn");
  });

  it("chuỗi cũ nhập tự do hiện ở ô địa chỉ cụ thể kèm gợi ý chuẩn hoá", () => {
    render(<Host initial="Hải Châu, Đà Nẵng" />);
    const detail = screen.getByTestId("addr-detail") as HTMLInputElement;
    expect(detail.value).toBe("Hải Châu, Đà Nẵng");
    expect(screen.getByText(/Địa chỉ cũ nhập tự do/)).toBeTruthy();
    expect(screen.queryByTestId("addr-preview")).toBeNull();
  });
});
