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
      createdBy: "Người tạo phiếu xuất",
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
  expect(screen.getByText("Người tạo phiếu").parentElement).toHaveTextContent(
    "Người tạo phiếu xuất",
  );
  expect(screen.getByText("Người quét")).toBeInTheDocument();
  expect(screen.getByText("Người ghi nhận xuất kho")).toBeInTheDocument();
  expect(screen.queryByText("Người hủy")).not.toBeInTheDocument();
});

it("shows posted_at as the successful outbound time", async () => {
  service.fetchOutboundDetail.mockResolvedValue({
    document: {
      id: "OUT-2",
      code: "PX-20261112121420",
      outboundRequestId: "REQ-2",
      requestNo: "TOA-20261112-121405-1B83",
      date: "2026-11-12",
      createdAt: "2026-11-12T12:14:05",
      postedAt: "2026-11-12T12:20:35",
      warehouseId: "WH-1",
      recipientName: "Dự án nhà máy xử lý nước thải Ninh Bình",
      recipientAddress: "",
      expected: 1,
      scanned: 1,
      status: "POSTED",
      version: 2,
      createdBy: "USER-1",
      scannedByNames: ["An quét", "Bình quét"],
      postedBy: "Người ghi nhận phiếu xuất",
    },
    lines: [],
    itemMatches: [],
    movements: [],
    statusHistory: [],
  });

  renderWithProviders(
    <AlignedOutboundDetailModal documentId="OUT-2" onClose={vi.fn()} />,
  );

  expect(
    await screen.findByText("Ngày giờ xuất kho thành công"),
  ).toBeInTheDocument();
  expect(screen.getByText("12/11/2026 12:20")).toBeInTheDocument();
  expect(screen.getByText("Người quét").parentElement).toHaveTextContent(
    "An quét, Bình quét",
  );
  expect(
    screen.getByText("Người ghi nhận xuất kho").parentElement,
  ).toHaveTextContent("Người ghi nhận phiếu xuất");
});

it.each([undefined, "", "Người hủy phiếu xuất"])(
  "only shows the cancellation actor when a name exists (%s)",
  async (cancelledBy) => {
    service.fetchOutboundDetail.mockResolvedValue({
      document: {
        id: "OUT-CANCEL",
        code: "PX-CANCEL",
        date: "2026-11-15",
        createdAt: "2026-11-15T10:00:00",
        warehouseId: "WH-1",
        recipientName: "Khách hàng",
        recipientAddress: "",
        expected: 0,
        scanned: 0,
        status: "CANCELLED",
        version: 2,
        createdBy: "Người tạo phiếu xuất",
        cancelledBy,
      },
      lines: [],
      itemMatches: [],
      movements: [],
      statusHistory: [],
    });
    renderWithProviders(
      <AlignedOutboundDetailModal documentId="OUT-CANCEL" onClose={vi.fn()} />,
    );
    await screen.findByText("Người tạo phiếu");
    if (cancelledBy) {
      expect(screen.getByText("Người hủy").parentElement).toHaveTextContent(
        cancelledBy,
      );
    } else {
      expect(screen.queryByText("Người hủy")).not.toBeInTheDocument();
    }
  },
);
