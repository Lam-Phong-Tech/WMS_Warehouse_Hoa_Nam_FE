import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";

const mocks = vi.hoisted(() => ({
  snapshotGet: vi.fn(),
  rowResult: "PRINTED",
  detail: null as unknown,
  printLabelSnapshot: vi.fn(),
  reprintLabelSnapshot: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/modules/outbound/services/mvpOutboundService", () => mocks);
vi.mock("@/shared/api/http", () => ({ http: { get: mocks.snapshotGet } }));
vi.mock("@/modules/reports/operations/report-export", () => ({
  useReportExport: () => ({ exporting: null, exportReport: vi.fn() }),
}));
vi.mock("./packing-label-api", () => ({
  usePackingLabelSnapshot: () => ({
    detail: mocks.detail,
    loading: false,
    error: null,
  }),
  usePackingLabelReport: () => ({
    events: [
      {
        eventId: "event-1",
        labelId: "label-1",
        labelCode: "PL-001",
        outboundNo: "PX-001",
        recipient: "Đại lý Hoa Nam",
        result: mocks.rowResult,
        action: "PRINT",
        attemptedAt: "2026-09-01T08:00:00+07:00",
        attemptNo: 1,
        printerId: "printer-1",
        printerName: "Máy in kho",
        actorName: "Thủ kho",
      },
    ],
    labels: new Map([
      [
        "label-1",
        {
          skuSummary: "SKU-001 x1",
          status: "PRINTED",
          labelCode: "PL-001",
          outboundNo: "PX-001",
          recipient: "Đại lý Hoa Nam",
        },
      ],
    ]),
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
    mocks.rowResult = "PRINTED";
    mocks.detail = null;
    useAuthStore.setState({
      permissionCodes: ["label.print", "label.reprint"],
      isSuperAdmin: false,
    });
    mocks.snapshotGet.mockResolvedValue({
      id: "label-1",
      outbound_document_id: "outbound-1",
      version: 7,
      status: "PRINTED",
      label_payload: {
        outbound_no: "PX-001",
        recipient_name: "Đại lý Hoa Nam",
        items: [{ sku_code: "SKU-001", quantity: 1 }],
      },
      print_events: [{ id: "previous", status: "PRINTED" }],
    });
    mocks.reprintLabelSnapshot.mockResolvedValue({});
  });
  afterEach(() => {
    act(() => useLanguageStore.getState().setLanguage("vi"));
    cleanupTestState();
  });

  it("switches an open confirmation and its validation to English while preserving the entered reason", async () => {
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    const reason = await within(dialog).findByRole("textbox", {
      name: /Lý do in lại nhãn/,
    });
    await user.type(reason, "Nhãn bị nhòe");
    await act(async () => {
      await ensureEnglishMessages();
      useLanguageStore.getState().setLanguage("en");
    });
    expect(
      screen.getByRole("dialog", { name: "Reprint label" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("textbox", { name: /Label reprint reason/ }),
    ).toHaveValue("Nhãn bị nhòe");
    expect(
      within(dialog).getByRole("combobox", { name: "Command printer" }),
    ).toHaveTextContent("Máy in kho");
    expect(dialog).toHaveTextContent("Outbound: PX-001");
    expect(dialog).toHaveTextContent(
      "Recorded attempts: 1 · Send 1 more attempt",
    );
    expect(dialog).toHaveTextContent("Maximum 500 characters.");
    await user.clear(reason);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm reprint" }),
    );
    expect(
      within(dialog).getByText("Enter a reason for reprinting the label."),
    ).toBeInTheDocument();
    await user.type(reason, " Nhãn bị nhòe ");
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm reprint" }),
    );
    expect(
      await screen.findByText(
        "Print request received. Follow the result in the history.",
      ),
    ).toBeInTheDocument();
    expect(mocks.reprintLabelSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "Nhãn bị nhòe",
        ifMatch: 7,
        printerConfigId: "printer-1",
      }),
    );
    await act(async () => useLanguageStore.getState().setLanguage("vi"));
    expect(
      screen.getByText(
        "Đã tiếp nhận yêu cầu in. Theo dõi kết quả trong lịch sử.",
      ),
    ).toBeInTheDocument();
  });

  it("cancels after checking the chosen snapshot without sending a print command", async () => {
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(http.get).toHaveBeenCalledTimes(1);
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
      await within(dialog).findByRole("textbox", { name: /Lý do in lại nhãn/ }),
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

  it("blocks a fresh snapshot missing its version before confirmation", async () => {
    mocks.snapshotGet.mockResolvedValue({
      id: "label-1",
      outbound_document_id: "outbound-1",
      status: "PRINTED",
      label_payload: {
        outbound_no: "PX-001",
        recipient_name: "Đại lý",
        items: [{ sku_code: "SKU-001", quantity: 1 }],
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<PackingLabelPrintReport />);
    await user.click(
      within(screen.getByRole("table")).getByRole("button", { name: "In lại" }),
    );
    expect(
      await screen.findByText("Thiếu thông tin phiên bản hoặc phiếu xuất."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.reprintLabelSnapshot).not.toHaveBeenCalled();
  });
  it("uses current PRINTED state when retrying a historical failed attempt", async () => {
    mocks.rowResult = "PRINT_FAILED";
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    await user.type(
      await within(dialog).findByRole("textbox", { name: /Lý do in lại nhãn/ }),
      "Nhãn hỏng",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Xác nhận in lại" }),
    );
    await waitFor(() =>
      expect(mocks.reprintLabelSnapshot).toHaveBeenCalledTimes(1),
    );
    expect(mocks.printLabelSnapshot).not.toHaveBeenCalled();
  });
  it("does not confirm print when the fresh snapshot has an unresolved attempt", async () => {
    const raw = await mocks.snapshotGet();
    mocks.snapshotGet.mockResolvedValue({
      ...raw,
      print_events: [{ id: "pending", status: "SENT" }],
    });
    const user = userEvent.setup();
    renderWithProviders(<PackingLabelPrintReport />);
    await user.click(
      within(screen.getByRole("table")).getByRole("button", { name: "In lại" }),
    );
    expect(
      await screen.findByText(/Chưa có phản hồi cuối cùng từ máy in/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "In lại nhãn" }),
    ).not.toBeInTheDocument();
    expect(mocks.reprintLabelSnapshot).not.toHaveBeenCalled();
  });
  it("does not treat an old successful attempt as resolution of a timed-out request", async () => {
    mocks.reprintLabelSnapshot.mockRejectedValueOnce(
      new Error("Network timeout"),
    );
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    await user.type(
      await within(dialog).findByRole("textbox", { name: /Lý do in lại nhãn/ }),
      "Nhãn hỏng",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Xác nhận in lại" }),
    );
    const check = await screen.findByRole("button", {
      name: "Kiểm tra trạng thái",
    });
    await user.click(check);
    expect(
      await screen.findByText(/Chưa có kết quả cuối cùng/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByRole("button", { name: "In lại" }),
    ).toBeDisabled();
    expect(mocks.reprintLabelSnapshot).toHaveBeenCalledTimes(1);
  });
  it("locks printing after an ambiguous HTTP gateway failure", async () => {
    mocks.reprintLabelSnapshot.mockRejectedValueOnce(
      Object.assign(new Error("Request failed with status code 504"), {
        response: { status: 504 },
      }),
    );
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    await user.type(
      await within(dialog).findByRole("textbox", { name: /Lý do in lại nhãn/ }),
      "Nhãn hỏng",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Xác nhận in lại" }),
    );
    expect(
      await screen.findByRole("button", { name: "Kiểm tra trạng thái" }),
    ).toBeEnabled();
    expect(
      within(screen.getByRole("table")).getByRole("button", { name: "In lại" }),
    ).toBeDisabled();
  });
  it("reloads the snapshot before retrying a finalized printer failure", async () => {
    mocks.reprintLabelSnapshot.mockRejectedValueOnce(
      Object.assign(new Error("In thất bại"), { response: { status: 409 } }),
    );
    const user = userEvent.setup();
    const dialog = await openReprint(user);
    await user.type(
      await within(dialog).findByRole("textbox", { name: /Lý do in lại nhãn/ }),
      "Nhãn hỏng",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Xác nhận in lại" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const raw = await mocks.snapshotGet();
    mocks.snapshotGet.mockResolvedValue({ ...raw, version: 9 });
    await user.click(
      within(screen.getByRole("table")).getByRole("button", { name: "In lại" }),
    );
    const next = await screen.findByRole("dialog", { name: "In lại nhãn" });
    await user.type(
      await within(next).findByRole("textbox", { name: /Lý do in lại nhãn/ }),
      "Đã kiểm tra giấy",
    );
    await user.click(
      within(next).getByRole("button", { name: "Xác nhận in lại" }),
    );
    await waitFor(() =>
      expect(mocks.reprintLabelSnapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ ifMatch: 9 }),
      ),
    );
  });
  it("keeps uncertain-result feedback and reconciliation reachable inside the detail drawer", async () => {
    mocks.detail = {
      labelId: "label-1",
      outboundDocumentId: "outbound-1",
      labelCode: "PL-001",
      outboundNo: "PX-001",
      status: "PRINTED",
      version: "v7",
      attempts: [
        {
          eventId: "previous",
          result: "PRINTED",
          action: "PRINT",
          attemptedAt: "2026-11-05T08:00:00+07:00",
          attemptNo: 1,
          printerId: "printer-1",
          printerName: "Máy in kho",
          actorName: "Thủ kho",
        },
      ],
      missingFields: [],
      items: [{ code: "SKU-001", quantity: 1, name: "Máy khoan", unit: "cái" }],
    };
    mocks.reprintLabelSnapshot.mockRejectedValueOnce(
      new Error("Network timeout"),
    );
    const user = userEvent.setup();
    renderWithProviders(<PackingLabelPrintReport />);
    await user.click(
      screen.getByRole("button", { name: "Xem chi tiết nhãn PL-001" }),
    );
    const drawer = await screen.findByRole("dialog", {
      name: /^Chi tiết nhãn đóng gói/,
    });
    await user.click(
      await within(drawer).findByRole("button", { name: "In lại nhãn" }),
    );
    const confirm = await screen.findByRole("dialog", { name: "In lại nhãn" });
    await user.type(
      await within(confirm).findByRole("textbox", {
        name: /Lý do in lại nhãn/,
      }),
      "Nhãn hỏng",
    );
    await user.click(
      within(confirm).getByRole("button", { name: "Xác nhận in lại" }),
    );
    expect(
      await within(drawer).findByText(/Chưa xác định kết quả gửi lệnh/),
    ).toBeInTheDocument();
    expect(
      await within(drawer).findByRole("button", {
        name: "Kiểm tra trạng thái",
      }),
    ).toBeEnabled();
    expect(
      within(drawer).getByRole("button", { name: "In lại nhãn" }),
    ).toBeDisabled();
  });
});
