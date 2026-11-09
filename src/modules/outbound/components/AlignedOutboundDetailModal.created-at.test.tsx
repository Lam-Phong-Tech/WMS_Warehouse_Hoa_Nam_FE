import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";

const service = vi.hoisted(() => ({
  fetchOutboundDetail: vi.fn(),
  fetchPackingLabels: vi.fn(),
  fetchPrinterConfigs: vi.fn(),
}));

vi.mock(
  "@/modules/outbound/services/alignedOutboundService",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/outbound/services/alignedOutboundService")
    >()),
    fetchOutboundDetail: service.fetchOutboundDetail,
    fetchPackingLabels: service.fetchPackingLabels,
    fetchPrinterConfigs: service.fetchPrinterConfigs,
  }),
);

import { AlignedOutboundDetailModal } from "./AlignedOutboundDetailModal";

beforeEach(() => {
  service.fetchOutboundDetail.mockReset();
  service.fetchPackingLabels.mockReset().mockResolvedValue([]);
  service.fetchPrinterConfigs.mockReset().mockResolvedValue([]);
});

afterEach(() => cleanupTestState());

it("shows created_at as Ngày tạo instead of the date-only doc_date", async () => {
  service.fetchOutboundDetail.mockResolvedValue({
    document: {
      id: "OUT-1",
      code: "PX-20261109085929-43E7TD",
      outboundRequestId: "REQ-1",
      requestNo: "MA-OUT-001",
      date: "2026-11-09",
      createdAt: "2026-11-09T08:59:29",
      warehouseId: "WH-1",
      recipientName: "Đại lý A",
      recipientAddress: "",
      expected: 0,
      scanned: 0,
      status: "DRAFT",
      version: 1,
      createdBy: "USER-1",
    },
    lines: [],
    itemMatches: [],
    movements: [],
    statusHistory: [],
  });

  renderWithProviders(
    <AlignedOutboundDetailModal documentId="OUT-1" onClose={vi.fn()} />,
  );

  expect(await screen.findByText("09/11/2026 08:59")).toBeInTheDocument();
  expect(screen.queryByText("09/11/2026 00:00")).not.toBeInTheDocument();
});
