import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

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
}));

import {
  useCancelReversal,
  useConfirmReversal,
  usePostReversal,
  useReversalDocument,
  useReversalLines,
} from "@/modules/reverse/hooks/use-reversal";
import type { ReversalDocument, ReversalLine } from "@/modules/reverse/types";
import { ReversalDetailModal } from "./ReversalDetailModal";

const BASE_DOC: ReversalDocument = {
  id: "rev-1",
  reversal_code: "REV-20260817-0001",
  status: "DRAFT",
  physical_return_status: "PENDING_RETURN",
  reference_document_type: "OUTBOUND",
  reference_document_code: "OUT-20260802-014",
  reference_document_id: "doc-1",
  correction_chain_id: "chain-1",
  warehouse_id: "wh-1",
  warehouse_name: "Kho tổng",
  total_lines: 1,
  total_qty: 1,
  reason: "Giao nhầm Item",
  created_at: "2026-08-17T00:00:00Z",
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
  reversal_qty: 2,
  reversed_qty: 2,
  remaining_qty: 3,
  return_condition: "SELLABLE",
  status: "POSTED",
};

const confirmMutate = vi.fn();
const postMutate = vi.fn();
const cancelMutate = vi.fn();

function mockHooks(doc: Partial<ReversalDocument> = {}) {
  vi.mocked(useReversalDocument).mockReturnValue({
    data: { ...BASE_DOC, ...doc },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useReversalDocument>);
  vi.mocked(useReversalLines).mockReturnValue({
    data: [LINE],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useReversalLines>);

  const mutation = (mutateAsync: typeof confirmMutate) =>
    ({ mutateAsync, isPending: false }) as never;

  vi.mocked(useConfirmReversal).mockReturnValue(mutation(confirmMutate));
  vi.mocked(usePostReversal).mockReturnValue(mutation(postMutate));
  vi.mocked(useCancelReversal).mockReturnValue(mutation(cancelMutate));
}

describe("ReversalDetailModal (REV-01 lifecycle §6)", () => {
  beforeEach(() => {
    permissionMocks.can.mockReturnValue(true);
    confirmMutate.mockReset().mockResolvedValue({});
    postMutate.mockReset().mockResolvedValue({});
    cancelMutate.mockReset().mockResolvedValue({});
  });

  afterEach(() => cleanupTestState());

  it("hiển thị SL movement gốc tách khỏi SL đảo và phần còn đảo", () => {
    mockHooks();
    renderWithProviders(
      <ReversalDetailModal documentId="rev-1" onClose={vi.fn()} />,
    );

    expect(screen.getByText("MOV-ISSUE-000882")).toBeInTheDocument();

    // Bốn cột số của Annex D SCR-REV-01: SL gốc 5 · SL đảo 2 · đã đảo 2 · còn đảo 3.
    // Trước khi sửa contract, original_qty bị BE alias trùng reversal_qty nên cột
    // "SL gốc" hiện 2 — assert này khoá lại đúng chỗ đó.
    const row = screen
      .getAllByRole("row")
      .find((candidate) => candidate.textContent?.includes("MOV-ISSUE-000882"));
    expect(row).toBeDefined();

    // i18n: return_condition SELLABLE render qua RETURN_CONDITION_LABELS;
    // so trong dòng để không đụng option cùng nhãn trong Select xác nhận.
    expect(
      within(row as HTMLElement).getByText("Có thể bán/xuất lại"),
    ).toBeInTheDocument();

    const cells = Array.from(row!.children).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(cells).toEqual(expect.arrayContaining(["5", "2", "3"]));
    expect(cells.filter((value) => value === "5")).toHaveLength(1);
  });

  it("DRAFT/PENDING_RETURN: Confirm gửi đúng version, Post bị chặn tới khi hàng về", () => {
    mockHooks();
    renderWithProviders(
      <ReversalDetailModal documentId="rev-1" onClose={vi.fn()} />,
    );

    // BR-REV-06: chưa xác nhận hàng vật lý thì không được Post.
    expect(
      screen.getByRole("button", { name: /Hoàn tất điều chỉnh/i }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: /Xác nhận hàng vật lý đã về/i }),
    );

    expect(confirmMutate).toHaveBeenCalledWith({
      id: "rev-1",
      version: 4,
      return_condition: "SELLABLE",
    });
  });

  it("Cancel yêu cầu lý do tối thiểu 5 ký tự rồi gửi kèm If-Match version", async () => {
    mockHooks({ physical_return_status: "CONFIRMED" });
    renderWithProviders(
      <ReversalDetailModal documentId="rev-1" onClose={vi.fn()} />,
    );

    const cancelButton = screen.getByRole("button", {
      name: /Hủy phiếu/i,
    });
    expect(cancelButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Nhập lý do hủy phiếu..."), {
      target: { value: "Tạo nhầm phiếu" },
    });

    await waitFor(() => expect(cancelButton).toBeEnabled());
    fireEvent.click(cancelButton);

    expect(cancelMutate).toHaveBeenCalledWith({
      id: "rev-1",
      version: 4,
      reason: "Tạo nhầm phiếu",
    });
  });

  it("POSTED là append-only: không còn hành động lifecycle nào", () => {
    mockHooks({ status: "POSTED", physical_return_status: "CONFIRMED" });
    renderWithProviders(
      <ReversalDetailModal documentId="rev-1" onClose={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: /Hoàn tất điều chỉnh/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hủy phiếu/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Phiếu điều chỉnh đã hoàn tất"),
    ).toBeInTheDocument();
  });

  it("thiếu quyền inventory.reversal.post thì không render hành động lifecycle", () => {
    permissionMocks.can.mockReturnValue(false);
    mockHooks();
    renderWithProviders(
      <ReversalDetailModal documentId="rev-1" onClose={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: /Hoàn tất điều chỉnh/i }),
    ).not.toBeInTheDocument();
  });
});
