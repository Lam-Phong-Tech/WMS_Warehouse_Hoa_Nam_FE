import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiAutocomplete,
  UiDialog,
  UiStatusBadge,
  UiTextField,
  useUiConfirm,
} from "@/shared/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateStockDerived } from "@/shared/cache/invalidation";
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
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { useHasPermission } from "@/shared/components/permission";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import {
  OUTBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
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
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import { PackingLabelPreviewDialog } from "@/modules/outbound/components/PackingLabelPreviewDialog";
import { validatePhone } from "@/shared/constants/validation.constants";

/** Lý do hủy phải đủ ý cho tra soát; trần khớp BE cancel `reason` max:1000. */
const CANCEL_REASON_MIN = 5;
const CANCEL_REASON_MAX = 1000;
/** Ghi chú lý do in lại nhãn — trần BE `reason` max:500. */
const REPRINT_NOTE_MAX = 500;

/**
 * Lý do in lại nhãn thường gặp (mục 9) + "Khác" cho phép nhập tay.
 *
 * CHUỖI Ở ĐÂY LÀ GIÁ TRỊ GỬI BE (`printMutation.mutate(reason)`) và được ghi
 * vào nhật ký in — KHÔNG dịch, nếu không nhật ký sẽ lẫn hai thứ tiếng tuỳ theo
 * ngôn ngữ người thao tác đang chọn. Chỉ phần HIỂN THỊ được dịch, qua
 * `REPRINT_REASON_LABELS` bên dưới.
 */
const REPRINT_REASONS = [
  "Máy in hết mực",
  "Lỗi máy in",
  "Nhãn bị hỏng / rách",
  "In lại chứng từ",
  "Khác",
] as const;

const OTHER_REPRINT_REASON = "Khác";

const REPRINT_REASON_LABELS: Record<
  (typeof REPRINT_REASONS)[number],
  MessageKey
> = {
  "Máy in hết mực": "outbound.reprint.tonerEmpty",
  "Lỗi máy in": "outbound.reprint.printerError",
  "Nhãn bị hỏng / rách": "outbound.reprint.damagedLabel",
  "In lại chứng từ": "outbound.reprint.reprintDocument",
  Khác: "outbound.reprint.other",
};

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
  if (!value) return EMPTY_TEXT;
  return value.length > 18 ? `${value.slice(0, 14)}…` : value;
}

function labelStatus(t: TranslateFn, value?: string | null): string {
  const labels: Record<string, MessageKey> = {
    DRAFT: "outbound.detail.labelStatusDraft",
    PENDING_PRINT: "outbound.detail.labelStatusPendingPrint",
    PREVIEWED: "outbound.detail.labelStatusPreviewed",
    READY_TO_PRINT: "outbound.detail.labelStatusReadyToPrint",
    PRINTED: "outbound.detail.labelStatusPrinted",
    PRINT_FAILED: "outbound.detail.labelStatusPrintFailed",
  };
  if (!value) return t("outbound.detail.labelStatusNone");
  const key = labels[value];
  return key ? t(key) : value;
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
  const t = useT();
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
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(
    null,
  );
  // Lý do in lại nhãn (mục 9): bắt buộc chọn trước khi reprint.
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintReasonKey, setReprintReasonKey] = useState("");
  const [reprintReasonNote, setReprintReasonNote] = useState("");
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
  // Dùng validatePhone chung (đầu số VN hợp lệ) thay vì regex 0+9 số tại chỗ.
  const customerPhoneCheck =
    customerPhone === "" ? null : validatePhone(customerPhone);
  const customerPhoneValid = customerPhoneCheck?.isValid ?? true;
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
      ? t("outbound.detail.blockMissingRequest")
      : !fullScan
        ? t("outbound.detail.blockNotScanned", {
            scanned: totalScanned,
            expected: totalExpected,
          })
        : doc.status !== "SCANNING"
          ? t("outbound.detail.blockNotReady")
          : !customerPhoneValid
            ? t("outbound.detail.blockPhone")
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
      // Ghi sổ phiếu xuất trừ tồn -> làm mới cả tồn kho/dashboard/báo cáo.
      invalidateStockDerived(queryClient),
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
        throw new Error(t("outbound.detail.needScanCode"));
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
      toast.success(t("outbound.detail.scanned"));
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, t("outbound.detail.scanError"))),
  });

  const unmatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      if (!detail) throw new Error(t("outbound.detail.notLoaded"));
      return unmatchOutboundItem({
        documentId,
        matchId,
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async (result) => {
      setVersion(result.version || null);
      toast.success(t("outbound.detail.unscanned"));
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, t("outbound.detail.unscanError"))),
  });

  const postAndLabelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !postReady) {
        throw new Error(postBlockReason || t("outbound.detail.notReady"));
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
            ? t("outbound.detail.postReplayed")
            : t("outbound.detail.postSuccess"),
        );
        await refresh();
        return;
      }
      try {
        await prepareLabel();
        toast.success(
          result.replayed
            ? t("outbound.detail.postReplayedWithLabel")
            : t("outbound.detail.postSuccessWithLabel"),
        );
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          t("outbound.detail.postLabelFailed"),
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
          getApiErrorMessage(error, t("outbound.detail.postError")),
      );
      if (outcome !== null) await refresh();
    },
  });

  const labelPrepareMutation = useMutation({
    mutationFn: () => prepareLabel(),
    onSuccess: async () => {
      setLabelWarning(null);
      toast.success(t("outbound.detail.labelReady"));
      await refresh();
    },
    onError: (error) => {
      const message = getApiErrorMessage(
        error,
        t("outbound.detail.labelPrepareError"),
      );
      setLabelWarning(message);
      toast.error(message);
    },
  });

  const printMutation = useMutation({
    mutationFn: async (reprintReason?: string) => {
      if (!printerId) throw new Error(t("outbound.detail.needPrinter"));
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
      toast.success(t("outbound.detail.printSent"));
      setPreparedLabel(null);
      setReprintOpen(false);
      setReprintReasonKey("");
      setReprintReasonNote("");
      await refresh();
    },
    onError: async (error) => {
      toast.error(
        `${getApiErrorMessage(error, t("outbound.detail.printError"))} ${t("outbound.detail.printErrorSuffix")}`,
      );
      // BE bump version của label_snapshot kể cả khi PRINT_FAILED; giữ preparedLabel
      // cũ sẽ làm lần in lại kế tiếp gửi If-Match version lỗi thời → 412.
      setPreparedLabel(null);
      await refresh();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !cancelReason.trim())
        throw new Error(t("outbound.detail.needCancelReason"));
      return cancelOutboundDocument(
        documentId,
        cancelReason.trim(),
        version ?? detail.document.version,
      );
    },
    onSuccess: async () => {
      toast.success(t("outbound.detail.cancelled"));
      setCancelOpen(false);
      await refresh();
      dialog.close();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, t("outbound.detail.cancelError"))),
  });

  // Gỡ đối chiếu là thao tác không hoàn tác được bằng nút bấm: muốn tính lại
  // vào phiếu phải quét lại sản phẩm thật — bắt buộc xác nhận trước khi gọi server.
  const handleUnmatch = async (match: OutboundItemMatchRecord) => {
    const accepted = await confirm({
      title: t("outbound.detail.unscanTitle"),
      content: t("outbound.detail.unscanDescription"),
      confirmText: t("outbound.detail.unscanConfirm"),
      cancelText: t("outbound.detail.unscanCancel"),
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
      render: (row) =>
        row.skuCode ? (
          <SkuLink id={row.productId} code={row.skuCode} />
        ) : (
          short(row.productId)
        ),
    },
    {
      key: "expected",
      header: t("outbound.detail.colExpected"),
      width: 100,
      align: "right",
      render: (row) => row.expected,
    },
    {
      key: "scanned",
      header: t("outbound.detail.colScanned"),
      width: 100,
      align: "right",
      render: (row) => row.scanned,
    },
  ];

  const matchColumns: ResponsiveTableColumn<OutboundItemMatchRecord>[] = [
    {
      key: "item",
      header: t("outbound.detail.colProduct"),
      render: (match) =>
        match.itemCode || match.serialNumber || short(match.itemId),
    },
    {
      key: "actions",
      // Cột nút: không bọc lớp cắt chữ, tránh xén mất nút.
      truncate: 0,
      header: "",
      mobileLabel: t("outbound.detail.colAction"),
      width: 190,
      render: (match) => (
        <Stack direction="row" spacing={0.5}>
          {mutable && can("outbound.scan") ? (
            <ActionButton
              kind="delete"
              onClick={() => void handleUnmatch(match)}
            >
              {t("outbound.detail.remove")}
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
        title={t("outbound.detail.title")}
      >
        {t("outbound.detail.loading")}
      </UiDialog>
    );
  }

  if (detailQuery.isError || !detail || !doc) {
    return (
      <UiDialog
        {...dialog.dialogProps}
        maxWidth="sm"
        fullWidth
        title={t("outbound.detail.title")}
      >
        <UiAlert tone="error">
          {getApiErrorMessage(
            detailQuery.error,
            t("outbound.detail.loadError"),
          )}
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
            {t("outbound.detail.title")}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={dialog.close}
            />
          </Box>
        }
      >
        <Stack spacing={2}>
          <Box sx={SECTION_SX}>
            <Grid container spacing={2}>
              <DetailField
                label={t("outbound.detail.fieldDocument")}
                value={doc.code}
              />
              <DetailField
                label={t("outbound.detail.fieldStatus")}
                value={
                  <UiStatusBadge
                    label={businessLabel(OUTBOUND_STATUS_LABELS, doc.status)}
                  />
                }
              />
              <DetailField
                label={t("outbound.detail.fieldRecipient")}
                value={doc.recipientName || EMPTY_TEXT}
              />
              <DetailField
                label={t("outbound.detail.fieldScanned")}
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
              {t("outbound.detail.step1")}
            </Box>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ flexWrap: "wrap", rowGap: 1 }}
              >
                {/* Phiếu nhiều dòng thì danh sách này dài — cho gõ mã SKU
                    để nhảy thẳng tới dòng cần quét. */}
                <UiAutocomplete
                  sx={{ width: 300 }}
                  fullWidth={false}
                  label={t("outbound.detail.autoSku")}
                  value={lineId || null}
                  onChange={(next) =>
                    setLineId(next == null ? "" : String(next))
                  }
                  placeholder={t("outbound.detail.autoSku")}
                  options={detail.lines
                    .filter((line) => line.scanned < line.expected)
                    .map((line) => ({
                      value: line.id,
                      label: `${line.skuCode ?? short(line.productId)} · ${line.scanned}/${line.expected}`,
                    }))}
                />
                <UiTextField
                  sx={{ width: 330 }}
                  value={scanCode}
                  label={t("outbound.detail.scanField")}
                  placeholder={t("outbound.detail.scanField")}
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
                  {scanMutation.isPending
                    ? t("outbound.detail.scanning")
                    : t("outbound.detail.scanAction")}
                </ActionButton>
              </Stack>
              <ResponsiveDataTable<OutboundLineRecord>
                columns={lineColumns}
                rows={detail.lines}
                rowKey={(row) => row.id}
                loading={detailQuery.isFetching}
                emptyText={t("outbound.detail.linesEmpty")}
              />
              <ResponsiveDataTable<OutboundItemMatchRecord>
                columns={matchColumns}
                rows={activeMatches}
                rowKey={(row) => row.id}
                loading={detailQuery.isFetching}
                emptyText={t("outbound.detail.scansEmpty")}
              />
            </Stack>
          </Box>

          <Box sx={SECTION_SX}>
            <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
              {t("outbound.detail.step2")}
            </Box>
            <Stack spacing={1.5}>
              {shortStockLines.length ? (
                <UiAlert
                  tone="warning"
                  title={t("outbound.detail.shortStockTitle")}
                >
                  {t("outbound.detail.shortStockBody", {
                    skus: shortStockLines
                      .map((line) => line.skuCode ?? short(line.productId))
                      .join(", "),
                  })}
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
                    label={t("outbound.detail.labelPhone")}
                    placeholder={t("outbound.detail.labelPhone")}
                    slotProps={{ htmlInput: { maxLength: 10 } }}
                    onChange={(event) =>
                      setCustomerPhone(
                        event.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    error={!customerPhoneValid}
                    helperText={
                      customerPhoneValid
                        ? undefined
                        : (customerPhoneCheck?.errorMessage ??
                          t("outbound.detail.blockPhone"))
                    }
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
                      ? t("outbound.detail.postWithLabel")
                      : t("outbound.detail.post")}
                  </ActionButton>
                  {can("outbound.cancel") && mutable ? (
                    <ActionButton
                      kind="cancel"
                      onClick={() => setCancelOpen(true)}
                    >
                      {t("outbound.detail.cancelTrigger")}
                    </ActionButton>
                  ) : null}
                </Stack>
              ) : (
                <UiAlert
                  tone="success"
                  title={t("outbound.detail.postedTitle")}
                >
                  {t("outbound.detail.postedBody")}
                </UiAlert>
              )}
              {postBlockReason && !posted ? (
                <Box sx={{ typography: "body2", color: "text.secondary" }}>
                  {postBlockReason}
                </Box>
              ) : null}
              {/* Hiện mã chứng từ/biến động đọc được. KHÔNG hiện request_id ở
                trạng thái thành công: đó là UUID đối chiếu log sinh cho mỗi lượt
                gọi API, không phải chứng từ nghiệp vụ — chỉ có ích khi báo lỗi,
                và ApiErrorAlert đã hiển thị đúng chỗ đó. */}
              {evidence ? (
                <Box
                  sx={{
                    typography: "body2",
                    color: "text.secondary",
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 0.5,
                  }}
                >
                  {t("outbound.detail.evidenceMovements", {
                    count: evidence.movements.length,
                  })}
                  {evidence.movements.map((movement, index) => (
                    <Box
                      key={movement.id}
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "center" }}
                    >
                      {movement.code ? (
                        <strong>{movement.code}</strong>
                      ) : (
                        <CopyableId value={movement.id} />
                      )}
                      {index < evidence.movements.length - 1 ? "," : ""}
                    </Box>
                  ))}
                </Box>
              ) : null}
            </Stack>
          </Box>

          <Grid container spacing={2}>
            <Grid size={12}>
              <Box sx={SECTION_SX}>
                <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
                  {t("outbound.detail.step3")}
                </Box>
                <Stack spacing={1.5}>
                  {labelWarning ? (
                    <UiAlert tone="warning">{labelWarning}</UiAlert>
                  ) : null}
                  {!posted ? (
                    <Box sx={{ typography: "body2", color: "text.secondary" }}>
                      {t("outbound.detail.labelPending")}
                    </Box>
                  ) : packingLabel ? (
                    <>
                      <Grid container spacing={2}>
                        <DetailField
                          label={t("outbound.detail.fieldLabelCode")}
                          value={packingLabel.labelCode}
                        />
                        <DetailField
                          label={t("outbound.detail.fieldStatus")}
                          value={labelStatus(t, packingLabel.status)}
                        />
                        <DetailField
                          label={t("outbound.detail.fieldLabelRecipient")}
                          value={
                            packingLabel.recipientName ||
                            doc.recipientName ||
                            EMPTY_TEXT
                          }
                        />
                        <DetailField
                          label={t("outbound.detail.fieldItemCount")}
                          value={packingLabel.itemCount}
                        />
                        <DetailField
                          label={t("outbound.detail.fieldSkuCount")}
                          value={packingLabel.skuCount}
                        />
                        <DetailField
                          label={t("outbound.detail.fieldSourceRequest")}
                          value={packingLabel.sourceRequestNo || EMPTY_TEXT}
                        />
                      </Grid>
                      <Box>
                        <ActionButton
                          kind="view"
                          onClick={() => setLabelPreviewOpen(true)}
                        >
                          {t("outbound.detail.previewLabel")}
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
                         * CỐ Ý KHÔNG dùng <select>/<option> thuần: trình duyệt vẽ
                         * menu theo kiểu hệ điều hành — phông và màu highlight khác
                         * hẳn phần còn lại của app. Dropdown của design system dùng
                         * menu React ăn theme, và cho gõ để tìm khi danh sách máy in
                         * dài ra.
                         */}
                        <UiAutocomplete
                          label={t("outbound.detail.fieldPrinter")}
                          sx={{ width: 280 }}
                          fullWidth={false}
                          value={printerId || null}
                          onChange={(next) =>
                            setPrinterId(next == null ? "" : String(next))
                          }
                          placeholder={t("outbound.detail.choosePrinter")}
                          options={activePrinters.map((printer) => ({
                            value: printer.id,
                            label: `${printer.code} · ${printer.name}`,
                          }))}
                        />
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
                            ? t("outbound.detail.printing")
                            : packingLabel.status === "PRINTED"
                              ? t("outbound.detail.reprint")
                              : t("outbound.detail.print")}
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
                          ? t("outbound.detail.preparing")
                          : t("outbound.detail.prepareAgain")}
                      </ActionButton>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Stack>

        <CameraScanModal
          open={cameraOpen}
          title={t("outbound.detail.scanDialogTitle")}
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
          title={t("outbound.detail.postDialogTitle")}
          actions={
            <>
              <ActionButton
                kind="cancel"
                onClick={() => setPostConfirmOpen(false)}
                disabled={postAndLabelMutation.isPending}
              >
                {t("outbound.detail.postDialogCancel")}
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
                  ? t("outbound.detail.posting")
                  : t("outbound.detail.postConfirm")}
              </ActionButton>
            </>
          }
        >
          <Box sx={{ typography: "body2" }}>
            {t("outbound.detail.postDialogBody")}
          </Box>
        </UiDialog>

        <UiDialog
          open={cancelOpen}
          onClose={guardBackdropClose(() => setCancelOpen(false))}
          maxWidth="xs"
          fullWidth
          title={t("outbound.detail.cancelTitle")}
          actions={
            <>
              <ActionButton kind="close" onClick={() => setCancelOpen(false)}>
                {t("common.close")}
              </ActionButton>
              <ActionButton
                kind="cancel"
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                onClick={() => {
                  const reason = cancelReason.trim();
                  if (reason.length < CANCEL_REASON_MIN) {
                    setCancelReasonError(
                      t("outbound.detail.cancelReasonShort", {
                        min: CANCEL_REASON_MIN,
                      }),
                    );
                    return;
                  }
                  if (reason.length > CANCEL_REASON_MAX) {
                    setCancelReasonError(
                      t("shared.validation.textMaxLength", {
                        max: CANCEL_REASON_MAX,
                      }),
                    );
                    return;
                  }
                  cancelMutation.mutate();
                }}
              >
                {cancelMutation.isPending
                  ? t("outbound.detail.cancelling")
                  : t("outbound.detail.cancelTrigger")}
              </ActionButton>
            </>
          }
        >
          <UiTextField
            fullWidth
            multiline
            minRows={3}
            value={cancelReason}
            onChange={(event) => {
              setCancelReason(event.target.value);
              if (cancelReasonError) setCancelReasonError(null);
            }}
            label={t("outbound.detail.cancelReason")}
            placeholder={t("outbound.detail.cancelReason")}
            slotProps={{ htmlInput: { maxLength: CANCEL_REASON_MAX } }}
            error={Boolean(cancelReasonError)}
            helperText={
              cancelReasonError ?? `${cancelReason.length}/${CANCEL_REASON_MAX}`
            }
          />
        </UiDialog>

        <UiDialog
          open={reprintOpen}
          onClose={guardBackdropClose(() => setReprintOpen(false))}
          maxWidth="xs"
          fullWidth
          title={t("outbound.reprint.title")}
          actions={
            <>
              <ActionButton kind="close" onClick={() => setReprintOpen(false)}>
                {t("common.close")}
              </ActionButton>
              <ActionButton
                kind="print"
                disabled={
                  printMutation.isPending ||
                  !reprintReasonKey ||
                  (reprintReasonKey === OTHER_REPRINT_REASON &&
                    !reprintReasonNote.trim())
                }
                onClick={() => {
                  const reason =
                    reprintReasonKey === OTHER_REPRINT_REASON
                      ? reprintReasonNote.trim()
                      : reprintReasonKey;
                  printMutation.mutate(reason);
                }}
              >
                {printMutation.isPending
                  ? t("outbound.detail.printing")
                  : t("outbound.detail.reprint")}
              </ActionButton>
            </>
          }
        >
          <Stack spacing={2}>
            <UiAlert tone="info">{t("outbound.reprint.hint")}</UiAlert>
            <UiTextField
              select
              fullWidth
              value={reprintReasonKey}
              onChange={(event) => setReprintReasonKey(event.target.value)}
              label={t("outbound.reprint.field")}
            >
              <MenuItem value="" disabled>
                {t("outbound.reprint.choose")}
              </MenuItem>
              {REPRINT_REASONS.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {t(REPRINT_REASON_LABELS[reason])}
                </MenuItem>
              ))}
            </UiTextField>
            {reprintReasonKey === OTHER_REPRINT_REASON ? (
              <UiTextField
                fullWidth
                multiline
                minRows={2}
                value={reprintReasonNote}
                onChange={(event) => setReprintReasonNote(event.target.value)}
                label={t("outbound.reprint.otherLabel")}
                placeholder={t("outbound.reprint.otherPlaceholder")}
                slotProps={{ htmlInput: { maxLength: REPRINT_NOTE_MAX } }}
                helperText={`${reprintReasonNote.length}/${REPRINT_NOTE_MAX}`}
              />
            ) : null}
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
