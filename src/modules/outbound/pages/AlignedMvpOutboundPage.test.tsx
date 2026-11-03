import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

/**
 * WWHN-209 (review 14186, P1-02/P2-01): unit test gating RBAC cho OUT-01 —
 * trước đây trang outbound không có unit test render nào, chỉ có assertion
 * nội dung nguồn (flow06-packing-label-alignment.test.ts). Test này khoá:
 * 1. Đúng permission code Annex C được hỏi (outbound.import / outbound.scan) —
 *    không phải code ma kiểu outbound.create.
 * 2. Nút "Tiếp nhận yêu cầu xuất" chỉ render khi có outbound.import.
 * 3. Hàng DRAFT/SCANNING chỉ hiện "Mở" khi có outbound.scan; thiếu quyền hoặc
 *    phiếu bất biến (POSTED/CANCELLED) → chỉ "Xem" (read-only, không giả nút).
 * 4. Lỗi tải danh sách render ApiErrorAlert đúng hợp đồng UI_STATE (không màn trắng).
 */

const permissionMocks = vi.hoisted(() => ({
  can: vi.fn((_code: string) => true),
}));

vi.mock("@/shared/components/permission", () => ({
  useHasPermission: () => permissionMocks.can,
}));

const serviceMocks = vi.hoisted(() => ({
  fetchOutboundDocuments: vi.fn(),
}));

vi.mock("@/modules/outbound/services/alignedOutboundService", () => ({
  fetchOutboundDocuments: serviceMocks.fetchOutboundDocuments,
}));

// Cô lập trang OUT-01 khỏi hai overlay nặng (đang được các ticket khác sửa song
// song) — test này chỉ khoá gating của hub, không khoá nghiệp vụ trong modal.
vi.mock("@/modules/outbound/components/AlignedOutboundDetailModal", () => ({
  AlignedOutboundDetailModal: () => (
    <div data-testid="outbound-detail-modal-stub" />
  ),
}));
vi.mock("@/modules/outbound/components/OutboundIntakeModal", () => ({
  OutboundIntakeModal: () => <div data-testid="outbound-intake-modal-stub" />,
}));
vi.mock("@/modules/outbound/components/OutboundNfcProducts", () => ({
  OutboundNfcProducts: () => <div data-testid="outbound-nfc-products-stub" />,
}));

import AlignedMvpOutboundPage from "./AlignedMvpOutboundPage";

const ROWS = [
  {
    id: "doc-draft-1",
    code: "PX-20260820-0001",
    outboundRequestId: "req-1",
    recipientName: "Đại lý A",
    expected: 2,
    scanned: 0,
    labelPrintedCount: 0,
    rfidMappedCount: 0,
    status: "DRAFT",
    updatedAt: "2026-08-20 08:00",
    date: "2026-08-20",
  },
  {
    id: "doc-posted-1",
    code: "PX-20260820-0002",
    outboundRequestId: "req-2",
    recipientName: "Đại lý B",
    expected: 1,
    scanned: 1,
    labelPrintedCount: 1,
    rfidMappedCount: 0,
    status: "POSTED",
    updatedAt: "2026-08-20 09:00",
    date: "2026-08-20",
  },
];

function grantOnly(codes: string[]) {
  permissionMocks.can.mockImplementation((code: string) =>
    codes.includes(code),
  );
}

describe("AlignedMvpOutboundPage RBAC gating (OUT-01, WWHN-209)", () => {
  beforeEach(() => {
    permissionMocks.can.mockReset().mockImplementation(() => true);
    serviceMocks.fetchOutboundDocuments.mockReset().mockResolvedValue({
      data: ROWS,
      meta: { current_page: 1, per_page: 15, total: ROWS.length },
    });
  });

  afterEach(() => cleanupTestState());

  it("hỏi đúng permission code Annex C, không dùng code ma", async () => {
    grantOnly(["outbound.view"]);
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");

    // Siết 27/08: BE mở nhóm yêu cầu xuất bằng OR
    // (`outbound.request.import|outbound.import`, `outbound.request.manual_create|outbound.import`).
    // Hỏi mỗi `outbound.import` là chặt hơn backend và ẩn nút với WAREHOUSE_STAFF —
    // vai được cấp đủ outbound.request.* nhưng không có outbound.import.
    // `can` giờ được gọi qua Array.some nên nhận (code, index, array) — so khớp
    // theo đối số ĐẦU TIÊN thay vì toàn bộ danh sách đối số.
    const askedCodes = permissionMocks.can.mock.calls.map(([code]) => code);
    expect(askedCodes).toEqual(
      expect.arrayContaining([
        "outbound.request.import",
        "outbound.import",
        "outbound.request.manual_create",
        "outbound.scan",
      ]),
    );
    expect(askedCodes).not.toContain("outbound.create");
  });

  it("chỉ outbound.view: không có nút tiếp nhận, mọi hàng đều read-only 'Xem'", async () => {
    grantOnly(["outbound.view"]);
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");

    expect(
      screen.queryByRole("button", { name: /Tiếp nhận yêu cầu xuất/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Xem/ })).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /^Mở$/ }),
    ).not.toBeInTheDocument();
  });

  it("có outbound.scan + outbound.import: DRAFT hiện 'Mở', POSTED vẫn chỉ 'Xem'", async () => {
    grantOnly(["outbound.view", "outbound.scan", "outbound.import"]);
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");

    expect(
      screen.getByRole("button", { name: /Tiếp nhận yêu cầu xuất/ }),
    ).toBeInTheDocument();
    // DRAFT mutable + có outbound.scan → "Mở"; POSTED bất biến → "Xem" bất kể quyền.
    expect(
      within(screen.getByRole("row", { name: /PX-20260820-0001/ })).getByRole(
        "button",
        { name: /Mở/ },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xem/ })).toBeInTheDocument();
  });

  it("keeps request number, created date and note out of the document list", async () => {
    grantOnly(["outbound.view"]);
    serviceMocks.fetchOutboundDocuments.mockResolvedValue({
      data: [
        {
          ...ROWS[0],
          outboundRequestId: "1099ed43-5208-411f-80d7-775f3dda6e81",
          requestNo: "YCX-2026-08-30-001",
          note: "Giao gấp",
        },
        // BE lỡ chưa kèm được request_no: vẫn không được lộ UUID đầy đủ.
        {
          ...ROWS[1],
          id: "doc-no-reqno",
          code: "PX-NO-REQNO",
          outboundRequestId: "22222222-2222-4222-8222-222222222222",
          requestNo: null,
        },
      ],
      meta: { current_page: 1, per_page: 15, total: 2 },
    });
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");

    const table = screen.getByRole("table");
    for (const name of ["Mã toa yêu cầu", "Ngày tạo", "Ghi chú"]) {
      expect(
        within(table).queryByRole("columnheader", { name }),
      ).not.toBeInTheDocument();
    }
    expect(
      within(table).queryByText("YCX-2026-08-30-001"),
    ).not.toBeInTheDocument();
    expect(within(table).queryByText("Giao gấp")).not.toBeInTheDocument();
    expect(
      screen.queryByText("1099ed43-5208-411f-80d7-775f3dda6e81"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("22222222-2222-4222-8222-222222222222"),
    ).not.toBeInTheDocument();
  });

  it("lỗi tải danh sách: render ApiErrorAlert thay vì màn trắng (hợp đồng UI_STATE)", async () => {
    grantOnly(["outbound.view"]);
    serviceMocks.fetchOutboundDocuments.mockRejectedValue(
      Object.assign(new Error("Request failed with status code 500"), {
        isAxiosError: true,
        response: { status: 500, data: { message: "Internal error" } },
      }),
    );
    renderWithProviders(<AlignedMvpOutboundPage />);

    await waitFor(() =>
      expect(
        screen.getByText("Không tải được danh sách phiếu xuất"),
      ).toBeInTheDocument(),
    );
  });

  it("Sắp xếp theo: mặc định Mới nhất (desc), chọn Cũ nhất gửi asc + về trang 1", async () => {
    grantOnly(["outbound.view"]);
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");

    // Lần tải đầu đã sắp Mới nhất ở BE (sort_order=desc trong SQL).
    expect(serviceMocks.fetchOutboundDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: "desc" }),
    );
    expect(
      screen.getByLabelText("Sắp xếp danh sách phiếu xuất").closest("form"),
    ).toHaveClass("hn-outbound-filters");

    fireEvent.mouseDown(screen.getByLabelText("Sắp xếp danh sách phiếu xuất"));
    fireEvent.click(
      await screen.findByRole("option", { name: "Sắp xếp theo: Cũ nhất" }),
    );

    await waitFor(() => {
      expect(serviceMocks.fetchOutboundDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: "asc", page: 1 }),
      );
    });
  });

  it("moves NFC lookup into Xuất kho while keeping the document list tab", async () => {
    grantOnly(["outbound.view"]);
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");

    fireEvent.click(
      screen.getByRole("tab", { name: "Sản phẩm đã xuất & NFC" }),
    );
    expect(
      await screen.findByTestId("outbound-nfc-products-stub"),
    ).toBeInTheDocument();
    expect(screen.queryByText("PX-20260820-0001")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Thu gọn" }),
    ).not.toBeInTheDocument();
  });

  it("hides and restores the entire overview from the button beside intake", async () => {
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");

    const intake = screen.getByRole("button", {
      name: "Tiếp nhận yêu cầu xuất",
    });
    const toggle = screen.getByRole("button", { name: "Thu gọn" });
    const overview = screen.getByRole("region", {
      name: "Tình trạng xử lý phiếu",
    });
    expect(toggle.parentElement).toBe(intake.parentElement);
    expect(toggle).toHaveAttribute("aria-controls", overview.id);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(overview).not.toBeVisible();
    expect(screen.getByText("PX-20260820-0001")).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(overview).toBeVisible();
  });

  it("numbers document rows across pages and omits the list title", async () => {
    serviceMocks.fetchOutboundDocuments.mockImplementation(
      ({ page, per_page }: { page: number; per_page: number }) =>
        Promise.resolve({
          data:
            page === 1
              ? ROWS
              : [{ ...ROWS[0], id: "doc-page-2", code: "PX-PAGE-2" }],
          meta: { current_page: page, per_page, total: 11 },
        }),
    );
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "STT" }),
    ).toBeInTheDocument();
    expect(
      within(table)
        .getByRole("row", { name: /PX-20260820-0001/ })
        .querySelector("td"),
    ).toHaveTextContent("1");
    expect(
      screen.queryByRole("heading", { name: /Danh sách phiếu xuất/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    const secondPageRow = await within(table).findByRole("row", {
      name: /PX-PAGE-2/,
    });
    expect(secondPageRow.querySelector("td")).toHaveTextContent("11");
  });

  it("applies typed search automatically without apply and reset buttons", async () => {
    renderWithProviders(<AlignedMvpOutboundPage />);
    await screen.findByText("PX-20260820-0001");
    expect(
      screen.queryByRole("button", { name: "Áp dụng" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Đặt lại" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Tìm phiếu xuất" }), {
      target: { value: "PX-2026" },
    });
    expect(
      screen.queryByRole("button", { name: "Đặt lại" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(serviceMocks.fetchOutboundDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ search: "PX-2026", page: 1 }),
      );
    });
  });
});
