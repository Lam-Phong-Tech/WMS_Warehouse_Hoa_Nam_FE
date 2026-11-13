import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import GoodsTraceReport from "./GoodsTraceReport";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";
const workbook = vi.hoisted(() => ({
  saveStyledReportWorkbook: vi.fn().mockResolvedValue(undefined),
  book_new: vi.fn(() => ({})),
  json_to_sheet: vi.fn((v) => v),
  book_append_sheet: vi.fn(),
}));
vi.mock("xlsx", () => ({ utils: workbook }));
vi.mock("@/shared/utils/report-excel-style", () => ({
  saveStyledReportWorkbook: workbook.saveStyledReportWorkbook,
}));
const query = vi.hoisted(() => ({
  data: undefined as unknown,
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  allowed: true,
}));
vi.mock("./goods-trace-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useGoodsTraceReport: () => query,
}));
vi.mock("@/shared/components/permission", () => ({
  usePermissionState: () => ({}),
  hasPermission: () => query.allowed,
}));
vi.mock("../inventory-flow/FlowDocumentDetailModal", () => ({
  FlowDocumentDetailModal: () => <div>Source document detail</div>,
}));
vi.mock("@/modules/reverse/components/ReversalDetailModal", () => ({
  ReversalDetailModal: () => <div>Reversal detail</div>,
}));
vi.mock("../components/ReportDateRangePicker", () => ({
  ReportDateRangePicker: () => <div>Khoảng ngày</div>,
}));
const base = {
  events: [],
  entities: [],
  relations: [],
  resolved: false,
  complete: true,
  loaded_count: 0,
  total_count: 0,
  data_as_of: "2026-11-05T10:00:00+07:00",
  warnings: [],
};
describe("GoodsTraceReport", () => {
  afterEach(cleanup);
  beforeEach(() => {
    act(() => useLanguageStore.setState({ language: "vi" }));
    query.isError = false;
    query.isFetching = false;
    query.isPending = false;
    query.allowed = true;
    vi.clearAllMocks();
  });
  afterEach(() => {
    act(() => useLanguageStore.setState({ language: "vi" }));
  });
  it("updates expression labels and source options when the language changes while preserving business data", async () => {
    query.data = {
      ...base,
      resolved: true,
      events: [
        {
          id: "translated-event",
          code: "MÃ-01",
          event_label: "Xuất kho của Nguyễn",
          event_type: "ISSUE",
          occurred_at: "2026-11-05T10:00:00",
          source_type: "ISSUE_DOCUMENT",
          source_no: "PX-001",
          source_id: "out1",
          qty_delta: -1,
          quantity: 1,
          actor: "Nguyễn Văn An",
          related_documents: [],
        },
      ],
    };
    render(<GoodsTraceReport />);
    expect(
      screen.getByRole("option", { name: /Phiếu xuất kho/ }),
    ).toBeInTheDocument();
    await act(async () => {
      await ensureEnglishMessages();
      useLanguageStore.getState().setLanguage("en");
    });
    expect(
      screen.getByRole("option", { name: /Issue note/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Phiếu xuất kho/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Code type:.*All/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Trace history (1 events)")).toBeInTheDocument();
    expect(
      screen.getByText("Total events during the selected period."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Rows per page" }),
    ).toHaveTextContent("10 / page");
    expect(
      screen.getByRole("button", {
        name: "Event details MÃ-01 Xuất kho của Nguyễn",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Nguyễn Văn An/ }),
    ).toBeInTheDocument();
    await act(async () => {
      await ensureChineseMessages();
      useLanguageStore.getState().setLanguage("zh");
    });
    expect(screen.getByText("追溯历史（1 条事件）")).toBeInTheDocument();
    expect(screen.getByText("期间内事件总数。")).toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: "编码类型" })).getByRole(
        "option",
        { name: /全部/ },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "每页行数" }),
    ).toHaveTextContent("每页 10 条");
    expect(
      screen.getByRole("button", {
        name: "事件详情 MÃ-01 Xuất kho của Nguyễn",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Nguyễn Văn An/ }),
    ).toBeInTheDocument();
  });
  it.each([
    [false, "Code not found within your permitted scope"],
    [true, "No events during the selected period"],
    [undefined, "No matching events"],
  ])(
    "localizes the empty state when resolution is %s",
    async (resolved, title) => {
      query.data = { ...base, resolved };
      await act(async () => {
        await ensureEnglishMessages();
        useLanguageStore.setState({ language: "en" });
      });
      render(<GoodsTraceReport />);
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText("Query information")).toBeInTheDocument();
    },
  );
  it("does not treat unknown code as a recognized empty history", () => {
    query.data = base;
    render(<GoodsTraceReport />);
    expect(
      screen.getByText("Không tìm thấy mã trong phạm vi được phép"),
    ).toBeInTheDocument();
  });
  it("keeps a recognized empty history distinct", () => {
    query.data = { ...base, resolved: true };
    render(<GoodsTraceReport />);
    expect(
      screen.getByText("Chưa có sự kiện trong khoảng thời gian đã chọn"),
    ).toBeInTheDocument();
  });
  it("does not present a net delta for incomplete history", () => {
    query.data = { ...base, complete: false, loaded_count: 0, total_count: 4 };
    render(<GoodsTraceReport />);
    expect(screen.getByText("Lịch sử chưa đầy đủ")).toBeInTheDocument();
    expect(
      screen.getByText("Chưa thể tính do lịch sử chưa đầy đủ."),
    ).toBeInTheDocument();
  });
  it("separates non-stock events and opens actual before/after evidence", () => {
    query.data = {
      ...base,
      resolved: true,
      loaded_count: 2,
      total_count: 2,
      events: [
        {
          id: "e1",
          occurred_at: "2026-11-05T09:00:00",
          recorded_at: "2026-11-05T09:01:00",
          event_type: "ISSUE",
          event_label: "Xuất kho",
          code: "SN-1",
          sku_code: "SKU-1",
          sku_name: "Thiết bị",
          warehouse_code: "HN01",
          location_before: "A01",
          location_after: "",
          quantity: 1,
          qty_delta: -1,
          qty_before: 1,
          qty_after: 0,
          source_id: "out1",
          source_no: "PX-001",
          source_type: "issue_document",
          actor: "Lan",
          related_documents: [],
          source_quantity: 2,
          entity_quantity: 1,
          status: "POSTED",
          entity_key: "SN-1",
        },
        {
          id: "e2",
          occurred_at: "2026-11-05T10:00:00",
          recorded_at: "2026-11-05T10:00:00",
          event_type: "LABEL",
          event_label: "In nhãn",
          code: "SN-1",
          sku_code: "SKU-1",
          sku_name: "Thiết bị",
          warehouse_code: "HN01",
          location_before: "",
          location_after: "",
          quantity: 1,
          qty_delta: 0,
          qty_before: null,
          qty_after: null,
          source_id: "label1",
          source_no: "PL-001",
          source_type: "LABEL",
          actor: "Lan",
          related_documents: [],
          source_quantity: null,
          entity_quantity: 1,
          status: "DONE",
          entity_key: "SN-1",
        },
      ],
    };
    render(<GoodsTraceReport />);
    fireEvent.click(screen.getByLabelText("Chỉ sự kiện tác động tồn"));
    expect(
      within(screen.getByRole("table")).queryByText("In nhãn"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Chi tiết sự kiện SN-1 Xuất kho"));
    expect(screen.getByText("1 → 0")).toBeInTheDocument();
    expect(screen.getByText("Tổng số lượng trên phiếu")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Mở chứng từ nguồn"));
    expect(screen.getByText("Source document detail")).toBeInTheDocument();
  });
  it("shows a retryable error without inventing zero statistics", () => {
    query.data = undefined;
    query.isError = true;
    render(<GoodsTraceReport />);
    fireEvent.click(screen.getByText("Thử lại"));
    expect(query.refetch).toHaveBeenCalled();
    expect(
      screen.getByText("Chưa thể tải lịch sử truy vết"),
    ).toBeInTheDocument();
    query.isError = false;
  });

  it("disables export when history is partial or permissions are missing", () => {
    query.data = { ...base, complete: false };
    const view = render(<GoodsTraceReport />);
    expect(screen.getByRole("button", { name: /Xuất Excel/ })).toBeDisabled();
    query.allowed = false;
    query.data = { ...base, complete: true };
    view.rerender(<GoodsTraceReport />);
    expect(screen.getByRole("button", { name: /Xuất Excel/ })).toBeDisabled();
  });
  it("shows current entity facts even when the selected period is empty", () => {
    query.data = {
      ...base,
      resolved: true,
      entities: [
        {
          key: "SN-2",
          code: "SN-2",
          code_type: "serial",
          sku_code: "SKU-2",
          sku_name: "Cảm biến",
          unit: "Cái",
          warehouse_code: "HN01",
          current_status: "Khả dụng",
          current_location: "A02",
          current_quantity: null,
          current_source_no: "",
          parent_code: "",
          parent_type: "",
        },
      ],
    };
    render(<GoodsTraceReport />);
    fireEvent.click(screen.getByText("Mở hồ sơ mã"));
    expect(screen.getByText("Khả dụng")).toBeInTheDocument();
    expect(screen.getByText("A02")).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái hiện tại tại/)).toBeInTheDocument();
  });
  it("exports the filtered loaded events rather than unfiltered history", async () => {
    query.data = {
      ...base,
      resolved: true,
      loaded_count: 2,
      total_count: 2,
      events: [
        {
          id: "stock",
          code: "SN-1",
          sku_code: "SKU-1",
          event_label: "Xuất kho",
          event_type: "ISSUE",
          source_id: "out1",
          source_no: "PX-1",
          source_type: "OUTBOUND",
          occurred_at: "2026-11-05T10:00:00",
          qty_delta: -1,
          qty_before: 1,
          qty_after: 0,
          actor: "Lan",
          related_documents: [],
        },
        {
          id: "label",
          code: "SN-1",
          sku_code: "SKU-1",
          event_label: "In nhãn",
          event_type: "LABEL",
          source_id: "label1",
          source_no: "PL-1",
          source_type: "LABEL",
          occurred_at: "2026-11-05T11:00:00",
          qty_delta: 0,
          qty_before: null,
          qty_after: null,
          actor: "Lan",
          related_documents: [],
        },
      ],
    };
    render(<GoodsTraceReport />);
    fireEvent.click(screen.getByLabelText("Chỉ sự kiện tác động tồn"));
    fireEvent.click(screen.getByRole("button", { name: /Xuất Excel/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Tên file"), {
      target: { value: "Trace-selected.xlsx" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xuất Excel" }));
    await waitFor(() =>
      expect(workbook.saveStyledReportWorkbook).toHaveBeenCalledWith(
        expect.anything(),
        "Trace-selected.xlsx",
      ),
    );
    expect(workbook.json_to_sheet).toHaveBeenCalledWith([
      expect.objectContaining({
        "Sự kiện": "Xuất kho",
        "Biến động tồn mã đang xem": -1,
      }),
    ]);
    expect(workbook.json_to_sheet.mock.calls.flat().flat()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ "Sự kiện": "In nhãn" }),
      ]),
    );
  });
  it("does not retain a profile snapshot while the query reloads or fails", () => {
    query.data = {
      ...base,
      resolved: true,
      entities: [
        {
          key: "SN-2",
          code: "SN-2",
          code_type: "serial",
          sku_code: "SKU-2",
          sku_name: "Cảm biến",
          unit: "Cái",
          warehouse_code: "HN01",
          current_status: "Khả dụng",
          current_location: "A02",
          current_quantity: 1,
          current_source_no: "",
          parent_code: "",
          parent_type: "",
        },
      ],
    };
    const view = render(<GoodsTraceReport />);
    fireEvent.click(screen.getByText("Mở hồ sơ mã"));
    query.isFetching = true;
    view.rerender(<GoodsTraceReport />);
    expect(screen.queryByText("Khả dụng")).not.toBeInTheDocument();
    query.isFetching = false;
    query.isError = true;
    view.rerender(<GoodsTraceReport />);
    expect(screen.queryByText("Khả dụng")).not.toBeInTheDocument();
    expect(
      screen.getByText("Chưa thể tải lịch sử truy vết"),
    ).toBeInTheDocument();
  });
  it.each(["SERIAL-1", "TRAY-1"])(
    "retains associated BOX events for %s history and export",
    async (code) => {
      query.data = {
        ...base,
        resolved: true,
        loaded_count: 1,
        total_count: 1,
        entities: [
          {
            key: code,
            code,
            code_type: code.startsWith("TRAY") ? "tray" : "serial",
            sku_code: "SKU-1",
            sku_name: "Thiết bị",
            unit: "Cái",
            warehouse_code: "HN01",
            current_status: "Khả dụng",
            current_location: "A02",
            current_quantity: 1,
            current_source_no: "",
            parent_code: "BOX-1",
            parent_type: "box",
          },
        ],
        events: [
          {
            id: "putaway1",
            code: "BOX-1",
            entity_key: "box-key",
            related_entity_keys: ["SERIAL-1", "TRAY-1"],
            sku_code: "SKU-1",
            event_label: "Xếp khay",
            event_type: "PUTAWAY",
            source_id: "put1",
            source_no: "PTW-1",
            source_type: "putaway",
            occurred_at: "2026-11-05T10:00:00",
            qty_delta: 0,
            qty_before: null,
            qty_after: null,
            actor: "Lan",
            related_documents: [],
            quantity: 1,
          },
        ],
        relations: [
          {
            parent_code: "TRAY-1",
            child_code: "BOX-1",
            sku_code: "SKU-1",
            quantity: 1,
            location: "A02",
          },
          {
            parent_code: "TRAY-OTHER",
            child_code: "BOX-OTHER",
            sku_code: "SKU-OTHER",
            quantity: 5,
            location: "A03",
          },
        ],
      };
      render(<GoodsTraceReport />);
      fireEvent.change(screen.getByLabelText("Mã cần truy vết"), {
        target: { value: code },
      });
      expect(
        within(screen.getByRole("table")).getByText("Xếp khay"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Xuất Excel/ }));
      const dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByLabelText("Quan hệ BOX – TRAY"));
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Xuất Excel" }),
      );
      await waitFor(() =>
        expect(workbook.saveStyledReportWorkbook).toHaveBeenCalled(),
      );
      expect(workbook.json_to_sheet).toHaveBeenCalledWith([
        expect.objectContaining({ "Sự kiện": "Xếp khay", Mã: "BOX-1" }),
      ]);
      expect(workbook.json_to_sheet).toHaveBeenCalledWith([
        expect.objectContaining({ "Mã cha": "TRAY-1", "Mã con": "BOX-1" }),
      ]);
      expect(workbook.json_to_sheet.mock.calls.flat().flat()).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ "Mã con": "BOX-OTHER" }),
        ]),
      );
    },
  );
  it("updates profile facts from the latest snapshot rather than the selected entity object", () => {
    const entity = {
      key: "SERIAL-1",
      code: "SERIAL-1",
      code_type: "serial",
      sku_code: "SKU-1",
      sku_name: "Thiết bị",
      unit: "Cái",
      warehouse_code: "HN01",
      current_status: "Khả dụng",
      current_location: "A02",
      current_quantity: 1,
      current_source_no: "",
      parent_code: "",
      parent_type: "",
    };
    query.data = { ...base, resolved: true, entities: [entity] };
    const view = render(<GoodsTraceReport />);
    fireEvent.click(screen.getByText("Mở hồ sơ mã"));
    query.data = {
      ...base,
      resolved: true,
      entities: [{ ...entity, current_location: "B03", current_quantity: 0 }],
    };
    view.rerender(<GoodsTraceReport />);
    expect(screen.getByText("B03")).toBeInTheDocument();
    expect(screen.queryByText("A02")).not.toBeInTheDocument();
  });
  it("keeps unknown entity stock deltas distinct from source ledger quantities", async () => {
    query.data = {
      ...base,
      resolved: true,
      loaded_count: 2,
      total_count: 2,
      events: [
        {
          id: "unknown-stock",
          code: "SERIAL-1",
          entity_key: "serial1",
          related_entity_keys: [],
          sku_code: "SKU-1",
          event_label: "Xuất kho",
          event_type: "ISSUE",
          source_id: "out1",
          source_no: "PX-1",
          source_type: "ISSUE_DOCUMENT",
          occurred_at: "2026-11-05T10:00:00",
          qty_delta: null,
          source_qty_delta: -12,
          qty_before: null,
          qty_after: null,
          actor: "Lan",
          related_documents: [],
          quantity: null,
        },
        {
          id: "label",
          code: "SERIAL-1",
          entity_key: "serial1",
          related_entity_keys: [],
          sku_code: "SKU-1",
          event_label: "In nhãn",
          event_type: "LABEL_PRINT",
          source_id: "label1",
          source_no: "PL-1",
          source_type: "label_print",
          occurred_at: "2026-11-05T11:00:00",
          qty_delta: 0,
          source_qty_delta: 0,
          qty_before: null,
          qty_after: null,
          actor: "Lan",
          related_documents: [],
          quantity: 1,
        },
      ],
    };
    render(<GoodsTraceReport />);
    const netCard = screen.getByText("Ảnh hưởng thuần").parentElement!;
    expect(within(netCard).getByText("—")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Chỉ sự kiện tác động tồn"));
    expect(
      within(screen.getByRole("table")).getByText("Xuất kho"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).queryByText("In nhãn"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Xuất Excel/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Xuất Excel",
      }),
    );
    await waitFor(() =>
      expect(workbook.saveStyledReportWorkbook).toHaveBeenCalled(),
    );
    expect(workbook.json_to_sheet).toHaveBeenCalledWith([
      expect.objectContaining({
        "Biến động tồn mã đang xem": null,
        "Biến động sổ kho nguồn": -12,
      }),
    ]);
  });
});
