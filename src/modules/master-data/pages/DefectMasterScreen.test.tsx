import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DefectMasterScreen } from "./ApiMasterScreens";
import { createMockAxiosError } from "@/shared/api/api-error";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import type {
  DefectRecord,
  MasterListParams,
} from "@/modules/master-data/types/mvp-master.types";

const {
  queryDefects,
  createDefect,
  updateDefect,
  refetchDefects,
  mutationState,
} = vi.hoisted(() => ({
  queryDefects: vi.fn(),
  createDefect: vi.fn(),
  updateDefect: vi.fn(),
  refetchDefects: vi.fn(),
  mutationState: { createPending: false, updatePending: false },
}));

vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpDefects: queryDefects,
  useCreateMvpDefect: () => ({
    isPending: mutationState.createPending,
    mutateAsync: createDefect,
  }),
  useUpdateMvpDefect: () => ({
    isPending: mutationState.updatePending,
    mutateAsync: updateDefect,
  }),
}));

// Its three global count probes are verified by DefectOverview.test.tsx.
vi.mock("@/modules/master-data/components/DefectOverview", () => ({
  DefectOverview: () => null,
}));
const RECORD: DefectRecord = {
  defect_id: "defect-1",
  defect_code: "DF-MOTOR-01",
  defect_name: "Không chạy motor",
  description: "Motor không hoạt động",
  status: "ACTIVE",
  version: 7,
};

function renderScreen(route = "/master-data/defects?screen=DEF-01") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <DefectMasterScreen />
    </MemoryRouter>,
  );
}

async function openCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Thêm lỗi$/ }));
  return screen.findByRole("dialog");
}

async function openEdit(user: ReturnType<typeof userEvent.setup>) {
  const row = screen.getByText(RECORD.defect_code).closest("tr");
  expect(row).not.toBeNull();
  await user.click(
    within(row as HTMLTableRowElement).getByRole("button", { name: /^Sửa/ }),
  );
  return screen.findByRole("dialog");
}

function fillCreate(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByRole("textbox", { name: /^Mã lỗi/ }), {
    target: { value: " NEW_DEFECT " },
  });
  fireEvent.change(
    within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
    { target: { value: " Lỗi mới " } },
  );
}

function save(dialog: HTMLElement) {
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Lưu danh mục lỗi" }),
  );
}

describe("DefectMasterScreen interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationState.createPending = false;
    mutationState.updatePending = false;
    useLanguageStore.setState({ language: "vi" });
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    queryDefects.mockImplementation((params: MasterListParams) => ({
      data: {
        data: [RECORD],
        meta: {
          current_page: params.page,
          per_page: params.per_page,
          total: 75,
        },
      },
      isLoading: false,
      error: null,
      refetch: refetchDefects,
    }));
    createDefect.mockResolvedValue(RECORD);
    updateDefect.mockResolvedValue(RECORD);
    refetchDefects.mockResolvedValue({});
  });

  afterEach(cleanup);

  it("keeps query filters, paging, apply and reset connected to the API hook", async () => {
    const user = userEvent.setup();
    renderScreen();
    expect(queryDefects).toHaveBeenLastCalledWith({
      keyword: "",
      status: "",
      page: 1,
      per_page: 15,
    });

    await user.click(screen.getByRole("button", { name: /page 2|trang 2/i }));
    expect(queryDefects).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm lỗi/bệnh" }), {
      target: { value: " motor " },
    });
    expect(queryDefects).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "motor", page: 1 }),
    );

    await user.click(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
    expect(queryDefects).toHaveBeenLastCalledWith(
      expect.objectContaining({
        keyword: "motor",
        status: "INACTIVE",
        page: 1,
      }),
    );
    await user.click(screen.getByRole("button", { name: /page 2|trang 2/i }));
    await user.click(
      screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    );
    await user.click(screen.getByRole("option", { name: /^20/ }));
    expect(queryDefects).toHaveBeenLastCalledWith({
      keyword: "motor",
      status: "INACTIVE",
      page: 1,
      per_page: 20,
    });

    await user.click(screen.getByRole("button", { name: /Áp dụng|Apply/i }));
    expect(refetchDefects).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /page 2|trang 2/i }));
    await user.click(screen.getByRole("button", { name: /Đặt lại|Reset/i }));
    expect(queryDefects).toHaveBeenLastCalledWith({
      keyword: "",
      status: "",
      page: 1,
      per_page: 20,
    });
    expect(screen.getByRole("textbox", { name: "Tìm lỗi/bệnh" })).toHaveValue(
      "",
    );
  });

  it("rejects empty required fields and invalid codes without saving", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openCreate(user);
    const code = within(dialog).getByRole("textbox", { name: /^Mã lỗi/ });
    const name = within(dialog).getByRole("textbox", {
      name: /^Tên lỗi \/ bệnh/,
    });
    save(dialog);
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByText("Mã lỗi là bắt buộc.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Tên lỗi / bệnh là bắt buộc."),
    ).toBeInTheDocument();
    expect(createDefect).not.toHaveBeenCalled();

    fireEvent.change(code, { target: { value: "INVALID CODE" } });
    fireEvent.change(name, { target: { value: "Tên hợp lệ" } });
    save(dialog);
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(name).not.toHaveAttribute("aria-invalid", "true");
    expect(createDefect).not.toHaveBeenCalled();
  });

  it.each([
    ["   ", null],
    ["  Ghi chú mới  ", "Ghi chú mới"],
  ])(
    "normalizes create fields and description %j",
    async (description, expected) => {
      const user = userEvent.setup();
      renderScreen();
      const dialog = await openCreate(user);
      fillCreate(dialog);
      fireEvent.change(within(dialog).getByRole("textbox", { name: "Mô tả" }), {
        target: { value: description },
      });
      save(dialog);
      await waitFor(() =>
        expect(createDefect).toHaveBeenCalledWith({
          defect_code: "NEW_DEFECT",
          defect_name: "Lỗi mới",
          description: expected,
          status: "ACTIVE",
        }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(updateDefect).not.toHaveBeenCalled();
    },
  );

  it("loads the selected row and preserves its version in the update", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openEdit(user);
    expect(
      within(dialog).getByRole("textbox", { name: /^Mã lỗi/ }),
    ).toHaveValue(RECORD.defect_code);
    const name = within(dialog).getByRole("textbox", {
      name: /^Tên lỗi \/ bệnh/,
    });
    expect(name).toHaveValue(RECORD.defect_name);
    expect(within(dialog).getByRole("textbox", { name: "Mô tả" })).toHaveValue(
      RECORD.description,
    );
    fireEvent.change(name, { target: { value: "  Motor không chạy  " } });
    save(dialog);
    await waitFor(() =>
      expect(updateDefect).toHaveBeenCalledWith({
        id: RECORD.defect_id,
        version: 7,
        payload: {
          defect_code: RECORD.defect_code,
          defect_name: "Motor không chạy",
          description: RECORD.description,
          status: "ACTIVE",
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(createDefect).not.toHaveBeenCalled();
  });

  it("keeps read-only filters available and blocks the create deep link", () => {
    useAuthStore.setState({ isSuperAdmin: false, permissionCodes: [] });
    renderScreen("/master-data/defects?screen=DEF-02");
    expect(screen.getByText(RECORD.defect_code)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tìm lỗi/bệnh" })).toBeEnabled();
    expect(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /^Thêm lỗi$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Sửa/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByText("Chỉ xem").length).toBeGreaterThan(0);
    expect(createDefect).not.toHaveBeenCalled();
    expect(updateDefect).not.toHaveBeenCalled();
  });

  it("attaches a server error to the field and retains the form for correction", async () => {
    const user = userEvent.setup();
    createDefect.mockRejectedValueOnce(
      createMockAxiosError({
        status: 422,
        data: {
          message: "Dữ liệu gửi lên không hợp lệ.",
          errors: { defect_code: ["Mã lỗi đã tồn tại."] },
        },
      }),
    );
    renderScreen();
    const dialog = await openCreate(user);
    fillCreate(dialog);
    save(dialog);
    await within(dialog).findByText("Mã lỗi đã tồn tại.");
    const code = within(dialog).getByRole("textbox", { name: /^Mã lỗi/ });
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveValue(" NEW_DEFECT ");
    expect(
      within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
    ).toHaveValue(" Lỗi mới ");
    fireEvent.change(code, { target: { value: "NEW_DEFECT_2" } });
    expect(
      within(dialog).queryByText("Mã lỗi đã tồn tại."),
    ).not.toBeInTheDocument();
    save(dialog);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(createDefect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        defect_code: "NEW_DEFECT_2",
        defect_name: "Lỗi mới",
      }),
    );
  });

  it("does not update an active defect when deactivation is cancelled", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openEdit(user);
    await user.click(
      within(dialog).getByRole("combobox", { name: "Trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
    save(dialog);
    const confirmation = await screen.findByRole("dialog", {
      name: "Ngừng sử dụng lỗi / bệnh?",
    });
    expect(updateDefect).not.toHaveBeenCalled();
    await user.click(within(confirmation).getByRole("button", { name: "Hủy" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Ngừng sử dụng lỗi / bệnh?",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(updateDefect).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", { name: /Sửa lỗi \/ bệnh/ }),
    ).toBeInTheDocument();
  });

  it("refreshes the list from the visible refresh action", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: "Cập nhật mới nhất" }));
    expect(refetchDefects).toHaveBeenCalledTimes(1);
    expect(createDefect).not.toHaveBeenCalled();
    expect(updateDefect).not.toHaveBeenCalled();
  });

  it("clears the keyword independently and restores all statuses from the menu", async () => {
    const user = userEvent.setup();
    renderScreen();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm lỗi/bệnh" }), {
      target: { value: "motor" },
    });
    await user.click(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
    await user.click(screen.getByRole("button", { name: "Xóa từ khóa" }));
    expect(queryDefects).toHaveBeenLastCalledWith({
      keyword: "",
      status: "INACTIVE",
      page: 1,
      per_page: 15,
    });
    expect(
      screen.queryByRole("button", { name: "Xóa từ khóa" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Tất cả" }));
    expect(queryDefects).toHaveBeenLastCalledWith({
      keyword: "",
      status: "",
      page: 1,
      per_page: 15,
    });
    expect(screen.queryByText("Đã áp dụng")).not.toBeInTheDocument();
  });

  it("keeps unsaved values when continuing and discards them only after confirmation", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openCreate(user);
    fillCreate(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
    let confirmation = await screen.findByRole("dialog", {
      name: "Bạn có thay đổi chưa lưu",
    });
    await user.click(
      within(confirmation).getByRole("button", { name: "Tiếp tục chỉnh sửa" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Bạn có thay đổi chưa lưu" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(dialog).getByRole("textbox", { name: /^Mã lỗi/ }),
    ).toHaveValue(" NEW_DEFECT ");
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
    confirmation = await screen.findByRole("dialog", {
      name: "Bạn có thay đổi chưa lưu",
    });
    await user.click(
      within(confirmation).getByRole("button", { name: "Bỏ thay đổi" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const fresh = await openCreate(user);
    expect(within(fresh).getByRole("textbox", { name: /^Mã lỗi/ })).toHaveValue(
      "",
    );
    expect(
      within(fresh).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
    ).toHaveValue("");
    expect(createDefect).not.toHaveBeenCalled();
  });

  it("closes an unchanged form without a discard prompt", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openEdit(user);
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Bạn có thay đổi chưa lưu"),
    ).not.toBeInTheDocument();
    expect(updateDefect).not.toHaveBeenCalled();
  });

  it("announces initial loading with skeleton rows and disables actions", () => {
    queryDefects.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
      refetch: refetchDefects,
    });
    renderScreen();
    const table = screen.getByRole("region", {
      name: "Bảng danh mục bệnh / lỗi",
    });
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(table.querySelectorAll(".hn-defect-skeleton-row")).toHaveLength(7);
    expect(screen.getByRole("status")).toHaveTextContent(/Đang tải/);
    expect(screen.getByRole("button", { name: /^Thêm lỗi$/ })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Cập nhật mới nhất" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: "Tìm lỗi/bệnh" }),
    ).toBeDisabled();
    expect(screen.queryByText("Chưa có bệnh/lỗi")).not.toBeInTheDocument();
  });

  it("distinguishes an empty catalog from an empty filtered result and resets it", async () => {
    const user = userEvent.setup();
    queryDefects.mockImplementation((params: MasterListParams) => ({
      data: {
        data: [],
        meta: {
          current_page: params.page,
          per_page: params.per_page,
          total: 0,
        },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: refetchDefects,
    }));
    renderScreen();
    expect(
      screen.getByRole("status", { name: "Chưa có bệnh/lỗi" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xóa tìm kiếm" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm lỗi/bệnh" }), {
      target: { value: "missing" },
    });
    await user.click(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
    expect(
      screen.getByRole("status", { name: "Không tìm thấy bệnh/lỗi" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(queryDefects).toHaveBeenLastCalledWith({
      keyword: "",
      status: "",
      page: 1,
      per_page: 15,
    });
    expect(
      screen.getByRole("status", { name: "Chưa có bệnh/lỗi" }),
    ).toBeInTheDocument();
  });

  it("retries an initial load failure without exposing mutation actions", async () => {
    const user = userEvent.setup();
    queryDefects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: new Error("Unable to load"),
      refetch: refetchDefects,
    });
    renderScreen();
    expect(
      screen.getByRole("alert", { name: "Không thể tải danh sách bệnh/lỗi" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Thêm lỗi$/ })).toBeDisabled();
    expect(
      screen.queryByRole("textbox", { name: "Tìm lỗi/bệnh" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetchDefects).toHaveBeenCalledTimes(1);
    expect(createDefect).not.toHaveBeenCalled();
  });

  it("retains stale rows with a recovery action while disabling edits", async () => {
    const user = userEvent.setup();
    queryDefects.mockReturnValue({
      data: { data: [RECORD], meta: { total: 1 } },
      isLoading: false,
      isFetching: false,
      error: new Error("Refresh failed"),
      refetch: refetchDefects,
    });
    renderScreen();
    expect(screen.getByText(RECORD.defect_code)).toBeInTheDocument();
    expect(
      screen.getByText("Dữ liệu có thể chưa mới nhất"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Thêm lỗi$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Sửa/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Thử cập nhật" }));
    expect(refetchDefects).toHaveBeenCalledTimes(1);
  });

  it("prevents saving or closing while a create request is pending", async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: DefectRecord) => void;
    createDefect.mockImplementationOnce(
      () =>
        new Promise<DefectRecord>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const view = renderScreen();
    const dialog = await openCreate(user);
    fillCreate(dialog);
    save(dialog);
    mutationState.createPending = true;
    view.rerender(
      <MemoryRouter>
        <DefectMasterScreen />
      </MemoryRouter>,
    );
    expect(
      within(dialog).getByRole("button", { name: "Lưu danh mục lỗi" }),
    ).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(
      within(dialog).getByRole("textbox", { name: /^Mã lỗi/ }),
    ).toBeDisabled();
    fireEvent.submit(
      within(dialog)
        .getByRole("textbox", { name: /^Mã lỗi/ })
        .closest("form")!,
    );
    expect(createDefect).toHaveBeenCalledTimes(1);
    await act(async () => {
      mutationState.createPending = false;
      resolveCreate(RECORD);
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("reloads a conflicting edit from the latest server row before another save", async () => {
    const user = userEvent.setup();
    updateDefect.mockRejectedValueOnce(
      createMockAxiosError({
        status: 412,
        data: { message: "Version changed", code: "VERSION_CONFLICT" },
      }),
    );
    const current: DefectRecord = {
      ...RECORD,
      defect_name: "Tên được cập nhật",
      version: 8,
    };
    refetchDefects.mockResolvedValueOnce({
      data: { data: [current], meta: { total: 1 } },
    });
    renderScreen();
    const dialog = await openEdit(user);
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
      { target: { value: "Bản sửa cục bộ" } },
    );
    save(dialog);
    await within(dialog).findByRole("alert", { name: "Thông tin đã thay đổi" });
    await user.click(
      within(dialog).getByRole("button", { name: "Tải dữ liệu mới" }),
    );
    await waitFor(() =>
      expect(
        within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
      ).toHaveValue(current.defect_name),
    );
    save(dialog);
    await waitFor(() =>
      expect(updateDefect).toHaveBeenLastCalledWith({
        id: RECORD.defect_id,
        version: 8,
        payload: {
          defect_code: RECORD.defect_code,
          defect_name: current.defect_name,
          description: RECORD.description,
          status: "ACTIVE",
        },
      }),
    );
    expect(refetchDefects).toHaveBeenCalledTimes(1);
  });

  it("checks an uncertain save result without resending the mutation", async () => {
    const user = userEvent.setup();
    createDefect.mockRejectedValueOnce(
      Object.assign(new Error("Request timed out"), { code: "ECONNABORTED" }),
    );
    renderScreen();
    const dialog = await openCreate(user);
    fillCreate(dialog);
    save(dialog);
    await within(dialog).findByRole("alert", {
      name: "Chưa xác định được kết quả lưu",
    });
    expect(
      within(dialog).getByRole("button", { name: "Lưu danh mục lỗi" }),
    ).toBeDisabled();
    fireEvent.submit(
      within(dialog)
        .getByRole("textbox", { name: /^Mã lỗi/ })
        .closest("form")!,
    );
    expect(createDefect).toHaveBeenCalledTimes(1);
    await user.click(
      within(dialog).getByRole("button", { name: "Kiểm tra kết quả" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(queryDefects).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "NEW_DEFECT", page: 1 }),
    );
    expect(refetchDefects).toHaveBeenCalledTimes(1);
    expect(createDefect).toHaveBeenCalledTimes(1);
    expect(updateDefect).not.toHaveBeenCalled();
  });

  it("requires explicit deactivation confirmation before sending the inactive update", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openEdit(user);
    await user.click(
      within(dialog).getByRole("combobox", { name: "Trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
    save(dialog);
    const confirmation = await screen.findByRole("dialog", {
      name: "Ngừng sử dụng lỗi / bệnh?",
    });
    expect(updateDefect).not.toHaveBeenCalled();
    await user.click(
      within(confirmation).getByRole("button", { name: "Ngừng sử dụng" }),
    );
    await waitFor(() =>
      expect(updateDefect).toHaveBeenCalledWith({
        id: RECORD.defect_id,
        version: RECORD.version,
        payload: {
          defect_code: RECORD.defect_code,
          defect_name: RECORD.defect_name,
          description: RECORD.description,
          status: "INACTIVE",
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("retains rows and reports a background refresh while preventing edits", () => {
    queryDefects.mockReturnValue({
      data: { data: [RECORD], meta: { total: 1 } },
      isLoading: false,
      isFetching: true,
      error: null,
      refetch: refetchDefects,
    });
    renderScreen();
    expect(screen.getByText(RECORD.defect_code)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Bảng danh mục bệnh / lỗi" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đang cập nhật danh sách bệnh/lỗi...",
    );
    expect(screen.getByRole("button", { name: /^Thêm lỗi$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Sửa/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
  });

  it("verifies an uncertain create using a fresh unfiltered target query rather than the previous list", async () => {
    const user = userEvent.setup();
    let resolveVerification!: (value: object) => void;
    const targetRefetch = vi.fn(
      () =>
        new Promise<object>((resolve) => {
          resolveVerification = resolve;
        }),
    );
    queryDefects.mockImplementation((params: MasterListParams) => {
      const isTarget =
        params.keyword === "NEW_DEFECT" &&
        params.status === "" &&
        params.page === 1;
      return {
        // A cached empty target result still needs an explicit fresh read.
        data: {
          data: isTarget ? [] : [RECORD],
          meta: {
            current_page: params.page,
            per_page: params.per_page,
            total: isTarget ? 0 : 75,
          },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: isTarget ? targetRefetch : refetchDefects,
      };
    });
    createDefect.mockRejectedValueOnce(
      Object.assign(new Error("Timed out"), { code: "ECONNABORTED" }),
    );
    renderScreen();
    await user.click(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    );
    await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
    await user.click(screen.getByRole("button", { name: /page 2|trang 2/i }));
    const dialog = await openCreate(user);
    fillCreate(dialog);
    save(dialog);
    await within(dialog).findByRole("alert", {
      name: "Chưa xác định được kết quả lưu",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Kiểm tra kết quả" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(queryDefects).toHaveBeenLastCalledWith({
      keyword: "NEW_DEFECT",
      status: "",
      page: 1,
      per_page: 15,
    });
    expect(targetRefetch).toHaveBeenCalledTimes(1);
    expect(refetchDefects).not.toHaveBeenCalled();
    const check = screen.getByRole("button", { name: "Kiểm tra kết quả" });
    expect(check).toBeDisabled();
    fireEvent.click(check);
    expect(targetRefetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveVerification({ data: { data: [], meta: { total: 0 } } });
    });
    await waitFor(() => expect(check).toBeEnabled());
    expect(createDefect).toHaveBeenCalledTimes(1);
    expect(updateDefect).not.toHaveBeenCalled();
  });

  it.each(["isError", "error", "absent"] as const)(
    "preserves the draft and conflict when latest-record recovery returns %s",
    async (outcome) => {
      const user = userEvent.setup();
      updateDefect.mockRejectedValueOnce(
        createMockAxiosError({
          status: 412,
          data: { message: "Version changed", error_code: "VERSION_CONFLICT" },
        }),
      );
      const cached = {
        ...RECORD,
        defect_name: "Cached old value",
        version: 99,
      };
      refetchDefects.mockResolvedValueOnce({
        data: {
          data: outcome === "absent" ? [] : [cached],
          meta: { total: 1 },
        },
        ...(outcome === "isError"
          ? { isError: true }
          : outcome === "error"
            ? { error: new Error("Refetch failed") }
            : {}),
      });
      renderScreen();
      const dialog = await openEdit(user);
      fireEvent.change(
        within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
        { target: { value: "Bản sửa chưa lưu" } },
      );
      save(dialog);
      await within(dialog).findByRole("alert", {
        name: "Thông tin đã thay đổi",
      });
      await user.click(
        within(dialog).getByRole("button", { name: "Tải dữ liệu mới" }),
      );
      await within(dialog).findByText(
        outcome === "absent"
          ? "Hồ sơ không còn trong kết quả hiện tại. Đóng biểu mẫu và cập nhật danh sách để kiểm tra lại."
          : "Không thể tải dữ liệu mới. Vui lòng thử lại; bản đang nhập vẫn được giữ nguyên.",
      );
      expect(
        within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
      ).toHaveValue("Bản sửa chưa lưu");
      expect(
        within(dialog).getByRole("alert", { name: "Thông tin đã thay đổi" }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: "Lưu danh mục lỗi" }),
      ).toBeDisabled();
      fireEvent.submit(
        within(dialog)
          .getByRole("textbox", { name: /^Mã lỗi/ })
          .closest("form")!,
      );
      expect(updateDefect).toHaveBeenCalledTimes(1);
      expect(updateDefect).toHaveBeenCalledWith(
        expect.objectContaining({ version: 7 }),
      );
      expect(refetchDefects).toHaveBeenCalledTimes(1);
    },
  );

  it("disables concurrent conflict recovery while the latest record is loading", async () => {
    const user = userEvent.setup();
    let resolveReload!: (value: object) => void;
    refetchDefects.mockImplementationOnce(
      () =>
        new Promise<object>((resolve) => {
          resolveReload = resolve;
        }),
    );
    updateDefect.mockRejectedValueOnce(
      createMockAxiosError({
        status: 412,
        data: { message: "Version changed" },
      }),
    );
    renderScreen();
    const dialog = await openEdit(user);
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
      { target: { value: "Bản sửa cục bộ" } },
    );
    save(dialog);
    await within(dialog).findByRole("alert", { name: "Thông tin đã thay đổi" });
    const reload = within(dialog).getByRole("button", {
      name: "Tải dữ liệu mới",
    });
    await user.click(reload);
    expect(reload).toBeDisabled();
    fireEvent.click(reload);
    expect(refetchDefects).toHaveBeenCalledTimes(1);
    expect(
      within(dialog).getByRole("button", { name: "Lưu danh mục lỗi" }),
    ).toBeDisabled();
    await act(async () => {
      resolveReload({
        data: {
          data: [{ ...RECORD, defect_name: "Bản mới từ máy chủ", version: 8 }],
          meta: { total: 1 },
        },
      });
    });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
      ).toHaveValue("Bản mới từ máy chủ"),
    );
    expect(
      within(dialog).queryByRole("alert", { name: "Thông tin đã thay đổi" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Lưu danh mục lỗi" }),
    ).toBeEnabled();
    expect(updateDefect).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "failure"] as const)(
    "settles pending verification after filters change when the read ends with %s",
    async (outcome) => {
      const user = userEvent.setup();
      let resolveRead!: (value: object) => void;
      let rejectRead!: (reason: Error) => void;
      refetchDefects.mockImplementationOnce(
        () =>
          new Promise<object>((resolve, reject) => {
            resolveRead = resolve;
            rejectRead = reject;
          }),
      );
      createDefect.mockRejectedValueOnce(
        Object.assign(new Error("Timed out"), { code: "ECONNABORTED" }),
      );
      renderScreen();
      const dialog = await openCreate(user);
      fillCreate(dialog);
      save(dialog);
      await within(dialog).findByRole("alert", {
        name: "Chưa xác định được kết quả lưu",
      });
      await user.click(
        within(dialog).getByRole("button", { name: "Kiểm tra kết quả" }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      const check = screen.getByRole("button", { name: "Kiểm tra kết quả" });
      expect(check).toBeDisabled();
      fireEvent.change(screen.getByRole("textbox", { name: "Tìm lỗi/bệnh" }), {
        target: { value: "different-code" },
      });
      await user.click(
        screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
      );
      await user.click(screen.getByRole("option", { name: "Ngừng sử dụng" }));
      await act(async () => {
        if (outcome === "success")
          resolveRead({ data: { data: [], meta: { total: 0 } } });
        else rejectRead(new Error("Verification interrupted"));
      });
      await waitFor(() => expect(check).toBeEnabled());
      expect(queryDefects).toHaveBeenLastCalledWith({
        keyword: "different-code",
        status: "INACTIVE",
        page: 1,
        per_page: 15,
      });
      expect(refetchDefects).toHaveBeenCalledTimes(1);
      expect(createDefect).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["closed", "replaced"] as const)(
    "ignores a late recovery response after the original editor is %s",
    async (state) => {
      const user = userEvent.setup();
      let resolveRead!: (value: object) => void;
      refetchDefects.mockImplementationOnce(
        () =>
          new Promise<object>((resolve) => {
            resolveRead = resolve;
          }),
      );
      updateDefect.mockRejectedValueOnce(
        createMockAxiosError({
          status: 412,
          data: { message: "Version changed" },
        }),
      );
      renderScreen();
      const dialog = await openEdit(user);
      fireEvent.change(
        within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
        { target: { value: "Bản sửa cục bộ" } },
      );
      save(dialog);
      await within(dialog).findByRole("alert", {
        name: "Thông tin đã thay đổi",
      });
      await user.click(
        within(dialog).getByRole("button", { name: "Tải dữ liệu mới" }),
      );
      expect(
        within(dialog).getByRole("textbox", { name: /^Tên lỗi \/ bệnh/ }),
      ).toBeDisabled();
      await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
      const confirmation = await screen.findByRole("dialog", {
        name: "Bạn có thay đổi chưa lưu",
      });
      await user.click(
        within(confirmation).getByRole("button", { name: "Bỏ thay đổi" }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      let replacement: HTMLElement | undefined;
      if (state === "replaced") {
        replacement = await openCreate(user);
        fillCreate(replacement);
      }
      await act(async () => {
        resolveRead({
          data: {
            data: [{ ...RECORD, defect_name: "Late server value", version: 8 }],
            meta: { total: 1 },
          },
        });
      });
      if (replacement) {
        expect(
          within(replacement).getByRole("textbox", { name: /^Mã lỗi/ }),
        ).toHaveValue(" NEW_DEFECT ");
        expect(
          within(replacement).getByRole("textbox", {
            name: /^Tên lỗi \/ bệnh/,
          }),
        ).toHaveValue(" Lỗi mới ");
        expect(
          within(replacement).getByRole("textbox", { name: /^Mã lỗi/ }),
        ).toBeEnabled();
        expect(screen.getByRole("dialog", { name: /^Thêm lỗi \/ bệnh/ })).toBe(
          replacement,
        );
      } else expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(updateDefect).toHaveBeenCalledTimes(1);
      expect(createDefect).not.toHaveBeenCalled();
    },
  );

  it("retries a known failed save through the same validated form payload", async () => {
    const user = userEvent.setup();
    createDefect.mockRejectedValueOnce(
      createMockAxiosError({
        status: 400,
        data: { message: "Không thể lưu thông tin." },
      }),
    );
    renderScreen();
    const dialog = await openCreate(user);
    fillCreate(dialog);
    save(dialog);
    await within(dialog).findByRole("alert", {
      name: "Không thể lưu bệnh/lỗi",
    });
    expect(createDefect).toHaveBeenCalledTimes(1);
    await user.click(
      within(dialog).getByRole("button", { name: "Thử lưu lại" }),
    );
    await waitFor(() => expect(createDefect).toHaveBeenCalledTimes(2));
    expect(createDefect).toHaveBeenLastCalledWith({
      defect_code: "NEW_DEFECT",
      defect_name: "Lỗi mới",
      description: null,
      status: "ACTIVE",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(updateDefect).not.toHaveBeenCalled();
  });
});
