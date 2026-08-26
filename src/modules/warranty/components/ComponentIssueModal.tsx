import { useEffect, useMemo, useState } from "react";
import { Table, Tag, Typography as AntTypography } from "antd";
import type { TableProps } from "antd";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import { toast } from "sonner";
import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  StopOutlined,
} from "@/shared/components/icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getApiErrorMessage, getErrorRequestId } from "@/shared/api/api-error";
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

interface DraftLineValue {
  sku_id: string;
  required_qty: number | null;
}

interface ComponentIssueModalProps {
  caseId: string;
  caseCode?: string;
  caseActive: boolean;
  documentId?: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const STATUS_TAG: Record<
  ComponentIssueStatus,
  { color: string; label: string }
> = {
  DRAFT: { color: "default", label: "DRAFT" },
  SCANNING: { color: "processing", label: "SCANNING" },
  POSTED: { color: "success", label: "POSTED" },
  CANCELLED: { color: "error", label: "CANCELLED" },
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

  const [draftLines, setDraftLines] = useState<DraftLineValue[]>([
    { sku_id: "", required_qty: null },
  ]);
  const [draftNote, setDraftNote] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

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
  const skuOptions = (skusQuery.data?.data ?? []).map((sku) => ({
    value: sku.sku_id,
    label: `${sku.sku_code} · ${sku.sku_name}`,
  }));

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
  };

  const handleCreate = async () => {
    for (const line of draftLines) {
      if (!line.sku_id) {
        setDraftError("Chọn linh kiện.");
        return;
      }
      if (!line.required_qty || line.required_qty < 1) {
        setDraftError("Nhập số lượng.");
        return;
      }
    }
    setDraftError(null);
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

  const lineColumns: TableProps<ComponentIssueLine>["columns"] = [
    {
      title: "#",
      key: "line_no",
      width: 48,
      render: (_, __, index) => index + 1,
    },
    {
      title: "Linh kiện (COMPONENT)",
      key: "sku",
      render: (_, line) => (
        <Stack spacing={0}>
          <AntTypography.Text strong>{line.sku_code}</AntTypography.Text>
          <AntTypography.Text type="secondary">{line.sku_name}</AntTypography.Text>
        </Stack>
      ),
    },
    {
      title: "Tiến độ quét",
      key: "progress",
      width: 140,
      render: (_, line) => (
        <Tag
          color={
            line.scanned_qty === line.required_qty ? "success" : "processing"
          }
        >
          {line.scanned_qty} / {line.required_qty}
        </Tag>
      ),
    },
    {
      title: "Đã chọn",
      key: "items",
      render: (_, line) => {
        const active = line.items.filter((item) => item.status !== "REMOVED");
        if (!active.length)
          return <AntTypography.Text type="secondary">—</AntTypography.Text>;
        return (
          <Stack spacing={0}>
            {active.map((item) => (
              <AntTypography.Text key={item.id} style={{ fontSize: 12 }}>
                {item.item_id ? "Serial item" : "Box"} × {item.quantity}
              </AntTypography.Text>
            ))}
          </Stack>
        );
      },
    },
  ];

  return (
    <ThemeProvider theme={muiTheme}>
      <Dialog
        open
        onClose={onClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          {documentId
            ? `Phiếu xuất linh kiện ${detail?.component_issue_no ?? ""}`
            : `Xuất linh kiện cho case ${caseCode ?? caseId}`}
          <IconButton
            aria-label="Đóng"
            onClick={onClose}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {!caseActive && !documentId ? (
              <Alert severity="error">
                Warranty case không còn active (RETURNED/CANCELLED) — không
                được tạo phiếu xuất linh kiện.
              </Alert>
            ) : null}

            {!documentId ? (
              <Stack spacing={2}>
                <Alert severity="info">
                  Phiếu xuất linh kiện chỉ phục vụ bảo hành (purpose=WARRANTY)
                  và bắt buộc gắn với warranty case đang hoạt động. Tạo DRAFT
                  chưa trừ tồn.
                </Alert>
                {draftError ? <Alert severity="error">{draftError}</Alert> : null}

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Kho xuất
                    </Typography>
                    <Typography variant="body2">
                      {warehouse
                        ? `${String(warehouse.code ?? warehouse.warehouse_code ?? "")} · ${String(
                            warehouse.name ?? warehouse.warehouse_name ?? "",
                          )}`
                        : warehousesQuery.isLoading
                          ? "Đang tải..."
                          : "Không tìm thấy kho ACTIVE"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Warranty case
                    </Typography>
                    <Typography variant="body2">{caseCode ?? caseId}</Typography>
                  </Grid>
                </Grid>

                <Stack spacing={1.25}>
                  {draftLines.map((line, index) => (
                    <Stack
                      key={`line-${index}`}
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: "flex-start", flexWrap: "wrap", rowGap: 1 }}
                    >
                      <TextField
                        select
                        required
                        label="SKU linh kiện (COMPONENT)"
                        placeholder="Chọn SKU linh kiện (COMPONENT)"
                        value={line.sku_id}
                        onChange={(event) =>
                          updateDraftLine(index, { sku_id: event.target.value })
                        }
                        sx={{ minWidth: 360 }}
                      >
                        {skuOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
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
                        sx={{ width: 130 }}
                        slotProps={{ htmlInput: { min: 1 } }}
                      />
                      <IconButton
                        color="error"
                        disabled={draftLines.length <= 1}
                        onClick={() =>
                          setDraftLines((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        sx={{ mt: "6px" }}
                      >
                        <DeleteOutlined />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button
                    variant="outlined"
                    startIcon={<PlusOutlined />}
                    onClick={() =>
                      setDraftLines((current) => [
                        ...current,
                        { sku_id: "", required_qty: null },
                      ])
                    }
                  >
                    Thêm dòng linh kiện
                  </Button>
                </Stack>

                <TextField
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
                    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            Trạng thái
                          </Typography>
                          <Tag color={STATUS_TAG[detail.status].color}>
                            {STATUS_TAG[detail.status].label}
                          </Tag>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            Mục đích
                          </Typography>
                          <Tag color="blue">WARRANTY</Tag>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            Ngày chứng từ
                          </Typography>
                          <Typography variant="body2">
                            {detail.document_date || "—"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>

                    {detail.status === "CANCELLED" ? (
                      <Alert severity="warning">
                        {`Phiếu đã hủy${detail.cancel_reason ? ` — ${detail.cancel_reason}` : ""}. Tồn kho không đổi.`}
                      </Alert>
                    ) : null}
                    {detail.status === "POSTED" ? (
                      <Alert severity="success">
                        Phiếu đã POSTED — tồn linh kiện đã trừ và ghi movement
                        COMPONENT_ISSUE gắn với warranty case.
                      </Alert>
                    ) : null}

                    <Table
                      dataSource={detail.lines}
                      columns={lineColumns}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      rowClassName={(line) =>
                        line.id === selectedLineId ? "ant-table-row-selected" : ""
                      }
                      onRow={(line) => ({
                        onClick: () => setSelectedLineId(line.id),
                      })}
                      scroll={{ x: "max-content" }}
                    />

                    {isOpenDocument ? (
                      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Quét serial linh kiện hoặc box + số lượng
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap", rowGap: 1 }}>
                          <TextField
                            type="number"
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
                          <Button
                            variant="outlined"
                            startIcon={<CameraOutlined />}
                            onClick={() => setCameraOpen(true)}
                          >
                            Camera
                          </Button>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          Serial item bắt buộc số lượng 1; box (SKU không
                          serial) nhập số lượng cần lấy. Quét chỉ ghi nhận,
                          chưa trừ tồn cho đến khi Post.
                        </Typography>
                      </Box>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            )}
          </Stack>

          <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Hủy phiếu xuất linh kiện</DialogTitle>
            <DialogContent dividers>
              <TextField
                fullWidth
                multiline
                minRows={3}
                placeholder="Lý do hủy (bắt buộc)"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCancelOpen(false)} disabled={cancelMutation.isPending}>
                Quay lại
              </Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => void handleCancel()}
                disabled={cancelMutation.isPending}
              >
                Xác nhận hủy
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={postConfirmOpen} onClose={() => setPostConfirmOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Full Post phiếu xuất linh kiện?</DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2">
                Tồn kho linh kiện sẽ bị trừ atomically (movement
                COMPONENT_ISSUE). Chỉ Post khi mọi dòng đã quét đủ số lượng.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPostConfirmOpen(false)} disabled={postMutation.isPending}>
                Xem lại
              </Button>
              <Button
                variant="contained"
                onClick={() => void handlePost()}
                disabled={postMutation.isPending}
              >
                Post
              </Button>
            </DialogActions>
          </Dialog>

          <CameraScanModal
            open={cameraOpen}
            title="Quét linh kiện / box"
            onDetected={(code) => {
              setCameraOpen(false);
              void handleScan(code.trim().toUpperCase());
            }}
            onClose={() => setCameraOpen(false)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Đóng</Button>
          {documentId && isOpenDocument ? (
            <>
              <Button
                color="error"
                variant="outlined"
                startIcon={<StopOutlined />}
                disabled={!canIssue || cancelMutation.isPending}
                onClick={() => setCancelOpen(true)}
              >
                Hủy phiếu
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckCircleOutlined />}
                disabled={!canIssue || !allLinesComplete || postMutation.isPending}
                onClick={() => setPostConfirmOpen(true)}
              >
                Full Post (trừ tồn)
              </Button>
            </>
          ) : null}
          {!documentId ? (
            <Button
              variant="contained"
              startIcon={<PlusOutlined />}
              disabled={!canIssue || !caseActive || createMutation.isPending}
              onClick={() => void handleCreate()}
            >
              {createMutation.isPending ? "Đang tạo..." : "Tạo phiếu DRAFT"}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export type { ComponentIssueDocument };
