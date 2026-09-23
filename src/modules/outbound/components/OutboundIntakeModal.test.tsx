import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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

import { validateOutboundRequestRows } from "@/modules/outbound/services/mvpOutboundService";
import { OutboundIntakeModal } from "./OutboundIntakeModal";

const dateLabel = translate("vi", "outbound.intake.fieldRequestDate");
const validateLabel = translate("vi", "outbound.intake.validate");

function renderIntake(canImport = true) {
  return renderWithProviders(
    <OutboundIntakeModal
      open
      canImport={canImport}
      onClose={vi.fn()}
      onConsumed={vi.fn()}
    />,
  );
}

async function fillRequiredFields() {
  fireEvent.change(screen.getByRole("textbox", { name: /Mã phiếu yêu cầu/ }), {
    target: { value: "REQ-001" },
  });
  fireEvent.change(
    screen.getByRole("textbox", {
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
          request_no: "REQ-001",
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
    fireEvent.click(screen.getByRole("button", { name: dateLabel }));
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
