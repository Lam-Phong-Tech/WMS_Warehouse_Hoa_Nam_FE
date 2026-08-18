import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Flow 06 Packing Label alignment", () => {
  it("uses the aligned outbound page and one-label-per-lot semantics", () => {
    expect(read("src/modules/outbound/pages/OutboundPage.tsx")).toContain(
      "AlignedMvpOutboundPage",
    );
    const page = read("src/modules/outbound/pages/AlignedMvpOutboundPage.tsx");
    expect(page).toContain("1 Packing Label/lô");
    expect(page).toContain("RFID tùy chọn");
    expect(page).toContain("Chỉ Post Issue mới trừ tồn");
    expect(page).not.toContain("Nhãn từng Item");
  });

  it("does not include RFID in the FE post readiness gate", () => {
    const modal = read(
      "src/modules/outbound/components/AlignedOutboundDetailModal.tsx",
    );
    expect(modal).toContain("packingLabels.length !== 1");
    expect(modal).toContain("!labelPrinted");
    expect(modal).toContain("!labelApplied");
    expect(modal).toContain("RFID không phải gate Post Issue");
    expect(modal).not.toContain("allRfidMapped");
    expect(modal).not.toContain("ITEM_RFID_REQUIRED");
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
    expect(modal).toContain("LABEL_LIFECYCLE");
    expect(modal).toContain("READY_TO_PRINT");
    // §6: không được gửi lệnh in khi nhãn chưa Ready.
    expect(modal).toContain("canSendPrint");
    expect(modal).toContain("Phải Preview → Ready trước khi gửi lệnh in");
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
    expect(intake).toContain("Map SKU (Confirm)");
    expect(intake).toContain("Override người nhận khi Confirm");
  });
});
