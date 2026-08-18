import { useState } from "react";
import {
  Alert,
  Button,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import {
  CloseOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getApiErrorMessage,
  isNoPermissionError,
  normalizeError,
} from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  downloadSkuImportErrorFile,
  downloadSkuImportTemplate,
  fetchSkuImportConstraints,
  fetchSkuImportReport,
  importSkuExcel,
  SkuImportConcurrencyError,
  SkuImportRejectedError,
  SkuImportUnavailableError,
  type SkuImportConstraints,
  type SkuImportResult,
  type SkuImportRowError,
} from "@/modules/master-data/services/sku-import.service";

interface SkuImportModalProps {
  open: boolean;
  /** sku.manage — cùng quyền BE gate cho cả 4 route import (template/excel/reports). */
  canImport: boolean;
  onClose: () => void;
  /** Import chính thức thành công (committed, không phải duplicate) — reload bảng SKU. */
  onImported: () => void;
}

/** Hiển thị mốc hết hạn cho người dùng — chỉ để đọc, không dùng để quyết định UI. */
function formatExpiry(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "";
  const parsed = new Date(isoTimestamp);
  return Number.isNaN(parsed.getTime())
    ? ""
    : ` (hạn tải: ${parsed.toLocaleString("vi-VN")})`;
}

function handleBlobDownload(
  blob: Blob,
  fallbackFileName: string,
  fileName: string | null,
) {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName || fallbackFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ROW_ERROR_COLUMNS: ColumnsType<SkuImportRowError> = [
  { title: "Dòng", dataIndex: "row", width: 70 },
  { title: "Trường", dataIndex: "field", width: 140 },
  { title: "Mã lỗi", dataIndex: "code", width: 200 },
  { title: "Nội dung", dataIndex: "message" },
  {
    title: "Giá trị",
    dataIndex: "value",
    width: 160,
    render: (value: unknown) =>
      value === null || value === undefined ? (
        <Typography.Text type="secondary">-</Typography.Text>
      ) : (
        String(value)
      ),
  },
];

const ERROR_FILE_GONE_HINT =
  "File lỗi CSV không còn tải được: báo cáo này không có dòng lỗi, hoặc file đã quá hạn và bị dọn dẹp định kỳ. Chạy lại Kiểm tra trước (dry-run) để sinh báo cáo lỗi mới; bảng lỗi ở trên vẫn dùng đối soát được.";

/**
 * WWHN-331 FE331-P1-03R3 — câu mô tả hạn mức dựng từ hợp đồng BE trả về.
 *
 * Không còn con số nào được viết cứng ở FE: nếu BE chưa công bố `constraints` thì UI nói
 * đúng điều đó (máy chủ vẫn là nơi chặn) thay vì đoán một con số có thể đã lỗi thời.
 */
function describeConstraints(constraints: SkuImportConstraints | null): string {
  if (!constraints) {
    return "Giới hạn số dòng và kích thước file do máy chủ quy định; nếu vượt, hệ thống hiển thị đúng thông báo lỗi máy chủ trả về.";
  }

  const parts = [
    `Giới hạn đang áp dụng: tối đa ${constraints.maxRows.toLocaleString("vi-VN")} dòng dữ liệu mỗi lần import, file ≤ ${constraints.maxFileSizeMb} MB`,
  ];
  if (constraints.allowedExtensions.length > 0) {
    parts.push(
      `định dạng ${constraints.allowedExtensions.map((extension) => `.${extension}`).join("/")}`,
    );
  }
  if (constraints.errorFileExpiryHours > 0) {
    parts.push(
      `file lỗi CSV tải được trong ${constraints.errorFileExpiryHours}h`,
    );
  }
  if (constraints.idempotencyWindowHours > 0) {
    parts.push(
      `nộp lại đúng file này với cùng tùy chọn trong ${constraints.idempotencyWindowHours}h được coi là gửi trùng và không ghi lần hai`,
    );
  }
  if (constraints.maxPhysicalRowsToScan > 0) {
    // DEV330-P1-02R3: hạn mức thứ hai mà người dùng CÓ THỂ chạm phải mà không hiểu vì
    // sao — file chỉ vài trăm dòng dữ liệu nhưng có dòng trống rải rác tới tận cuối
    // bảng tính. Không nói ra thì thông báo lỗi máy chủ ("trải dài quá N dòng bảng
    // tính") trông như mâu thuẫn với hạn mức 1000 dòng đang hiển thị ngay trên màn hình.
    parts.push(
      `dữ liệu không trải quá ${constraints.maxPhysicalRowsToScan.toLocaleString("vi-VN")} dòng bảng tính (kể cả dòng trống)`,
    );
  }

  return `${parts.join("; ")}.`;
}

/** Thuộc tính accept của input file — cũng lấy từ hợp đồng, không viết cứng. */
function acceptAttribute(constraints: SkuImportConstraints | null): string {
  const extensions =
    constraints && constraints.allowedExtensions.length > 0
      ? constraints.allowedExtensions
      : ["xlsx", "xls"];
  return extensions.map((extension) => `.${extension}`).join(",");
}

/**
 * WWHN-331 FE331-P1-01R3 — "vân tay" của payload đã được kiểm tra thử.
 *
 * Kết quả dry-run chỉ đúng cho ĐÚNG bộ (file, update_existing) đã gửi đi. Trước đây
 * `canCommit` chỉ hỏi "đã có previewResult và previewResult sạch lỗi chưa", nên chuỗi
 * thao tác dry-run (update_existing=false) → gạt công tắc → Import chính thức vẫn bấm
 * được, và thứ được commit là một payload CHƯA HỀ được kiểm tra thử:
 *
 * - false → true: preview báo "sẽ tạo mới N SKU"; commit thật lại được phép GHI ĐÈ SKU
 *   đang tồn tại — người dùng sửa dữ liệu đang chạy mà không hề thấy trước.
 * - true → false: preview sạch lỗi vì cho phép ghi đè; commit thật lại trả DUPLICATE_CODE
 *   và bị từ chối, người dùng không hiểu vì sao "đã kiểm tra rồi" mà vẫn lỗi.
 *
 * Vân tay gắn vào kết quả preview giải quyết cả hai chiều, và cũng chặn được ca đua:
 * người dùng gạt công tắc trong lúc dry-run đang chạy, response cũ về sau đó thì kết quả
 * đó thuộc payload cũ, không được phép mở khoá nút Import cho payload mới.
 */
function payloadSignature(file: File | null, updateExisting: boolean): string {
  if (!file) return "";
  return [
    file.name,
    file.size,
    file.lastModified,
    updateExisting ? "update_existing=1" : "update_existing=0",
  ].join("|");
}

/**
 * WWHN-330 P1-01 / WWHN-331 FE331-P1-03: khu vực tải file lỗi CSV theo Import báo cáo.
 *
 * Quyết định "có nút tải hay không" lấy DUY NHẤT từ `error_file_available` do BE tính
 * (đã sinh file VÀ chưa hết hạn), đúng bằng điều kiện endpoint tải dùng để trả 200 hay
 * 404 — nên UI không bao giờ hiện một nút chắc chắn 404, và cũng không tự so hạn dùng
 * bằng đồng hồ máy client (lệch giờ/timezone sẽ cho kết quả sai).
 *
 * `availableHint` là giá trị BE đã trả ngay trong response import (cùng field, cùng
 * cách tính) nên khu vực này hiển thị đúng ngay lần render đầu, không nháy "đang kiểm
 * tra"; query báo cáo chỉ để làm mới trạng thái (vd. file vừa bị dọn) và lấy mốc hết hạn.
 */
function SkuImportErrorFilePanel({
  reportId,
  availableHint,
  expiresAtHint,
}: {
  reportId: string;
  availableHint: boolean;
  expiresAtHint: string | null;
}) {
  const reportQuery = useQuery({
    queryKey: ["sku-import-report", reportId],
    queryFn: () => fetchSkuImportReport(reportId),
    retry: false,
  });

  const downloadMutation = useMutation({
    mutationFn: () => downloadSkuImportErrorFile(reportId),
    onSuccess: ({ blob, fileName }) => {
      handleBlobDownload(blob, `sku-import-errors-${reportId}.csv`, fileName);
      toast.success("Đã tải file lỗi CSV.");
    },
    onError: (error) => {
      // File có thể vừa bị dọn/hết hạn ngay giữa lúc người dùng bấm — trạng thái
      // thật đã đổi, nên lấy lại báo cáo để nút tự tắt thay vì để người dùng bấm lại
      // vào một hành động chắc chắn thất bại.
      if (normalizeError(error).status === 404) {
        void reportQuery.refetch();
      }
    },
  });

  if (reportQuery.error && isNoPermissionError(reportQuery.error)) {
    // RBAC: không đủ quyền xem Import báo cáo — ẩn hẳn khu vực tải, không lộ trạng thái.
    return null;
  }

  // Lỗi khác (mạng/5xx) mà chưa từng có dữ liệu: cho retry tường minh, không chặn màn hình.
  if (reportQuery.error && !reportQuery.data) {
    return (
      <ApiErrorAlert
        error={reportQuery.error}
        title="Không kiểm tra được file lỗi"
        onRetry={() => void reportQuery.refetch()}
      />
    );
  }

  const report = reportQuery.data;
  const available = report ? report.errorFileAvailable : availableHint;
  const expiresAt = report ? report.errorFileExpiresAt : expiresAtHint;

  if (!available) {
    return (
      <Space wrap>
        <Tag color="default">Không còn file lỗi</Tag>
        <Typography.Text type="secondary">
          {ERROR_FILE_GONE_HINT}
        </Typography.Text>
      </Space>
    );
  }

  const downloadError = downloadMutation.error;

  return (
    <Space orientation="vertical" size={6}>
      <Space wrap align="center">
        <Button
          icon={<DownloadOutlined />}
          loading={downloadMutation.isPending || reportQuery.isFetching}
          disabled={downloadMutation.isPending}
          onClick={() => downloadMutation.mutate()}
        >
          Tải file lỗi (CSV)
        </Button>
        <Typography.Text type="secondary">
          {`Gồm cột row/field/error_code/message/value cho từng dòng bị từ chối${formatExpiry(expiresAt)}.`}
        </Typography.Text>
      </Space>
      {downloadError ? (
        isNoPermissionError(downloadError) ? (
          <Typography.Text type="secondary">
            Bạn không có quyền tải file lỗi của Import báo cáo này.
          </Typography.Text>
        ) : normalizeError(downloadError).status === 404 ? (
          <Typography.Text type="secondary">
            {ERROR_FILE_GONE_HINT}
          </Typography.Text>
        ) : (
          <ApiErrorAlert
            error={downloadError}
            title="Không tải được file lỗi"
            onRetry={() => downloadMutation.mutate()}
          />
        )
      ) : null}
    </Space>
  );
}

function ResultSummary({
  result,
  label,
}: {
  result: SkuImportResult;
  label: string;
}) {
  return (
    <Space wrap>
      <Tag color="blue">{label}</Tag>
      <Typography.Text>Tổng: {result.totalRows}</Typography.Text>
      <Typography.Text type="success">
        Hợp lệ: {result.validRows}
      </Typography.Text>
      <Typography.Text type={result.errorRows > 0 ? "danger" : undefined}>
        Lỗi: {result.errorRows}
      </Typography.Text>
      {result.dryRun ? (
        <>
          <Typography.Text>
            Sẽ tạo mới: {result.wouldInsertRows}
          </Typography.Text>
          <Typography.Text>
            Sẽ cập nhật: {result.wouldUpdateRows}
          </Typography.Text>
        </>
      ) : (
        <>
          <Typography.Text>Đã tạo mới: {result.insertedRows}</Typography.Text>
          <Typography.Text>Đã cập nhật: {result.updatedRows}</Typography.Text>
        </>
      )}
    </Space>
  );
}

/**
 * WWHN-331 [FE1] Hoàn thiện UX nhập dữ liệu tùy chọn (subtask WWHN-89).
 * Luồng chuẩn theo contract thật (ImportController::importExcel, BE m1, permission
 * sku.manage): upload file → dry-run preview (WWHN-224) → nếu hết lỗi mới cho Import
 * chính thức (dry_run=false, commit atomically). Không có API "confirm theo id" riêng
 * như luồng outbound-request-imports — mỗi lần gọi /skus/import-excel vừa validate vừa
 * (tuỳ dry_run) commit cho chính file đó.
 */
export function SkuImportModal({
  open,
  canImport,
  onClose,
  onImported,
}: SkuImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [previewResult, setPreviewResult] = useState<SkuImportResult | null>(
    null,
  );
  /** Payload đã sinh ra `previewResult` — xem payloadSignature(). */
  const [previewSignature, setPreviewSignature] = useState("");
  const [commitResult, setCommitResult] = useState<SkuImportResult | null>(
    null,
  );

  /**
   * Đổi file hoặc đổi tùy chọn → kết quả cũ hết hiệu lực ngay: xoá số liệu để màn hình
   * không còn con số thuộc payload khác. Vân tay của lần kiểm tra thử gần nhất được GIỮ
   * lại (không xoá) để UI phân biệt được "chưa từng kiểm tra thử" với "đã kiểm tra thử
   * nhưng lựa chọn vừa thay đổi" — hai trạng thái cần hai câu hướng dẫn khác nhau.
   */
  const invalidatePreview = () => {
    setPreviewResult(null);
    setCommitResult(null);
  };

  const resetResults = () => {
    invalidatePreview();
    setPreviewSignature("");
  };

  const resetAll = () => {
    setFile(null);
    setFileInputKey((key) => key + 1);
    setUpdateExisting(false);
    resetResults();
  };

  const close = () => {
    if (previewMutation.isPending || commitMutation.isPending) return;
    resetAll();
    onClose();
  };

  // Payload được truyền vào mutation thay vì đọc lại từ state trong callback: kết quả
  // trả về luôn gắn đúng bộ (file, update_existing) đã gửi đi, kể cả khi người dùng đổi
  // lựa chọn trong lúc request còn đang chạy.
  const previewMutation = useMutation({
    mutationFn: async (payload: { file: File; updateExisting: boolean }) => {
      const result = await importSkuExcel(payload.file, {
        updateExisting: payload.updateExisting,
        dryRun: true,
      });
      return {
        result,
        signature: payloadSignature(payload.file, payload.updateExisting),
      };
    },
    onSuccess: ({ result, signature }) => {
      setCommitResult(null);
      setPreviewResult(result);
      setPreviewSignature(signature);
      if (result.errorRows === 0) {
        toast.success(
          `Kiểm tra thử hợp lệ — sẽ tạo mới ${result.wouldInsertRows}, cập nhật ${result.wouldUpdateRows} SKU.`,
        );
      } else {
        toast.warning(
          `File có ${result.errorRows} dòng lỗi. Sửa file rồi upload lại — không thể Import khi còn lỗi.`,
        );
      }
    },
    onError: (error, payload) => {
      setCommitResult(null);
      // Dry-run không lấy khoá nên về nguyên tắc không gặp 409; xử lý ở đây để nếu hợp
      // đồng đổi thì UI vẫn nói đúng bản chất thay vì vẽ một bảng lỗi trống.
      if (error instanceof SkuImportConcurrencyError) {
        toast.warning(error.message);
        return;
      }
      // WWHN-224 DEV224-P1-05R: mất Import báo cáo là sự cố phía máy chủ, đã rollback.
      // Giữ nguyên màn hình để người dùng bấm Kiểm tra thử lại ngay, và KHÔNG xoá kết
      // quả cũ như thể file vừa hỏng.
      if (error instanceof SkuImportUnavailableError) {
        toast.warning(error.message);
        return;
      }
      if (error instanceof SkuImportRejectedError) {
        setPreviewResult(error.result);
        setPreviewSignature(
          payloadSignature(payload.file, payload.updateExisting),
        );
        toast.warning(error.message);
        return;
      }
      setPreviewResult(null);
      setPreviewSignature("");
      toast.error(getApiErrorMessage(error, "Kiểm tra thử import thất bại."));
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (payload: { file: File; updateExisting: boolean }) => {
      return importSkuExcel(payload.file, {
        updateExisting: payload.updateExisting,
        dryRun: false,
      });
    },
    onSuccess: (result) => {
      setCommitResult(result);
      if (result.duplicate) {
        // WWHN-330 P1-03 + WWHN-331 FE331-P1-02R3: file này đã được import (commit)
        // trước đó bởi cùng người dùng VÀ cùng tùy chọn update_existing — BE không ghi
        // lại, không tạo SKU lần 2. Đây KHÔNG phải lỗi chung chung; phải nói rõ đây là
        // bản ghi cũ, và nói rõ tùy chọn cũng nằm trong điều kiện trùng để người dùng
        // biết đổi tùy chọn thì lần chạy sau vẫn thực thi.
        toast.info(
          `File này đã được import trước đó với cùng tùy chọn (Import báo cáo #${result.duplicateOfImportReportId ?? "-"}). Không có SKU nào được tạo/cập nhật lần nữa.`,
        );
        return;
      }
      toast.success(
        `Import thành công — đã tạo mới ${result.insertedRows}, cập nhật ${result.updatedRows} SKU.`,
      );
      onImported();
    },
    onError: (error) => {
      // WWHN-330 DEV330-P1-07R3: 409 CONCURRENCY_CONFLICT — file hợp lệ, chỉ là đang có
      // một lần import trùng định danh chạy dở. Giữ nguyên kết quả kiểm tra thử để người
      // dùng bấm Import lại ngay được, và KHÔNG gọi setCommitResult(null) vì làm vậy sẽ
      // xoá màn hình như thể lần chạy đã hỏng dữ liệu — trong khi máy chủ vừa bảo đảm
      // "không có SKU nào được tạo/cập nhật".
      if (error instanceof SkuImportConcurrencyError) {
        toast.warning(error.message);
        return;
      }
      // WWHN-224 DEV224-P1-05R: 503 SKU_IMPORT_REPORT_PERSISTENCE_FAILED. Máy chủ đã
      // rollback toàn bộ (không SKU nào được tạo/cập nhật) nên đúng như nhánh 409: giữ
      // nguyên kết quả kiểm tra thử để bấm Import lại được ngay, không setCommitResult
      // (null) — xoá màn hình ở đây sẽ ám chỉ dữ liệu vừa bị hỏng dở.
      if (error instanceof SkuImportUnavailableError) {
        toast.warning(error.message);
        return;
      }
      if (error instanceof SkuImportRejectedError) {
        setCommitResult(error.result);
        toast.error(error.message);
        return;
      }
      setCommitResult(null);
      toast.error(getApiErrorMessage(error, "Import SKU thất bại."));
    },
  });

  /**
   * WWHN-331 FE331-P1-03R3: đọc hạn mức máy chủ đang áp dụng ngay khi mở modal, để câu
   * mô tả cho người dùng là hợp đồng thật chứ không phải hằng số FE tự viết. Chỉ gọi khi
   * modal mở và người dùng có quyền — endpoint này gate `sku.manage`. Lỗi ở đây không
   * chặn luồng import: thiếu hợp đồng thì UI mô tả chung, máy chủ vẫn là nơi chặn thật.
   */
  const constraintsQuery = useQuery({
    queryKey: ["sku-import-constraints"],
    queryFn: fetchSkuImportConstraints,
    enabled: open && canImport,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const constraints =
    constraintsQuery.data?.constraints ??
    commitResult?.constraints ??
    previewResult?.constraints ??
    null;

  const templateMutation = useMutation({
    mutationFn: downloadSkuImportTemplate,
    onSuccess: ({ blob, fileName }) => {
      handleBlobDownload(blob, "sku-import-template.xlsx", fileName);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không tải được file mẫu."));
    },
  });

  const currentSignature = payloadSignature(file, updateExisting);
  /**
   * WWHN-331 FE331-P1-01R3: preview chỉ còn hiệu lực khi payload hiện tại y hệt payload
   * đã kiểm tra thử. Đổi file HOẶC đổi update_existing đều làm preview cũ hết hiệu lực.
   */
  const previewMatchesCurrentPayload =
    previewSignature !== "" && previewSignature === currentSignature;

  // Chỉ cho Import chính thức khi ĐÚNG payload này đã dry-run và không còn lỗi — tránh
  // commit một payload chưa từng được kiểm tra thử, tránh gửi file chắc chắn bị 422, và
  // tránh double-submit (nút bị disable + loading trong lúc gửi).
  const canCommit =
    canImport &&
    Boolean(file) &&
    previewMatchesCurrentPayload &&
    previewResult?.errorRows === 0 &&
    !previewMutation.isPending &&
    !commitMutation.isPending;

  const activeResult = commitResult ?? previewResult;
  const showErrorPanel =
    activeResult !== null &&
    activeResult.errorRows > 0 &&
    Boolean(activeResult.importReportId);

  return (
    <Modal
      title="Import SKU từ Excel (WWHN-331)"
      open={open}
      width={980}
      footer={null}
      onCancel={close}
      mask={{ closable: false }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={14} style={{ width: "100%" }}>
        <Space wrap>
          <Tag color="blue">POST /skus/import-excel</Tag>
          <Tag color="gold">all-or-nothing commit</Tag>
          <Tag color="green">dry_run trước, Import sau</Tag>
        </Space>
        <Alert
          type="info"
          showIcon
          title="Luồng chuẩn: chọn file → Kiểm tra trước (dry-run) → sửa lỗi nếu có → Import chính thức"
          description={`Import chính thức ghi nguyên tử: nếu còn dù chỉ 1 dòng lỗi thì không SKU nào được tạo/cập nhật (all-or-nothing). ${describeConstraints(constraints)}`}
        />

        <Space wrap align="center">
          <input
            key={fileInputKey}
            type="file"
            accept={acceptAttribute(constraints)}
            aria-label="Chọn file Excel import SKU"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              invalidatePreview();
            }}
          />
          <Switch
            checked={updateExisting}
            // WWHN-331 FE331-P1-01R3: đổi tùy chọn = đổi payload sẽ gửi đi, nên kết quả
            // kiểm tra thử cũ hết hiệu lực ngay tại đây. Không reset thì nút Import vẫn
            // sáng và commit một payload chưa từng được dry-run.
            onChange={(checked) => {
              setUpdateExisting(checked);
              invalidatePreview();
            }}
            aria-label="Cho phép ghi đè SKU đã tồn tại (update_existing)"
            checkedChildren="update_existing: true"
            unCheckedChildren="update_existing: false"
          />
          <Button
            icon={<DownloadOutlined />}
            loading={templateMutation.isPending}
            onClick={() => templateMutation.mutate()}
          >
            Tải mẫu Excel
          </Button>
        </Space>
        <Typography.Text type="secondary">
          Cột bắt buộc: sku_code, sku_name. Cột tùy chọn: unit, sku_type,
          brand_code, category_code, model_code, power_or_voltage,
          package_variant, version_code, published_to_app, is_serial_tracked,
          status. Bật update_existing để cho phép ghi đè SKU đã tồn tại (mặc
          định chặn, trả DUPLICATE_CODE).
        </Typography.Text>

        <Space wrap>
          <Button
            icon={<EyeOutlined />}
            loading={previewMutation.isPending}
            disabled={!canImport || !file || commitMutation.isPending}
            onClick={() =>
              file && previewMutation.mutate({ file, updateExisting })
            }
          >
            Kiểm tra trước (dry-run)
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={commitMutation.isPending}
            disabled={!canCommit}
            onClick={() =>
              file && commitMutation.mutate({ file, updateExisting })
            }
          >
            Import chính thức
          </Button>
          {!canImport ? (
            <Typography.Text type="secondary">
              Bạn không có quyền sku.manage.
            </Typography.Text>
          ) : commitMutation.isPending ||
            previewMutation.isPending ? null : previewSignature !== "" &&
            !previewMatchesCurrentPayload ? (
            // FE331-P1-01R3: nói rõ vì sao nút Import tắt đi sau khi người dùng đổi
            // lựa chọn — nếu không, trạng thái này trông như một lỗi giao diện.
            <Typography.Text type="secondary">
              Tùy chọn hoặc file đã thay đổi sau lần kiểm tra thử. Chạy lại Kiểm
              tra trước (dry-run) cho đúng lựa chọn hiện tại rồi mới Import
              được.
            </Typography.Text>
          ) : !previewResult ? (
            <Typography.Text type="secondary">
              Phải Kiểm tra trước (dry-run) hết lỗi mới bấm được Import chính
              thức.
            </Typography.Text>
          ) : null}
        </Space>

        {activeResult && (
          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            <ResultSummary
              result={activeResult}
              label={
                commitResult
                  ? commitResult.duplicate
                    ? "DUPLICATE — đã import trước đó"
                    : commitResult.committed
                      ? "COMMITTED"
                      : "REJECTED"
                  : "DRY_RUN preview"
              }
            />
            {commitResult?.duplicate ? (
              <Alert
                type="warning"
                showIcon
                title="File đã được import trước đó"
                description={`Trùng nội dung file (sha256) VÀ trùng tùy chọn update_existing với Import báo cáo #${commitResult.duplicateOfImportReportId ?? "-"} của bạn${
                  constraints?.idempotencyWindowHours
                    ? ` trong ${constraints.idempotencyWindowHours}h gần đây`
                    : " gần đây"
                }. Hệ thống không tạo/cập nhật SKU lần nữa để tránh ghi trùng. Nếu bạn thực sự muốn chạy với tùy chọn khác, đổi update_existing rồi kiểm tra thử lại — đó là một lần import khác.`}
              />
            ) : null}
            {activeResult.rowErrors.length > 0 && (
              <Table<SkuImportRowError>
                rowKey={(row, index) => `${row.row}-${row.field}-${index}`}
                size="small"
                dataSource={activeResult.rowErrors}
                columns={ROW_ERROR_COLUMNS}
                pagination={
                  activeResult.rowErrors.length > 10
                    ? { pageSize: 10, showSizeChanger: false }
                    : false
                }
                locale={{ emptyText: "Không có dòng lỗi" }}
              />
            )}
            {showErrorPanel && activeResult.importReportId ? (
              <SkuImportErrorFilePanel
                reportId={activeResult.importReportId}
                availableHint={activeResult.errorFileAvailable}
                expiresAtHint={activeResult.errorFileExpiresAt}
              />
            ) : null}
          </Space>
        )}

        <Space style={{ justifyContent: "flex-end", width: "100%" }}>
          <Button
            icon={<ReloadOutlined />}
            disabled={previewMutation.isPending || commitMutation.isPending}
            onClick={resetAll}
          >
            Làm lại
          </Button>
          <Button
            icon={<CloseOutlined />}
            disabled={previewMutation.isPending || commitMutation.isPending}
            onClick={close}
          >
            Đóng
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
