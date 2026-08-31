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
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
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

function qty(value?: number) {
  return formatQuantity(Number(value ?? 0));
}

function idempotencyKey(action: string, id: string) {
  return `reversal-${action}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const LINES_PAGE_SIZE = 10;

const RETURN_CONDITION_OPTIONS: Array<{
  value: ReversalReturnCondition;
  label: string;
}> = [
  { value: "SELLABLE", label: "Có thể bán/xuất lại" },
  { value: "DEFECTIVE", label: "Hàng lỗi" },
  { value: "NON_SELLABLE", label: "Không thể bán/xuất" },
];

/** Cặp nhãn/giá trị trong Dialog chi tiết (thay antd Descriptions.Item). */
function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <Box
        sx={{
          typography: "caption",
          color: "text.secondary",
          display: "block",
        }}
      >
        {label}
      </Box>
      <Box sx={{ typography: "body2" }}>{value}</Box>
    </Grid>
  );
}

interface Props {
  documentId: string;
  onClose: () => void;
}

export function ReversalDetailModal({ documentId, onClose }: Props) {
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
        `${normalized.message}. Hệ thống đã tải lại phiếu mới nhất; hãy kiểm tra trạng thái rồi thử lại.`,
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
      toast.success(
        "Đã xác nhận hàng vật lý quay lại kho; tồn kho chưa thay đổi ở bước này.",
      );
    } catch (error) {
      handleFailure(error, "Không thể xác nhận hàng đã về kho");
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
      toast.success("Đã hoàn tất điều chỉnh tồn kho.");
      setPostConfirmOpen(false);
    } catch (error) {
      handleFailure(error, "Không thể hoàn tất điều chỉnh tồn kho");
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
      toast.success("Đã hủy phiếu điều chỉnh; tồn kho không thay đổi.");
      setCancelReason("");
    } catch (error) {
      handleFailure(error, "Không thể hủy phiếu điều chỉnh");
    }
  }

  const copyCode = () => {
    if (!doc) return;
    void navigator.clipboard?.writeText(doc.reversal_code);
    toast.success("Đã sao chép mã điều chỉnh.");
  };

  const lineColumns: ResponsiveTableColumn<ReversalLine>[] = [
    {
      key: "line_no",
      header: "STT",
      width: 50,
      align: "center",
      render: (row) => row.line_no,
    },
    { key: "sku", header: "SKU", width: 140, render: (row) => row.sku },
    {
      key: "sku_name",
      header: "Tên",
      width: 170,
      render: (row) => row.sku_name,
    },
    {
      key: "original_movement",
      header: "Giao dịch gốc",
      width: 160,
      // KHÔNG fallback sang original_movement_id (UUID) — thiếu mã thì "—".
      render: (row) => row.original_movement_code || EMPTY_TEXT,
    },
    {
      key: "serial",
      header: "Sản phẩm / Số sê-ri",
      width: 170,
      render: (row) => row.serial_number || row.item_code || EMPTY_TEXT,
    },
    {
      key: "original_qty",
      header: "Số lượng gốc",
      width: 110,
      align: "right",
      render: (row) => qty(row.original_qty),
    },
    {
      key: "reversal_qty",
      header: "Số lượng điều chỉnh",
      width: 130,
      align: "right",
      render: (row) => qty(row.reversal_qty),
    },
    {
      key: "reversed_qty",
      header: "Đã điều chỉnh",
      width: 110,
      align: "right",
      render: (row) => qty(row.reversed_qty),
    },
    {
      key: "remaining_qty",
      header: "Còn có thể điều chỉnh",
      width: 150,
      align: "right",
      render: (row) => qty(row.remaining_qty),
    },
    {
      key: "return_condition",
      header: "Tình trạng trả về",
      width: 160,
      render: (row) =>
        row.return_condition
          ? businessLabel(
              RETURN_CONDITION_LABELS,
              row.return_condition,
              "Tình trạng khác",
            )
          : EMPTY_TEXT,
    },
    {
      key: "status",
      header: "Trạng thái",
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
        {...dialog.dialogProps}
        maxWidth="xl"
        fullWidth
        title={
          <Box sx={{ position: "relative", pr: 6 }}>
            {`Chi tiết phiếu điều chỉnh — ${doc?.reversal_code ?? shortId(documentId)}`}
            <ActionIconButton
              kind="close"
              label="Đóng"
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
              title="Không thể tải chi tiết phiếu điều chỉnh"
              onRetry={() => docQuery.refetch()}
            />
          ) : null}

          {actionError ? (
            <ApiErrorAlert
              error={actionError}
              title="Thao tác không thành công"
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
              <UiAlert
                tone="warning"
                title="Phiếu đã được cập nhật ở phiên khác"
              >
                Hệ thống đã tự tải lại dữ liệu mới nhất. Hãy kiểm tra trạng thái
                hiện tại trước khi tiếp tục thao tác. Không có thay đổi tồn kho
                nào được ghi từ lần thao tác bị từ chối.
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
              Đang tải chi tiết...
            </Box>
          ) : null}

          {doc ? (
            <>
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Grid container spacing={2}>
                  <DetailField
                    label="Mã điều chỉnh"
                    value={
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ alignItems: "center" }}
                      >
                        <span>{doc.reversal_code}</span>
                        <ActionIconButton
                          kind="copy"
                          label="Sao chép mã điều chỉnh"
                          onClick={copyCode}
                        />
                      </Stack>
                    }
                  />
                  <DetailField
                    label="Trạng thái"
                    value={
                      <ReversalStatusTag
                        status={doc.status}
                        physicalReturnStatus={doc.physical_return_status}
                      />
                    }
                  />
                  <DetailField
                    label="Chứng từ gốc"
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
                            "Chứng từ khác",
                          )}
                        </Box>
                      </Stack>
                    }
                  />
                  {/* correction_chain_id là khoá liên kết nội bộ, KHÔNG có mã
                    nghiệp vụ. Gọi đúng tên và rút gọn + cho sao chép thay vì in
                    nguyên UUID dưới nhãn "Mã ..." khiến người dùng tưởng là mã. */}
                  <DetailField
                    label="Chuỗi điều chỉnh (định danh nội bộ)"
                    value={
                      doc.correction_chain_id ? (
                        <CopyableId value={doc.correction_chain_id} />
                      ) : (
                        EMPTY_TEXT
                      )
                    }
                  />
                  <DetailField label="Kho" value={doc.warehouse_name} />
                  <DetailField
                    label="Lý do"
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
                            {doc.reason_code}
                          </Box>
                        ) : null}
                        {doc.reason}
                      </>
                    }
                  />
                  <DetailField
                    label="Tổng dòng / số lượng"
                    value={`${doc.total_lines} dòng · ${qty(doc.total_qty)}`}
                  />
                  <DetailField
                    label="Ngày tạo"
                    value={formatDateTime(doc.created_at)}
                  />
                  <DetailField label="Người tạo" value={doc.created_by} />
                  <DetailField
                    label="Thời điểm hoàn tất / người thực hiện"
                    value={`${doc.reversed_at ? formatDateTime(doc.reversed_at) : EMPTY_TEXT} · ${doc.posted_by ?? EMPTY_TEXT}`}
                  />
                  <DetailField
                    label="Thông tin hủy"
                    value={
                      doc.cancelled_at
                        ? `${formatDateTime(doc.cancelled_at)} · ${doc.cancel_reason ?? EMPTY_TEXT}`
                        : EMPTY_TEXT
                    }
                  />
                </Grid>
              </Box>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <DocumentAttachmentsPanel
                  documentType="REVERSAL"
                  documentId={doc.id}
                  disabled={doc.status !== "DRAFT"}
                />
              </Box>

              {doc.status === "POSTED" ? (
                <UiAlert tone="success" title="Phiếu điều chỉnh đã hoàn tất">
                  Giao dịch gốc vẫn được giữ nguyên và giao dịch đối ứng đã được
                  ghi. Nếu cần sửa tiếp, hãy tạo phiếu điều chỉnh mới tham chiếu
                  giao dịch gần nhất trong cùng chuỗi.
                </UiAlert>
              ) : null}

              {isDraft && canPost ? (
                <Box
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
                    Các bước xử lý phiếu điều chỉnh
                  </Box>

                  {pendingReturn ? (
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{
                        alignItems: "flex-end",
                        flexWrap: "wrap",
                        mb: 1.5,
                        rowGap: 1.5,
                      }}
                    >
                      <UiSelect
                        label="Tình trạng hàng trả về"
                        minWidth={320}
                        value={returnCondition}
                        options={RETURN_CONDITION_OPTIONS}
                        onChange={(value) =>
                          setReturnCondition(value as ReversalReturnCondition)
                        }
                      />
                      <ActionButton
                        kind="confirm"
                        disabled={busy}
                        onClick={() => void handleConfirm()}
                      >
                        Xác nhận hàng vật lý đã về
                      </ActionButton>
                    </Stack>
                  ) : (
                    <Box sx={{ mb: 1.5 }}>
                      <UiAlert tone="info" title="Đã đủ điều kiện hoàn tất">
                        Hàng vật lý đã được xác nhận quay lại kho. Bấm Hoàn tất
                        điều chỉnh để ghi thay đổi tồn kho.
                      </UiAlert>
                    </Box>
                  )}

                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{
                      alignItems: "flex-end",
                      flexWrap: "wrap",
                      rowGap: 1.5,
                    }}
                  >
                    <Tooltip
                      title={
                        !pendingReturn && !evidenceProvided
                          ? "Phải đính kèm ít nhất 1 chứng từ trước khi hoàn tất điều chỉnh."
                          : ""
                      }
                    >
                      <span>
                        <ActionButton
                          kind="complete"
                          disabled={busy || pendingReturn || !evidenceProvided}
                          onClick={() => setPostConfirmOpen(true)}
                        >
                          Hoàn tất điều chỉnh
                        </ActionButton>
                      </span>
                    </Tooltip>
                    <UiTextField
                      label="Lý do hủy (tối thiểu 5 ký tự)"
                      size="small"
                      value={cancelReason}
                      placeholder="Nhập lý do hủy phiếu..."
                      onChange={(event) => setCancelReason(event.target.value)}
                      sx={{ minWidth: 320 }}
                    />
                    <ActionButton
                      kind="cancel"
                      disabled={busy || cancelReason.trim().length < 5}
                      onClick={() => void handleCancel()}
                    >
                      Hủy phiếu
                    </ActionButton>
                  </Stack>
                </Box>
              ) : null}
            </>
          ) : null}

          {linesQuery.isError ? (
            <ApiErrorAlert
              error={linesQuery.error}
              title="Không thể tải các dòng điều chỉnh"
              onRetry={() => linesQuery.refetch()}
            />
          ) : null}

          <Box>
            <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
              Dòng điều chỉnh ({lines.length})
            </Box>
            <ResponsiveDataTable<ReversalLine>
              columns={lineColumns}
              rows={pagedLines}
              rowKey={(row) => row.id}
              loading={linesQuery.isLoading}
              emptyText="Chưa có dòng điều chỉnh"
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
            Hoàn tất phiếu điều chỉnh tồn kho?
          </Box>
        }
        actions={
          <>
            <ActionButton
              kind="refresh"
              onClick={() => setPostConfirmOpen(false)}
              disabled={postBusy}
            >
              Kiểm tra lại
            </ActionButton>
            <ActionButton
              kind="complete"
              onClick={() => void handlePost()}
              disabled={postBusy}
            >
              {postBusy ? "Đang xử lý..." : "Hoàn tất điều chỉnh"}
            </ActionButton>
          </>
        }
      >
        <Box sx={{ typography: "body2" }}>
          Đây là bước làm phát sinh giao dịch đối ứng và thay đổi tồn kho. Giao
          dịch gốc vẫn được giữ nguyên. Nếu cần điều chỉnh tiếp, phải tạo phiếu
          điều chỉnh mới.
        </Box>
      </UiDialog>
    </>
  );
}
