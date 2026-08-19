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
  SkuImportConcurrencyError,
  SkuImportUnavailableError,
  type SkuImportResult,
} from "@/modules/master-data/services/sku-import.service";
import { SkuImportModal } from "./SkuImportModal";
import { sha256HexSync } from "@/shared/utils/file-digest";

/** Kết quả dry-run sạch lỗi — đủ điều kiện để nút "Import chính thức" sáng lên. */
function cleanDryRun(overrides: Record<string, unknown> = {}): SkuImportResult {
  return normalizeSkuImportResult({
    template_version: "WWHN-172-SKU-IMPORT-v1.1.0",
    transaction_mode: "DRY_RUN_NO_WRITE",
    dry_run: true,
    committed: false,
    partial_write: false,
    duplicate: false,
    file_sha256: FILE_SHA256,
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

/**
 * FE331-P1-07R4 — nội dung file quyết định vân tay, nên nó phải là một hằng số tường
 * minh của bộ test và `file_sha256` mà "máy chủ" giả lập trả về phải là sha256 THẬT của
 * chính nội dung đó. Trả một chuỗi bừa (bản cũ dùng "aaa…") sẽ làm mọi ca kiểm tra vân
 * tay trở nên vô nghĩa.
 */
const FILE_CONTENT = "noi-dung-excel";
const FILE_SHA256 = sha256HexSync(new TextEncoder().encode(FILE_CONTENT));

function selectFile(
  name = "sku.xlsx",
  content = FILE_CONTENT,
  lastModified?: number,
) {
  const input = screen.getByLabelText(
    "Chọn file Excel import SKU",
  ) as HTMLInputElement;
  const file = new File([content], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ...(lastModified === undefined ? {} : { lastModified }),
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

function dryRunButton() {
  return screen.getByRole("button", { name: /Kiểm tra trước/ });
}

async function runDryRun() {
  // FE331-P1-07R4: nút chỉ sáng sau khi vân tay nội dung tính xong — chưa biết payload
  // hiện tại là gì thì chưa được gửi đi.
  await waitFor(() => expect(dryRunButton()).toBeEnabled());
  fireEvent.click(dryRunButton());
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
        maxPhysicalRowsToScan: 20040,
        errorFileMaxOnDiskHours: 48,
        concurrentImportPolicy: "FAIL_CLOSED_409",
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
      screen.getByText(
        /Tùy chọn hoặc nội dung file đã thay đổi sau lần kiểm tra thử/,
      ),
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
    selectFile("lan-1.xlsx", "noi-dung-lan-1");
    vi.mocked(importSkuExcel).mockResolvedValue(
      cleanDryRun({
        file_sha256: sha256HexSync(new TextEncoder().encode("noi-dung-lan-1")),
      }),
    );
    await runDryRun();

    selectFile("lan-2.xlsx", "noi-dung-lan-2");

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
        maxPhysicalRowsToScan: 5040,
        errorFileMaxOnDiskHours: 36,
        concurrentImportPolicy: "FAIL_CLOSED_409",
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
    // DEV330-P1-02R3: trần quét dòng bảng tính cũng là hạn mức người dùng chạm phải,
    // nên phải hiển thị — nếu không, thông báo lỗi máy chủ sẽ trông như mâu thuẫn.
    expect(
      screen.getByText(/5.040 dòng bảng tính \(kể cả dòng trống\)/),
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

/**
 * WWHN-330 DEV330-P1-07R3 — BE nay từ chối (409 CONCURRENCY_CONFLICT) thay vì âm thầm
 * chạy không khoá khi có một lần import trùng định danh đang chạy.
 *
 * Điều FE phải làm đúng: đây là lỗi TẠM THỜI của thời điểm gửi, không phải lỗi dữ liệu
 * trong file. Nếu UI xử lý nó như một lần "Import bị từ chối" thì người dùng thấy bảng
 * lỗi trống và mất luôn kết quả kiểm tra thử — bị đẩy đi sửa một file vốn đã hợp lệ.
 */
describe("SkuImportModal — tranh chấp import đồng thời (DEV330-P1-07R3)", () => {
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
        maxPhysicalRowsToScan: 20040,
        errorFileMaxOnDiskHours: 48,
        concurrentImportPolicy: "FAIL_CLOSED_409",
      },
      dataScope: "GLOBAL",
    });
    vi.mocked(importSkuExcel).mockReset();
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("giữ nguyên kết quả kiểm tra thử và cho thử lại ngay khi BE trả 409", async () => {
    vi.mocked(importSkuExcel)
      .mockResolvedValueOnce(cleanDryRun())
      .mockRejectedValueOnce(
        new SkuImportConcurrencyError(
          "Cùng file này đang được import với cùng tùy chọn; vui lòng đợi lần chạy hiện tại kết thúc rồi thử lại.",
          null,
        ),
      );

    renderWithProviders(
      <SkuImportModal
        open
        canImport
        onClose={() => {}}
        onImported={() => {}}
      />,
    );
    selectFile();
    await runDryRun();

    fireEvent.click(commitButton());

    // Nút Import vẫn sáng: payload không đổi, kết quả dry-run vẫn còn hiệu lực, người
    // dùng chỉ cần bấm lại. Đây là khác biệt quan sát được so với ca 422 (mất hiệu lực).
    await waitFor(() =>
      expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(commitButton()).toBeEnabled());
    expect(screen.queryByText(/Import bị từ chối/)).not.toBeInTheDocument();
  });

  /**
   * WWHN-224 DEV224-P1-05R — BE nay trả 503 khi không ghi được Import báo cáo, và
   * response 503 CÓ mang khối `data`. Nếu FE không tách lớp lỗi riêng thì nhánh xử lý
   * 422 sẽ nuốt nó và dựng ra một "kết quả import" không có dòng lỗi nào: người dùng
   * thấy bảng lỗi trống kèm chữ "Import bị từ chối" rồi đi sửa một file vốn hợp lệ.
   * Test khoá đúng hành vi quan sát được: file vẫn hợp lệ, nút Import vẫn sáng để bấm lại.
   */
  it("giữ nguyên kết quả kiểm tra thử và cho thử lại khi BE trả 503 mất Import báo cáo", async () => {
    vi.mocked(importSkuExcel)
      .mockResolvedValueOnce(cleanDryRun())
      .mockRejectedValueOnce(
        new SkuImportUnavailableError(
          "Không lưu được Import báo cáo; toàn bộ giao dịch đã hoàn tác, không có SKU nào được tạo/cập nhật. Vui lòng thử lại.",
          null,
        ),
      );

    renderWithProviders(
      <SkuImportModal
        open
        canImport
        onClose={() => {}}
        onImported={() => {}}
      />,
    );
    selectFile();
    await runDryRun();

    fireEvent.click(commitButton());

    await waitFor(() =>
      expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(commitButton()).toBeEnabled());
    expect(screen.queryByText(/Import bị từ chối/)).not.toBeInTheDocument();
  });
});

/**
 * WWHN-331 FE331-P1-07R4 — vân tay payload phải lấy từ NỘI DUNG, và một response đang
 * bay của thao tác cũ không được phép hợp thức hoá payload hiện tại.
 *
 * Bản R3 dựng vân tay từ `name` + `size` + `lastModified`. Bộ ba đó không định danh nội
 * dung, nên đúng lỗ hổng mà FE331-P1-01R3 vừa đóng ("commit một payload chưa hề được
 * kiểm tra thử") vẫn còn nguyên qua hai đường vào khác — hai đường đều là thao tác đời
 * thường của người dùng kho, không phải tình huống bịa ra để làm khó.
 */
describe("SkuImportModal — vân tay nội dung và ca đua preview (FE331-P1-07R4)", () => {
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
        maxPhysicalRowsToScan: 20040,
        errorFileMaxOnDiskHours: 48,
        concurrentImportPolicy: "FAIL_CLOSED_409",
      },
      dataScope: "GLOBAL",
    });
    vi.mocked(importSkuExcel).mockReset();
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

  /**
   * Đường vào 1: hai file KHÁC NHAU nhưng trùng cả tên, cỡ và mốc sửa.
   *
   * Kịch bản thật: dry-run `sku.xlsx` lấy từ thư mục A rồi chọn `sku.xlsx` đồng nghiệp
   * vừa gửi. Trùng tên là chuyện thường; hai workbook cùng template thường trùng cỡ; mốc
   * sửa trùng khi file được sao chép giữ nguyên timestamp / giải nén từ zip / đồng bộ ổ
   * mạng. Với vân tay metadata của bản R3, ba điều kiện đó đủ để nút Import SÁNG LÊN cho
   * một file chưa hề được kiểm tra thử.
   */
  it("hai file trùng tên/cỡ/mốc sửa nhưng khác nội dung KHÔNG dùng chung kết quả dry-run", async () => {
    const noiDungA = "noi-dung-excel-A";
    const noiDungB = "noi-dung-excel-B";
    const mocSua = 1_700_000_000_000;

    vi.mocked(importSkuExcel).mockResolvedValue(
      cleanDryRun({
        file_sha256: sha256HexSync(new TextEncoder().encode(noiDungA)),
      }),
    );

    renderModal();
    const fileA = selectFile("sku.xlsx", noiDungA, mocSua);
    await runDryRun();

    const fileB = selectFile("sku.xlsx", noiDungB, mocSua);

    // Tiền đề của ca này: metadata KHÔNG phân biệt được hai file.
    expect(fileB.name).toBe(fileA.name);
    expect(fileB.size).toBe(fileA.size);
    expect(fileB.lastModified).toBe(fileA.lastModified);

    // Chờ tới khi vân tay của file mới tính xong: trước đó UI đang ở trạng thái "đang
    // đọc nội dung file", và nút Import cũng đã tắt sẵn — nên chỉ kiểm nút thôi thì
    // không phân biệt được "tắt vì chưa băm xong" với "tắt vì phát hiện khác nội dung".
    await waitFor(() =>
      expect(
        screen.getByText(/Tùy chọn hoặc nội dung file đã thay đổi/),
      ).toBeInTheDocument(),
    );
    expect(commitButton()).toBeDisabled();
    // Và không có lời gọi commit nào lọt qua.
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });

  /**
   * Chiều ngược lại: phép siết này KHÔNG được biến thành chặn oan.
   *
   * Chọn lại file luôn xoá kết quả cũ — kể cả khi nội dung y hệt. Đó là chủ ý: vân tay
   * của file mới chỉ có sau một phép băm BẤT ĐỒNG BỘ, nên nếu giữ kết quả cũ lại trên
   * màn hình trong lúc chờ băm thì có một khoảng người dùng nhìn thấy số liệu của file
   * cũ bên cạnh tên file mới — đúng loại "dữ liệu cũ còn nằm trên màn hình" mà cả
   * FE331-P1-01R3 lẫn mục này đang đóng. Đổi lấy một cú bấm dry-run là đáng.
   *
   * Điều phải bảo đảm là: chạy lại dry-run thì mở khoá được ngay, không có trạng thái
   * kẹt nào. Nếu không, người dùng sẽ tìm đường lách thay vì làm đúng quy trình.
   */
  it("chọn lại file rồi dry-run lại thì mở khoá được ngay, không kẹt", async () => {
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun());

    renderModal();
    selectFile("ban-goc.xlsx", FILE_CONTENT, 1_700_000_000_000);
    await runDryRun();

    selectFile("ban-sao.xlsx", FILE_CONTENT, 1_800_000_000_000);
    await waitFor(() => expect(commitButton()).toBeDisabled());

    await runDryRun();
    expect(commitButton()).toBeEnabled();
  });

  /**
   * Đường vào 2: cùng một File, nhưng nội dung trên đĩa đã đổi giữa dry-run và Import.
   *
   * Kịch bản thật, và là kịch bản nguy hiểm nhất: dry-run thấy lỗi → mở Excel sửa → ghi
   * đè lên chính file đó → bấm Import mà không kiểm tra lại. Đối tượng `File` trình duyệt
   * giữ chỉ là tay cầm trỏ vào đường dẫn: có trình duyệt ném lỗi khi đọc, có trình duyệt
   * đọc ra nội dung MỚI mà không báo gì. Ca thứ hai là commit một nội dung chưa từng được
   * kiểm tra, mà lần này người dùng đinh ninh là đã kiểm tra rồi.
   */
  it("nội dung file đổi trên đĩa sau dry-run: chặn ngay ở client, không gửi request commit", async () => {
    vi.mocked(importSkuExcel).mockResolvedValue(cleanDryRun());

    renderModal();
    const file = selectFile();
    await runDryRun();
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);

    // Mô phỏng "file trên đĩa đã bị ghi đè": lần đọc tiếp theo ra nội dung khác.
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: async () =>
        new TextEncoder().encode("noi-dung-excel-da-bi-sua").buffer,
    });

    fireEvent.click(commitButton());

    await waitFor(() =>
      expect(
        screen.getByText(/Phải Kiểm tra trước \(dry-run\) hết lỗi/),
      ).toBeInTheDocument(),
    );
    // Bằng chứng quan trọng nhất: KHÔNG có request commit nào được gửi đi.
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
    expect(commitButton()).toBeDisabled();
  });

  /**
   * Ca đua request: response của lần dry-run đã bị bỏ qua về TRỄ hơn thao tác của người
   * dùng. Nó không được phép mở khoá nút Import cho payload hiện tại, và cũng không được
   * ghi số liệu của mình lên màn hình — người dùng sẽ đọc một bảng số không thuộc về
   * thao tác nào họ vừa làm.
   */
  it("response dry-run về sau khi người dùng đã đổi tùy chọn thì bị loại, không mở khoá Import", async () => {
    let giaiPhong: ((result: SkuImportResult) => void) | null = null;
    vi.mocked(importSkuExcel).mockImplementationOnce(
      () =>
        new Promise<SkuImportResult>((resolve) => {
          giaiPhong = resolve;
        }),
    );

    renderModal();
    selectFile();
    await waitFor(() => expect(dryRunButton()).toBeEnabled());
    fireEvent.click(dryRunButton());

    // Người dùng gạt công tắc trong lúc dry-run còn đang bay.
    await waitFor(() => expect(giaiPhong).not.toBeNull());
    fireEvent.click(optionSwitch());

    // Bây giờ response của payload CŨ mới về.
    giaiPhong!(cleanDryRun({ would_insert_rows: 7 }));

    await waitFor(() => expect(commitButton()).toBeDisabled());
    // Số liệu của lần chạy đã bị bỏ qua cũng không được hiện ra.
    expect(screen.queryByText(/Sẽ tạo mới: 7/)).not.toBeInTheDocument();
    expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1);
  });

  /**
   * Đối chiếu với `file_sha256` máy chủ trả về. Lệch nghĩa là thứ được kiểm tra thử
   * KHÔNG phải thứ người dùng đang cầm (đường truyền cắt cụt, proxy biến đổi nội dung).
   * Mở khoá Import khi đó là commit một nội dung không ai từng kiểm tra.
   */
  it("máy chủ báo lại sha256 khác với file trên máy: không mở khoá Import", async () => {
    vi.mocked(importSkuExcel).mockResolvedValue(
      cleanDryRun({ file_sha256: "b".repeat(64) }),
    );

    renderModal();
    selectFile();
    await waitFor(() => expect(dryRunButton()).toBeEnabled());
    fireEvent.click(dryRunButton());

    await waitFor(() =>
      expect(vi.mocked(importSkuExcel)).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(commitButton()).toBeDisabled());
    expect(
      screen.getByText(/Phải Kiểm tra trước \(dry-run\) hết lỗi/),
    ).toBeInTheDocument();
  });
});
