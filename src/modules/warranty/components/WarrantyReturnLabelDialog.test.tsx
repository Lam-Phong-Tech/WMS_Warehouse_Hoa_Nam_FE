import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/warranty/services/componentIssueService", () => ({
  fetchComponentIssueDocuments: vi.fn(),
  fetchComponentIssueDocument: vi.fn(),
  createComponentIssue: vi.fn(),
  scanComponentIssue: vi.fn(),
  cancelComponentIssue: vi.fn(),
  postComponentIssue: vi.fn(),
}));
vi.mock("@/shared/utils/print-html", () => ({
  printElement: vi.fn(() => Promise.resolve()),
}));

import {
  fetchComponentIssueDocument,
  fetchComponentIssueDocuments,
} from "@/modules/warranty/services/componentIssueService";
import { printElement } from "@/shared/utils/print-html";
import { useAuthStore } from "@/shared/store/auth.store";
import { WarrantyReturnLabelDialog } from "./WarrantyReturnLabelDialog";
import type { WarrantyCase } from "@/modules/warranty/types";

const DETAIL = {
  id: "wc-1",
  case_code: "BH-0001",
  sku: "KT-2000",
  sku_name: "Máy khoan KT-2000",
  item_code: "IT-0009",
  identification_type: "IDENTIFIED",
  customer_name: "Nguyễn Văn A",
  customer_phone: "0901234567",
  customer_address: "12 Lê Lợi, Quận 1, TP.HCM",
  agency_name: "Đại lý Hoa Nam Q1",
  pii_masked: false,
  defect: "Không lên nguồn",
  defect_code: "PWR",
  defects: [
    {
      defect_id: "d-1",
      defect_code: "PWR",
      defect_name: "Không lên nguồn",
      is_primary: true,
    },
    { defect_id: "d-2", defect_code: "MTR", defect_name: "Kẹt mô tơ" },
  ],
  confirmed_defect: "Chết mạch nguồn",
  status: "COMPLETED",
  priority: "MEDIUM",
  received_at: "2026-08-10T08:00:00Z",
  completed_at: "2026-08-20T09:30:00Z",
  created_at: "2026-08-10T08:00:00Z",
  created_by: "thukho",
  version: 3,
} as unknown as WarrantyCase;

function issueDocument(id: string, status: string) {
  return {
    id,
    component_issue_no: `CI-${id}`,
    warehouse_id: "wh-1",
    warranty_case_id: "wc-1",
    document_date: "2026-08-15",
    purpose: "WARRANTY" as const,
    status,
    version: 3,
    lines: [],
  };
}

/**
 * WAR-05 — nhãn trả máy: bản xem trước + in.
 *
 * Nhãn này là giấy tờ đi kèm máy khi gửi qua đơn vị vận chuyển, nên hai khối
 * "bệnh/lỗi" và "linh kiện đã thay" phải đúng tuyệt đối: sai bệnh thì kỹ thuật
 * lần sau đọc sai, sai linh kiện thì khách không đối chiếu được cái gì đã thay.
 */
describe("WarrantyReturnLabelDialog (WAR-05)", () => {
  beforeEach(() => {
    vi.mocked(fetchComponentIssueDocuments).mockReset();
    vi.mocked(fetchComponentIssueDocument).mockReset();
    vi.mocked(printElement).mockClear();
    vi.mocked(fetchComponentIssueDocuments).mockResolvedValue({
      data: [
        issueDocument("ci-1", "POSTED"),
        // Chưa ghi sổ + đã hủy: KHÔNG được lên nhãn.
        issueDocument("ci-2", "SCANNING"),
        issueDocument("ci-3", "CANCELLED"),
      ] as never,
    });
    vi.mocked(fetchComponentIssueDocument).mockImplementation((id: string) =>
      Promise.resolve({
        ...issueDocument(id, "POSTED"),
        lines: [
          {
            id: `${id}-l1`,
            sku_id: "sku-motor",
            sku_code: "HN-COMP-MOTOR",
            sku_name: "Mô tơ thay thế",
            required_qty: 1,
            scanned_qty: 1,
            items: [],
          },
          {
            id: `${id}-l2`,
            sku_id: "sku-board",
            sku_code: "HN-COMP-BOARD",
            sku_name: "Mạch nguồn",
            required_qty: 2,
            scanned_qty: 2,
            items: [],
          },
        ],
      } as never),
    );
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: [
        "warranty.manage",
        "warranty.component_issue",
        "warranty.pii.view",
      ],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("không render gì khi chưa có hồ sơ", () => {
    const { container } = renderWithProviders(
      <WarrantyReturnLabelDialog open detail={null} onClose={vi.fn()} />,
    );
    expect(container.textContent).toBe("");
  });

  it("in đủ khách hàng, máy, bệnh lỗi và linh kiện đã thay", async () => {
    renderWithProviders(
      <WarrantyReturnLabelDialog open detail={DETAIL} onClose={vi.fn()} />,
    );

    // Mã hồ sơ xuất hiện hai lần theo thiết kế của tem: banner đầu nhãn và
    // dòng chữ dưới mã vạch (để đọc được khi máy quét không nhận).
    expect(await screen.findAllByText("BH-0001")).toHaveLength(2);
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("12 Lê Lợi, Quận 1, TP.HCM")).toBeInTheDocument();
    expect(screen.getByText("ĐT: 0901234567")).toBeInTheDocument();
    expect(screen.getByText("Mã máy: IT-0009")).toBeInTheDocument();

    // Bệnh/lỗi: đủ cả hai mã danh mục + kết luận sau kiểm tra.
    expect(screen.getByText("PWR · Không lên nguồn")).toBeInTheDocument();
    expect(screen.getByText("MTR · Kẹt mô tơ")).toBeInTheDocument();
    expect(
      screen.getByText("Kết quả kiểm tra: Chết mạch nguồn"),
    ).toBeInTheDocument();

    // Linh kiện: chỉ lấy phiếu ĐÃ GHI SỔ, và chỉ gọi chi tiết đúng phiếu đó.
    expect(await screen.findByText("Mô tơ thay thế")).toBeInTheDocument();
    expect(screen.getByText("HN-COMP-MOTOR")).toBeInTheDocument();
    expect(screen.getByText("Mạch nguồn")).toBeInTheDocument();
    expect(screen.getByText("TỔNG SỐ LƯỢNG")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(fetchComponentIssueDocument)).toHaveBeenCalledTimes(1),
    );
    expect(vi.mocked(fetchComponentIssueDocument)).toHaveBeenCalledWith("ci-1");

    // Mã vạch CODE128 phải được vẽ thật (rect bars), không chỉ là <svg> rỗng.
    await waitFor(() => {
      const svg = screen.getByTestId("warranty-return-label-barcode");
      expect(svg.querySelectorAll("rect").length).toBeGreaterThan(0);
    });
  });

  it("gộp cùng một SKU xuất làm nhiều phiếu thành một dòng", async () => {
    vi.mocked(fetchComponentIssueDocuments).mockResolvedValue({
      data: [issueDocument("ci-1", "POSTED"), issueDocument("ci-9", "POSTED")],
    } as never);

    renderWithProviders(
      <WarrantyReturnLabelDialog open detail={DETAIL} onClose={vi.fn()} />,
    );

    // 2 phiếu × (1 mô tơ + 2 mạch) = 1 dòng mô tơ (2) + 1 dòng mạch (4).
    expect(await screen.findByText("Mô tơ thay thế")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByText("Mô tơ thay thế")).toHaveLength(1),
    );
    expect(screen.getAllByText("Mạch nguồn")).toHaveLength(1);
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("nói rõ khi hồ sơ không thay linh kiện nào", async () => {
    vi.mocked(fetchComponentIssueDocuments).mockResolvedValue({ data: [] });

    renderWithProviders(
      <WarrantyReturnLabelDialog open detail={DETAIL} onClose={vi.fn()} />,
    );

    expect(await screen.findByText("Không thay linh kiện")).toBeInTheDocument();
    expect(vi.mocked(fetchComponentIssueDocument)).not.toHaveBeenCalled();
  });

  it("che PII và cảnh báo khi thiếu warranty.pii.view", async () => {
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["warranty.manage", "warranty.component_issue"],
    });

    renderWithProviders(
      <WarrantyReturnLabelDialog open detail={DETAIL} onClose={vi.fn()} />,
    );

    expect(await screen.findAllByText("BH-0001")).toHaveLength(2);
    expect(screen.getByText(/warranty.pii.view/)).toBeInTheDocument();
    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument();
    expect(screen.getByText("N*** V*** A***")).toBeInTheDocument();
    expect(screen.getByText("ĐT: *******567")).toBeInTheDocument();
  });

  it("không gọi API phiếu linh kiện khi thiếu quyền warranty.component_issue", async () => {
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["warranty.manage", "warranty.pii.view"],
    });

    renderWithProviders(
      <WarrantyReturnLabelDialog open detail={DETAIL} onClose={vi.fn()} />,
    );

    expect(
      await screen.findByText("Không có quyền xem phiếu xuất linh kiện"),
    ).toBeInTheDocument();
    expect(vi.mocked(fetchComponentIssueDocuments)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchComponentIssueDocument)).not.toHaveBeenCalled();
  });

  it("bấm In gửi đúng khung nhãn sang tiện ích in, khổ 100×150mm", async () => {
    renderWithProviders(
      <WarrantyReturnLabelDialog open detail={DETAIL} onClose={vi.fn()} />,
    );
    await screen.findByText("Mô tơ thay thế");

    fireEvent.click(screen.getByRole("button", { name: /In nhãn/ }));

    await waitFor(() =>
      expect(vi.mocked(printElement)).toHaveBeenCalledTimes(1),
    );
    const [node, options] = vi.mocked(printElement).mock.calls[0];
    expect(node).toBe(screen.getByTestId("warranty-return-label"));
    expect(options.page).toEqual({
      widthMm: 100,
      heightMm: 150,
      marginMm: 4,
    });
    expect(options.title).toBe("BH-0001");
  });

  it("gọi onClose khi bấm Đóng", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <WarrantyReturnLabelDialog open detail={DETAIL} onClose={onClose} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
