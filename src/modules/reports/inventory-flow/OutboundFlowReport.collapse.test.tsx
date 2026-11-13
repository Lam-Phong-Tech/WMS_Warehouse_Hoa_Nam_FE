import dayjs from "dayjs";
import { useInventoryFlowSnapshot } from "./inventory-flow-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import type { FlowDocument, InventoryFlowSnapshot } from "./inventory-flow-api";

const snapshot: InventoryFlowSnapshot = {
  snapshot_id: "collapse-test",
  as_of: "2026-11-01T12:00:00",
  source_watermark: "2026-11-01T12:00:00",
  warehouse_code: "KHO-TONG-HN",
  rows: [],
  summary: {
    opening: 0,
    receiptNet: 0,
    issueNet: 0,
    componentNet: 0,
    reversalUnlinked: 0,
    closing: 0,
  },
  ledger: [],
  documents: [],
  daily: [],
};

vi.mock("./inventory-flow-api", () => ({
  ISO_DATE: "YYYY-MM-DD",
  useInventoryFlowSnapshot: vi.fn(() => ({
    snapshot,
    loading: false,
    fetching: false,
    error: null,
    refetch: vi.fn(),
  })),
}));
vi.mock("@/modules/reports/components/ReportWarehouseCard", () => ({
  ReportWarehouseCard: () => null,
}));
vi.mock("@/modules/outbound/services/alignedOutboundService", () => ({
  fetchOutboundDocuments: vi.fn(async () => ({
    data: [],
    meta: { last_page: 1 },
  })),
}));

import OutboundFlowReport from "./OutboundFlowReport";

afterEach(() => {
  snapshot.documents = [];
  cleanupTestState();
  useLanguageStore.getState().setLanguage("vi");
});

it.each([
  {
    language: "en" as const,
    status: "Search statuses...",
    recipient: "Search recipients...",
    period: "0 SKU · Posted documents",
    activity: "With issues during the period",
  },
  {
    language: "zh" as const,
    status: "搜索状态...",
    recipient: "搜索收货人...",
    period: "0 SKU · 已过账单据",
    activity: "有出库记录",
  },
])(
  "translates report placeholders and KPI notes into $language while preserving recipient data",
  async ({ language, status, recipient, period, activity }) => {
    await (language === "zh"
      ? ensureChineseMessages()
      : ensureEnglishMessages());
    useLanguageStore.getState().setLanguage(language);
    snapshot.documents = [
      {
        id: "locale-document",
        document_no: "PX-LOCALE",
        doc_type: "OUTBOUND",
        status: "POSTED",
        warehouse_code: "KHO-TONG-HN",
        counterpart: "Đại lý Nguyễn Văn An",
        created_by_name: "Nguyễn Văn An",
        posted_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        document_date: dayjs().format("YYYY-MM-DD"),
        drillKey: "",
      },
    ];
    renderWithProviders(<OutboundFlowReport />, [
      "/reports/outbound-flow?screen=RPT-01B",
    ]);
    expect(screen.getAllByPlaceholderText(status).length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText(recipient).length).toBeGreaterThan(0);
    expect(screen.getByText(period)).toBeInTheDocument();
    expect(screen.getByText(activity)).toBeInTheDocument();
    expect(screen.getAllByText("Đại lý Nguyễn Văn An").length).toBeGreaterThan(
      0,
    );
    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(
      screen.getAllByPlaceholderText("Tìm trạng thái...").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("0 SKU · Phiếu đã ghi sổ")).toBeInTheDocument();
  },
);

describe("RPT-01B · đóng mở các khối báo cáo", () => {
  it("đóng mở từng khối độc lập và giữ bảng báo cáo hiển thị", () => {
    renderWithProviders(<OutboundFlowReport />, [
      "/reports/outbound-flow?screen=RPT-01B",
    ]);

    const titles = [
      "Tình trạng xử lý phiếu",
      "Sản phẩm đã xuất",
      "Phiếu hoàn tất",
      "Người nhận",
      "Phiếu cần xử lý",
      "Sản lượng xuất theo ngày",
      "Tiến độ phiếu xuất",
    ];

    for (const title of titles) {
      const toggle = screen.getByRole("button", { name: `Thu gọn ${title}` });
      const contentId = toggle.getAttribute("aria-controls");
      expect(contentId).toBeTruthy();
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(document.getElementById(contentId!)).toHaveAttribute("hidden");
    }

    expect(screen.getByText("Danh sách phiếu xuất")).toBeInTheDocument();

    for (const title of titles) {
      const toggle = screen.getByRole("button", { name: `Mở rộng ${title}` });
      const contentId = toggle.getAttribute("aria-controls");
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(document.getElementById(contentId!)).not.toHaveAttribute("hidden");
    }
  });
});

describe("RPT-01B · phân trang phiếu xuất", () => {
  it("cho chọn số phiếu mỗi trang và quay về trang đầu", async () => {
    snapshot.documents = Array.from(
      { length: 11 },
      (_, index): FlowDocument => ({
        id: `doc-${index + 1}`,
        document_no: `PX-${String(index + 1).padStart(4, "0")}`,
        doc_type: "OUTBOUND",
        status: "POSTED",
        warehouse_code: "KHO-TONG-HN",
        counterpart: "Người nhận",
        created_by_name: "Quản trị viên",
        posted_at: "2026-10-30 12:00:00",
        document_date: "2026-10-30",
        drillKey: "",
      }),
    );

    renderWithProviders(<OutboundFlowReport />, [
      "/reports/outbound-flow?screen=RPT-01B",
    ]);

    const rows = () =>
      within(
        document.querySelector<HTMLTableSectionElement>(
          ".outbound-table-wrap tbody",
        )!,
      ).getAllByRole("row");
    const pageSize = () =>
      screen.getByRole("combobox", {
        name: "Số dòng mỗi trang",
      });
    const choosePageSize = (size: number) => {
      fireEvent.mouseDown(pageSize());
      fireEvent.click(screen.getByRole("option", { name: `${size} / trang` }));
    };

    await waitFor(() => expect(rows()).toHaveLength(10));

    fireEvent.mouseDown(pageSize());
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["10 / trang", "20 / trang", "50 / trang"]);
    // Đóng menu bằng chính lựa chọn hiện tại trước khi thao tác tiếp.
    fireEvent.click(screen.getByRole("option", { name: "10 / trang" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getAllByRole("cell")[0]).toHaveTextContent(/^11$/);

    for (const size of [20, 50]) {
      choosePageSize(size);
      expect(rows()).toHaveLength(11);
      expect(rows()[0]).toHaveTextContent("PX-0001");
    }

    choosePageSize(10);
    expect(rows()).toHaveLength(10);
  });
});

describe("RPT-01B · bộ lọc báo cáo", () => {
  it("tự lọc từ thanh đầu trang và xóa lọc từ danh sách", async () => {
    snapshot.documents = [
      {
        id: "a",
        document_no: "PX-A",
        doc_type: "OUTBOUND",
        status: "POSTED",
        warehouse_code: "HN",
        counterpart: "Đại lý A",
        created_by_name: "Admin",
        posted_at: "2026-10-30",
        document_date: "2026-10-30",
        drillKey: "",
      },
      {
        id: "b",
        document_no: "PX-B",
        doc_type: "OUTBOUND",
        status: "DRAFT",
        warehouse_code: "HN",
        counterpart: "Đại lý B",
        created_by_name: "Admin",
        posted_at: "",
        document_date: "2026-10-30",
        drillKey: "",
      },
    ];
    renderWithProviders(<OutboundFlowReport />);
    const filters = screen.getByRole("region", {
      name: "Bộ lọc báo cáo xuất kho",
    });
    const recipient = within(filters).getByRole("combobox", {
      name: "Chọn người nhận",
    });
    await waitFor(() => expect(recipient).toBeEnabled());
    fireEvent.click(recipient);
    fireEvent.click(within(filters).getByRole("option", { name: "Đại lý B" }));
    fireEvent.click(
      within(filters).getByRole("combobox", {
        name: "Chọn trạng thái phiếu xuất",
      }),
    );
    fireEvent.click(within(filters).getByRole("option", { name: "Nháp" }));
    expect(
      within(filters).queryByRole("button", { name: "Áp dụng" }),
    ).not.toBeInTheDocument();
    expect(
      within(filters).queryByRole("button", { name: "Đặt lại" }),
    ).not.toBeInTheDocument();
    const table = () =>
      document.querySelector<HTMLTableSectionElement>(
        ".outbound-table-wrap tbody",
      )!;
    await waitFor(() =>
      expect(within(table()).getAllByRole("row")).toHaveLength(1),
    );
    expect(table()).toHaveTextContent("PX-B");
    expect(table()).not.toHaveTextContent("PX-A");
    const toolbar = screen.getByRole("region", {
      name: "Bộ lọc danh sách phiếu xuất",
    });
    fireEvent.click(within(toolbar).getByRole("button", { name: "Xóa lọc" }));
    await waitFor(() =>
      expect(within(table()).getAllByRole("row")).toHaveLength(2),
    );
    expect(
      within(toolbar).queryByRole("button", { name: "Xóa lọc" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(toolbar).getByRole("combobox", { name: "Lọc người nhận" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      within(toolbar).getByRole("combobox", { name: "Lọc người nhận" }),
    );
    fireEvent.click(
      within(toolbar).getByRole("option", { name: "Người nhận: Đại lý A" }),
    );
    await waitFor(() =>
      expect(within(table()).getAllByRole("row")).toHaveLength(1),
    );
    expect(table()).toHaveTextContent("PX-A");
    expect(within(table()).getAllByRole("cell")[0]).toHaveTextContent(/^1$/);
    fireEvent.click(within(toolbar).getByRole("button", { name: "Xóa lọc" }));
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
  });
});

it("áp dụng khoảng ngày được chọn ở đầu báo cáo vào truy vấn dữ liệu", async () => {
  renderWithProviders(<OutboundFlowReport />);
  const filters = screen.getByRole("region", {
    name: "Bộ lọc báo cáo xuất kho",
  });
  const from = within(filters).getByRole("button", { name: "Từ ngày" });
  await waitFor(() => expect(from).toBeEnabled());
  fireEvent.click(from);
  fireEvent.click(await screen.findByRole("button", { name: "Hôm qua" }));
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  await waitFor(() =>
    expect(useInventoryFlowSnapshot).toHaveBeenLastCalledWith({
      from: yesterday,
      to: yesterday,
    }),
  );
});
