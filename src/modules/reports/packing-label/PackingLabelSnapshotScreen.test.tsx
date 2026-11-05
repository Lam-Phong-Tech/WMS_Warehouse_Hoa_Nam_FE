import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { PackingLabelSnapshotScreen } from "./PackingLabelSnapshotScreen";
import type {
  PackingLabelDetail,
  PackingLabelEvent,
} from "./packing-label-api";

const attempt: PackingLabelEvent = {
  eventId: "event-1",
  labelId: "label-1",
  labelCode: "PL-001",
  outboundNo: "PX-001",
  outboundDate: "2026-11-05",
  recipient: "Đại lý Hoa Nam",
  action: "PRINT",
  result: "PRINTED",
  attemptedAt: "2026-11-05T08:00:00+07:00",
  attemptNo: 1,
  printerId: "printer-1",
  printerName: "Máy in A",
  actorId: "actor-1",
  actorName: "Người in A",
  errorCode: "",
  reasonCode: "",
  reasonNote: "",
  auditComplete: true,
  auditMissing: [],
};
const detail: PackingLabelDetail = {
  labelId: "label-1",
  outboundDocumentId: "out-1",
  labelCode: "PL-001",
  outboundNo: "PX-001",
  outboundDate: "2026-11-05",
  recipient: "Đại lý Hoa Nam",
  status: "PRINTED",
  version: "v2",
  appliedAt: "",
  createdAt: "2026-11-05T07:00:00+07:00",
  content: "",
  snapshotRecipient: "Đại lý Hoa Nam",
  missingFields: [],
  items: [{ code: "SKU-A", name: "Máy khoan", quantity: 1, unit: "cái" }],
  sourceNo: "PX-001",
  attempts: [
    {
      ...attempt,
      eventId: "event-2",
      action: "REPRINT",
      attemptNo: 2,
      reasonNote: "Nhãn rách",
    },
    attempt,
  ],
};
function renderDetail(value: PackingLabelDetail) {
  renderWithProviders(
    <PackingLabelSnapshotScreen
      detail={value}
      selectedEvent={attempt}
      loading={false}
      error={null}
      preview={false}
      onBack={vi.fn()}
      onPreview={vi.fn()}
      onPrint={vi.fn()}
      onOpenSource={vi.fn()}
      onRetry={vi.fn()}
      canPrint
      canReprint
      busy={false}
    />,
  );
  return within(screen.getByTestId("packing-label-detail"));
}

describe("PackingLabelSnapshotScreen", () => {
  it("shows label fields and common printer/operator once while preserving every attempt", () => {
    const view = renderDetail(detail);
    for (const text of [
      "PL-001",
      "PX-001",
      "v2",
      "Đại lý Hoa Nam",
      "Máy in A",
      "Người in A",
      "Nhãn rách",
    ]) {
      expect(view.getAllByText(text)).toHaveLength(1);
    }
    expect(view.queryByText("Toa xuất")).not.toBeInTheDocument();
    expect(
      view.queryByText("Chi tiết lượt in đang xem"),
    ).not.toBeInTheDocument();
    const history = view.getByRole("region", { name: "Lịch sử in nhãn" });
    expect(within(history).getAllByRole("row")).toHaveLength(3);
    expect(history.querySelector('[aria-current="true"]')).toHaveTextContent(
      "1",
    );
  });
  it("keeps different printers and operators attached to the correct attempt", () => {
    const view = renderDetail({
      ...detail,
      attempts: [
        {
          ...detail.attempts[0],
          printerName: "Máy in B",
          actorName: "Người in B",
        },
        attempt,
      ],
    });
    const rows = view.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Máy in B")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Người in B")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Máy in A")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Người in A")).toBeInTheDocument();
  });
  it("summarizes a shared printer while retaining different operators per attempt", () => {
    const view = renderDetail({
      ...detail,
      attempts: [{ ...detail.attempts[0], actorName: "Người in B" }, attempt],
    });
    expect(view.getAllByText("Máy in A")).toHaveLength(1);
    const rows = view.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Người in B")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Người in A")).toBeInTheDocument();
  });
  it("explains an empty print history without inventing printer or operator data", () => {
    const view = renderDetail({ ...detail, attempts: [] });
    expect(view.getByText("Chưa có lịch sử in.")).toBeInTheDocument();
    expect(view.queryByText("Máy in A")).not.toBeInTheDocument();
    expect(view.queryByRole("table")).not.toBeInTheDocument();
  });
});
