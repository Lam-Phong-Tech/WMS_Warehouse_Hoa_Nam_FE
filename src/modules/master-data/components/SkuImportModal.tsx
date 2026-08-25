import { useEffect, useRef, useState } from "react";
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
import { sha256OfFile } from "@/shared/utils/file-digest";

interface SkuImportModalProps {
  open: boolean;
  canImport: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface PreviewPayload {
  file: File;
  fileSha256: string;
  updateExisting: boolean;
  generation: number;
}

class SkuImportFileChangedError extends Error {
  constructor() {
    super(
      "Nội dung tệp đã thay đổi sau lần kiểm tra trước. Hệ thống chưa gửi dữ liệu để tránh nhập một nội dung chưa được kiểm tra. Hãy chọn lại tệp và chạy Kiểm tra trước.",
    );
    this.name = "SkuImportFileChangedError";
  }
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

function formatExpiry(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "";
  const parsed = new Date(isoTimestamp);
  return Number.isNaN(parsed.getTime())
    ? ""
    : ` · tải được đến ${parsed.toLocaleString("vi-VN")}`;
}

function describeConstraints(constraints: SkuImportConstraints | null): string {
  if (!constraints) {
    return "Giới hạn số dòng và kích thước tệp do hệ thống kiểm soát. Nếu vượt giới hạn, màn hình sẽ hiển thị thông báo cụ thể.";
  }

  const parts = [
    `Tối đa ${constraints.maxRows.toLocaleString("vi-VN")} dòng dữ liệu`,
    `kích thước tệp không quá ${constraints.maxFileSizeMb} MB`,
  ];
  if (constraints.allowedExtensions.length > 0) {
    parts.push(
      `định dạng ${constraints.allowedExtensions.map((value) => `.${value}`).join(", ")}`,
    );
  }
  if (constraints.errorFileExpiryHours > 0) {
    parts.push(
      `tệp lỗi có thể tải trong ${constraints.errorFileExpiryHours} giờ`,
    );
  }
  if (constraints.maxPhysicalRowsToScan > 0) {
    parts.push(
      `bảng tính không trải quá ${constraints.maxPhysicalRowsToScan.toLocaleString("vi-VN")} dòng kể cả dòng trống`,
    );
  }
  return `${parts.join("; ")}.`;
}

function acceptAttribute(constraints: SkuImportConstraints | null): string {
  const extensions = constraints?.allowedExtensions?.length
    ? constraints.allowedExtensions
    : ["xlsx", "xls"];
  return extensions.map((extension) => `.${extension}`).join(",");
}

function payloadSignature(fileSha256: string | null, updateExisting: boolean) {
  if (!fileSha256) return "";
  return `${fileSha256}|${updateExisting ? "update=1" : "update=0"}`;
}

const ROW_ERROR_COLUMNS: ColumnsType<SkuImportRowError> = [
  { title: "Dòng", dataIndex: "row", width: 70 },
  { title: "Trường dữ liệu", dataIndex: "field", width: 150 },
  { title: "Loại lỗi", dataIndex: "code", width: 190 },
  { title: "Nội dung lỗi", dataIndex: "message" },
  {
    title: "Giá trị nhập",
    dataIndex: "value",
    width: 160,
    render: (value: unknown) =>
      value === null || value === undefined ? "-" : String(value),
  },
];

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
      handleBlobDownload(blob, `loi-nhap-sku-${reportId}.csv`, fileName);
      toast.success("Đã tải tệp lỗi.");
    },
    onError: (error) => {
      if (normalizeError(error).status === 404) void reportQuery.refetch();
    },
  });

  if (reportQuery.error && isNoPermissionError(reportQuery.error)) return null;
  if (reportQuery.error && !reportQuery.data) {
    return (
      <ApiErrorAlert
        error={reportQuery.error}
        title="Không kiểm tra được tệp lỗi"
        onRetry={() => void reportQuery.refetch()}
      />
    );
  }

  const available = reportQuery.data
    ? reportQuery.data.errorFileAvailable
    : availableHint;
  const expiresAt = reportQuery.data
    ? reportQuery.data.errorFileExpiresAt
    : expiresAtHint;

  if (!available) {
    return (
      <Typography.Text type="secondary">
        Tệp lỗi không còn tải được hoặc báo cáo không có dòng lỗi. Hãy chạy lại
        Kiểm tra trước sau khi đã sửa tệp nếu cần tạo báo cáo lỗi mới.
      </Typography.Text>
    );
  }

  return (
    <Space orientation="vertical" size={6}>
      <Button
        icon={<DownloadOutlined />}
        loading={downloadMutation.isPending}
        onClick={() => downloadMutation.mutate()}
      >
        Tải tệp lỗi
      </Button>
      <Typography.Text type="secondary">
        Tệp chứa số dòng, trường dữ liệu, loại lỗi, nội dung lỗi và giá trị bị
        từ chối{formatExpiry(expiresAt)}.
      </Typography.Text>
      {downloadMutation.error &&
      !isNoPermissionError(downloadMutation.error) ? (
        <ApiErrorAlert
          error={downloadMutation.error}
          title="Không tải được tệp lỗi"
          onRetry={() => downloadMutation.mutate()}
        />
      ) : null}
    </Space>
  );
}

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
  const [previewSignature, setPreviewSignature] = useState("");
  const [commitResult, setCommitResult] = useState<SkuImportResult | null>(
    null,
  );
  const [fileSha256, setFileSha256] = useState<string | null>(null);
  const [digestPending, setDigestPending] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);
  const payloadGeneration = useRef(0);

  const invalidatePreview = () => {
    payloadGeneration.current += 1;
    setPreviewResult(null);
    setCommitResult(null);
  };

  const resetAll = () => {
    payloadGeneration.current += 1;
    setFile(null);
    setFileInputKey((key) => key + 1);
    setUpdateExisting(false);
    setPreviewResult(null);
    setCommitResult(null);
    setPreviewSignature("");
    setFileSha256(null);
    setDigestError(null);
  };

  useEffect(() => {
    if (!file) {
      setFileSha256(null);
      setDigestPending(false);
      setDigestError(null);
      return;
    }
    let cancelled = false;
    setFileSha256(null);
    setDigestError(null);
    setDigestPending(true);
    sha256OfFile(file)
      .then((sha256) => {
        if (cancelled) return;
        setFileSha256(sha256);
        setDigestPending(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDigestError(
          "Không đọc được nội dung tệp. Tệp có thể đã bị di chuyển, đổi tên hoặc sửa sau khi chọn. Hãy chọn lại tệp.",
        );
        setDigestPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

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

  const currentPayload = (): PreviewPayload | null =>
    file && fileSha256
      ? {
          file,
          fileSha256,
          updateExisting,
          generation: payloadGeneration.current,
        }
      : null;

  const isStaleGeneration = (payload: PreviewPayload) =>
    payload.generation !== payloadGeneration.current;

  const previewMutation = useMutation({
    mutationFn: async (payload: PreviewPayload) => {
      const result = await importSkuExcel(payload.file, {
        updateExisting: payload.updateExisting,
        dryRun: true,
      });
      return {
        result,
        signature: payloadSignature(payload.fileSha256, payload.updateExisting),
      };
    },
    onSuccess: ({ result, signature }, payload) => {
      if (isStaleGeneration(payload)) return;
      if (result.fileSha256 && result.fileSha256 !== payload.fileSha256) {
        setPreviewResult(null);
        setCommitResult(null);
        setPreviewSignature("");
        toast.error(
          "Nội dung hệ thống nhận được không khớp với tệp bạn đã chọn. Hãy chọn lại tệp và kiểm tra lại.",
        );
        return;
      }
      setCommitResult(null);
      setPreviewResult(result);
      setPreviewSignature(signature);
      if (result.errorRows === 0) {
        toast.success(
          `Kiểm tra hợp lệ — dự kiến tạo mới ${result.wouldInsertRows}, cập nhật ${result.wouldUpdateRows} SKU.`,
        );
      } else {
        toast.warning(
          `Tệp có ${result.errorRows} dòng lỗi. Hãy sửa tệp và kiểm tra lại trước khi nhập dữ liệu.`,
        );
      }
    },
    onError: (error, payload) => {
      if (isStaleGeneration(payload)) return;
      setCommitResult(null);
      if (error instanceof SkuImportConcurrencyError) {
        toast.warning(error.message);
        return;
      }
      if (error instanceof SkuImportUnavailableError) {
        toast.warning(error.message);
        return;
      }
      if (error instanceof SkuImportRejectedError) {
        setPreviewResult(error.result);
        setPreviewSignature(
          payloadSignature(payload.fileSha256, payload.updateExisting),
        );
        toast.warning(error.message);
        return;
      }
      setPreviewResult(null);
      setPreviewSignature("");
      toast.error(getApiErrorMessage(error, "Không thể kiểm tra tệp."));
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (payload: PreviewPayload) => {
      const currentSha256 = await sha256OfFile(payload.file);
      if (currentSha256 !== payload.fileSha256) {
        throw new SkuImportFileChangedError();
      }
      return importSkuExcel(payload.file, {
        updateExisting: payload.updateExisting,
        dryRun: false,
      });
    },
    onSuccess: (result) => {
      setCommitResult(result);
      if (result.duplicate) {
        toast.info(
          "Tệp này đã được nhập trước đó với cùng lựa chọn. Hệ thống không tạo hoặc cập nhật dữ liệu lần nữa để tránh ghi trùng.",
        );
        return;
      }
      toast.success(
        `Nhập dữ liệu thành công — đã tạo mới ${result.insertedRows}, cập nhật ${result.updatedRows} SKU.`,
      );
      onImported();
    },
    onError: (error) => {
      if (error instanceof SkuImportFileChangedError) {
        setCommitResult(null);
        setPreviewResult(null);
        setPreviewSignature("");
        toast.error(
          getApiErrorMessage(
            error,
            "Nội dung tệp đã thay đổi sau lần kiểm tra trước. Hãy chọn lại tệp và chạy Kiểm tra trước.",
          ),
        );
        return;
      }
      if (
        error instanceof SkuImportConcurrencyError ||
        error instanceof SkuImportUnavailableError
      ) {
        toast.warning(error.message);
        return;
      }
      if (error instanceof SkuImportRejectedError) {
        setCommitResult(error.result);
        toast.error(
          getApiErrorMessage(
            error,
            "Tệp có dòng lỗi nên hệ thống từ chối nhập dữ liệu SKU.",
          ),
        );
        return;
      }
      setCommitResult(null);
      toast.error(getApiErrorMessage(error, "Không thể nhập dữ liệu SKU."));
    },
  });

  const templateMutation = useMutation({
    mutationFn: downloadSkuImportTemplate,
    onSuccess: ({ blob, fileName }) =>
      handleBlobDownload(blob, "mau-nhap-sku.xlsx", fileName),
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Không tải được tệp mẫu.")),
  });

  const currentSignature = payloadSignature(fileSha256, updateExisting);
  const previewMatchesCurrentPayload =
    previewSignature !== "" && previewSignature === currentSignature;
  const canCommit =
    canImport &&
    Boolean(file) &&
    Boolean(fileSha256) &&
    previewMatchesCurrentPayload &&
    previewResult?.errorRows === 0 &&
    !previewMutation.isPending &&
    !commitMutation.isPending;
  const activeResult = commitResult ?? previewResult;

  const close = () => {
    if (previewMutation.isPending || commitMutation.isPending) return;
    resetAll();
    onClose();
  };

  return (
    <Modal
      title="Nhập danh sách SKU từ Excel"
      open={open}
      width={980}
      footer={null}
      onCancel={close}
      mask={{ closable: false }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={14} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          title="Chọn tệp → Kiểm tra trước → sửa lỗi nếu có → Nhập dữ liệu"
          description={`Hệ thống chỉ ghi dữ liệu khi toàn bộ tệp hợp lệ. Nếu còn một dòng lỗi thì không SKU nào được tạo hoặc cập nhật. ${describeConstraints(constraints)}`}
        />

        <Space wrap align="center">
          <input
            key={fileInputKey}
            type="file"
            accept={acceptAttribute(constraints)}
            aria-label="Chọn tệp Excel chứa SKU"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              invalidatePreview();
            }}
          />
          <Space size={6}>
            <Switch
              checked={updateExisting}
              onChange={(checked) => {
                setUpdateExisting(checked);
                invalidatePreview();
              }}
              aria-label="Cho phép cập nhật SKU đã tồn tại"
            />
            <Typography.Text>Cho phép cập nhật SKU đã tồn tại</Typography.Text>
          </Space>
          <Button
            icon={<DownloadOutlined />}
            loading={templateMutation.isPending}
            onClick={() => templateMutation.mutate()}
          >
            Tải tệp mẫu
          </Button>
        </Space>

        <Typography.Text type="secondary">
          Tệp cần có tối thiểu cột mã SKU và tên SKU. Các thông tin còn lại như
          đơn vị tính, loại SKU, hãng, nhóm hàng, mẫu sản phẩm, nguồn điện, quy
          cách đóng gói, phiên bản sản phẩm, trạng thái và chế độ quản lý số
          sê-ri có thể khai báo thêm theo tệp mẫu.
        </Typography.Text>

        {!canImport ? (
          <Alert
            type="warning"
            showIcon
            title="Tài khoản hiện tại không có quyền nhập danh sách SKU."
          />
        ) : null}

        {digestError ? (
          <Alert type="error" showIcon title={digestError} />
        ) : null}

        <Space wrap>
          <Button
            icon={<EyeOutlined />}
            loading={previewMutation.isPending || digestPending}
            disabled={
              !canImport ||
              !fileSha256 ||
              digestPending ||
              commitMutation.isPending
            }
            onClick={() => {
              const payload = currentPayload();
              if (payload) previewMutation.mutate(payload);
            }}
          >
            Kiểm tra trước
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={commitMutation.isPending}
            disabled={!canCommit}
            onClick={() => {
              const payload = currentPayload();
              if (payload) commitMutation.mutate(payload);
            }}
          >
            Nhập dữ liệu
          </Button>

          {digestPending ? (
            <Typography.Text type="secondary">
              Đang kiểm tra nội dung tệp…
            </Typography.Text>
          ) : previewSignature !== "" && !previewMatchesCurrentPayload ? (
            <Typography.Text type="secondary">
              Tệp hoặc lựa chọn cập nhật đã thay đổi sau lần kiểm tra trước. Hãy
              kiểm tra lại trước khi nhập dữ liệu.
            </Typography.Text>
          ) : !previewResult ? (
            <Typography.Text type="secondary">
              Cần kiểm tra tệp và xử lý hết lỗi trước khi nhập dữ liệu.
            </Typography.Text>
          ) : null}
        </Space>

        {activeResult ? (
          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            <ResultSummary
              result={activeResult}
              label={
                commitResult
                  ? commitResult.duplicate
                    ? "Đã xử lý trước đó"
                    : commitResult.committed
                      ? "Đã nhập dữ liệu"
                      : "Không được ghi dữ liệu"
                  : "Kết quả kiểm tra trước"
              }
            />

            {commitResult?.duplicate ? (
              <Alert
                type="warning"
                showIcon
                title="Tệp này đã được nhập trước đó"
                description="Nội dung tệp và lựa chọn cập nhật giống một lần nhập gần đây, nên hệ thống không tạo hoặc cập nhật SKU lần nữa. Nếu muốn thay đổi cách xử lý SKU đã tồn tại, hãy đổi lựa chọn rồi kiểm tra lại."
              />
            ) : null}

            {activeResult.rowErrors.length > 0 ? (
              <Table<SkuImportRowError>
                rowKey={(row, index) => `${row.row}-${row.field}-${index}`}
                size="small"
                dataSource={activeResult.rowErrors}
                columns={ROW_ERROR_COLUMNS}
                scroll={{ x: "max-content" }}
                pagination={
                  activeResult.rowErrors.length > 10
                    ? { pageSize: 10, showSizeChanger: false }
                    : false
                }
                locale={{ emptyText: "Không có dòng lỗi" }}
              />
            ) : null}

            {activeResult.errorRows > 0 && activeResult.importReportId ? (
              <SkuImportErrorFilePanel
                reportId={activeResult.importReportId}
                availableHint={activeResult.errorFileAvailable}
                expiresAtHint={activeResult.errorFileExpiresAt}
              />
            ) : null}
          </Space>
        ) : null}

        <Space wrap style={{ justifyContent: "flex-end", width: "100%" }}>
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
