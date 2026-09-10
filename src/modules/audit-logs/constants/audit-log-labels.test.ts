import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditDataEntries,
  auditObjectCode,
  auditObjectTypeLabel,
  auditReasonText,
  describeAuditLog,
} from "./audit-log-labels";
import type { AuditLog } from "../types/audit-logs.types";

/** Bản ghi thật rút từ DB dev (audit_log), chỉ giữ trường cần cho phép thử. */
function log(overrides: Partial<AuditLog>): AuditLog {
  return {
    id: "01a07b3c-0000-0000-0000-0000000036196c",
    actor_id: null,
    actor: null,
    action: "POST_ISSUE",
    object_type: "stock_document",
    object_id: "ecd447d4-aae2-460b-8626-66b146951de1",
    module: "OUTBOUND",
    reason: null,
    description:
      "POST_ISSUE stock_document #ecd447d4-aae2-460b-8626-66b146951de1",
    request_id: null,
    result: "SUCCESS",
    error_code: null,
    ip_address: "127.0.0.1",
    before_data: null,
    after_data: null,
    created_at: "2026-09-30T16:00:00Z",
    ...overrides,
  };
}

describe("nhãn Nhật ký hệ thống", () => {
  it("dịch tên bảng/slug route của BE thành loại đối tượng tiếng Việt", () => {
    expect(auditObjectTypeLabel("stock_document")).toBe("Phiếu nhập/xuất kho");
    expect(auditObjectTypeLabel("item_instance")).toBe(
      "Hiện vật (theo serial)",
    );
    // Số nhiều và slug có gạch ngang đều quy về cùng một nhãn.
    expect(auditObjectTypeLabel("users")).toBe("Tài khoản người dùng");
    expect(auditObjectTypeLabel("label-print-events")).toBe("Lượt in tem nhãn");
    // Giá trị chưa có nhãn: tách gạch dưới chứ không in mã thô.
    expect(auditObjectTypeLabel("some_new_table")).toBe("Some New Table");
  });

  it("action lạ không rơi về 'Khác' mà được tách gạch dưới", () => {
    expect(auditActionLabel("POST_RECEIPT")).toBe("Ghi sổ nhập kho");
    expect(auditActionLabel("BRAND_NEW_ACTION")).toBe("Brand New Action");
  });

  it("mô tả là câu tiếng Việt, ưu tiên số chứng từ thay vì UUID", () => {
    expect(
      describeAuditLog(log({ after_data: { doc_no: "PX-COV-00038" } })),
    ).toBe("Ghi nhận xuất kho — Phiếu nhập/xuất kho PX-COV-00038");
    // BE tra ngược được số phiếu từ bảng gốc: dùng mã đó dù after_data không có.
    expect(
      describeAuditLog(
        log({ object_code: "PN-COV-00012", after_data: { status: "POSTED" } }),
      ),
    ).toBe("Ghi nhận xuất kho — Phiếu nhập/xuất kho PN-COV-00012");
    // Loại đối tượng không có mã thì rút gọn UUID, không nối nguyên 36 ký tự.
    expect(describeAuditLog(log({}))).toBe(
      "Ghi nhận xuất kho — Phiếu nhập/xuất kho ecd447…951de1",
    );
  });

  it("mã đối tượng: ưu tiên mã BE tra ngược, rồi mã trong after_data, không bao giờ trả UUID", () => {
    expect(
      auditObjectCode(
        log({ object_code: "PX-COV-00038", after_data: { doc_no: "PX-CU" } }),
      ),
    ).toBe("PX-COV-00038");
    expect(
      auditObjectCode(log({ after_data: { doc_no: "PN-COV-00001" } })),
    ).toBe("PN-COV-00001");
    expect(auditObjectCode(log({ object_code: "   " }))).toBeNull();
    expect(auditObjectCode(log({ object_code: null }))).toBeNull();
  });

  it("lý do tiếng Anh/kỹ thuật của BE được dịch, lý do người nhập giữ nguyên", () => {
    expect(auditReasonText("Invalid credentials")).toBe(
      "Sai tài khoản hoặc mật khẩu",
    );
    expect(auditReasonText("Thiếu permission: iam.user.view")).toBe(
      "Thiếu quyền: iam.user.view",
    );
    expect(auditReasonText("Khách hoãn nhận hàng, huỷ phiếu xuất.")).toBe(
      "Khách hoãn nhận hàng, huỷ phiếu xuất.",
    );
    expect(auditReasonText(null)).toBeNull();
  });

  it("JSON trước/sau thay đổi thành cặp 'tên trường – giá trị' đọc được", () => {
    expect(auditDataEntries({ status: "SCANNING" })).toEqual([
      { key: "status", label: "Trạng thái", value: "Đang quét" },
    ]);

    const entries = auditDataEntries({
      sku_id: "b6f0f2b0-1111-4222-8333-444455556666",
      status: "POSTED",
      doc_no: "PN-COV-P00116",
      item_unique: true,
      movement_ids: [
        "b6f0f2b0-1111-4222-8333-444455556666",
        "c7f0f2b0-1111-4222-8333-444455556666",
      ],
      purpose: "WARRANTY",
      stock_effect: "NONE",
      file_size_bytes: 49995,
    });
    const byKey = Object.fromEntries(
      entries.map((entry) => [entry.key, entry.value]),
    );
    expect(byKey.status).toBe("Đã ghi sổ");
    expect(byKey.doc_no).toBe("PN-COV-P00116");
    expect(byKey.item_unique).toBe("Có");
    expect(byKey.movement_ids).toBe("2 biến động tồn");
    expect(byKey.purpose).toBe("Bảo hành");
    expect(byKey.stock_effect).toBe("Không đổi tồn");
    expect(byKey.file_size_bytes).toBe("48,82 KB");
    // Định danh kỹ thuật luôn rút gọn.
    expect(byKey.sku_id).toBe("b6f0f2…556666");
    // Trường nghiệp vụ đứng trước trường kỹ thuật.
    expect(entries[0].key).toBe("status");
  });

  it("trường JSON chưa có nhãn vẫn đọc được thay vì in khoá thô", () => {
    expect(auditDataEntries({ some_new_field: "abc" })[0].label).toBe(
      "Some New Field",
    );
  });
});
