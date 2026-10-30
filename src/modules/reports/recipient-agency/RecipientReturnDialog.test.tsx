import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { RecipientReturnDialog } from "./RecipientReturnDialog";

describe("RecipientReturnDialog", () => {
  it("shows canonical return document linked to its outbound source and reconciled totals", () => {
    renderWithProviders(
      <RecipientReturnDialog
        recipientName="Đại lý Minh Anh"
        events={[{ event_type: "ISSUE_POSTED", outbound_document_id: "out-1", outbound_no: "PX-001", occurred_at: "2026-10-24", quantity: 5 }]}
        reversalRows={[{ id: "rv-1", reversal_code: "RV-001", reference_document_id: "out-1", status: "POSTED", total_qty: 2, posted_at: "2026-10-28" }]}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("RV-001")).toBeInTheDocument();
    expect(screen.getAllByText("PX-001").length).toBeGreaterThan(0);
    expect(screen.getByTestId("return-net-total")).toHaveTextContent("3");
  });
});
