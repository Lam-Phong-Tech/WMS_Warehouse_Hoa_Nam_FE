/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Grid,
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
import { CopyableId } from "@/shared/components/data-display/CopyableId";
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
  const [quantity, setQuantity] = useState(1);
  const [scanVersion, setScanVersion] = useState<number | null>(null);
  const [scanLog, setScanLog] = useState<ScanLogRow[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
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
      if (!first) throw new Error("Hệ thống không trả kết quả quét.");
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
        ? " · hộp linh kiện"
        : activeCarton
          ? ` · thùng ${activeCarton.code}`
          : "";
      setScanLog((current) =>
        [
          {
            key: makeKey("scan"),
            code,
            result: first.replayed
              ? "Hợp lệ · đã ghi nhận trước đó, không cộng thêm"
              : `Hợp lệ · +${scanQuantity}${identityText ? ` · ${identityText}` : ""}${candidateText}${kindText}`,
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
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
      return true;
    } catch (error) {
      const errorText = getApiErrorMessage(error, "Mã quét không hợp lệ.");
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
      toast.error("Vui lòng quét hoặc nhập một mã.");
      return;
    }

    // Linh kiện theo hộp: mã hộp mang sẵn SKU → mở ô nhập số lượng đếm tay.
    const box = parseBoxCode(normalizedCode);
    if (box) {
      setPendingBox({ boxCode: box.boxCode, skuCode: box.skuCode });
      setQuantity(1);
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
    const qty = Math.max(1, Number(quantity) || 1);
    const ok = await submitScan({
      code: pendingBox.boxCode,
      quantity: qty,
      boxSkuCode: pendingBox.skuCode,
    });
    if (ok) {
      setPendingBox(null);
      setQuantity(1);
    }
  };

  const handleCancelBox = () => {
    setPendingBox(null);
    setQuantity(1);
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
      render: (line) => {
        const skuCode = skuById.get(line.productId)?.sku_code;
        return skuCode ? (
          <strong>{skuCode}</strong>
        ) : (
          <CopyableId value={line.productId} />
        );
      },
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
                          {`Hộp linh kiện: ${pendingBox.skuCode}`}
                        </Box>
                      </Stack>
                      <Box
                        sx={{
                          typography: "body2",
                          color: "text.secondary",
                          mb: 1.5,
                        }}
                      >
                        Mã hộp <strong>{pendingBox.boxCode}</strong> chứa linh
                        kiện <strong>{pendingBox.skuCode}</strong>. Nhập số lượng
                        đếm được trong hộp rồi bấm Xác nhận. Nếu SKU chưa có trong
                        kho, hệ thống sẽ tự tạo và bạn bổ sung thông tin sau.
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
                            Số lượng linh kiện trong hộp *
                          </Box>
                          <UiTextField
                            type="number"
                            autoFocus
                            value={quantity}
                            disabled={!canScan || busy}
                            onChange={(event) =>
                              setQuantity(Number(event.target.value) || 1)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleConfirmBox();
                              }
                            }}
                            sx={{ width: "100%", maxWidth: 220 }}
                            slotProps={{ htmlInput: { min: 1 } }}
                          />
                        </Box>
                        <ActionButton
                          kind="scan"
                          disabled={!canScan || busy}
                          onClick={() => void handleConfirmBox()}
                        >
                          {busy ? "Đang xử lý..." : "Xác nhận"}
                        </ActionButton>
                        <ActionButton
                          kind="cancel"
                          disabled={busy}
                          onClick={handleCancelBox}
                        >
                          Hủy
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
                        Quét sản phẩm hoặc mã hộp linh kiện — hệ thống tự nhận
                        diện: sản phẩm/linh kiện dán mã ghi nhận +1, mã hộp
                        (BOX-…) mở ô nhập số lượng.
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
                            placeholder="Quét sản phẩm hoặc mã hộp linh kiện (BOX-…)"
                            onChange={setScanCode}
                            onScan={(code) => void handleScan(code)}
                          />
                        </Box>
                        <ActionButton
                          kind="camera"
                          disabled={!canScan || busy}
                          onClick={() => setCameraOpen(true)}
                          sx={{ flexShrink: 0 }}
                        >
                          Quét bằng camera
                        </ActionButton>
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
                        ? "Nhập kho thành công"
                        : "Nhập kho thất bại, phiếu đã bị hủy"}
                    </Box>
                    <Box sx={{ typography: "body2" }}>
                      {detail.document.status === "POSTED"
                        ? ""
                        : "Phiếu đã hủy không làm thay đổi tồn kho. "}
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
                    <Box
                      sx={{
                        typography: "body2",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      Mã yêu cầu:{" "}
                      <CopyableId value={receiptEvidence.requestId} />
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
                      Biến động tồn kho ({receiptEvidence.movementRefs.length}):
                      {receiptEvidence.movementRefs.map((ref) => (
                        <CopyableId key={ref} value={ref} />
                      ))}
                    </Box>
                    <Box
                      sx={{
                        typography: "body2",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      Phiếu nhập: <CopyableId value={receiptEvidence.receiptId} />
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
        title="Quét mã vạch / QR / hộp bằng camera"
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
        title="Đây là sản phẩm hay linh kiện?"
        actions={
          <>
            <ActionButton
              kind="back"
              disabled={busy}
              onClick={() => setPendingNewSku(null)}
            >
              Hủy
            </ActionButton>
            <ActionButton
              kind="confirm"
              disabled={busy}
              onClick={() => void handleChooseNewSkuType("COMPONENT")}
            >
              Linh kiện
            </ActionButton>
            <ActionButton
              kind="confirm"
              disabled={busy}
              onClick={() => void handleChooseNewSkuType("PRODUCT")}
            >
              Sản phẩm
            </ActionButton>
          </>
        }
      >
        <Stack spacing={1.5}>
          <UiAlert tone="info">
            <Box sx={{ fontWeight: 700 }}>
              {`Mã "${pendingNewSku?.skuCode ?? ""}" chưa có trong hệ thống`}
            </Box>
            <Box sx={{ typography: "body2" }}>
             Hệ thống phát hiện mã bạn vừa quét là mã mới chưa có trong kho. Bạn cần xác nhận đây là sản phẩm hay linh kiện.
            </Box>
          </UiAlert>
        </Stack>
      </UiDialog>

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
