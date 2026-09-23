import { useState } from "react";
import {
  Box,
  Grid,
  Stack,
  Tooltip,
  UiAlert,
  UiDialog,
  UiPagination,
  UiSelect,
  UiTextField,
} from "@/shared/ui";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import { useHasPermission } from "@/shared/components/permission";
import { DocumentAttachmentsPanel } from "@/shared/components/DocumentAttachmentsPanel";
import { fetchDocumentAttachments } from "@/shared/api/documentAttachmentService";
import {
  RETURN_CONDITION_LABELS,
  REVERSAL_REASON_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
  enumLabelOrText,
} from "@/shared/constants/business-labels";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { shortId } from "@/shared/utils/shortId";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import {
  useCancelReversal,
  useConfirmReversal,
  usePostReversal,
  useReversalDocument,
  useReversalLines,
} from "../hooks/use-reversal";
import { ReversalStatusTag } from "./ReversalStatusTag";
import type { ReversalLine, ReversalReturnCondition } from "../types";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import type { ReactNode } from "react";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, type TranslateFn } from "@/shared/i18n/useT";

function qty(value?: number) {
  return formatQuantity(Number(value ?? 0));
}

function idempotencyKey(action: string, id: string) {
  return `reversal-${action}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const LINES_PAGE_SIZE = 10;
/** Lý do hủy: tối thiểu 5 ký tự (BE min:5), trần theo quy ước lý do. */
const CANCEL_REASON_MIN = 5;
const CANCEL_REASON_MAX = 1000;

const returnConditionOptions = (
  t: TranslateFn,
): Array<{
  value: ReversalReturnCondition;
  label: string;
}> => [
  { value: "SELLABLE", label: t("reverse.returnCondition.sellable") },
  { value: "DEFECTIVE", label: t("reverse.returnCondition.defective") },
  { value: "NON_SELLABLE", label: t("reverse.returnCondition.nonSellable") },
];

/** Cặp nhãn/giá trị trong Dialog chi tiết (thay antd Descriptions.Item). */
function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid
      className="hn-reversal-detail-field"
      size={{ xs: 12, sm: 6, lg: 3 }}
      sx={{ minWidth: 0, overflowWrap: "anywhere" }}
    >
      <Box
        sx={{
          typography: "caption",
          color: "text.secondary",
          display: "block",
        }}
      >
        {label}
      </Box>
      <Box sx={{ typography: "body2", minWidth: 0, overflowWrap: "anywhere" }}>
        {value}
      </Box>
    </Grid>
  );
}

interface Props {
  documentId: string;
  onClose: () => void;
}

export function ReversalDetailModal({ documentId, onClose }: Props) {
  const t = useT();
  const dialog = useDialogExit(onClose);
  const can = useHasPermission();
  const canPost = can("inventory.reversal.post");

  const docQuery = useReversalDocument(documentId);
  const linesQuery = useReversalLines(documentId);
  const confirmMutation = useConfirmReversal();
  const postMutation = usePostReversal();
  const cancelMutation = useCancelReversal();

  const doc = docQuery.data;
  const lines = linesQuery.data ?? [];

  // "Chứng từ nhập/xuất/hoàn trả": REVERSAL luôn bắt buộc chứng từ trước khi
  // Post (DocumentEvidenceGuard) — cache dùng chung queryKey với
  // DocumentAttachmentsPanel bên dưới nên không tốn thêm request.
  const attachmentsQuery = useQuery({
    queryKey: ["document-attachments", "REVERSAL", documentId],
    queryFn: () => fetchDocumentAttachments("REVERSAL", documentId),
    enabled: Boolean(documentId),
  });
  const evidenceProvided = attachmentsQuery.data?.evidenceStatus === "PROVIDED";

  const [returnCondition, setReturnCondition] =
    useState<ReversalReturnCondition>("SELLABLE");
  const [cancelReason, setCancelReason] = useState("");
  const cancelReasonTooShort =
    cancelReason.trim().length > 0 &&
    cancelReason.trim().length < CANCEL_REASON_MIN;
  const [actionError, setActionError] = useState<unknown>(null);
  const [staleRecovered, setStaleRecovered] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [linesPage, setLinesPage] = useState(1);

  const isDraft = doc?.status === "DRAFT";
  const pendingReturn = doc?.physical_return_status === "PENDING_RETURN";
  const busy =
    confirmMutation.isPending ||
    postMutation.isPending ||
    cancelMutation.isPending;

  function handleFailure(error: unknown, fallback: string) {
    setActionError(error);
    const normalized = normalizeError(error);
    const isStaleVersion =
      normalized.status === 409 ||
      normalized.status === 412 ||
      normalized.status === 428;

    if (isStaleVersion) {
      setStaleRecovered(true);
      void docQuery.refetch();
      void linesQuery.refetch();
      toast.error(
        t("reverse.detail.staleReload", { message: normalized.message }),
      );
      return;
    }

    setStaleRecovered(false);
    toast.error(getApiErrorMessage(error, fallback));
  }

  async function handleConfirm() {
    if (!doc) return;
    setActionError(null);
    setStaleRecovered(false);
    try {
      await confirmMutation.mutateAsync({
        id: doc.id,
        version: doc.version,
        return_condition: returnCondition,
      });
      toast.success(t("reverse.detail.confirmSuccess"));
    } catch (error) {
      handleFailure(error, t("reverse.detail.confirmError"));
    }
  }

  async function handlePost() {
    if (!doc) return;
    setActionError(null);
    setStaleRecovered(false);
    setPostBusy(true);
    try {
      await postMutation.mutateAsync({
        id: doc.id,
        version: doc.version,
        idempotency_key: idempotencyKey("post", doc.id),
      });
      toast.success(t("reverse.detail.postSuccess"));
      setPostConfirmOpen(false);
    } catch (error) {
      handleFailure(error, t("reverse.detail.postError"));
    } finally {
      setPostBusy(false);
    }
  }

  async function handleCancel() {
    if (!doc) return;
    setActionError(null);
    setStaleRecovered(false);
    try {
      await cancelMutation.mutateAsync({
        id: doc.id,
        version: doc.version,
        reason: cancelReason.trim(),
      });
      toast.success(t("reverse.detail.cancelSuccess"));
      setCancelReason("");
    } catch (error) {
      handleFailure(error, t("reverse.detail.cancelError"));
    }
  }

  const copyCode = () => {
    if (!doc) return;
    void navigator.clipboard?.writeText(doc.reversal_code);
    toast.success(t("reverse.detail.codeCopied"));
  };

  const lineColumns: ResponsiveTableColumn<ReversalLine>[] = [
    {
      key: "line_no",
      header: t("reverse.detail.colStt"),
      width: 50,
      align: "center",
      render: (row) => row.line_no,
    },
    { key: "sku", header: "SKU", width: 140, render: (row) => row.sku },
    {
      key: "sku_name",
      header: t("reverse.columns.name"),
      width: 170,
      render: (row) => row.sku_name,
    },
    {
      key: "original_movement",
      header: t("reverse.detail.colOriginalMovement"),
      width: 160,
      // KHÔNG fallback sang original_movement_id (UUID) — thiếu mã thì "—".
      render: (row) => row.original_movement_code || EMPTY_TEXT,
    },
    {
      key: "serial",
      header: t("reverse.detail.colSerial"),
      width: 170,
      render: (row) => row.serial_number || row.item_code || EMPTY_TEXT,
    },
    {
      key: "original_qty",
      header: t("reverse.columns.originalQty"),
      width: 110,
      align: "right",
      render: (row) => qty(row.original_qty),
    },
    {
      key: "reversal_qty",
      header: t("reverse.columns.reversalQty"),
      width: 130,
      align: "right",
      render: (row) => qty(row.reversal_qty),
    },
    {
      key: "reversed_qty",
      header: t("reverse.columns.reversedQty"),
      width: 110,
      align: "right",
      render: (row) => qty(row.reversed_qty),
    },
    {
      key: "remaining_qty",
      header: t("reverse.columns.reversibleQty"),
      width: 150,
      align: "right",
      render: (row) => qty(row.remaining_qty),
    },
    {
      key: "return_condition",
      header: t("reverse.detail.colReturnCondition"),
      width: 160,
      render: (row) =>
        row.return_condition
          ? businessLabel(
              RETURN_CONDITION_LABELS,
              row.return_condition,
              t("reverse.detail.conditionOther"),
            )
          : EMPTY_TEXT,
    },
    {
      key: "status",
      header: t("reverse.detail.colStatus"),
      width: 150,
      render: (row) => <ReversalStatusTag status={row.status} compact />,
    },
  ];

  // Phân trang client 10 dòng/trang, chỉ khi vượt 10 dòng — giữ đúng hành vi
  // `pagination={lines.length > 10 ? { pageSize: 10 } : false}` của antd cũ.
  const showLinesPagination = lines.length > LINES_PAGE_SIZE;
  const linesPageCount = Math.max(1, Math.ceil(lines.length / LINES_PAGE_SIZE));
  const safeLinesPage = Math.min(linesPage, linesPageCount);
  const pagedLines = showLinesPagination
    ? lines.slice(
        (safeLinesPage - 1) * LINES_PAGE_SIZE,
        safeLinesPage * LINES_PAGE_SIZE,
      )
    : lines;

  return (
    <>
      <UiDialog
        className="hn-reversal-dialog"
        {...dialog.dialogProps}
        maxWidth="xl"
        fullWidth
        title={
          <Box sx={{ position: "relative", pr: 6 }}>
            {t("reverse.detail.title", {
              code: doc?.reversal_code ?? shortId(documentId),
            })}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={dialog.close}
              sx={{ position: "absolute", right: -8, top: -4 }}
            />
          </Box>
        }
      >
        <Stack spacing={2}>
          {docQuery.isError ? (
            <ApiErrorAlert
              error={docQuery.error}
              title={t("reverse.detail.loadError")}
              onRetry={() => docQuery.refetch()}
            />
          ) : null}

          {actionError ? (
            <ApiErrorAlert
              error={actionError}
              title={t("reverse.detail.actionFailed")}
              onRetry={() => {
                setActionError(null);
                setStaleRecovered(false);
                void docQuery.refetch();
                void linesQuery.refetch();
              }}
            />
          ) : null}

          {staleRecovered ? (
            <Box role="status" data-testid="reversal-stale-version-notice">
              <UiAlert tone="warning" title={t("reverse.detail.staleTitle")}>
                {t("reverse.detail.staleBody")}
              </UiAlert>
            </Box>
          ) : null}

          {docQuery.isLoading ? (
            <Box
              sx={{
                typography: "body2",
                color: "text.secondary",
                textAlign: "center",
                py: 3,
              }}
            >
              {t("reverse.detail.loading")}
            </Box>
          ) : null}

          {doc ? (
            <>
              <Box
                className="hn-reversal-panel"
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Grid container spacing={2}>
                  <DetailField
                    label={t("reverse.detail.fieldCode")}
                    value={
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ alignItems: "center" }}
                      >
                        <span>{doc.reversal_code}</span>
                        <ActionIconButton
                          kind="copy"
                          label={t("reverse.detail.copyCode")}
                          onClick={copyCode}
                        />
                      </Stack>
                    }
                  />
                  <DetailField
                    label={t("reverse.detail.colStatus")}
                    value={
                      <ReversalStatusTag
                        status={doc.status}
                        physicalReturnStatus={doc.physical_return_status}
                      />
                    }
                  />
                  <DetailField
                    label={t("reverse.detail.fieldSourceDoc")}
                    value={
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <span>{doc.reference_document_code}</span>
                        <Box
                          component="span"
                          sx={{
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            bgcolor: "action.hover",
                            fontSize: 12,
                          }}
                        >
                          {businessLabel(
                            SOURCE_DOCUMENT_TYPE_LABELS,
                            doc.reference_document_type,
                            t("reverse.common.docTypeOther"),
                          )}
                        </Box>
                      </Stack>
                    }
                  />
                  {/* correction_chain_id là khoá liên kết nội bộ, KHÔNG có mã
                    nghiệp vụ. Gọi đúng tên và rút gọn + cho sao chép thay vì in
                    nguyên UUID dưới nhãn "Mã ..." khiến người dùng tưởng là mã. */}
                  <DetailField
                    label={t("reverse.detail.fieldChain")}
                    value={
                      doc.correction_chain_id ? (
                        <CopyableId value={doc.correction_chain_id} />
                      ) : (
                        EMPTY_TEXT
                      )
                    }
                  />
                  <DetailField
                    label={t("reverse.detail.fieldWarehouse")}
                    value={doc.warehouse_name}
                  />
                  <DetailField
                    label={t("reverse.detail.fieldReason")}
                    value={
                      <>
                        {doc.reason_code ? (
                          <Box
                            component="span"
                            sx={{
                              px: 1,
                              py: 0.25,
                              mr: 1,
                              borderRadius: 1,
                              bgcolor: "action.hover",
                              fontSize: 12,
                            }}
                          >
                            {enumLabelOrText(
                              REVERSAL_REASON_LABELS,
                              doc.reason_code,
                            )}
                          </Box>
                        ) : null}
                        {doc.reason}
                      </>
                    }
                  />
                  <DetailField
                    label={t("reverse.detail.fieldTotals")}
                    value={t("reverse.detail.totalsValue", {
                      lines: doc.total_lines,
                      qty: qty(doc.total_qty),
                    })}
                  />
                  <DetailField
                    label={t("reverse.detail.fieldCreatedAt")}
                    value={formatDateTime(doc.created_at)}
                  />
                  <DetailField
                    label={t("reverse.detail.fieldCreatedBy")}
                    value={doc.created_by}
                  />
                  <DetailField
                    label={t("reverse.detail.fieldPostedAt")}
                    value={`${doc.reversed_at ? formatDateTime(doc.reversed_at) : EMPTY_TEXT} · ${doc.posted_by ?? EMPTY_TEXT}`}
                  />
                  <DetailField
                    label={t("reverse.detail.fieldCancelInfo")}
                    value={
                      doc.cancelled_at
                        ? `${formatDateTime(doc.cancelled_at)} · ${doc.cancel_reason ?? EMPTY_TEXT}`
                        : EMPTY_TEXT
                    }
                  />
                </Grid>
              </Box>

              <Box
                className="hn-reversal-panel"
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <DocumentAttachmentsPanel
                  dialogClassName="hn-reversal-dialog"
                  documentType="REVERSAL"
                  documentId={doc.id}
                  disabled={doc.status !== "DRAFT"}
                />
              </Box>

              {doc.status === "POSTED" ? (
                <UiAlert tone="success" title={t("reverse.detail.postedTitle")}>
                  {t("reverse.detail.postedBody")}
                </UiAlert>
              ) : null}

              {isDraft && canPost ? (
                <Box
                  className="hn-reversal-panel"
                  sx={{
                    bgcolor: "action.hover",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Box
                    sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}
                  >
                    {t("reverse.detail.stepsTitle")}
                  </Box>

                  {pendingReturn ? (
                    <Stack
                      direction="row"
                      spacing={2}
                      useFlexGap
                      sx={{
                        alignItems: "flex-end",
                        flexWrap: "wrap",
                        mb: 1.5,
                        rowGap: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: 0,
                          maxWidth: "100%",
                          width: { xs: "100%", sm: 320 },
                        }}
                      >
                        <UiSelect
                          menuClassName="hn-reversal-menu"
                          label={t("reverse.create.returnConditionLabel")}
                          fullWidth
                          value={returnCondition}
                          options={returnConditionOptions(t)}
                          onChange={(value) =>
                            setReturnCondition(value as ReversalReturnCondition)
                          }
                        />
                      </Box>
                      <ActionButton
                        className="hn-reversal-primary"
                        kind="confirm"
                        disabled={busy}
                        onClick={() => void handleConfirm()}
                      >
                        {t("reverse.detail.confirmPhysical")}
                      </ActionButton>
                    </Stack>
                  ) : (
                    <Box sx={{ mb: 1.5 }}>
                      <UiAlert
                        tone="info"
                        title={t("reverse.detail.readyTitle")}
                      >
                        {t("reverse.detail.readyBody")}
                      </UiAlert>
                    </Box>
                  )}

                  <Stack
                    direction="row"
                    spacing={2}
                    useFlexGap
                    sx={{
                      alignItems: "flex-end",
                      flexWrap: "wrap",
                      rowGap: 1.5,
                    }}
                  >
                    <Tooltip
                      title={
                        !pendingReturn && !evidenceProvided
                          ? t("reverse.detail.evidenceTooltip")
                          : ""
                      }
                    >
                      <span>
                        <ActionButton
                          className="hn-reversal-primary"
                          kind="complete"
                          disabled={busy || pendingReturn || !evidenceProvided}
                          onClick={() => setPostConfirmOpen(true)}
                        >
                          {t("reverse.detail.postAction")}
                        </ActionButton>
                      </span>
                    </Tooltip>
                    <UiTextField
                      label={t("reverse.detail.cancelReasonLabel")}
                      size="small"
                      value={cancelReason}
                      placeholder={t("reverse.detail.cancelReasonPlaceholder")}
                      onChange={(event) => setCancelReason(event.target.value)}
                      sx={{
                        minWidth: 0,
                        maxWidth: "100%",
                        width: { xs: "100%", sm: 320 },
                      }}
                      slotProps={{
                        htmlInput: { maxLength: CANCEL_REASON_MAX },
                      }}
                      // Đang gõ dở (< 5 ký tự) thì báo ngay tại ô, không chỉ
                      // mờ nút hủy để người dùng biết vì sao chưa bấm được.
                      error={cancelReasonTooShort}
                      helperText={
                        cancelReasonTooShort
                          ? t("reverse.create.reasonHelper")
                          : undefined
                      }
                    />
                    <ActionButton
                      kind="cancel"
                      disabled={
                        busy || cancelReason.trim().length < CANCEL_REASON_MIN
                      }
                      onClick={() => void handleCancel()}
                    >
                      {t("reverse.detail.cancelAction")}
                    </ActionButton>
                  </Stack>
                </Box>
              ) : null}
            </>
          ) : null}

          {linesQuery.isError ? (
            <ApiErrorAlert
              error={linesQuery.error}
              title={t("reverse.detail.linesError")}
              onRetry={() => linesQuery.refetch()}
            />
          ) : null}

          <Box>
            <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
              {t("reverse.detail.linesTitle", { count: lines.length })}
            </Box>
            <ResponsiveDataTable<ReversalLine>
              columns={lineColumns}
              headerCellStyle={{
                background: "var(--rev-pale)",
                color: "var(--rev-ink)",
                fontSize: 12,
                padding: "10px 9px",
                borderColor: "var(--rev-line)",
              }}
              rows={pagedLines}
              rowKey={(row) => row.id}
              loading={linesQuery.isLoading}
              emptyText={t("reverse.detail.linesEmpty")}
            />
            {showLinesPagination ? (
              <Box sx={{ mt: 1 }}>
                <UiPagination
                  page={safeLinesPage}
                  pageSize={LINES_PAGE_SIZE}
                  total={lines.length}
                  onPageChange={setLinesPage}
                />
              </Box>
            ) : null}
          </Box>
        </Stack>
      </UiDialog>

      <UiDialog
        className="hn-reversal-dialog"
        open={postConfirmOpen}
        onClose={() => setPostConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        // MUI Dialog không tự nối accessible name — thiếu aria-labelledby thì
        // screen reader (và query role "dialog" theo name) không đọc được tiêu đề.
        // UiDialog spread {...rest} SAU aria-labelledby nội bộ nên id hợp đồng
        // wwhn-242 dưới đây thắng; phần tử mang id nằm trong title bên dưới.
        aria-labelledby="reversal-post-confirm-title"
        title={
          <Box component="span" id="reversal-post-confirm-title">
            {t("reverse.detail.postConfirmTitle")}
          </Box>
        }
        actions={
          <>
            <ActionButton
              kind="refresh"
              onClick={() => setPostConfirmOpen(false)}
              disabled={postBusy}
            >
              {t("reverse.common.recheck")}
            </ActionButton>
            <ActionButton
              className="hn-reversal-primary"
              kind="complete"
              onClick={() => void handlePost()}
              disabled={postBusy}
            >
              {postBusy
                ? t("reverse.detail.processing")
                : t("reverse.detail.postAction")}
            </ActionButton>
          </>
        }
      >
        <Box sx={{ typography: "body2" }}>
          {t("reverse.detail.postConfirmBody")}
        </Box>
      </UiDialog>
    </>
  );
}
