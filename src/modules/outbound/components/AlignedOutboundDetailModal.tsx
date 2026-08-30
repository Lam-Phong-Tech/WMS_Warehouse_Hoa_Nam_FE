import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiDialog,
  UiStatusBadge,
  UiTextField,
  useUiConfirm,
} from "@/shared/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  classifyPostIssueError,
  shouldReuseIdempotencyKey,
} from "@/shared/api/post-issue-contract";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { DocumentAttachmentsPanel } from "@/shared/components/DocumentAttachmentsPanel";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { useHasPermission } from "@/shared/components/permission";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import {
  OUTBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
  assignRfidToItem,
  cancelOutboundDocument,
  createPackingLabel,
  fetchAvailableQtyBySku,
  fetchOutboundDetail,
  fetchPackingLabels,
  fetchPrinterConfigs,
  postOutboundIssue,
  previewPackingLabel,
  printLabelSnapshot,
  readyPackingLabel,
  reprintLabelSnapshot,
  scanOutboundItem,
  unmatchOutboundItem,
  type IssueEvidence,
  type OutboundItemMatchRecord,
  type OutboundLineRecord,
  type PackingLabelRecord,
} from "@/modules/outbound/services/alignedOutboundService";
import type { ReactNode } from "react";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { PackingLabelPreviewDialog } from "@/modules/outbound/components/PackingLabelPreviewDialog";

type RfidTarget = { itemId: string; itemCode: string };

/** Lý do in lại nhãn thường gặp (mục 9) + "Khác" cho phép nhập tay. */
const REPRINT_REASONS = [
  "Máy in hết mực",
  "Lỗi máy in",
  "Nhãn bị hỏng / rách",
  "In lại chứng từ",
  "Khác",
] as const;

interface Props {
  documentId: string;
  onClose: () => void;
  onChanged?: () => void;
}

function makeKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function short(value?: string | null): string {
  if (!value) return "-";
  return value.length > 18 ? `${value.slice(0, 14)}…` : value;
}

function labelStatus(value?: string | null): string {
  const labels: Record<string, string> = {
    DRAFT: "Nháp",
    PENDING_PRINT: "Chờ chuẩn bị",
    PREVIEWED: "Đã xem trước",
    READY_TO_PRINT: "Sẵn sàng in",
    PRINTED: "Đã in",
    PRINT_FAILED: "In thất bại",
  };
  return value ? (labels[value] ?? value) : "Chưa tạo";
}

/** Khung viền section dùng chung trong modal (thay Box sx lặp lại). */
const SECTION_SX = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  p: 2,
} as const;

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

/**
 * GĐ1: Quét đủ -> Ghi nhận xuất kho & In nhãn -> Post Issue trừ tồn đúng một
 * lần -> chuẩn bị preview nhãn. In/in lại là thao tác vận hành độc lập và không
 * tồn tại trạng thái nghiệp vụ "đã dán".
 */
export function AlignedOutboundDetailModal({
  documentId,
  onClose,
  onChanged,
}: Props) {
  const can = useHasPermission();
  // Bước "chuẩn bị nhãn" (tạo snapshot -> preview -> ready) là một chuỗi API
  // riêng với bộ quyền riêng, không đi kèm outbound.post. Tách cờ ra để nút và
  // luồng sau khi Post nói đúng những gì người dùng thực sự làm được.
  const canPrepareLabel =
    WMS_ACTION_PERMISSIONS.PACKING_LABEL_PREVIEW.some(can) ||
    WMS_ACTION_PERMISSIONS.PACKING_LABEL_READY.some(can);
  const dialog = useDialogExit(onClose);
  const queryClient = useQueryClient();
  const [version, setVersion] = useState<number | null>(null);
  const [lineId, setLineId] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Lý do in lại nhãn (mục 9): bắt buộc chọn trước khi reprint.
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintReasonKey, setReprintReasonKey] = useState("");
  const [reprintReasonNote, setReprintReasonNote] = useState("");
  const [rfidTarget, setRfidTarget] = useState<RfidTarget | null>(null);
  const [rfidCode, setRfidCode] = useState("");
  const [rfidHardwareUid, setRfidHardwareUid] = useState("");
  const [evidence, setEvidence] = useState<IssueEvidence | null>(null);
  const [preparedLabel, setPreparedLabel] = useState<PackingLabelRecord | null>(
    null,
  );
  const [labelWarning, setLabelWarning] = useState<string | null>(null);
  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const postKeyRef = useRef<string | null>(null);
  // Xác nhận trước khi gỡ đối chiếu — confirmDialog PHẢI render trong cây bên dưới.
  const { confirm, confirmDialog } = useUiConfirm();

  const detailQuery = useQuery({
    queryKey: ["mvp-outbound", "detail", documentId],
    queryFn: () => fetchOutboundDetail(documentId),
  });
  const labelQuery = useQuery({
    queryKey: ["mvp-outbound", "packing-labels"],
    queryFn: fetchPackingLabels,
  });
  const printerQuery = useQuery({
    queryKey: ["mvp-outbound", "printers"],
    queryFn: fetchPrinterConfigs,
  });

  const detail = detailQuery.data;
  const doc = detail?.document;
  const lineSkuIds = useMemo(
    () => [
      ...new Set(
        (detail?.lines ?? []).map((line) => line.productId).filter(Boolean),
      ),
    ],
    [detail],
  );
  const availabilityQuery = useQuery({
    queryKey: ["mvp-outbound", "availability", documentId, lineSkuIds],
    enabled: lineSkuIds.length > 0,
    retry: false,
    queryFn: () => fetchAvailableQtyBySku(lineSkuIds),
  });

  const activeMatches = useMemo(
    () =>
      (detail?.itemMatches ?? []).filter((match) => match.status !== "REMOVED"),
    [detail],
  );
  const serverLabel = useMemo(
    () =>
      (labelQuery.data ?? []).find(
        (label) => label.documentId === documentId,
      ) ?? null,
    [documentId, labelQuery.data],
  );
  const packingLabel = preparedLabel ?? serverLabel;
  const activePrinters = (printerQuery.data ?? []).filter(
    (printer) => printer.status === "ACTIVE",
  );

  useEffect(() => {
    if (!detail) return;
    setVersion(detail.document.version);
    if (
      lineId &&
      !detail.lines.some(
        (line) => line.id === lineId && line.scanned < line.expected,
      )
    ) {
      setLineId("");
    }
  }, [detail, lineId]);

  useEffect(() => {
    postKeyRef.current = null;
    setPreparedLabel(null);
    setLabelWarning(null);
  }, [documentId]);

  useEffect(() => {
    if (!printerId && activePrinters[0]?.id) {
      setPrinterId(activePrinters[0].id);
    }
  }, [activePrinters, printerId]);

  const totalExpected =
    detail?.lines.reduce((sum, line) => sum + line.expected, 0) ?? 0;
  const totalScanned =
    detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const fullScan = Boolean(
    detail?.lines.length &&
    detail.lines.every(
      (line) => line.expected > 0 && line.scanned === line.expected,
    ),
  );
  const mutable = doc?.status === "DRAFT" || doc?.status === "SCANNING";
  const posted = doc?.status === "POSTED";
  const customerPhoneValid =
    customerPhone === "" || /^0\d{9}$/.test(customerPhone);
  const availability = availabilityQuery.data ?? {};
  // Chỉ có ý nghĩa TRƯỚC khi ghi nhận xuất kho ("sắp xuất, tồn có đủ không?").
  // Sau khi POSTED, tồn kho đã bị trừ đúng bằng số đã xuất nên tồn khả dụng
  // giảm là kết quả bình thường, không phải cảnh báo thiếu hàng.
  const shortStockLines = posted
    ? []
    : (detail?.lines ?? []).filter(
        (line) =>
          availabilityQuery.isSuccess &&
          (availability[line.productId] ?? 0) < line.expected,
      );

  const postBlockReason = !doc
    ? ""
    : !doc.outboundRequestId
      ? "Phiếu thiếu yêu cầu xuất nguồn."
      : !fullScan
        ? `Chưa quét đủ: ${totalScanned}/${totalExpected}.`
        : doc.status !== "SCANNING"
          ? "Phiếu không ở trạng thái sẵn sàng ghi nhận xuất kho."
          : !customerPhoneValid
            ? "Số điện thoại phải để trống hoặc gồm 10 chữ số, bắt đầu bằng 0."
            : "";
  const postReady = Boolean(doc && !postBlockReason);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "detail", documentId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "packing-labels"],
      }),
      queryClient.invalidateQueries({ queryKey: ["mvp-outbound", "list"] }),
    ]);
    onChanged?.();
  };

  const prepareLabel = async (
    existing?: PackingLabelRecord | null,
  ): Promise<PackingLabelRecord> => {
    let label = existing ?? packingLabel;
    if (!label) {
      label = await createPackingLabel({ documentId, customerPhone });
    }
    if (["DRAFT", "PENDING_PRINT"].includes(label.status)) {
      label = await previewPackingLabel({
        documentId,
        labelId: label.id,
        ifMatch: label.version,
      });
    }
    if (label.status === "PREVIEWED") {
      label = await readyPackingLabel({
        documentId,
        labelId: label.id,
        ifMatch: label.version,
        idempotencyKey: makeKey(`label-ready-${label.id}`),
      });
    }
    setPreparedLabel(label);
    return label;
  };

  const scanMutation = useMutation({
    mutationFn: async (input: {
      rawCode: string;
      scanSource: "CAMERA" | "MANUAL";
    }) => {
      const codeValue = input.rawCode.trim();
      if (!detail || !codeValue) {
        throw new Error("Nhập hoặc quét mã sản phẩm trước.");
      }
      return scanOutboundItem({
        documentId,
        lineId: lineId || undefined,
        codeValue,
        scanSource: input.scanSource,
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async (result) => {
      setVersion(result.version || null);
      setScanCode("");
      toast.success("Đã đối chiếu sản phẩm.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Quét/đối chiếu thất bại.")),
  });

  const unmatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      if (!detail) throw new Error("Chưa tải phiếu.");
      return unmatchOutboundItem({
        documentId,
        matchId,
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async (result) => {
      setVersion(result.version || null);
      toast.success("Đã gỡ sản phẩm khỏi danh sách đối chiếu.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Gỡ đối chiếu thất bại.")),
  });

  const postAndLabelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !postReady) {
        throw new Error(postBlockReason || "Phiếu chưa sẵn sàng.");
      }
      const idempotencyKey =
        postKeyRef.current ?? makeKey(`post-issue-${documentId}`);
      postKeyRef.current = idempotencyKey;
      return postOutboundIssue({
        documentId,
        ifMatch: version ?? detail.document.version,
        idempotencyKey,
      });
    },
    onSuccess: async (result) => {
      postKeyRef.current = null;
      setEvidence(result);
      setVersion(result.version || null);
      setLabelWarning(null);
      // Không cố chuẩn bị nhãn khi người dùng không có quyền nhãn: bước này gọi
      // POST /label-snapshots + preview + ready (label.print / packing_label.*).
      // WAREHOUSE_APPROVER có outbound.post nhưng không có nhóm quyền nhãn, nên
      // trước đây MỌI lần xuất kho của vai này đều kết thúc bằng cảnh báo
      // "chưa chuẩn bị được nhãn" — đúng về kỹ thuật nhưng đọc như một lỗi.
      if (!canPrepareLabel) {
        toast.success(
          result.replayed
            ? "Phiếu đã được ghi nhận trước đó."
            : "Đã ghi nhận xuất kho. Việc in nhãn do người có quyền in thực hiện.",
        );
        await refresh();
        return;
      }
      try {
        await prepareLabel();
        toast.success(
          result.replayed
            ? "Phiếu đã được ghi nhận trước đó. Nhãn đã sẵn sàng để in."
            : "Đã ghi nhận xuất kho. Nhãn đã sẵn sàng để xem và in.",
        );
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Xuất kho đã thành công nhưng chưa chuẩn bị được nhãn. Có thể thử tạo nhãn lại; tồn kho không bị rollback.",
        );
        setLabelWarning(message);
        toast.warning(message);
      }
      await refresh();
    },
    onError: async (error) => {
      if (!shouldReuseIdempotencyKey(error)) postKeyRef.current = null;
      const outcome = classifyPostIssueError(error);
      toast.error(
        outcome?.message ??
          getApiErrorMessage(error, "Ghi nhận xuất kho thất bại."),
      );
      if (outcome !== null) await refresh();
    },
  });

  const labelPrepareMutation = useMutation({
    mutationFn: () => prepareLabel(),
    onSuccess: async () => {
      setLabelWarning(null);
      toast.success("Nhãn đã sẵn sàng để in.");
      await refresh();
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Không chuẩn bị được nhãn.");
      setLabelWarning(message);
      toast.error(message);
    },
  });

  const printMutation = useMutation({
    mutationFn: async (reprintReason?: string) => {
      if (!printerId) throw new Error("Chọn máy in đang hoạt động.");
      let label = packingLabel;
      if (
        !label ||
        !["READY_TO_PRINT", "PRINT_FAILED", "PRINTED"].includes(label.status)
      ) {
        label = await prepareLabel(label);
      }
      const payload = {
        documentId,
        labelId: label.id,
        printerConfigId: printerId,
        ifMatch: label.version,
        idempotencyKey: makeKey(`label-print-${label.id}`),
      };
      // In lại (nhãn đã PRINTED) phải kèm lý do để BE ghi vào nhật ký in.
      return label.status === "PRINTED"
        ? reprintLabelSnapshot({ ...payload, reason: reprintReason })
        : printLabelSnapshot(payload);
    },
    onSuccess: async () => {
      toast.success("Đã gửi lệnh in nhãn.");
      setPreparedLabel(null);
      setReprintOpen(false);
      setReprintReasonKey("");
      setReprintReasonNote("");
      await refresh();
    },
    onError: async (error) => {
      toast.error(
        `${getApiErrorMessage(error, "In nhãn thất bại.")} Phiếu xuất kho vẫn giữ trạng thái đã ghi nhận.`,
      );
      // BE bump version của label_snapshot kể cả khi PRINT_FAILED; giữ preparedLabel
      // cũ sẽ làm lần in lại kế tiếp gửi If-Match version lỗi thời → 412.
      setPreparedLabel(null);
      await refresh();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !cancelReason.trim()) throw new Error("Nhập lý do hủy.");
      return cancelOutboundDocument(
        documentId,
        cancelReason.trim(),
        version ?? detail.document.version,
      );
    },
    onSuccess: async () => {
      toast.success("Đã hủy phiếu xuất.");
      setCancelOpen(false);
      await refresh();
      dialog.close();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Hủy phiếu thất bại.")),
  });

  const rfidMutation = useMutation({
    mutationFn: async () => {
      if (!rfidTarget || !detail) throw new Error("Chưa chọn sản phẩm.");
      if (!rfidCode.trim() || !rfidHardwareUid.trim()) {
        throw new Error("Nhập đủ mã RFID và hardware UID.");
      }
      return assignRfidToItem({
        documentId,
        itemId: rfidTarget.itemId,
        codeValue: rfidCode.trim(),
        hardwareUid: rfidHardwareUid.trim(),
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async () => {
      toast.success("Đã gán RFID cho sản phẩm.");
      setRfidTarget(null);
      setRfidCode("");
      setRfidHardwareUid("");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Gán RFID thất bại.")),
  });

  // Gỡ đối chiếu là thao tác không hoàn tác được bằng nút bấm: muốn tính lại
  // vào phiếu phải quét lại sản phẩm thật — bắt buộc xác nhận trước khi gọi server.
  const handleUnmatch = async (match: OutboundItemMatchRecord) => {
    const accepted = await confirm({
      title: "Gỡ sản phẩm khỏi đối chiếu?",
      content:
        "Sản phẩm sẽ bị gỡ khỏi danh sách đối chiếu của phiếu xuất. Muốn tính lại vào phiếu, bạn phải quét lại sản phẩm đó.",
      confirmText: "Gỡ",
      cancelText: "Hủy",
      tone: "danger",
    });
    if (!accepted) return;
    unmatchMutation.mutate(match.id);
  };

  const lineColumns: ResponsiveTableColumn<OutboundLineRecord>[] = [
    {
      key: "productId",
      header: "SKU",
      width: 180,
      render: (row) => row.skuCode ?? short(row.productId),
    },
    {
      key: "expected",
      header: "Cần xuất",
      width: 100,
      align: "right",
      render: (row) => row.expected,
    },
    {
      key: "scanned",
      header: "Đã quét",
      width: 100,
      align: "right",
      render: (row) => row.scanned,
    },
  ];

  const matchColumns: ResponsiveTableColumn<OutboundItemMatchRecord>[] = [
    {
      key: "item",
      header: "Sản phẩm",
      render: (match) =>
        match.itemCode || match.serialNumber || short(match.itemId),
    },
    {
      key: "rfidCode",
      header: "RFID",
      width: 150,
      render: (match) => match.rfidCode || "—",
    },
    {
      key: "actions",
      header: "",
      mobileLabel: "Thao tác",
      width: 190,
      render: (match) => (
        <Stack direction="row" spacing={0.5}>
          {mutable && can("outbound.scan") ? (
            <ActionButton
              kind="delete"
              onClick={() => void handleUnmatch(match)}
            >
              Gỡ
            </ActionButton>
          ) : null}
          {match.itemId && can("physical_code.assign_rfid") ? (
            <ActionButton
              kind="rfid"
              onClick={() =>
                setRfidTarget({
                  itemId: match.itemId as string,
                  itemCode:
                    match.itemCode || match.serialNumber || short(match.itemId),
                })
              }
            >
              RFID
            </ActionButton>
          ) : null}
        </Stack>
      ),
    },
  ];

  if (detailQuery.isLoading) {
    return (
      <UiDialog
        {...dialog.dialogProps}
        maxWidth="sm"
        fullWidth
        title="Chi tiết phiếu xuất"
      >
        Đang tải...
      </UiDialog>
    );
  }

  if (detailQuery.isError || !detail || !doc) {
    return (
      <UiDialog
        {...dialog.dialogProps}
        maxWidth="sm"
        fullWidth
        title="Chi tiết phiếu xuất"
      >
        <UiAlert tone="error">
          {getApiErrorMessage(detailQuery.error, "Không tải được phiếu xuất.")}
        </UiAlert>
      </UiDialog>
    );
  }

  return (
    <>
      <UiDialog
        {...dialog.dialogProps}
        maxWidth="lg"
        fullWidth
        title={
          <Box
            component="span"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            Chi tiết phiếu xuất
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={dialog.close}
            />
          </Box>
        }
      >
        <Stack spacing={2}>
          <Box sx={SECTION_SX}>
            <Grid container spacing={2}>
              <DetailField label="Phiếu" value={doc.code} />
              <DetailField
                label="Trạng thái"
                value={
                  <UiStatusBadge
                    label={businessLabel(OUTBOUND_STATUS_LABELS, doc.status)}
                  />
                }
              />
              <DetailField label="Nơi nhận" value={doc.recipientName || "—"} />
              <DetailField
                label="Đã quét"
                value={`${totalScanned}/${totalExpected}`}
              />
            </Grid>
          </Box>

          <Box sx={SECTION_SX}>
            <DocumentAttachmentsPanel
              documentType="OUTBOUND"
              documentId={documentId}
              disabled={!mutable}
            />
          </Box>

          <Box sx={SECTION_SX}>
            <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
              1 · Quét và đối chiếu hàng
            </Box>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ flexWrap: "wrap", rowGap: 1 }}
              >
                <UiTextField
                  select
                  sx={{ width: 300 }}
                  label="Tự nhận SKU từ mã quét"
                  value={lineId}
                  onChange={(event) => setLineId(event.target.value)}
                >
                  <MenuItem value="">Tự nhận SKU từ mã quét</MenuItem>
                  {detail.lines
                    .filter((line) => line.scanned < line.expected)
                    .map((line) => (
                      <MenuItem key={line.id} value={line.id}>
                        {`${line.skuCode ?? short(line.productId)} · ${line.scanned}/${line.expected}`}
                      </MenuItem>
                    ))}
                </UiTextField>
                <UiTextField
                  sx={{ width: 330 }}
                  value={scanCode}
                  label="Quét QR/Barcode sản phẩm"
                  placeholder="Quét QR/Barcode sản phẩm"
                  onChange={(event) => setScanCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      scanMutation.mutate({
                        rawCode: scanCode,
                        scanSource: "MANUAL",
                      });
                    }
                  }}
                  disabled={!mutable || !can("outbound.scan")}
                />
                <ActionButton
                  kind="scan"
                  disabled={
                    !mutable ||
                    !can("outbound.scan") ||
                    !scanCode.trim() ||
                    scanMutation.isPending
                  }
                  onClick={() =>
                    scanMutation.mutate({
                      rawCode: scanCode,
                      scanSource: "MANUAL",
                    })
                  }
                >
                  {scanMutation.isPending ? "Đang quét..." : "Quét"}
                </ActionButton>
                <ActionButton
                  kind="camera"
                  disabled={!mutable || !can("outbound.scan")}
                  onClick={() => setCameraOpen(true)}
                >
                  Camera
                </ActionButton>
              </Stack>
              <ResponsiveDataTable<OutboundLineRecord>
                columns={lineColumns}
                rows={detail.lines}
                rowKey={(row) => row.id}
                loading={detailQuery.isFetching}
                emptyText="Phiếu chưa có dòng hàng cần xuất."
              />
              <ResponsiveDataTable<OutboundItemMatchRecord>
                columns={matchColumns}
                rows={activeMatches}
                rowKey={(row) => row.id}
                loading={detailQuery.isFetching}
                emptyText="Chưa đối chiếu sản phẩm nào — quét mã sản phẩm để bắt đầu."
              />
            </Stack>
          </Box>

          <Box sx={SECTION_SX}>
            <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
              2 · Ghi nhận xuất kho & In nhãn
            </Box>
            <Stack spacing={1.5}>
              {shortStockLines.length ? (
                <UiAlert
                  tone="warning"
                  title="Tồn khả dụng hiện thấp hơn số lượng cần xuất"
                >
                  {`SKU thiếu: ${shortStockLines
                    .map((line) => line.skuCode ?? short(line.productId))
                    .join(
                      ", ",
                    )}. Hệ thống sẽ kiểm tra lại tại thời điểm ghi nhận.`}
                </UiAlert>
              ) : null}
              {!posted ? (
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
                >
                  <UiTextField
                    sx={{ width: 260 }}
                    value={customerPhone}
                    label="SĐT trên nhãn (tùy chọn)"
                    placeholder="SĐT trên nhãn (tùy chọn)"
                    slotProps={{ htmlInput: { maxLength: 10 } }}
                    onChange={(event) =>
                      setCustomerPhone(
                        event.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    error={!customerPhoneValid}
                  />
                  <ActionButton
                    kind="print"
                    disabled={
                      !can("outbound.post") ||
                      !postReady ||
                      postAndLabelMutation.isPending
                    }
                    onClick={() => setPostConfirmOpen(true)}
                  >
                    {canPrepareLabel
                      ? "Ghi nhận xuất kho & In nhãn"
                      : "Ghi nhận xuất kho"}
                  </ActionButton>
                  {can("outbound.cancel") && mutable ? (
                    <ActionButton
                      kind="cancel"
                      onClick={() => setCancelOpen(true)}
                    >
                      Hủy phiếu
                    </ActionButton>
                  ) : null}
                </Stack>
              ) : (
                <UiAlert tone="success" title="Phiếu đã ghi nhận xuất kho">
                  Tồn kho đã được trừ. Việc in/in lại nhãn không làm thay đổi
                  tồn kho.
                </UiAlert>
              )}
              {postBlockReason && !posted ? (
                <Box sx={{ typography: "body2", color: "text.secondary" }}>
                  {postBlockReason}
                </Box>
              ) : null}
              {evidence ? (
                <Box
                  sx={{
                    typography: "body2",
                    color: "text.secondary",
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  {evidence.movementRefs.length} movement · Request
                  {evidence.requestId ? (
                    <CopyableId value={evidence.requestId} />
                  ) : (
                    "—"
                  )}
                </Box>
              ) : null}
            </Stack>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Box sx={SECTION_SX}>
                <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
                  3 · Xem và in nhãn
                </Box>
                <Stack spacing={1.5}>
                  {labelWarning ? (
                    <UiAlert tone="warning">{labelWarning}</UiAlert>
                  ) : null}
                  {!posted ? (
                    <Box sx={{ typography: "body2", color: "text.secondary" }}>
                      Nhãn được chuẩn bị sau khi ghi nhận xuất kho.
                    </Box>
                  ) : packingLabel ? (
                    <>
                      <Grid container spacing={2}>
                        <DetailField
                          label="Mã nhãn"
                          value={packingLabel.labelCode}
                        />
                        <DetailField
                          label="Trạng thái"
                          value={labelStatus(packingLabel.status)}
                        />
                        <DetailField
                          label="Nơi nhận"
                          value={
                            packingLabel.recipientName ||
                            doc.recipientName ||
                            "—"
                          }
                        />
                        <DetailField
                          label="Số sản phẩm"
                          value={packingLabel.itemCount}
                        />
                        <DetailField
                          label="Số SKU"
                          value={packingLabel.skuCount}
                        />
                        <DetailField
                          label="Toa nguồn"
                          value={packingLabel.sourceRequestNo || "—"}
                        />
                      </Grid>
                      <Box>
                        <ActionButton
                          kind="view"
                          onClick={() => setLabelPreviewOpen(true)}
                        >
                          Xem trước nhãn
                        </ActionButton>
                      </Box>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{
                          flexWrap: "wrap",
                          rowGap: 1,
                          alignItems: "center",
                        }}
                      >
                        {/*
                         * CỐ Ý KHÔNG dùng slotProps.select.native: native:true trả về
                         * <select>/<option> thuần nên trình duyệt vẽ menu theo kiểu
                         * hệ điều hành — bung ra tức thì, phông và màu highlight
                         * khác hẳn phần còn lại của app. Select bên trong UiTextField
                         * dùng menu React (có hiệu ứng Grow theo theme adapter) và ăn theme.
                         */}
                        <UiTextField
                          select
                          label="Máy in"
                          sx={{ width: 280 }}
                          value={printerId}
                          onChange={(event) => setPrinterId(event.target.value)}
                        >
                          <MenuItem value="" disabled>
                            Chọn máy in
                          </MenuItem>
                          {activePrinters.map((printer) => (
                            <MenuItem key={printer.id} value={printer.id}>
                              {`${printer.code} · ${printer.name}`}
                            </MenuItem>
                          ))}
                        </UiTextField>
                        <ActionButton
                          kind="print"
                          disabled={
                            !printerId ||
                            (!can("packing_label.print") &&
                              !can("label.print") &&
                              !can("packing_label.reprint") &&
                              !can("label.reprint")) ||
                            printMutation.isPending
                          }
                          onClick={() => {
                            // In lại phải nhập lý do trước; in lần đầu thì gửi ngay.
                            if (packingLabel.status === "PRINTED") {
                              setReprintReasonKey("");
                              setReprintReasonNote("");
                              setReprintOpen(true);
                            } else {
                              printMutation.mutate(undefined);
                            }
                          }}
                        >
                          {printMutation.isPending
                            ? "Đang gửi lệnh in..."
                            : packingLabel.status === "PRINTED"
                              ? "In lại nhãn"
                              : "In nhãn"}
                        </ActionButton>
                      </Stack>
                    </>
                  ) : (
                    <Box>
                      <ActionButton
                        kind="print"
                        disabled={labelPrepareMutation.isPending}
                        onClick={() => labelPrepareMutation.mutate()}
                      >
                        {labelPrepareMutation.isPending
                          ? "Đang chuẩn bị..."
                          : "Chuẩn bị lại nhãn"}
                      </ActionButton>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Box sx={SECTION_SX}>
                <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
                  RFID (tùy chọn)
                </Box>
                <Box sx={{ typography: "body2", color: "text.secondary" }}>
                  Có thể gán RFID cho từng sản phẩm nếu vận hành sử dụng. RFID
                  không phải điều kiện để ghi nhận xuất kho.
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Stack>

        <CameraScanModal
          open={cameraOpen}
          title="Quét sản phẩm xuất kho"
          onDetected={(code) => {
            setCameraOpen(false);
            scanMutation.mutate({ rawCode: code, scanSource: "CAMERA" });
          }}
          onClose={() => setCameraOpen(false)}
        />

        <UiDialog
          open={postConfirmOpen}
          onClose={() => setPostConfirmOpen(false)}
          maxWidth="xs"
          fullWidth
          title="Ghi nhận xuất kho & In nhãn?"
          actions={
            <>
              <ActionButton
                kind="cancel"
                onClick={() => setPostConfirmOpen(false)}
                disabled={postAndLabelMutation.isPending}
              >
                Hủy
              </ActionButton>
              <ActionButton
                kind="confirm"
                disabled={postAndLabelMutation.isPending}
                onClick={() =>
                  postAndLabelMutation
                    .mutateAsync()
                    .then(() => setPostConfirmOpen(false))
                }
              >
                {postAndLabelMutation.isPending
                  ? "Đang ghi nhận..."
                  : "Ghi nhận"}
              </ActionButton>
            </>
          }
        >
          <Box sx={{ typography: "body2" }}>
            Tồn kho sẽ được trừ ngay khi ghi nhận. Sau đó hệ thống chuẩn bị bản
            xem trước nhãn để in.
          </Box>
        </UiDialog>

        <UiDialog
          open={cancelOpen}
          onClose={guardBackdropClose(() => setCancelOpen(false))}
          maxWidth="xs"
          fullWidth
          title="Hủy phiếu xuất"
          actions={
            <>
              <ActionButton kind="close" onClick={() => setCancelOpen(false)}>
                Đóng
              </ActionButton>
              <ActionButton
                kind="cancel"
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? "Đang hủy..." : "Hủy phiếu"}
              </ActionButton>
            </>
          }
        >
          <UiTextField
            fullWidth
            multiline
            minRows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            label="Lý do hủy"
            placeholder="Lý do hủy"
          />
        </UiDialog>

        <UiDialog
          open={reprintOpen}
          onClose={guardBackdropClose(() => setReprintOpen(false))}
          maxWidth="xs"
          fullWidth
          title="Lý do in lại nhãn"
          actions={
            <>
              <ActionButton kind="close" onClick={() => setReprintOpen(false)}>
                Đóng
              </ActionButton>
              <ActionButton
                kind="print"
                disabled={
                  printMutation.isPending ||
                  !reprintReasonKey ||
                  (reprintReasonKey === "Khác" && !reprintReasonNote.trim())
                }
                onClick={() => {
                  const reason =
                    reprintReasonKey === "Khác"
                      ? reprintReasonNote.trim()
                      : reprintReasonKey;
                  printMutation.mutate(reason);
                }}
              >
                {printMutation.isPending
                  ? "Đang gửi lệnh in..."
                  : "In lại nhãn"}
              </ActionButton>
            </>
          }
        >
          <Stack spacing={2}>
            <UiAlert tone="info">
              Ghi lý do in lại để lưu vào nhật ký in — không làm thay đổi tồn
              kho.
            </UiAlert>
            <UiTextField
              select
              fullWidth
              value={reprintReasonKey}
              onChange={(event) => setReprintReasonKey(event.target.value)}
              label="Lý do in lại"
            >
              <MenuItem value="" disabled>
                Chọn lý do
              </MenuItem>
              {REPRINT_REASONS.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {reason}
                </MenuItem>
              ))}
            </UiTextField>
            {reprintReasonKey === "Khác" ? (
              <UiTextField
                fullWidth
                multiline
                minRows={2}
                value={reprintReasonNote}
                onChange={(event) => setReprintReasonNote(event.target.value)}
                label="Nhập lý do cụ thể"
                placeholder="Nhập lý do in lại"
              />
            ) : null}
          </Stack>
        </UiDialog>

        <UiDialog
          open={Boolean(rfidTarget)}
          onClose={guardBackdropClose(() => setRfidTarget(null))}
          maxWidth="xs"
          fullWidth
          title={`Gán RFID · ${rfidTarget?.itemCode ?? ""}`}
          actions={
            <>
              <ActionButton kind="close" onClick={() => setRfidTarget(null)}>
                Đóng
              </ActionButton>
              <ActionButton
                kind="rfid"
                disabled={
                  rfidMutation.isPending ||
                  !rfidCode.trim() ||
                  !rfidHardwareUid.trim()
                }
                onClick={() => rfidMutation.mutate()}
              >
                {rfidMutation.isPending ? "Đang gán..." : "Gán RFID"}
              </ActionButton>
            </>
          }
        >
          <Stack spacing={2}>
            <UiTextField
              fullWidth
              value={rfidCode}
              onChange={(event) => setRfidCode(event.target.value)}
              label="Mã RFID"
              placeholder="Mã RFID"
            />
            <UiTextField
              fullWidth
              value={rfidHardwareUid}
              onChange={(event) => setRfidHardwareUid(event.target.value)}
              label="Mã thiết bị (UID)"
              placeholder="Nhập mã thiết bị"
            />
          </Stack>
        </UiDialog>
      </UiDialog>

      <PackingLabelPreviewDialog
        open={labelPreviewOpen}
        label={packingLabel ?? null}
        onClose={() => setLabelPreviewOpen(false)}
      />

      {confirmDialog}
    </>
  );
}
