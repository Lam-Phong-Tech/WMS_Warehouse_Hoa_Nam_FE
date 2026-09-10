import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
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
  item_status: "IN_WARRANTY",
  priority: "MEDIUM" as const,
  received_at: "2026-08-10T08:00:00Z",
  created_at: "2026-08-10T08:00:00Z",
  created_by: "thukho",
  version: 2,
};

/** Lỗi 412 đúng envelope của BE (ApiError::abort + UserFacingMessageLocalizer). */
function staleVersionError(expected: number, current: number) {
  return {
    response: {
      status: 412,
      data: {
        success: false,
        message: "Warranty case version mismatch.",
        error_code: "STALE_VERSION",
        errors: { expected_version: expected, current_version: current },
        error: {
          code: "STALE_VERSION",
          details: { expected_version: expected, current_version: current },
        },
      },
    },
  };
}

/** Mở dialog trạng thái và điền đủ field bắt buộc của nhánh CHECKING → REPAIRING. */
async function openRepairingStatusDialog() {
  fireEvent.click(
    await screen.findByRole("button", { name: /Cập nhật trạng thái/ }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Cập nhật trạng thái bảo hành",
  });
  fireEvent.mouseDown(
    within(dialog).getByRole("combobox", { name: /Trạng thái mới/ }),
  );
  fireEvent.click(await screen.findByRole("option", { name: "Đang sửa chữa" }));
  fireEvent.change(within(dialog).getByLabelText(/Ngày dự kiến sửa xong/), {
    target: { value: "2026-09-30" },
  });
  return dialog;
}

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

  /**
   * UAT TC_UI_10 + TC_FUNC_01 — nhánh CHECKING → COMPLETED:
   *  · hồ sơ mang sẵn ngày dự kiến ĐÃ QUA không được chặn submit âm thầm
   *    (ô ngày chỉ hiện ở REPAIRING nên lỗi của nó không có chỗ hiển thị);
   *  · thiếu "Kết quả xử lý" phải ra CÂU TIẾNG VIỆT (không phải khoá thô
   *    warranty.noteRequired.completed) và hiện ngay cạnh nút Cập nhật.
   */
  it("CHECKING → COMPLETED: ngày dự kiến quá khứ không chặn; lỗi thiếu Kết quả xử lý là tiếng Việt và nhìn thấy được", async () => {
    vi.mocked(fetchWarrantyCase).mockResolvedValue({
      ...DETAIL,
      estimated_completion_date: "2026-08-20",
    } as never);
    vi.mocked(updateWarrantyCase).mockResolvedValue({
      ...DETAIL,
      status: "COMPLETED",
      version: 3,
    } as never);
    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={() => {}}
      />,
    );

    // Chờ chi tiết nạp xong rồi mới bấm (nút bị disable khi đang tải).
    expect(await screen.findByText("BH-0001")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Cập nhật trạng thái/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Cập nhật trạng thái bảo hành",
    });
    fireEvent.mouseDown(
      within(dialog).getByRole("combobox", { name: /Trạng thái mới/ }),
    );
    fireEvent.click(
      await screen.findByRole("option", { name: "Đã hoàn tất xử lý" }),
    );
    fireEvent.change(within(dialog).getByLabelText(/Kết quả kiểm tra/), {
      target: { value: "Đã kiểm tra xong" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Cập nhật" }));

    // Không im lặng: câu lỗi tiếng Việt hiện ở CẢ helperText của ô lẫn dòng
    // nhắc role="alert" cạnh nút; tuyệt đối không lộ khoá i18n thô.
    const messages = await within(dialog).findAllByText(
      "Kết quả xử lý (bắt buộc)",
    );
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const footerAlert = within(dialog)
      .getAllByRole("alert")
      .find((el) => el.textContent?.includes("Kết quả xử lý (bắt buộc)"));
    expect(footerAlert).toBeTruthy();
    expect(
      screen.queryByText("warranty.noteRequired.completed"),
    ).not.toBeInTheDocument();
    expect(updateWarrantyCase).not.toHaveBeenCalled();

    // Điền nốt "Kết quả xử lý" → submit phải đi: ngày dự kiến quá khứ KHÔNG
    // chặn nhánh COMPLETED, và payload không mang ngày đó.
    fireEvent.change(within(dialog).getByLabelText(/Kết quả xử lý/), {
      target: { value: "Đã xử lý" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cập nhật" }));
    await waitFor(() => expect(updateWarrantyCase).toHaveBeenCalledTimes(1));
    const request = vi.mocked(updateWarrantyCase).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(request.status).toBe("COMPLETED");
    expect(request.estimated_completion_date).toBeUndefined();
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
    expect(
      screen.getByText(/Hiện vật \/ serial \/ mã tạm/),
    ).toBeInTheDocument();
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

  // Enum của BE (item_status, trạng thái phiếu linh kiện) từng render thô nên
  // người dùng thấy "IN_WARRANTY" / "SCANNING" giữa màn tiếng Việt. Test này khoá
  // lại: mọi enum đi qua map nhãn, DOM không được chứa giá trị thô.
  it("dịch enum của BE sang tiếng Việt, không lộ mã thô ra UI", async () => {
    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={() => {}}
      />,
    );
    await screen.findByText("BH-0001");

    // Trạng thái item ở tab Tổng quan.
    expect(screen.getByText("Đang bảo hành")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("IN_WARRANTY");

    // Cột Trạng thái của bảng phiếu xuất linh kiện.
    fireEvent.click(screen.getByRole("tab", { name: /Linh kiện/ }));
    expect(await screen.findByText("Đang quét")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SCANNING");
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

  /**
   * Tái hiện lỗi UAT 04-09-2026: bấm "Cập nhật" ở dialog trạng thái, BE trả
   * 412 STALE_VERSION vì hồ sơ đã bị cập nhật ở nơi khác (tab thứ hai / mini
   * app / người khác). Trước khi sửa, FE:
   *   - đổ nguyên câu tiếng Anh của BE kèm "(2; 3)" (giá trị expected/current
   *     version) ra toast — người dùng không hiểu và không biết làm gì;
   *   - KHÔNG tải lại hồ sơ, nên detail.version vẫn là 2 và mọi lần bấm lại
   *     đều gửi đúng version cũ => kẹt vĩnh viễn trong dialog.
   * SRS §8.2 / AC-GWT-CONC-001: 412 phải là RELOAD_THEN_RETRY — tải lại rồi để
   * người dùng tự bấm lại, không tự gửi lại hộ.
   */
  it("412 STALE_VERSION: tải lại hồ sơ để lần bấm sau gửi version mới, không kẹt", async () => {
    vi.mocked(fetchWarrantyCase)
      .mockResolvedValueOnce({ ...DETAIL, version: 2 } as never)
      .mockResolvedValue({ ...DETAIL, version: 3 } as never);
    vi.mocked(updateWarrantyCase).mockRejectedValueOnce(
      staleVersionError(2, 3),
    );
    vi.mocked(updateWarrantyCase).mockResolvedValue({
      ...DETAIL,
      version: 4,
      status: "REPAIRING",
    } as never);

    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={() => {}}
      />,
    );
    await screen.findByText("BH-0001");

    await openRepairingStatusDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));

    await waitFor(() => {
      expect(vi.mocked(updateWarrantyCase)).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(updateWarrantyCase).mock.calls[0][1]).toMatchObject({
      ifMatch: 2,
    });

    // Sau 412, hồ sơ phải được tải lại (không đợi hết staleTime) …
    await waitFor(() => {
      expect(vi.mocked(fetchWarrantyCase).mock.calls.length).toBeGreaterThan(1);
    });

    // … và lần bấm tiếp theo gửi ĐÚNG version mới, không lặp lại version cũ.
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
    await waitFor(() => {
      expect(vi.mocked(updateWarrantyCase)).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(updateWarrantyCase).mock.calls[1][1]).toMatchObject({
      ifMatch: 3,
    });
  });

  it("412 STALE_VERSION: báo bằng tiếng Việt, không đổ số version kỹ thuật ra toast", async () => {
    const errorToast = vi.spyOn(toast, "error");
    vi.mocked(updateWarrantyCase).mockRejectedValue(staleVersionError(2, 3));

    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={() => {}}
      />,
    );
    await screen.findByText("BH-0001");

    await openRepairingStatusDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));

    // sonner bị mock no-op ở src/test/setup.ts nên toast không vào DOM —
    // kiểm ngay trên lời gọi toast.error.
    await waitFor(() => {
      expect(errorToast).toHaveBeenCalled();
    });
    const shown = errorToast.mock.calls.map((call) => String(call[0]));
    expect(shown.join(" | ")).toMatch(
      /Hồ sơ bảo hành vừa được cập nhật ở nơi khác/,
    );
    // Câu tiếng Anh của BE và cặp số version kỹ thuật không được lọt ra UI.
    for (const line of shown) {
      expect(line).not.toContain("Warranty case version mismatch");
      expect(line).not.toContain("(2; 3)");
    }
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

  /**
   * WAR-05: nhãn trả máy chỉ mở được SAU KHI sửa xong. Khoá cả hai chiều —
   * chặn ở giai đoạn đang xử lý (nhãn sẽ thiếu bệnh lỗi/linh kiện đã thay), và
   * PHẢI mở ở COMPLETED, đúng mốc "sửa xong, trước khi trả khách".
   */
  it.each([
    ["RECEIVED", true],
    ["CHECKING", true],
    ["REPAIRING", true],
    ["COMPLETED", false],
    ["RETURNED", false],
  ])(
    "case %s: nút In nhãn trả máy disabled=%s",
    async (status, shouldDisable) => {
      vi.mocked(fetchWarrantyCase).mockResolvedValue({
        ...DETAIL,
        status,
      } as never);
      renderWithProviders(
        <WarrantyDetailModal
          caseId="wc-1"
          onClose={() => {}}
          onOpenComponentIssue={() => {}}
        />,
      );
      await screen.findByText("BH-0001");

      const printButton = screen.getByRole("button", {
        name: /In nhãn trả máy/,
      });
      if (shouldDisable) {
        expect(printButton).toBeDisabled();
      } else {
        expect(printButton).toBeEnabled();
      }
    },
  );

  it("mở bản xem trước nhãn trả máy khi hồ sơ đã hoàn tất xử lý", async () => {
    vi.mocked(fetchWarrantyCase).mockResolvedValue({
      ...DETAIL,
      status: "COMPLETED",
    } as never);
    renderWithProviders(
      <WarrantyDetailModal
        caseId="wc-1"
        onClose={() => {}}
        onOpenComponentIssue={() => {}}
      />,
    );
    await screen.findByText("BH-0001");

    fireEvent.click(screen.getByRole("button", { name: /In nhãn trả máy/ }));

    const labelDialog = await screen.findByRole("dialog", {
      name: "Nhãn trả máy bảo hành",
    });
    // Hai khối riêng của nhãn bảo hành so với tem đóng gói xuất kho.
    expect(within(labelDialog).getByText("BỆNH / LỖI")).toBeInTheDocument();
    expect(
      within(labelDialog).getByText("LINH KIỆN ĐÃ THAY"),
    ).toBeInTheDocument();
    expect(
      within(labelDialog).getByText("PWR · Không lên nguồn"),
    ).toBeInTheDocument();
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
