import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";
import type {
  OutboundDocumentRecord,
  OutboundStatus,
} from "@/modules/outbound/services/alignedOutboundService";

const mocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  fetchOutboundDocuments: vi.fn(),
  invalidateStockDerived: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/shared/components/permission", () => ({
  useHasPermission: () => mocks.can,
}));
vi.mock("@/modules/outbound/services/alignedOutboundService", () => ({
  fetchOutboundDocuments: mocks.fetchOutboundDocuments,
}));
vi.mock("@/shared/cache/invalidation", () => ({
  invalidateStockDerived: mocks.invalidateStockDerived,
}));
vi.mock("@/shared/data/reference-queries", () => ({
  useActiveWarehouses: () => ({
    data: [{ id: "WH-1", name: "Kho Hoa Nam", code: "WH01" }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/modules/outbound/components/OutboundOverview", () => ({
  OutboundOverview: () => <section aria-label="Tổng quan kiểm thử" />,
}));
vi.mock("@/modules/outbound/components/OutboundIntakeModal", () => ({
  OutboundIntakeModal: ({
    onClose,
    onConsumed,
  }: {
    onClose: () => void;
    onConsumed: (documentIds: string[]) => void;
  }) => (
    <div role="dialog" aria-label="Tiếp nhận kiểm thử">
      <button type="button" onClick={onClose}>
        Đóng tiếp nhận
      </button>
      <button
        type="button"
        onClick={() => onConsumed(["OUT-NEW", "OUT-SECOND"])}
      >
        Xác nhận tiếp nhận kiểm thử
      </button>
    </div>
  ),
}));
vi.mock("@/modules/outbound/components/AlignedOutboundDetailModal", () => ({
  AlignedOutboundDetailModal: ({
    documentId,
    onClose,
    onChanged,
  }: {
    documentId: string;
    onClose: () => void;
    onChanged: () => void;
  }) => (
    <div role="dialog" aria-label="Chi tiết kiểm thử">
      <span>{documentId}</span>
      <button type="button" onClick={onClose}>
        Đóng chi tiết
      </button>
      <button type="button" onClick={onChanged}>
        Cập nhật phiếu kiểm thử
      </button>
    </div>
  ),
}));

import AlignedMvpOutboundPage from "./AlignedMvpOutboundPage";

type ListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  sortOrder?: "asc" | "desc";
};
const STATUSES: OutboundStatus[] = ["CANCELLED", "DRAFT", "SCANNING", "POSTED"];
const ROWS: OutboundDocumentRecord[] = Array.from(
  { length: 23 },
  (_, index) => {
    const number = index + 1;
    return {
      id: `OUT-${number}`,
      code: `PX-${String(number).padStart(3, "0")}`,
      date: "2026-09-20T09:00:00+07:00",
      warehouseId: "WH-1",
      outboundRequestId: `REQ-${number}`,
      requestNo: `YCX-${number}`,
      recipientName:
        number === 23
          ? "Đại lý trang sau"
          : number % 3 === 0
            ? "Đại lý A"
            : "Đại lý B",
      recipientAddress: "Hà Nội",
      note: number % 2 === 0 ? "giao gấp" : "giao thường",
      expected: 10,
      scanned: number % 4 === 3 ? 10 : 2,
      status: STATUSES[number % 4],
      version: 1,
      createdBy: "Nhân viên kho",
    };
  },
);
function listResult(params: ListParams) {
  const matching = ROWS.filter(
    (row) =>
      (!params.status || row.status === params.status) &&
      (!params.search || `${row.code} ${row.note}`.includes(params.search)),
  );
  const ordered = params.sortOrder === "asc" ? matching.toReversed() : matching;
  const page = params.page ?? 1;
  const size = params.per_page ?? 10;
  const offset = (page - 1) * size;
  return {
    data: ordered.slice(offset, offset + size),
    meta: {
      total: ordered.length,
      current_page: page,
      per_page: size,
      last_page: Math.max(1, Math.ceil(ordered.length / size)),
    },
  };
}
function LocationState() {
  return <output aria-label="Địa chỉ hiện tại">{useLocation().search}</output>;
}
function renderPage(entry = "/outbound?screen=OUT-01") {
  return renderWithProviders(
    <>
      <AlignedMvpOutboundPage />
      <LocationState />
    </>,
    [entry],
  );
}
async function selectOption(label: string, name: string) {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name }));
}
async function selectRecipient(name: string) {
  const input = screen.getByRole("combobox", { name: "Lọc người nhận" });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name }));
}
async function settleInitialSearchTimer() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 270));
  });
}
function dataRows() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

beforeEach(() => {
  mocks.can.mockReset().mockReturnValue(true);
  mocks.fetchOutboundDocuments
    .mockReset()
    .mockImplementation((params: ListParams) =>
      Promise.resolve(listResult(params)),
    );
  mocks.invalidateStockDerived.mockClear();
  vi.spyOn(window.history, "back").mockImplementation(() => {});
  window.history.replaceState({}, "");
});
afterEach(() => {
  cleanup();
  cleanupTestState();
  vi.restoreAllMocks();
});

describe("OUT-01 · list controls and filtering", () => {
  it("keeps sorting tooltips and the sort cycle for responsive visual column labels", async () => {
    renderPage();
    await screen.findByText("PX-001");
    const code = screen.getByRole("button", {
      name: "Nhấp để sắp xếp theo Phiếu xuất A → Z",
    });
    expect(code).toHaveTextContent("Phiếu / Toa");
    expect(
      screen.getByRole("button", {
        name: "Nhấp để sắp xếp theo Người nhận A → Z",
      }),
    ).toHaveTextContent("Người nhận / Ngày");

    fireEvent.mouseOver(code);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Nhấp để sắp xếp theo Phiếu xuất A → Z",
    );
    fireEvent.click(code);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "Nhấp để sắp xếp theo Phiếu xuất Z → A",
      );
      expect(code).toHaveAttribute("aria-sort", "ascending");
    });
    fireEvent.click(code);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "Nhấp để bỏ sắp xếp Phiếu xuất",
      );
      expect(code).toHaveAttribute("aria-sort", "descending");
      expect(dataRows()[0]).toHaveTextContent("PX-010");
    });
    fireEvent.click(code);
    expect(code).toHaveAttribute("aria-sort", "none");
    expect(dataRows()[0]).toHaveTextContent("PX-001");
  });

  it("debounces and trims the search before requesting matching documents", async () => {
    renderPage();
    await screen.findByText("PX-001");
    const count = mocks.fetchOutboundDocuments.mock.calls.length;

    fireEvent.change(screen.getByRole("textbox", { name: "Tìm phiếu xuất" }), {
      target: { value: "   giao gấp   " },
    });
    expect(mocks.fetchOutboundDocuments).toHaveBeenCalledTimes(count);
    await waitFor(() => {
      expect(mocks.fetchOutboundDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "giao gấp", page: 1 }),
      );
    });
    await waitFor(() =>
      expect(screen.queryByText("PX-001")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("PX-002")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Xóa từ khóa tìm kiếm" }),
    );
    await waitFor(() => {
      expect(mocks.fetchOutboundDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined, page: 1 }),
      );
    });
    expect(screen.getByRole("textbox", { name: "Tìm phiếu xuất" })).toHaveValue(
      "",
    );
  });

  it("applies typed search immediately and allows refreshing an unchanged filter", async () => {
    renderPage();
    await screen.findByText("PX-001");
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm phiếu xuất" }), {
      target: { value: "PX-023" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(mocks.fetchOutboundDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "PX-023", page: 1 }),
    );
    await screen.findByText("PX-023");
    const beforeRefresh = mocks.fetchOutboundDocuments.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => {
      expect(mocks.fetchOutboundDocuments).toHaveBeenCalledTimes(
        beforeRefresh + 1,
      );
    });
  });

  it("filters status and resets search, status, recipient and server ordering", async () => {
    renderPage();
    await screen.findByText("PX-001");
    await selectRecipient("Đại lý A");
    await selectOption("Lọc trạng thái phiếu xuất", "Đang quét xuất hàng");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Áp dụng" })).toBeEnabled();
      expect(dataRows()).toHaveLength(2);
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm phiếu xuất" }), {
      target: { value: "giao gấp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => {
      expect(mocks.fetchOutboundDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "giao gấp", status: "SCANNING" }),
      );
      expect(screen.getByRole("button", { name: "Áp dụng" })).toBeEnabled();
    });
    await selectOption("Sắp xếp danh sách phiếu xuất", "Cũ nhất");
    await waitFor(() => {
      expect(dataRows()).toHaveLength(2);
      expect(screen.getByText("PX-006")).toBeInTheDocument();
      expect(screen.getByText("PX-018")).toBeInTheDocument();
      expect(mocks.fetchOutboundDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "giao gấp",
          status: "SCANNING",
          sortOrder: "asc",
          per_page: 100,
        }),
      );
      expect(screen.getByRole("button", { name: "Áp dụng" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    await screen.findByText("PX-001");
    expect(screen.getByRole("textbox", { name: "Tìm phiếu xuất" })).toHaveValue(
      "",
    );
    expect(
      screen.getByRole("combobox", { name: "Lọc người nhận" }),
    ).toHaveValue("");
    expect(
      screen.getByLabelText("Lọc trạng thái phiếu xuất"),
    ).toHaveTextContent("Tất cả");
    expect(mocks.fetchOutboundDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: undefined,
        status: undefined,
        sortOrder: "desc",
        page: 1,
        per_page: 10,
      }),
    );
  });

  it("changes server pages and resets to page one when the page size changes", async () => {
    renderPage();
    await screen.findByText("PX-001");
    await settleInitialSearchTimer();
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    await screen.findByText("PX-011");
    expect(screen.getByText("Hiển thị 11 – 20 / 23 phiếu")).toBeInTheDocument();
    expect(mocks.fetchOutboundDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, per_page: 10 }),
    );

    await selectOption("Số dòng mỗi trang", "20 / trang");
    await screen.findByText("PX-001");
    expect(dataRows()).toHaveLength(20);
    expect(screen.getByText("Hiển thị 1 – 20 / 23 phiếu")).toBeInTheDocument();
    expect(mocks.fetchOutboundDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, per_page: 20 }),
    );
  });

  it("loads recipients only when used and selects a recipient absent from the current page", async () => {
    renderPage();
    await screen.findByText("PX-001");
    expect(mocks.fetchOutboundDocuments).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Đại lý trang sau")).not.toBeInTheDocument();

    await selectRecipient("Đại lý trang sau");
    await screen.findByText("PX-023");
    expect(dataRows()).toHaveLength(1);
    expect(screen.getByText("Hiển thị 1 – 1 / 1 phiếu")).toBeInTheDocument();
    expect(mocks.fetchOutboundDocuments).toHaveBeenCalledWith({
      page: 1,
      per_page: 100,
    });
    expect(screen.queryByText("PX-001")).not.toBeInTheDocument();
  });

  it("offers a working retry when the recipient index fails", async () => {
    mocks.fetchOutboundDocuments.mockImplementation((params: ListParams) =>
      params.per_page === 100
        ? Promise.reject(new Error("unavailable"))
        : Promise.resolve(listResult(params)),
    );
    renderPage();
    await screen.findByText("PX-001");
    fireEvent.focus(screen.getByRole("combobox", { name: "Lọc người nhận" }));
    const retry = await screen.findByRole("button", {
      name: "Thử lại danh sách người nhận",
    });
    mocks.fetchOutboundDocuments.mockImplementation((params: ListParams) =>
      Promise.resolve(listResult(params)),
    );
    fireEvent.click(retry);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Thử lại danh sách người nhận" }),
      ).not.toBeInTheDocument();
    });
    await selectRecipient("Đại lý trang sau");
    await screen.findByText("PX-023");
  });
});

describe("OUT-01 · preserved outbound overlays", () => {
  it("consumes intake, opens the first resulting document and invalidates stock-derived data", async () => {
    renderPage();
    await screen.findByText("PX-001");
    fireEvent.click(
      screen.getByRole("button", { name: "Tiếp nhận yêu cầu xuất" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Tiếp nhận kiểm thử" }),
    ).toBeInTheDocument();
    const requestsBefore = mocks.fetchOutboundDocuments.mock.calls.length;
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận tiếp nhận kiểm thử" }),
    );

    expect(
      screen.queryByRole("dialog", { name: "Tiếp nhận kiểm thử" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Chi tiết kiểm thử" }),
    ).toHaveTextContent("OUT-NEW");
    expect(
      screen.getByRole("dialog", { name: "Chi tiết kiểm thử" }),
    ).not.toHaveTextContent("OUT-SECOND");
    expect(mocks.invalidateStockDerived).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mocks.fetchOutboundDocuments).toHaveBeenCalledTimes(
        requestsBefore + 1,
      );
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Cập nhật phiếu kiểm thử" }),
    );
    expect(mocks.invalidateStockDerived).toHaveBeenCalledTimes(2);
  });

  it.each(["OUT-03", "OUT-02", "LBL-01", "RFID-01"])(
    "opens and consumes the %s detail deep link while preserving other search parameters",
    async (detailScreen) => {
      renderPage(`/outbound?screen=${detailScreen}&id=OUT-DEEP&context=keep`);
      expect(
        await screen.findByRole("dialog", { name: "Chi tiết kiểm thử" }),
      ).toHaveTextContent("OUT-DEEP");
      expect(screen.getByLabelText("Địa chỉ hiện tại")).toHaveTextContent(
        "?screen=OUT-01&context=keep",
      );
      expect(screen.getByLabelText("Địa chỉ hiện tại")).not.toHaveTextContent(
        "id=",
      );
    },
  );

  it("opens the intake deep link and browser Back dismisses it on the list route", async () => {
    renderPage("/outbound?screen=OUT-REQ-01");
    expect(
      await screen.findByRole("dialog", { name: "Tiếp nhận kiểm thử" }),
    ).toBeInTheDocument();
    expect(window.history.state).toEqual(
      expect.objectContaining({ wmsOverlay: "OUT-01-overlay" }),
    );
    fireEvent.popState(window, { state: {} });
    expect(
      screen.queryByRole("dialog", { name: "Tiếp nhận kiểm thử" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Địa chỉ hiện tại")).toHaveTextContent(
      "?screen=OUT-01",
    );
  });

  it("opens the selected row and consumes its overlay entry when closing", async () => {
    renderPage();
    const code = await screen.findByText("PX-001");
    fireEvent.click(
      within(code.closest("tr")!).getByRole("button", { name: "Mở" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Chi tiết kiểm thử" }),
    ).toHaveTextContent("OUT-1");
    fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết" }));
    expect(
      screen.queryByRole("dialog", { name: "Chi tiết kiểm thử" }),
    ).not.toBeInTheDocument();
    expect(window.history.back).toHaveBeenCalledTimes(1);
  });
});
