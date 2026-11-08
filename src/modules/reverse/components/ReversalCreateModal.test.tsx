import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/reverse/hooks/use-reversal", () => ({
  useReversibleMovements: vi.fn(),
  useCreateReversal: vi.fn(),
}));

import {
  useCreateReversal,
  useReversibleMovements,
} from "@/modules/reverse/hooks/use-reversal";
import type { ReversibleMovement, ReversibleMovementLine } from "../types";
import { ReversalCreateModal } from "./ReversalCreateModal";

const QUANTITY_LINE: ReversibleMovementLine = {
  id: "line-component",
  sku: "SKU-COMPONENT",
  sku_name: "Phụ kiện thay thế",
  original_qty: 5,
  reversed_qty: 2,
  reversible_qty: 3,
  remaining_qty: 3,
  can_reverse: true,
  item_scoped: false,
};

const ITEM_LINE: ReversibleMovementLine = {
  id: "line-product",
  sku: "SKU-PRODUCT",
  sku_name: "Máy khoan có sê-ri",
  original_qty: 2,
  reversed_qty: 0,
  reversible_qty: 2,
  remaining_qty: 2,
  can_reverse: true,
  item_scoped: true,
  items: [
    {
      item_id: "item-1",
      sku_id: "product-1",
      serial_number: "SERIAL-001",
      item_status: "IN_STOCK",
    },
    {
      item_id: "item-2",
      sku_id: "product-1",
      item_code: "ITEM-002",
      item_status: "IN_STOCK",
    },
  ],
};

const RECEIPT: ReversibleMovement = {
  id: "movement-1",
  movement_code: "MOV-RECEIPT-000123",
  movement_type: "RECEIPT",
  source_document_type: "INBOUND",
  source_document_id: "source-document-1",
  source_document_code: "IN-000123",
  warehouse_id: "warehouse-1",
  warehouse_name: "Kho tổng Hoa Nam",
  posted_at: "2026-10-01T09:00:00Z",
  version: "source-version-7",
  can_reverse: true,
  lines: [QUANTITY_LINE],
};

const mutateAsync = vi.fn();
const refetch = vi.fn();
const onCreated = vi.fn();

function mockMovements(movements: ReversibleMovement[] = [RECEIPT]) {
  vi.mocked(useReversibleMovements).mockReturnValue({
    data: movements,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch,
  } as never);
}

function renderCreate() {
  return renderWithProviders(
    <ReversalCreateModal onClose={vi.fn()} onCreated={onCreated} />,
  );
}

async function chooseMovement(code = RECEIPT.movement_code) {
  fireEvent.click(
    await screen.findByRole("button", { name: `Chọn giao dịch ${code}` }),
  );
  return screen.findByRole("textbox", { name: /Lý do điều chỉnh/ });
}

function createButton() {
  return screen.getByRole("button", { name: "Tạo phiếu điều chỉnh" });
}

function enterReason(value = "  Điều chỉnh nhầm hàng  ") {
  fireEvent.change(screen.getByRole("textbox", { name: /Lý do điều chỉnh/ }), {
    target: { value },
  });
}

async function confirmCreate() {
  fireEvent.click(createButton());
  const confirmation = await screen.findByRole("dialog", {
    name: "Tạo phiếu đảo?",
  });
  fireEvent.click(
    within(confirmation).getByRole("button", { name: "Tạo phiếu điều chỉnh" }),
  );
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  return mutateAsync.mock.calls[0][0];
}

describe("ReversalCreateModal drawer workflow", () => {
  beforeEach(() => {
    mutateAsync.mockReset().mockResolvedValue({
      id: "reversal-created",
      reversal_code: "REV-000123",
      status: "DRAFT",
      total_qty: 3,
      reversed_lines: 1,
    });
    refetch.mockReset();
    onCreated.mockReset();
    mockMovements();
    vi.mocked(useCreateReversal).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
  });

  afterEach(() => cleanupTestState());

  it("opens a named right drawer and exposes the original transaction help through its info button", async () => {
    renderCreate();
    const drawer = await screen.findByRole("dialog", { name: /Tạo phiếu đảo/ });
    expect(drawer.closest(".MuiDrawer-root")).toHaveClass(
      "MuiDrawer-anchorRight",
    );
    const help = within(drawer).getByRole("button", {
      name: "Thông tin tạo phiếu đảo",
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseOver(help);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Giao dịch gốc luôn được giữ nguyên",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("selects a receipt, defaults to its remaining quantity and gates creation on the trimmed reason", async () => {
    renderCreate();
    await chooseMovement();
    expect(
      screen.getByRole("textbox", {
        name: "Số lượng điều chỉnh SKU-COMPONENT",
      }),
    ).toHaveValue("3");
    expect(createButton()).toBeDisabled();
    enterReason("     ");
    expect(createButton()).toBeDisabled();
    enterReason("abcd");
    expect(createButton()).toBeDisabled();
    enterReason("  abcde  ");
    expect(createButton()).toBeEnabled();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("checkbox", { name: /hàng vật lý/ }),
    ).not.toBeInTheDocument();
    expect(useReversibleMovements).toHaveBeenCalledWith({
      search: undefined,
      reversible_only: true,
      per_page: 50,
    });
  });

  it.each(["0", "4"])(
    "blocks quantity %s until the entered quantity is valid",
    async (value) => {
      renderCreate();
      await chooseMovement();
      enterReason();
      const quantity = screen.getByRole("textbox", {
        name: "Số lượng điều chỉnh SKU-COMPONENT",
      });
      fireEvent.change(quantity, { target: { value } });
      expect(createButton()).toBeDisabled();
      expect(mutateAsync).not.toHaveBeenCalled();
      if (value === "4")
        expect(
          await screen.findByText(/SKU-COMPONENT vượt số lượng/),
        ).toBeInTheDocument();
      fireEvent.change(quantity, { target: { value: "2" } });
      expect(createButton()).toBeEnabled();
    },
  );

  it("keeps the adjustment draft when moving between the two steps", async () => {
    renderCreate();
    expect(
      await screen.findByRole("button", { name: /2.*Nhập điều chỉnh/ }),
    ).toBeDisabled();
    await chooseMovement();
    enterReason("Kiểm tra lại số lượng");
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Số lượng điều chỉnh SKU-COMPONENT",
      }),
      {
        target: { value: "2" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /1.*Chọn giao dịch/ }));
    expect(
      screen.queryByRole("button", { name: "Tạo phiếu điều chỉnh" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /2.*Nhập điều chỉnh/ }));
    expect(
      await screen.findByRole("textbox", { name: /Lý do điều chỉnh/ }),
    ).toHaveValue("Kiểm tra lại số lượng");
    expect(
      screen.getByRole("textbox", {
        name: "Số lượng điều chỉnh SKU-COMPONENT",
      }),
    ).toHaveValue("2");
    expect(createButton()).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /1.*Chọn giao dịch/ }));
    await chooseMovement();
    expect(
      screen.getByRole("textbox", { name: /Lý do điều chỉnh/ }),
    ).toHaveValue("Kiểm tra lại số lượng");
    expect(
      screen.getByRole("textbox", {
        name: "Số lượng điều chỉnh SKU-COMPONENT",
      }),
    ).toHaveValue("2");
    expect(createButton()).toBeEnabled();
  });

  it("requires the item selection count to match the requested quantity", async () => {
    mockMovements([{ ...RECEIPT, lines: [ITEM_LINE] }]);
    renderCreate();
    await chooseMovement();
    enterReason();
    expect(createButton()).toBeEnabled();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Số lượng điều chỉnh SKU-PRODUCT" }),
      {
        target: { value: "1" },
      },
    );
    expect(createButton()).toBeDisabled();
    expect(
      await screen.findByText(/phải chọn đúng 1 hiện vật.*đang chọn 2/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Chọn hiện vật / máy cần đảo cho SKU-PRODUCT",
      }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: /ITEM-002/ }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(createButton()).toBeEnabled());
    const payload = await confirmCreate();
    expect(payload.lines).toEqual([
      { sku: "SKU-PRODUCT", reversal_qty: 1, item_id: "item-1" },
    ]);
  });

  it.each(["ISSUE", "COMPONENT_ISSUE"])(
    "requires physical return and keeps the selected return condition for %s",
    async (movement_type) => {
      mockMovements([
        { ...RECEIPT, movement_type, source_document_type: "OUTBOUND" },
      ]);
      renderCreate();
      await chooseMovement();
      enterReason();
      expect(createButton()).toBeDisabled();
      fireEvent.mouseDown(
        screen.getByRole("combobox", { name: "Tình trạng hàng trả về" }),
      );
      fireEvent.click(await screen.findByRole("option", { name: "Hàng lỗi" }));
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "Xác nhận hàng vật lý đã quay lại kho",
        }),
      );
      await waitFor(() => expect(createButton()).toBeEnabled());
      const payload = await confirmCreate();
      expect(payload).toMatchObject({
        reference_document_type: "OUTBOUND",
        return_condition: "DEFECTIVE",
        physical_return_confirmed: true,
      });
    },
  );

  it("prevents a blocked movement from creating a reversal", async () => {
    mockMovements([
      {
        ...RECEIPT,
        can_reverse: false,
        dependency_guard: "DOWNSTREAM_DEPENDENCY",
      },
    ]);
    renderCreate();
    await chooseMovement();
    enterReason();
    expect(createButton()).toBeDisabled();
    expect(
      await screen.findByText("Còn nghiệp vụ phụ thuộc"),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps a blocked SKU disabled and excludes it from the payload", async () => {
    mockMovements([
      {
        ...RECEIPT,
        lines: [
          QUANTITY_LINE,
          {
            ...ITEM_LINE,
            can_reverse: false,
            dependency_guard: "DOWNSTREAM_DEPENDENCY",
          },
        ],
      },
    ]);
    renderCreate();
    await chooseMovement();
    enterReason();
    const blockedQuantity = screen.getByRole("textbox", {
      name: "Số lượng điều chỉnh SKU-PRODUCT",
    });
    expect(blockedQuantity).toBeDisabled();
    expect(blockedQuantity).toHaveValue("0");
    expect(
      screen.getByRole("button", {
        name: "Chọn hiện vật / máy cần đảo cho SKU-PRODUCT",
      }),
    ).toBeDisabled();
    const payload = await confirmCreate();
    expect(payload.lines).toEqual([{ sku: "SKU-COMPONENT", reversal_qty: 3 }]);
  });

  it("blocks creation when the lookup omits the required reference version", async () => {
    mockMovements([{ ...RECEIPT, version: undefined }]);
    renderCreate();
    await chooseMovement();
    enterReason();
    expect(
      await screen.findByText(
        "Dữ liệu chứng từ gốc chưa đủ để tạo phiếu điều chỉnh",
      ),
    ).toBeInTheDocument();
    expect(createButton()).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("waits for confirmation and submits the unchanged document/version, trimmed reason and normalized item lines", async () => {
    mockMovements([{ ...RECEIPT, lines: [QUANTITY_LINE, ITEM_LINE] }]);
    renderCreate();
    await chooseMovement();
    enterReason();
    fireEvent.click(createButton());
    const confirmation = await screen.findByRole("dialog", {
      name: "Tạo phiếu đảo?",
    });
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(confirmation).toHaveTextContent("MOV-RECEIPT-000123");
    fireEvent.click(
      within(confirmation).getByRole("button", {
        name: "Tạo phiếu điều chỉnh",
      }),
    );
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toEqual({
      reference_document_id: "source-document-1",
      reference_document_type: "INBOUND",
      reference_version: "source-version-7",
      reason: "Điều chỉnh nhầm hàng",
      idempotency_key: expect.stringMatching(/^reversal-\d+-[a-z0-9]+$/),
      lines: [
        { sku: "SKU-COMPONENT", reversal_qty: 3 },
        { sku: "SKU-PRODUCT", reversal_qty: 1, item_id: "item-1" },
        { sku: "SKU-PRODUCT", reversal_qty: 1, item_id: "item-2" },
      ],
    });
    expect(onCreated).toHaveBeenCalledWith("REV-000123", "reversal-created");
  });
});
