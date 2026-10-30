import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

const mocks = vi.hoisted(() => ({
  fetchLabelSnapshots: vi.fn(),
  printLabelSnapshot: vi.fn(),
  reprintLabelSnapshot: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/modules/outbound/services/mvpOutboundService", () => mocks);
vi.mock("@/modules/reports/operations/report-export", () => ({
  useReportExport: () => ({ exporting: null, exportReport: vi.fn() }),
}));
vi.mock("./packing-label-api", () => ({
  usePackingLabelSnapshot: () => ({ detail: null, loading: false, error: null }),
  usePackingLabelReport: () => ({
    events: [
      {
        eventId: "event-1",
        labelId: "label-1",
        labelCode: "PL-001",
        outboundNo: "PX-001",
        recipient: "Đại lý Hoa Nam",
        result: "PRINTED",
        action: "PRINT",
        attemptedAt: "2026-09-01T08:00:00+07:00",
        attemptNo: 1,
        printerId: "printer-1",
        printerName: "Máy in kho",
        actorName: "Thủ kho",
      },
    ],
    labels: new Map([["label-1", { skuSummary: "SKU-001 x1" }]]),
    printerOptions: [{ value: "printer-1", label: "Máy in kho" }],
    loading: false,
    error: null,
    eventsError: null,
    refetch: mocks.refetch,
  }),
}));

import PackingLabelPrintReport from "./PackingLabelPrintReport";

async function openReprint(user: ReturnType<typeof userEvent.setup>) {
  renderWithProviders(<PackingLabelPrintReport />);
  await user.click(
    within(screen.getByRole("table")).getByRole("button", { name: "In lại" }),
  );
  return screen.findByRole("dialog", { name: "In lại nhãn" });
}

describe("packing-label reprint reason dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchLabelSnapshots.mockResolvedValue([
      { id: "label-1", documentId: "outbound-1", version: 7 },
    ]);
    mocks.reprintLabelSnapshot.mockResolvedValue({});
  });
  afterEach(cleanupTestState);

  it("closes without sending or fetching anything when cancelled", async () => {
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.fetchLabelSnapshots).not.toHaveBeenCalled();
    expect(mocks.reprintLabelSnapshot).not.toHaveBeenCalled();
    expect(mocks.printLabelSnapshot).not.toHaveBeenCalled();
  });

  it("requires a reason and submits its trimmed value with the fresh snapshot version", async () => {
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Xác nhận in lại" }),
    );
    expect(
      within(dialog).getByText("Nhập lý do in lại nhãn."),
    ).toBeInTheDocument();
    expect(mocks.reprintLabelSnapshot).not.toHaveBeenCalled();

    await user.type(
      within(dialog).getByRole("textbox", { name: /Lý do in lại nhãn/ }),
      "  Nhãn bị nhòe  ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Xác nhận in lại" }),
    );
    await waitFor(() =>
      expect(mocks.reprintLabelSnapshot).toHaveBeenCalledWith({
        documentId: "outbound-1",
        labelId: "label-1",
        printerConfigId: "printer-1",
        ifMatch: 7,
        reason: "Nhãn bị nhòe",
        idempotencyKey: expect.stringMatching(/^rpt05-reprint-/),
      }),
    );
    expect(mocks.reprintLabelSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("does not print when the fresh snapshot has no version", async () => {
    mocks.fetchLabelSnapshots.mockResolvedValue([
      { id: "label-1", documentId: "outbound-1" },
    ]);
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    await user.type(
      within(dialog).getByRole("textbox", { name: /Lý do in lại nhãn/ }),
      "Nhãn bị nhòe",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Xác nhận in lại" }),
    );
    expect(
      await within(dialog).findByText("Thiếu thông tin phiên bản hoặc máy in."),
    ).toBeInTheDocument();
    expect(mocks.reprintLabelSnapshot).not.toHaveBeenCalled();
  });
});
