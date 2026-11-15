import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import {
  InboundReceiptHistory,
  InboundReceiptNote,
  InboundReceiptProgress,
} from "./InboundReceiptPresentation";

describe("approved inbound receipt presentation", () => {
  it("keeps a long note collapsed and supports expanding and collapsing without losing text", () => {
    const note = "Kiểm tra số lượng và tình trạng hàng hóa. ".repeat(20);
    renderWithProviders(<InboundReceiptNote note={note} />);
    const button = screen.getByRole("button", { name: "Xem thêm" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Thu gọn" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText(note.trim())).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn" }));
    expect(screen.getByRole("button", { name: "Xem thêm" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("does not offer disclosure for an empty note", () => {
    renderWithProviders(<InboundReceiptNote />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows cancellation as the end of the progress rather than successful posting", () => {
    renderWithProviders(<InboundReceiptProgress status="CANCELLED" />);
    expect(screen.getByText("Đã hủy phiếu")).toBeInTheDocument();
    expect(screen.queryByText("Đã nhập kho")).not.toBeInTheDocument();
  });

  it("shows persisted actors and timestamps and does not use receipt updatedAt as an action time", () => {
    renderWithProviders(
      <InboundReceiptHistory
        events={[
          {
            id: "event-1",
            action: "CANCEL",
            actorName: "Người hủy phiếu",
            occurredAt: "2026-11-15T09:27:00Z",
            note: "Nhập nhầm nhà cung cấp",
          },
        ]}
      />,
    );
    expect(screen.getByText("Hủy phiếu nhập")).toBeInTheDocument();
    expect(screen.getByText("Người hủy phiếu")).toBeInTheDocument();
    expect(screen.getByText("15/11/2026 16:27")).toBeInTheDocument();
    expect(screen.getByText("Nhập nhầm nhà cung cấp")).toBeInTheDocument();
  });
});
