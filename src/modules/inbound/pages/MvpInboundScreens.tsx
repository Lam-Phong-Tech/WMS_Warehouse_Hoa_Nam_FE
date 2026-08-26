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
  InboxOutlined,
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
import {
  INBOUND_STATUS_LABELS,
  QR_RESOLUTION_STATUS_LABELS,
  SKU_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { ScanInput } from "@/shared/components/forms/ScanInput";
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
        const reason =
          error instanceof Error ? error.message : "Không xác định";
        setCameraError(
          `Không truy cập được camera (${reason}). Hãy đóng camera và nhập mã thủ công.`,
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
            description="Đưa mã vạch/QR vào khung hình. Camera chỉ đọc mã; dữ liệu vẫn phải qua cùng kiểm tra hợp lệ như khi nhập tay. Camera không dùng để đọc RFID."
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
  const postKeyRef = useRef<string | null>(null);
  const scanKeyRef = useRef<{ key: string; fingerprint: string } | null>(null);
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
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không hủy được phiếu nhập."));
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
              <Tag style={{ marginTop: 4 }}>
                {businessLabel(SKU_TYPE_LABELS, sku.sku_type)}
              </Tag>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "Số lượng đã quét",
      dataIndex: "scanned",
      width: 140,
      align: "right",
      render: (value: number) => <strong>{value}</strong>,
    },
  ];

  const scanEntryColumns: ColumnsType<InboundScanEntry> = [
    {
      title: "Mã",
      key: "code",
      width: 240,
      render: (_, entry) => (
        <span style={{ fontFamily: "monospace" }}>
          {entry.itemCode ||
            entry.serialNumber ||
            entry.candidateItemUnique ||
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
      width: 180,
      render: (_, entry) =>
        entry.status === "ACTIVE" ? (
          entry.candidateItemUnique && !entry.itemId ? (
            <Tag color="processing" icon={<CheckCircleOutlined />}>
              Sản phẩm mới · chờ ghi nhận
            </Tag>
          ) : (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Hợp lệ
            </Tag>
          )
        ) : (
          <Tag color="default" icon={<CloseCircleOutlined />}>
            Đã gỡ
          </Tag>
        ),
    },
    {
      title: "Nguồn",
      key: "source",
      width: 140,
      render: (_, entry) => (
        <Tag>
          {entry.scanSource === "CAMERA_OR_MANUAL_CODE"
            ? "Camera / mã"
            : "Nhập tay"}
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
            ? `Quét & hoàn tất nhập kho · ${detail.document.code || documentId}`
            : "Quét & hoàn tất nhập kho"
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
                  {businessLabel(INBOUND_STATUS_LABELS, detail.document.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Phiên bản dữ liệu">
                {scanVersion ?? detail.document.version}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Mã hợp lệ
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalScanned}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Dòng SKU thực nhận
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {detail.lines.length}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Mã đã gỡ</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {removedEntryCount}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
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
              title="Hàng thực nhận đã ghi nhận"
              style={{ marginBottom: 14 }}
            >
              <div style={{ color: "#6b7280" }}>
                {hasScanned
                  ? `Đã ghi nhận ${totalScanned} đơn vị trên ${detail.lines.length} dòng SKU từ quét/đếm thực tế. Số lượng nhập kho lấy theo hàng thực nhận — thiếu/thừa so với chứng từ vận chuyển vẫn ghi nhận nhập được.`
                  : "Chưa ghi nhận đơn vị nào. Quét mã sản phẩm hoặc chọn SKU linh kiện theo hộp để bắt đầu; dòng phiếu sẽ tự được tạo theo hàng thực nhận."}
              </div>
            </Card>

            {isMutable ? (
              <Row gutter={[14, 14]}>
                <Col xs={24} lg={13}>
                  <Card size="small" title="Ghi nhận mã vạch / QR / hộp">
                    {!isComponent && activeCarton ? (
                      <Alert
                        style={{ marginBottom: 12 }}
                        type="info"
                        showIcon
                        icon={<InboxOutlined />}
                        title={`Thùng đang quét: ${activeCarton.code}`}
                        description={
                          <div>
                            <div>
                              Đã quét <strong>{activeCartonScannedQty}</strong>{" "}
                              máy vào thùng này. Sản phẩm quét tiếp theo sẽ được
                              gắn vào thùng {activeCarton.code}.
                            </div>
                            <Button
                              type="primary"
                              size="small"
                              style={{ marginTop: 8 }}
                              icon={<CheckCircleOutlined />}
                              loading={completeCartonMutation.isPending}
                              disabled={!canScan || working}
                              onClick={() => void handleCompleteCarton()}
                            >
                              Đã quét xong thùng
                            </Button>
                          </div>
                        }
                      />
                    ) : null}
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          marginBottom: 6,
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        Dòng nhận
                      </div>
                      <Select
                        style={{ width: "100%" }}
                        value={lineId}
                        disabled={!canScan || busy}
                        onChange={setLineId}
                        options={[
                          {
                            value: AUTO_LINE,
                            label:
                              "Tự động theo QR (sản phẩm — hệ thống tự đối chiếu SKU)",
                          },
                          ...detail.lines.map((line) => {
                            const sku = skuById.get(line.productId);
                            return {
                              value: line.id,
                              label: `${sku?.sku_code ?? line.productId} · đã quét ${line.scanned}`,
                            };
                          }),
                        ]}
                      />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          marginBottom: 6,
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        Nhận linh kiện theo hộp — chọn SKU linh kiện thực nhận
                        (dòng phiếu tự tạo, không nhập số lượng dự kiến)
                      </div>
                      <Space.Compact style={{ width: "100%" }}>
                        <Select
                          style={{ width: "100%" }}
                          showSearch
                          allowClear
                          optionFilterProp="label"
                          placeholder="Chọn SKU linh kiện"
                          value={componentSkuId}
                          disabled={!canScan || busy}
                          onChange={(value) =>
                            setComponentSkuId(value ?? undefined)
                          }
                          options={componentSkuOptions.map((sku) => ({
                            value: sku.sku_id,
                            label: `${sku.sku_code} · ${sku.sku_name}`,
                          }))}
                        />
                        <Button
                          type="primary"
                          ghost
                          disabled={!canScan || busy || !componentSkuId}
                          loading={ensureComponentMutation.isPending}
                          onClick={() => void handleAddComponentLine()}
                        >
                          Thêm dòng linh kiện
                        </Button>
                      </Space.Compact>
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
                          Hộp *
                        </div>
                        <Space.Compact style={{ width: "100%" }}>
                          <Input
                            value={boxCode}
                            disabled={!canScan || busy}
                            placeholder="Quét / nhập hộp chứa đúng một SKU linh kiện"
                            onChange={(event) => setBoxCode(event.target.value)}
                            maxLength={120}
                          />
                          <Button
                            icon={<CameraOutlined />}
                            disabled={!canScan || busy}
                            onClick={() => setCameraTarget("box")}
                          >
                            Quét bằng camera
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
                          ? "Mã vạch / số sê-ri (không bắt buộc với linh kiện nhập theo số lượng)"
                          : "Mã vạch / Số sê-ri *"}
                      </div>
                      <Row gutter={8} align="top">
                        <Col flex="auto">
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
                        </Col>
                        <Col>
                          <Button
                            icon={<CameraOutlined />}
                            disabled={!canScan || busy}
                            onClick={() => setCameraTarget("code")}
                          >
                            Quét bằng camera
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
                        busy ||
                        (lineId !== AUTO_LINE && !selectedSku)
                      }
                      loading={busy}
                      onClick={() => void handleScan()}
                    >
                      Ghi nhận quét
                    </Button>

                    {selectedLine ? (
                      <Alert
                        style={{ marginTop: 12 }}
                        type="info"
                        showIcon
                        title={`${selectedSku?.sku_code ?? selectedLine.productId}: đã quét ${selectedLine.scanned}`}
                        description={
                          isComponent
                            ? "Linh kiện: bắt buộc có hộp. Với linh kiện nhập theo số lượng có thể ghi nhận nhiều đơn vị mỗi hộp; linh kiện quản lý số sê-ri vẫn ghi nhận từng đơn vị. Sau khi hoàn tất nhập kho mới thực hiện xếp khay."
                            : "Sản phẩm: quét mã vạch/QR khi nhập kho. RFID không bắt buộc; ở luồng xuất kho, RFID chỉ là gán mã tùy chọn và không chặn hoàn tất xuất kho."
                        }
                      />
                    ) : null}
                  </Card>
                </Col>

               
              </Row>
            ) : (
              <Alert
                type={detail.document.status === "POSTED" ? "success" : "info"}
                showIcon
                title={
                  detail.document.status === "POSTED"
                    ? "Phiếu đã nhập kho và chỉ đọc"
                    : "Phiếu đã hủy và chỉ đọc"
                }
                description={
                  detail.document.status === "POSTED"
                    ? "Không sửa/xóa phiếu đã nhập kho. Sai giao dịch phải xử lý bằng điều chỉnh tồn kho theo cơ chế ghi bổ sung."
                    : "Phiếu đã hủy không làm thay đổi tồn kho. Muốn làm lại phải tạo phiếu mới."
                }
                style={{ marginBottom: 14 }}
              />
            )}

            <Card
              size="small"
              title="Hàng thực nhận theo SKU"
              style={{ marginTop: 14 }}
            >
              <Table<InboundLine>
                size="small"
                rowKey="id"
                columns={lineColumns}
                dataSource={detail.lines}
                pagination={false}
                scroll={{ x: 920 }}
                expandable={{
                  rowExpandable: (line) =>
                    activeEntries.some((entry) => entry.lineId === line.id),
                  expandedRowRender: (line) => {
                    const lineEntries = activeEntries.filter(
                      (entry) => entry.lineId === line.id,
                    );
                    return (
                      <Space wrap size={4}>
                        {lineEntries.map((entry) => (
                          <Tag
                            key={entry.id}
                            style={{ fontFamily: "monospace" }}
                          >
                            {entry.itemCode ||
                              entry.serialNumber ||
                              entry.candidateItemUnique ||
                              (entry.quantity > 1
                                ? `SL ${entry.quantity}`
                                : entry.itemId || "-")}
                          </Tag>
                        ))}
                      </Space>
                    );
                  },
                }}
              />
            </Card>

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
                      "Chưa ghi nhận mã nào. Quét mã vạch/QR hoặc đăng ký hộp để bắt đầu.",
                  }}
                />
              )}
            </Card>

            {scanLog.length ? (
              <Card
                size="small"
                title="Diễn biến quét trong phiên thao tác"
                style={{ marginTop: 14 }}
              >
                <Table<ScanLogRow>
                  size="small"
                  rowKey="key"
                  columns={scanLogColumns}
                  dataSource={scanLog}
                  pagination={{ pageSize: 8, hideOnSinglePage: true }}
                  scroll={{ x: "max-content" }}
                />
              </Card>
            ) : null}

            {receiptEvidence ? (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 14 }}
                title="Kết quả hoàn tất nhập kho"
                description={
                  <div>
                    <div>
                      Mã yêu cầu: <strong>{receiptEvidence.requestId}</strong>
                    </div>
                    <div>
                      Biến động tồn kho:{" "}
                      {receiptEvidence.movementRefs.join(", ")}
                    </div>
                    <div>Phiếu nhập: {receiptEvidence.receiptId}</div>
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
              {canCancel && isMutable ? (
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  disabled={working}
                  onClick={() => setCancelOpen(true)}
                >
                  Hủy phiếu
                </Button>
              ) : null}
              {isMutable ? (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={
                    !canPost ||
                    !hasScanned ||
                    detail.document.status !== "SCANNING" ||
                    postMutation.isPending
                  }
                  loading={postMutation.isPending}
                  onClick={() => void handlePost()}
                >
                  Ghi nhận nhập
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

      <Modal
        title="Hủy phiếu nhập"
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
        okText={cancelMutation.isPending ? "Đang hủy..." : "Xác nhận hủy"}
        cancelText="Quay lại"
      >
        <Alert
          type="warning"
          showIcon
          title="Hủy là trạng thái kết thúc và không làm thay đổi tồn kho"
          description="Phiếu đã hủy không thể tiếp tục quét hoặc hoàn tất nhập kho. Nếu cần làm lại, hãy tạo phiếu mới để bảo toàn lịch sử thao tác."
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          rows={4}
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Lý do hủy bắt buộc"
          maxLength={1000}
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
        ? "Quét & hoàn tất nhập kho được mở từ Danh sách phiếu nhập dưới dạng cửa sổ thao tác."
        : "IN-01/IN-02 được quản lý trong Danh sách phiếu nhập."}
    </Card>
  );
}
