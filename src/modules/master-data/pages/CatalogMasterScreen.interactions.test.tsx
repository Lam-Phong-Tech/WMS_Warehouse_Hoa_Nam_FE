import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CatalogMasterScreen } from "./CatalogMasterScreen";
import { createMockAxiosError } from "@/shared/api/api-error";
import { useAuthStore } from "@/shared/store/auth.store";
import type {
  CatalogMasterKind,
  CatalogMasterListParams,
  CatalogMasterRecord,
} from "@/modules/master-data/services/catalog-master.service";

const {
  getCatalogMasters,
  getActiveBrandOptions,
  createCatalogMaster,
  updateCatalogMaster,
  canManage,
} = vi.hoisted(() => ({
  getCatalogMasters: vi.fn(),
  getActiveBrandOptions: vi.fn(),
  createCatalogMaster: vi.fn(),
  updateCatalogMaster: vi.fn(),
  canManage: vi.fn(),
}));

vi.mock("@/modules/master-data/services/catalog-master.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/master-data/services/catalog-master.service")
  >("@/modules/master-data/services/catalog-master.service");
  return {
    ...actual,
    getCatalogMasters,
    getActiveBrandOptions,
    createCatalogMaster,
    updateCatalogMaster,
  };
});

// The global harness grants useCan unconditionally. Vary its result here so
// this screen's read-only UI is exercised without replacing its components.
vi.mock("@/shared/components/permission", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/components/permission")
  >("@/shared/components/permission");
  return { ...actual, useCan: canManage };
});

const RECORD: CatalogMasterRecord = {
  id: "brand-1",
  code: "DONGCHENG",
  name: "Dongcheng",
  description: "Hãng dụng cụ điện",
  sort_order: 3,
  status: "ACTIVE",
  version: 7,
  brand_id: null,
};

const clients: QueryClient[] = [];

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CatalogMasterScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

async function openCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Tạo hãng$/i }));
  return screen.findByRole("dialog");
}

async function fillCreate(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  await user.type(
    within(dialog).getByRole("textbox", { name: /^Mã hãng/ }),
    " NEW_BRAND ",
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: /^Tên hãng/ }),
    " Hãng mới ",
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "Mô tả" }),
    "Ghi chú mới",
  );
  const order = within(dialog).getByRole("textbox", {
    name: "Thứ tự hiển thị",
  });
  await user.clear(order);
  await user.type(order, "12");
}

function expectListRequest(
  kind: CatalogMasterKind,
  params: CatalogMasterListParams,
) {
  expect(getCatalogMasters).toHaveBeenCalledWith(
    kind,
    expect.objectContaining({ per_page: 10, ...params }),
  );
}

describe("CatalogMasterScreen interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canManage.mockReturnValue(true);
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    getActiveBrandOptions.mockResolvedValue([RECORD]);
    getCatalogMasters.mockImplementation(
      async (_kind: CatalogMasterKind, params: CatalogMasterListParams) => ({
        data: [RECORD],
        meta: {
          current_page: params.page ?? 1,
          per_page: params.per_page ?? 10,
          total: 35,
        },
      }),
    );
    createCatalogMaster.mockResolvedValue(RECORD);
    updateCatalogMaster.mockResolvedValue(RECORD);
  });

  afterEach(() => {
    cleanup();
    clients.splice(0).forEach((client) => client.clear());
  });

  it("sends live filters and page changes, then resets them when switching catalog types", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(RECORD.code);

    await user.type(screen.getByRole("textbox", { name: "Tìm hãng" }), "dong");
    await waitFor(() =>
      expectListRequest("BRAND", { keyword: "dong", status: "", page: 1 }),
    );
    await user.click(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
    await waitFor(() =>
      expectListRequest("BRAND", {
        keyword: "dong",
        status: "INACTIVE",
        page: 1,
      }),
    );
    await user.click(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    );
    expect(screen.getAllByRole("option", { name: "Tất cả" })).toHaveLength(1);
    await user.click(screen.getByRole("option", { name: "Tất cả" }));
    await waitFor(() => {
      const latestListRequest = getCatalogMasters.mock.calls
        .filter(([kind, params]) => kind === "BRAND" && params.per_page === 10)
        .at(-1);
      expect(latestListRequest).toEqual([
        "BRAND",
        expect.objectContaining({ keyword: "dong", status: "", page: 1 }),
      ]);
    });
    expect(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    ).toHaveTextContent("Tất cả");
    await user.click(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));

    await user.click(screen.getByRole("button", { name: /page 2|trang 2/i }));
    await waitFor(() =>
      expectListRequest("BRAND", {
        keyword: "dong",
        status: "INACTIVE",
        page: 2,
      }),
    );

    const destinations: Array<[RegExp, CatalogMasterKind]> = [
      [/^Nhóm hàng/, "CATEGORY"],
      [/^Mẫu sản phẩm/, "MODEL"],
      [/^Nguồn điện/, "POWER_SOURCE"],
      [/^Quy cách đóng gói/, "PACKAGE"],
      [/^Hãng/, "BRAND"],
    ];
    for (const [name, kind] of destinations) {
      await user.click(screen.getByRole("tab", { name }));
      await waitFor(() =>
        expectListRequest(kind, { keyword: "", status: "", page: 1 }),
      );
      expect(screen.getByRole("textbox", { name: /^Tìm / })).toHaveValue("");
    }
  });

  it("rejects missing required fields and invalid codes before calling the save API", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openCreate(user);
    const code = within(dialog).getByRole("textbox", { name: /^Mã hãng/ });
    const name = within(dialog).getByRole("textbox", { name: /^Tên hãng/ });

    await user.click(within(dialog).getByRole("button", { name: /^Lưu$/ }));
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(createCatalogMaster).not.toHaveBeenCalled();

    await user.type(code, "BAD CODE");
    await user.type(name, "Hãng hợp lệ");
    await user.click(within(dialog).getByRole("button", { name: /^Lưu$/ }));
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(name).not.toHaveAttribute("aria-invalid", "true");
    expect(createCatalogMaster).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the dialog locked while saving and refreshes catalog and shared master data after success", async () => {
    const user = userEvent.setup();
    let completeSave!: (record: CatalogMasterRecord) => void;
    createCatalogMaster.mockReturnValue(
      new Promise<CatalogMasterRecord>((resolve) => {
        completeSave = resolve;
      }),
    );
    const client = renderScreen();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const dialog = await openCreate(user);
    await fillCreate(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: /^Lưu$/ }));

    await waitFor(() =>
      expect(createCatalogMaster).toHaveBeenCalledWith("BRAND", {
        code: "NEW_BRAND",
        name: "Hãng mới",
        description: "Ghi chú mới",
        sort_order: 12,
        status: "ACTIVE",
        brand_id: null,
      }),
    );
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Đóng" })).toBeDisabled();
    expect(
      within(dialog).getByRole("textbox", { name: /^Mã hãng/ }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(createCatalogMaster).toHaveBeenCalledTimes(1);

    await act(async () => {
      completeSave(RECORD);
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["catalog-master"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ref"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["mvp-master"] });
    expect(updateCatalogMaster).not.toHaveBeenCalled();
  });

  it("attaches server validation to the field and retains the input for correction and retry", async () => {
    const user = userEvent.setup();
    createCatalogMaster.mockRejectedValueOnce(
      createMockAxiosError({
        status: 422,
        data: {
          message: "Dữ liệu gửi lên không hợp lệ.",
          errors: { code: ["Mã hãng đã tồn tại."] },
        },
      }),
    );
    renderScreen();
    const dialog = await openCreate(user);
    await fillCreate(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: /^Lưu$/ }));

    await within(dialog).findByText("Mã hãng đã tồn tại.");
    const code = within(dialog).getByRole("textbox", { name: /^Mã hãng/ });
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveValue(" NEW_BRAND ");
    expect(
      within(dialog).getByRole("textbox", { name: /^Tên hãng/ }),
    ).toHaveValue(" Hãng mới ");
    expect(within(dialog).getByRole("textbox", { name: "Mô tả" })).toHaveValue(
      "Ghi chú mới",
    );
    expect(within(dialog).getByRole("button", { name: /^Lưu$/ })).toBeEnabled();

    await user.clear(code);
    await user.type(code, "NEW_BRAND_2");
    expect(
      within(dialog).queryByText("Mã hãng đã tồn tại."),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Lưu$/ }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(createCatalogMaster).toHaveBeenLastCalledWith(
      "BRAND",
      expect.objectContaining({ code: "NEW_BRAND_2", name: "Hãng mới" }),
    );
  });

  it("retains the form after a save failure and lets the user cancel without a second write", async () => {
    const user = userEvent.setup();
    createCatalogMaster.mockRejectedValueOnce(
      createMockAxiosError({
        status: 503,
        data: { message: "Dịch vụ tạm thời không khả dụng." },
      }),
    );
    renderScreen();
    const dialog = await openCreate(user);
    await fillCreate(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: /^Lưu$/ }));
    await within(dialog).findByText("Dịch vụ tạm thời không khả dụng.");
    expect(
      within(dialog).getByRole("textbox", { name: /^Mã hãng/ }),
    ).toHaveValue(" NEW_BRAND ");
    expect(
      within(dialog).getByRole("textbox", { name: "Thứ tự hiển thị" }),
    ).toHaveValue("12");
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(createCatalogMaster).toHaveBeenCalledTimes(1);
  });

  it("loads existing values and supplies the record version when editing", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(
      await screen.findByRole("button", { name: "Sửa DONGCHENG" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("textbox", { name: /^Mã hãng/ }),
    ).toHaveValue(RECORD.code);
    const name = within(dialog).getByRole("textbox", { name: /^Tên hãng/ });
    expect(name).toHaveValue(RECORD.name);
    expect(within(dialog).getByRole("textbox", { name: "Mô tả" })).toHaveValue(
      RECORD.description,
    );
    expect(
      within(dialog).getByRole("textbox", { name: "Thứ tự hiển thị" }),
    ).toHaveValue("3");
    await user.clear(name);
    await user.type(name, "Dongcheng mới");
    await user.click(within(dialog).getByRole("button", { name: /^Lưu$/ }));
    await waitFor(() =>
      expect(updateCatalogMaster).toHaveBeenCalledWith(
        "BRAND",
        RECORD.id,
        {
          code: RECORD.code,
          name: "Dongcheng mới",
          description: RECORD.description,
          sort_order: 3,
          status: "ACTIVE",
          brand_id: null,
        },
        7,
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(createCatalogMaster).not.toHaveBeenCalled();
  });

  it("keeps the list and filters available while hiding writes in read-only mode", async () => {
    const user = userEvent.setup();
    canManage.mockReturnValue(false);
    renderScreen();
    await screen.findByText(RECORD.code);
    expect(
      screen.queryByRole("button", { name: /^Tạo / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Sửa / }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Mẫu sản phẩm/ }));
    await waitFor(() => expectListRequest("MODEL", { page: 1 }));
    expect(screen.getByRole("textbox", { name: /^Tìm / })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /^Tạo / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Sửa / }),
    ).not.toBeInTheDocument();
    expect(createCatalogMaster).not.toHaveBeenCalled();
    expect(updateCatalogMaster).not.toHaveBeenCalled();
  });

  it("dismisses the retained-data offline notice and shows it again for a new offline episode", async () => {
    const user = userEvent.setup();
    const wasOnline = navigator.onLine;
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const changeConnection = async (connected: boolean) => {
      await act(async () => {
        online.mockReturnValue(connected);
        window.dispatchEvent(new Event(connected ? "online" : "offline"));
      });
    };
    try {
      renderScreen();
      await screen.findByText(RECORD.code);
      await changeConnection(false);
      await screen.findByText("Dữ liệu có thể chưa mới nhất");
      expect(screen.getByText(RECORD.code)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Đóng thông báo" }));
      expect(
        screen.queryByText("Dữ liệu có thể chưa mới nhất"),
      ).not.toBeInTheDocument();
      expect(screen.getByText(RECORD.code)).toBeInTheDocument();

      await changeConnection(true);
      await waitFor(() =>
        expect(
          screen.queryByText("Đang cập nhật danh mục sản phẩm..."),
        ).not.toBeInTheDocument(),
      );
      await changeConnection(false);
      expect(
        await screen.findByText("Dữ liệu có thể chưa mới nhất"),
      ).toBeInTheDocument();
      expect(screen.getByText(RECORD.code)).toBeInTheDocument();
    } finally {
      await changeConnection(wasOnline);
      online.mockRestore();
    }
  });

  it("keeps a failed search editable and clears it without leaving the active catalog tab", async () => {
    const user = userEvent.setup();
    getCatalogMasters.mockImplementation(
      async (_kind: CatalogMasterKind, params: CatalogMasterListParams) => {
        if (params.keyword?.trim()) {
          throw createMockAxiosError({
            status: 400,
            data: { message: "Không thể thực hiện tìm kiếm này." },
          });
        }
        return {
          data: [RECORD],
          meta: { current_page: 1, per_page: params.per_page ?? 10, total: 1 },
        };
      },
    );
    renderScreen();
    await screen.findByText(RECORD.code);
    await user.type(screen.getByRole("textbox", { name: "Tìm hãng" }), "FAIL");
    await screen.findByText("Không thể thực hiện tìm kiếm này.");
    expect(screen.getByRole("textbox", { name: "Tìm hãng" })).toHaveValue(
      "FAIL",
    );
    expect(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    ).toBeEnabled();

    await user.click(
      screen.getByRole("button", { name: "Xóa bộ lọc tìm kiếm" }),
    );
    expect(await screen.findByText(RECORD.code)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tìm hãng" })).toHaveValue("");
    expect(screen.getByRole("tab", { name: /^Hãng/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByText("Không thể thực hiện tìm kiếm này."),
    ).not.toBeInTheDocument();
    expectListRequest("BRAND", { keyword: "", status: "", page: 1 });
  });
});
