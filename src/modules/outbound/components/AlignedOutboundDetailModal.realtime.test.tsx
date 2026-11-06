import { useEffect } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import { tStatic } from "@/shared/i18n/useT";

const service = vi.hoisted(() => ({
  fetchOutboundDetail: vi.fn(),
  fetchPackingLabels: vi.fn(),
  fetchPrinterConfigs: vi.fn(),
  createPackingLabel: vi.fn(),
}));
vi.mock(
  "@/modules/outbound/services/alignedOutboundService",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/outbound/services/alignedOutboundService")
    >()),
    ...service,
  }),
);
import { AlignedOutboundDetailModal } from "./AlignedOutboundDetailModal";

let liveClient: QueryClient;
function QueryCapture() {
  const client = useQueryClient();
  useEffect(() => {
    liveClient = client;
  }, [client]);
  return null;
}
const label = {
  id: "label-1",
  version: 3,
  documentId: "OUT-1",
  labelCode: "LABEL-LIVE-1",
  outboundNo: "PX-001",
  sourceRequestNo: "REQ-001",
  recipientName: "Agency A",
  recipientAddress: "",
  customerPhone: "",
  itemCount: 0,
  skuCount: 0,
  skuSummary: [],
  status: "READY_TO_PRINT",
  applied: false,
  reprintCount: 0,
  payload: {},
};
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ isSuperAdmin: true });
  service.fetchOutboundDetail.mockResolvedValue({
    document: {
      id: "OUT-1",
      code: "PX-001",
      outboundRequestId: "REQ-1",
      requestNo: "REQ-001",
      date: "2026-11-06",
      warehouseId: "WH-1",
      recipientName: "Agency A",
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
  service.fetchPackingLabels.mockResolvedValue([]);
  service.fetchPrinterConfigs.mockResolvedValue([]);
  service.createPackingLabel.mockResolvedValue(label);
});
afterEach(cleanupTestState);

it("keeps a freshly prepared label ahead of an older response but adopts a newer remote label version", async () => {
  renderWithProviders(
    <>
      <QueryCapture />
      <AlignedOutboundDetailModal documentId="OUT-1" onClose={vi.fn()} />
    </>,
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: tStatic("outbound.detail.prepareAgain"),
    }),
  );
  await screen.findByText("LABEL-LIVE-1");
  await act(async () => {
    liveClient.setQueryData(
      ["mvp-outbound", "packing-labels", "OUT-1"],
      [{ ...label, version: 2, status: "PREVIEWED" }],
    );
  });
  expect(
    await screen.findByText(tStatic("outbound.detail.labelStatusReadyToPrint")),
  ).toBeInTheDocument();
  await act(async () => {
    liveClient.setQueryData(
      ["mvp-outbound", "packing-labels", "OUT-1"],
      [{ ...label, version: 4, status: "PRINTED" }],
    );
  });
  expect(
    await screen.findByText(tStatic("outbound.detail.labelStatusPrinted")),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(tStatic("outbound.detail.labelStatusReadyToPrint")),
  ).not.toBeInTheDocument();
  await act(async () => {
    liveClient.setQueryData(
      ["mvp-outbound", "packing-labels", "OUT-1"],
      [
        {
          ...label,
          id: "replacement-label",
          labelCode: "LABEL-REPLACEMENT",
          version: 1,
        },
      ],
    );
  });
  expect(await screen.findByText("LABEL-REPLACEMENT")).toBeInTheDocument();
  expect(screen.queryByText("LABEL-LIVE-1")).not.toBeInTheDocument();
});
