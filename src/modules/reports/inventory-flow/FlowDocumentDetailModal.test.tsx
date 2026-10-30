import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { fetchInboundDetail } from "@/modules/inbound/services/inboundService";
import { fetchOutboundDetail } from "@/modules/outbound/services/mvpOutboundService";
import type { FlowDocument } from "./inventory-flow-api";
import { FlowDocumentDetailModal } from "./FlowDocumentDetailModal";

vi.mock("@/modules/inbound/services/inboundService", () => ({
  fetchInboundDetail: vi.fn(),
}));
vi.mock("@/modules/outbound/services/mvpOutboundService", () => ({
  fetchOutboundDetail: vi.fn(),
}));

const documentCard = (
  doc_type: "INBOUND" | "OUTBOUND",
): FlowDocument & { doc_type: "INBOUND" | "OUTBOUND" } => ({
  id: "document-123",
  document_no: doc_type === "INBOUND" ? "PN-20261030-001" : "PX-20261030-001",
  doc_type,
  status: "POSTED",
  warehouse_code: "HN01",
  counterpart: "Đại lý A",
  created_by_name: "Nguyễn A",
  posted_at: "2026-10-30T09:00:00+07:00",
  document_date: "2026-10-30",
  drillKey: "HN-DRY-001",
});

describe("FlowDocumentDetailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the selected inbound document and shows every SKU, not only the card's first SKU", async () => {
    vi.mocked(fetchInboundDetail).mockResolvedValue({
      document: { code: "PN-20261030-001", status: "POSTED", scanned: 3 },
      lines: [
        { id: "line-1", sku: "HN-DRY-001", skuName: "Bộ điều khiển", scanned: 1 },
        { id: "line-2", sku: "HN-PSU-002", skuName: "Bộ nguồn", scanned: 2 },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchInboundDetail>>);

    renderWithProviders(
      <FlowDocumentDetailModal document={documentCard("INBOUND")} onClose={vi.fn()} />,
    );

    expect(await screen.findByText("HN-DRY-001")).toBeInTheDocument();
    expect(screen.getByText("HN-PSU-002")).toBeInTheDocument();
    expect(fetchInboundDetail).toHaveBeenCalledWith("document-123");
    expect(fetchOutboundDetail).not.toHaveBeenCalled();
  });

  it("shows outbound serial and label result for the selected document", async () => {
    vi.mocked(fetchOutboundDetail).mockResolvedValue({
      document: { code: "PX-20261030-001", status: "POSTED", scanned: 1 },
      lines: [{ id: "line-1", skuCode: "HN-DRY-001", skuName: "Bộ điều khiển", scanned: 1 }],
      itemMatches: [{ id: "match-1", lineId: "line-1", serialNumber: "SN-DRY-0001", labelStatus: "PRINT_FAILED", status: "POSTED" }],
      movements: [],
      statusHistory: [],
    } as unknown as Awaited<ReturnType<typeof fetchOutboundDetail>>);

    renderWithProviders(
      <FlowDocumentDetailModal document={documentCard("OUTBOUND")} onClose={vi.fn()} />,
    );

    expect(await screen.findByText("SN-DRY-0001")).toBeInTheDocument();
    expect(screen.getByText("PRINT_FAILED")).toBeInTheDocument();
    expect(fetchOutboundDetail).toHaveBeenCalledWith("document-123");
    expect(fetchInboundDetail).not.toHaveBeenCalled();
  });

  it("keeps a failed document load visible and allows retry", async () => {
    vi.mocked(fetchInboundDetail)
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({
        document: { code: "PN-20261030-001", status: "POSTED", scanned: 1 },
        lines: [{ id: "line-1", sku: "HN-DRY-001", skuName: "Bộ điều khiển", scanned: 1 }],
      } as Awaited<ReturnType<typeof fetchInboundDetail>>);

    renderWithProviders(
      <FlowDocumentDetailModal document={documentCard("INBOUND")} onClose={vi.fn()} />,
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /thử lại/i }));
    expect(await screen.findByText("HN-DRY-001")).toBeInTheDocument();
    expect(fetchInboundDetail).toHaveBeenCalledTimes(2);
  });

  it("shows a clear empty state for a document without lines", async () => {
    vi.mocked(fetchInboundDetail).mockResolvedValue({
      document: { code: "PN-20261030-001", status: "DRAFT", scanned: 0 },
      lines: [],
    } as unknown as Awaited<ReturnType<typeof fetchInboundDetail>>);

    renderWithProviders(
      <FlowDocumentDetailModal document={documentCard("INBOUND")} onClose={vi.fn()} />,
    );

    expect(await screen.findByText("Chứng từ chưa có dòng hàng.")).toBeInTheDocument();
  });

  it("keeps report lines visible when the actor lacks operational document permission", async () => {
    vi.mocked(fetchInboundDetail).mockRejectedValue(new Error("403 PERMISSION_DENIED"));
    renderWithProviders(
      <FlowDocumentDetailModal
        document={{ ...documentCard("INBOUND"), reportLines: [{ id: "line-report", sku: "HN-RPT-001", name: "Hàng từ báo cáo", expected: 2, scanned: 1, posted: 0 }] }}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText("HN-RPT-001")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
