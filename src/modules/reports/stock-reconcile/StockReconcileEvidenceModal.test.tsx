import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("./stock-reconcile-api", () => ({
  useSkuMovements: vi.fn(),
}));

import { useSkuMovements } from "./stock-reconcile-api";
import { StockReconcileEvidenceModal } from "./StockReconcileEvidenceModal";

describe("StockReconcileEvidenceModal", () => {
  afterEach(cleanupTestState);

  it("shows the selected SKU's actual reconciliation checks and recorded movements", async () => {
    vi.mocked(useSkuMovements).mockReturnValue({
      events: [
        {
          id: "mv-1",
          movement_no: "MV-0001",
          movement_type: "RECEIPT",
          occurred_at: "2026-10-28T09:00:00Z",
          warehouse_code: "HN01",
          qty_delta: 3,
        },
      ],
      loading: false,
    } as never);
    const onClose = vi.fn();

    renderWithProviders(
      <StockReconcileEvidenceModal
        skuCode="HN-DRV-001"
        skuName="Bộ điều khiển động cơ"
        warehouse="HN01"
        opening={100}
        inbound={5}
        productOutbound={15}
        componentOutbound={0}
        reversal={2}
        closing={92}
        actual={90}
        delta={-2}
        checks={["ledger_to_balance", "serial_subledger"]}
        onClose={onClose}
      />,
    );

    expect(await screen.findByRole("dialog", { name: /HN-DRV-001/ })).toBeInTheDocument();
    expect(screen.getByText(/Sổ cái/)).toBeInTheDocument();
    expect(screen.getByText("MV-0001")).toBeInTheDocument();
    expect(screen.queryByText("MV-1")).not.toBeInTheDocument();
    expect(useSkuMovements).toHaveBeenCalledWith("HN-DRV-001");
    fireEvent.click(screen.getByRole("button", { name: /Đóng/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not invent serial mismatch details when the API only supplies aggregate checks", () => {
    vi.mocked(useSkuMovements).mockReturnValue({ events: [], loading: false } as never);
    renderWithProviders(
      <StockReconcileEvidenceModal
        skuCode="HN-SEN-003"
        skuName="Cảm biến"
        warehouse="HN01"
        opening={60}
        inbound={0}
        productOutbound={0}
        componentOutbound={0}
        reversal={0}
        closing={60}
        actual={60}
        delta={0}
        checks={["serial_subledger"]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/chưa có danh sách mã chênh lệch/)).toBeInTheDocument();
    expect(screen.queryByText(/SN-SEN-/)).not.toBeInTheDocument();
  });
});
