import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { cleanupTestState } from "@/test/setup";
import {
  cleanupCreatedQueryClients,
  renderWithProviders,
} from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import type { ReversalDocument } from "../types";

// Exercise the real list query and its invalidation; lifecycle validation and
// mutation contracts are covered by the real create/detail modal suites.
vi.mock("@/modules/reverse/services/reversalService", async () => ({
  ...(await vi.importActual<
    typeof import("@/modules/reverse/services/reversalService")
  >("@/modules/reverse/services/reversalService")),
  fetchReversalDocuments: vi.fn(),
}));
vi.mock("@/modules/reverse/components/ReversalCreateModal", () => ({
  ReversalCreateModal: ({
    onClose,
    onCreated,
  }: {
    onClose: () => void;
    onCreated: (code: string, id: string) => void;
  }) => (
    <div role="dialog" aria-label="Tạo phiếu kiểm thử">
      <button type="button" onClick={onClose}>
        Đóng tạo phiếu
      </button>
      <button
        type="button"
        onClick={() => onCreated("REV-NEW", "reversal-new")}
      >
        Hoàn thành tạo phiếu kiểm thử
      </button>
    </div>
  ),
}));
vi.mock("@/modules/reverse/components/ReversalDetailModal", () => ({
  ReversalDetailModal: ({
    documentId,
    onClose,
  }: {
    documentId: string;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Chi tiết phiếu kiểm thử">
      <span>{documentId}</span>
      <button type="button" onClick={onClose}>
        Đóng chi tiết phiếu
      </button>
    </div>
  ),
}));

import { fetchReversalDocuments } from "../services/reversalService";
import ReversalPage from "./ReversalPage";

const DOCUMENT: ReversalDocument = {
  id: "reversal-existing",
  reversal_code: "REV-20260923-001",
  status: "DRAFT",
  physical_return_status: "PENDING_RETURN",
  reference_document_type: "OUTBOUND",
  reference_document_code: "OUT-20260922-018",
  reference_document_id: "outbound-existing",
  warehouse_id: "warehouse-1",
  warehouse_name: "Kho Hoa Nam",
  total_lines: 2,
  total_qty: 3,
  reason: "Khách hàng trả lại hàng",
  created_at: "2026-09-23T09:00:00+07:00",
  created_by: "Nguyễn Văn A",
  version: 4,
};
const initialAuth = {
  isSuperAdmin: useAuthStore.getState().isSuperAdmin,
  permissionCodes: useAuthStore.getState().permissionCodes,
};

function listResult(params: Record<string, unknown> = {}) {
  return {
    rows: [DOCUMENT],
    meta: {
      current_page: Number(params.page ?? 1),
      per_page: Number(params.per_page ?? 10),
      total: 42,
    },
  };
}
function LocationState() {
  const location = useLocation();
  return <output aria-label="Địa chỉ hiện tại">{location.search}</output>;
}
function renderPage(entry = "/reverse?screen=REV-00") {
  return renderWithProviders(
    <>
      <ReversalPage />
      <LocationState />
    </>,
    [entry],
  );
}
function expectLatestRequest(fields: Record<string, unknown>) {
  expect(fetchReversalDocuments).toHaveBeenLastCalledWith(
    expect.objectContaining(fields),
  );
}
async function selectOption(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  vi.mocked(fetchReversalDocuments).mockReset();
  vi.mocked(fetchReversalDocuments).mockImplementation(async (params) =>
    listResult(params),
  );
  useAuthStore.setState({
    isSuperAdmin: false,
    permissionCodes: [P.INVENTORY_VIEW, P.REVERSAL_POST],
  });
});
afterEach(() => {
  cleanup();
  cleanupTestState();
  cleanupCreatedQueryClients();
  useAuthStore.setState(initialAuth);
});

describe("REV-00 preserved list interactions", () => {
  it("debounces and trims keyword, then resets the page while retaining the status filter", async () => {
    renderPage();
    await screen.findByText(DOCUMENT.reversal_code);
    await selectOption(
      "Lọc trạng thái phiếu điều chỉnh",
      "Đã ghi sổ phiếu đảo",
    );
    await waitFor(() => expectLatestRequest({ status: "POSTED", page: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expectLatestRequest({ page: 2 }));

    const search = screen.getByRole("textbox", { name: "Tìm phiếu đảo" });
    fireEvent.change(search, { target: { value: "  REV-20260923  " } });
    expectLatestRequest({ keyword: undefined });
    await waitFor(() =>
      expectLatestRequest({
        keyword: "REV-20260923",
        status: "POSTED",
        page: 1,
      }),
    );

    fireEvent.change(search, { target: { value: "   " } });
    await waitFor(() =>
      expectLatestRequest({ keyword: undefined, status: "POSTED", page: 1 }),
    );
  });

  it("sends server pagination and resets the page when status or page size changes", async () => {
    renderPage();
    await screen.findByText(DOCUMENT.reversal_code);
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expectLatestRequest({ page: 2, per_page: 10 }));
    await selectOption("Lọc trạng thái phiếu điều chỉnh", "Nháp");
    await waitFor(() =>
      expectLatestRequest({ status: "DRAFT", page: 1, per_page: 10 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expectLatestRequest({ page: 2 }));
    await selectOption("Số dòng mỗi trang", "20 / trang");
    await waitFor(() =>
      expectLatestRequest({ status: "DRAFT", page: 1, per_page: 20 }),
    );
  });

  it("keeps list/detail access for a reader and hides creation", async () => {
    useAuthStore.setState({ permissionCodes: [P.INVENTORY_VIEW] });
    renderPage();
    await screen.findByText(DOCUMENT.reversal_code);
    expect(screen.getByTestId("reversal-readonly-note")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tạo phiếu điều chỉnh" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở" }));
    expect(
      screen.getByRole("dialog", { name: "Chi tiết phiếu kiểm thử" }),
    ).toHaveTextContent(DOCUMENT.id);
  });

  it("opens the selected document from its row and supports closing the detail", async () => {
    renderPage();
    fireEvent.click(await screen.findByText(DOCUMENT.reversal_code));
    expect(
      screen.getByRole("dialog", { name: "Chi tiết phiếu kiểm thử" }),
    ).toHaveTextContent(DOCUMENT.id);
    fireEvent.click(
      screen.getByRole("button", { name: "Đóng chi tiết phiếu" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(DOCUMENT.reversal_code)).toBeInTheDocument();
  });

  it("refreshes the live list after creation and opens the new document for evidence/completion", async () => {
    renderPage();
    await screen.findByText(DOCUMENT.reversal_code);
    const requestsBeforeCreate = vi.mocked(fetchReversalDocuments).mock.calls
      .length;
    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu điều chỉnh" }),
    );
    const createDialog = screen.getByRole("dialog", {
      name: "Tạo phiếu kiểm thử",
    });
    fireEvent.click(
      within(createDialog).getByRole("button", {
        name: "Hoàn thành tạo phiếu kiểm thử",
      }),
    );
    expect(
      screen.queryByRole("dialog", { name: "Tạo phiếu kiểm thử" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Chi tiết phiếu kiểm thử" }),
    ).toHaveTextContent("reversal-new");
    await waitFor(() =>
      expect(
        vi.mocked(fetchReversalDocuments).mock.calls.length,
      ).toBeGreaterThan(requestsBeforeCreate),
    );
  });

  it.each([
    ["REV-01", "Tạo phiếu kiểm thử"],
    ["REV-02", "Chi tiết phiếu kiểm thử"],
  ])(
    "consumes a %s deep link without dropping unrelated URL parameters",
    async (screenId, dialogName) => {
      renderPage(
        `/reverse?screen=${screenId}&id=reversal-deep&source=inventory`,
      );
      const dialog = await screen.findByRole("dialog", { name: dialogName });
      if (screenId === "REV-02")
        expect(dialog).toHaveTextContent("reversal-deep");
      const location = screen.getByLabelText("Địa chỉ hiện tại");
      expect(location).toHaveTextContent("screen=REV-00");
      expect(location).toHaveTextContent("source=inventory");
      expect(location).not.toHaveTextContent("id=");
    },
  );

  it("retries a failed list request and recovers the server rows", async () => {
    vi.mocked(fetchReversalDocuments).mockRejectedValueOnce(
      new Error("Mất kết nối tạm thời"),
    );
    renderPage();
    expect(
      await screen.findByText("Không tải được danh sách phiếu điều chỉnh"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText(DOCUMENT.reversal_code)).toBeInTheDocument();
    expect(fetchReversalDocuments).toHaveBeenCalledTimes(2);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });
});
