/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { toast } from "sonner";
import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  getApiErrorMessage,
  getErrorRequestId,
  normalizeError,
} from "@/shared/api/api-error";
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
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import {
  useCancelInbound,
  useInboundDetail,
  useInboundScanEntries,
  usePostInboundReceipt,
  useRegisterInboundBox,
  useScanInbound,
  useUnscanInbound,
} from "@/modules/inbound/hooks/use-inbound";
import type {
  InboundLine,
  InboundScanEntry,
  ReceiptEvidence,
} from "@/modules/inbound/types";

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
  onEditExpected?: () => void;
};

type ScanLogRow = {
  key: string;
  code: string;
  result: string;
  success: boolean;
  lineId?: string;
  errorCode?: string;
};

function makeKey(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

/**
 * WWHN-187 (DEV187-P1-07) — lần gửi lại tiếp theo có phải *cùng một hành động quét*
 * hay không.
 *
 * Chỉ hai nhóm được giữ nguyên Idempotency-Key:
 *  - thua race đã phân loại `RELOAD_THEN_RETRY` (412 STALE_VERSION / 409
 *    CONCURRENCY_CONFLICT) — AC-GWT-CONC-001 cấm gửi lại bằng key mới;
 *  - lỗi **không có HTTP status** (mất mạng, timeout, response rơi giữa đường) —
 *    đúng kịch bản BE đã ghi xong nhưng client không biết; gửi lại bằng key cũ thì
 *    BE replay, bằng key mới thì `scanned_qty` bị cộng đôi.
 *
 * Lỗi nghiệp vụ có status (422/403/409 trạng thái) thì hành động coi như kết thúc:
 * giữ key cũ sẽ khiến lần quét sau (nội dung khác) bị 409 IDEMPOTENCY_CONFLICT oan.
 */
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
          "Trình duyệt chưa hỗ trợ BarcodeDetector. Hãy đóng camera và nhập Barcode/QR thủ công.",
        );
        return;
      }
      if (!window.isSecureContext) {
        setCameraError(
          "Camera Web WMS yêu cầu HTTPS/secure context. Hãy đóng camera và nhập mã thủ công.",
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Thiết bị/trình duyệt không cung cấp camera API. Hãy dùng nhập mã thủ công.",
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
            // Detector errors are transient; manual fallback always remains available.
          }
          frameRef.current = requestAnimationFrame(() => void detectFrame());
        };

        frameRef.current = requestAnimationFrame(() => void detectFrame());
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Không xác định";
        setCameraError(
          `Không truy cập được camera (${reason}). Hãy đóng camera và nhập Barcode/QR thủ công.`,
        );
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
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng / nhập tay</Button>}
      destroyOnHidden
      centered
      mask={{ closable: false }}
    >
      {cameraError ? (
        <Alert type="warning" showIcon title={cameraError} />
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
              background: "#0f172a",
            }}
          />
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            title={cameraReady ? "Camera sẵn sàng" : "Đang khởi tạo camera..."}
            description="Đưa Barcode/QR vào khung hình. Camera chỉ đọc mã; dữ liệu vẫn phải qua cùng validation và API như nhập tay. Camera không dùng để đọc RFID."
          />
        </>
      )}
    </Modal>
  );
}

function errorDescription(error: unknown) {
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return [
    normalized.status ? `HTTP ${normalized.status}` : undefined,
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
  onEditExpected,
}: InboundScanModalProps) {
  const detailQuery = useInboundDetail(documentId);
  const skuQuery = useMvpSkus({ status: "ACTIVE", per_page: 100 });
  // Annex D SCR-IN-01: bảng mã đã quét đọc từ server nên F5 / đóng-mở lại modal
  // vẫn còn bằng chứng, và 4 thẻ số là của cả phiếu chứ không riêng phiên thao tác.
  const scanEntriesQuery = useInboundScanEntries(documentId, "ALL");
  const registerBoxMutation = useRegisterInboundBox();
  const scanMutation = useScanInbound();
  const unscanMutation = useUnscanInbound();
  const postMutation = usePostInboundReceipt();
  const cancelMutation = useCancelInbound();
  const [lineId, setLineId] = useState("");
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
  const postKeyRef = useRef<string | null>(null);
  /**
   * WWHN-187 (DEV187-P1-07): key của hành động quét đang dở, kèm dấu vân tay nội
   * dung của chính hành động đó. Giữ lại qua một lần gửi hỏng để lần gửi kế tiếp là
   * *cùng hành động* chứ không phải lần quét thứ hai. Dấu vân tay để khi người dùng
   * đổi mã/số lượng/BOX rồi quét tiếp thì key cũ bị bỏ — nếu không, nội dung mới đi
   * với key cũ sẽ bị BE trả 409 IDEMPOTENCY_CONFLICT một cách oan uổng.
   */
  const scanKeyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  const canEdit = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const canPost = useInboundPermission(P.INBOUND_POST);
  const canCancel = useInboundPermission(WMS_ACTION_PERMISSIONS.CANCEL_INBOUND);

  const detail = detailQuery.data;
  const skuRows = skuQuery.data?.data ?? [];
  const skuById = useMemo(
    () => new Map<string, SkuRecord>(skuRows.map((sku) => [sku.sku_id, sku])),
    [skuRows],
  );

  useEffect(() => {
    if (!detail) return;
    setScanVersion(detail.document.version);
    const selected = detail.lines.find(
      (line) => line.id === lineId && line.scanned < line.expected,
    );
    if (!selected) {
      setLineId(
        detail.lines.find((line) => line.scanned < line.expected)?.id ??
          detail.lines[0]?.id ??
          "",
      );
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
  const remaining = selectedLine
    ? Math.max(selectedLine.expected - selectedLine.scanned, 0)
    : 0;
  const isComponent = selectedSku?.sku_type === "COMPONENT";
  const isSerialTracked = Boolean(selectedSku?.is_serial_tracked);
  const totalExpected =
    detail?.lines.reduce((sum, line) => sum + line.expected, 0) ?? 0;
  const totalScanned =
    detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const isFullScan = Boolean(
    detail?.lines.length &&
    detail.lines.every((line) => line.scanned === line.expected),
  );
  const isMutable =
    detail?.document.status === "DRAFT" ||
    detail?.document.status === "SCANNING";
  const busy = scanMutation.isPending || registerBoxMutation.isPending;
  const working =
    busy ||
    postMutation.isPending ||
    cancelMutation.isPending ||
    unscanMutation.isPending;
  const progressPercent = totalExpected
    ? Math.min(100, Math.round((totalScanned / totalExpected) * 100))
    : 0;
  const scanEntries = scanEntriesQuery.data ?? [];
  const activeEntries = scanEntries.filter(
    (entry) => entry.status === "ACTIVE",
  );
  const removedEntryCount = scanEntries.length - activeEntries.length;
  const sessionDuplicateCount = scanLog.filter(
    (row) => !row.success && (row.errorCode ?? "").includes("DUPLICATE"),
  ).length;
  const sessionErrorCount = scanLog.filter(
    (row) => !row.success && !(row.errorCode ?? "").includes("DUPLICATE"),
  ).length;

  useEffect(() => {
    if (isSerialTracked) setQuantity(1);
    else setQuantity(Math.max(1, Math.min(remaining || 1, quantity)));
  }, [isSerialTracked, quantity, remaining]);

  // Annex D SCR-IN-01: Enter/reader event submits — mã đến từ ScanInput được
  // truyền thẳng vào handler thay vì đọc lại state, tránh lệch nhịp với reader.
  const handleScan = async (scannedCode?: string) => {
    if (
      !detail ||
      !selectedLine ||
      !selectedSku ||
      scanVersion === null ||
      !canScan ||
      !isMutable
    )
      return;
    const normalizedBox = boxCode.trim();
    const normalizedCode = (scannedCode ?? scanCode).trim();
    const scanQuantity =
      isSerialTracked || !isComponent
        ? 1
        : Math.max(1, Math.min(Number(quantity) || 1, remaining));

    if (isComponent && !normalizedBox) {
      toast.error("SKU COMPONENT bắt buộc có BOX trước khi ghi nhận scan.");
      return;
    }
    if ((!isComponent || isSerialTracked) && !normalizedCode) {
      toast.error("Barcode/serial là bắt buộc cho dòng này.");
      return;
    }

    const logicalCode = normalizedCode || normalizedBox;
    // Một hành động quét = một key, giữ nguyên qua mọi lần gửi lại của chính nó.
    const scanFingerprint = [
      selectedLine.id,
      scanQuantity,
      normalizedCode,
      normalizedBox,
    ].join("|");
    const pendingScanKey = scanKeyRef.current;
    const scanAttemptKey =
      pendingScanKey?.fingerprint === scanFingerprint
        ? pendingScanKey.key
        : makeKey(`inbound-scan-${documentId}`);
    scanKeyRef.current = { key: scanAttemptKey, fingerprint: scanFingerprint };
    try {
      let containerId: string | undefined;
      if (isComponent) {
        const box = await registerBoxMutation.mutateAsync({
          id: documentId,
          lineId: selectedLine.id,
          boxCode: normalizedBox,
        });
        if (box.stock_effect !== "NONE" || box.movement_created !== false) {
          throw new Error(
            "Invariant lỗi: đăng ký BOX không được làm thay đổi tồn kho.",
          );
        }
        containerId = box.container_id;
      }

      const result = await scanMutation.mutateAsync({
        id: documentId,
        code: logicalCode,
        lineId: selectedLine.id,
        ifMatch: scanVersion,
        includeCodeValue: !isComponent || isSerialTracked,
        quantity: scanQuantity,
        containerId,
        idempotencyKey: scanAttemptKey,
      });
      const first = result[0];
      if (!first) throw new Error("API không trả kết quả scan.");
      // Hành động quét này đã có kết quả xác định — lần quét sau là hành động mới.
      scanKeyRef.current = null;
      setScanVersion(first.version);
      setScanLog((current) =>
        [
          {
            key: makeKey("scan"),
            code: logicalCode,
            result: first.replayed
              ? "Hợp lệ · replay (đã ghi nhận trước đó, không cộng thêm)"
              : `Hợp lệ · +${scanQuantity}`,
            success: true,
            lineId: first.line_id,
          },
          ...current,
        ].slice(0, 20),
      );
      // AC-GWT-IN-001 áp cho bước quét: replay phải được nói rõ, nếu không người
      // dùng tưởng lần gửi lại đã cộng thêm và sẽ quét bù một lần nữa.
      if (first.replayed) {
        toast.success(
          "Lần quét này đã được ghi nhận trước đó. Hệ thống trả lại kết quả cũ (replay) — số đã quét KHÔNG tăng thêm.",
        );
      }
      setScanCode("");
      if (!isSerialTracked) setQuantity(1);
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
    } catch (error) {
      const errorText = getApiErrorMessage(error, "Scan không hợp lệ.");
      const errorCode = normalizeError(error).code ?? undefined;
      // WWHN-187 (DEV187-P1-07): chỉ giữ lại key khi lần gửi sau là *cùng một hành
      // động quét* — thua race sau khi reload (412/409 CONCURRENCY) hoặc mất
      // response (không có HTTP status). Đúng những ca đó mới cần replay. Lỗi
      // nghiệp vụ (422/409 trạng thái) thì hành động coi như bỏ, phải sinh key mới,
      // nếu không lần quét khác nội dung sẽ bị 409 IDEMPOTENCY_CONFLICT oan.
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
            lineId: selectedLine.id,
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

  /**
   * ERD bảng 28: gỡ mã quét sai trước Post (ACTIVE -> REMOVED), stock-neutral.
   * Trước đây quét sai chỉ còn cách Cancel cả phiếu và tạo lại từ đầu.
   */
  const handleUnscan = async (entry: InboundScanEntry) => {
    if (!detail || scanVersion === null || !canScan || !isMutable) return;
    try {
      const result = await unscanMutation.mutateAsync({
        id: documentId,
        entryId: entry.id,
        ifMatch: scanVersion,
      });
      setScanVersion(result.version);
      toast.success(
        `Đã gỡ mã khỏi phiếu. Dòng còn ${result.scannedQuantity}/${result.requiredQuantity}; tồn kho không đổi.`,
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
      !isFullScan ||
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
      // AC-GWT-IN-001: replay phải được nói rõ, tránh người dùng hiểu là lần Post
      // thứ hai đã cộng tồn thêm một lần.
      toast.success(
        evidence.replayed
          ? "Phiếu đã được Post trước đó. Hệ thống trả lại kết quả cũ (replay), tồn kho KHÔNG tăng thêm lần nữa."
          : "Full Post Receipt thành công. Tồn kho tăng đúng một lần.",
      );
      await Promise.all([detailQuery.refetch(), scanEntriesQuery.refetch()]);
      onChanged?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không Full Post Receipt được."));
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
      toast.success("Đã Cancel phiếu nhập. Không phát sinh stock movement.");
      setCancelOpen(false);
      onChanged?.();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không Cancel được phiếu nhập."));
      await detailQuery.refetch();
      onChanged?.();
    }
  };

  const lineColumns: ColumnsType<InboundLine> = [
    {
      title: "SKU",
      key: "sku",
      width: 220,
      render: (_, line) => (
        <strong>
          {skuById.get(line.productId)?.sku_code ?? line.productId}
        </strong>
      ),
    },
    {
      title: "Tên / loại",
      key: "name",
      width: 250,
      render: (_, line) => {
        const sku = skuById.get(line.productId);
        return (
          <div>
            <div>{sku?.sku_name ?? "-"}</div>
            {sku?.sku_type ? (
              <Tag style={{ marginTop: 4 }}>{sku.sku_type}</Tag>
            ) : null}
          </div>
        );
      },
    },
    { title: "Expected", dataIndex: "expected", width: 110, align: "right" },
    { title: "Đã scan", dataIndex: "scanned", width: 110, align: "right" },
    {
      title: "Còn lại",
      key: "remaining",
      width: 110,
      align: "right",
      render: (_, line) => Math.max(line.expected - line.scanned, 0),
    },
    {
      title: "Kết quả",
      key: "result",
      width: 120,
      render: (_, line) => (
        <Tag color={line.scanned === line.expected ? "success" : "warning"}>
          {line.scanned === line.expected ? "ĐỦ" : "CHƯA ĐỦ"}
        </Tag>
      ),
    },
  ];

  // Annex D SCR-IN-01: bảng "Mã / SKU / Kết quả / Nguồn" của phiếu, đọc từ
  // inbound_scan_entries nên tồn tại qua reload; kèm hành động gỡ trước Post.
  const scanEntryColumns: ColumnsType<InboundScanEntry> = [
    {
      title: "Mã",
      key: "code",
      width: 240,
      render: (_, entry) => (
        <span style={{ fontFamily: "monospace" }}>
          {entry.itemCode ||
            entry.serialNumber ||
            entry.itemId ||
            entry.containerId ||
            "-"}
        </span>
      ),
    },
    {
      title: "SKU",
      key: "sku",
      width: 220,
      render: (_, entry) => (
        <div>
          <div>
            <strong>{entry.sku || "-"}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{entry.skuName}</div>
        </div>
      ),
    },
    {
      title: "SL",
      dataIndex: "quantity",
      width: 70,
      align: "right",
    },
    {
      title: "Kết quả",
      key: "result",
      width: 130,
      render: (_, entry) =>
        entry.status === "ACTIVE" ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Hợp lệ
          </Tag>
        ) : (
          <Tag color="default" icon={<CloseCircleOutlined />}>
            Đã gỡ
          </Tag>
        ),
    },
    {
      title: "Nguồn",
      key: "source",
      width: 130,
      render: (_, entry) => (
        <Tag>
          {entry.scanSource === "CAMERA_OR_MANUAL_CODE"
            ? "CAMERA/MÃ"
            : "NHẬP TAY"}
        </Tag>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      render: (_, entry) =>
        entry.status === "ACTIVE" && canScan && isMutable ? (
          <Button
            danger
            type="link"
            size="small"
            icon={<DeleteOutlined />}
            disabled={working}
            onClick={() => void handleUnscan(entry)}
          >
            Gỡ mã
          </Button>
        ) : null,
    },
  ];

  const scanLogColumns: ColumnsType<ScanLogRow> = [
    { title: "Mã", dataIndex: "code", width: 220 },
    {
      title: "Kết quả",
      dataIndex: "result",
      render: (value: string, row) => (
        <Space>
          {row.success ? (
            <CheckCircleOutlined style={{ color: "#16a34a" }} />
          ) : (
            <CloseCircleOutlined style={{ color: "#dc2626" }} />
          )}
          <span>{value}</span>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          detail
            ? `Quét & Full Post · ${detail.document.code || documentId}`
            : "Quét & Full Post Receipt"
        }
        open
        width={1200}
        footer={null}
        onCancel={onClose}
        centered
        closable={!working}
        mask={{ closable: false }}
        destroyOnHidden
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag color="blue">POST /inbound-documents/:id/scan</Tag>
          <Tag color="blue">POST /inbound-documents/:id/post-receipt</Tag>
          <Tag color="gold">If-Match</Tag>
          <Tag color="gold">Idempotency-Key khi Post</Tag>
        </Space>

        {detailQuery.isLoading ? <Card loading /> : null}
        {detailQuery.isError ? (
          <Alert
            type="error"
            showIcon
            title={getApiErrorMessage(
              detailQuery.error,
              "Không tải được phiếu nhập.",
            )}
            description={errorDescription(detailQuery.error)}
          />
        ) : null}

        {detail ? (
          <>
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2, lg: 4 }}
              style={{ marginBottom: 14 }}
            >
              <Descriptions.Item label="Phiếu">
                {detail.document.code || documentId}
              </Descriptions.Item>
              <Descriptions.Item label="Nguồn">
                {detail.document.source || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag
                  color={
                    detail.document.status === "POSTED"
                      ? "success"
                      : detail.document.status === "SCANNING"
                        ? "processing"
                        : detail.document.status === "CANCELLED"
                          ? "error"
                          : "warning"
                  }
                >
                  {detail.document.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Version / If-Match">
                {scanVersion ?? detail.document.version}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Mã hợp lệ
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalScanned}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Số lượng cần nhận
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalExpected}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  {/* Đếm ở mức phiếu (đọc từ inbound_scan_entries) nên không mất
                      sau khi tải lại trang, khác với bộ đếm theo phiên trước đây. */}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Mã đã gỡ</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {removedEntryCount}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Mã trùng / lỗi (phiên)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {sessionDuplicateCount + sessionErrorCount}
                  </div>
                </Card>
              </Col>
            </Row>

            <Card
              size="small"
              title="Tiến độ Full Post"
              style={{ marginBottom: 14 }}
            >
              <Progress
                percent={progressPercent}
                status={isFullScan ? "success" : "active"}
              />
              <div style={{ color: "#6b7280", marginTop: 6 }}>
                {isFullScan
                  ? "Mọi dòng đã scan đủ chính xác. Full Post chỉ được thực hiện khi phiếu đang SCANNING và người dùng có inbound.post."
                  : `Đã ghi nhận ${totalScanned}/${totalExpected}. Không có partial receipt; còn thiếu phải tiếp tục scan hoặc hiệu chỉnh Expected hợp lệ.`}
              </div>
            </Card>

            {isMutable ? (
              <Row gutter={[14, 14]}>
                <Col xs={24} lg={13}>
                  <Card size="small" title="Ghi nhận Barcode / QR / BOX">
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          marginBottom: 6,
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        Dòng nhận *
                      </div>
                      <Select
                        style={{ width: "100%" }}
                        value={lineId || undefined}
                        disabled={!canScan || busy}
                        onChange={setLineId}
                        placeholder="Chọn dòng chưa đủ"
                        options={detail.lines.map((line) => {
                          const sku = skuById.get(line.productId);
                          return {
                            value: line.id,
                            disabled: line.scanned >= line.expected,
                            label: `${sku?.sku_code ?? line.productId} · ${line.scanned}/${line.expected}`,
                          };
                        })}
                      />
                    </div>

                    {isComponent ? (
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            marginBottom: 6,
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          BOX *
                        </div>
                        <Space.Compact style={{ width: "100%" }}>
                          <Input
                            value={boxCode}
                            disabled={!canScan || busy}
                            placeholder="Quét / nhập BOX chứa đúng một SKU COMPONENT"
                            onChange={(event) => setBoxCode(event.target.value)}
                          />
                          <Button
                            icon={<CameraOutlined />}
                            disabled={!canScan || busy}
                            onClick={() => setCameraTarget("box")}
                          >
                            Camera
                          </Button>
                        </Space.Compact>
                      </div>
                    ) : null}

                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          marginBottom: 6,
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        {isComponent && !isSerialTracked
                          ? "Barcode/serial (không bắt buộc với COMPONENT quantity)"
                          : "Barcode / Serial *"}
                      </div>
                      {/* Annex D SCR-IN-01: Auto-focus scan input; Enter/reader
                          event submits; retain focus after success/error. */}
                      <Row gutter={8} align="top">
                        <Col flex="auto">
                          <ScanInput
                            value={scanCode}
                            size="middle"
                            disabled={!canScan || busy}
                            placeholder={
                              isSerialTracked
                                ? "Quét serial / Barcode"
                                : "Quét Barcode/QR hoặc nhập tay fallback"
                            }
                            onChange={setScanCode}
                            onScan={(code) => void handleScan(code)}
                          />
                        </Col>
                        <Col>
                          <Button
                            icon={<CameraOutlined />}
                            disabled={!canScan || busy}
                            onClick={() => setCameraTarget("code")}
                          >
                            Camera
                          </Button>
                        </Col>
                      </Row>
                    </div>

                    {isComponent && !isSerialTracked ? (
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            marginBottom: 6,
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          Số lượng lần nhận *
                        </div>
                        <InputNumber
                          min={1}
                          max={Math.max(1, remaining)}
                          value={quantity}
                          onChange={(value) => setQuantity(Number(value ?? 1))}
                          disabled={!canScan || busy}
                          style={{ width: 180 }}
                        />
                      </div>
                    ) : null}

                    <Button
                      type="primary"
                      icon={<ScanOutlined />}
                      disabled={
                        !canScan ||
                        !lineId ||
                        busy ||
                        remaining <= 0 ||
                        !selectedSku
                      }
                      loading={busy}
                      onClick={() => void handleScan()}
                    >
                      Ghi nhận scan
                    </Button>

                    {selectedLine ? (
                      <Alert
                        style={{ marginTop: 12 }}
                        type="info"
                        showIcon
                        title={`${selectedSku?.sku_code ?? selectedLine.productId}: ${selectedLine.scanned}/${selectedLine.expected}`}
                        description={
                          isComponent
                            ? "COMPONENT: BOX bắt buộc. Với quantity-mode có thể ghi nhận N đơn vị/BOX; serial-tracked vẫn quantity=1. Sau Full Post mới đi Putaway."
                            : "PRODUCT: Barcode/QR inbound. RFID không bắt buộc; ở outbound RFID chỉ là mapping tùy chọn, không chặn Post Issue."
                        }
                      />
                    ) : null}
                  </Card>
                </Col>

                <Col xs={24} lg={11}>
                  <Card size="small" title="Guard nghiệp vụ">
                    <Space orientation="vertical" size={10}>
                      <div>
                        {isFullScan ? "✅" : "⚠️"}{" "}
                        {isFullScan
                          ? "Tất cả dòng đã scan đủ chính xác."
                          : `Còn ${Math.max(totalExpected - totalScanned, 0)} đơn vị chưa ghi nhận.`}
                      </div>
                      <div>
                        • Camera và nhập tay cùng đi một validation/API path;
                        camera không đọc RFID.
                      </div>
                      <div>
                        • Scan/đăng ký BOX bắt buộc stock_effect=NONE và không
                        tạo movement.
                      </div>
                      <div>
                        • Scan vượt Expected, sai SKU/state hoặc duplicate phải
                        bị backend từ chối.
                      </div>
                      <div>
                        • Full Post dùng If-Match + Idempotency-Key và là
                        transaction atomic.
                      </div>
                      <div>
                        • COMPONENT sau Post mới vào Putaway; Confirm Putaway
                        stock-neutral.
                      </div>
                    </Space>
                  </Card>
                </Col>
              </Row>
            ) : (
              <Alert
                type={detail.document.status === "POSTED" ? "success" : "info"}
                showIcon
                title={
                  detail.document.status === "POSTED"
                    ? "Phiếu đã Full Post và chỉ đọc"
                    : "Phiếu đã CANCELLED và chỉ đọc"
                }
                description={
                  detail.document.status === "POSTED"
                    ? "Không sửa/xóa chứng từ POSTED. Sai giao dịch phải xử lý bằng Reversal/Correction append-only."
                    : "CANCELLED không có stock effect. Muốn làm lại phải tạo phiếu mới."
                }
                style={{ marginBottom: 14 }}
              />
            )}

            <Card
              size="small"
              title="Đối soát từng dòng"
              style={{ marginTop: 14 }}
            >
              <Table<InboundLine>
                size="small"
                rowKey="id"
                columns={lineColumns}
                dataSource={detail.lines}
                pagination={false}
                scroll={{ x: 920 }}
              />
            </Card>

            {/* Annex D SCR-IN-01: bảng mã đã quét của phiếu — đọc lại được sau reload. */}
            <Card
              size="small"
              title="Mã đã quét của phiếu"
              style={{ marginTop: 14 }}
              loading={scanEntriesQuery.isLoading}
            >
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                {`${activeEntries.length} hợp lệ${
                  removedEntryCount ? ` · ${removedEntryCount} đã gỡ` : ""
                }`}
              </div>
              {scanEntriesQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  title={getApiErrorMessage(
                    scanEntriesQuery.error,
                    "Không tải được danh sách mã đã quét.",
                  )}
                  description={errorDescription(scanEntriesQuery.error)}
                />
              ) : (
                <Table<InboundScanEntry>
                  size="small"
                  rowKey="id"
                  columns={scanEntryColumns}
                  dataSource={scanEntries}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  scroll={{ x: 900 }}
                  locale={{
                    emptyText:
                      "Chưa ghi nhận mã nào. Quét Barcode/QR hoặc đăng ký BOX để bắt đầu.",
                  }}
                />
              )}
            </Card>

            {scanLog.length ? (
              <Card
                size="small"
                title="Diễn biến scan trong phiên thao tác"
                style={{ marginTop: 14 }}
              >
                <Table<ScanLogRow>
                  size="small"
                  rowKey="key"
                  columns={scanLogColumns}
                  dataSource={scanLog}
                  pagination={{ pageSize: 8, hideOnSinglePage: true }}
                />
              </Card>
            ) : null}

            {receiptEvidence ? (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 14 }}
                title="Evidence Full Post Receipt"
                description={
                  <div>
                    <div>
                      Request ID: <strong>{receiptEvidence.requestId}</strong>
                    </div>
                    <div>
                      Movement: {receiptEvidence.movementRefs.join(", ")}
                    </div>
                    <div>Receipt: {receiptEvidence.receiptId}</div>
                  </div>
                }
              />
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <Button
                icon={<CloseOutlined />}
                disabled={working}
                onClick={onClose}
              >
                Đóng
              </Button>
              {canEdit && isMutable && onEditExpected ? (
                <Button
                  icon={<EditOutlined />}
                  disabled={working}
                  onClick={onEditExpected}
                >
                  Hiệu chỉnh Expected
                </Button>
              ) : null}
              {canCancel && isMutable ? (
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  disabled={working}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel phiếu
                </Button>
              ) : null}
              {isMutable ? (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={
                    !canPost ||
                    !isFullScan ||
                    detail.document.status !== "SCANNING" ||
                    postMutation.isPending
                  }
                  loading={postMutation.isPending}
                  onClick={() => void handlePost()}
                >
                  Full Post Receipt
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </Modal>

      <CameraScanModal
        open={cameraTarget !== null}
        title={
          cameraTarget === "box"
            ? "Quét mã BOX bằng camera"
            : "Quét Barcode / QR bằng camera"
        }
        onClose={() => setCameraTarget(null)}
        onDetected={(code) => {
          if (cameraTarget === "box") setBoxCode(code);
          else setScanCode(code);
          setCameraTarget(null);
          toast.success("Đã đọc mã từ camera. Kiểm tra và bấm Ghi nhận scan.");
        }}
      />

      <Modal
        title="Cancel phiếu nhập"
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={() => void handleCancel()}
        centered
        mask={{ closable: false }}
        closable={!cancelMutation.isPending}
        okButtonProps={{
          danger: true,
          disabled: !cancelReason.trim() || cancelMutation.isPending,
        }}
        okText={cancelMutation.isPending ? "Đang Cancel..." : "Xác nhận Cancel"}
        cancelText="Quay lại"
      >
        <Alert
          type="warning"
          showIcon
          title="Cancel là trạng thái kết thúc và stock-neutral"
          description="Phiếu CANCELLED không thể tiếp tục scan/Post. Nếu cần làm lại, tạo phiếu mới để bảo toàn audit trail."
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          rows={4}
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Lý do Cancel bắt buộc"
          maxLength={2000}
          showCount
        />
      </Modal>
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
    <Card>
      {screenId === "IN-03"
        ? "Quét & Full Post Receipt được mở từ Danh sách phiếu nhập dưới dạng modal."
        : "IN-01/IN-02 được quản lý trong Danh sách phiếu nhập."}
    </Card>
  );
}
