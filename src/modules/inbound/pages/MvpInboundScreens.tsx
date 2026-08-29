/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiDialog,
  UiPagination,
  UiStatusBadge,
  UiTextField,
  useUiConfirm,
} from "@/shared/ui";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { toast } from "sonner";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InboxOutlined,
} from "@/shared/components/icons";
import {
  getApiErrorMessage,
  getErrorRequestId,
  normalizeError,
} from "@/shared/api/api-error";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { getCameraErrorMessage } from "@/shared/utils/camera-error";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import {
  classifyConcurrencyError,
  isRetryableAfterReload,
  WmsConcurrencyError,
} from "@/shared/api/concurrency-contract";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import {
  INBOUND_STATUS_LABELS,
  QR_RESOLUTION_STATUS_LABELS,
  SKU_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import type { ScanClassifyResponse } from "@/modules/scan/types";
import {
  useCancelInbound,
  useCompleteInboundCartonScan,
  useEnsureComponentLine,
  useInboundDetail,
  useInboundScanEntries,
  usePostInboundReceipt,
  useRegisterInboundBox,
  useScanInbound,
  useUnscanInbound,
} from "@/modules/inbound/hooks/use-inbound";
import type {
  ActiveCarton,
  InboundLine,
  InboundScanEntry,
  ReceiptEvidence,
} from "@/modules/inbound/types";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
};
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

type CameraScanModalProps = {
  open: boolean;
  title: string;
  onDetected: (code: string) => void;
  onClose: () => void;
};

type InboundScanModalProps = {
  documentId: string;
  onClose: () => void;
  onChanged?: () => void;
};

type ScanLogRow = {
  key: string;
  code: string;
  result: string;
  success: boolean;
  lineId?: string;
  errorCode?: string;
};

const AUTO_LINE = "__AUTO__";
// STT (số thứ tự) cần cộng theo trang hiện tại — page size cố định cho 2 bảng
// phân trang trong modal quét (mã đã quét / diễn biến quét phiên).
const SCAN_ENTRY_PAGE_SIZE = 10;
const SCAN_LOG_PAGE_SIZE = 8;

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        height: "100%",
      }}
    >
      <Box sx={{ typography: "caption", color: "text.secondary" }}>{label}</Box>
      <Box sx={{ fontSize: 22, fontWeight: 700 }}>{value}</Box>
    </Box>
  );
}

function looksCompositeProductQr(code: string): boolean {
  return /^HN\d+\|/i.test(code.trim());
}

function makeKey(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function shouldReuseScanKey(error: unknown): boolean {
  if (error instanceof WmsConcurrencyError) {
    return isRetryableAfterReload(error.outcome);
  }
  const outcome = classifyConcurrencyError(error);
  if (outcome !== null) return isRetryableAfterReload(outcome);
  const status = (error as { response?: { status?: unknown } } | null)?.response
    ?.status;
  return status === undefined || status === null;
}

function useInboundPermission(code: string | readonly string[]) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const codes = Array.isArray(code) ? code : [code];
  return hasAnyWmsPermission(permissionCodes, codes, isSuperAdmin);
}

function getBarcodeDetector(): BarcodeDetectorConstructor | null {
  return (
    (
      globalThis as typeof globalThis & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector ?? null
  );
}

function CameraScanModal({
  open,
  title,
  onDetected,
  onClose,
}: CameraScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectedRef = useRef(false);
  const callbackRef = useRef(onDetected);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    callbackRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    detectedRef.current = false;
    setCameraError(null);
    setCameraReady(false);

    const stop = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const start = async () => {
      const Detector = getBarcodeDetector();
      if (!Detector) {
        setCameraError(
          "Trình duyệt chưa hỗ trợ tính năng đọc mã vạch/QR. Hãy đóng camera và nhập mã thủ công.",
        );
        return;
      }
      if (!window.isSecureContext) {
        setCameraError(
          "Camera của WMS yêu cầu kết nối HTTPS an toàn. Hãy đóng camera và nhập mã thủ công.",
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Thiết bị hoặc trình duyệt không cung cấp chức năng camera. Hãy nhập mã thủ công.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stop();
          return;
        }
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);

        const detector = new Detector({
          formats: [
            "qr_code",
            "code_128",
            "code_39",
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
          ],
        });

        const detectFrame = async () => {
          if (disposed || detectedRef.current) return;
          try {
            if (video.readyState >= 2) {
              const results = await detector.detect(video);
              const code = results
                .map((result) => result.rawValue?.trim() ?? "")
                .find(Boolean);
              if (code) {
                detectedRef.current = true;
                stop();
                callbackRef.current(code);
                return;
              }
            }
          } catch {
            // Lỗi đọc khung hình có thể xảy ra tạm thời; người dùng luôn có thể nhập tay.
          }
          frameRef.current = requestAnimationFrame(() => void detectFrame());
        };

        frameRef.current = requestAnimationFrame(() => void detectFrame());
      } catch (error) {
        // DOMException của trình duyệt mang message tiếng Anh kỹ thuật —
        // dịch sang câu tiếng Việt nêu nguyên nhân + cách xử lý.
        setCameraError(getCameraErrorMessage(error));
        stop();
      }
    };

    void start();
    return () => {
      disposed = true;
      stop();
    };
  }, [open]);

  return (
    <UiDialog
      open={open}
      onClose={guardBackdropClose(onClose)}
      maxWidth="sm"
      fullWidth
      title={title}
      actions={
        <ActionButton kind="close" onClick={onClose}>
          Đóng / nhập tay
        </ActionButton>
      }
    >
      {cameraError ? (
        <UiAlert tone="warning">{cameraError}</UiAlert>
      ) : (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{
              width: "100%",
              minHeight: 260,
              borderRadius: 12,
              // Nền tối khi camera chưa lên hình — dùng token mực Vuexy thay
              // hex literal (Part 4 Vuexy sync).
              background: S.textStrong,
            }}
          />
          <Box sx={{ mt: 1.5 }}>
            <UiAlert tone="info">
              <Box sx={{ fontWeight: 700 }}>
                {cameraReady ? "Camera sẵn sàng" : "Đang khởi tạo camera..."}
              </Box>
              <Box sx={{ typography: "body2" }}>
                Đưa mã vạch/QR vào khung hình. Camera chỉ đọc mã; dữ liệu vẫn
                phải qua cùng kiểm tra hợp lệ như khi nhập tay. Camera không
                dùng để đọc RFID.
              </Box>
            </UiAlert>
          </Box>
        </>
      )}
    </UiDialog>
  );
}

function errorDescription(error: unknown) {
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return [
    normalized.status ? `Mã phản hồi ${normalized.status}` : undefined,
    normalized.code ? `Mã lỗi: ${normalized.code}` : undefined,
    requestId ? `Mã yêu cầu: ${requestId}` : undefined,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function InboundScanModal({
  documentId,
  onClose,
  onChanged,
}: InboundScanModalProps) {
  const dialog = useDialogExit(onClose);
  const detailQuery = useInboundDetail(documentId);
  const skuQuery = useMvpSkus({ status: "ACTIVE", per_page: 100 });
  const scanEntriesQuery = useInboundScanEntries(documentId, "ALL");
  const registerBoxMutation = useRegisterInboundBox();
  const ensureComponentMutation = useEnsureComponentLine();
  const scanMutation = useScanInbound();
  const unscanMutation = useUnscanInbound();
  const postMutation = usePostInboundReceipt();
  const cancelMutation = useCancelInbound();
  const completeCartonMutation = useCompleteInboundCartonScan();
  const [lineId, setLineId] = useState<string>(AUTO_LINE);
  const [componentSkuId, setComponentSkuId] = useState<string | undefined>();
  const [scanCode, setScanCode] = useState("");
  const [boxCode, setBoxCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [scanVersion, setScanVersion] = useState<number | null>(null);
  const [scanLog, setScanLog] = useState<ScanLogRow[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [receiptEvidence, setReceiptEvidence] =
    useState<ReceiptEvidence | null>(null);
  const [cameraTarget, setCameraTarget] = useState<"box" | "code" | null>(null);
  const [activeCarton, setActiveCarton] = useState<ActiveCarton | null>(null);
  const [scanEntryPage, setScanEntryPage] = useState(1);
  const [scanLogPage, setScanLogPage] = useState(1);
  const postKeyRef = useRef<string | null>(null);
  const scanKeyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const canPost = useInboundPermission(P.INBOUND_POST);
  const canCancel = useInboundPermission(WMS_ACTION_PERMISSIONS.CANCEL_INBOUND);
  // Thay xoá 1 click — confirmDialog PHẢI render trong cây bên dưới.
  const { confirm, confirmDialog } = useUiConfirm();

  const detail = detailQuery.data;
  const skuRows = skuQuery.data?.data ?? [];
  const skuById = useMemo(
    () => new Map<string, SkuRecord>(skuRows.map((sku) => [sku.sku_id, sku])),
    [skuRows],
  );

  useEffect(() => {
    if (!detail) return;
    setScanVersion(detail.document.version);
    if (
      lineId !== AUTO_LINE &&
      !detail.lines.some((line) => line.id === lineId)
    ) {
      setLineId(AUTO_LINE);
    }
  }, [detail, lineId]);

  useEffect(() => {
    setScanCode("");
    setBoxCode("");
    setQuantity(1);
  }, [lineId]);

  const selectedLine = detail?.lines.find((line) => line.id === lineId);
  const selectedSku = selectedLine
    ? skuById.get(selectedLine.productId)
    : undefined;
  const isComponent = selectedSku?.sku_type === "COMPONENT";
  const isSerialTracked = Boolean(selectedSku?.is_serial_tracked);
  // GĐ1-REQ-004: số lượng nhập đến từ hàng thực quét/đếm — không còn khái niệm
  // "dự kiến/còn lại" làm gate; Post chỉ cần đã ghi nhận ít nhất một đơn vị.
  const totalScanned =
    detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const hasScanned = totalScanned > 0;
  const componentSkuOptions = skuRows.filter(
    (sku) => sku.sku_type === "COMPONENT",
  );
  const isMutable =
    detail?.document.status === "DRAFT" ||
    detail?.document.status === "SCANNING";
  const busy =
    scanMutation.isPending ||
    registerBoxMutation.isPending ||
    ensureComponentMutation.isPending;
  const working =
    busy ||
    postMutation.isPending ||
    cancelMutation.isPending ||
    unscanMutation.isPending ||
    completeCartonMutation.isPending;
  const scanEntries = scanEntriesQuery.data ?? [];
  const activeEntries = scanEntries.filter(
    (entry) => entry.status === "ACTIVE",
  );
  const removedEntryCount = scanEntries.length - activeEntries.length;
  const activeCartonScannedQty = activeCarton
    ? activeEntries
        .filter((entry) => entry.containerId === activeCarton.id)
        .reduce((sum, entry) => sum + entry.quantity, 0)
    : 0;
  const sessionDuplicateCount = scanLog.filter(
    (row) => !row.success && (row.errorCode ?? "").includes("DUPLICATE"),
  ).length;
  const sessionErrorCount = scanLog.filter(
    (row) => !row.success && !(row.errorCode ?? "").includes("DUPLICATE"),
  ).length;

  useEffect(() => {
    if (isSerialTracked) setQuantity(1);
  }, [isSerialTracked]);

  const handleCartonDetected = (
    classified: ScanClassifyResponse,
    rawCode: string,
  ) => {
    const cartonId = classified.container_id;
    if (!cartonId) return;
    const cartonCode = classified.container_code || rawCode;
    const pushCartonLog = (result: string, success: boolean) => {
      setScanLog((current) =>
        [
          { key: makeKey("carton"), code: rawCode, result, success },
          ...current,
        ].slice(0, 20),
      );
    };

    if (classified.container_type && classified.container_type !== "CARTON") {
      const message = `"${cartonCode}" là vật chứa loại ${classified.container_type}, không phải thùng carton của luồng nhập sản phẩm.`;
      pushCartonLog(message, false);
      toast.error(message);
      return;
    }
    if (activeCarton && activeCarton.id !== cartonId) {
      const message = `Đang quét dở thùng ${activeCarton.code}. Hãy bấm "Đã quét xong thùng" trước khi chuyển sang ${cartonCode}.`;
      pushCartonLog(message, false);
      toast.error(message);
      return;
    }
    setScanCode("");
    if (activeCarton?.id === cartonId) {
      toast.info(`Thùng ${cartonCode} đang là thùng được quét.`);
      return;
    }
    setActiveCarton({
      id: cartonId,
      code: cartonCode,
      skuId: classified.sku_id ?? undefined,
    });
    pushCartonLog(
      `Thùng đang quét: ${cartonCode} · Sản phẩm quét tiếp theo sẽ gắn vào thùng này`,
      true,
    );
    toast.success(
      `Đã mở thùng ${cartonCode}. Quét các máy trong thùng rồi bấm "Đã quét xong thùng".`,
    );
  };

  const handleCompleteCarton = async () => {
    if (!activeCarton || !canScan || !isMutable) return;
    if (activeCartonScannedQty <= 0) {
      setActiveCarton(null);
      toast.info(
        `Đã đóng thùng ${activeCarton.code}. Chưa ghi nhận máy nào nên không tạo mốc nhật ký.`,
      );
      return;
    }
    try {
      const result = await completeCartonMutation.mutateAsync({
        id: documentId,
        containerId: activeCarton.id,
      });
      setActiveCarton(null);
      toast.success(
        `Đã quét xong thùng ${result.cartonCode || activeCarton.code}: ${result.actualItemQty} máy. Tồn kho không đổi — chỉ hoàn tất nhập kho mới tăng tồn.`,
      );
      await scanEntriesQuery.refetch();
      onChanged?.();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không ghi nhận được mốc xong thùng."),
      );
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
    }
  };

  const handleScan = async (scannedCode?: string) => {
    const autoMatch = !selectedLine;
    if (!detail || scanVersion === null || !canScan || !isMutable) return;
    if (!autoMatch && !selectedSku) return;
    const normalizedBox = boxCode.trim();
    const normalizedCode = (scannedCode ?? scanCode).trim();
    const scanQuantity =
      isSerialTracked || !isComponent ? 1 : Math.max(1, Number(quantity) || 1);

    if (isComponent && !normalizedBox) {
      toast.error("Linh kiện bắt buộc có hộp trước khi ghi nhận quét.");
      return;
    }
    if ((!isComponent || isSerialTracked) && !normalizedCode) {
      toast.error("Mã vạch hoặc số sê-ri là bắt buộc cho dòng này.");
      return;
    }

    if (
      !isComponent &&
      normalizedCode &&
      !looksCompositeProductQr(normalizedCode)
    ) {
      let classified: ScanClassifyResponse | null = null;
      try {
        classified = await classifyScanCodes({
          raw_code: normalizedCode,
          context: "INBOUND",
          warehouse_id: detail.document.warehouseId,
        });
      } catch {
        // Không nhận diện được là thùng thì tiếp tục xử lý như mã sản phẩm.
      }
      if (classified?.classification === "CONTAINER") {
        handleCartonDetected(classified, normalizedCode);
        return;
      }
    }

    const logicalCode = normalizedCode || normalizedBox;
    const scanFingerprint = [
      selectedLine?.id ?? AUTO_LINE,
      scanQuantity,
      normalizedCode,
      normalizedBox,
      !isComponent ? (activeCarton?.id ?? "") : "",
    ].join("|");
    const pendingScanKey = scanKeyRef.current;
    const scanAttemptKey =
      pendingScanKey?.fingerprint === scanFingerprint
        ? pendingScanKey.key
        : makeKey(`inbound-scan-${documentId}`);
    scanKeyRef.current = { key: scanAttemptKey, fingerprint: scanFingerprint };
    try {
      let containerId: string | undefined;
      if (isComponent && selectedLine) {
        const box = await registerBoxMutation.mutateAsync({
          id: documentId,
          lineId: selectedLine.id,
          boxCode: normalizedBox,
        });
        if (box.stock_effect !== "NONE" || box.movement_created !== false) {
          throw new Error(
            "Lỗi bất biến: đăng ký hộp không được làm thay đổi tồn kho.",
          );
        }
        containerId = box.container_id;
      } else if (activeCarton) {
        containerId = activeCarton.id;
      }

      const result = await scanMutation.mutateAsync({
        id: documentId,
        code: logicalCode,
        lineId: selectedLine?.id,
        ifMatch: scanVersion,
        includeCodeValue: !isComponent || isSerialTracked,
        quantity: scanQuantity,
        containerId,
        idempotencyKey: scanAttemptKey,
      });
      const first = result[0];
      if (!first) throw new Error("Hệ thống không trả kết quả quét.");
      scanKeyRef.current = null;
      setScanVersion(first.version);
      const identityText = [
        first.sku ? `SKU ${first.sku}` : "",
        first.item_unique ?? "",
      ]
        .filter(Boolean)
        .join(" · ");
      const candidateText =
        first.resolution_status === "NEW_ITEM_CANDIDATE"
          ? ` · ${QR_RESOLUTION_STATUS_LABELS.NEW_ITEM_CANDIDATE}`
          : "";
      const cartonText =
        !isComponent && activeCarton ? ` · thùng ${activeCarton.code}` : "";
      setScanLog((current) =>
        [
          {
            key: makeKey("scan"),
            code: logicalCode,
            result: first.replayed
              ? "Hợp lệ · đã ghi nhận trước đó, không cộng thêm"
              : `Hợp lệ · +${scanQuantity}${identityText ? ` · ${identityText}` : ""}${candidateText}${cartonText}`,
            success: true,
            lineId: first.line_id,
          },
          ...current,
        ].slice(0, 20),
      );
      if (first.replayed) {
        toast.success(
          "Lần quét này đã được ghi nhận trước đó. Hệ thống trả lại kết quả cũ — số đã quét không tăng thêm.",
        );
      }
      setScanCode("");
      if (!isSerialTracked) setQuantity(1);
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
    } catch (error) {
      const errorText = getApiErrorMessage(error, "Mã quét không hợp lệ.");
      const errorCode = normalizeError(error).code ?? undefined;
      scanKeyRef.current = shouldReuseScanKey(error)
        ? { key: scanAttemptKey, fingerprint: scanFingerprint }
        : null;
      setScanLog((current) =>
        [
          {
            key: makeKey("scan-error"),
            code: logicalCode,
            result: errorText,
            success: false,
            lineId: selectedLine?.id,
            errorCode,
          },
          ...current,
        ].slice(0, 20),
      );
      toast.error(errorText);
      await detailQuery.refetch();
      onChanged?.();
    }
  };

  // GĐ1 COMPONENT theo Box: materialize dòng linh kiện theo SKU thực nhận rồi
  // chuyển sang nhánh Hộp/serial/số đếm hiện có. Idempotent theo document + SKU.
  const handleAddComponentLine = async () => {
    if (!componentSkuId || !canScan || !isMutable) return;
    try {
      const result = await ensureComponentMutation.mutateAsync({
        id: documentId,
        skuId: componentSkuId,
      });
      const refreshed = await detailQuery.refetch();
      setLineId(result.line_id);
      setComponentSkuId(undefined);
      const version = refreshed.data?.document.version;
      if (version !== undefined) setScanVersion(version);
      toast.success(
        `Đã sẵn sàng ghi nhận linh kiện ${result.sku_code} theo hộp (${
          result.is_serial_tracked
            ? "quét từng số sê-ri"
            : "nhập số lượng đếm thực tế"
        }).`,
      );
      onChanged?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tạo được dòng linh kiện."));
    }
  };

  const handleUnscan = async (entry: InboundScanEntry) => {
    if (!detail || scanVersion === null || !canScan || !isMutable) return;
    // Gỡ mã là thao tác không hoàn tác được bằng nút bấm: muốn thêm lại phải
    // quét lại sản phẩm thật — bắt buộc xác nhận trước khi gọi server.
    const accepted = await confirm({
      title: "Gỡ mã đã quét?",
      content:
        "Mã sẽ bị xóa khỏi phiếu nhập. Muốn thêm lại, bạn phải quét lại sản phẩm đó. Tồn kho không thay đổi.",
      confirmText: "Gỡ mã",
      cancelText: "Hủy",
      tone: "danger",
    });
    if (!accepted) return;
    try {
      const result = await unscanMutation.mutateAsync({
        id: documentId,
        entryId: entry.id,
        ifMatch: scanVersion,
      });
      setScanVersion(result.version);
      toast.success(
        `Đã gỡ mã khỏi phiếu. Dòng còn ${result.scannedQuantity} đơn vị đã quét; tồn kho không đổi.`,
      );
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không gỡ được mã đã quét."));
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
    }
  };

  const handlePost = async () => {
    if (
      !detail ||
      scanVersion === null ||
      !hasScanned ||
      !canPost ||
      detail.document.status !== "SCANNING"
    )
      return;
    const idempotencyKey =
      postKeyRef.current ?? makeKey(`post-receipt-${documentId}`);
    postKeyRef.current = idempotencyKey;
    try {
      const evidence = await postMutation.mutateAsync({
        documentId,
        idempotencyKey,
        ifMatch: scanVersion,
      });
      postKeyRef.current = null;
      setReceiptEvidence(evidence);
      toast.success(
        evidence.replayed
          ? "Phiếu đã được hoàn tất nhập kho trước đó. Hệ thống trả lại kết quả cũ, tồn kho không tăng thêm lần nữa."
          : "Hoàn tất nhập kho thành công. Tồn kho tăng đúng một lần.",
      );
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không hoàn tất nhập kho được."));
      await detailQuery.refetch();
      onChanged?.();
    }
  };

  const handleCancel = async () => {
    if (!detail || scanVersion === null || !cancelReason.trim() || !canCancel)
      return;
    try {
      await cancelMutation.mutateAsync({
        id: documentId,
        reason: cancelReason.trim(),
        ifMatch: scanVersion,
      });
      toast.success("Đã hủy phiếu nhập. Không phát sinh biến động tồn kho.");
      setCancelOpen(false);
      onChanged?.();
      dialog.close();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không hủy được phiếu nhập."));
      await detailQuery.refetch();
      onChanged?.();
    }
  };

  // Phân trang client-side cho 2 bảng trong modal (giữ nguyên page size cũ
  // của antd Table); clamp trang khi dữ liệu co lại để không rơi vào trang rỗng.
  const scanEntryPageCount = Math.max(
    1,
    Math.ceil(scanEntries.length / SCAN_ENTRY_PAGE_SIZE),
  );
  const safeScanEntryPage = Math.min(scanEntryPage, scanEntryPageCount);
  const pagedScanEntries = scanEntries.slice(
    (safeScanEntryPage - 1) * SCAN_ENTRY_PAGE_SIZE,
    safeScanEntryPage * SCAN_ENTRY_PAGE_SIZE,
  );
  const scanLogPageCount = Math.max(
    1,
    Math.ceil(scanLog.length / SCAN_LOG_PAGE_SIZE),
  );
  const safeScanLogPage = Math.min(scanLogPage, scanLogPageCount);
  const pagedScanLog = scanLog.slice(
    (safeScanLogPage - 1) * SCAN_LOG_PAGE_SIZE,
    safeScanLogPage * SCAN_LOG_PAGE_SIZE,
  );

  const lineColumns: ResponsiveTableColumn<InboundLine>[] = [
    {
      key: "stt",
      header: "STT",
      width: 56,
      align: "center",
      render: (line) =>
        (detail?.lines.findIndex((item) => item.id === line.id) ?? 0) + 1,
    },
    {
      key: "sku",
      header: "SKU",
      width: 220,
      render: (line) => (
        <strong>
          {skuById.get(line.productId)?.sku_code ?? line.productId}
        </strong>
      ),
    },
    {
      key: "name",
      header: "Tên / loại",
      width: 250,
      render: (line) => {
        const sku = skuById.get(line.productId);
        return (
          <div>
            <div>{sku?.sku_name ?? "-"}</div>
            {sku?.sku_type ? (
              <UiStatusBadge
                tone="neutral"
                sx={{ mt: 0.5 }}
                label={businessLabel(SKU_TYPE_LABELS, sku.sku_type)}
              />
            ) : null}
          </div>
        );
      },
    },
    {
      key: "scanned",
      header: "Số lượng đã quét",
      width: 140,
      align: "right",
      render: (line) => <strong>{line.scanned}</strong>,
    },
    // Ghi chú migrate (Part 4): antd Table cũ có expandable row liệt kê chip
    // mã đã quét theo dòng — ResponsiveDataTable không có expandable row;
    // cùng danh sách mã (kèm SKU) vẫn hiển thị đầy đủ ở bảng "Mã đã quét của
    // phiếu" ngay bên dưới nên không lặp lại ở đây.
  ];

  const scanEntryColumns: ResponsiveTableColumn<InboundScanEntry>[] = [
    {
      key: "stt",
      header: "STT",
      width: 56,
      align: "center",
      render: (entry) =>
        mvpRowNumber(
          safeScanEntryPage,
          SCAN_ENTRY_PAGE_SIZE,
          pagedScanEntries.findIndex((item) => item.id === entry.id),
        ),
    },
    {
      key: "code",
      header: "Mã",
      width: 240,
      render: (entry) => (
        <Box component="span" sx={{ fontFamily: "monospace" }}>
          {entry.itemCode ||
            entry.serialNumber ||
            entry.candidateItemUnique ||
            entry.itemId ||
            entry.containerId ||
            "-"}
        </Box>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: 220,
      render: (entry) => (
        <div>
          <div>
            <strong>{entry.sku || "-"}</strong>
          </div>
          <Box sx={{ fontSize: 12, color: "text.secondary" }}>
            {entry.skuName}
          </Box>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "SL",
      width: 70,
      align: "right",
      render: (entry) => entry.quantity,
    },
    {
      key: "result",
      header: "Kết quả",
      width: 180,
      render: (entry) =>
        entry.status === "ACTIVE" ? (
          entry.candidateItemUnique && !entry.itemId ? (
            <UiStatusBadge
              tone="info"
              icon={<CheckCircleOutlined />}
              label="Sản phẩm mới · chờ ghi nhận"
            />
          ) : (
            <UiStatusBadge
              tone="success"
              icon={<CheckCircleOutlined />}
              label="Hợp lệ"
            />
          )
        ) : (
          <UiStatusBadge
            tone="neutral"
            icon={<CloseCircleOutlined />}
            label="Đã gỡ"
          />
        ),
    },
    {
      key: "source",
      header: "Nguồn",
      width: 140,
      render: (entry) => (
        <UiStatusBadge
          tone="neutral"
          label={
            entry.scanSource === "CAMERA_OR_MANUAL_CODE"
              ? "Camera / mã"
              : "Nhập tay"
          }
        />
      ),
    },
    {
      key: "actions",
      header: "Hành động",
      width: 110,
      render: (entry) =>
        entry.status === "ACTIVE" && canScan && isMutable ? (
          <ActionButton
            kind="delete"
            disabled={working}
            onClick={() => void handleUnscan(entry)}
          >
            Gỡ mã
          </ActionButton>
        ) : null,
    },
  ];

  const scanLogColumns: ResponsiveTableColumn<ScanLogRow>[] = [
    {
      key: "stt",
      header: "STT",
      width: 56,
      align: "center",
      render: (row) =>
        mvpRowNumber(
          safeScanLogPage,
          SCAN_LOG_PAGE_SIZE,
          pagedScanLog.findIndex((item) => item.key === row.key),
        ),
    },
    { key: "code", header: "Mã", width: 220, render: (row) => row.code },
    {
      key: "result",
      header: "Kết quả",
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {row.success ? (
            <CheckCircleOutlined style={{ color: S.success }} />
          ) : (
            <CloseCircleOutlined style={{ color: S.error }} />
          )}
          <span>{row.result}</span>
        </Stack>
      ),
    },
  ];

  const componentSkuAutocompleteOptions = componentSkuOptions.map((sku) => ({
    value: sku.sku_id,
    label: `${sku.sku_code} · ${sku.sku_name}`,
  }));

  return (
    <>
      <UiDialog
        {...dialog.dialogProps}
        maxWidth="lg"
        fullWidth
        title={
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <span>
              {detail
                ? `Quét & hoàn tất nhập kho · ${detail.document.code || documentId}`
                : "Quét & hoàn tất nhập kho"}
            </span>
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={dialog.close}
              disabled={working}
            />
          </Stack>
        }
        actions={
          <>
            <ActionButton
              kind="close"
              disabled={working}
              onClick={dialog.close}
            >
              Đóng
            </ActionButton>
            {detail && canCancel && isMutable ? (
              <ActionButton
                kind="cancel"
                disabled={working}
                onClick={() => setCancelOpen(true)}
              >
                Hủy phiếu
              </ActionButton>
            ) : null}
            {detail && isMutable ? (
              <ActionButton
                kind="confirm"
                disabled={
                  !canPost ||
                  !hasScanned ||
                  detail.document.status !== "SCANNING" ||
                  postMutation.isPending
                }
                onClick={() => void handlePost()}
              >
                {postMutation.isPending ? "Đang xử lý..." : "Ghi nhận nhập"}
              </ActionButton>
            ) : null}
          </>
        }
      >
        <>
          {detailQuery.isError ? (
            <Box sx={{ mb: 2 }}>
              <UiAlert tone="error">
                <Box sx={{ fontWeight: 700 }}>
                  {getApiErrorMessage(
                    detailQuery.error,
                    "Không tải được phiếu nhập.",
                  )}
                </Box>
                <Box sx={{ typography: "body2" }}>
                  {errorDescription(detailQuery.error)}
                </Box>
              </UiAlert>
            </Box>
          ) : null}

          {detail ? (
            <>
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                  mb: 2,
                }}
              >
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      Phiếu
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {detail.document.code || documentId}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      Nguồn
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {detail.document.source || "-"}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      Trạng thái
                    </Box>
                    <UiStatusBadge
                      tone={
                        detail.document.status === "POSTED"
                          ? "success"
                          : detail.document.status === "SCANNING"
                            ? "info"
                            : detail.document.status === "CANCELLED"
                              ? "error"
                              : "warning"
                      }
                      label={businessLabel(
                        INBOUND_STATUS_LABELS,
                        detail.document.status,
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      Phiên bản dữ liệu
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {scanVersion ?? detail.document.version}
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Mã hợp lệ" value={totalScanned} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    label="Dòng SKU thực nhận"
                    value={detail.lines.length}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Mã đã gỡ" value={removedEntryCount} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    label="Mã trùng / lỗi (phiên)"
                    value={sessionDuplicateCount + sessionErrorCount}
                  />
                </Grid>
              </Grid>

              {isMutable ? (
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}
                  >
                    Ghi nhận mã vạch / QR / hộp
                  </Box>
                  {!isComponent && activeCarton ? (
                    <Box sx={{ mb: 1.5 }}>
                      <UiAlert tone="info">
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ alignItems: "center" }}
                        >
                          <InboxOutlined />
                          <Box sx={{ fontWeight: 700 }}>
                            {`Thùng đang quét: ${activeCarton.code}`}
                          </Box>
                        </Stack>
                        <Box sx={{ typography: "body2" }}>
                          Đã quét <strong>{activeCartonScannedQty}</strong> máy
                          vào thùng này. Sản phẩm quét tiếp theo sẽ được gắn vào
                          thùng {activeCarton.code}.
                        </Box>
                        <ActionButton
                          kind="scan"
                          sx={{ mt: 1 }}
                          disabled={!canScan || working}
                          onClick={() => void handleCompleteCarton()}
                        >
                          {completeCartonMutation.isPending
                            ? "Đang xử lý..."
                            : "Đã quét xong thùng"}
                        </ActionButton>
                      </UiAlert>
                    </Box>
                  ) : null}

                  {/*
                   * Vùng nhập xếp lưới 2 cột. Panel này chiếm trọn bề ngang modal
                   * (maxWidth="lg" ≈ 1200px); xếp dọc 1 cột thì mỗi ô kéo dài cả
                   * nghìn pixel — vừa trống trải vừa bắt mắt rê xa. Ô quét mã là
                   * đường chính nên vẫn chiếm trọn hàng (gridColumn 1 / -1).
                   */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      columnGap: 2,
                      rowGap: 1.5,
                      alignItems: "start",
                      mb: 1.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          typography: "caption",
                          color: "text.secondary",
                          mb: 0.5,
                        }}
                      >
                        Dòng nhận
                      </Box>
                      <UiTextField
                        select
                        fullWidth
                        value={lineId}
                        disabled={!canScan || busy}
                        onChange={(event) => setLineId(event.target.value)}
                      >
                        <MenuItem value={AUTO_LINE}>
                          Tự động theo QR (sản phẩm — hệ thống tự đối chiếu SKU)
                        </MenuItem>
                        {detail.lines.map((line) => {
                          const sku = skuById.get(line.productId);
                          return (
                            <MenuItem key={line.id} value={line.id}>
                              {`${sku?.sku_code ?? line.productId} · đã quét ${line.scanned}`}
                            </MenuItem>
                          );
                        })}
                      </UiTextField>
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          typography: "caption",
                          color: "text.secondary",
                          mb: 0.5,
                        }}
                      >
                        Nhận linh kiện theo hộp — chọn SKU linh kiện thực nhận
                        (dòng phiếu tự tạo, không nhập số lượng dự kiến)
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {/* Part 4 Vuexy sync: Autocomplete (MUI trần) →
                            UiTextField select cùng danh sách SKU linh kiện. */}
                        <UiTextField
                          select
                          sx={{ flex: 1 }}
                          label="Chọn SKU linh kiện"
                          value={componentSkuId ?? ""}
                          disabled={!canScan || busy}
                          onChange={(event) =>
                            setComponentSkuId(event.target.value || undefined)
                          }
                        >
                          <MenuItem value="">Chọn SKU linh kiện</MenuItem>
                          {componentSkuAutocompleteOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </UiTextField>
                        <ActionButton
                          kind="create"
                          disabled={!canScan || busy || !componentSkuId}
                          onClick={() => void handleAddComponentLine()}
                        >
                          {ensureComponentMutation.isPending
                            ? "Đang thêm..."
                            : "Thêm dòng linh kiện"}
                        </ActionButton>
                      </Stack>
                    </Box>

                    {isComponent ? (
                      <Box
                        sx={{
                          minWidth: 0,
                          gridColumn: {
                            xs: "auto",
                            md: isSerialTracked ? "1 / -1" : "auto",
                          },
                        }}
                      >
                        <Box
                          sx={{
                            typography: "caption",
                            color: "text.secondary",
                            mb: 0.5,
                          }}
                        >
                          Hộp *
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <UiTextField
                            fullWidth
                            value={boxCode}
                            disabled={!canScan || busy}
                            placeholder="Quét / nhập hộp chứa đúng một SKU linh kiện"
                            onChange={(event) => setBoxCode(event.target.value)}
                            slotProps={{ htmlInput: { maxLength: 120 } }}
                          />
                          <ActionButton
                            kind="camera"
                            disabled={!canScan || busy}
                            onClick={() => setCameraTarget("box")}
                            sx={{ flexShrink: 0 }}
                          >
                            Quét bằng camera
                          </ActionButton>
                        </Stack>
                      </Box>
                    ) : null}

                    {/* Đi liền ô Hộp: cùng mô tả kiện đang nhận, và ghép cặp 2 ô
                        này giúp lưới không hở nửa hàng trống. */}
                    {isComponent && !isSerialTracked ? (
                      <Box sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            typography: "caption",
                            color: "text.secondary",
                            mb: 0.5,
                          }}
                        >
                          Số lượng lần nhận *
                        </Box>
                        <UiTextField
                          type="number"
                          value={quantity}
                          onChange={(event) =>
                            setQuantity(Number(event.target.value) || 1)
                          }
                          disabled={!canScan || busy}
                          sx={{ width: "100%", maxWidth: 220 }}
                          slotProps={{ htmlInput: { min: 1 } }}
                        />
                      </Box>
                    ) : null}

                    <Box
                      sx={{
                        minWidth: 0,
                        gridColumn: { xs: "auto", md: "1 / -1" },
                      }}
                    >
                      <Box
                        sx={{
                          typography: "caption",
                          color: "text.secondary",
                          mb: 0.5,
                        }}
                      >
                        {isComponent && !isSerialTracked
                          ? "Mã vạch / số sê-ri (không bắt buộc với linh kiện nhập theo số lượng)"
                          : "Mã vạch / Số sê-ri *"}
                      </Box>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "flex-start" }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <ScanInput
                            value={scanCode}
                            size="middle"
                            disabled={!canScan || busy}
                            placeholder={
                              isSerialTracked
                                ? "Quét số sê-ri / mã vạch"
                                : "Quét mã vạch/QR hoặc nhập tay"
                            }
                            onChange={setScanCode}
                            onScan={(code) => void handleScan(code)}
                          />
                        </Box>
                        <ActionButton
                          kind="camera"
                          disabled={!canScan || busy}
                          onClick={() => setCameraTarget("code")}
                          sx={{ flexShrink: 0 }}
                        >
                          Quét bằng camera
                        </ActionButton>
                      </Stack>
                    </Box>
                  </Box>

                  <ActionButton
                    kind="scan"
                    disabled={
                      !canScan || busy || (lineId !== AUTO_LINE && !selectedSku)
                    }
                    onClick={() => void handleScan()}
                  >
                    {busy ? "Đang xử lý..." : "Ghi nhận quét"}
                  </ActionButton>

                  {selectedLine ? (
                    <Box sx={{ mt: 1.5 }}>
                      <UiAlert tone="info">
                        <Box sx={{ fontWeight: 700 }}>
                          {`${selectedSku?.sku_code ?? selectedLine.productId}: đã quét ${selectedLine.scanned}`}
                        </Box>
                        <Box sx={{ typography: "body2" }}>
                          {isComponent
                            ? "Linh kiện: bắt buộc có hộp. Với linh kiện nhập theo số lượng có thể ghi nhận nhiều đơn vị mỗi hộp; linh kiện quản lý số sê-ri vẫn ghi nhận từng đơn vị. Sau khi hoàn tất nhập kho mới thực hiện xếp khay."
                            : "Sản phẩm: quét mã vạch/QR khi nhập kho. RFID không bắt buộc; ở luồng xuất kho, RFID chỉ là gán mã tùy chọn và không chặn hoàn tất xuất kho."}
                        </Box>
                      </UiAlert>
                    </Box>
                  ) : null}
                </Box>
              ) : (
                <Box sx={{ mb: 2 }}>
                  <UiAlert
                    tone={
                      detail.document.status === "POSTED" ? "success" : "info"
                    }
                  >
                    <Box sx={{ fontWeight: 700 }}>
                      {detail.document.status === "POSTED"
                        ? "Phiếu đã nhập kho và chỉ đọc"
                        : "Phiếu đã hủy và chỉ đọc"}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {detail.document.status === "POSTED"
                        ? "Không sửa/xóa phiếu đã nhập kho. Sai giao dịch phải xử lý bằng điều chỉnh tồn kho theo cơ chế ghi bổ sung."
                        : "Phiếu đã hủy không làm thay đổi tồn kho. Muốn làm lại phải tạo phiếu mới."}
                    </Box>
                  </UiAlert>
                </Box>
              )}

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                  mt: 2,
                }}
              >
                <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
                  Hàng thực nhận theo SKU
                </Box>
                <ResponsiveDataTable<InboundLine>
                  columns={lineColumns}
                  rows={detail.lines}
                  rowKey={(line) => line.id}
                  loading={detailQuery.isFetching}
                  emptyText="Chưa có dòng SKU nào — quét mã sản phẩm đầu tiên để hệ thống tự tạo dòng."
                />
              </Box>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                  mt: 2,
                }}
              >
                <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
                  Mã đã quét của phiếu
                </Box>
                <Box
                  sx={{ typography: "caption", color: "text.secondary", mb: 1 }}
                >
                  {`${activeEntries.length} hợp lệ${
                    removedEntryCount ? ` · ${removedEntryCount} đã gỡ` : ""
                  }`}
                </Box>
                {scanEntriesQuery.isError ? (
                  <UiAlert tone="error">
                    <Box sx={{ fontWeight: 700 }}>
                      {getApiErrorMessage(
                        scanEntriesQuery.error,
                        "Không tải được danh sách mã đã quét.",
                      )}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {errorDescription(scanEntriesQuery.error)}
                    </Box>
                  </UiAlert>
                ) : (
                  <>
                    <ResponsiveDataTable<InboundScanEntry>
                      columns={scanEntryColumns}
                      rows={pagedScanEntries}
                      rowKey={(entry) => entry.id}
                      loading={scanEntriesQuery.isLoading}
                      emptyText="Chưa ghi nhận mã nào. Quét mã vạch/QR hoặc đăng ký hộp để bắt đầu."
                    />
                    {scanEntries.length > SCAN_ENTRY_PAGE_SIZE ? (
                      <Box sx={{ mt: 1.5 }}>
                        <UiPagination
                          page={safeScanEntryPage}
                          pageSize={SCAN_ENTRY_PAGE_SIZE}
                          total={scanEntries.length}
                          onPageChange={setScanEntryPage}
                          showTotal={false}
                        />
                      </Box>
                    ) : null}
                  </>
                )}
              </Box>

              {scanLog.length ? (
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    mt: 2,
                  }}
                >
                  <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
                    Diễn biến quét trong phiên thao tác
                  </Box>
                  {/* Nhật ký phiên là state cục bộ (không có query) nên không có
                      cờ loading tương ứng; chỉ bổ sung emptyText. */}
                  <ResponsiveDataTable<ScanLogRow>
                    columns={scanLogColumns}
                    rows={pagedScanLog}
                    rowKey={(row) => row.key}
                    emptyText="Chưa có lượt quét nào trong phiên này — kết quả từng lượt quét sẽ hiện ở đây."
                  />
                  {scanLog.length > SCAN_LOG_PAGE_SIZE ? (
                    <Box sx={{ mt: 1.5 }}>
                      <UiPagination
                        page={safeScanLogPage}
                        pageSize={SCAN_LOG_PAGE_SIZE}
                        total={scanLog.length}
                        onPageChange={setScanLogPage}
                        showTotal={false}
                      />
                    </Box>
                  ) : null}
                </Box>
              ) : null}

              {receiptEvidence ? (
                <Box sx={{ mt: 2 }}>
                  <UiAlert tone="success">
                    <Box sx={{ fontWeight: 700 }}>
                      Kết quả hoàn tất nhập kho
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      Mã yêu cầu: <strong>{receiptEvidence.requestId}</strong>
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      Biến động tồn kho:{" "}
                      {receiptEvidence.movementRefs.join(", ")}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      Phiếu nhập: {receiptEvidence.receiptId}
                    </Box>
                  </UiAlert>
                </Box>
              ) : null}
            </>
          ) : null}
        </>
      </UiDialog>

      <CameraScanModal
        open={cameraTarget !== null}
        title={
          cameraTarget === "box"
            ? "Quét mã hộp bằng camera"
            : "Quét mã vạch / QR bằng camera"
        }
        onClose={() => setCameraTarget(null)}
        onDetected={(code) => {
          if (cameraTarget === "box") setBoxCode(code);
          else setScanCode(code);
          setCameraTarget(null);
          toast.success("Đã đọc mã từ camera. Kiểm tra và bấm Ghi nhận quét.");
        }}
      />

      <UiDialog
        open={cancelOpen}
        onClose={guardBackdropClose(() => setCancelOpen(false))}
        maxWidth="xs"
        fullWidth
        title="Hủy phiếu nhập"
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
              disabled={!cancelReason.trim() || cancelMutation.isPending}
              onClick={() => void handleCancel()}
            >
              {cancelMutation.isPending ? "Đang hủy..." : "Xác nhận hủy"}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={1.5}>
          <UiAlert tone="warning">
            <Box sx={{ fontWeight: 700 }}>
              Hủy là trạng thái kết thúc và không làm thay đổi tồn kho
            </Box>
            <Box sx={{ typography: "body2" }}>
              Phiếu đã hủy không thể tiếp tục quét hoặc hoàn tất nhập kho. Nếu
              cần làm lại, hãy tạo phiếu mới để bảo toàn lịch sử thao tác.
            </Box>
          </UiAlert>
          <UiTextField
            fullWidth
            multiline
            minRows={4}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            label="Lý do hủy (bắt buộc)"
            placeholder="Lý do hủy bắt buộc"
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            helperText={`${cancelReason.length}/1000`}
          />
        </Stack>
      </UiDialog>

      {confirmDialog}
    </>
  );
}

type LegacyScreenId = "IN-01" | "IN-02" | "IN-03";

export function InboundSourceScreen({
  screenId,
}: {
  screenId: LegacyScreenId;
}) {
  return (
    <>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          p: 2,
        }}
      >
        {screenId === "IN-03"
          ? "Quét & hoàn tất nhập kho được mở từ Danh sách phiếu nhập dưới dạng cửa sổ thao tác."
          : "IN-01/IN-02 được quản lý trong Danh sách phiếu nhập."}
      </Box>
    </>
  );
}
