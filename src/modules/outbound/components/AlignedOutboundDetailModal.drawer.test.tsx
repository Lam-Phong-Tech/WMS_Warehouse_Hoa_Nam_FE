import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";
import { translate } from "@/shared/i18n/useT";

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

describe("OUT-01 document detail drawer", () => {
  it("opens the loading state from the right and closes from the header", () => {
    service.fetchOutboundDetail.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();

    renderWithProviders(
      <AlignedOutboundDetailModal documentId="OUT-1" onClose={onClose} />,
    );

    const dialog = screen.getByRole("dialog", { name: "Chi tiết phiếu xuất" });
    expect(dialog.closest(".MuiDrawer-root")).not.toBeNull();
    expect(dialog.closest(".MuiDrawer-root")).toHaveClass(
      "MuiDrawer-anchorRight",
    );
    expect(
      dialog.querySelector(".hn-loading-boundary--drawer"),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Đang tải...")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the detail content in the right drawer after data loads", async () => {
    service.fetchOutboundDetail.mockResolvedValue({
      document: {
        id: "OUT-1",
        code: "PX-001",
        outboundRequestId: "REQ-1",
        requestNo: "MA-OUT-001",
        date: "2026-11-03T08:15:00",
        warehouseId: "WH-1",
        recipientName: "Đại lý A",
        recipientAddress: "",
        note: "Giao buổi sáng",
        expected: 0,
        scanned: 0,
        status: "POSTED",
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

    expect(await screen.findByText("PX-001")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Chi tiết phiếu xuất" });
    expect(dialog.closest(".MuiDrawer-root")).toHaveClass(
      "MuiDrawer-anchorRight",
    );
    expect(
      await screen.findByRole("tab", { name: "Tổng quan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("MA-OUT-001")).toBeInTheDocument();
    expect(screen.getByText("03/11/2026 08:15")).toBeInTheDocument();
    expect(screen.getByText("Giao buổi sáng")).toBeInTheDocument();
  });

  it.each([
    [null, null, "outbound.list.missingRequest"],
    ["REQ-1", null, "outbound.list.noRequestNo"],
  ] as const)(
    "shows the request warning for missing identifier %s and number %s",
    async (outboundRequestId, requestNo, messageKey) => {
      service.fetchOutboundDetail.mockResolvedValue({
        document: {
          id: "OUT-1",
          code: "PX-001",
          date: "2026-11-03",
          warehouseId: "WH-1",
          outboundRequestId,
          requestNo,
          recipientName: "Đại lý A",
          recipientAddress: "",
          expected: 0,
          scanned: 0,
          status: "POSTED",
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

      expect(
        await screen.findByText(translate("vi", messageKey)),
      ).toBeInTheDocument();
    },
  );
});
