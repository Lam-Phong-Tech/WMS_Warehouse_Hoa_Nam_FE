import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * Câu chữ nghiệp vụ đã chuyển sang catalog i18n, nên guard kiểm hai vế: component
 * trỏ đúng KHOÁ, và catalog giữ đúng CÂU tiếng Việt. Chỉ kiểm một vế thì đổi khoá
 * hoặc đổi câu đều lọt.
 */
function readMessages(): string {
  return read("src/shared/i18n/messages.ts");
}

describe("Flow 06 Packing Label alignment", () => {
  it("uses the aligned outbound page and one-label-per-lot semantics", () => {
    expect(read("src/modules/outbound/pages/OutboundPage.tsx")).toContain(
      "AlignedMvpOutboundPage",
    );
    const page = read("src/modules/outbound/pages/AlignedMvpOutboundPage.tsx");
    expect(page).not.toContain("Nhãn từng Item");

    // Ghi chú nghiệp vụ (Post là điều kiện duy nhất trừ tồn, RFID tùy chọn)
    // hiển thị đúng ngữ cảnh trong modal chi tiết, không phải banner chung
    // trên trang danh sách.
    const modal = read(
      "src/modules/outbound/components/AlignedOutboundDetailModal.tsx",
    );
    expect(modal).toContain("outbound.detail.postedBody");
    expect(modal).toContain("outbound.detail.rfidTitle");
    expect(modal).toContain("outbound.detail.rfidBody");

    const messages = readMessages();
    expect(messages).toContain("Tồn kho đã được trừ");
    expect(messages).toContain("RFID (tùy chọn)");
    expect(messages).toContain("không phải điều kiện để ghi nhận xuất kho");
  });

  it("does not include RFID or label state in the FE post readiness gate", () => {
    const modal = read(
      "src/modules/outbound/components/AlignedOutboundDetailModal.tsx",
    );
    // GĐ1: gate Post là quét đủ, không phải nhãn/RFID.
    expect(modal).toContain("postBlockReason");
    expect(modal).toContain("outbound.detail.blockNotScanned");
    expect(readMessages()).toContain("Chưa quét đủ");
    // Không còn trạng thái nghiệp vụ "đã dán nhãn" và RFID không gate Post.
    expect(modal).toContain('tồn tại trạng thái nghiệp vụ "đã dán"');
    expect(modal).not.toContain("labelApplied");
    expect(modal).not.toContain("allRfidMapped");
    expect(modal).not.toContain("ITEM_RFID_REQUIRED");
    // Print fail không rollback stock; FE reset preparedLabel để lần in lại
    // dùng version mới của server (BE bump version kể cả PRINT_FAILED).
    const onErrorBlock = modal.slice(modal.indexOf("printMutation"));
    expect(onErrorBlock).toContain("setPreparedLabel(null)");
    expect(onErrorBlock).toContain("outbound.detail.printErrorSuffix");
    expect(readMessages()).toContain(
      "Phiếu xuất kho vẫn giữ trạng thái đã ghi nhận.",
    );
  });

  it("creates the packing label at document level with customer phone", () => {
    const service = read(
      "src/modules/outbound/services/alignedOutboundService.ts",
    );
    expect(service).toContain("outbound_document_id");
    expect(service).toContain("customer_phone");
    expect(service).toContain("LABEL_SNAPSHOT_APPLY");
    expect(service).toContain("Boolean(row.applied_at)");
  });

  it("drives the §6 label lifecycle through the Annex C endpoints", () => {
    const endpoints = read("src/shared/api/endpoints.ts");
    expect(endpoints).toContain(
      '"/outbound-documents/:id/packing-labels/:labelId/preview"',
    );
    expect(endpoints).toContain(
      '"/outbound-documents/:id/packing-labels/:labelId/ready"',
    );
    expect(endpoints).toContain(
      '"/outbound-documents/:id/packing-labels/:labelId/print"',
    );
    expect(endpoints).toContain(
      '"/outbound-documents/:id/packing-labels/:labelId/reprint"',
    );
    // Annex C: scan = /scans, confirm import = /confirm, RFID = PUT .../rfid.
    expect(endpoints).toContain(
      'OUTBOUND_SCAN: "/outbound-documents/:id/scans"',
    );
    expect(endpoints).toContain(
      'OUTBOUND_REQUEST_IMPORT_CONFIRM: "/outbound-request-imports/:id/confirm"',
    );
    expect(endpoints).toContain(
      'OUTBOUND_ITEM_RFID: "/outbound-documents/:id/items/:itemId/rfid"',
    );

    const service = read(
      "src/modules/outbound/services/alignedOutboundService.ts",
    );
    expect(service).toContain("previewPackingLabel");
    expect(service).toContain("readyPackingLabel");

    const modal = read(
      "src/modules/outbound/components/AlignedOutboundDetailModal.tsx",
    );
    // §6: lifecycle DRAFT/PENDING_PRINT → PREVIEWED → READY_TO_PRINT → PRINTED.
    expect(modal).toContain('READY_TO_PRINT: "Sẵn sàng in"');
    expect(modal).toContain('PRINT_FAILED: "In thất bại"');
    // Không gửi lệnh in khi nhãn chưa Ready: prepareLabel chạy Preview → Ready
    // trước, print/reprint chỉ nhận label ở READY_TO_PRINT/PRINT_FAILED/PRINTED.
    expect(modal).toContain("previewPackingLabel({");
    expect(modal).toContain("readyPackingLabel({");
    expect(modal).toContain(
      '["READY_TO_PRINT", "PRINT_FAILED", "PRINTED"].includes(label.status)',
    );
  });

  it("keeps outbound documents creatable only through toa confirm (§8.1)", () => {
    const shipping = read("src/modules/shipping/services/shippingService.ts");
    expect(shipping).not.toContain(
      "export async function createOutboundDocument",
    );
    expect(shipping).not.toContain(
      "export async function updateOutboundDocument",
    );

    const intake = read(
      "src/modules/outbound/components/OutboundIntakeModal.tsx",
    );
    // Annex D SCR-OUT-01/SCR-REQ-OUT-01: SĐT + ngày toa + line mapping ở bước tiếp nhận.
    expect(intake).toContain("recipient_contact_phone");
    expect(intake).toContain("request_date");
    // Line mapping SKU + override người nhận thực hiện ở bước xác nhận toa.
    expect(intake).toContain("outbound.intake.stillInvalid");
    expect(readMessages()).toContain(
      "gán SKU/số lượng hoặc sửa người nhận rồi xác nhận lại",
    );
    expect(intake).toContain("Ghi đè người nhận khi xác nhận");
  });
});
