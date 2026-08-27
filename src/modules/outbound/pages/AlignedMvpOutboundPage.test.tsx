import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("button", { name: /Mở/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xem/ })).toBeInTheDocument();
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
});
