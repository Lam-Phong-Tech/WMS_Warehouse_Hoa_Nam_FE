import { describe, expect, it } from "vitest";
import {
  normalizeSkuImportConstraints,
  normalizeSkuImportReport,
  normalizeSkuImportResult,
  SkuImportConcurrencyError,
  SkuImportRejectedError,
  SkuImportUnavailableError,
} from "./sku-import.service";

describe("normalizeSkuImportResult", () => {
  it("maps a committed import result including WWHN-330 duplicate fields", () => {
    const result = normalizeSkuImportResult({
      template_version: "WWHN-172-SKU-IMPORT-v1.1.0",
      transaction_mode: "ALL_OR_NOTHING",
      dry_run: false,
      committed: true,
      partial_write: false,
      duplicate: false,
      duplicate_of_import_report_id: null,
      file_sha256: "abc123",
      header_map: { sku_code: 0, sku_name: 1 },
      total_rows: 2,
      valid_rows: 2,
      error_rows: 0,
      inserted_rows: 2,
      updated_rows: 0,
      would_insert_rows: 0,
      would_update_rows: 0,
      skipped_rows: 0,
      row_errors: [],
      import_report_id: "report-1",
    });

    expect(result).toMatchObject({
      committed: true,
      duplicate: false,
      duplicateOfImportReportId: null,
      insertedRows: 2,
      importReportId: "report-1",
    });
  });

  it("maps a duplicate/idempotent-replay result (WWHN-330 P1-03)", () => {
    const result = normalizeSkuImportResult({
      template_version: "WWHN-172-SKU-IMPORT-v1.1.0",
      transaction_mode: "ALL_OR_NOTHING",
      dry_run: false,
      committed: true,
      partial_write: false,
      duplicate: true,
      duplicate_of_import_report_id: "report-original",
      file_sha256: "abc123",
      header_map: {},
      total_rows: 1,
      valid_rows: 1,
      error_rows: 0,
      inserted_rows: 1,
      updated_rows: 0,
      would_insert_rows: 0,
      would_update_rows: 0,
      skipped_rows: 0,
      row_errors: [],
      import_report_id: "report-original",
    });

    expect(result.duplicate).toBe(true);
    expect(result.duplicateOfImportReportId).toBe("report-original");
  });

  it("normalizes row_errors entries (row/field/code/message/value)", () => {
    const result = normalizeSkuImportResult({
      template_version: "v1",
      transaction_mode: "ALL_OR_NOTHING",
      dry_run: false,
      committed: false,
      partial_write: false,
      duplicate: false,
      duplicate_of_import_report_id: null,
      file_sha256: "abc",
      header_map: {},
      total_rows: 1,
      valid_rows: 0,
      error_rows: 1,
      inserted_rows: 0,
      updated_rows: 0,
      would_insert_rows: 0,
      would_update_rows: 0,
      skipped_rows: 1,
      row_errors: [
        {
          row: 2,
          code: "DUPLICATE_SKU_CODE_IN_FILE",
          field: "sku_code",
          message: "Trùng dòng 2.",
          value: "DUP-001",
        },
      ],
      import_report_id: "report-err",
    });

    expect(result.rowErrors).toHaveLength(1);
    expect(result.rowErrors[0]).toMatchObject({
      row: 2,
      code: "DUPLICATE_SKU_CODE_IN_FILE",
      field: "sku_code",
      value: "DUP-001",
    });
  });

  it("falls back to safe defaults for a missing/malformed payload", () => {
    const result = normalizeSkuImportResult({});
    expect(result.rowErrors).toEqual([]);
    expect(result.totalRows).toBe(0);
    expect(result.importReportId).toBeNull();
    expect(result.duplicate).toBe(false);
    // Không có thông tin thì coi như KHÔNG có file lỗi để tải: thà ẩn nút còn hơn
    // hiện một nút chắc chắn 404 (WWHN-331 FE331-P1-03).
    expect(result.errorFileAvailable).toBe(false);
    expect(result.errorFileExpiresAt).toBeNull();
  });

  it("maps the error-file availability the BE returns with a rejected import", () => {
    const result = normalizeSkuImportResult({
      committed: false,
      error_rows: 2,
      row_errors: [
        { row: 2, code: "X", field: "sku_code", message: "m", value: "v" },
      ],
      import_report_id: "report-err",
      error_file_available: true,
      error_file_expires_at: "2026-08-19T10:00:00+07:00",
    });

    expect(result.errorFileAvailable).toBe(true);
    expect(result.errorFileExpiresAt).toBe("2026-08-19T10:00:00+07:00");
  });
});

describe("normalizeSkuImportReport", () => {
  it("uses the server-computed error_file_available flag", () => {
    const report = normalizeSkuImportReport({
      import_report_id: "report-1",
      import_type: "SKU",
      mode: "COMMIT",
      status: "REJECTED",
      file_sha256: "abc",
      error_file_available: true,
      error_file_expires_at: "2026-08-19T10:00:00+07:00",
      duplicate_of_replay: true,
      row_errors: [],
    });

    expect(report.errorFileAvailable).toBe(true);
    expect(report.errorFileExpiresAt).toBe("2026-08-19T10:00:00+07:00");
    expect(report.duplicateOfReplay).toBe(true);
  });

  it("treats a report without the flag as having no downloadable error file", () => {
    // BE cố tình KHÔNG trả `error_file_path` ra ngoài nữa; nếu payload chỉ còn mốc hết
    // hạn thì FE vẫn phải coi là không tải được, không được tự suy ra từ timestamp.
    const report = normalizeSkuImportReport({
      import_report_id: "report-2",
      error_file_expires_at: "2099-01-01T00:00:00+07:00",
      row_errors: [],
    });

    expect(report.errorFileAvailable).toBe(false);
    expect(report.duplicateOfReplay).toBe(false);
  });
});

describe("SkuImportRejectedError", () => {
  it("carries the parsed result alongside the message and original cause", () => {
    const result = normalizeSkuImportResult({
      row_errors: [
        { row: 2, code: "X", field: "sku_code", message: "m", value: "v" },
      ],
      import_report_id: "report-x",
    });
    const cause = new Error("network");
    const rejected = new SkuImportRejectedError(
      result,
      "Import bị từ chối.",
      cause,
    );

    expect(rejected).toBeInstanceOf(Error);
    expect(rejected.name).toBe("SkuImportRejectedError");
    expect(rejected.message).toBe("Import bị từ chối.");
    expect(rejected.result.importReportId).toBe("report-x");
    expect(rejected.cause).toBe(cause);
  });
});

/**
 * WWHN-330 DEV330-P1-02R3 / P1-01R3 / P1-07R3 — ba khoá hợp đồng mới mà BE công bố.
 * FE phải đọc được, và phải chịu được BE cũ chưa có chúng (0 / chuỗi rỗng) vì hai bên
 * không luôn deploy cùng lúc.
 */
describe("normalizeSkuImportConstraints — hợp đồng mở rộng R3", () => {
  it("đọc trần quét dòng vật lý, retention vật lý và chính sách tương tranh", () => {
    const constraints = normalizeSkuImportConstraints({
      decision_ref: "DEC-IMP-001",
      max_rows: 1000,
      max_file_size_kb: 10240,
      max_file_size_mb: 10,
      allowed_extensions: ["xlsx", "xls"],
      max_physical_rows_to_scan: 20040,
      error_file_expiry_hours: 24,
      error_file_max_on_disk_hours: 48,
      idempotency_window_hours: 24,
      idempotency_identity: ["file_sha256", "actor_id", "update_existing"],
      concurrent_import_policy: "FAIL_CLOSED_409",
    });

    expect(constraints).toMatchObject({
      maxPhysicalRowsToScan: 20040,
      errorFileMaxOnDiskHours: 48,
      concurrentImportPolicy: "FAIL_CLOSED_409",
    });
    // Hạn TẢI ĐƯỢC và thời gian TỒN TẠI TRÊN ĐĨA là hai con số khác nhau — gộp làm một
    // chính là chỗ review chỉ ra.
    expect(constraints?.errorFileMaxOnDiskHours).toBeGreaterThan(
      constraints?.errorFileExpiryHours ?? 0,
    );
  });

  it("BE cũ chưa công bố các khoá mới: về giá trị trung tính, không bịa số", () => {
    const constraints = normalizeSkuImportConstraints({
      decision_ref: "DEC-IMP-001",
      max_rows: 1000,
      max_file_size_kb: 10240,
    });

    expect(constraints).toMatchObject({
      maxPhysicalRowsToScan: 0,
      errorFileMaxOnDiskHours: 0,
      concurrentImportPolicy: "",
    });
  });
});

describe("SkuImportConcurrencyError (DEV330-P1-07R3)", () => {
  it("là lớp lỗi riêng, không phải một biến thể của lỗi từ chối dữ liệu", () => {
    const cause = new Error("409");
    const conflict = new SkuImportConcurrencyError(
      "Đang import, thử lại sau.",
      cause,
    );

    expect(conflict).toBeInstanceOf(Error);
    expect(conflict).not.toBeInstanceOf(SkuImportRejectedError);
    expect(conflict.name).toBe("SkuImportConcurrencyError");
    expect(conflict.cause).toBe(cause);
  });
});

describe("SkuImportUnavailableError (DEV224-P1-05R)", () => {
  it("là sự cố máy chủ thử lại được, không phải lỗi dữ liệu của người dùng", () => {
    const cause = new Error("503");
    const unavailable = new SkuImportUnavailableError(
      "Không lưu được Import báo cáo; toàn bộ giao dịch đã hoàn tác.",
      cause,
    );

    expect(unavailable).toBeInstanceOf(Error);
    // Then chốt: KHÔNG được là biến thể của lỗi từ chối dữ liệu, vì UI phân nhánh theo
    // instanceof — gộp chung là hiện bảng lỗi trống cho một file hợp lệ.
    expect(unavailable).not.toBeInstanceOf(SkuImportRejectedError);
    expect(unavailable).not.toBeInstanceOf(SkuImportConcurrencyError);
    expect(unavailable.name).toBe("SkuImportUnavailableError");
    expect(unavailable.retryable).toBe(true);
    expect(unavailable.cause).toBe(cause);
  });
});
