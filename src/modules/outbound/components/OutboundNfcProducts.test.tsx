import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

const service = vi.hoisted(() => ({ fetchOutboundNfcItems: vi.fn() }));
vi.mock("@/modules/outbound/services/outboundNfcService", () => ({
  fetchOutboundNfcItems: service.fetchOutboundNfcItems,
}));
vi.mock("./OutboundNfcProductDetail", () => ({
  OutboundNfcProductDetail: () => <div>Chi tiết NFC thử nghiệm</div>,
}));

import { OutboundNfcProducts } from "./OutboundNfcProducts";

const assigned = {
  document_id: "doc-1",
  document_no: "PX-0030",
  document_status: "POSTED",
  item_id: "item-1",
  item_code: "SP-0001",
  serial_number: "SN-0001",
  sku_code: "HN-PROD-001",
  sku_name: "Máy khoan",
  nfc_status: "ASSIGNED",
  nfc: {
    physical_code_id: "tag-1",
    hardware_uid: "04A1B2",
    assigned_at: "2026-10-31T10:20:00Z",
    actor_name: "Nguyễn Văn Nam",
  },
};
const unassigned = {
  ...assigned,
  item_id: "item-2",
  item_code: "SP-0002",
  serial_number: "SN-0002",
  nfc_status: "UNASSIGNED",
  nfc: null,
};

describe("OutboundNfcProducts", () => {
  beforeEach(() => {
    service.fetchOutboundNfcItems.mockReset().mockResolvedValue({
      data: [assigned, unassigned],
      meta: {
        current_page: 1,
        per_page: 10,
        total: 2,
        tab_totals: { ALL: 2, ASSIGNED: 1, UNASSIGNED: 1 },
      },
    });
  });
  afterEach(() => cleanupTestState());

  it("shows active UID and distinct unassigned state without chip actions", async () => {
    renderWithProviders(<OutboundNfcProducts />);

    expect(await screen.findByText("SP-0001")).toBeInTheDocument();
    expect(screen.getByText("04A1B2")).toBeInTheDocument();
    expect(screen.getByText("SP-0002")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa gắn NFC").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Gán chip" })).toBeNull();
    expect(service.fetchOutboundNfcItems).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: undefined }),
      expect.anything(),
    );
  });

  it("filters on the server for the chosen document and NFC status", async () => {
    renderWithProviders(<OutboundNfcProducts documentId="doc-1" />);
    await screen.findByText("SP-0001");

    fireEvent.click(screen.getByRole("button", { name: /Đã gắn NFC.*1/ }));
    await waitFor(() =>
      expect(service.fetchOutboundNfcItems).toHaveBeenLastCalledWith(
        expect.objectContaining({
          documentId: "doc-1",
          nfcStatus: "ASSIGNED",
        }),
        expect.anything(),
      ),
    );
  });
});
