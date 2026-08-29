import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getApiErrorMessage,
  isNoPermissionError,
  normalizeError,
} from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useDialogExit } from "@/shared/utils/useDialogExit";
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
import { formatDateTime } from "@/shared/utils/format-date";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { ResponsiveDataTable } from "@/shared/components";
import type { ResponsiveTableColumn } from "@/shared/components";
import {
  Box,
  SEMANTIC_LIGHT as S,
  Stack,
  Switch,
  UiAlert,
  UiDialog,
  UiPagination,
  UiStatusBadge,
  UiText,
} from "@/shared/ui";

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
  const formatted = formatDateTime(isoTimestamp);
  return formatted === "-" ? "" : ` · tải được đến ${formatted}`;
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

type KeyedRowError = SkuImportRowError & { __key: string };

const ROW_ERROR_COLUMNS: ResponsiveTableColumn<KeyedRowError>[] = [
  { key: "row", header: "Dòng", width: 70, render: (record) => record.row },
  {
    key: "field",
    header: "Trường dữ liệu",
    width: 150,
    render: (record) => record.field,
  },
  {
    key: "code",
    header: "Loại lỗi",
    width: 190,
    render: (record) => record.code,
  },
  {
    key: "message",
    header: "Nội dung lỗi",
    render: (record) => record.message,
  },
  {
    key: "value",
    header: "Giá trị nhập",
    width: 160,
    render: (record) =>
      record.value === null || record.value === undefined
        ? "-"
        : String(record.value),
  },
];

const ROW_ERROR_PAGE_SIZE = 10;

/**
 * Bảng dòng lỗi của kết quả kiểm tra/nhập — thay antd Table (Part 4). Giữ ngữ
 * nghĩa phân trang cũ: chỉ hiện phân trang khi quá 10 dòng, cỡ trang cố định.
 */
function RowErrorTable({
  errors,
  loading = false,
}: {
  errors: SkuImportRowError[];
  /** Đang kiểm tra/nhập lại — hiện trạng thái tải trên bảng dòng lỗi. */
  loading?: boolean;
}) {
  const [page, setPage] = useState(1);
  const keyed = useMemo(
    () =>
      errors.map((error, index) => ({
        ...error,
        __key: `${error.row}-${error.field}-${index}`,
      })),
    [errors],
  );
  const paginated = keyed.length > ROW_ERROR_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(keyed.length / ROW_ERROR_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const visibleRows = paginated
    ? keyed.slice(
        (safePage - 1) * ROW_ERROR_PAGE_SIZE,
        safePage * ROW_ERROR_PAGE_SIZE,
      )
    : keyed;

  return (
    <Stack spacing={1}>
      <ResponsiveDataTable<KeyedRowError>
        columns={ROW_ERROR_COLUMNS}
        rows={visibleRows}
        rowKey={(record) => record.__key}
        loading={loading}
        emptyText="Không có dòng lỗi"
      />
      {paginated ? (
        <UiPagination
          page={safePage}
          pageSize={ROW_ERROR_PAGE_SIZE}
          total={keyed.length}
          showTotal={false}
          onPageChange={setPage}
        />
      ) : null}
    </Stack>
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
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
    >
      <UiStatusBadge tone="primary" label={label} />
      <UiText variant="body">Tổng: {result.totalRows}</UiText>
      <UiText variant="body" color={S.successText}>
        Hợp lệ: {result.validRows}
      </UiText>
      <UiText
        variant="body"
        color={result.errorRows > 0 ? S.errorText : undefined}
      >
        Lỗi: {result.errorRows}
      </UiText>
      {result.dryRun ? (
        <>
          <UiText variant="body">Sẽ tạo mới: {result.wouldInsertRows}</UiText>
          <UiText variant="body">Sẽ cập nhật: {result.wouldUpdateRows}</UiText>
        </>
      ) : (
        <>
          <UiText variant="body">Đã tạo mới: {result.insertedRows}</UiText>
          <UiText variant="body">Đã cập nhật: {result.updatedRows}</UiText>
        </>
      )}
    </Stack>
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
      <UiText variant="secondary">
        Tệp lỗi không còn tải được hoặc báo cáo không có dòng lỗi. Hãy chạy lại
        Kiểm tra trước sau khi đã sửa tệp nếu cần tạo báo cáo lỗi mới.
      </UiText>
    );
  }

  return (
    <Stack spacing={0.75} sx={{ alignItems: "flex-start" }}>
      <ActionButton
        kind="download"
        disabled={downloadMutation.isPending}
        onClick={() => downloadMutation.mutate()}
      >
        {downloadMutation.isPending ? "Đang tải..." : "Tải tệp lỗi"}
      </ActionButton>
      <UiText variant="secondary">
        Tệp chứa số dòng, trường dữ liệu, loại lỗi, nội dung lỗi và giá trị bị
        từ chối{formatExpiry(expiresAt)}.
      </UiText>
      {downloadMutation.error &&
      !isNoPermissionError(downloadMutation.error) ? (
        <ApiErrorAlert
          error={downloadMutation.error}
          title="Không tải được tệp lỗi"
          onRetry={() => downloadMutation.mutate()}
        />
      ) : null}
    </Stack>
  );
}

export function SkuImportModal({
  open,
  canImport,
  onClose,
  onImported,
}: SkuImportModalProps) {
  const dialog = useDialogExit(onClose);
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
    dialog.close();
  };

  return (
    <>
      <UiDialog
        {...dialog.dialogProps}
        open={open && dialog.open}
        onClose={close}
        maxWidth="md"
        fullWidth
        title={
          <>
            Nhập danh sách SKU từ Excel
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={close}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </>
        }
      >
        <Stack spacing={1.75}>
          <UiAlert
            tone="info"
            title="Chọn tệp → Kiểm tra trước → sửa lỗi nếu có → Nhập dữ liệu"
          >
            {`Hệ thống chỉ ghi dữ liệu khi toàn bộ tệp hợp lệ. Nếu còn một dòng lỗi thì không SKU nào được tạo hoặc cập nhật. ${describeConstraints(constraints)}`}
          </UiAlert>

          <Stack
            direction="row"
            spacing={2}
            sx={{ flexWrap: "wrap", rowGap: 1.5, alignItems: "center" }}
          >
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
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Switch
                checked={updateExisting}
                onChange={(event) => {
                  setUpdateExisting(event.target.checked);
                  invalidatePreview();
                }}
                slotProps={{
                  input: { "aria-label": "Cho phép cập nhật SKU đã tồn tại" },
                }}
              />
              <UiText variant="body">Cho phép cập nhật SKU đã tồn tại</UiText>
            </Stack>
            <ActionButton
              kind="download"
              disabled={templateMutation.isPending}
              onClick={() => templateMutation.mutate()}
            >
              {templateMutation.isPending ? "Đang tải..." : "Tải tệp mẫu"}
            </ActionButton>
          </Stack>

          <UiText variant="secondary">
            Tệp cần có tối thiểu cột mã SKU và tên SKU. Các thông tin còn lại
            như đơn vị tính, loại SKU, hãng, nhóm hàng, mẫu sản phẩm, nguồn
            điện, quy cách đóng gói, phiên bản sản phẩm, trạng thái và chế độ
            quản lý số sê-ri có thể khai báo thêm theo tệp mẫu.
          </UiText>

          {!canImport ? (
            <UiAlert tone="warning">
              Tài khoản hiện tại không có quyền nhập danh sách SKU.
            </UiAlert>
          ) : null}

          {digestError ? <UiAlert tone="error">{digestError}</UiAlert> : null}

          <Stack spacing={1}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
            >
              <ActionButton
                kind="view"
                disabled={
                  !canImport ||
                  !fileSha256 ||
                  digestPending ||
                  commitMutation.isPending ||
                  previewMutation.isPending
                }
                onClick={() => {
                  const payload = currentPayload();
                  if (payload) previewMutation.mutate(payload);
                }}
              >
                {previewMutation.isPending || digestPending
                  ? "Đang kiểm tra..."
                  : "Kiểm tra trước"}
              </ActionButton>
              <ActionButton
                kind="upload"
                disabled={!canCommit}
                onClick={() => {
                  const payload = currentPayload();
                  if (payload) commitMutation.mutate(payload);
                }}
              >
                {commitMutation.isPending ? "Đang nhập..." : "Nhập dữ liệu"}
              </ActionButton>
            </Stack>

            {digestPending ? (
              <UiText variant="secondary">Đang kiểm tra nội dung tệp…</UiText>
            ) : previewSignature !== "" && !previewMatchesCurrentPayload ? (
              <UiText variant="secondary">
                Tệp hoặc lựa chọn cập nhật đã thay đổi sau lần kiểm tra trước.
                Hãy kiểm tra lại trước khi nhập dữ liệu.
              </UiText>
            ) : !previewResult ? (
              <UiText variant="secondary">
                Cần kiểm tra tệp và xử lý hết lỗi trước khi nhập dữ liệu.
              </UiText>
            ) : null}
          </Stack>

          {activeResult ? (
            <Stack spacing={1.25}>
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
                <UiAlert tone="warning" title="Tệp này đã được nhập trước đó">
                  Nội dung tệp và lựa chọn cập nhật giống một lần nhập gần đây,
                  nên hệ thống không tạo hoặc cập nhật SKU lần nữa. Nếu muốn
                  thay đổi cách xử lý SKU đã tồn tại, hãy đổi lựa chọn rồi kiểm
                  tra lại.
                </UiAlert>
              ) : null}

              {activeResult.rowErrors.length > 0 ? (
                <Box>
                  <RowErrorTable
                    errors={activeResult.rowErrors}
                    loading={
                      previewMutation.isPending || commitMutation.isPending
                    }
                  />
                </Box>
              ) : null}

              {activeResult.errorRows > 0 && activeResult.importReportId ? (
                <SkuImportErrorFilePanel
                  reportId={activeResult.importReportId}
                  availableHint={activeResult.errorFileAvailable}
                  expiresAtHint={activeResult.errorFileExpiresAt}
                />
              ) : null}
            </Stack>
          ) : null}

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ justifyContent: "flex-end" }}
          >
            <ActionButton
              kind="reset"
              disabled={previewMutation.isPending || commitMutation.isPending}
              onClick={resetAll}
            >
              Làm lại
            </ActionButton>
            <ActionButton
              kind="close"
              disabled={previewMutation.isPending || commitMutation.isPending}
              onClick={close}
            >
              Đóng
            </ActionButton>
          </Stack>
        </Stack>
      </UiDialog>
    </>
  );
}
