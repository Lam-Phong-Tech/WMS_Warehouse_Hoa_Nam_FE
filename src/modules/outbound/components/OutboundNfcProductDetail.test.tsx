import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import type { OutboundNfcItem } from "../services/outboundNfcService";

const service = vi.hoisted(() => ({ fetchOutboundItemNfcHistory: vi.fn() }));
vi.mock("@/modules/outbound/services/outboundNfcService", () => ({
  fetchOutboundItemNfcHistory: service.fetchOutboundItemNfcHistory,
}));

import { OutboundNfcProductDetail } from "./OutboundNfcProductDetail";

const item: OutboundNfcItem = {
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

describe("OutboundNfcProductDetail", () => {
  beforeEach(() =>
    service.fetchOutboundItemNfcHistory.mockReset().mockResolvedValue({
      data: [
        {
          id: "evt-1",
          action: "ASSIGN_ITEM_NFC",
          result: "SUCCESS",
          reason: null,
          actor_name: "Nguyễn Văn Nam",
          hardware_uid: "04A1B2",
          created_at: "2026-10-31T10:20:00Z",
        },
      ],
      meta: { current_page: 1, per_page: 10, total: 1 },
    }),
  );
  afterEach(() => cleanupTestState());

  it("reuses the document panel without stacking a second drawer", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <OutboundNfcProductDetail embedded item={item} onClose={onClose} />,
    );
    expect(await screen.findByText("SP-0001")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(service.fetchOutboundItemNfcHistory).not.toHaveBeenCalled();
  });

  it("shows the current chip and item history without a write action", async () => {
    renderWithProviders(
      <OutboundNfcProductDetail item={item} onClose={() => {}} />,
    );
    expect(await screen.findByText("Nguyễn Văn Nam")).toBeInTheDocument();
    expect(screen.getByText("04A1B2")).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: /Chi tiết sản phẩm/ }),
    ).toBeInTheDocument();
    expect(service.fetchOutboundItemNfcHistory).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole(
        "tab",
        { name: "Lịch sử liên kết NFC" },
        { timeout: 5000 },
      ),
    );
    expect(await screen.findByText("Đã liên kết chip")).toBeInTheDocument();
    expect(service.fetchOutboundItemNfcHistory).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Thu hồi chip" })).toBeNull();
  });
});
