import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/master-data/services/sku-import.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/master-data/services/sku-import.service")
  >("@/modules/master-data/services/sku-import.service");
  return {
    ...actual,
    importSkuExcel: vi.fn(),
    fetchSkuImportConstraints: vi.fn(),
    fetchSkuImportReport: vi.fn(),
    downloadSkuImportTemplate: vi.fn(),
    downloadSkuImportErrorFile: vi.fn(),
  };
});

import {
  fetchSkuImportConstraints,
  importSkuExcel,
  normalizeSkuImportResult,
  type SkuImportResult,
} from "@/modules/master-data/services/sku-import.service";
import { SkuImportModal } from "./SkuImportModal";

/** Kết quả dry-run sạch lỗi — đủ điều kiện để nút "Import chính thức" sáng lên. */
function cleanDryRun(overrides: Record<string, unknown> = {}): SkuImportResult {
  return normalizeSkuImportResult({
    template_version: "WWHN-172-SKU-IMPORT-v1.1.0",
    transaction_mode: "DRY_RUN_NO_WRITE",
    dry_run: true,
    committed: false,
    partial_write: false,
    duplicate: false,
    file_sha256: "a".repeat(64),
    header_map: {},
    total_rows: 2,
    valid_rows: 2,
    error_rows: 0,
    inserted_rows: 0,
    updated_rows: 0,
    would_insert_rows: 2,
    would_update_rows: 0,
    skipped_rows: 0,
    row_errors: [],
    import_report_id: "11111111-1111-1111-1111-111111111111",
    constraints: {
      decision_ref: "DEC-IMP-001",
      max_rows: 1000,
      max_file_size_kb: 10240,
      max_file_size_mb: 10,
      allowed_extensions: ["xlsx", "xls"],
      error_file_expiry_hours: 24,
      idempotency_window_hours: 24,
      idempotency_identity: ["file_sha256", "actor_id", "update_existing"],
    },
    ...overrides,
  });
}

function selectFile(name = "sku.xlsx") {
  const input = screen.getByLabelText(
    "Chọn file Excel import SKU",
  ) as HTMLInputElement;
  const file = new File(["noi-dung-excel"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

function commitButton() {
  return screen.getByRole("button", { name: /Import chính thức/ });
}

function optionSwitch() {
  return screen.getByLabelText(
    "Cho phép ghi đè SKU đã tồn tại (update_existing)",
  );
}

async function runDryRun() {
  fireEvent.click(screen.getByRole("button", { name: /Kiểm tra trước/ }));
  await waitFor(() => expect(commitButton()).toBeEnabled());
}

/**
 * WWHN-331 FE331-P1-01R3 — kết quả dry-run chỉ có giá trị cho ĐÚNG payload đã gửi.
 *
 * Lỗi gốc bị review bắt hai lần liên tiếp (R2 rồi R3): `canCommit` không ràng buộc
 * `update_existing` hiện tại với `update_existing` lúc dry-run, nên người dùng kiểm tra
 * thử một payload rồi commit một payload khác — đúng thứ mà bước dry-run sinh ra để
 * ngăn. Test khoá cả hai chiều đổi công tắc.
 */
describe("SkuImportModal — hiệu lực của kết quả dry-run (FE331-P1-01R3)", () => {
  beforeEach(() => {
    vi.mocked(fetchSkuImportConstraints).mockResolvedValue({
      constraints: {
        decisionRef: "DEC-IMP-001",
        maxRows: 1000,
        maxFileSizeKb: 10240,
        maxFileSizeMb: 10,
        allowedExtensions: ["xlsx", "xls"],
        errorFileExpiryHours: 24,
        idempotencyWindowHours: 24,
        idempotencyIdentity: ["file_sha256", "actor_id", "update_existing"],
      },
      dataScope: "GLOBAL",
    });
    vi.mocked(importSkuExcel).mockReset();
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun());
  });

  afterEach(() => {
    cleanupTestState();
  });

  function renderModal() {
    return renderWithProviders(
      <SkuImportModal
        open
        canImport
        onClose={() => {}}
        onImported={() => {}}
      />,
    );
  }

  it("bật update_existing sau khi dry-run (false → true): nút Import tắt và không commit payload chưa kiểm tra", async () => {
    renderModal();
    selectFile();
    await runDryRun();

    fireEvent.click(optionSwitch());

    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(
      screen.getByText(/Tùy chọn hoặc file đã thay đổi sau lần kiểm tra thử/),
    ).toBeInTheDocument();

    // Chỉ có đúng 1 lời gọi: lần dry-run. Không có lời gọi commit nào lọt qua.
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(importSkuExcel).mock.calls[0][1]).toMatchObject({
      dryRun: true,
      updateExisting: false,
    });
  });

  it("tắt update_existing sau khi dry-run (true → false): nút Import cũng tắt", async () => {
    renderModal();
    selectFile();
    fireEvent.click(optionSwitch());
    vi.mocked(importSkuExcel).mockResolvedValue(
      cleanDryRun({ would_insert_rows: 0, would_update_rows: 2 }),
    );
    await runDryRun();
    expect(vi.mocked(importSkuExcel).mock.calls[0][1]).toMatchObject({
      dryRun: true,
      updateExisting: true,
    });

    fireEvent.click(optionSwitch());

    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });

  it("chạy lại dry-run với tùy chọn mới thì mở khoá Import, và commit gửi đúng tùy chọn đó", async () => {
    renderModal();
    selectFile();
    await runDryRun();

    fireEvent.click(optionSwitch());
    await waitFor(() => expect(commitButton()).toBeDisabled());

    await runDryRun();
    fireEvent.click(commitButton());

    await waitFor(() =>
      expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(3),
    );
    expect(vi.mocked(importSkuExcel).mock.calls[1][1]).toMatchObject({
      dryRun: true,
      updateExisting: true,
    });
    expect(vi.mocked(importSkuExcel).mock.calls[2][1]).toMatchObject({
      dryRun: false,
      updateExisting: true,
    });
  });

  it("đổi file sau khi dry-run cũng làm kết quả cũ hết hiệu lực", async () => {
    renderModal();
    selectFile("lan-1.xlsx");
    await runDryRun();

    selectFile("lan-2.xlsx");

    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });

  /**
   * FE331-P1-03R3: câu mô tả hạn mức phải là số máy chủ công bố, không phải hằng số FE.
   */
  it("hiển thị hạn mức lấy từ hợp đồng BE, không hard-code trong FE", async () => {
    vi.mocked(fetchSkuImportConstraints).mockResolvedValue({
      constraints: {
        decisionRef: "DEC-IMP-001",
        maxRows: 250,
        maxFileSizeKb: 5120,
        maxFileSizeMb: 5,
        allowedExtensions: ["xlsx"],
        errorFileExpiryHours: 12,
        idempotencyWindowHours: 6,
        idempotencyIdentity: ["file_sha256", "actor_id", "update_existing"],
      },
      dataScope: "ACTOR_SCOPED",
    });

    renderModal();

    await waitFor(() =>
      expect(screen.getByText(/tối đa 250 dòng dữ liệu/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/file ≤ 5 MB/)).toBeInTheDocument();
    expect(
      screen.getByText(/trong 6h được coi là gửi trùng/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/1000 dòng/)).not.toBeInTheDocument();
  });

  it("BE không công bố hạn mức: mô tả chung, không bịa con số", async () => {
    vi.mocked(fetchSkuImportConstraints).mockResolvedValue({
      constraints: null,
      dataScope: null,
    });

    renderModal();

    await waitFor(() =>
      expect(
        screen.getByText(
          /Giới hạn số dòng và kích thước file do máy chủ quy định/,
        ),
      ).toBeInTheDocument(),
    );
  });
});
