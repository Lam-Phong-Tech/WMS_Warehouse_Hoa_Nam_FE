import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import { createMockAxiosError } from "@/shared/api/api-error";
import {
  importSkuExcel,
  normalizeSkuImportConstraints,
  SkuImportOutcomeUnknownError,
} from "./sku-import.service";

vi.mock("@/shared/api/http", () => ({ http: { post: vi.fn() } }));

const constraints = normalizeSkuImportConstraints({
  max_rows: 1000,
  max_file_size_kb: 10240,
  allowed_extensions: ["xlsx", "xls"],
})!;
function file() {
  return new File(["spreadsheet"], "sku.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
beforeEach(() => {
  vi.mocked(http.post).mockReset();
});

describe("SKU import file rejection", () => {
  it.each([null, constraints])(
    "does not invent a zero-row limit for older metadata (%s)",
    async (limits) => {
      vi.mocked(http.post).mockRejectedValue(
        createMockAxiosError({
          status: 422,
          data: {
            error_code: "SKU_IMPORT_ROW_LIMIT_EXCEEDED",
            message:
              "File import trải dài quá nhiều dòng bảng tính (kể cả dòng trống).",
            data: { committed: false, partial_write: false },
          },
        }),
      );
      await expect(
        importSkuExcel(file(), { dryRun: true, constraints: limits }),
      ).rejects.toThrow(
        "Tệp có quá nhiều dòng. Hãy xóa dòng trống thừa hoặc chia nhỏ tệp.",
      );
    },
  );

  it("keeps a contradictory file rejection uncertain and blocks a duplicate commit", async () => {
    const upload = new File(["contradictory-commit"], "sku.xlsx");
    vi.mocked(http.post).mockRejectedValue(
      createMockAxiosError({
        status: 422,
        data: {
          error_code: "SKU_IMPORT_FILE_INVALID",
          message: "Invalid file",
          data: {
            committed: true,
            partial_write: false,
            import_report_id: "uncertain-report",
          },
        },
      }),
    );
    await expect(
      importSkuExcel(upload, { constraints }),
    ).rejects.toBeInstanceOf(SkuImportOutcomeUnknownError);
    await expect(
      importSkuExcel(upload, { constraints }),
    ).rejects.toBeInstanceOf(SkuImportOutcomeUnknownError);
    expect(http.post).toHaveBeenCalledTimes(1);
  });
  it("rejects an oversized file before reading or uploading it", async () => {
    const upload = file();
    Object.defineProperty(upload, "size", { value: 10 * 1024 * 1024 + 1 });
    const read = vi.fn();
    Object.defineProperty(upload, "arrayBuffer", { value: read });
    await expect(
      importSkuExcel(upload, { dryRun: true, constraints }),
    ).rejects.toThrow("File quá lớn. Tối đa 10 MB");
    expect(read).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("uses the exact KB limit even when the MB display was rounded", async () => {
    const upload = file();
    Object.defineProperty(upload, "size", { value: 512 * 1024 + 1 });
    await expect(
      importSkuExcel(upload, {
        dryRun: true,
        constraints: { ...constraints, maxFileSizeKb: 512, maxFileSizeMb: 1 },
      }),
    ).rejects.toThrow("File quá lớn. Tối đa 0.5 MB");
    expect(http.post).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Thiếu cột bắt buộc: sku_code (hoặc alias legacy code).",
      "Tệp thiếu cột Mã SKU. Hãy tải tệp mẫu và bổ sung cột này.",
    ],
    [
      "Thiếu cột bắt buộc: sku_name (hoặc alias legacy name).",
      "Tệp thiếu cột Tên SKU. Hãy tải tệp mẫu và bổ sung cột này.",
    ],
    [
      "Unable to identify a reader for this file",
      "Tệp Excel không hợp lệ hoặc đã bị hỏng. Hãy dùng tệp mẫu và chọn lại.",
    ],
  ])(
    "explains file rejection without requiring row results: %s",
    async (message, expected) => {
      vi.mocked(http.post).mockRejectedValue(
        createMockAxiosError({
          status: 422,
          data: {
            error_code: "SKU_IMPORT_FILE_INVALID",
            message,
            data: {
              committed: false,
              partial_write: false,
              constraints: { max_rows: 1000, max_file_size_kb: 10240 },
            },
          },
        }),
      );
      await expect(
        importSkuExcel(file(), { dryRun: true, constraints }),
      ).rejects.toThrow(expected);
      expect(http.post).toHaveBeenCalledTimes(1);
    },
  );

  it.each([413, 422])(
    "translates the server size rejection (%s)",
    async (status) => {
      vi.mocked(http.post).mockRejectedValue(
        createMockAxiosError({
          status,
          data:
            status === 413
              ? { message: "Request Entity Too Large" }
              : {
                  message: "The given data was invalid.",
                  errors: {
                    file: [
                      "The file must not be greater than 10240 kilobytes.",
                    ],
                  },
                },
        }),
      );
      await expect(
        importSkuExcel(file(), { dryRun: true, constraints }),
      ).rejects.toThrow("File quá lớn. Tối đa 10 MB");
    },
  );
});
