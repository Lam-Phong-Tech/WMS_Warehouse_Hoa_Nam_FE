/* eslint-disable react-hooks/set-state-in-effect */
import { rowIndexOfBy } from "@/shared/components/data-display/row-index";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Grid,
  Stack,
  UiAlert,
  UiDialog,
  UiNumberField,
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
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
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
import { InboundSkuInfoModal } from "@/modules/inbound/components/InboundSkuInfoModal";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import type { ScanClassifyResponse } from "@/modules/scan/types";
import {
  useCancelInbound,
  useCompleteInboundCartonScan,
  useInboundDetail,
  useInboundScanEntries,
  usePostInboundReceipt,
  useScanInbound,
  useUnscanInbound,
} from "@/modules/inbound/hooks/use-inbound";
import type {
  ActiveCarton,
  InboundLine,
  InboundScanEntry,
  ReceiptEvidence,
} from "@/modules/inbound/types";
import {
  ActionButton,
  ActionIconButton,
  RowActionButton,
} from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { NUMBER_RULES, checkNumber } from "@/shared/validation/number-rules";

/** Lý do hủy phiếu phải đủ ý — dưới ngưỡng này là "ok"/"x" vô nghĩa cho tra soát. */
const CANCEL_REASON_MIN = 5;
const CANCEL_REASON_MAX = 1000;

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
};
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

/** Loại lỗi camera — dịch lúc render để effect không phụ thuộc `t`. */
type CameraError =
  | { kind: "unsupported" | "httpsRequired" | "noDevice" }
  | { kind: "text"; text: string };

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

/**
 * Mã HỘP linh kiện scan-driven: BOX-<SKU>-<seq>, ví dụ BOX-HN-COMP-BASE-003-0001
 *   -> sku_code = HN-COMP-BASE-003, box_seq = 0001
 * Mã hộp tự mang SKU linh kiện nên FE nhận diện được ngay tại client để mở ô
 * nhập số lượng, còn việc tạo SKU/dòng/đăng ký hộp do backend làm authoritative
 * (khớp BoxCodeParser phía BE). SKU code có thể chứa '-' và kết thúc bằng chữ
 * số: regex greedy giữ đúng đuôi '-<digits>' cuối làm box_seq.
 */
function parseBoxCode(
  code: string,
): { boxCode: string; skuCode: string; boxSeq: string } | null {
  const normalized = code.trim().toUpperCase();
  const matched = /^BOX-(.+)-(\d+)$/.exec(normalized);
  if (!matched) return null;
  const skuCode = matched[1].trim();
  if (skuCode === "") return null;
  return { boxCode: normalized, skuCode, boxSeq: matched[2] };
}

/** Trích sku_code từ QR composite HN…|SKU=<code>|ITEM=… để hiển thị khi hỏi loại. */
function parseCompositeSkuCode(code: string): string | null {
  const matched = /\|SKU=([^|]+)/i.exec(code.trim());
  return matched ? matched[1].trim().toUpperCase() : null;
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
  const t = useT();
  // Giữ LOẠI lỗi, không giữ câu đã dịch: effect camera không phụ thuộc `t` nên
  // đổi ngôn ngữ không khởi động lại luồng camera; câu chữ dịch lúc render.
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
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
        setCameraError({ kind: "unsupported" });
        return;
      }
      if (!window.isSecureContext) {
        setCameraError({ kind: "httpsRequired" });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError({ kind: "noDevice" });
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
        setCameraError({ kind: "text", text: getCameraErrorMessage(error) });
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
          {t("inbound.camera.closeManual")}
        </ActionButton>
      }
    >
      {cameraError ? (
        <UiAlert tone="warning">
          {cameraError.kind === "text"
            ? cameraError.text
            : t(`inbound.camera.${cameraError.kind}`)}
        </UiAlert>
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
                {cameraReady
                  ? t("inbound.camera.ready")
                  : t("inbound.camera.initializing")}
              </Box>
              <Box sx={{ typography: "body2" }}>{t("inbound.camera.hint")}</Box>
            </UiAlert>
          </Box>
        </>
      )}
    </UiDialog>
  );
}

function errorDescription(error: unknown, t: TranslateFn) {
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return [
    normalized.status
      ? t("inbound.error.responseCode", { status: normalized.status })
      : undefined,
    normalized.code
      ? t("inbound.error.errorCode", { code: normalized.code })
      : undefined,
    requestId ? t("inbound.error.requestId", { id: requestId }) : undefined,
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
  const t = useT();
  const detailQuery = useInboundDetail(documentId);
  const skuQuery = useMvpSkus({ status: "ACTIVE", per_page: 100 });
  const scanEntriesQuery = useInboundScanEntries(documentId, "ALL");
  const scanMutation = useScanInbound();
  const unscanMutation = useUnscanInbound();
  const postMutation = usePostInboundReceipt();
  const cancelMutation = useCancelInbound();
  const completeCartonMutation = useCompleteInboundCartonScan();
  const [scanCode, setScanCode] = useState("");
  // Linh kiện theo hộp đang chờ nhập số lượng: quét mã BOX-<SKU>-<seq> xong,
  // hệ thống mở ô số lượng + nút Xác nhận (mã hộp tự mang SKU linh kiện).
  const [pendingBox, setPendingBox] = useState<{
    boxCode: string;
    skuCode: string;
  } | null>(null);
  // SKU mới (mã item) lần đầu chưa rõ loại: giữ lại lần quét để hỏi Sản phẩm /
  // Linh kiện rồi gửi lại kèm new_sku_type.
  const [pendingNewSku, setPendingNewSku] = useState<{
    code: string;
    quantity: number;
    containerId?: string;
    skuCode: string;
  } | null>(null);
  // Giữ CHUỖI người dùng gõ để báo lỗi thay vì ép về 1 im lặng (ô number cũ
  // nhận "-5"/"1e5" rồi Number() || 1 nuốt mất lỗi).
  const [quantity, setQuantity] = useState("1");
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [scanVersion, setScanVersion] = useState<number | null>(null);
  const [scanLog, setScanLog] = useState<ScanLogRow[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(
    null,
  );
  const [receiptEvidence, setReceiptEvidence] =
    useState<ReceiptEvidence | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
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
  }, [detail]);

  // GĐ1-REQ-004: số lượng nhập đến từ hàng thực quét/đếm — không còn khái niệm
  // "dự kiến/còn lại" làm gate; Post chỉ cần đã ghi nhận ít nhất một đơn vị.
  const totalScanned =
    detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const hasScanned = totalScanned > 0;
  const [skuInfoLine, setSkuInfoLine] = useState<InboundLine | null>(null);
  // Dòng có SKU chưa đủ thông tin. Cờ do BE tính (SkuInboundInfoRule) theo ĐÚNG
  // luật mà guard Post Receipt dùng, FE chỉ đọc lại để báo sớm và khoá nút —
  // không tự suy từ danh sách SKU tải sẵn (danh sách đó giới hạn per_page nên
  // thiếu đúng những SKU vừa sinh ra lúc quét).
  const linesMissingInfo = useMemo(
    () => (detail?.lines ?? []).filter((line) => !line.infoComplete),
    [detail?.lines],
  );
  const hasMissingSkuInfo = linesMissingInfo.length > 0;
  const isMutable =
    detail?.document.status === "DRAFT" ||
    detail?.document.status === "SCANNING";
  const busy = scanMutation.isPending;
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
      const message = t("inbound.carton.wrongType", {
        code: cartonCode,
        type: classified.container_type,
      });
      pushCartonLog(message, false);
      toast.error(message);
      return;
    }
    if (activeCarton && activeCarton.id !== cartonId) {
      const message = t("inbound.carton.finishFirst", {
        active: activeCarton.code,
        next: cartonCode,
      });
      pushCartonLog(message, false);
      toast.error(message);
      return;
    }
    setScanCode("");
    if (activeCarton?.id === cartonId) {
      toast.info(t("inbound.carton.alreadyActive", { code: cartonCode }));
      return;
    }
    setActiveCarton({
      id: cartonId,
      code: cartonCode,
      skuId: classified.sku_id ?? undefined,
    });
    pushCartonLog(t("inbound.carton.activeBanner", { code: cartonCode }), true);
    toast.success(t("inbound.carton.opened", { code: cartonCode }));
  };

  const handleCompleteCarton = async () => {
    if (!activeCarton || !canScan || !isMutable) return;
    if (activeCartonScannedQty <= 0) {
      setActiveCarton(null);
      toast.info(t("inbound.carton.closedEmpty", { code: activeCarton.code }));
      return;
    }
    try {
      const result = await completeCartonMutation.mutateAsync({
        id: documentId,
        containerId: activeCarton.id,
      });
      setActiveCarton(null);
      toast.success(
        t("inbound.carton.closed", {
          code: result.cartonCode || activeCarton.code,
          qty: result.actualItemQty,
        }),
      );
      await scanEntriesQuery.refetch();
      onChanged?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("inbound.carton.closeError")));
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
    }
  };

  /**
   * Ghi nhận một lần quét lên server (dùng chung cho sản phẩm/linh kiện dán mã
   * và cho hộp linh kiện đã nhập số lượng). Server tự đối chiếu SKU + tự tạo
   * dòng; với mã hộp còn tự tạo COMPONENT SKU + đăng ký hộp. Trả về true nếu ghi
   * nhận thành công.
   */
  const submitScan = async ({
    code,
    quantity: scanQuantity,
    containerId,
    boxSkuCode,
    newSkuType,
  }: {
    code: string;
    quantity: number;
    containerId?: string;
    boxSkuCode?: string;
    newSkuType?: "PRODUCT" | "COMPONENT";
  }): Promise<boolean> => {
    if (!detail || scanVersion === null) return false;
    const scanFingerprint = [
      code,
      scanQuantity,
      containerId ?? "",
      newSkuType ?? "",
    ].join("|");
    const pendingScanKey = scanKeyRef.current;
    const scanAttemptKey =
      pendingScanKey?.fingerprint === scanFingerprint
        ? pendingScanKey.key
        : makeKey(`inbound-scan-${documentId}`);
    scanKeyRef.current = { key: scanAttemptKey, fingerprint: scanFingerprint };
    try {
      const result = await scanMutation.mutateAsync({
        id: documentId,
        code,
        ifMatch: scanVersion,
        // Luôn gửi raw code_value: server parse QR sản phẩm/mã hộp authoritative
        // và tự match/ tạo dòng. Không còn resolve line phía client.
        includeCodeValue: true,
        quantity: scanQuantity,
        containerId,
        newSkuType,
        idempotencyKey: scanAttemptKey,
      });
      const first = result[0];
      if (!first) throw new Error(t("inbound.scan.noResult"));
      scanKeyRef.current = null;
      setScanVersion(first.version);
      const identityText = [
        first.sku ? `SKU ${first.sku}` : boxSkuCode ? `SKU ${boxSkuCode}` : "",
        first.item_unique ?? "",
      ]
        .filter(Boolean)
        .join(" · ");
      const candidateText =
        first.resolution_status === "NEW_ITEM_CANDIDATE"
          ? ` · ${QR_RESOLUTION_STATUS_LABELS.NEW_ITEM_CANDIDATE}`
          : "";
      const kindText = boxSkuCode
        ? t("inbound.scan.componentBox")
        : activeCarton
          ? t("inbound.scan.inCarton", { code: activeCarton.code })
          : "";
      setScanLog((current) =>
        [
          {
            key: makeKey("scan"),
            code,
            result: first.replayed
              ? t("inbound.scan.duplicateEntry")
              : t("inbound.scan.validEntry", {
                  qty: scanQuantity,
                  identity: identityText ? ` · ${identityText}` : "",
                  candidate: candidateText,
                  kind: kindText,
                }),
            success: true,
            lineId: first.line_id,
          },
          ...current,
        ].slice(0, 20),
      );
      if (first.replayed) {
        toast.success(t("inbound.scan.replayed"));
      }
      setScanCode("");
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
      return true;
    } catch (error) {
      const errorText = getApiErrorMessage(
        error,
        t("inbound.scan.invalidCode"),
      );
      const errorCode = normalizeError(error).code ?? undefined;
      scanKeyRef.current = shouldReuseScanKey(error)
        ? { key: scanAttemptKey, fingerprint: scanFingerprint }
        : null;
      // SKU mới lần đầu: chưa xác định được loại từ mã → hỏi người dùng chọn
      // Sản phẩm / Linh kiện rồi gửi lại kèm new_sku_type (không báo lỗi đỏ).
      if (errorCode === "NEW_SKU_TYPE_REQUIRED" && !newSkuType) {
        setPendingNewSku({
          code,
          quantity: scanQuantity,
          containerId,
          skuCode: parseCompositeSkuCode(code) ?? code,
        });
        return false;
      }
      setScanLog((current) =>
        [
          {
            key: makeKey("scan-error"),
            code,
            result: errorText,
            success: false,
            errorCode,
          },
          ...current,
        ].slice(0, 20),
      );
      toast.error(errorText);
      await detailQuery.refetch();
      onChanged?.();
      return false;
    }
  };

  /**
   * Một ô quét thống nhất: nhân viên chỉ quét, hệ thống tự nhận diện.
   *  - Mã HỘP linh kiện (BOX-<SKU>-<seq>) → mở ô nhập số lượng + nút Xác nhận.
   *  - Mã thùng carton → đặt làm "thùng đang quét" cho sản phẩm.
   *  - Mã sản phẩm / linh kiện dán mã → ghi nhận +1, server tự đối chiếu SKU.
   */
  const handleScan = async (scannedCode?: string) => {
    if (!detail || scanVersion === null || !canScan || !isMutable) return;
    const normalizedCode = (scannedCode ?? scanCode).trim().toUpperCase();
    if (!normalizedCode) {
      toast.error(t("inbound.scan.emptyInput"));
      return;
    }

    // Linh kiện theo hộp: mã hộp mang sẵn SKU → mở ô nhập số lượng đếm tay.
    const box = parseBoxCode(normalizedCode);
    if (box) {
      setPendingBox({ boxCode: box.boxCode, skuCode: box.skuCode });
      setQuantity("1");
      setQuantityError(null);
      setScanCode("");
      return;
    }

    // Mã sản phẩm dạng thường (không phải QR composite): thử nhận diện thùng carton.
    if (!looksCompositeProductQr(normalizedCode)) {
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

    // Sản phẩm / linh kiện dán mã: +1, gắn vào thùng đang quét nếu có.
    await submitScan({
      code: normalizedCode,
      quantity: 1,
      containerId: activeCarton?.id,
    });
  };

  // Xác nhận số lượng linh kiện trong hộp đã quét, rồi quay lại chờ quét tiếp.
  const handleConfirmBox = async () => {
    if (!pendingBox || !canScan || !isMutable) return;
    // Cùng NUMBER_RULES.quantity với ô nhập: nguyên, 1…1.000.000.
    const qtyCheck = checkNumber(quantity, {
      ...NUMBER_RULES.quantity,
      required: true,
    });
    if (!qtyCheck.ok) {
      setQuantityError(qtyCheck.message);
      return;
    }
    const ok = await submitScan({
      code: pendingBox.boxCode,
      quantity: qtyCheck.value ?? 1,
      boxSkuCode: pendingBox.skuCode,
    });
    if (ok) {
      setPendingBox(null);
      setQuantity("1");
      setQuantityError(null);
    }
  };

  const handleCancelBox = () => {
    setPendingBox(null);
    setQuantity("1");
    setQuantityError(null);
  };

  // Người dùng đã chọn loại cho SKU mới: gửi lại lần quét kèm new_sku_type.
  const handleChooseNewSkuType = async (type: "PRODUCT" | "COMPONENT") => {
    if (!pendingNewSku) return;
    const pending = pendingNewSku;
    setPendingNewSku(null);
    await submitScan({
      code: pending.code,
      quantity: pending.quantity,
      containerId: pending.containerId,
      newSkuType: type,
    });
  };

  const handleUnscan = async (entry: InboundScanEntry) => {
    if (!detail || scanVersion === null || !canScan || !isMutable) return;
    // Gỡ mã là thao tác không hoàn tác được bằng nút bấm: muốn thêm lại phải
    // quét lại sản phẩm thật — bắt buộc xác nhận trước khi gọi server.
    const accepted = await confirm({
      title: t("inbound.removeEntry.title"),
      content: t("inbound.removeEntry.description"),
      confirmText: t("inbound.removeEntry.confirm"),
      cancelText: t("inbound.removeEntry.cancel"),
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
        t("inbound.removeEntry.done", { qty: result.scannedQuantity }),
      );
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("inbound.removeEntry.error")));
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
      hasMissingSkuInfo ||
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
          ? t("inbound.post.replayed")
          : t("inbound.post.success"),
      );
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("inbound.post.error")));
      await detailQuery.refetch();
      onChanged?.();
    }
  };

  const handleCancel = async () => {
    if (!detail || scanVersion === null || !cancelReason.trim() || !canCancel)
      return;
    const reason = cancelReason.trim();
    if (reason.length < CANCEL_REASON_MIN) {
      setCancelReasonError(
        t("inbound.scan.cancelReasonShort", { min: CANCEL_REASON_MIN }),
      );
      return;
    }
    if (reason.length > CANCEL_REASON_MAX) {
      setCancelReasonError(
        t("shared.validation.textMaxLength", { max: CANCEL_REASON_MAX }),
      );
      return;
    }
    try {
      await cancelMutation.mutateAsync({
        id: documentId,
        reason: cancelReason.trim(),
        ifMatch: scanVersion,
      });
      toast.success(t("inbound.cancel.success"));
      setCancelOpen(false);
      onChanged?.();
      dialog.close();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("inbound.cancel.error")));
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
        (detail?.lines
          ? rowIndexOfBy(detail.lines, line, (item) => item.id)
          : 0) + 1,
    },
    {
      key: "sku",
      header: "SKU",
      width: 220,
      render: (line) => {
        // Ưu tiên mã SKU đã gắn sẵn trên dòng (BE trả product_code/product_name
        // qua quan hệ product — luôn đúng, không phụ thuộc trang nào). skuById chỉ
        // là fallback cho dữ liệu cũ chưa qua BE này; bản thân nó bị giới hạn
        // per_page nên KHÔNG chứa hết mọi SKU — không được coi là nguồn chính.
        const skuCode = line.sku || skuById.get(line.productId)?.sku_code;
        return skuCode ? (
          <SkuLink id={line.productId} code={skuCode} />
        ) : (
          <CopyableId value={line.productId} />
        );
      },
    },
    {
      key: "name",
      header: t("inbound.detail.colNameType"),
      width: 250,
      render: (line) => {
        const sku = skuById.get(line.productId);
        const name = line.skuName || sku?.sku_name;
        // productType gắn thẳng trên dòng (BE) — nguồn chính, không phụ thuộc
        // skuById (bị giới hạn per_page nên có thể miss SKU nằm ngoài trang đầu).
        const productType = line.productType || sku?.sku_type;
        return (
          <div>
            <div>{name || EMPTY_TEXT}</div>
            {productType ? (
              <UiStatusBadge
                tone="neutral"
                sx={{ mt: 0.5 }}
                label={businessLabel(SKU_TYPE_LABELS, productType)}
              />
            ) : null}
          </div>
        );
      },
    },
    {
      key: "scanned",
      header: t("inbound.detail.colScannedQty"),
      width: 140,
      align: "right",
      render: (line) => <strong>{line.scanned}</strong>,
    },
    {
      key: "info",
      // Cột nút: không bọc lớp cắt chữ, tránh xén mất nút.
      truncate: 0,
      header: t("inbound.detail.colInfo"),
      width: 210,
      render: (line) =>
        line.infoComplete ? (
          <UiStatusBadge
            tone="success"
            label={t("inbound.detail.infoComplete")}
          />
        ) : (
          <Stack
            direction="row"
            sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}
          >
            <UiStatusBadge
              tone="warning"
              sx={{ flexShrink: 0 }}
              label={t("inbound.detail.infoIncomplete")}
            />
            {canScan && isMutable ? (
              <RowActionButton
                kind="edit"
                disabled={working}
                onClick={() => setSkuInfoLine(line)}
              >
                {t("inbound.detail.fillInfo")}
              </RowActionButton>
            ) : null}
          </Stack>
        ),
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
          rowIndexOfBy(pagedScanEntries, entry, (item) => item.id),
        ),
    },
    {
      key: "code",
      header: t("inbound.detail.colCode"),
      width: 240,
      render: (entry) => (
        <Box component="span" sx={{ fontFamily: "var(--wms-font-family)" }}>
          {entry.itemCode ||
            entry.serialNumber ||
            entry.candidateItemUnique ||
            entry.containerCode ||
            EMPTY_TEXT}
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
            <strong>{entry.sku || EMPTY_TEXT}</strong>
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
      header: t("inbound.detail.colResult"),
      width: 180,
      render: (entry) =>
        entry.status === "ACTIVE" ? (
          entry.candidateItemUnique && !entry.itemId ? (
            <UiStatusBadge
              tone="info"
              icon={<CheckCircleOutlined />}
              label={t("inbound.newSku.candidateSuffix")}
            />
          ) : (
            <UiStatusBadge
              tone="success"
              icon={<CheckCircleOutlined />}
              label={t("inbound.detail.resultValid")}
            />
          )
        ) : (
          <UiStatusBadge
            tone="neutral"
            icon={<CloseCircleOutlined />}
            label={t("inbound.detail.resultRemoved")}
          />
        ),
    },
    {
      key: "source",
      header: t("inbound.detail.colSource"),
      width: 140,
      render: (entry) => (
        <UiStatusBadge
          tone="neutral"
          label={
            entry.scanSource === "CAMERA_OR_MANUAL_CODE"
              ? t("inbound.detail.sourceCamera")
              : t("inbound.detail.sourceManual")
          }
        />
      ),
    },
    {
      key: "actions",
      // Cột nút: không bọc lớp cắt chữ, tránh xén mất nút.
      truncate: 0,
      header: t("inbound.detail.colAction"),
      width: 110,
      render: (entry) =>
        entry.status === "ACTIVE" && canScan && isMutable ? (
          <RowActionButton
            kind="delete"
            disabled={working}
            onClick={() => void handleUnscan(entry)}
          >
            {t("inbound.detail.removeAction")}
          </RowActionButton>
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
    {
      key: "code",
      header: t("inbound.detail.colCode"),
      width: 220,
      render: (row) => row.code,
    },
    {
      key: "result",
      header: t("inbound.detail.colResult"),
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
                ? t("inbound.detail.titleWithCode", {
                    code: detail.document.code || t("inbound.list.noCode"),
                  })
                : t("inbound.detail.title")}
            </span>
            <ActionIconButton
              kind="close"
              label={t("common.close")}
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
              {t("common.close")}
            </ActionButton>
            {detail && canCancel && isMutable ? (
              <ActionButton
                kind="cancel"
                disabled={working}
                onClick={() => setCancelOpen(true)}
              >
                {t("inbound.cancel.trigger")}
              </ActionButton>
            ) : null}
            {detail && isMutable ? (
              <ActionButton
                kind="confirm"
                disabled={
                  !canPost ||
                  !hasScanned ||
                  hasMissingSkuInfo ||
                  detail.document.status !== "SCANNING" ||
                  postMutation.isPending
                }
                onClick={() => void handlePost()}
              >
                {postMutation.isPending
                  ? t("inbound.detail.posting")
                  : t("inbound.detail.post")}
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
                    t("inbound.detail.loadError"),
                  )}
                </Box>
                <Box sx={{ typography: "body2" }}>
                  {errorDescription(detailQuery.error, t)}
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
                      {t("inbound.detail.fieldDocument")}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {detail.document.code || EMPTY_TEXT}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      {t("inbound.detail.fieldSource")}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {detail.document.source || EMPTY_TEXT}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      {t("inbound.detail.fieldStatus")}
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
                      {t("inbound.detail.fieldVersion")}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {scanVersion ?? detail.document.version}
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    label={t("inbound.detail.statValidCodes")}
                    value={totalScanned}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    label={t("inbound.detail.statSkuLines")}
                    value={detail.lines.length}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    label={t("inbound.detail.statRemoved")}
                    value={removedEntryCount}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    label={t("inbound.detail.statSessionErrors")}
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
                    {t("inbound.scan.sectionTitle")}
                  </Box>
                  {activeCarton ? (
                    <Box sx={{ mb: 1.5 }}>
                      <UiAlert tone="info">
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ alignItems: "center" }}
                        >
                          <InboxOutlined />
                          <Box sx={{ fontWeight: 700 }}>
                            {t("inbound.carton.activeLabel", {
                              code: activeCarton.code,
                            })}
                          </Box>
                        </Stack>
                        <Box sx={{ typography: "body2" }}>
                          {t("inbound.carton.scannedPrefix")}{" "}
                          <strong>{activeCartonScannedQty}</strong>{" "}
                          {t("inbound.carton.scannedSuffix")}{" "}
                          {t("inbound.carton.scannedInto", {
                            code: activeCarton.code,
                          })}
                        </Box>
                        <ActionButton
                          kind="scan"
                          sx={{ mt: 1 }}
                          disabled={!canScan || working}
                          onClick={() => void handleCompleteCarton()}
                        >
                          {completeCartonMutation.isPending
                            ? t("inbound.detail.posting")
                            : t("inbound.carton.finishButton")}
                        </ActionButton>
                      </UiAlert>
                    </Box>
                  ) : null}

                  {pendingBox ? (
                    /* Đã quét một mã HỘP linh kiện: hiện ô nhập số lượng đếm tay
                       + nút Xác nhận. Xác nhận xong quay lại chờ quét mã tiếp. */
                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "primary.main",
                        borderRadius: 2,
                        p: 2,
                        mb: 1.5,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: "center", mb: 1 }}
                      >
                        <InboxOutlined color="primary" />
                        <Box sx={{ fontWeight: 700 }}>
                          {t("inbound.box.title", { sku: pendingBox.skuCode })}
                        </Box>
                      </Stack>
                      <Box
                        sx={{
                          typography: "body2",
                          color: "text.secondary",
                          mb: 1.5,
                        }}
                      >
                        {t("inbound.box.codePrefix")}{" "}
                        <strong>{pendingBox.boxCode}</strong>{" "}
                        {t("inbound.box.description", {
                          sku: pendingBox.skuCode,
                        })}
                      </Box>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        sx={{ alignItems: { sm: "flex-end" } }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              typography: "caption",
                              color: "text.secondary",
                              mb: 0.5,
                            }}
                          >
                            {t("inbound.box.qtyLabel")}
                          </Box>
                          <UiNumberField
                            autoFocus
                            value={quantity}
                            rule={NUMBER_RULES.quantity}
                            disabled={!canScan || busy}
                            onChange={(next) => {
                              setQuantity(next);
                              if (quantityError) setQuantityError(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleConfirmBox();
                              }
                            }}
                            sx={{ width: "100%", maxWidth: 220 }}
                            slotProps={{
                              htmlInput: {
                                "aria-label": t("inbound.box.qtyLabel"),
                              },
                            }}
                            error={Boolean(quantityError)}
                            helperText={quantityError ?? undefined}
                          />
                        </Box>
                        <ActionButton
                          kind="scan"
                          disabled={!canScan || busy}
                          onClick={() => void handleConfirmBox()}
                        >
                          {busy
                            ? t("inbound.detail.posting")
                            : t("inbound.box.confirm")}
                        </ActionButton>
                        <ActionButton
                          kind="cancel"
                          disabled={busy}
                          onClick={handleCancelBox}
                        >
                          {t("inbound.box.cancel")}
                        </ActionButton>
                      </Stack>
                    </Box>
                  ) : (
                    <Box sx={{ mb: 1.5 }}>
                      <Box
                        sx={{
                          typography: "caption",
                          color: "text.secondary",
                          mb: 0.5,
                        }}
                      >
                        {t("inbound.scan.hint")}
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
                            placeholder={t("inbound.scan.inputPlaceholder")}
                            onChange={setScanCode}
                            onScan={(code) => void handleScan(code)}
                          />
                        </Box>
                      </Stack>
                    </Box>
                  )}
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
                        ? t("inbound.post.successTitle")
                        : t("inbound.post.failedTitle")}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {detail.document.status === "POSTED"
                        ? ""
                        : t("inbound.post.cancelledNote")}
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
                  {t("inbound.detail.receivedTitle")}
                </Box>
                {hasMissingSkuInfo ? (
                  <Box sx={{ mb: 2 }}>
                    <UiAlert tone="warning">
                      <Box sx={{ fontWeight: 700 }}>
                        {t("inbound.detail.infoBlockedTitle", {
                          count: linesMissingInfo.length,
                        })}
                      </Box>
                      <Box sx={{ typography: "body2" }}>
                        {t("inbound.detail.infoBlockedBody")}
                      </Box>
                    </UiAlert>
                  </Box>
                ) : null}
                <ResponsiveDataTable<InboundLine>
                  columns={lineColumns}
                  rows={detail.lines}
                  rowKey={(line) => line.id}
                  loading={detailQuery.isFetching}
                  emptyText={t("inbound.detail.receivedEmpty")}
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
                  {t("inbound.detail.entriesTitle")}
                </Box>
                <Box
                  sx={{ typography: "caption", color: "text.secondary", mb: 1 }}
                >
                  {`${t("inbound.detail.entriesSummary", {
                    valid: activeEntries.length,
                  })}${
                    removedEntryCount
                      ? t("inbound.detail.entriesRemovedSuffix", {
                          count: removedEntryCount,
                        })
                      : ""
                  }`}
                </Box>
                {scanEntriesQuery.isError ? (
                  <UiAlert tone="error">
                    <Box sx={{ fontWeight: 700 }}>
                      {getApiErrorMessage(
                        scanEntriesQuery.error,
                        t("inbound.detail.entriesLoadError"),
                      )}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {errorDescription(scanEntriesQuery.error, t)}
                    </Box>
                  </UiAlert>
                ) : (
                  <>
                    <ResponsiveDataTable<InboundScanEntry>
                      columns={scanEntryColumns}
                      rows={pagedScanEntries}
                      rowKey={(entry) => entry.id}
                      loading={scanEntriesQuery.isLoading}
                      emptyText={t("inbound.detail.entriesEmpty")}
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
                    {t("inbound.detail.sessionTitle")}
                  </Box>
                  {/* Nhật ký phiên là state cục bộ (không có query) nên không có
                      cờ loading tương ứng; chỉ bổ sung emptyText. */}
                  <ResponsiveDataTable<ScanLogRow>
                    columns={scanLogColumns}
                    rows={pagedScanLog}
                    rowKey={(row) => row.key}
                    emptyText={t("inbound.detail.sessionEmpty")}
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
                      {t("inbound.post.evidenceTitle")}
                    </Box>
                    {/* KHÔNG hiển thị request_id ở màn THÀNH CÔNG: đó là UUID
                      đối chiếu log do middleware sinh cho mỗi lượt gọi API, không
                      phải chứng từ nghiệp vụ nên không có mã đọc được. Nó chỉ có
                      ích khi BÁO LỖI cho kỹ thuật — nơi duy nhất còn hiển thị là
                      ApiErrorAlert/PvErrorState (màn lỗi, có nhãn "để tra soát"). */}
                    <Box
                      sx={{
                        typography: "body2",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      {t("inbound.post.evidenceDocument")}{" "}
                      {receiptEvidence.receiptCode ? (
                        <strong>{receiptEvidence.receiptCode}</strong>
                      ) : (
                        <CopyableId value={receiptEvidence.receiptId} />
                      )}
                    </Box>
                    <Box
                      sx={{
                        typography: "body2",
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 0.5,
                      }}
                    >
                      {t("inbound.post.evidenceMovements", {
                        count: receiptEvidence.movements.length,
                      })}
                      {receiptEvidence.movements.map((movement, index) => (
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
                          {index < receiptEvidence.movements.length - 1
                            ? ","
                            : ""}
                        </Box>
                      ))}
                    </Box>
                  </UiAlert>
                </Box>
              ) : null}
            </>
          ) : null}
        </>
      </UiDialog>

      <CameraScanModal
        open={cameraOpen}
        title={t("inbound.camera.title")}
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          setCameraOpen(false);
          void handleScan(code);
        }}
      />

      <UiDialog
        open={pendingNewSku !== null}
        onClose={guardBackdropClose(() => setPendingNewSku(null))}
        maxWidth="xs"
        fullWidth
        title={t("inbound.newSku.title")}
        actions={
          <>
            <ActionButton
              kind="back"
              disabled={busy}
              onClick={() => setPendingNewSku(null)}
            >
              {t("inbound.newSku.cancel")}
            </ActionButton>
            <ActionButton
              kind="confirm"
              disabled={busy}
              onClick={() => void handleChooseNewSkuType("COMPONENT")}
            >
              {t("inbound.newSku.component")}
            </ActionButton>
            <ActionButton
              kind="confirm"
              disabled={busy}
              onClick={() => void handleChooseNewSkuType("PRODUCT")}
            >
              {t("inbound.newSku.product")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={1.5}>
          <UiAlert tone="info">
            <Box sx={{ fontWeight: 700 }}>
              {t("inbound.newSku.heading", {
                code: pendingNewSku?.skuCode ?? "",
              })}
            </Box>
            <Box sx={{ typography: "body2" }}>
              {t("inbound.newSku.description")}
            </Box>
          </UiAlert>
        </Stack>
      </UiDialog>

      <UiDialog
        open={cancelOpen}
        onClose={guardBackdropClose(() => setCancelOpen(false))}
        maxWidth="xs"
        fullWidth
        title={t("inbound.cancel.title")}
        actions={
          <>
            <ActionButton
              kind="back"
              onClick={() => setCancelOpen(false)}
              disabled={cancelMutation.isPending}
            >
              {t("inbound.cancel.back")}
            </ActionButton>
            <ActionButton
              kind="confirm"
              disabled={!cancelReason.trim() || cancelMutation.isPending}
              onClick={() => void handleCancel()}
            >
              {cancelMutation.isPending
                ? t("inbound.cancel.pending")
                : t("inbound.cancel.confirm")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={1.5}>
          <UiAlert tone="warning">
            <Box sx={{ fontWeight: 700 }}>{t("inbound.cancel.warning")}</Box>
            <Box sx={{ typography: "body2" }}>{t("inbound.cancel.note")}</Box>
          </UiAlert>
          <UiTextField
            fullWidth
            multiline
            minRows={4}
            value={cancelReason}
            onChange={(event) => {
              setCancelReason(event.target.value);
              if (cancelReasonError) setCancelReasonError(null);
            }}
            label={t("inbound.cancel.reasonLabel")}
            placeholder={t("inbound.cancel.reasonPlaceholder")}
            slotProps={{ htmlInput: { maxLength: CANCEL_REASON_MAX } }}
            error={Boolean(cancelReasonError)}
            helperText={
              cancelReasonError ?? `${cancelReason.length}/${CANCEL_REASON_MAX}`
            }
          />
        </Stack>
      </UiDialog>

      {skuInfoLine ? (
        <InboundSkuInfoModal
          documentId={documentId}
          line={skuInfoLine}
          onClose={() => setSkuInfoLine(null)}
          onSaved={() => {
            setSkuInfoLine(null);
            void detailQuery.refetch();
          }}
        />
      ) : null}

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
  const t = useT();
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
          ? t("inbound.placeholder.scanModal")
          : t("inbound.placeholder.list")}
      </Box>
    </>
  );
}
