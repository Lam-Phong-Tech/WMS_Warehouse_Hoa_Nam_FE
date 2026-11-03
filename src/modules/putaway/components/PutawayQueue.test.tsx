import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import type { PutawayTask } from "../services/putawayService";
import { PutawayQueue } from "./PutawayQueue";

const task = (
  id: number,
  overrides: Partial<PutawayTask> = {},
): PutawayTask => ({
  id: `TASK-${id}`,
  box_container_id: `container-${id}`,
  box_code: `BOX-${String(id).padStart(2, "0")}`,
  sku_id: `SKU-${id}`,
  sku_code: `LK-${id}`,
  sku_name: `Linh kiện ${id}`,
  quantity: id * 10,
  receipt_code: "PN-01",
  status: "RECEIVED_PENDING_PUTAWAY",
  container_version: 1,
  ...overrides,
});

function props(tasks: PutawayTask[]) {
  return {
    tasks,
    orders: false,
    loading: false,
    refreshing: false,
    error: null,
    canManage: true,
    search: "",
    onSearch: vi.fn(),
    onApplySearch: vi.fn(),
    onRefresh: vi.fn(),
    onView: vi.fn(),
    onCreate: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };
}

function visibleBoxes() {
  return within(screen.getByRole("table"))
    .getAllByRole("button", { name: /^BOX-/ })
    .map((button) => button.textContent);
}

async function selectFilter(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string,
) {
  await user.click(screen.getByRole("combobox", { name }));
  await user.click(screen.getByRole("option", { name: option }));
}

afterEach(cleanupTestState);

describe("PTW-00 queue interactions", () => {
  it("starts the pending BOX table directly after the filters without summary cards or a list heading", () => {
    renderWithProviders(<PutawayQueue {...props([task(1)])} />);
    expect(document.querySelector(".ptw-stats")).not.toBeInTheDocument();
    expect(screen.queryByText("Danh sách BOX chờ")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Tạo lệnh không làm thay đổi tồn kho"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("excludes active drafts and filters receipt/status immediately", async () => {
    const user = userEvent.setup();
    const input = props([
      task(1, { quantity: 1200, sku_id: "shared", receipt_code: "PN-01" }),
      task(2, { quantity: 300, sku_id: "shared", receipt_code: "PN-02" }),
      task(3, { quantity: 50, receipt_code: "PN-02", status: "STORED" }),
      task(4, { draft_id: "draft-4", draft_version: 2 }),
    ]);
    renderWithProviders(<PutawayQueue {...input} />);
    expect(visibleBoxes()).toEqual(["BOX-01", "BOX-02"]);

    await selectFilter(user, "Phiếu nhập nguồn", "PN-02");
    expect(visibleBoxes()).toEqual(["BOX-02"]);
    await selectFilter(user, "Trạng thái BOX", "Tất cả");
    expect(visibleBoxes()).toEqual(["BOX-02", "BOX-03"]);
    await selectFilter(user, "Phiếu nhập nguồn", "Tất cả");
    expect(visibleBoxes()).toEqual(["BOX-01", "BOX-02", "BOX-03"]);
    await selectFilter(user, "Trạng thái BOX", "Chờ xếp khay");
    expect(visibleBoxes()).toEqual(["BOX-01", "BOX-02"]);
    expect(
      screen.queryByRole("button", { name: "Áp dụng" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Đặt lại" }),
    ).not.toBeInTheDocument();
  });

  it("sorts the full dataset before paging and resets/clamps the current page", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 12 }, (_, index) => task(12 - index));
    const input = props(rows);
    const rendered = renderWithProviders(<PutawayQueue {...input} />);
    expect(visibleBoxes()).toEqual([
      "BOX-12",
      "BOX-11",
      "BOX-10",
      "BOX-09",
      "BOX-08",
      "BOX-07",
      "BOX-06",
      "BOX-05",
      "BOX-04",
      "BOX-03",
    ]);
    await user.click(
      screen.getByRole("button", { name: /sắp xếp theo Mã BOX/ }),
    );
    expect(visibleBoxes()).toEqual([
      "BOX-01",
      "BOX-02",
      "BOX-03",
      "BOX-04",
      "BOX-05",
      "BOX-06",
      "BOX-07",
      "BOX-08",
      "BOX-09",
      "BOX-10",
    ]);
    await user.click(screen.getByRole("button", { name: "Go to page 2" }));
    expect(visibleBoxes()).toEqual(["BOX-11", "BOX-12"]);
    expect(screen.getByText("Hiển thị 11–12 / 12 BOX")).toBeInTheDocument();
    rendered.rerender(<PutawayQueue {...input} tasks={[task(1), task(2)]} />);
    expect(visibleBoxes()).toEqual(["BOX-01", "BOX-02"]);
    expect(screen.getByText("Hiển thị 1–2 / 2 BOX")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
      "20",
    );
    expect(
      screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    ).toHaveValue("20");
  });

  it("opens the exact BOX and creates from a single selection without a bulk mutation", async () => {
    const user = userEvent.setup();
    const rows = [task(1), task(2)];
    const input = props(rows);
    renderWithProviders(<PutawayQueue {...input} />);
    await user.click(screen.getByRole("button", { name: "BOX-02" }));
    expect(input.onView).toHaveBeenCalledWith(rows[1]);
    await user.click(screen.getByRole("checkbox", { name: "Chọn BOX BOX-02" }));
    await user.click(
      screen.getByRole("button", { name: "Tạo lệnh cho BOX đã chọn" }),
    );
    expect(input.onCreate).toHaveBeenCalledExactlyOnceWith(rows[1]);
    await user.click(
      screen.getByRole("checkbox", { name: "Chọn tất cả BOX trên trang" }),
    );
    expect(screen.getByText("Đã chọn 2 BOX")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tạo lệnh cho BOX đã chọn" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bỏ chọn" }));
    expect(
      screen.getByRole("checkbox", { name: "Chọn BOX BOX-02" }),
    ).not.toBeChecked();
    expect(input.onCreate).toHaveBeenCalledOnce();
  });

  it("keeps read-only BOX detail available while disabling draft mutations", async () => {
    const user = userEvent.setup();
    const draft = task(2, { draft_id: "draft-2", draft_version: 4 });
    const input = props([task(1), draft]);
    const rendered = renderWithProviders(
      <PutawayQueue {...input} canManage={false} />,
    );
    expect(screen.getByRole("button", { name: "Tạo lệnh" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "BOX-01" }));
    expect(input.onView).toHaveBeenCalledWith(input.tasks[0]);
    rendered.rerender(<PutawayQueue {...input} canManage={false} orders />);
    expect(visibleBoxes()).toEqual(["BOX-02"]);
    await user.click(screen.getByRole("button", { name: "Thao tác BOX-02" }));
    expect(
      screen.getByRole("menuitem", { name: "Xác nhận xếp khay" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("menuitem", { name: "Hủy lệnh nháp" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(input.onCreate).not.toHaveBeenCalled();
    expect(input.onConfirm).not.toHaveBeenCalled();
    expect(input.onCancel).not.toHaveBeenCalled();
  });

  it("distinguishes loading, recoverable errors and empty data without displaying invented metrics", async () => {
    const user = userEvent.setup();
    const input = props([]);
    const rendered = renderWithProviders(
      <PutawayQueue {...input} loading refreshing />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đang tải danh sách BOX",
    );
    expect(
      screen.queryByText("Không có BOX chờ xếp khay"),
    ).not.toBeInTheDocument();
    rendered.rerender(
      <PutawayQueue {...input} error={<span>Lỗi kết nối</span>} />,
    );
    expect(
      screen.getByText("Không tải được danh sách. Vui lòng thử lại."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(input.onRefresh).toHaveBeenCalledOnce();
    rendered.rerender(<PutawayQueue {...input} />);
    expect(screen.getByText("Không có BOX chờ xếp khay")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(input.onRefresh).toHaveBeenCalledTimes(2);
  });
  it("keeps the selected receipt visible when refreshed data no longer contains it", async () => {
    const user = userEvent.setup();
    const input = props([
      task(1, { receipt_code: "PN-A" }),
      task(2, { receipt_code: "PN-B" }),
    ]);
    const rendered = renderWithProviders(<PutawayQueue {...input} />);
    await selectFilter(user, "Phiếu nhập nguồn", "PN-A");
    expect(visibleBoxes()).toEqual(["BOX-01"]);

    rendered.rerender(
      <PutawayQueue {...input} tasks={[task(2, { receipt_code: "PN-B" })]} />,
    );
    expect(
      screen.getByRole("combobox", { name: "Phiếu nhập nguồn" }),
    ).toHaveTextContent("PN-A");
    expect(screen.getByText("Không tìm thấy BOX phù hợp")).toBeInTheDocument();
    await user.click(
      screen.getByRole("combobox", { name: "Phiếu nhập nguồn" }),
    );
    expect(screen.getByRole("option", { name: "PN-A" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "PN-B" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await selectFilter(user, "Phiếu nhập nguồn", "Tất cả");
    expect(visibleBoxes()).toEqual(["BOX-02"]);
    expect(
      screen.getByRole("combobox", { name: "Phiếu nhập nguồn" }),
    ).toHaveTextContent("Tất cả");
  });
});
