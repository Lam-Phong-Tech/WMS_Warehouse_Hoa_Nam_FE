import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/shared/store/auth.store";
import SupplierListPage from "./SupplierListPage";
import {
  createSupplier,
  listSuppliers,
  updateSupplier,
} from "../services/supplier.service";

vi.mock("../services/supplier.service", () => ({
  listSuppliers: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}));
const row = {
  id: "supplier-1",
  code: "NCC-001",
  name: "Honda",
  status: "ACTIVE" as const,
  version: 4,
  updated_at: "2026-11-08T01:00:00+07:00",
  display_name: "NCC-001 - Honda",
  code_status: "ASSIGNED" as const,
};
function setup(
  permissions = ["supplier.view", "supplier.create", "supplier.update"],
) {
  useAuthStore.setState({
    permissionCodes: permissions,
    isSuperAdmin: false,
    isProfileLoaded: true,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SupplierListPage />
    </QueryClientProvider>,
  );
  return client;
}
describe("supplier list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSuppliers).mockResolvedValue({
      rows: [row],
      page: 1,
      perPage: 20,
      total: 1,
      lastPage: 1,
    });
    vi.mocked(createSupplier).mockResolvedValue(row);
    vi.mocked(updateSupplier).mockResolvedValue({
      ...row,
      name: "New name",
      version: 5,
    });
  });
  it("renders SKU-style columns and creates using an automatic code", async () => {
    setup();
    expect(await screen.findByText("Honda")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Danh sách NCC" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thêm NCC" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Mã NCC")).toHaveValue(
      "Tự động cấp khi lưu",
    );
    fireEvent.change(within(dialog).getByLabelText(/Tên nhà cung cấp/), {
      target: { value: "  New supplier  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu NCC" }));
    await waitFor(() =>
      expect(createSupplier).toHaveBeenCalledWith({
        name: "New supplier",
        status: "ACTIVE",
      }),
    );
  });
  it("edits the server UUID/version, preserving the read-only code", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa NCC-001" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Mã NCC")).toHaveAttribute("readonly");
    fireEvent.change(within(dialog).getByLabelText(/Tên nhà cung cấp/), {
      target: { value: "New name" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );
    await waitFor(() =>
      expect(updateSupplier).toHaveBeenCalledWith("supplier-1", 4, {
        name: "New name",
        status: "ACTIVE",
      }),
    );
  });
  it("preserves draft and blocks stale resubmission after 412", async () => {
    vi.mocked(updateSupplier).mockRejectedValue({
      response: { status: 412 },
      isAxiosError: true,
    });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa NCC-001" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Tên nhà cung cấp/), {
      target: { value: "My draft" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );
    expect(
      await within(dialog).findByText(/đã được thay đổi bởi người khác/),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Tên nhà cung cấp/)).toHaveValue(
      "My draft",
    );
    expect(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    ).toBeDisabled();
  });
  it("supports read-only access and does not fetch for unauthorized users", async () => {
    const client = setup(["supplier.view"]);
    await screen.findByText("Honda");
    expect(
      screen.queryByRole("button", { name: "Thêm NCC" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sửa NCC-001" }),
    ).not.toBeInTheDocument();
    client.clear();
  });
  it("shows list errors with retry instead of an empty table", async () => {
    vi.mocked(listSuppliers).mockRejectedValue(new Error("Network"));
    setup();
    expect(
      await screen.findByRole("button", { name: "Thử lại" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chưa có nhà cung cấp")).not.toBeInTheDocument();
  });
  it("does not read the directory when the user lacks supplier.view", () => {
    setup(["catalog.manage"]);
    expect(screen.getByRole("alert")).toHaveTextContent("không có quyền");
    expect(listSuppliers).not.toHaveBeenCalled();
  });
  it("allows create without edit and edit without create", async () => {
    setup(["supplier.view", "supplier.create"]);
    await screen.findByText("Honda");
    expect(
      screen.getByRole("button", { name: "Thêm NCC" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sửa NCC-001" }),
    ).not.toBeInTheDocument();
    act(() =>
      useAuthStore.setState({
        permissionCodes: ["supplier.view", "supplier.update"],
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Sửa NCC-001" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Thêm NCC" }),
    ).not.toBeInTheDocument();
  });
  it("validates blank names before creating", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Thêm NCC" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Tên nhà cung cấp/), {
      target: { value: "  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu NCC" }));
    expect(
      await within(dialog).findByText("Nhập tên nhà cung cấp."),
    ).toBeInTheDocument();
    expect(createSupplier).not.toHaveBeenCalled();
  });
  it("blocks duplicate creation after an ambiguous network result", async () => {
    vi.mocked(createSupplier).mockRejectedValue(
      new Error("Network disconnected"),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Thêm NCC" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Tên nhà cung cấp/), {
      target: { value: "Ambiguous supplier" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu NCC" }));
    expect(
      await within(dialog).findByText(/tránh tạo trùng/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Lưu NCC" }),
    ).toBeDisabled();
    expect(createSupplier).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByLabelText(/Tên nhà cung cấp/)).toHaveValue(
      "Ambiguous supplier",
    );
  });
  it("changes the server status filter without duplicate choices", async () => {
    setup();
    await screen.findByText("Honda");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Trạng thái" }));
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("option", { name: "Trạng thái: Ngừng hoạt động" }),
    );
    await waitFor(() =>
      expect(listSuppliers).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "INACTIVE", page: 1 }),
        expect.anything(),
      ),
    );
  });
  it("resets the server page when searching", async () => {
    setup();
    await screen.findByText("Honda");
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm kiếm NCC" }), {
      target: { value: "Kubota" },
    });
    await waitFor(() =>
      expect(listSuppliers).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "Kubota", page: 1 }),
        expect.anything(),
      ),
    );
  });
});
