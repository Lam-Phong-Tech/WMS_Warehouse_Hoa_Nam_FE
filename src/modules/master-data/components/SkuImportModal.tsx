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
  fetchSkuImportReport,
  importSkuExcel,
  SkuImportRejectedError,
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
  "File lỗi CSV không còn tải được: báo cáo này không có dòng lỗi, hoặc file đã quá hạn 24h và bị dọn dẹp định kỳ. Chạy lại Kiểm tra trước (dry-run) để sinh báo cáo lỗi mới; bảng lỗi ở trên vẫn dùng đối soát được.";

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
  const [commitResult, setCommitResult] = useState<SkuImportResult | null>(
    null,
  );

  const resetResults = () => {
    setPreviewResult(null);
    setCommitResult(null);
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

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file)
        throw new Error("Chọn file Excel (.xlsx/.xls) trước khi kiểm tra.");
      return importSkuExcel(file, { updateExisting, dryRun: true });
    },
    onSuccess: (result) => {
      setCommitResult(null);
      setPreviewResult(result);
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
    onError: (error) => {
      setCommitResult(null);
      if (error instanceof SkuImportRejectedError) {
        setPreviewResult(error.result);
        toast.warning(error.message);
        return;
      }
      setPreviewResult(null);
      toast.error(getApiErrorMessage(error, "Kiểm tra thử import thất bại."));
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!file)
        throw new Error("Chọn file Excel (.xlsx/.xls) trước khi import.");
      return importSkuExcel(file, { updateExisting, dryRun: false });
    },
    onSuccess: (result) => {
      setCommitResult(result);
      if (result.duplicate) {
        // WWHN-330 P1-03: file đã được import (commit) trước đó trong 24h bởi cùng
        // actor — BE không ghi lại, không tạo SKU lần 2. Đây KHÔNG phải lỗi chung
        // chung; phải nói rõ đây là bản ghi cũ.
        toast.info(
          `File này đã được import trước đó (Import báo cáo #${result.duplicateOfImportReportId ?? "-"}). Không có SKU nào được tạo/cập nhật lần nữa.`,
        );
        return;
      }
      toast.success(
        `Import thành công — đã tạo mới ${result.insertedRows}, cập nhật ${result.updatedRows} SKU.`,
      );
      onImported();
    },
    onError: (error) => {
      if (error instanceof SkuImportRejectedError) {
        setCommitResult(error.result);
        toast.error(error.message);
        return;
      }
      setCommitResult(null);
      toast.error(getApiErrorMessage(error, "Import SKU thất bại."));
    },
  });

  const templateMutation = useMutation({
    mutationFn: downloadSkuImportTemplate,
    onSuccess: ({ blob, fileName }) => {
      handleBlobDownload(blob, "sku-import-template.xlsx", fileName);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không tải được file mẫu."));
    },
  });

  // Chỉ cho Import chính thức khi đã dry-run và không còn lỗi — tránh gửi file chắc
  // chắn bị 422 và tránh double-submit (nút bị disable + loading trong lúc gửi).
  const canCommit =
    canImport &&
    Boolean(file) &&
    Boolean(previewResult) &&
    previewResult?.errorRows === 0 &&
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
          description="Import chính thức ghi nguyên tử: nếu còn dù chỉ 1 dòng lỗi thì không SKU nào được tạo/cập nhật (all-or-nothing). Giới hạn hiện tại theo mã nguồn BE (Modules/Warehouse/app/Services/ImportService.php): tối đa 1000 dòng dữ liệu, file ≤ 10MB — đây là giá trị BE đang áp dụng thật nhưng ghi chú là tạm/chưa chốt chính thức, nên FE không tự chặn theo số này; nếu vượt, hệ thống sẽ hiển thị đúng thông báo lỗi do máy chủ trả về."
        />

        <Space wrap align="center">
          <input
            key={fileInputKey}
            type="file"
            accept=".xlsx,.xls"
            aria-label="Chọn file Excel import SKU"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              resetResults();
            }}
          />
          <Switch
            checked={updateExisting}
            onChange={setUpdateExisting}
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
            onClick={() => previewMutation.mutate()}
          >
            Kiểm tra trước (dry-run)
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={commitMutation.isPending}
            disabled={!canCommit}
            onClick={() => commitMutation.mutate()}
          >
            Import chính thức
          </Button>
          {!canImport ? (
            <Typography.Text type="secondary">
              Bạn không có quyền sku.manage.
            </Typography.Text>
          ) : !previewResult && !commitMutation.isPending ? (
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
                description={`Trùng nội dung file (sha256) với Import báo cáo #${commitResult.duplicateOfImportReportId ?? "-"} trong vòng 24h gần đây của bạn. Hệ thống không tạo/cập nhật SKU lần nữa để tránh ghi trùng.`}
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
