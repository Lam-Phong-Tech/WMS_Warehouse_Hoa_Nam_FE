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
import { renderWithProviders } from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import type { InboundDocument } from "@/modules/inbound/types";

vi.mock("@/modules/inbound/hooks/use-inbound", () => ({
  useInboundDocuments: vi.fn(),
}));
vi.mock("@/shared/data/reference-queries", () => ({
  useActiveWarehouses: () => ({
    data: [{ id: "WH-1", name: "Kho Hoa Nam", code: "WH01" }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/modules/inbound/components/InboundOverview", () => ({
  InboundOverview: ({ onRefresh }: { onRefresh: () => void }) => (
    <button type="button" onClick={onRefresh}>
      Đồng bộ danh sách kiểm thử
    </button>
  ),
}));
vi.mock("@/modules/inbound/components/InboundDraftModal", () => ({
  InboundDraftModal: ({
    documentId,
    onClose,
    onSaved,
  }: {
    documentId: string | null;
    onClose: () => void;
    onSaved: (id: string) => void;
  }) => (
    <div role="dialog" aria-label="Phiếu nháp kiểm thử">
      <span>{documentId ?? "Phiếu mới"}</span>
      <button type="button" onClick={onClose}>
        Đóng phiếu nháp
      </button>
      <button type="button" onClick={() => onSaved(documentId ?? "IN-NEW")}>
        Lưu phiếu kiểm thử
      </button>
    </div>
  ),
}));
vi.mock("@/modules/inbound/pages/MvpInboundScreens", () => ({
  InboundScanModal: ({
    documentId,
    onClose,
    onChanged,
  }: {
    documentId: string;
    onClose: () => void;
    onChanged: () => void;
  }) => (
    <div role="dialog" aria-label="Nhận hàng kiểm thử">
      <span>{documentId}</span>
      <button type="button" onClick={onClose}>
        Đóng nhận hàng
      </button>
      <button type="button" onClick={onChanged}>
        Cập nhật nhận hàng
      </button>
    </div>
  ),
}));

import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import InboundPage from "./InboundPage";

function receipt(
  id: string,
  status: InboundDocument["status"],
): InboundDocument {
  return {
    id,
    code: `PN-${id}`,
    source: "Nhà cung cấp A",
    date: "2026-09-10T09:00:00+07:00",
    warehouseId: "WH-1",
    expected: 5,
    scanned: 5,
    skuCount: 2,
    posted: status === "POSTED" ? 5 : 0,
    remaining: 0,
    status,
    createdBy: "Nguyễn Văn A",
    updatedAt: "2026-09-10T10:00:00+07:00",
    note: "Kiểm tra bao bì khi nhận",
    version: 1,
    pendingProductInfo: false,
    pendingProductInfoCount: 0,
  };
}
const ROWS = [
  receipt("DRAFT", "DRAFT"),
  receipt("SCANNING", "SCANNING"),
  receipt("POSTED", "POSTED"),
];
const refetch = vi.fn();
let queryOverrides: Record<string, unknown>;
const initialAuth = useAuthStore.getState();

beforeEach(() => {
  queryOverrides = {};
  refetch.mockResolvedValue({});
  vi.spyOn(window.history, "back").mockImplementation(() => {});
  window.history.replaceState({}, "");
  useAuthStore.setState({
    permissionCodes: [P.INBOUND_CREATE, P.INBOUND_SCAN, P.INBOUND_VIEW],
    isSuperAdmin: false,
  });
  vi.mocked(useInboundDocuments).mockImplementation(
    (params) =>
      ({
        data: {
          data: ROWS,
          meta: { current_page: params.page ?? 1, total: 23, last_page: 3 },
        },
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch,
        ...queryOverrides,
      }) as unknown as ReturnType<typeof useInboundDocuments>,
  );
});

afterEach(() => {
  cleanup();
  cleanupTestState();
  useAuthStore.setState(initialAuth);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function row(id: string) {
  return within(
    screen.getByRole("button", { name: `PN-${id}` }).closest("tr")!,
  );
}
function LocationState() {
  const location = useLocation();
  return <output aria-label="Địa chỉ hiện tại">{location.search}</output>;
}
function renderPage(entry = "/inbound?screen=IN-01") {
  return renderWithProviders(
    <>
      <InboundPage />
      <LocationState />
    </>,
    [entry],
  );
}
function expectLatestQuery(fields: Record<string, unknown>) {
  expect(useInboundDocuments).toHaveBeenLastCalledWith(
    expect.objectContaining(fields),
  );
}

describe("IN-01 · preserved receipt actions", () => {
  it("creates a receipt then opens the saved receipt for scanning", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu nhập" }));
    expect(
      screen.getByRole("dialog", { name: "Phiếu nháp kiểm thử" }),
    ).toHaveTextContent("Phiếu mới");

    fireEvent.click(screen.getByRole("button", { name: "Lưu phiếu kiểm thử" }));
    expect(
      screen.queryByRole("dialog", { name: "Phiếu nháp kiểm thử" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Nhận hàng kiểm thử" }),
    ).toHaveTextContent("IN-NEW");

    fireEvent.click(screen.getByRole("button", { name: "Cập nhật nhận hàng" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("opens DRAFT editing from its primary action and scanning from its overflow", async () => {
    renderPage();
    fireEvent.click(row("DRAFT").getByRole("button", { name: "Chỉnh sửa" }));
    expect(
      screen.getByRole("dialog", { name: "Phiếu nháp kiểm thử" }),
    ).toHaveTextContent("DRAFT");
    fireEvent.click(screen.getByRole("button", { name: "Đóng phiếu nháp" }));

    fireEvent.click(
      row("DRAFT").getByRole("button", { name: "Thao tác khác cho PN-DRAFT" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Bắt đầu quét" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Nhận hàng kiểm thử" }),
    ).toHaveTextContent("DRAFT");
  });

  it("opens SCANNING tracking and keeps edit information available in overflow", async () => {
    renderPage();
    fireEvent.click(row("SCANNING").getByRole("button", { name: "Theo dõi" }));
    expect(
      screen.getByRole("dialog", { name: "Nhận hàng kiểm thử" }),
    ).toHaveTextContent("SCANNING");
    fireEvent.click(screen.getByRole("button", { name: "Đóng nhận hàng" }));

    fireEvent.click(
      row("SCANNING").getByRole("button", {
        name: "Thao tác khác cho PN-SCANNING",
      }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Sửa thông tin" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Phiếu nháp kiểm thử" }),
    ).toHaveTextContent("SCANNING");
  });

  it("opens POSTED details and does not offer an edit action", async () => {
    renderPage();
    fireEvent.click(row("POSTED").getByRole("button", { name: "Chi tiết" }));
    expect(
      screen.getByRole("dialog", { name: "Nhận hàng kiểm thử" }),
    ).toHaveTextContent("POSTED");
    fireEvent.click(screen.getByRole("button", { name: "Đóng nhận hàng" }));

    fireEvent.click(
      row("POSTED").getByRole("button", {
        name: "Thao tác khác cho PN-POSTED",
      }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Xem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Sửa thông tin" }),
    ).not.toBeInTheDocument();
  });

  it("retains view access without create/scan permissions and hides mutating actions", async () => {
    useAuthStore.setState({ permissionCodes: [P.INBOUND_VIEW] });
    renderPage();

    expect(
      screen.queryByRole("button", { name: "Tạo phiếu nhập" }),
    ).not.toBeInTheDocument();
    expect(
      row("DRAFT").queryByRole("button", { name: "Chỉnh sửa" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      row("DRAFT").getByRole("button", { name: "Thao tác khác cho PN-DRAFT" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Xem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Bắt đầu quét" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Sửa thông tin" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Xem" }));
    expect(
      screen.getByRole("dialog", { name: "Nhận hàng kiểm thử" }),
    ).toHaveTextContent("DRAFT");
  });

  it("makes document date, creator and note reachable from the row menu", async () => {
    renderPage();
    fireEvent.click(
      row("DRAFT").getByRole("button", { name: "Thao tác khác cho PN-DRAFT" }),
    );
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveTextContent("Ngày tạo: 10/09/2026 09:00");
    expect(menu).toHaveTextContent("Người tạo: Nguyễn Văn A");
    expect(menu).toHaveTextContent("Ghi chú: Kiểm tra bao bì khi nhận");
  });

  it.each([
    ["IN-02", "Phiếu nháp kiểm thử"],
    ["IN-03", "Nhận hàng kiểm thử"],
  ])(
    "consumes a %s deep link while keeping the target receipt open",
    async (screenId, dialogName) => {
      renderPage(`/inbound?screen=${screenId}&id=IN-DEEP`);
      expect(
        await screen.findByRole("dialog", { name: dialogName }),
      ).toHaveTextContent("IN-DEEP");
      expect(screen.getByLabelText("Địa chỉ hiện tại")).toHaveTextContent(
        "?screen=IN-01",
      );
      expect(screen.getByLabelText("Địa chỉ hiện tại")).not.toHaveTextContent(
        "id=",
      );
    },
  );

  it("dismisses the opened overlay on browser Back", () => {
    renderPage();
    fireEvent.click(row("POSTED").getByRole("button", { name: "Chi tiết" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent(window, new PopStateEvent("popstate", { state: {} }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("IN-01 · filters and live states", () => {
  it("debounces and trims keyword, applies immediately, and clears it on reset", async () => {
    renderPage();
    const search = screen.getByRole("textbox", { name: "Tìm phiếu nhập" });
    fireEvent.change(search, { target: { value: "  NCC A  " } });
    expectLatestQuery({ search: undefined });
    await waitFor(() => expectLatestQuery({ search: "NCC A", page: 1 }));

    fireEvent.change(search, { target: { value: " PN-POSTED " } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expectLatestQuery({ search: "PN-POSTED", page: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(search).toHaveValue("");
    expectLatestQuery({
      search: undefined,
      status: undefined,
      pendingProductInfo: undefined,
      sortOrder: "desc",
      page: 1,
    });
  });

  it("resets pagination when changing filters and page size", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    expectLatestQuery({ page: 2 });
    fireEvent.mouseDown(screen.getByLabelText("Lọc trạng thái phiếu nhập"));
    fireEvent.click(await screen.findByRole("option", { name: "Nháp" }));
    expectLatestQuery({ status: "DRAFT", page: 1 });

    fireEvent.mouseDown(screen.getByLabelText("Số dòng mỗi trang"));
    fireEvent.click(await screen.findByRole("option", { name: "20 / trang" }));
    expectLatestQuery({ per_page: 20, page: 1 });
  });

  it("offers reset after an empty filtered result", async () => {
    queryOverrides = {
      data: { data: [], meta: { total: 0, current_page: 1 } },
    };
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm phiếu nhập" }), {
      target: { value: "không có" },
    });
    expect(
      screen.getByText("Không tìm thấy phiếu nhập phù hợp"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại bộ lọc" }));
    expectLatestQuery({ search: undefined, page: 1 });
  });

  it("retries a failed request and connects overview sync to the same live list", () => {
    queryOverrides = {
      isError: true,
      error: new Error("Network unavailable"),
      data: undefined,
    };
    renderPage();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Đồng bộ danh sách kiểm thử" }),
    );
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});
