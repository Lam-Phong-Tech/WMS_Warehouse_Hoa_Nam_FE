import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
vi.mock("@/modules/master-data/services/sku-import.service", async () => {
  const actual = await vi.importActual<typeof import("@/modules/master-data/services/sku-import.service")>("@/modules/master-data/services/sku-import.service");
  return { ...actual, importSkuExcel: vi.fn(), fetchSkuImportConstraints: vi.fn(),
    fetchSkuImportReport: vi.fn(), downloadSkuImportTemplate: vi.fn(), downloadSkuImportErrorFile: vi.fn() };
});
import {
  fetchSkuImportConstraints, importSkuExcel, normalizeSkuImportResult,
  SkuImportConcurrencyError, SkuImportUnavailableError, type SkuImportResult,
} from "@/modules/master-data/services/sku-import.service";
import { SkuImportModal } from "./SkuImportModal";
import { sha256HexSync } from "@/shared/utils/file-digest";

const FILE_CONTENT = "noi-dung-excel";
const FILE_SHA256 = sha256HexSync(new TextEncoder().encode(FILE_CONTENT));
/** Isolated test response with server-declared flags, not runtime fallback data. */
function cleanDryRun(overrides: Record<string, unknown> = {}): SkuImportResult {
  return normalizeSkuImportResult({
    template_version: "WWHN-172-SKU-IMPORT-v1.1.0", transaction_mode: "DRY_RUN_NO_WRITE",
    dry_run: true, committed: false, partial_write: false, duplicate: false, update_existing: false,
    file_sha256: FILE_SHA256, header_map: {}, total_rows: 2, valid_rows: 2, error_rows: 0,
    inserted_rows: 0, updated_rows: 0, would_insert_rows: 2, would_update_rows: 0,
    skipped_rows: 0, row_errors: [], import_report_id: "11111111-1111-1111-1111-111111111111",
    constraints: { decision_ref: "DEC-IMP-001", max_rows: 1000, max_file_size_kb: 10240,
      max_file_size_mb: 10, allowed_extensions: ["xlsx", "xls"], error_file_expiry_hours: 24,
      idempotency_window_hours: 24, idempotency_identity: ["file_sha256", "actor_id", "update_existing"] },
    ...overrides,
  });
}
function selectFile(name = "sku.xlsx", content = FILE_CONTENT, lastModified?: number) {
  const input = screen.getByLabelText("Chọn tệp Excel chứa SKU") as HTMLInputElement;
  const file = new File([content], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ...(lastModified === undefined ? {} : { lastModified }),
  });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}
function commitButton() { return screen.getByRole("button", { name: /Nhập dữ liệu/ }); }
function optionSwitch() { return screen.getByLabelText("Cho phép cập nhật SKU đã tồn tại"); }
function dryRunButton() { return screen.getByRole("button", { name: /Kiểm tra trước/ }); }
async function runDryRun() {
  await waitFor(() => expect(dryRunButton()).toBeEnabled());
  fireEvent.click(dryRunButton());
  await waitFor(() => expect(commitButton()).toBeEnabled());
}
function arrangeConstraints() {
  vi.mocked(fetchSkuImportConstraints).mockResolvedValue({
    constraints: { decisionRef: "DEC-IMP-001", maxRows: 1000, maxFileSizeKb: 10240,
      maxFileSizeMb: 10, allowedExtensions: ["xlsx", "xls"], errorFileExpiryHours: 24,
      idempotencyWindowHours: 24, idempotencyIdentity: ["file_sha256", "actor_id", "update_existing"],
      maxPhysicalRowsToScan: 20040, errorFileMaxOnDiskHours: 48, concurrentImportPolicy: "FAIL_CLOSED_409" },
    dataScope: "GLOBAL",
  });
}
function renderModal() {
  return renderWithProviders(<SkuImportModal open canImport onClose={() => {}} onImported={() => {}} />);
}
describe("SkuImportModal — hiệu lực của kết quả dry-run (FE331-P1-01R3)", () => {
  beforeEach(() => {
    arrangeConstraints();
    vi.mocked(importSkuExcel).mockReset();
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun());
  });
  afterEach(cleanupTestState);
  it("dùng nút tải tệp tiếng Việt, hướng dẫn theo hover và nút làm lại ở tiêu đề", async () => {
    renderModal();
    const input = screen.getByLabelText("Chọn tệp Excel chứa SKU") as HTMLInputElement;
    const upload = await screen.findByRole("button", { name: "Tải lên" });
    expect(input).not.toBeVisible();
    expect(screen.getByText("Chưa chọn tệp")).toBeInTheDocument();
    const clickInput = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(upload);
    expect(clickInput).toHaveBeenCalledOnce();

    const instructions = screen.getByRole("button", { name: "Hướng dẫn nhập SKU" });
    expect(screen.queryByText(/Hệ thống chỉ ghi dữ liệu/)).not.toBeInTheDocument();
    fireEvent.mouseOver(instructions);
    expect(await screen.findByText(/Hệ thống chỉ ghi dữ liệu/)).toBeInTheDocument();

    selectFile("danh-sach.xlsx");
    expect(screen.getByText("danh-sach.xlsx")).toBeInTheDocument();
    const reset = screen.getByRole("button", { name: "Làm lại" });
    expect(reset.closest(".MuiDialogTitle-root")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Đóng" })).toHaveLength(1);
    fireEvent.click(reset);
    expect(screen.getByText("Chưa chọn tệp")).toBeInTheDocument();
  });
  it("bật update_existing sau khi dry-run (false → true): nút Import tắt và không commit payload chưa kiểm tra", async () => {
    renderModal(); selectFile(); await runDryRun();
    fireEvent.click(optionSwitch());
    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(screen.getByText(/Tệp hoặc lựa chọn cập nhật đã thay đổi sau lần kiểm tra trước/)).toBeInTheDocument();
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(importSkuExcel).mock.calls[0][1]).toMatchObject({ dryRun: true, updateExisting: false });
  });
  it("tắt update_existing sau khi dry-run (true → false): nút Import cũng tắt", async () => {
    renderModal(); selectFile(); fireEvent.click(optionSwitch());
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun({ update_existing: true, would_insert_rows: 0, would_update_rows: 2 }));
    await runDryRun();
    expect(vi.mocked(importSkuExcel).mock.calls[0][1]).toMatchObject({ dryRun: true, updateExisting: true });
    fireEvent.click(optionSwitch());
    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });
  it("chạy lại dry-run với tùy chọn mới thì mở khoá Import, và commit gửi đúng tùy chọn đó", async () => {
    renderModal(); selectFile(); await runDryRun();
    fireEvent.click(optionSwitch());
    await waitFor(() => expect(commitButton()).toBeDisabled());
    vi.mocked(importSkuExcel)
      .mockResolvedValueOnce(cleanDryRun({ update_existing: true }))
      .mockResolvedValueOnce(cleanDryRun({ update_existing: true, dry_run: false, committed: true,
        transaction_mode: "ALL_OR_NOTHING", inserted_rows: 2, would_insert_rows: 0 }));
    await runDryRun(); fireEvent.click(commitButton());
    await waitFor(() => expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(3));
    expect(vi.mocked(importSkuExcel).mock.calls[1][1]).toMatchObject({ dryRun: true, updateExisting: true });
    expect(vi.mocked(importSkuExcel).mock.calls[2][1]).toMatchObject({ dryRun: false, updateExisting: true });
  });
  it("đổi file sau khi dry-run cũng làm kết quả cũ hết hiệu lực", async () => {
    renderModal(); selectFile("lan-1.xlsx", "noi-dung-lan-1");
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun({ file_sha256: sha256HexSync(new TextEncoder().encode("noi-dung-lan-1")) }));
    await runDryRun(); selectFile("lan-2.xlsx", "noi-dung-lan-2");
    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });
  it("hiển thị hạn mức lấy từ hợp đồng BE, không hard-code trong FE", async () => {
    vi.mocked(fetchSkuImportConstraints).mockResolvedValue({
      constraints: { decisionRef: "DEC-IMP-001", maxRows: 250, maxFileSizeKb: 5120, maxFileSizeMb: 5,
        allowedExtensions: ["xlsx"], errorFileExpiryHours: 12, idempotencyWindowHours: 6,
        idempotencyIdentity: ["file_sha256", "actor_id", "update_existing"], maxPhysicalRowsToScan: 5040,
        errorFileMaxOnDiskHours: 36, concurrentImportPolicy: "FAIL_CLOSED_409" }, dataScope: "ACTOR_SCOPED",
    });
    renderModal();
    await waitFor(() => expect((screen.getByLabelText("Chọn tệp Excel chứa SKU") as HTMLInputElement).accept).toBe(".xlsx"));
    fireEvent.mouseOver(screen.getByRole("button", { name: "Hướng dẫn nhập SKU" }));
    await waitFor(() => expect(screen.getByText(/Tối đa 250 dòng dữ liệu/)).toBeInTheDocument());
    expect(screen.getByText(/kích thước tệp không quá 5 MB/)).toBeInTheDocument();
    expect(screen.getByText(/tệp lỗi có thể tải trong 12 giờ/)).toBeInTheDocument();
    expect(screen.getByText(/không trải quá 5.040 dòng kể cả dòng trống/)).toBeInTheDocument();
    expect(screen.queryByText(/1\.000 dòng/)).not.toBeInTheDocument();
  });
  it("BE không công bố hạn mức: mô tả chung, không bịa con số", async () => {
    vi.mocked(fetchSkuImportConstraints).mockResolvedValue({ constraints: null, dataScope: null });
    renderModal();
    fireEvent.mouseOver(screen.getByRole("button", { name: "Hướng dẫn nhập SKU" }));
    await waitFor(() => expect(screen.getByText(/Giới hạn số dòng và kích thước tệp do hệ thống kiểm soát/)).toBeInTheDocument());
  });
});
describe("SkuImportModal — tranh chấp import đồng thời (DEV330-P1-07R3)", () => {
  beforeEach(() => { arrangeConstraints(); vi.mocked(importSkuExcel).mockReset(); });
  afterEach(cleanupTestState);
  it("giữ nguyên kết quả kiểm tra thử và cho thử lại ngay khi BE trả 409", async () => {
    vi.mocked(importSkuExcel).mockResolvedValueOnce(cleanDryRun()).mockRejectedValueOnce(
      new SkuImportConcurrencyError("Cùng file này đang được import với cùng tùy chọn; hãy kiểm tra lần chạy hiện tại.", null));
    renderModal(); selectFile(); await runDryRun(); fireEvent.click(commitButton());
    await waitFor(() => expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(commitButton()).toBeEnabled());
    expect(screen.queryByText("Không được ghi dữ liệu")).not.toBeInTheDocument();
  });
  it("giữ nguyên kết quả kiểm tra thử và cho thử lại khi BE trả 503 mất Import báo cáo", async () => {
    vi.mocked(importSkuExcel).mockResolvedValueOnce(cleanDryRun()).mockRejectedValueOnce(
      new SkuImportUnavailableError("Không lưu được Import báo cáo; toàn bộ giao dịch đã hoàn tác, không có SKU nào được tạo/cập nhật.", null));
    renderModal(); selectFile(); await runDryRun(); fireEvent.click(commitButton());
    await waitFor(() => expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(commitButton()).toBeEnabled());
    expect(screen.queryByText("Không được ghi dữ liệu")).not.toBeInTheDocument();
  });
});
describe("SkuImportModal — vân tay nội dung và ca đua preview (FE331-P1-07R4)", () => {
  beforeEach(() => { arrangeConstraints(); vi.mocked(importSkuExcel).mockReset(); });
  afterEach(cleanupTestState);
  it("hai file trùng tên/cỡ/mốc sửa nhưng khác nội dung KHÔNG dùng chung kết quả dry-run", async () => {
    const noiDungA = "noi-dung-excel-A", noiDungB = "noi-dung-excel-B", mocSua = 1_700_000_000_000;
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun({ file_sha256: sha256HexSync(new TextEncoder().encode(noiDungA)) }));
    renderModal(); const fileA = selectFile("sku.xlsx", noiDungA, mocSua); await runDryRun();
    const fileB = selectFile("sku.xlsx", noiDungB, mocSua);
    expect(fileB.name).toBe(fileA.name); expect(fileB.size).toBe(fileA.size); expect(fileB.lastModified).toBe(fileA.lastModified);
    await waitFor(() => expect(screen.getByText(/Tệp hoặc lựa chọn cập nhật đã thay đổi/)).toBeInTheDocument());
    expect(commitButton()).toBeDisabled(); expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });
  it("chọn lại file rồi dry-run lại thì mở khoá được ngay, không kẹt", async () => {
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun());
    renderModal(); selectFile("ban-goc.xlsx", FILE_CONTENT, 1_700_000_000_000); await runDryRun();
    selectFile("ban-sao.xlsx", FILE_CONTENT, 1_800_000_000_000);
    await waitFor(() => expect(commitButton()).toBeDisabled());
    await runDryRun(); expect(commitButton()).toBeEnabled();
  });
  it("nội dung file đổi trên đĩa sau dry-run: chặn ngay ở client, không gửi request commit", async () => {
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun());
    renderModal(); const file = selectFile(); await runDryRun();
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
    Object.defineProperty(file, "arrayBuffer", { configurable: true,
      value: async () => new TextEncoder().encode("noi-dung-excel-da-bi-sua").buffer });
    fireEvent.click(commitButton());
    await waitFor(() => expect(screen.getByText(/Cần kiểm tra tệp và xử lý hết lỗi trước khi nhập dữ liệu/)).toBeInTheDocument());
    expect(commitButton()).toBeDisabled(); expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });
  it("response dry-run về sau khi người dùng đã đổi tùy chọn thì bị loại, không mở khoá Import", async () => {
    let giaiPhong: ((result: SkuImportResult) => void) | null = null;
    vi.mocked(importSkuExcel).mockImplementationOnce(() => new Promise<SkuImportResult>(resolve => { giaiPhong = resolve; }));
    renderModal(); selectFile(); await waitFor(() => expect(dryRunButton()).toBeEnabled()); fireEvent.click(dryRunButton());
    await waitFor(() => expect(giaiPhong).not.toBeNull()); fireEvent.click(optionSwitch());
    giaiPhong!(cleanDryRun({ would_insert_rows: 7 }));
    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(screen.queryByText(/Sẽ tạo mới: 7/)).not.toBeInTheDocument();
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });
  it("máy chủ báo lại sha256 khác với file trên máy: không mở khoá Import", async () => {
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun({ file_sha256: "b".repeat(64) }));
    renderModal(); selectFile(); await waitFor(() => expect(dryRunButton()).toBeEnabled()); fireEvent.click(dryRunButton());
    await waitFor(() => expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(screen.getByText(/Cần kiểm tra tệp và xử lý hết lỗi trước khi nhập dữ liệu/)).toBeInTheDocument();
  });
});
