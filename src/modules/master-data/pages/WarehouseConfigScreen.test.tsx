import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Màn Hệ thống → Cấu hình kho, phần trạng thái kho (BA 07/09/2026).
 *
 * Nghĩa vụ của FE trong bốn mệnh đề Q01–Q04:
 *  · Q02/Q04 — ô trạng thái chỉ mở cho Super Admin, và mọi lần đổi đều phải qua hộp
 *    xác nhận. BE là chốt chặn thật (403 ACCESS_DENIED); ở đây chặn để người không đủ
 *    quyền không bấm rồi mới biết.
 *  · Q03 — khi kho đang tạm dừng, màn phải nói ra điều đó: mọi thao tác ghi ở màn khác
 *    đang trả 409 và người quản trị cần biết vì sao.
 *
 * Hợp đồng phía BE nằm ở tests/Feature/WarehousePauseContractTest.php (repo BE).
 */

const { updateWarehouse, fetchWarehouse } = vi.hoisted(() => ({
  updateWarehouse: vi.fn().mockResolvedValue({}),
  fetchWarehouse: vi.fn(),
}));

vi.mock("@/modules/master-data/services/warehouse.service", () => ({
  updateWarehouse,
  fetchWarehouse,
  CANONICAL_WAREHOUSE_CODE: "KHO-TONG-HN",
}));

const { useWarehouseDirectory } = vi.hoisted(() => ({
  useWarehouseDirectory: vi.fn(),
}));

vi.mock("@/shared/data/reference-queries", () => ({ useWarehouseDirectory }));

import { WarehouseConfigScreen } from "@/modules/master-data/pages/WarehouseConfigScreen";
import { useAuthStore } from "@/shared/store/auth.store";

const WAREHOUSE = {
  id: "wh-1",
  code: "KHO-TONG-HN",
  name: "Kho tổng Hoa Nam",
  address: "",
  contact_person: "",
  phone: "",
  status: "ACTIVE",
};

function setup({
  isSuperAdmin,
  status = "ACTIVE",
}: {
  isSuperAdmin: boolean;
  status?: string;
}) {
  const row = { ...WAREHOUSE, status };
  useWarehouseDirectory.mockReturnValue({
    data: [row],
    isLoading: false,
    error: null,
  });
  fetchWarehouse.mockResolvedValue(row);

  useAuthStore.setState({
    isProfileLoaded: true,
    isSuperAdmin,
    // warehouse.manage có ở cả hai kịch bản: điều được kiểm ở đây là RANH GIỚI giữa
    // "sửa được thông tin kho" và "bật/tắt được kho", không phải quyền vào màn.
    permissionCodes: ["warehouse.view", "warehouse.manage"],
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WarehouseConfigScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * MUI Select render một `div[role=combobox]` mang id, còn giá trị nằm ở input ẩn
 * không có id. Vì vậy "khoá" phải đọc bằng `aria-disabled` chứ không phải
 * `toBeDisabled()` (div không có thuộc tính disabled), và đổi giá trị phải mở
 * listbox rồi bấm option như người dùng thật.
 */
function statusSelect(): HTMLElement {
  return document.querySelector<HTMLElement>("#warehouse-status")!;
}

async function pickStatus(user: UserEvent, label: string) {
  await user.click(statusSelect());
  await user.click(await screen.findByRole("option", { name: label }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAuthStore.setState({
    permissionCodes: [],
    isSuperAdmin: false,
    isProfileLoaded: false,
  });
});

describe("WarehouseConfigScreen — trạng thái kho", () => {
  it("Q02/Q04: không phải Super Admin thì ô trạng thái bị khoá và nói rõ vì sao", async () => {
    setup({ isSuperAdmin: false });

    await waitFor(() => expect(statusSelect()).toBeInTheDocument());
    expect(statusSelect()).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText(/Chỉ Super Admin được đổi trạng thái/i),
    ).toBeInTheDocument();
  });

  it("Q02/Q04: Super Admin mở được ô trạng thái", async () => {
    setup({ isSuperAdmin: true });

    await waitFor(() => expect(statusSelect()).toBeInTheDocument());
    expect(statusSelect()).not.toHaveAttribute("aria-disabled");
    expect(
      screen.queryByText(/Chỉ Super Admin được đổi trạng thái/i),
    ).not.toBeInTheDocument();
  });

  it("Q02: tạm dừng phải qua hộp xác nhận nói rõ hậu quả, và chỉ ghi sau khi đồng ý", async () => {
    setup({ isSuperAdmin: true });
    await waitFor(() => expect(statusSelect()).toBeInTheDocument());

    const user = userEvent.setup();
    await pickStatus(user, "Ngừng hoạt động");
    await user.click(screen.getByRole("button", { name: /Lưu|Cập nhật/i }));

    // Hộp xác nhận phải nói ĐÚNG việc sắp xảy ra — đóng băng ghi toàn hệ thống —
    // chứ không phải một câu chung chung dùng cho cả hai chiều.
    expect(
      await screen.findByText(/Tạm dừng hoạt động kho\?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/toàn bộ nghiệp vụ ghi của hệ thống sẽ bị khoá/i),
    ).toBeInTheDocument();
    // Chưa đồng ý thì chưa được gọi API.
    expect(updateWarehouse).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("warehouse-status-confirm"));

    await waitFor(() => expect(updateWarehouse).toHaveBeenCalledTimes(1));
    expect(updateWarehouse.mock.calls[0][1]).toMatchObject({
      status: "INACTIVE",
    });
  });

  it("Q04: mở lại kho dùng câu chữ riêng, không dùng chung câu của tạm dừng", async () => {
    setup({ isSuperAdmin: true, status: "INACTIVE" });
    await waitFor(() => expect(statusSelect()).toBeInTheDocument());

    const user = userEvent.setup();
    await pickStatus(user, "Đang hoạt động");
    await user.click(screen.getByRole("button", { name: /Lưu|Cập nhật/i }));

    expect(
      await screen.findByText(/Mở lại hoạt động kho\?/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Tạm dừng hoạt động kho\?/i),
    ).not.toBeInTheDocument();

    // Yêu cầu Q04 ghi rõ "phải xác nhận TRƯỚC KHI thực thi": chiều mở lại cũng phải
    // chặn thật, không chỉ hiện một hộp thoại cho có. Kiểm cả hai chiều vì hai chiều
    // đi qua hai nhánh câu chữ khác nhau — sửa nhánh này mà quên nhánh kia là lỗi
    // rất dễ lọt.
    expect(updateWarehouse).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("warehouse-status-confirm"));

    await waitFor(() => expect(updateWarehouse).toHaveBeenCalledTimes(1));
    expect(updateWarehouse.mock.calls[0][1]).toMatchObject({
      status: "ACTIVE",
    });
  });

  it("Q04: bấm Hủy trong hộp xác nhận thì KHÔNG ghi gì", async () => {
    setup({ isSuperAdmin: true, status: "INACTIVE" });
    await waitFor(() => expect(statusSelect()).toBeInTheDocument());

    const user = userEvent.setup();
    await pickStatus(user, "Đang hoạt động");
    await user.click(screen.getByRole("button", { name: /Lưu|Cập nhật/i }));
    await screen.findByText(/Mở lại hoạt động kho\?/i);

    await user.click(screen.getByRole("button", { name: /^Hủy$/i }));

    expect(updateWarehouse).not.toHaveBeenCalled();
  });

  it("Q03: màn KHÔNG tự dựng lại cảnh báo tạm dừng — shell đã lo", async () => {
    setup({ isSuperAdmin: true, status: "INACTIVE" });

    await waitFor(() => expect(statusSelect()).toBeInTheDocument());
    // Cảnh báo "kho đang tạm dừng" là trạng thái toàn hệ thống nên do
    // WarehousePausedBanner ở shell dựng một lần. Bản trước màn này dựng thêm một
    // dải giống hệt, và vì màn nằm TRONG shell nên người dùng thấy hai dải chồng
    // nhau — chỉ lộ ra khi chụp màn hình, không test đơn lẻ nào bắt được.
    expect(
      screen.queryByText(/Kho đang tạm dừng hoạt động/i),
    ).not.toBeInTheDocument();
    // Trạng thái vẫn phải đọc được ở ô "Trạng thái hiện tại".
    expect(screen.getAllByText(/Ngừng hoạt động/i).length).toBeGreaterThan(0);
  });

  it("kho đang hoạt động thì không hiện cảnh báo tạm dừng", async () => {
    setup({ isSuperAdmin: true });

    await waitFor(() => expect(statusSelect()).toBeInTheDocument());
    expect(
      screen.queryByText(/Kho đang tạm dừng hoạt động/i),
    ).not.toBeInTheDocument();
  });

  it("sửa thông tin mà không đổi trạng thái thì lưu thẳng, không hỏi xác nhận", async () => {
    setup({ isSuperAdmin: true });
    await waitFor(() => expect(statusSelect()).toBeInTheDocument());

    const user = userEvent.setup();
    const name = document.querySelector<HTMLInputElement>("#warehouse-name")!;
    await user.clear(name);
    await user.type(name, "Kho tổng Hoa Nam 2");
    await user.click(screen.getByRole("button", { name: /Lưu|Cập nhật/i }));

    await waitFor(() => expect(updateWarehouse).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText(/Tạm dừng hoạt động kho\?/i),
    ).not.toBeInTheDocument();
  });
});
