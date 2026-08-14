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
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import {
  useCancelInbound,
  useInboundDetail,
  usePostInboundReceipt,
  useRegisterInboundBox,
  useScanInbound,
} from "@/modules/inbound/hooks/use-inbound";
import type { InboundLine, ReceiptEvidence } from "@/modules/inbound/types";

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
};

function makeKey(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
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
      maskClosable={false}
    >
      {cameraError ? (
        <Alert type="warning" showIcon message={cameraError} />
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
            message={
              cameraReady ? "Camera sẵn sàng" : "Đang khởi tạo camera..."
            }
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
  const registerBoxMutation = useRegisterInboundBox();
  const scanMutation = useScanInbound();
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
  const canEdit = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const canPost = useInboundPermission(P.INBOUND_POST);
  const canCancel = useInboundPermission(P.INBOUND_CANCEL);

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
  const working = busy || postMutation.isPending || cancelMutation.isPending;
  const progressPercent = totalExpected
    ? Math.min(100, Math.round((totalScanned / totalExpected) * 100))
    : 0;

  useEffect(() => {
    if (isSerialTracked) setQuantity(1);
    else setQuantity(Math.max(1, Math.min(remaining || 1, quantity)));
  }, [isSerialTracked, quantity, remaining]);

  const handleScan = async () => {
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
    const normalizedCode = scanCode.trim();
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
      });
      const first = result[0];
      if (!first) throw new Error("API không trả kết quả scan.");
      setScanVersion(first.version);
      setScanLog((current) =>
        [
          {
            key: makeKey("scan"),
            code: logicalCode,
            result: `Hợp lệ · +${scanQuantity}`,
            success: true,
            lineId: first.line_id,
          },
          ...current,
        ].slice(0, 20),
      );
      setScanCode("");
      if (!isSerialTracked) setQuantity(1);
      await detailQuery.refetch();
      onChanged?.();
    } catch (error) {
      const errorText = getApiErrorMessage(error, "Scan không hợp lệ.");
      setScanLog((current) =>
        [
          {
            key: makeKey("scan-error"),
            code: logicalCode,
            result: errorText,
            success: false,
            lineId: selectedLine.id,
          },
          ...current,
        ].slice(0, 20),
      );
      toast.error(errorText);
      await detailQuery.refetch();
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
      toast.success(
        "Full Post Receipt thành công. Tồn kho tăng đúng một lần.",
      );
      await detailQuery.refetch();
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
        maskClosable={false}
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
            message={getApiErrorMessage(
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
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Đã scan</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalScanned}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Expected</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalExpected}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Còn lại</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {Math.max(totalExpected - totalScanned, 0)}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Điều kiện Post
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {isFullScan ? "ĐỦ" : "CHƯA ĐỦ"}
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
                      <Space.Compact style={{ width: "100%" }}>
                        <Input
                          value={scanCode}
                          disabled={!canScan || busy}
                          placeholder={
                            isSerialTracked
                              ? "Quét serial / Barcode"
                              : "Quét Barcode/QR hoặc nhập tay fallback"
                          }
                          onChange={(event) => setScanCode(event.target.value)}
                          onPressEnter={() => void handleScan()}
                        />
                        <Button
                          icon={<CameraOutlined />}
                          disabled={!canScan || busy}
                          onClick={() => setCameraTarget("code")}
                        >
                          Camera
                        </Button>
                      </Space.Compact>
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
                        message={`${selectedSku?.sku_code ?? selectedLine.productId}: ${selectedLine.scanned}/${selectedLine.expected}`}
                        description={
                          isComponent
                            ? "COMPONENT: BOX bắt buộc. Với quantity-mode có thể ghi nhận N đơn vị/BOX; serial-tracked vẫn quantity=1. Sau Full Post mới đi Putaway."
                            : "PRODUCT: Barcode/QR inbound. RFID chưa bắt buộc tại Receipt; RFID thuộc guard outbound."
                        }
                      />
                    ) : null}
                  </Card>
                </Col>

                <Col xs={24} lg={11}>
                  <Card size="small" title="Guard nghiệp vụ">
                    <Space direction="vertical" size={10}>
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
                message={
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

            {scanLog.length ? (
              <Card
                size="small"
                title="Kết quả scan trong phiên thao tác"
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
                message="Evidence Full Post Receipt"
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
              <Button icon={<CloseOutlined />} disabled={working} onClick={onClose}>
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
          toast.success(
            "Đã đọc mã từ camera. Kiểm tra và bấm Ghi nhận scan.",
          );
        }}
      />

      <Modal
        title="Cancel phiếu nhập"
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={() => void handleCancel()}
        centered
        maskClosable={false}
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
          message="Cancel là trạng thái kết thúc và stock-neutral"
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
