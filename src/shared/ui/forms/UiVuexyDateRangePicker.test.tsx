/**
 * Kỳ nhanh trong panel lịch (RPT-07 · phản hồi leader 2026-09-04).
 *
 * Trước đây màn có HAI control cùng set một khoảng ngày — ô "Kỳ báo cáo" và ô
 * "Khoảng ngày" — nên không ai đoán được cái nào thắng cái nào, và mục "Tùy
 * chọn" trong dropdown thì bấm vào chẳng đổi gì. Giờ chỉ còn một control: kỳ
 * nhanh nằm ngay trong panel. Test khoá đúng ba điều làm nên tính "một control
 * duy nhất" đó.
 *
 * `UiVuexyDateRangePicker` là component TỰ VIẾT (MUI Popover + lịch tự dựng),
 * không phải antd, nên panel render thật và assert được.
 */
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import dayjs, { type Dayjs } from "dayjs";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import {
  UiVuexyDateRangePicker,
  type DateRangePreset,
} from "./UiVuexyDateRangePicker";

const MONTH_START = dayjs("2026-09-01").startOf("day");
const TODAY = dayjs("2026-09-04").startOf("day");
const WEEK_START = dayjs("2026-08-31").startOf("day");

const PRESETS: ReadonlyArray<DateRangePreset> = [
  {
    key: "this-week",
    label: "Tuần này",
    range: () => [WEEK_START, TODAY],
  },
  {
    key: "this-month",
    label: "Tháng này",
    range: () => [MONTH_START, TODAY],
  },
];

function Host({
  presets,
  onChange,
  initial = [MONTH_START, TODAY],
}: {
  presets?: ReadonlyArray<DateRangePreset>;
  onChange?: (value: [Dayjs | null, Dayjs | null] | null) => void;
  initial?: [Dayjs | null, Dayjs | null];
}) {
  const [value, setValue] = useState<[Dayjs | null, Dayjs | null] | null>(
    initial,
  );
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiVuexyDateRangePicker
        aria-label="Khoảng ngày"
        value={value}
        presets={presets}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </MuiThemeProvider>
  );
}

/** Mở panel bằng ô "Từ ngày" — panel chỉ tồn tại sau khi mở. */
async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Từ ngày" }));
  return screen.findByRole("dialog", { name: "Khoảng ngày" });
}

describe("UiVuexyDateRangePicker · kỳ nhanh", () => {
  it("không truyền presets thì panel không mọc thêm nhóm nào", async () => {
    const user = userEvent.setup();
    render(<Host />);

    await openPanel(user);

    // Màn Bảo hành vẫn dùng picker không presets — không được đổi gì ở đó.
    expect(
      screen.queryByRole("group", { name: "Kỳ nhanh" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tháng này" }),
    ).not.toBeInTheDocument();
  });

  it("bấm một kỳ nhanh là áp dụng luôn và đóng panel — không cần bấm thêm Áp dụng", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host presets={PRESETS} onChange={onChange} />);

    await openPanel(user);
    await user.click(screen.getByRole("button", { name: "Tuần này" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [range] = onChange.mock.calls[0] as [[Dayjs, Dayjs]];
    expect(range[0].format("YYYY-MM-DD")).toBe("2026-08-31");
    expect(range[1].format("YYYY-MM-DD")).toBe("2026-09-04");

    expect(
      screen.queryByRole("dialog", { name: "Khoảng ngày" }),
    ).not.toBeInTheDocument();
  });

  it("kỳ nhanh khớp khoảng đang chọn thì được đánh dấu, khoảng tự đặt thì không kỳ nào sáng", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Host presets={PRESETS} />);

    await openPanel(user);
    // Giá trị khởi tạo đúng bằng "Tháng này".
    expect(screen.getByRole("button", { name: "Tháng này" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Tuần này" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    unmount();

    // Khoảng tự đặt: không kỳ nào khớp — thay cho mục "Tùy chọn" đã bỏ.
    render(
      <Host
        presets={PRESETS}
        initial={[dayjs("2026-09-02"), dayjs("2026-09-03")]}
      />,
    );
    await openPanel(user);
    for (const label of ["Tuần này", "Tháng này"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });
});
