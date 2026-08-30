import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { PackingLabelPreviewDialog } from "./PackingLabelPreviewDialog";
import type { PackingLabelRecord } from "@/modules/outbound/services/alignedOutboundService";

function makeLabel(
  overrides: Partial<PackingLabelRecord> = {},
): PackingLabelRecord {
  return {
    id: "LBL-1",
    version: 1,
    documentId: "OUT-1",
    labelCode: "PL-PX-20260830133507-LQPM3Z",
    outboundNo: "PX-20260830133507",
    sourceRequestNo: "2",
    recipientName: "Đại lý Hoa Nam Hà Nội",
    recipientAddress: "123 Đường ABC, Hà Nội",
    customerPhone: "0901234567",
    itemCount: 5,
    skuCount: 2,
    skuSummary: [
      {
        skuId: "SKU-1",
        skuCode: "HN-PRD-SEED-002",
        skuName: "Máy phát điện PV mẫu Hoa Nam 002",
        quantity: 2,
      },
      {
        skuId: "SKU-2",
        skuCode: "HN-COMP-BASE-003",
        skuName: "Linh kiện nền Hoa Nam 003",
        quantity: 3,
      },
    ],
    status: "READY_TO_PRINT",
    applied: false,
    appliedAt: null,
    reprintCount: 0,
    payload: {},
    ...overrides,
  };
}

/**
 * Bản xem trước trực quan của tem xuất kho — trước đây "3 · Xem và in nhãn"
 * chỉ có metadata (mã nhãn, số SKU...), không có cách nào biết trước tem sẽ
 * trông ra sao vì bản in thật do agent máy in bên ngoài dàn trang.
 */
describe("PackingLabelPreviewDialog", () => {
  afterEach(() => {
    cleanupTestState();
  });

  it("không render gì khi label là null", () => {
    const { container } = renderWithProviders(
      <PackingLabelPreviewDialog open label={null} onClose={vi.fn()} />,
    );
    expect(container.textContent).toBe("");
  });

  it("hiển thị đủ SKU, số lượng, người nhận, mã phiếu và toa nguồn", async () => {
    renderWithProviders(
      <PackingLabelPreviewDialog open label={makeLabel()} onClose={vi.fn()} />,
    );

    expect(await screen.findByText("Xem trước nhãn")).toBeInTheDocument();
    expect(screen.getByText("PX-20260830133507")).toBeInTheDocument();
    expect(screen.getByText("Toa nguồn: 2")).toBeInTheDocument();
    expect(screen.getByText("SKU: 2 · SP: 5")).toBeInTheDocument();
    expect(screen.getByText("Đại lý Hoa Nam Hà Nội")).toBeInTheDocument();
    expect(screen.getByText("123 Đường ABC, Hà Nội")).toBeInTheDocument();
    expect(screen.getByText("ĐT: 0901234567")).toBeInTheDocument();

    // Bảng sản phẩm chia cột Tên sản phẩm / SKU / SL.
    expect(screen.getByText("Tên sản phẩm")).toBeInTheDocument();
    expect(screen.getByText("SKU")).toBeInTheDocument();
    expect(screen.getByText("SL")).toBeInTheDocument();
    expect(
      screen.getByText("Máy phát điện PV mẫu Hoa Nam 002"),
    ).toBeInTheDocument();
    expect(screen.getByText("HN-PRD-SEED-002")).toBeInTheDocument();
    expect(screen.getByText("Linh kiện nền Hoa Nam 003")).toBeInTheDocument();
    expect(screen.getByText("HN-COMP-BASE-003")).toBeInTheDocument();

    // Tổng số lượng = cộng đúng các dòng trong bảng (2 + 3 = 5), không phải
    // đọc lại một field riêng có thể lệch với bảng đang hiển thị.
    expect(screen.getByText("TỔNG SỐ LƯỢNG")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    // Mã vạch CODE128 thật sự được JsBarcode vẽ (rect bars), không chỉ là
    // khung <svg> trống — nếu không thì tem xem trước sẽ thiếu mã vạch.
    await waitFor(() => {
      const svg = screen.getByTestId("packing-label-barcode");
      expect(svg.querySelectorAll("rect").length).toBeGreaterThan(0);
    });
    expect(
      screen.getByText("PL-PX-20260830133507-LQPM3Z"),
    ).toBeInTheDocument();
  });

  it("báo rõ khi nhãn chưa có dòng SKU thay vì để trống im lặng", async () => {
    renderWithProviders(
      <PackingLabelPreviewDialog
        open
        label={makeLabel({ skuSummary: [] })}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Chưa có dòng SKU")).toBeInTheDocument();
  });

  it("gọi onClose khi bấm Đóng", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <PackingLabelPreviewDialog open label={makeLabel()} onClose={onClose} />,
    );

    (await screen.findByRole("button", { name: "Đóng" })).click();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
