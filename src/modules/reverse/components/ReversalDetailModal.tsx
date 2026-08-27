import { useState } from "react";
import { Table } from "antd";
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
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
  useCancelReversal,
  useConfirmReversal,
  usePostReversal,
  useReversalDocument,
  useReversalLines,
} from "../hooks/use-reversal";
import { ReversalStatusTag } from "./ReversalStatusTag";
import type { ReversalLine, ReversalReturnCondition } from "../types";
import { formatDateTime } from "@/shared/utils/format-date";
import type { ReactNode } from "react";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

const numberFormatter = new Intl.NumberFormat("vi-VN");

function qty(value?: number) {
  return numberFormatter.format(Number(value ?? 0));
}

function idempotencyKey(action: string, id: string) {
  return `reversal-${action}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
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

  return (
    <>
      <Dialog {...dialog.dialogProps} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          {`Chi tiết phiếu điều chỉnh — ${doc?.reversal_code ?? documentId}`}
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={dialog.close}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </DialogTitle>
        <DialogContent dividers>
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
              <Alert
                severity="warning"
                role="status"
                data-testid="reversal-stale-version-notice"
              >
                <Typography
                  component="strong"
                  sx={{ fontWeight: 700, display: "block" }}
                >
                  Phiếu đã được cập nhật ở phiên khác
                </Typography>
                <Typography variant="body2">
                  Hệ thống đã tự tải lại dữ liệu mới nhất. Hãy kiểm tra trạng
                  thái hiện tại trước khi tiếp tục thao tác. Không có thay đổi
                  tồn kho nào được ghi từ lần thao tác bị từ chối.
                </Typography>
              </Alert>
            ) : null}

            {docQuery.isLoading ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 3 }}
              >
                Đang tải chi tiết...
              </Typography>
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
                    <DetailField
                      label="Mã chuỗi điều chỉnh"
                      value={doc.correction_chain_id ?? "-"}
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
                      value={`${doc.reversed_at ? formatDateTime(doc.reversed_at) : "-"} · ${doc.posted_by ?? "-"}`}
                    />
                    <DetailField
                      label="Thông tin hủy"
                      value={
                        doc.cancelled_at
                          ? `${formatDateTime(doc.cancelled_at)} · ${doc.cancel_reason ?? "-"}`
                          : "-"
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
                  <Alert severity="success">
                    <Typography
                      component="strong"
                      sx={{ fontWeight: 700, display: "block" }}
                    >
                      Phiếu điều chỉnh đã hoàn tất
                    </Typography>
                    <Typography variant="body2">
                      Giao dịch gốc vẫn được giữ nguyên và giao dịch đối ứng đã
                      được ghi. Nếu cần sửa tiếp, hãy tạo phiếu điều chỉnh mới
                      tham chiếu giao dịch gần nhất trong cùng chuỗi.
                    </Typography>
                  </Alert>
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
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, mb: 1.5 }}
                    >
                      Các bước xử lý phiếu điều chỉnh
                    </Typography>

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
                        <FormControl size="small" sx={{ minWidth: 320 }}>
                          <InputLabel id="reversal-return-condition-label">
                            Tình trạng hàng trả về
                          </InputLabel>
                          <Select
                            id="reversal-return-condition"
                            labelId="reversal-return-condition-label"
                            label="Tình trạng hàng trả về"
                            value={returnCondition}
                            onChange={(event) =>
                              setReturnCondition(
                                event.target.value as ReversalReturnCondition,
                              )
                            }
                          >
                            {RETURN_CONDITION_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <ActionButton
                          kind="confirm"
                          disabled={busy}
                          onClick={() => void handleConfirm()}
                        >
                          Xác nhận hàng vật lý đã về
                        </ActionButton>
                      </Stack>
                    ) : (
                      <Alert severity="info" sx={{ mb: 1.5 }}>
                        <Typography
                          component="strong"
                          sx={{ fontWeight: 700, display: "block" }}
                        >
                          Đã đủ điều kiện hoàn tất
                        </Typography>
                        <Typography variant="body2">
                          Hàng vật lý đã được xác nhận quay lại kho. Bấm Hoàn
                          tất điều chỉnh để ghi thay đổi tồn kho.
                        </Typography>
                      </Alert>
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
                            disabled={
                              busy || pendingReturn || !evidenceProvided
                            }
                            onClick={() => setPostConfirmOpen(true)}
                          >
                            Hoàn tất điều chỉnh
                          </ActionButton>
                        </span>
                      </Tooltip>
                      <TextField
                        label="Lý do hủy (tối thiểu 5 ký tự)"
                        size="small"
                        value={cancelReason}
                        placeholder="Nhập lý do hủy phiếu..."
                        onChange={(event) =>
                          setCancelReason(event.target.value)
                        }
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
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Dòng điều chỉnh ({lines.length})
              </Typography>
              <Table<ReversalLine>
                size="small"
                dataSource={lines}
                rowKey="id"
                loading={linesQuery.isLoading}
                pagination={lines.length > 10 ? { pageSize: 10 } : false}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "Chưa có dòng điều chỉnh" }}
                columns={[
                  {
                    title: "#",
                    dataIndex: "line_no",
                    width: 50,
                    align: "center",
                  },
                  { title: "SKU", dataIndex: "sku", width: 140 },
                  { title: "Tên", dataIndex: "sku_name", width: 170 },
                  {
                    title: "Giao dịch gốc",
                    width: 160,
                    render: (_: unknown, row: ReversalLine) =>
                      row.original_movement_code || row.original_movement_id,
                  },
                  {
                    title: "Sản phẩm / Số sê-ri",
                    width: 170,
                    render: (_: unknown, row: ReversalLine) =>
                      row.serial_number || row.item_code || "-",
                  },
                  {
                    title: "Số lượng gốc",
                    dataIndex: "original_qty",
                    width: 110,
                    align: "right",
                    render: qty,
                  },
                  {
                    title: "Số lượng điều chỉnh",
                    dataIndex: "reversal_qty",
                    width: 130,
                    align: "right",
                    render: qty,
                  },
                  {
                    title: "Đã điều chỉnh",
                    dataIndex: "reversed_qty",
                    width: 110,
                    align: "right",
                    render: qty,
                  },
                  {
                    title: "Còn có thể điều chỉnh",
                    dataIndex: "remaining_qty",
                    width: 150,
                    align: "right",
                    render: qty,
                  },
                  {
                    title: "Tình trạng trả về",
                    dataIndex: "return_condition",
                    width: 160,
                    render: (value: string | undefined) =>
                      value
                        ? businessLabel(
                            RETURN_CONDITION_LABELS,
                            value,
                            "Tình trạng khác",
                          )
                        : "-",
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    width: 150,
                    render: (value: string) => (
                      <ReversalStatusTag status={value} compact />
                    ),
                  },
                ]}
              />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={postConfirmOpen}
        onClose={() => setPostConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        // MUI Dialog không tự nối accessible name — thiếu aria-labelledby thì
        // screen reader (và query role "dialog" theo name) không đọc được tiêu đề.
        aria-labelledby="reversal-post-confirm-title"
      >
        <DialogTitle id="reversal-post-confirm-title">
          Hoàn tất phiếu điều chỉnh tồn kho?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Đây là bước làm phát sinh giao dịch đối ứng và thay đổi tồn kho.
            Giao dịch gốc vẫn được giữ nguyên. Nếu cần điều chỉnh tiếp, phải tạo
            phiếu điều chỉnh mới.
          </Typography>
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>
    </>
  );
}
