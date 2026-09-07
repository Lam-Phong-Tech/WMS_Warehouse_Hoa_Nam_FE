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
import {
  FILE_RULES,
  acceptAttribute as acceptFromRule,
  buildFileRule,
  checkFile,
  describeExtensions,
  type FileRule,
} from "@/shared/validation/file-rules";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, tStatic, type TranslateFn } from "@/shared/i18n/useT";
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
    super(tStatic("masterData.import.errStaleFile"));
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
  // formatDateTime trả EMPTY_TEXT khi không hợp lệ — không ghép hậu tố khi đó.
  return formatted === EMPTY_TEXT
    ? ""
    : tStatic("masterData.import.expirySuffix", { time: formatted });
}

function describeConstraints(constraints: SkuImportConstraints | null): string {
  if (!constraints) {
    return tStatic("masterData.import.constraintsFallback");
  }

  const parts = [
    tStatic("masterData.import.constraintRows", {
      count: constraints.maxRows.toLocaleString("vi-VN"),
    }),
    tStatic("masterData.import.constraintSize", {
      size: constraints.maxFileSizeMb,
    }),
  ];
  if (constraints.allowedExtensions.length > 0) {
    parts.push(
      tStatic("masterData.import.constraintExtensions", {
        list: constraints.allowedExtensions
          .map((value) => `.${value}`)
          .join(", "),
      }),
    );
  }
  if (constraints.errorFileExpiryHours > 0) {
    parts.push(
      tStatic("masterData.import.constraintErrorFile", {
        hours: constraints.errorFileExpiryHours,
      }),
    );
  }
  if (constraints.maxPhysicalRowsToScan > 0) {
    parts.push(
      tStatic("masterData.import.constraintScanRows", {
        count: constraints.maxPhysicalRowsToScan.toLocaleString("vi-VN"),
      }),
    );
  }
  return `${parts.join("; ")}.`;
}

/**
 * Luật tệp cho lần nhập này. Khác mọi ô upload còn lại, danh sách đuôi và trần
 * dung lượng ở đây do BE trả về (GET .../constraints) nên phải dựng động —
 * buildFileRule() chuẩn hoá "xlsx" thành ".xlsx" và rơi về luật Excel dùng
 * chung khi BE chưa trả cấu hình.
 */
function importFileRule(constraints: SkuImportConstraints | null): FileRule {
  return buildFileRule({
    extensions: constraints?.allowedExtensions,
    maxBytes:
      constraints?.maxFileSizeMb != null && constraints.maxFileSizeMb > 0
        ? constraints.maxFileSizeMb * 1024 * 1024
        : null,
    fallback: FILE_RULES.excelImport,
  });
}

function acceptAttribute(constraints: SkuImportConstraints | null): string {
  return acceptFromRule(importFileRule(constraints));
}

/**
 * Kiểm tra sơ bộ tệp NGAY khi chọn (đuôi + dung lượng) — `accept` của input
 * chỉ là gợi ý của hộp thoại, người dùng vẫn kéo-thả/chọn "Tất cả tệp" được;
 * chặn sớm ở đây để không băm SHA-256 rồi gửi lên BE một tệp chắc chắn bị
 * từ chối. Trả về thông báo lỗi, hoặc null nếu tệp qua được.
 */
function precheckFile(
  file: File,
  constraints: SkuImportConstraints | null,
): string | null {
  // Luật (đuôi + MIME + dung lượng) nằm ở file-rules; câu lỗi giữ nguyên chữ
  // của màn nhập SKU nên chỉ đọc reason để chọn câu.
  const rule = importFileRule(constraints);
  const check = checkFile(file, rule);
  if (check.ok) return null;
  return check.reason === "type"
    ? tStatic("masterData.import.errFileType", {
        list: describeExtensions(rule),
      })
    : tStatic("masterData.import.errFileSize", {
        max: Math.round(rule.maxBytes / (1024 * 1024)),
      });
}

function payloadSignature(fileSha256: string | null, updateExisting: boolean) {
  if (!fileSha256) return "";
  return `${fileSha256}|${updateExisting ? "update=1" : "update=0"}`;
}

type KeyedRowError = SkuImportRowError & { __key: string };

const rowErrorColumns = (
  t: TranslateFn,
): ResponsiveTableColumn<KeyedRowError>[] => [
  {
    key: "row",
    header: t("masterData.import.colRow"),
    width: 70,
    render: (record) => record.row,
  },
  {
    key: "field",
    header: t("masterData.import.colField"),
    width: 150,
    render: (record) => record.field,
  },
  {
    key: "code",
    header: t("masterData.import.colErrorType"),
    width: 190,
    render: (record) => record.code,
  },
  {
    key: "message",
    header: t("masterData.import.colErrorMessage"),
    render: (record) => record.message,
  },
  {
    key: "value",
    header: t("masterData.import.colValue"),
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
  const t = useT();
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
        columns={rowErrorColumns(t)}
        rows={visibleRows}
        rowKey={(record) => record.__key}
        loading={loading}
        emptyText={t("masterData.import.errorsEmpty")}
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
  const t = useT();
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
    >
      <UiStatusBadge tone="primary" label={label} />
      <UiText variant="body">
        {t("masterData.import.total", { count: result.totalRows })}
      </UiText>
      <UiText variant="body" color={S.successText}>
        {t("masterData.import.valid", { count: result.validRows })}
      </UiText>
      <UiText
        variant="body"
        color={result.errorRows > 0 ? S.errorText : undefined}
      >
        {t("masterData.import.errors", { count: result.errorRows })}
      </UiText>
      {result.dryRun ? (
        <>
          <UiText variant="body">
            {t("masterData.import.wouldInsert", {
              count: result.wouldInsertRows,
            })}
          </UiText>
          <UiText variant="body">
            {t("masterData.import.wouldUpdate", {
              count: result.wouldUpdateRows,
            })}
          </UiText>
        </>
      ) : (
        <>
          <UiText variant="body">
            {t("masterData.import.inserted", { count: result.insertedRows })}
          </UiText>
          <UiText variant="body">
            {t("masterData.import.updated", { count: result.updatedRows })}
          </UiText>
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
  const t = useT();
  const reportQuery = useQuery({
    queryKey: ["sku-import-report", reportId],
    queryFn: () => fetchSkuImportReport(reportId),
    retry: false,
  });
  const downloadMutation = useMutation({
    mutationFn: () => downloadSkuImportErrorFile(reportId),
    onSuccess: ({ blob, fileName }) => {
      handleBlobDownload(blob, `loi-nhap-sku-${reportId}.csv`, fileName);
      toast.success(t("masterData.import.errorFileDownloaded"));
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
        title={t("masterData.import.errorFileCheckFailed")}
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
        {t("masterData.import.errorFileGone")}
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
        {downloadMutation.isPending
          ? t("masterData.import.downloading")
          : t("masterData.import.downloadErrorFile")}
      </ActionButton>
      <UiText variant="secondary">
        {t("masterData.import.errorFileHint", {
          expiry: formatExpiry(expiresAt),
        })}
      </UiText>
      {downloadMutation.error &&
      !isNoPermissionError(downloadMutation.error) ? (
        <ApiErrorAlert
          error={downloadMutation.error}
          title={t("masterData.import.errorFileDownloadFailed")}
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
  const t = useT();
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
  // Lỗi sơ bộ của tệp vừa chọn (đuôi/dung lượng) — hiện cùng chỗ với digestError.
  const [fileError, setFileError] = useState<string | null>(null);
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
    setFileError(null);
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
        setDigestError(tStatic("masterData.import.errReadFile"));
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
        toast.error(t("masterData.import.errChecksumMismatch"));
        return;
      }
      setCommitResult(null);
      setPreviewResult(result);
      setPreviewSignature(signature);
      if (result.errorRows === 0) {
        toast.success(
          t("masterData.import.validateOk", {
            insert: result.wouldInsertRows,
            update: result.wouldUpdateRows,
          }),
        );
      } else {
        toast.warning(
          t("masterData.import.validateHasErrors", {
            count: result.errorRows,
          }),
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
      toast.error(
        getApiErrorMessage(error, t("masterData.import.errValidate")),
      );
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
        toast.info(t("masterData.import.alreadyImported"));
        return;
      }
      toast.success(
        t("masterData.import.commitOk", {
          insert: result.insertedRows,
          update: result.updatedRows,
        }),
      );
      onImported();
    },
    onError: (error) => {
      if (error instanceof SkuImportFileChangedError) {
        setCommitResult(null);
        setPreviewResult(null);
        setPreviewSignature("");
        toast.error(
          getApiErrorMessage(error, t("masterData.import.errStaleShort")),
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
          getApiErrorMessage(error, t("masterData.import.errHasErrorRows")),
        );
        return;
      }
      setCommitResult(null);
      toast.error(getApiErrorMessage(error, t("masterData.import.errCommit")));
    },
  });

  const templateMutation = useMutation({
    mutationFn: downloadSkuImportTemplate,
    onSuccess: ({ blob, fileName }) =>
      handleBlobDownload(blob, "mau-nhap-sku.xlsx", fileName),
    onError: (error) =>
      toast.error(
        getApiErrorMessage(error, t("masterData.import.errTemplate")),
      ),
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
            {t("masterData.import.title")}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={close}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </>
        }
      >
        <Stack spacing={1.75}>
          <UiAlert tone="info" title={t("masterData.import.stepsTitle")}>
            {t("masterData.import.stepsBody", {
              constraints: describeConstraints(constraints),
            })}
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
              aria-label={t("masterData.import.fileAria")}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                const error = next ? precheckFile(next, constraints) : null;
                setFileError(error);
                if (error) {
                  // Tệp sai đuôi/quá cỡ: không giữ lại, đổi key để input tự xoá.
                  setFile(null);
                  setFileInputKey((key) => key + 1);
                } else {
                  setFile(next);
                }
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
                  input: {
                    "aria-label": t("masterData.import.allowUpdateAria"),
                  },
                }}
              />
              <UiText variant="body">
                {t("masterData.import.allowUpdateLabel")}
              </UiText>
            </Stack>
            <ActionButton
              kind="download"
              disabled={templateMutation.isPending}
              onClick={() => templateMutation.mutate()}
            >
              {templateMutation.isPending
                ? t("masterData.import.downloading")
                : t("masterData.import.downloadTemplate")}
            </ActionButton>
          </Stack>

          <UiText variant="secondary">
            {t("masterData.import.columnsHint")}
          </UiText>

          {!canImport ? (
            <UiAlert tone="warning">
              {t("masterData.import.noPermission")}
            </UiAlert>
          ) : null}

          {fileError ? <UiAlert tone="error">{fileError}</UiAlert> : null}
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
                  ? t("masterData.import.validating")
                  : t("masterData.import.validate")}
              </ActionButton>
              <ActionButton
                kind="upload"
                disabled={!canCommit}
                onClick={() => {
                  const payload = currentPayload();
                  if (payload) commitMutation.mutate(payload);
                }}
              >
                {commitMutation.isPending
                  ? t("masterData.import.committing")
                  : t("masterData.import.commit")}
              </ActionButton>
            </Stack>

            {digestPending ? (
              <UiText variant="secondary">
                {t("masterData.import.checkingFile")}
              </UiText>
            ) : previewSignature !== "" && !previewMatchesCurrentPayload ? (
              <UiText variant="secondary">
                {t("masterData.import.changedSinceCheck")}
              </UiText>
            ) : !previewResult ? (
              <UiText variant="secondary">
                {t("masterData.import.mustFixFirst")}
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
                      ? t("masterData.import.resultReplayed")
                      : commitResult.committed
                        ? t("masterData.import.resultCommitted")
                        : t("masterData.import.resultRejected")
                    : t("masterData.import.resultDryRun")
                }
              />

              {commitResult?.duplicate ? (
                <UiAlert
                  tone="warning"
                  title={t("masterData.import.replayedTitle")}
                >
                  {t("masterData.import.replayedBody")}
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
              {t("masterData.import.reset")}
            </ActionButton>
            <ActionButton
              kind="close"
              disabled={previewMutation.isPending || commitMutation.isPending}
              onClick={close}
            >
              {t("common.close")}
            </ActionButton>
          </Stack>
        </Stack>
      </UiDialog>
    </>
  );
}
