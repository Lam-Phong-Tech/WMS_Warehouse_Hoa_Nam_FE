import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  useInventoryFlowSnapshot: () => ({
    snapshot,
    loading: false,
    fetching: false,
    error: null,
    refetch: vi.fn(),
  }),
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
});

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
        document.querySelector(".outbound-table-wrap tbody")!,
      ).getAllByRole("row");
    const pageSize = screen.getByRole("combobox", {
      name: "Số dòng mỗi trang",
    });

    await waitFor(() => expect(rows()).toHaveLength(10));

    expect(
      Array.from(pageSize.querySelectorAll("option")).map(
        (option) => option.value,
      ),
    ).toEqual(["10", "20", "50"]);
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(rows()).toHaveLength(1);

    for (const size of [20, 50]) {
      fireEvent.change(pageSize, { target: { value: String(size) } });
      expect(rows()).toHaveLength(11);
      expect(rows()[0]).toHaveTextContent("PX-0001");
    }

    fireEvent.change(pageSize, { target: { value: "10" } });
    expect(rows()).toHaveLength(10);
  });
});
