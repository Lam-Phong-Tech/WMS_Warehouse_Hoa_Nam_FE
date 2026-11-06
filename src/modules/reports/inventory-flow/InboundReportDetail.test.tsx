import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import {
  useInboundDetail,
  useInboundScanEntries,
} from "@/modules/inbound/hooks/use-inbound";
import { useWarehouseDirectory } from "@/shared/data/reference-queries";
import { InboundReportDetail } from "./InboundReportDetail";
import type { FlowDocument } from "./inventory-flow-api";

vi.mock("@/modules/inbound/hooks/use-inbound", () => ({
  useInboundDetail: vi.fn(),
  useInboundScanEntries: vi.fn(),
}));
vi.mock("@/shared/data/reference-queries", () => ({
  useWarehouseDirectory: vi.fn(),
}));

const documentCard: FlowDocument = {
  id: "in-1",
  document_no: "PN-001",
  doc_type: "INBOUND",
  status: "POSTED",
  warehouse_code: "KHO-TONG-HN",
  counterpart: "Nhà cung cấp A",
  created_by_name: "Nguyễn A",
  posted_at: "2026-10-26T09:15:00+07:00",
  document_date: "2026-10-26",
  drillKey: "",
};

describe("Chi tiết báo cáo nhập kho", () => {
  it("hiển thị thông tin phiếu, SKU, lịch sử và danh sách mã thay cho modal quét", () => {
    vi.mocked(useWarehouseDirectory).mockReturnValue({
      data: [{ code: "KHO-TONG-HN", name: "Kho tổng Hoa Nam" }],
    } as unknown as ReturnType<typeof useWarehouseDirectory>);
    vi.mocked(useInboundDetail).mockReturnValue({
      data: {
        document: {
          code: "PN-001",
          status: "POSTED",
          sourceReference: "HD-001",
          createdAt: "2026-10-26T08:30:00+07:00",
          createdBy: "Nguyễn A",
        },
        lines: [
          {
            id: "line-1",
            sku: "SKU-01",
            skuName: "Bộ điều khiển",
            productUnit: "Cái",
            scanned: 2,
          },
        ],
        statusHistory: [
          {
            id: "history-1",
            fromStatus: "SCANNING",
            toStatus: "POSTED",
            action: "POST",
            changedAt: "2026-10-26T09:15:00+07:00",
            changedBy: "Nguyễn A",
            note: "Hoàn tất",
          },
        ],
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useInboundDetail>);
    vi.mocked(useInboundScanEntries).mockReturnValue({
      data: [
        {
          id: "entry-1",
          lineId: "line-1",
          itemCode: "SN-001",
          sku: "SKU-01",
          skuName: "Bộ điều khiển",
          quantity: 1,
          status: "ACTIVE",
          capturedAt: "2026-10-26T09:15:00+07:00",
        },
        {
          id: "entry-2",
          lineId: "line-1",
          itemCode: "SN-002",
          sku: "SKU-01",
          skuName: "Bộ điều khiển",
          quantity: 1,
          status: "REMOVED",
        },
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useInboundScanEntries>);

    renderWithProviders(
      <InboundReportDetail
        document={documentCard}
        range={{ from: "2026-10-23", to: "2026-10-29" }}
        canExport
        onBack={vi.fn()}
      />,
      ["/reports/inventory-flow?screen=RPT-01"],
    );
    expect(useInboundDetail).toHaveBeenCalledWith("in-1", { readOnly: true });

    expect(
      screen.getByRole("heading", { name: "Chi tiết báo cáo nhập kho" }),
    ).toBeInTheDocument();
    expect(screen.getByText("HD-001")).toBeInTheDocument();
    expect(screen.getByText("Kho tổng Hoa Nam")).toBeInTheDocument();
    expect(screen.getByText(/Phạm vi báo cáo:/)).toHaveTextContent(
      "Kho tổng Hoa Nam · Giờ Việt Nam",
    );
    expect(screen.queryByText("KHO-TONG-HN")).not.toBeInTheDocument();
    expect(screen.getByText("Hoàn tất")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Mở chứng từ gốc/ }),
    ).toHaveAttribute("href", "/inbound?screen=IN-03&id=in-1");
    expect(screen.getByText("SN-001")).toBeInTheDocument();
    expect(screen.queryByText("SN-002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Tổng hợp SKU" }));
    expect(screen.getByRole("tab", { name: "Tổng hợp SKU" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByText("SN-001")).not.toBeInTheDocument();
  });
});
