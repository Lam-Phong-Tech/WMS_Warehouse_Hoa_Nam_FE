import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import dayjs from "dayjs";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { translate } from "@/shared/i18n/useT";

const data = vi.hoisted(() => {
  const skuRows = [
    {
      sku_id: "SKU-1",
      sku_code: "SKU-001",
      sku_name: "Sản phẩm",
      available: 10,
    },
  ];
  return {
    skuRows,
    skuQuery: { data: { data: skuRows }, isFetching: false },
    agencyQuery: { data: { data: [] }, isFetching: false },
  };
});
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpSkus: () => data.skuQuery,
  useMvpAgencies: () => data.agencyQuery,
}));
vi.mock("@/modules/master-data/components/RecipientCreateDialog", () => ({
  RecipientCreateDialog: () => null,
}));
vi.mock("@/modules/outbound/services/mvpOutboundService", () => ({
  consumeOutboundImport: vi.fn(),
  fetchAvailableQtyBySku: vi.fn().mockResolvedValue({}),
  searchAvailableProductSkus: vi.fn().mockResolvedValue(data.skuRows),
  uploadOutboundRequestFile: vi.fn(),
  validateOutboundRequestRows: vi.fn(),
}));
vi.mock("@/shared/api/documentAttachmentService", () => ({
  uploadDocumentAttachment: vi.fn(),
}));

import {
  consumeOutboundImport,
  validateOutboundRequestRows,
} from "@/modules/outbound/services/mvpOutboundService";
import { uploadDocumentAttachment } from "@/shared/api/documentAttachmentService";
import { OutboundIntakeModal } from "./OutboundIntakeModal";

const dateLabel = translate("vi", "outbound.intake.fieldRequestDate");
const validateLabel = translate("vi", "outbound.intake.validate");
const confirmLabel = translate("vi", "outbound.intake.confirm");
const selectAttachmentsLabel = translate(
  "vi",
  "shared.attachments.selectFiles",
);

function renderIntake(canImport = true, canAttach = true) {
  return renderWithProviders(
    <OutboundIntakeModal
      open
      canImport={canImport}
      canAttach={canAttach}
      onClose={vi.fn()}
      onConsumed={vi.fn()}
    />,
  );
}

async function fillRequiredFields() {
  fireEvent.change(
    await screen.findByRole("textbox", {
      name: new RegExp(translate("vi", "outbound.intake.fieldRecipient")),
    }),
    { target: { value: "Nơi nhận A" } },
  );
  const sku = screen.getByRole("combobox", {
    name: new RegExp(translate("vi", "outbound.intake.fieldSku")),
  });
  fireEvent.mouseDown(sku);
  fireEvent.click(await screen.findByRole("option", { name: /SKU-001/ }));
}

beforeEach(() => {
  vi.mocked(validateOutboundRequestRows).mockResolvedValue({
    id: "IMPORT-1",
    status: "VALIDATED",
    totalRows: 1,
    validRows: 1,
    errorRows: 0,
    rows: [],
  } as unknown as Awaited<ReturnType<typeof validateOutboundRequestRows>>);
});
afterEach(() => {
  cleanupTestState();
  vi.clearAllMocks();
});

describe("OUT-01 request intake drawer", () => {
  it("uses Vietnamese file controls and keeps technical headers collapsed", async () => {
    renderIntake();
    fireEvent.click(
      await screen.findByRole("button", { name: "Nhập từ Excel" }),
    );
    expect(await screen.findByText("Chọn tệp Excel")).toBeInTheDocument();
    expect(screen.getByText("Chưa chọn tệp")).toBeInTheDocument();
    const requiredColumns = await screen.findByText(
      "Mã phiếu yêu cầu · Mã SKU · Số lượng yêu cầu · Tên người nhận / khách hàng",
    );
    await waitFor(() => expect(requiredColumns).toBeVisible());
    const technicalHeaders = screen.getByText(
      /request_no · sku_code · required_qty/,
    );
    expect(technicalHeaders).not.toBeVisible();
    fireEvent.change(screen.getByLabelText("Chọn tệp Excel yêu cầu xuất"), {
      target: {
        files: [
          new File(["sheet"], "yeu-cau.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });
    expect(screen.getByText("yeu-cau.xlsx")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Tải lên & xem trước" }),
    ).toBeEnabled();
  });

  it("opens on the right and keeps both intake modes available", async () => {
    renderIntake();

    const drawer = screen.getByRole("dialog", {
      name: translate("vi", "outbound.intake.title"),
    });
    expect(drawer.closest(".MuiDrawer-root")).not.toBeNull();
    expect(drawer.closest(".MuiDrawer-root")).toHaveClass(
      "MuiDrawer-anchorRight",
    );
    expect(
      await screen.findByRole("button", {
        name: translate("vi", "outbound.intake.tabManual"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: translate("vi", "outbound.intake.tabExcel"),
      }),
    ).toBeInTheDocument();
  });

  it("keeps the intake mode tabs in the fixed drawer header", async () => {
    renderIntake();

    const drawer = screen.getByRole("dialog", {
      name: translate("vi", "outbound.intake.title"),
    });
    const header = drawer.querySelector<HTMLElement>(
      ".hn-outbound-intake-drawer__header",
    );
    const loadingSurface = drawer.querySelector(".hn-loading-boundary--drawer");
    const manualTab = await screen.findByRole("button", {
      name: translate("vi", "outbound.intake.tabManual"),
    });
    const excelTab = screen.getByRole("button", {
      name: translate("vi", "outbound.intake.tabExcel"),
    });
    const closeButton = within(header as HTMLElement).getByRole("button", {
      name: translate("vi", "common.close"),
    });

    expect(header).toContainElement(manualTab);
    expect(header).toContainElement(excelTab);
    expect(header).toContainElement(closeButton);
    expect(loadingSurface).not.toContainElement(manualTab);
    expect(loadingSurface).not.toContainElement(excelTab);
    expect(loadingSurface).not.toContainElement(closeButton);
  });

  it("generates the source request number without asking for it", async () => {
    renderIntake();

    expect(
      screen.queryByRole("textbox", { name: /Mã phiếu yêu cầu/ }),
    ).not.toBeInTheDocument();
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: validateLabel }));

    await waitFor(() =>
      expect(validateOutboundRequestRows).toHaveBeenCalledTimes(1),
    );
    const [rows] = vi.mocked(validateOutboundRequestRows).mock.calls[0];
    expect(rows[0].request_no).toMatch(/^TOA-\d{8}-\d{6}-[A-Z0-9]{4}$/);
  });

  it("reuses the generated request number when validating again", async () => {
    renderIntake();
    await fillRequiredFields();
    const validateButton = screen.getByRole("button", { name: validateLabel });

    fireEvent.click(validateButton);
    await waitFor(() =>
      expect(validateOutboundRequestRows).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(validateButton);
    await waitFor(() =>
      expect(validateOutboundRequestRows).toHaveBeenCalledTimes(2),
    );

    const calls = vi.mocked(validateOutboundRequestRows).mock.calls;
    expect(calls[1][0][0].request_no).toBe(calls[0][0][0].request_no);
  });

  it("keeps the validate action as the only filled primary", async () => {
    renderIntake();

    const addLineButton = await screen.findByRole("button", {
      name: translate("vi", "outbound.intake.addLine"),
    });
    const validateButton = screen.getByRole("button", { name: validateLabel });

    expect(addLineButton).toHaveAttribute("data-action-appearance", "flat");
    expect(validateButton).toHaveClass("hn-outbound-dialog__primary");
  });
});

describe("OUT-01 attachments during intake", () => {
  const consumeResult = {
    importId: "IMPORT-1",
    status: "CONSUMED",
    outboundRequestIds: ["REQ-1"],
    outboundDocumentIds: ["OUT-1"],
  };

  async function renderAndValidate(onConsumed = vi.fn()) {
    renderWithProviders(
      <OutboundIntakeModal
        open
        canImport
        canAttach
        onClose={vi.fn()}
        onConsumed={onConsumed}
      />,
    );
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: validateLabel }));
    return {
      onConsumed,
      confirm: await screen.findByRole("button", { name: confirmLabel }),
    };
  }

  function chooseFiles(files: File[]) {
    fireEvent.change(screen.getByLabelText(selectAttachmentsLabel), {
      target: { files },
    });
  }

  it("keeps selected attachments local until the outbound document is created", async () => {
    const file = new File(["image"], "delivery.png", { type: "image/png" });
    const { onConsumed, confirm } = await renderAndValidate();
    chooseFiles([file]);

    expect(screen.getByText("delivery.png")).toBeInTheDocument();
    expect(screen.getByText("Đã chọn · Chưa tải lên")).toBeInTheDocument();
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();

    vi.mocked(consumeOutboundImport).mockResolvedValue(consumeResult);
    vi.mocked(uploadDocumentAttachment).mockResolvedValue({} as never);
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(uploadDocumentAttachment).toHaveBeenCalledWith({
        documentType: "OUTBOUND",
        documentId: "OUT-1",
        file,
      }),
    );
    await waitFor(() => expect(onConsumed).toHaveBeenCalledWith(["OUT-1"]));
  });

  it("retries only failed attachments without consuming again", async () => {
    const file = new File(["image"], "delivery.png", { type: "image/png" });
    vi.mocked(consumeOutboundImport).mockResolvedValue(consumeResult);
    vi.mocked(uploadDocumentAttachment)
      .mockRejectedValueOnce(new Error("Upload failed"))
      .mockResolvedValueOnce({} as never);
    const { onConsumed, confirm } = await renderAndValidate();
    chooseFiles([file]);
    fireEvent.click(confirm);

    const retry = await screen.findByRole("button", {
      name: translate("vi", "outbound.intake.attachmentsRetry"),
    });
    expect(onConsumed).not.toHaveBeenCalled();
    fireEvent.click(retry);

    await waitFor(() => expect(onConsumed).toHaveBeenCalledWith(["OUT-1"]));
    expect(consumeOutboundImport).toHaveBeenCalledTimes(1);
    expect(
      vi
        .mocked(uploadDocumentAttachment)
        .mock.calls.map(([input]) => input.file.name),
    ).toEqual(["delivery.png", "delivery.png"]);
  });

  it("routes Escape after a failed upload through the created-document close path", async () => {
    const file = new File(["image"], "delivery.png", { type: "image/png" });
    vi.mocked(consumeOutboundImport).mockResolvedValue(consumeResult);
    vi.mocked(uploadDocumentAttachment).mockRejectedValueOnce(
      new Error("Upload failed"),
    );
    const { onConsumed, confirm } = await renderAndValidate();
    chooseFiles([file]);
    fireEvent.click(confirm);
    await screen.findByRole("button", {
      name: translate("vi", "outbound.intake.attachmentsRetry"),
    });
    fireEvent.keyDown(
      screen.getByRole("dialog", {
        name: translate("vi", "outbound.intake.title"),
      }),
      { key: "Escape", code: "Escape" },
    );
    await waitFor(() => expect(onConsumed).toHaveBeenCalledWith(["OUT-1"]));
  });

  it("attaches the files to the first document when the import creates several", async () => {
    const file = new File(["image"], "delivery.png", { type: "image/png" });
    vi.mocked(consumeOutboundImport).mockResolvedValue({
      ...consumeResult,
      outboundRequestIds: ["REQ-1", "REQ-2"],
      outboundDocumentIds: ["OUT-1", "OUT-2"],
    });
    vi.mocked(uploadDocumentAttachment).mockResolvedValue({} as never);
    const { onConsumed, confirm } = await renderAndValidate();
    chooseFiles([file]);
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(uploadDocumentAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: "OUT-1" }),
      ),
    );
    await waitFor(() =>
      expect(onConsumed).toHaveBeenCalledWith(["OUT-1", "OUT-2"]),
    );
  });

  it("rejects invalid attachment types and oversized files before creation", async () => {
    const oversized = new File(["image"], "large.png", {
      type: "image/png",
    });
    Object.defineProperty(oversized, "size", { value: 16 * 1024 * 1024 });
    await renderAndValidate();
    chooseFiles([new File(["script"], "bad.exe"), oversized]);

    expect(screen.queryByText("bad.exe")).not.toBeInTheDocument();
    expect(screen.queryByText("large.png")).not.toBeInTheDocument();
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
  });

  it("allows removing a local attachment before creating", async () => {
    const { confirm } = await renderAndValidate();
    chooseFiles([new File(["image"], "remove.png", { type: "image/png" })]);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ tệp remove.png" }));
    expect(screen.queryByText("remove.png")).not.toBeInTheDocument();
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();

    vi.mocked(consumeOutboundImport).mockResolvedValue(consumeResult);
    fireEvent.click(confirm);
    await waitFor(() => expect(consumeOutboundImport).toHaveBeenCalledOnce());
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
  });
});

describe("OUT-01 request date calendar", () => {
  it("submits the picked date as ISO without changing intake payload", async () => {
    renderIntake();
    await fillRequiredFields();
    const selected = dayjs().subtract(1, "day");
    fireEvent.click(screen.getByRole("button", { name: dateLabel }));
    fireEvent.click(
      screen.getByRole("button", { name: selected.format("DD/MM/YYYY") }),
    );
    fireEvent.click(screen.getByRole("button", { name: validateLabel }));
    await waitFor(() =>
      expect(validateOutboundRequestRows).toHaveBeenCalledWith([
        {
          request_no: expect.stringMatching(/^TOA-\d{8}-\d{6}-[A-Z0-9]{4}$/),
          request_date: selected.format("YYYY-MM-DD"),
          customer_name: "Nơi nhận A",
          customer_address: "",
          recipient_contact_phone: undefined,
          sku_id: "SKU-1",
          sku_code: "SKU-001",
          required_qty: 1,
          agency_id: null,
        },
      ]),
    );
  });

  it("clears an optional date and still permits validation", async () => {
    renderIntake();
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: dateLabel }));
    fireEvent.click(
      screen.getByRole("button", { name: dayjs().format("DD/MM/YYYY") }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name:
          translate("vi", "shared.form.autocompleteClear") + ": " + dateLabel,
      }),
    );
    expect(screen.getByRole("group", { name: dateLabel })).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: validateLabel }));
    await waitFor(() =>
      expect(validateOutboundRequestRows).toHaveBeenCalledWith([
        expect.objectContaining({ request_date: undefined }),
      ]),
    );
  });

  it("blocks future dates and retains the import permission gate", async () => {
    renderIntake(false);
    fireEvent.click(await screen.findByRole("button", { name: dateLabel }));
    expect(
      screen.getByRole("button", {
        name: dayjs().add(1, "day").format("DD/MM/YYYY"),
      }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: dayjs().format("DD/MM/YYYY") }),
    );
    expect(screen.getByRole("button", { name: validateLabel })).toBeDisabled();
    expect(validateOutboundRequestRows).not.toHaveBeenCalled();
  });
});
