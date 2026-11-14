import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { translate } from "@/shared/i18n/useT";

const service = vi.hoisted(() => ({
  fetchOutboundDetail: vi.fn(),
  fetchPackingLabels: vi.fn(),
  fetchPrinterConfigs: vi.fn(),
  reprintLabelSnapshot: vi.fn(),
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

beforeEach(async () => {
  await ensureEnglishMessages();
  await ensureChineseMessages();
  useAuthStore.setState({ isSuperAdmin: true });
  service.fetchOutboundDetail.mockResolvedValue({
    document: {
      id: "OUT-1",
      code: "PX-001",
      outboundRequestId: "REQ-1",
      requestNo: "MA-OUT-001",
      date: "2026-11-03T08:15:00",
      warehouseId: "WH-1",
      recipientName: "Customer A",
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
  service.fetchPackingLabels.mockResolvedValue([
    {
      id: "LABEL-1",
      documentId: "OUT-1",
      labelCode: "PL-PX-001",
      status: "PRINTED",
      version: 2,
      itemCount: 0,
      skuCount: 0,
      skuSummary: [],
      recipientName: "Customer A",
      recipientAddress: "",
      customerPhone: "",
      outboundNo: "PX-001",
      sourceRequestNo: "MA-OUT-001",
      applied: false,
      reprintCount: 0,
      payload: {},
    },
  ]);
  service.fetchPrinterConfigs.mockResolvedValue([
    { id: "PRINTER-1", code: "PRN-01", name: "Zebra", status: "ACTIVE" },
  ]);
  service.reprintLabelSnapshot.mockReset().mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  useLanguageStore.setState({ language: "vi" });
  useAuthStore.setState({ isSuperAdmin: false });
  cleanupTestState();
});

it.each(["vi", "en", "zh"] as const)(
  "opens outbound details and the reprint reason list in %s without crashing",
  async (language) => {
    useLanguageStore.setState({ language });
    renderWithProviders(
      <AlignedOutboundDetailModal documentId="OUT-1" onClose={vi.fn()} />,
    );

    expect(await screen.findByText("PX-001")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("tab", {
        name: translate(language, "outbound.detail.step3"),
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: translate(language, "outbound.detail.reprint"),
      }),
    );
    fireEvent.mouseDown(
      await screen.findByRole("combobox", {
        name: translate(language, "outbound.reprint.field"),
      }),
    );
    const list = await screen.findByRole("listbox");
    expect(within(list).getAllByRole("option")).toHaveLength(6);
    expect(
      within(list).getByRole("option", {
        name: translate(language, "outbound.reprint.tonerEmpty"),
      }),
    ).toBeInTheDocument();
  },
);

it.each([
  ["Printer out of toner", null, "Máy in hết mực"],
  [
    "Other",
    "Replacement requested by customer",
    "Replacement requested by customer",
  ],
] as const)(
  "submits the stable reason for the English option %s",
  async (option, note, expectedReason) => {
    useLanguageStore.setState({ language: "en" });
    renderWithProviders(
      <AlignedOutboundDetailModal documentId="OUT-1" onClose={vi.fn()} />,
    );
    await screen.findByText("PX-001");
    fireEvent.click(
      await screen.findByRole("tab", { name: "View and print the label" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Reprint label" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Reason for reprinting the label",
    });
    const submit = within(dialog).getByRole("button", {
      name: "Reprint label",
    });
    expect(submit).toBeDisabled();
    fireEvent.mouseDown(
      await within(dialog).findByRole("combobox", { name: "Reprint reason" }),
    );
    fireEvent.click(await screen.findByRole("option", { name: option }));
    if (note) {
      expect(submit).toBeDisabled();
      fireEvent.change(
        within(dialog).getByRole("textbox", {
          name: "Enter the specific reason",
        }),
        {
          target: { value: `  ${note}  ` },
        },
      );
    }
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(service.reprintLabelSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: "OUT-1",
          labelId: "LABEL-1",
          printerConfigId: "PRINTER-1",
          reason: expectedReason,
        }),
      ),
    );
  },
);
