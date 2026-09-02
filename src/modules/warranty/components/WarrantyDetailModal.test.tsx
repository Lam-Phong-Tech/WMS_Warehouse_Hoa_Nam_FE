import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/warranty/services/warrantyService", () => ({
  fetchWarrantyCases: vi.fn(),
  fetchWarrantyCase: vi.fn(),
  fetchWarrantyCaseEvents: vi.fn(),
  fetchWarrantyAttachments: vi.fn(),
  createWarrantyCase: vi.fn(),
  updateWarrantyCase: vi.fn(),
  uploadWarrantyAttachment: vi.fn(),
  deleteWarrantyAttachment: vi.fn(),
  downloadWarrantyAttachment: vi.fn(),
  makeWarrantyIdempotencyKey: vi.fn(() => "fe:test:key"),
}));
vi.mock("@/modules/warranty/services/componentIssueService", () => ({
  fetchComponentIssueDocuments: vi.fn(),
  fetchComponentIssueDocument: vi.fn(),
  createComponentIssue: vi.fn(),
  scanComponentIssue: vi.fn(),
  cancelComponentIssue: vi.fn(),
  postComponentIssue: vi.fn(),
}));

import {
  fetchWarrantyAttachments,
  fetchWarrantyCase,
  fetchWarrantyCaseEvents,
  updateWarrantyCase,
} from "@/modules/warranty/services/warrantyService";
import { fetchComponentIssueDocuments } from "@/modules/warranty/services/componentIssueService";
import { useAuthStore } from "@/shared/store/auth.store";
import { WarrantyDetailModal } from "./WarrantyDetailModal";

const DETAIL = {
  id: "wc-1",
  case_code: "BH-0001",
  sku: "KT-2000",
  sku_name: "Máy khoan KT-2000",
  identification_type: "TEMP_ONLY" as const,
  temporary_item_code: "TEMP-0001",
  missing_code_reason: "Mất tem mã",
  manual_product_description: "Máy khoan màu xanh",
  customer_name: "Ng*** A",
  customer_phone: "09*****01",
  customer_address: "12*** TP.HCM",
  defect: "Không lên nguồn",
  defect_code: "PWR",
  reported_defect: "Máy không chạy",
  confirmed_defect: "Chết mạch nguồn",
  accessories_received: "Pin 20V, sạc",
  received_condition: "Trầy nhẹ",
  status: "CHECKING" as const,
  priority: "MEDIUM" as const,
  received_at: "2026-08-10T08:00:00Z",
  created_at: "2026-08-10T08:00:00Z",
  created_by: "thukho",
  version: 2,
};

describe("WarrantyDetailModal (WAR-03)", () => {
  beforeEach(() => {
    vi.mocked(fetchWarrantyCase).mockReset();
    vi.mocked(fetchWarrantyCase).mockResolvedValue(DETAIL as never);
    vi.mocked(fetchWarrantyCaseEvents).mockResolvedValue([]);
    vi.mocked(fetchWarrantyAttachments).mockResolvedValue([
      {
        id: "att-1",
        warranty_case_id: "wc-1",
        file_name: "mat-truoc.jpg",
        content_type: "image/jpeg",
        file_size_bytes: 2048,
        attachment_type: "INTAKE",
        status: "ACTIVE",
      } as never,
    ]);
    vi.mocked(fetchComponentIssueDocuments).mockResolvedValue({
      data: [
        {
          id: "ci-1",
          component_issue_no: "CI-0001",
          warehouse_id: "wh-1",
          warranty_case_id: "wc-1",
          document_date: "2026-08-13",
          purpose: "WARRANTY",
          status: "SCANNING",
          version: 2,
          lines: [],
        } as never,
      ],
    });
    vi.mocked(updateWarrantyCase).mockReset();
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["warranty.manage", "warranty.component_issue"],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("hiển thị đủ thông tin case TEMP_ONLY, PII mask note, đính kèm và phiếu linh kiện", async () => {
    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={() => {}}
      />,
    );

    // Tab mặc định "Tổng quan": thông tin case + cảnh báo PII/mã tạm.
    expect(await screen.findByText("BH-0001")).toBeInTheDocument();
    expect(screen.getByText(/warranty.pii.view/)).toBeInTheDocument();
    expect(screen.getByText(/Item \/ serial \/ mã tạm/)).toBeInTheDocument();
    expect(screen.getByText("TEMP-0001")).toBeInTheDocument();
    expect(document.body.textContent).toContain("Chết mạch nguồn");
    expect(document.body.textContent).toContain("Pin 20V, sạc");

    // Ảnh/tệp nằm ở tab riêng, hiển thị dạng thư viện ảnh: tên tệp thô không in
    // ra UI nữa, chỉ còn ở nhãn trợ năng / tooltip của ô ảnh.
    fireEvent.click(screen.getByRole("tab", { name: /Ảnh & video/ }));
    expect(
      await screen.findByRole("button", { name: "Xem ảnh mat-truoc.jpg" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("mat-truoc.jpg")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Linh kiện/ }));
    expect(await screen.findByText("CI-0001")).toBeInTheDocument();
  });

  it("mở Component Issue từ nút chân modal với caseActive đúng state machine", async () => {
    const onOpenComponentIssue = vi.fn();
    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={onOpenComponentIssue}
      />,
    );
    await screen.findByText("BH-0001");

    fireEvent.click(screen.getByRole("button", { name: /Xuất linh kiện/ }));
    expect(onOpenComponentIssue).toHaveBeenCalledWith({
      caseId: "wc-1",
      caseCode: "BH-0001",
      caseActive: true,
      documentId: null,
    });

    fireEvent.click(screen.getByRole("tab", { name: /Linh kiện/ }));
    fireEvent.click(await screen.findByRole("button", { name: "CI-0001" }));
    expect(onOpenComponentIssue).toHaveBeenLastCalledWith(
      expect.objectContaining({ caseId: "wc-1", documentId: "ci-1" }),
    );
  });

  it("không tự lưu thay đổi trước khi người dùng bấm Lưu", async () => {
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: [
        "warranty.manage",
        "warranty.component_issue",
        "warranty.pii.view",
      ],
    });

    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={() => {}}
      />,
    );
    await screen.findByText("BH-0001");

    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin" }));
    const customerName = await screen.findByLabelText("Tên khách gửi (PII)");
    fireEvent.change(customerName, { target: { value: "Nguyễn Văn B" } });

    expect(updateWarrantyCase).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Sửa thông tin case bảo hành" }),
      ).not.toBeInTheDocument();
    });
    expect(updateWarrantyCase).not.toHaveBeenCalled();
  });

  it("case RETURNED (terminal): không cho cập nhật trạng thái và chặn xuất linh kiện", async () => {
    vi.mocked(fetchWarrantyCase).mockResolvedValue({
      ...DETAIL,
      status: "RETURNED",
    } as never);
    const onOpenComponentIssue = vi.fn();
    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={onOpenComponentIssue}
      />,
    );
    await screen.findByText("BH-0001");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Cập nhật trạng thái/ }),
      ).toBeDisabled();
    });
    // Đã trả khách: nút Xuất linh kiện phải disable, không mở được modal tạo phiếu.
    const issueButton = screen.getByRole("button", { name: /Xuất linh kiện/ });
    expect(issueButton).toBeDisabled();
    fireEvent.click(issueButton);
    expect(onOpenComponentIssue).not.toHaveBeenCalled();
  });

  it("case COMPLETED (đã hoàn tất xử lý): chặn xuất linh kiện", async () => {
    vi.mocked(fetchWarrantyCase).mockResolvedValue({
      ...DETAIL,
      status: "COMPLETED",
    } as never);
    const onOpenComponentIssue = vi.fn();
    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={onOpenComponentIssue}
      />,
    );
    await screen.findByText("BH-0001");

    const issueButton = await screen.findByRole("button", {
      name: /Xuất linh kiện/,
    });
    expect(issueButton).toBeDisabled();
    fireEvent.click(issueButton);
    expect(onOpenComponentIssue).not.toHaveBeenCalled();
  });

  it("thiếu warranty.manage: không cập nhật được trạng thái", async () => {
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["warranty.component_issue"],
    });
    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={() => {}}
      />,
    );
    await screen.findByText("BH-0001");

    expect(
      screen.getByRole("button", { name: /Cập nhật trạng thái/ }),
    ).toBeDisabled();
  });
});
