/**
 * Test UiAddressField — tải danh mục (mock fetch), chọn tỉnh → mở xã, đổi tỉnh
 * reset xã, gõ địa chỉ cụ thể → onChange nhận JSON; chuỗi cũ hiện ở ô địa chỉ
 * cụ thể; mất mạng hiện cảnh báo + nút tải lại.
 */
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { __resetVnAddressCache } from "@/shared/lib/vn-address/vn-address.api";
import { UiAddressField } from "./UiAddressField";

const PROVINCES = [
  {
    name: "Thành phố Hà Nội",
    code: 1,
    codename: "ha_noi",
    division_type: "thành phố trung ương",
    wards: [],
  },
  {
    name: "Thành phố Đà Nẵng",
    code: 48,
    codename: "da_nang",
    division_type: "thành phố trung ương",
    wards: [],
  },
];
const WARDS_HN = [
  {
    name: "Phường Ba Đình",
    code: 4,
    codename: "phuong_ba_dinh",
    division_type: "phường",
    province_code: 1,
  },
  {
    name: "Phường Hoàn Kiếm",
    code: 70,
    codename: "phuong_hoan_kiem",
    division_type: "phường",
    province_code: 1,
  },
];
const WARDS_DN = [
  {
    name: "Phường Hải Châu",
    code: 20194,
    codename: "phuong_hai_chau",
    division_type: "phường",
    province_code: 48,
  },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function mockCatalog(fail = false) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (fail) return jsonResponse({ detail: "down" }, false, 503);
    if (url.endsWith("/p/")) return jsonResponse(PROVINCES);
    if (url.includes("/p/1?depth=2")) {
      return jsonResponse({ ...PROVINCES[0], wards: WARDS_HN });
    }
    if (url.includes("/p/48?depth=2")) {
      return jsonResponse({ ...PROVINCES[1], wards: WARDS_DN });
    }
    return jsonResponse({}, false, 404);
  });
}

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
  beforeEach(() => {
    __resetVnAddressCache();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chọn tỉnh → xã → gõ địa chỉ cụ thể, onChange nhận JSON đúng thứ tự khoá", async () => {
    vi.stubGlobal("fetch", mockCatalog());
    const user = userEvent.setup();
    render(<Host label="Địa chỉ nhận" />);

    expect(screen.getByRole("group", { name: "Địa chỉ nhận" })).toBeTruthy();
    const ward = screen.getByTestId("addr-ward") as HTMLInputElement;
    expect(ward.disabled).toBe(true);

    const province = screen.getByTestId("addr-province");
    await user.click(province);
    await user.type(province, "ha noi");
    await user.click(
      await screen.findByRole("option", { name: "Thành phố Hà Nội" }),
    );

    await waitFor(() => expect(ward.disabled).toBe(false));
    await user.click(ward);
    await user.type(ward, "ba dinh");
    await user.click(
      await screen.findByRole("option", { name: "Phường Ba Đình" }),
    );

    await user.type(screen.getByTestId("addr-detail"), "Số 12 Kim Mã");

    const raw = JSON.parse(screen.getByTestId("raw").textContent ?? "{}");
    expect(raw).toEqual({
      detail: "Số 12 Kim Mã",
      ward_code: 4,
      ward: "Phường Ba Đình",
      province_code: 1,
      province: "Thành phố Hà Nội",
    });
    expect(Object.keys(raw)[0]).toBe("detail");
    expect(
      within(screen.getByTestId("addr-preview")).getByText(
        "Số 12 Kim Mã, Phường Ba Đình, Thành phố Hà Nội",
      ),
    ).toBeTruthy();
  });

  it("đổi tỉnh thì xã bị reset", async () => {
    vi.stubGlobal("fetch", mockCatalog());
    const user = userEvent.setup();
    const initial = JSON.stringify({
      detail: "1 Lê Duẩn",
      ward_code: 4,
      ward: "Phường Ba Đình",
      province_code: 1,
      province: "Thành phố Hà Nội",
    });
    render(<Host initial={initial} />);

    const ward = screen.getByTestId("addr-ward") as HTMLInputElement;
    await waitFor(() => expect(ward.value).toBe("Phường Ba Đình"));

    const province = screen.getByTestId("addr-province");
    await user.click(province);
    await user.clear(province);
    await user.type(province, "da nang");
    await user.click(
      await screen.findByRole("option", { name: "Thành phố Đà Nẵng" }),
    );

    await waitFor(() => expect(ward.value).toBe(""));
    const raw = JSON.parse(screen.getByTestId("raw").textContent ?? "{}");
    expect(raw.province_code).toBe(48);
    expect(raw.ward_code).toBeNull();
    expect(raw.detail).toBe("1 Lê Duẩn");
  });

  it("chuỗi cũ nhập tự do hiện ở ô địa chỉ cụ thể kèm gợi ý chuẩn hoá", async () => {
    vi.stubGlobal("fetch", mockCatalog());
    render(<Host initial="Hải Châu, Đà Nẵng" />);
    const detail = screen.getByTestId("addr-detail") as HTMLInputElement;
    expect(detail.value).toBe("Hải Châu, Đà Nẵng");
    expect(screen.getByText(/Địa chỉ cũ nhập tự do/)).toBeTruthy();
    expect(screen.queryByTestId("addr-preview")).toBeNull();
  });

  it("danh mục lỗi → cảnh báo + nút tải lại, vẫn gõ được địa chỉ cụ thể", async () => {
    const fetchMock = mockCatalog(true);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Host />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.type(screen.getByTestId("addr-detail"), "Ngõ 5");
    expect(
      JSON.parse(screen.getByTestId("raw").textContent ?? "{}").detail,
    ).toBe("Ngõ 5");

    const callsBefore = fetchMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /Tải lại/ }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});
