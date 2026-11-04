import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";

const services = vi.hoisted(() => ({
  fetchOutboundDetail: vi.fn(),
  fetchPackingLabels: vi.fn(),
  fetchPrinterConfigs: vi.fn(),
  fetchAvailableQtyBySku: vi.fn(),
}));

vi.mock("@/modules/outbound/services/alignedOutboundService", () => services);
vi.mock("@/shared/components/permission", () => ({
  useHasPermission: () => () => true,
}));
vi.mock("@/shared/components/DocumentAttachmentsPanel", () => ({
  DocumentAttachmentsPanel: () => (
    <div data-testid="attachments-panel">Chứng từ đính kèm</div>
  ),
}));
vi.mock("@/shared/components/forms/CameraScanModal", () => ({
  CameraScanModal: () => null,
}));
vi.mock("@/modules/outbound/components/PackingLabelPreviewDialog", () => ({
  PackingLabelPreviewDialog: () => null,
}));

import { AlignedOutboundDetailModal } from "./AlignedOutboundDetailModal";

beforeEach(() => {
  services.fetchOutboundDetail.mockResolvedValue({
    document: {
      id: "OUT-1",
      code: "PX-20261103-001",
      date: "2026-11-03",
      warehouseId: "WH-1",
      outboundRequestId: "REQ-1",
      recipientName: "Dự án tưới tiêu Krông Pắc",
      recipientAddress: "",
      expected: 1,
      scanned: 1,
      status: "POSTED",
      version: 1,
      createdBy: "USER-1",
    },
    lines: [
      {
        id: "LINE-1",
        documentId: "OUT-1",
        productId: "SKU-1",
        skuCode: "SKU-001",
        expected: 1,
        scanned: 1,
        remaining: 0,
      },
    ],
    itemMatches: [],
    movements: [],
    statusHistory: [],
  });
  services.fetchPackingLabels.mockResolvedValue([
    {
      id: "LABEL-1",
      version: 1,
      documentId: "OUT-1",
      labelCode: "PL-PX-20261103-001",
      sourceRequestNo: "MA-OUT-20261103-001",
      recipientName: "Dự án tưới tiêu Krông Pắc",
      itemCount: 1,
      skuCount: 1,
      status: "READY_TO_PRINT",
    },
  ]);
  services.fetchPrinterConfigs.mockResolvedValue([
    {
      id: "PRINTER-1",
      code: "P-01",
      name: "Máy in kho",
      status: "ACTIVE",
    },
  ]);
  services.fetchAvailableQtyBySku.mockResolvedValue({ "SKU-1": 1 });
});

afterEach(() => cleanupTestState());

it.each([
  ["CANCELLED", "Đã hủy", "error"],
  ["POSTED", "Đã xuất kho", "success"],
  ["SCANNING", "Đang quét xuất hàng", "info"],
  ["DRAFT", "Nháp", "secondary"],
])("uses the semantic status color for %s", async (status, label, color) => {
  const detail = await services.fetchOutboundDetail();
  services.fetchOutboundDetail.mockResolvedValue({
    ...detail,
    document: { ...detail.document, status },
  });
  renderWithProviders(
    <AlignedOutboundDetailModal documentId="OUT-1" onClose={vi.fn()} />,
  );

  const badge = (await screen.findByText(label)).closest(".MuiChip-root");
  expect(badge).toHaveStyle({
    backgroundColor: `var(--wms-${color}-soft)`,
    color: `var(--wms-${color === "secondary" ? "secondary-dark" : `${color}-text`})`,
  });
});

it("opens the outbound detail as a right panel with grouped label actions", async () => {
  renderWithProviders(
    <AlignedOutboundDetailModal documentId="OUT-1" onClose={vi.fn()} />,
  );

  expect(await screen.findByText("PL-PX-20261103-001")).toBeInTheDocument();
  const drawer = document.querySelector(".hn-outbound-detail-drawer");
  expect(drawer).not.toBeNull();
  expect(drawer).toHaveClass("MuiDrawer-anchorRight");
  expect(
    drawer?.querySelector(".hn-outbound-detail__label-actions"),
  ).not.toBeNull();
  expect(screen.getByText("MA-OUT-20261103-001")).toBeInTheDocument();
  expect(
    await screen.findByRole("tab", { name: /3 · Xem và in nhãn/ }),
  ).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByTestId("attachments-panel")).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("tab", { name: /1 · Quét và đối chiếu hàng/ }),
  );
  expect(await screen.findByText("SKU-001")).toBeInTheDocument();
  expect(screen.queryByText("PL-PX-20261103-001")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Chứng từ đính kèm" }));
  expect(await screen.findByTestId("attachments-panel")).toBeInTheDocument();
});
