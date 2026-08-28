import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiDialog,
  UiStatusBadge,
  UiText,
  UiTextField,
  type UiStatusTone,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import {
  AnimatedList,
  AnimatedListItem,
} from "@/shared/components/motion/AnimatedList";
import { createRowKey } from "@/shared/components/motion/row-key";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getApiErrorMessage, getErrorRequestId } from "@/shared/api/api-error";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useCanAny } from "@/shared/components/permission";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import {
  useCancelComponentIssue,
  useComponentIssueDetail,
  useCreateComponentIssue,
  usePostComponentIssue,
  useScanComponentIssue,
} from "@/modules/warranty/hooks/use-warranty";
import { makeWarrantyIdempotencyKey } from "@/modules/warranty/services/warrantyService";
import type {
  ComponentIssueDocument,
  ComponentIssueLine,
  ComponentIssueStatus,
} from "@/modules/warranty/services/componentIssueService";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

interface DraftLineValue {
  /** Danh tính ổn định của dòng (xem createRowKey) — không gửi lên API. */
  key: string;
  sku_id: string;
  required_qty: number | null;
}

function emptyDraftLine(): DraftLineValue {
  return { key: createRowKey("comp-line"), sku_id: "", required_qty: null };
}

interface ComponentIssueModalProps {
  caseId: string;
  caseCode?: string;
  caseActive: boolean;
  documentId?: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const STATUS_BADGE: Record<
  ComponentIssueStatus,
  { tone: UiStatusTone; label: string }
> = {
  DRAFT: { tone: "neutral", label: "DRAFT" },
  SCANNING: { tone: "info", label: "SCANNING" },
  POSTED: { tone: "success", label: "POSTED" },
  CANCELLED: { tone: "error", label: "CANCELLED" },
};

function errorText(error: unknown, fallback: string): string {
  const requestId = getErrorRequestId(error);
  return `${getApiErrorMessage(error, fallback)}${
    requestId ? ` — Request ${requestId}` : ""
  }`;
}

/**
 * COMP-01 · Xuất linh kiện cho bảo hành (BP-WMS-06).
 * DRAFT → SCANNING → POSTED/CANCELLED; purpose luôn WARRANTY và bắt buộc
 * warranty case active; full-post (mọi line scanned = required) mới trừ tồn.
 */
export function ComponentIssueModal({
  caseId,
  caseCode,
  caseActive,
  documentId: initialDocumentId,
  onClose,
  onChanged,
}: ComponentIssueModalProps) {
  const dialog = useDialogExit(onClose);
  const canIssue = useCanAny(["warranty.component_issue"]);
  const [documentId, setDocumentId] = useState<string | null>(
    initialDocumentId ?? null,
  );
  const [localVersion, setLocalVersion] = useState<number | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [scanQuantity, setScanQuantity] = useState<number>(1);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);

  const [draftLines, setDraftLines] = useState<DraftLineValue[]>(() => [
    emptyDraftLine(),
  ]);
  const [draftNote, setDraftNote] = useState("");
  const [lineErrors, setLineErrors] = useState<
    Record<number, { sku_id?: string; required_qty?: string }>
  >({});

  const detailQuery = useComponentIssueDetail(documentId);
  const detail = detailQuery.data;
  const version = localVersion ?? detail?.version ?? null;

  const warehousesQuery = useQuery({
    queryKey: ["warranty", "component-issue-warehouse"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE" }),
    enabled: !documentId,
  });
  const warehouse = warehousesQuery.data?.[0];
  const skusQuery = useMvpSkus({
    sku_type: "COMPONENT",
    status: "ACTIVE",
    per_page: 100,
  });
  // Giữ nguyên tham chiếu mảng options giữa các lần render (mỗi ký tự gõ vào
  // form đều render lại cả modal) để danh sách chọn SKU không phải dựng lại.
  const skuOptions = useMemo(
    () =>
      (skusQuery.data?.data ?? []).map((sku) => ({
        value: sku.sku_id,
        label: `${sku.sku_code} · ${sku.sku_name}`,
      })),
    [skusQuery.data],
  );

  const createMutation = useCreateComponentIssue();
  const scanMutation = useScanComponentIssue();
  const cancelMutation = useCancelComponentIssue();
  const postMutation = usePostComponentIssue();

  useEffect(() => {
    if (!selectedLineId && detail?.lines.length) {
      const pending = detail.lines.find(
        (line) => line.scanned_qty < line.required_qty,
      );
      setSelectedLineId((pending ?? detail.lines[0]).id);
    }
  }, [detail, selectedLineId]);

  const allLinesComplete = useMemo(
    () =>
      Boolean(detail?.lines.length) &&
      (detail?.lines ?? []).every(
        (line) => line.scanned_qty === line.required_qty,
      ),
    [detail],
  );
  const isOpenDocument =
    detail?.status === "DRAFT" || detail?.status === "SCANNING";

  const updateDraftLine = (index: number, patch: Partial<DraftLineValue>) => {
    setDraftLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
    if (lineErrors[index]) {
      setLineErrors((current) => {
        const next = { ...current };
        const lineError = { ...next[index] };
        if (patch.sku_id !== undefined) delete lineError.sku_id;
        if (patch.required_qty !== undefined) delete lineError.required_qty;
        if (Object.keys(lineError).length > 0) {
          next[index] = lineError;
        } else {
          delete next[index];
        }
        return next;
      });
    }
  };

  const validateDraftLines = (): boolean => {
    const errors: Record<number, { sku_id?: string; required_qty?: string }> =
      {};
    draftLines.forEach((line, index) => {
      const lineError: { sku_id?: string; required_qty?: string } = {};
      if (!line.sku_id) {
        lineError.sku_id = "Chọn linh kiện.";
      }
      if (!line.required_qty || line.required_qty < 1) {
        lineError.required_qty = "Nhập số lượng.";
      }
      if (Object.keys(lineError).length > 0) {
        errors[index] = lineError;
      }
    });
    setLineErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateDraftLines()) return;
    if (!warehouse?.id) {
      toast.error("Chưa xác định được kho tổng ACTIVE.");
      return;
    }
    try {
      const created = await createMutation.mutateAsync({
        warehouse_id: String(warehouse.id),
        warranty_case_id: caseId,
        document_date: dayjs().format("YYYY-MM-DD"),
        note: draftNote.trim() || undefined,
        lines: draftLines
          .filter((line) => line.sku_id && line.required_qty)
          .map((line) => ({
            sku_id: String(line.sku_id),
            required_qty: Number(line.required_qty),
          })),
      });
      toast.success(
        `Đã tạo phiếu xuất linh kiện ${created.component_issue_no}.`,
      );
      setDocumentId(created.id);
      setLocalVersion(created.version);
      onChanged?.();
    } catch (error: unknown) {
      toast.error(errorText(error, "Không tạo được phiếu xuất linh kiện."));
    }
  };

  const handleScan = async (code: string) => {
    if (!detail || !documentId) return;
    const line = detail.lines.find((item) => item.id === selectedLineId);
    if (!line) {
      toast.warning("Chọn dòng linh kiện trước khi quét.");
      return;
    }
    if (version === null) return;
    try {
      const result = await scanMutation.mutateAsync({
        documentId,
        lineId: line.id,
        codeValue: code,
        quantity: scanQuantity,
        ifMatch: version,
      });
      setLocalVersion(result.version);
      setRecentCodes((current) => [code, ...current].slice(0, 30));
      toast.success(
        `Đã ghi nhận ${scanQuantity} × ${line.sku_code} (${result.scanned_qty}/${line.required_qty}).`,
      );
      onChanged?.();
    } catch (error: unknown) {
      toast.error(errorText(error, "Quét linh kiện thất bại."));
    }
  };

  const handleCancel = async () => {
    if (!documentId || version === null) return;
    if (!cancelReason.trim()) {
      toast.warning("Nhập lý do hủy phiếu.");
      return;
    }
    try {
      const result = await cancelMutation.mutateAsync({
        documentId,
        reason: cancelReason.trim(),
        ifMatch: version,
      });
      setLocalVersion(result.version);
      setCancelOpen(false);
      toast.success("Đã hủy phiếu xuất linh kiện.");
      onChanged?.();
    } catch (error: unknown) {
      toast.error(errorText(error, "Không hủy được phiếu."));
    }
  };

  const handlePost = async () => {
    if (!documentId || version === null) return;
    try {
      const result = await postMutation.mutateAsync({
        documentId,
        ifMatch: version,
        idempotencyKey: makeWarrantyIdempotencyKey(
          `component-post-${documentId}`,
        ),
      });
      setLocalVersion(result.version);
      setPostConfirmOpen(false);
      toast.success(
        `Đã Post phiếu xuất linh kiện — ${result.movement_ids.length} movement trừ tồn.`,
      );
      onChanged?.();
    } catch (error: unknown) {
      toast.error(errorText(error, "Post phiếu xuất linh kiện thất bại."));
    }
  };

  // Bấm vào dòng để chọn dòng quét; dòng đang chọn tô màu primary ở cột "#"
  // và SKU (ResponsiveDataTable không có highlight nền cả dòng như antd Table).
  const lineColumns: ResponsiveTableColumn<ComponentIssueLine>[] = [
    {
      key: "line_no",
      header: "#",
      width: 48,
      render: (line) => (
        <Box
          component="span"
          sx={
            line.id === selectedLineId
              ? { fontWeight: 600, color: "primary.main" }
              : undefined
          }
        >
          {(detail?.lines ?? []).findIndex((item) => item.id === line.id) + 1}
        </Box>
      ),
    },
    {
      key: "sku",
      header: "Linh kiện (COMPONENT)",
      render: (line) => (
        <Stack spacing={0}>
          <Box
            component="span"
            sx={{
              fontWeight: 600,
              color: line.id === selectedLineId ? "primary.main" : undefined,
            }}
          >
            {line.sku_code}
          </Box>
          <UiText variant="secondary">{line.sku_name}</UiText>
        </Stack>
      ),
    },
    {
      key: "progress",
      header: "Tiến độ quét",
      width: 140,
      render: (line) => (
        <UiStatusBadge
          tone={line.scanned_qty === line.required_qty ? "success" : "info"}
          label={`${line.scanned_qty} / ${line.required_qty}`}
        />
      ),
    },
    {
      key: "items",
      header: "Đã chọn",
      render: (line) => {
        const active = line.items.filter((item) => item.status !== "REMOVED");
        if (!active.length) return <UiText variant="secondary">—</UiText>;
        return (
          <Stack spacing={0}>
            {active.map((item) => (
              <UiText key={item.id} variant="caption">
                {item.item_id ? "Serial item" : "Box"} × {item.quantity}
              </UiText>
            ))}
          </Stack>
        );
      },
    },
  ];

  return (
    <UiDialog
      {...dialog.dialogProps}
      maxWidth="md"
      title={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box component="span">
            {documentId
              ? `Phiếu xuất linh kiện ${detail?.component_issue_no ?? ""}`
              : `Xuất linh kiện cho case ${caseCode ?? caseId}`}
          </Box>
          <ActionIconButton kind="close" label="Đóng" onClick={dialog.close} />
        </Box>
      }
      actions={
        <>
          <ActionButton kind="close" onClick={dialog.close}>
            Đóng
          </ActionButton>
          {documentId && isOpenDocument ? (
            <>
              <ActionButton
                kind="deactivate"
                disabled={!canIssue || cancelMutation.isPending}
                onClick={() => setCancelOpen(true)}
              >
                Hủy phiếu
              </ActionButton>
              <ActionButton
                kind="approve"
                disabled={
                  !canIssue || !allLinesComplete || postMutation.isPending
                }
                onClick={() => setPostConfirmOpen(true)}
              >
                Full Post (trừ tồn)
              </ActionButton>
            </>
          ) : null}
          {!documentId ? (
            <ActionButton
              kind="create"
              disabled={!canIssue || !caseActive || createMutation.isPending}
              onClick={() => void handleCreate()}
            >
              {createMutation.isPending ? "Đang tạo..." : "Tạo phiếu DRAFT"}
            </ActionButton>
          ) : null}
        </>
      }
    >
      <Stack spacing={2} sx={{ mt: 0.5 }}>
        {!caseActive && !documentId ? (
          <UiAlert tone="error">
            Warranty case không còn active (RETURNED/CANCELLED) — không được tạo
            phiếu xuất linh kiện.
          </UiAlert>
        ) : null}

        {!documentId ? (
          <Stack spacing={2}>
            <UiAlert tone="info">
              Phiếu xuất linh kiện chỉ phục vụ bảo hành (purpose=WARRANTY) và
              bắt buộc gắn với warranty case đang hoạt động. Tạo DRAFT chưa trừ
              tồn.
            </UiAlert>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box>
                  <UiText variant="caption">Kho xuất</UiText>
                </Box>
                <UiText variant="body">
                  {warehouse
                    ? `${String(warehouse.code ?? warehouse.warehouse_code ?? "")} · ${String(
                        warehouse.name ?? warehouse.warehouse_name ?? "",
                      )}`
                    : warehousesQuery.isLoading
                      ? "Đang tải..."
                      : "Không tìm thấy kho ACTIVE"}
                </UiText>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box>
                  <UiText variant="caption">Warranty case</UiText>
                </Box>
                <UiText variant="body">{caseCode ?? caseId}</UiText>
              </Grid>
            </Grid>

            <Stack spacing={1.25}>
              {/* Thêm/xóa dòng linh kiện chạy hiệu ứng trượt-mở/thu-gọn. */}
              <AnimatedList>
                {draftLines.map((line, index) => (
                  <AnimatedListItem key={line.key} gap={10}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        rowGap: 1,
                      }}
                    >
                      <UiTextField
                        select
                        required
                        label="SKU linh kiện (COMPONENT)"
                        placeholder="Chọn SKU linh kiện (COMPONENT)"
                        value={line.sku_id}
                        onChange={(event) =>
                          updateDraftLine(index, {
                            sku_id: event.target.value,
                          })
                        }
                        error={Boolean(lineErrors[index]?.sku_id)}
                        helperText={lineErrors[index]?.sku_id}
                        sx={{ minWidth: 360 }}
                      >
                        {skuOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </UiTextField>
                      <UiTextField
                        required
                        type="number"
                        label="SL cần"
                        value={line.required_qty ?? ""}
                        onChange={(event) =>
                          updateDraftLine(index, {
                            required_qty: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                        error={Boolean(lineErrors[index]?.required_qty)}
                        helperText={lineErrors[index]?.required_qty}
                        sx={{ width: 130 }}
                        slotProps={{ htmlInput: { min: 1 } }}
                      />
                      <ActionIconButton
                        kind="delete"
                        disabled={draftLines.length <= 1}
                        onClick={() =>
                          setDraftLines((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        sx={{ mt: "6px" }}
                      />
                    </Stack>
                  </AnimatedListItem>
                ))}
              </AnimatedList>
              <ActionButton
                kind="create"
                onClick={() =>
                  setDraftLines((current) => [...current, emptyDraftLine()])
                }
              >
                Thêm dòng linh kiện
              </ActionButton>
            </Stack>

            <UiTextField
              fullWidth
              multiline
              minRows={2}
              label="Ghi chú"
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <ApiErrorAlert
              error={detailQuery.error}
              title="Không tải được phiếu xuất linh kiện"
              onRetry={() => detailQuery.refetch()}
            />
            {detail ? (
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box>
                        <UiText variant="caption">Trạng thái</UiText>
                      </Box>
                      <UiStatusBadge
                        tone={STATUS_BADGE[detail.status].tone}
                        label={STATUS_BADGE[detail.status].label}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box>
                        <UiText variant="caption">Mục đích</UiText>
                      </Box>
                      <UiStatusBadge tone="info" label="WARRANTY" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box>
                        <UiText variant="caption">Ngày chứng từ</UiText>
                      </Box>
                      <UiText variant="body">
                        {detail.document_date || "—"}
                      </UiText>
                    </Grid>
                  </Grid>
                </Box>

                {detail.status === "CANCELLED" ? (
                  <UiAlert tone="warning">
                    {`Phiếu đã hủy${detail.cancel_reason ? ` — ${detail.cancel_reason}` : ""}. Tồn kho không đổi.`}
                  </UiAlert>
                ) : null}
                {detail.status === "POSTED" ? (
                  <UiAlert tone="success">
                    Phiếu đã POSTED — tồn linh kiện đã trừ và ghi movement
                    COMPONENT_ISSUE gắn với warranty case.
                  </UiAlert>
                ) : null}

                <ResponsiveDataTable<ComponentIssueLine>
                  columns={lineColumns}
                  rows={detail.lines}
                  rowKey={(line) => line.id}
                  onRowClick={(line) => setSelectedLineId(line.id)}
                />

                {isOpenDocument ? (
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 1.5,
                    }}
                  >
                    <Box sx={{ fontWeight: 700, mb: 1 }}>
                      Quét serial linh kiện hoặc box + số lượng
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        rowGap: 1,
                      }}
                    >
                      <UiTextField
                        type="number"
                        label="Số lượng quét"
                        value={scanQuantity}
                        onChange={(event) =>
                          setScanQuantity(Number(event.target.value) || 1)
                        }
                        sx={{ width: 90 }}
                        slotProps={{ htmlInput: { min: 1 } }}
                      />
                      <Box sx={{ flex: 1, minWidth: 220 }}>
                        <ScanInput
                          size="middle"
                          placeholder="Quét Barcode/QR serial linh kiện hoặc box code"
                          recentCodes={recentCodes}
                          disabled={!canIssue || scanMutation.isPending}
                          onScan={handleScan}
                        />
                      </Box>
                      <ActionButton
                        kind="camera"
                        onClick={() => setCameraOpen(true)}
                      >
                        Camera
                      </ActionButton>
                    </Stack>
                    <Box sx={{ mt: 1 }}>
                      <UiText variant="caption">
                        Serial item bắt buộc số lượng 1; box (SKU không serial)
                        nhập số lượng cần lấy. Quét chỉ ghi nhận, chưa trừ tồn
                        cho đến khi Post.
                      </UiText>
                    </Box>
                  </Box>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        )}
      </Stack>

      <UiDialog
        open={cancelOpen}
        onClose={guardBackdropClose(() => setCancelOpen(false))}
        maxWidth="xs"
        title="Hủy phiếu xuất linh kiện"
        actions={
          <>
            <ActionButton
              kind="back"
              onClick={() => setCancelOpen(false)}
              disabled={cancelMutation.isPending}
            >
              Quay lại
            </ActionButton>
            <ActionButton
              kind="confirm"
              onClick={() => void handleCancel()}
              disabled={cancelMutation.isPending}
            >
              Xác nhận hủy
            </ActionButton>
          </>
        }
      >
        <Box sx={{ mt: 0.5 }}>
          <UiTextField
            fullWidth
            multiline
            minRows={3}
            label="Lý do hủy (bắt buộc)"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
        </Box>
      </UiDialog>

      <UiDialog
        open={postConfirmOpen}
        onClose={() => setPostConfirmOpen(false)}
        maxWidth="xs"
        title="Full Post phiếu xuất linh kiện?"
        actions={
          <>
            <ActionButton
              kind="view"
              onClick={() => setPostConfirmOpen(false)}
              disabled={postMutation.isPending}
            >
              Xem lại
            </ActionButton>
            <ActionButton
              kind="send"
              onClick={() => void handlePost()}
              disabled={postMutation.isPending}
            >
              Post
            </ActionButton>
          </>
        }
      >
        <UiText variant="body">
          Tồn kho linh kiện sẽ bị trừ atomically (movement COMPONENT_ISSUE). Chỉ
          Post khi mọi dòng đã quét đủ số lượng.
        </UiText>
      </UiDialog>

      <CameraScanModal
        open={cameraOpen}
        title="Quét linh kiện / box"
        onDetected={(code) => {
          setCameraOpen(false);
          void handleScan(code.trim().toUpperCase());
        }}
        onClose={() => setCameraOpen(false)}
      />
    </UiDialog>
  );
}

export type { ComponentIssueDocument };
