import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { ReportDateRangePicker } from "./ReportDateRangePicker";

describe("bộ chọn ngày chung của báo cáo", () => {
  it("hiện hai ô ngày và các kỳ chọn nhanh như nhau", async () => {
    const user = userEvent.setup();
    render(
      <MuiThemeProvider theme={muiTheme}>
        <ReportDateRangePicker
          value={[dayjs().subtract(6, "day"), dayjs()]}
          onChange={() => {}}
          aria-label="Khoảng thời gian"
        />
      </MuiThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Từ ngày" }));
    const panel = await screen.findByRole("dialog", {
      name: "Khoảng thời gian",
    });
    const presets = within(panel).getByRole("group", { name: "Kỳ nhanh" });
    for (const label of [
      "Hôm nay",
      "Hôm qua",
      "7 ngày qua",
      "30 ngày qua",
      "Tháng này",
      "Tháng trước",
      "Quý này",
      "Năm nay",
    ]) {
      expect(
        within(presets).getByRole("button", { name: label }),
      ).toBeInTheDocument();
    }
  });
});
