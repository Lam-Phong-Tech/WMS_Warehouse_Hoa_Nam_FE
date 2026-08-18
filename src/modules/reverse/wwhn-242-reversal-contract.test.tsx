/**
 * WWHN-242 (HN-FE-006 · REV-00/REV-01) — khoá lại ba hành vi đã sửa tận gốc.
 *
 * 1. FE242-RBAC: `/reverse` là màn ĐỌC. BE mở GET /reversal-documents bằng
 *    `inventory.view`; gate route chỉ bằng `inventory.reversal.post` khoá nhầm các vai
 *    chỉ đọc (WAREHOUSE_APPROVER / LEADERSHIP / VIEWER / WARRANTY_STAFF /
 *    WAREHOUSE_STAFF theo AuthDatabaseSeeder).
 * 2. FE242-STALE: BR-REV-02 bắt buộc If-Match theo version hiện hành ⇒ 409/412/428 luôn
 *    nghĩa là cache đã cũ. UI phải TỰ nạp lại phiếu, không chỉ nhắc "tải lại".
 * 3. FE242-IFMATCH: lookup không trả version ⇒ POST chắc chắn 428, phải chặn ngay ở UI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { createMockAxiosError } from "@/shared/api/api-error";

// setup.ts mock sẵn "@/app/router/access" cho toàn bộ suite; muốn assert bản đồ quyền
// THẬT thì phải unmock như access.test.ts đang làm.
vi.unmock("@/app/router/access");

const permissionMocks = vi.hoisted(() => ({ can: vi.fn(() => true) }));

vi.mock("@/shared/components/permission", () => ({
  useHasPermission: () => permissionMocks.can,
}));

vi.mock("@/modules/reverse/hooks/use-reversal", () => ({
  useReversalDocument: vi.fn(),
  useReversalLines: vi.fn(),
  useConfirmReversal: vi.fn(),
  usePostReversal: vi.fn(),
  useCancelReversal: vi.fn(),
  useReversibleMovements: vi.fn(),
  useCreateReversal: vi.fn(),
  reversalKeys: { all: ["reversal"] },
}));

import {
  useCancelReversal,
  useConfirmReversal,
  useCreateReversal,
  usePostReversal,
  useReversalDocument,
  useReversalLines,
  useReversibleMovements,
} from "@/modules/reverse/hooks/use-reversal";
import type {
  ReversalDocument,
  ReversalLine,
  ReversibleMovement,
} from "@/modules/reverse/types";
import { ReversalDetailModal } from "./components/ReversalDetailModal";
import { ReversalCreateModal } from "./components/ReversalCreateModal";

const DOC: ReversalDocument = {
  id: "rev-1",
  reversal_code: "REV-20260818-0001",
  status: "DRAFT",
  physical_return_status: "CONFIRMED",
  reference_document_type: "OUTBOUND",
  reference_document_code: "OUT-20260802-014",
  reference_document_id: "doc-1",
  correction_chain_id: "chain-1",
  warehouse_id: "wh-1",
  warehouse_name: "Kho tổng Hòa Nam",
  total_lines: 1,
  total_qty: 1,
  reason: "Giao nhầm Item",
  created_at: "2026-08-18T00:00:00Z",
  created_by: "thukho",
  version: 4,
};

const LINE: ReversalLine = {
  id: "line-1",
  reversal_id: "rev-1",
  line_no: 1,
  original_movement_id: "mv-1",
  original_movement_code: "MOV-ISSUE-000882",
  sku: "DCH-DRILL-DJZ10A-220V-V1",
  sku_name: "Máy khoan",
  original_qty: 5,
  reversal_qty: 1,
  reversed_qty: 0,
  remaining_qty: 5,
  status: "DRAFT",
};

const docRefetch = vi.fn();
const linesRefetch = vi.fn();
const postMutate = vi.fn();

function mockDetailHooks() {
  vi.mocked(useReversalDocument).mockReturnValue({
    data: DOC,
    isLoading: false,
    isError: false,
    refetch: docRefetch,
  } as unknown as ReturnType<typeof useReversalDocument>);
  vi.mocked(useReversalLines).mockReturnValue({
    data: [LINE],
    isLoading: false,
    isError: false,
    refetch: linesRefetch,
  } as unknown as ReturnType<typeof useReversalLines>);

  const mutation = (mutateAsync: typeof postMutate) =>
    ({ mutateAsync, isPending: false }) as never;

  vi.mocked(useConfirmReversal).mockReturnValue(mutation(vi.fn()));
  vi.mocked(usePostReversal).mockReturnValue(mutation(postMutate));
  vi.mocked(useCancelReversal).mockReturnValue(mutation(vi.fn()));
}

/**
 * Bấm Post rồi xác nhận trong hộp Modal.confirm của antd. Nút OK của hộp thoại mang
 * cùng nhãn "Post reversal" với nút mở, nên phải lấy nút xuất hiện SAU.
 */
async function clickPostAndConfirm() {
  fireEvent.click(screen.getByRole("button", { name: /Post reversal/i }));
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: /Post reversal/i }).length,
    ).toBeGreaterThan(1),
  );
  const buttons = screen.getAllByRole("button", { name: /Post reversal/i });
  fireEvent.click(buttons[buttons.length - 1]);
}

describe("WWHN-242 · REV-00/REV-01 contract", () => {
  beforeEach(() => {
    permissionMocks.can.mockReturnValue(true);
    docRefetch.mockReset();
    linesRefetch.mockReset();
    postMutate.mockReset();
  });

  afterEach(() => cleanupTestState());

  it("route /reverse mở cho inventory.view, không chỉ inventory.reversal.post", async () => {
    const { ROUTE_PERMISSIONS } = await import("@/app/router/access");
    const { ROUTES } = await import("@/shared/constants/routes");

    const allowed = ROUTE_PERMISSIONS[ROUTES.REVERSE];
    expect(allowed).toContain("inventory.view");
    expect(allowed).toContain("inventory.reversal.post");
  });

  it.each([409, 412, 428])(
    "%i ⇒ tự nạp lại phiếu + dòng và hiện cảnh báo phiên bản (BR-REV-02)",
    async (status) => {
      mockDetailHooks();
      postMutate.mockRejectedValue(
        createMockAxiosError({
          status,
          data: {
            success: false,
            message: "Phiên bản chứng từ đã thay đổi.",
            error_code: "STALE_VERSION",
          },
        }),
      );

      renderWithProviders(
        <ReversalDetailModal documentId="rev-1" onClose={vi.fn()} />,
      );
      await clickPostAndConfirm();

      // Trước bản vá: FE chỉ toast "tải lại phiếu" nhưng giữ nguyên cache ⇒ lần bấm
      // kế tiếp vẫn gửi đúng version cũ và thất bại vô hạn.
      await waitFor(() => expect(docRefetch).toHaveBeenCalled());
      expect(linesRefetch).toHaveBeenCalled();
      expect(
        await screen.findByText(/Phiên bản phiếu đã thay đổi/i),
      ).toBeInTheDocument();
    },
  );

  it("403 không kích hoạt cơ chế nạp lại version (không phải xung đột optimistic lock)", async () => {
    mockDetailHooks();
    postMutate.mockRejectedValue(
      createMockAxiosError({
        status: 403,
        data: {
          success: false,
          message: "Thiếu quyền inventory.reversal.post.",
          error_code: "PERMISSION_DENIED",
        },
      }),
    );

    renderWithProviders(
      <ReversalDetailModal documentId="rev-1" onClose={vi.fn()} />,
    );
    await clickPostAndConfirm();

    await waitFor(() => expect(postMutate).toHaveBeenCalled());
    expect(docRefetch).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Phiên bản phiếu đã thay đổi/i),
    ).not.toBeInTheDocument();
  });

  it("lookup thiếu version ⇒ chặn tạo hoàn đảo thay vì để BE trả 428", async () => {
    const movementWithoutVersion: ReversibleMovement = {
      id: "mv-1",
      movement_code: "MOV-RECEIPT-000123",
      movement_type: "RECEIPT",
      source_document_type: "INBOUND",
      source_document_id: "doc-1",
      source_document_code: "IN-20260801-003",
      warehouse_id: "wh-1",
      warehouse_name: "Kho tổng Hòa Nam",
      posted_at: "2026-08-18T09:00:00Z",
      can_reverse: true,
      lines: [
        {
          id: "mvl-1",
          sku: "LK-DCH-PIN-20V-V1",
          sku_name: "Pin 20V",
          original_qty: 20,
          reversed_qty: 0,
          reversible_qty: 20,
          remaining_qty: 20,
          can_reverse: true,
        },
      ],
    };

    vi.mocked(useReversibleMovements).mockReturnValue({
      data: [movementWithoutVersion],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReversibleMovements>);
    vi.mocked(useCreateReversal).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithProviders(
      <ReversalCreateModal onClose={vi.fn()} onCreated={vi.fn()} />,
    );

    // onRow.onClick gắn trên phần tử dòng, không phải trên ô chữ.
    const cell = screen.getByText("MOV-RECEIPT-000123");
    const row = cell.closest('[role="row"]') ?? cell.closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    expect(
      await screen.findByText(/Tạo hoàn đảo từ MOV-RECEIPT-000123/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Thiếu version chứng từ gốc/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tạo hoàn đảo/i }),
    ).toBeDisabled();
  });
});
