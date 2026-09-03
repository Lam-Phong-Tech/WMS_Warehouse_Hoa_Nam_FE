/**
 * Bộ lọc trong khối — hợp đồng dùng chung của 13 khối danh sách trên 8 màn
 * Báo cáo vận hành.
 *
 * File này khóa đúng những điều khiến bộ lọc này KHÁC bộ lọc đầu trang: nó chỉ
 * thu hẹp mảng đã truyền vào (không gọi API), dropdown chỉ liệt kê giá trị thật
 * sự có trong khối (không bao giờ có lựa chọn cho ra 0 dòng), từ khoá và
 * dropdown chồng nhau bằng AND, và "Xóa lọc" đưa khối về nguyên trạng.
 */
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo } from "react";
import { renderWithProviders } from "@/test/test-utils";
import { SectionFilterBar } from "./SectionFilterBar";
import {
  optionsFromRows,
  useSectionFilter,
  type SectionFilterConfig,
} from "./report-section-filter";

type Row = { code: string; name: string; actor: string };

const ROWS: Row[] = [
  { code: "SKU-A", name: "Máy thở", actor: "thukho.hn" },
  { code: "SKU-B", name: "Bo mạch", actor: "vanhanh.hn" },
  { code: "SKU-C", name: "Máy đo", actor: "thukho.hn" },
];

function Harness({ rows = ROWS }: { rows?: Row[] }) {
  const config = useMemo<SectionFilterConfig<Row>>(
    () => ({
      searchPlaceholder: "Tìm SKU",
      searchText: (row) => [row.code, row.name],
      selects: [
        {
          key: "actor",
          placeholder: "Mọi actor",
          options: (list) => optionsFromRows(list, (row) => row.actor),
          match: (row, value) => row.actor === value,
        },
      ],
    }),
    [],
  );
  const state = useSectionFilter(rows, config);
  return (
    <div>
      <SectionFilterBar state={state} label="Khối thử" unit="dòng" />
      <ul data-testid="rows">
        {state.rows.map((row) => (
          <li key={row.code}>{`${row.code} · ${row.name} · ${row.actor}`}</li>
        ))}
      </ul>
    </div>
  );
}

function visibleCodes(): string[] {
  return within(screen.getByTestId("rows"))
    .queryAllByRole("listitem")
    .map((item) => item.textContent?.split(" · ")[0] ?? "");
}

describe("Bộ lọc trong khối báo cáo", () => {
  it("bắt đầu ở trạng thái không lọc và nói đúng tổng số dòng", () => {
    renderWithProviders(<Harness />, ["/"]);

    expect(visibleCodes()).toEqual(["SKU-A", "SKU-B", "SKU-C"]);
    expect(screen.getByText("3 dòng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa lọc" })).toBeDisabled();
  });

  it("lọc theo từ khoá trên đúng những chuỗi khối đang hiển thị", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, ["/"]);

    await user.type(screen.getByPlaceholderText("Tìm SKU"), "máy");
    expect(visibleCodes()).toEqual(["SKU-A", "SKU-C"]);
    expect(screen.getByText("Đang xem 2 / 3 dòng")).toBeInTheDocument();
  });

  it("dropdown chỉ liệt kê giá trị có thật, và chồng AND với từ khoá", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, ["/"]);

    await user.click(screen.getByRole("combobox", { name: "Mọi actor" }));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    // Placeholder + đúng hai actor có mặt trong khối (không có actor thứ ba).
    expect(options.map((option) => option.textContent)).toEqual([
      "Mọi actor",
      "thukho.hn",
      "vanhanh.hn",
    ]);

    await user.click(screen.getByRole("option", { name: "thukho.hn" }));
    expect(visibleCodes()).toEqual(["SKU-A", "SKU-C"]);

    await user.type(screen.getByPlaceholderText("Tìm SKU"), "bo mạch");
    expect(visibleCodes()).toEqual([]);
  });

  it("Xóa lọc đưa khối về nguyên trạng", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, ["/"]);

    await user.type(screen.getByPlaceholderText("Tìm SKU"), "bo");
    expect(visibleCodes()).toEqual(["SKU-B"]);

    const clear = screen.getByRole("button", { name: "Xóa lọc" });
    expect(clear).toBeEnabled();
    await user.click(clear);

    expect(visibleCodes()).toEqual(["SKU-A", "SKU-B", "SKU-C"]);
    expect(clear).toBeDisabled();
  });

  it("khối rỗng thì không dựng bộ đếm rỗng nghĩa", () => {
    renderWithProviders(<Harness rows={[]} />, ["/"]);

    expect(visibleCodes()).toEqual([]);
    expect(screen.queryByText(/dòng$/)).not.toBeInTheDocument();
  });
});
