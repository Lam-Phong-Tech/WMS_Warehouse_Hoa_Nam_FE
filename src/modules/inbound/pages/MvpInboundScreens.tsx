/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, InputNumber, Modal, Progress, Space, Tag, message } from "antd";
import { CameraOutlined } from "@ant-design/icons";
import { getApiErrorMessage } from "@/shared/api/api-error";
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
import type { ReceiptEvidence } from "@/modules/receiving/types";

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
    globalThis as typeof globalThis & {
      BarcodeDetector?: BarcodeDetectorConstructor;
    }
  ).BarcodeDetector ?? null;
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
          "Trình duyệt chưa hỗ trợ BarcodeDetector. Đóng camera và nhập Barcode/QR thủ công.",
        );
        return;
      }
      if (!window.isSecureContext) {
        setCameraError(
          "Camera Web WMS yêu cầu HTTPS/secure context. Đóng camera và nhập mã thủ công.",
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Thiết bị/trình duyệt không cung cấp camera API. Đóng camera và nhập mã thủ công.",
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
            // A transient detector failure should not block the manual fallback.
          }
          frameRef.current = requestAnimationFrame(() => void detectFrame());
        };

        frameRef.current = requestAnimationFrame(() => void detectFrame());
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Không xác định";
        setCameraError(
          `Không truy cập được camera (${reason}). Đóng camera và nhập Barcode/QR thủ công.`,
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
    <Modal title={title} open={open} onCancel={onClose} footer={null} destroyOnHidden>
      {cameraError ? (
        <Alert type="warning" showIcon message={cameraError} />
      ) : (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{ width: "100%", minHeight: 260, borderRadius: 12, background: "#0f172a" }}
          />
          <div className="footer-note">
            {cameraReady
              ? "Đưa Barcode/QR vào khung hình. Hệ thống chỉ điền mã vào đúng trường đang quét; bạn vẫn xác nhận Ghi nhận scan trước khi gửi API."
              : "Đang khởi tạo camera..."}
          </div>
        </>
      )}
      <div className="toolbar" style={{ marginTop: 14, marginBottom: 0 }}>
        <div className="spacer" />
        <button type="button" className="btn" onClick={onClose}>
          Đóng / nhập tay
        </button>
      </div>
    </Modal>
  );
}

export function InboundScanModal({
  documentId,
  onClose,
  onChanged,
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
  const [scanLog, setScanLog] = useState<
    { code: string; result: string; lineId?: string }[]
  >([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [receiptEvidence, setReceiptEvidence] = useState<ReceiptEvidence | null>(null);
  const [cameraTarget, setCameraTarget] = useState<"box" | "code" | null>(null);
  const postKeyRef = useRef<string | null>(null);
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
      setLineId(detail.lines.find((line) => line.scanned < line.expected)?.id ?? "");
    }
  }, [detail, lineId]);

  useEffect(() => {
    setScanCode("");
    setBoxCode("");
    setQuantity(1);
  }, [lineId]);

  const selectedLine = detail?.lines.find((line) => line.id === lineId);
  const selectedSku = selectedLine ? skuById.get(selectedLine.productId) : undefined;
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
    detail?.document.status === "DRAFT" || detail?.document.status === "SCANNING";
  const busy = scanMutation.isPending || registerBoxMutation.isPending;
  const working = busy || postMutation.isPending || cancelMutation.isPending;

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
    ) {
      return;
    }
    const normalizedBox = boxCode.trim();
    const normalizedCode = scanCode.trim();
    const scanQuantity =
      isSerialTracked || !isComponent
        ? 1
        : Math.max(1, Math.min(Number(quantity) || 1, remaining));

    if (isComponent && !normalizedBox) {
      message.error("SKU COMPONENT bắt buộc quét/nhập mã BOX trước khi ghi nhận.");
      return;
    }
    if ((!isComponent || isSerialTracked) && !normalizedCode) {
      message.error("Barcode/serial là bắt buộc cho dòng này.");
      return;
    }

    try {
      let containerId: string | undefined;
      if (isComponent) {
        const box = await registerBoxMutation.mutateAsync({
          id: documentId,
          lineId: selectedLine.id,
          boxCode: normalizedBox,
        });
        if (box.stock_effect !== "NONE" || box.movement_created !== false) {
          throw new Error("Đăng ký BOX không được làm thay đổi tồn kho.");
        }
        containerId = box.container_id;
      }

      const logicalCode = normalizedCode || normalizedBox;
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
      setScanLog((current) => [
        {
          code: logicalCode,
          result: `Hợp lệ · +${scanQuantity}`,
          lineId: first.line_id,
        },
        ...current,
      ]);
      setScanCode("");
      if (!isSerialTracked) setQuantity(1);
      await detailQuery.refetch();
      onChanged?.();
    } catch (error) {
      const errorText = getApiErrorMessage(error, "Scan không hợp lệ.");
      setScanLog((current) => [
        {
          code: scanCode.trim() || boxCode.trim(),
          result: errorText,
          lineId: selectedLine.id,
        },
        ...current,
      ]);
      message.error(errorText);
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
    ) {
      return;
    }
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
      message.success(
        "Full Post Receipt thành công. Tồn tăng đúng một lần; COMPONENT chuyển sang luồng Putaway.",
      );
      await detailQuery.refetch();
      onChanged?.();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không Full Post Receipt được."));
      await detailQuery.refetch();
      onChanged?.();
    }
  };

  const handleCancel = async () => {
    if (!detail || scanVersion === null || !cancelReason.trim() || !canCancel) return;
    try {
      await cancelMutation.mutateAsync({
        id: documentId,
        reason: cancelReason.trim(),
        ifMatch: scanVersion,
      });
      message.success("Đã Cancel phiếu nhập. Phiếu CANCELLED không làm thay đổi tồn kho.");
      setCancelOpen(false);
      onChanged?.();
      onClose();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không Cancel được phiếu nhập."));
      await detailQuery.refetch();
      onChanged?.();
    }
  };

  const progressPercent = totalExpected
    ? Math.min(100, Math.round((totalScanned / totalExpected) * 100))
    : 0;

  return (
    <>
      <Modal
        title={
          detail
            ? `Phiếu nhập · ${detail.document.code || documentId}`
            : "Phiếu nhập"
        }
        open
        width={1180}
        footer={null}
        onCancel={onClose}
        closable={!working}
        maskClosable={!working}
      >
        {detailQuery.isLoading && <div className="card">Đang tải phiếu nhập...</div>}
        {detailQuery.isError && (
          <Alert
            type="error"
            showIcon
            message={getApiErrorMessage(detailQuery.error, "Không tải được phiếu nhập.")}
          />
        )}

        {detail && (
          <>
            <div className="stats">
              <div className="stat">
                <div className="n">{totalScanned}</div>
                <div className="l">Đã scan</div>
              </div>
              <div className="stat">
                <div className="n">{totalExpected}</div>
                <div className="l">Expected</div>
              </div>
              <div className="stat">
                <div className="n">{detail.document.version}</div>
                <div className="l">Version / If-Match</div>
              </div>
              <div className="stat">
                <div className="n">{detail.document.status}</div>
                <div className="l">Trạng thái</div>
              </div>
            </div>

            <div className="card soft" style={{ marginBottom: 14 }}>
              <div className="section-title">Tiến độ Full Post</div>
              <Progress percent={progressPercent} status={isFullScan ? "success" : "active"} />
              <div className="footer-note">
                {isFullScan
                  ? "Mọi dòng đã scan đủ chính xác. Nếu phiếu đang SCANNING và có quyền inbound.post, có thể Full Post."
                  : `Đã ghi nhận ${totalScanned}/${totalExpected}. Không có partial post; phải đủ chính xác toàn bộ trước Post.`}
              </div>
            </div>

            {isMutable ? (
              <div className="grid-2">
                <div className="card">
                  <div className="section-title">Quét Barcode / QR</div>
                  <div className="field">
                    <label>Dòng nhận *</label>
                    <select
                      className="select"
                      value={lineId}
                      disabled={!canScan || busy}
                      onChange={(event) => setLineId(event.target.value)}
                    >
                      <option value="">Chọn dòng chưa đủ</option>
                      {detail.lines.map((line) => {
                        const sku = skuById.get(line.productId);
                        return (
                          <option
                            key={line.id}
                            value={line.id}
                            disabled={line.scanned >= line.expected}
                          >
                            {sku?.sku_code ?? line.productId} · {line.scanned}/{line.expected}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {isComponent && (
                    <div className="field">
                      <label>BOX *</label>
                      <Space.Compact style={{ width: "100%" }}>
                        <Input
                          value={boxCode}
                          disabled={!canScan || busy}
                          placeholder="Quét / nhập mã BOX chứa đúng một SKU"
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
                  )}

                  <div className="field">
                    <label>
                      {isComponent && !isSerialTracked
                        ? "Barcode/serial (không bắt buộc với COMPONENT quantity)"
                        : "Barcode / Serial *"}
                    </label>
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

                  {isComponent && !isSerialTracked && (
                    <div className="field">
                      <label>Số lượng trong lần nhận *</label>
                      <InputNumber
                        min={1}
                        max={Math.max(1, remaining)}
                        value={quantity}
                        onChange={(value) => setQuantity(Number(value ?? 1))}
                        disabled={!canScan || busy}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn primary"
                    disabled={!canScan || !lineId || busy || remaining <= 0}
                    onClick={() => void handleScan()}
                  >
                    {busy ? "Đang ghi nhận..." : "Ghi nhận scan"}
                  </button>

                  {selectedLine && (
                    <div className="footer-note">
                      {selectedSku?.sku_code ?? selectedLine.productId}: <b>{selectedLine.scanned}/{selectedLine.expected}</b> ·{" "}
                      {isComponent
                        ? "COMPONENT: BOX bắt buộc; Putaway sau Full Post"
                        : "PRODUCT: Barcode/QR inbound; RFID chưa bắt buộc tại Receipt"}
                    </div>
                  )}
                </div>

                <div className="card soft">
                  <div className="section-title">Guard nghiệp vụ</div>
                  <div className="rule">
                    <span
                      className="dot"
                      style={{ background: isFullScan ? "#16a34a" : "#d97706" }}
                    />
                    <span>
                      {isFullScan
                        ? "Tất cả dòng đã scan đủ chính xác."
                        : `Còn ${Math.max(totalExpected - totalScanned, 0)} đơn vị chưa ghi nhận.`}
                    </span>
                  </div>
                  <div className="rule">
                    <span className="dot" />
                    <span>Camera và nhập tay cùng đi một validation/API path; camera không đọc RFID.</span>
                  </div>
                  <div className="rule">
                    <span className="dot" />
                    <span>Scan/đăng ký BOX phải stock_effect=NONE, movement_created=false.</span>
                  </div>
                  <div className="rule">
                    <span className="dot" />
                    <span>Full Post dùng If-Match + Idempotency-Key; không được tăng tồn hai lần khi retry.</span>
                  </div>
                  <div className="rule">
                    <span className="dot" />
                    <span>COMPONENT sau Post vào danh sách chờ Putaway; Confirm Putaway không tạo movement.</span>
                  </div>
                  {receiptEvidence && (
                    <div className="footer-note">
                      Request: <b>{receiptEvidence.requestId}</b>
                      <br />
                      Movement: {receiptEvidence.movementRefs.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Alert
                type={detail.document.status === "POSTED" ? "success" : "info"}
                showIcon
                message={
                  detail.document.status === "POSTED"
                    ? "Phiếu đã Full Post. Đây là dữ liệu chỉ đọc; sai giao dịch phải xử lý bằng Reversal/Correction."
                    : "Phiếu đã CANCELLED. Không có stock effect và không thể tiếp tục scan/post."
                }
                style={{ marginBottom: 14 }}
              />
            )}

            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Tên</th>
                    <th>Expected</th>
                    <th>Đã scan</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => {
                    const sku = skuById.get(line.productId);
                    return (
                      <tr key={line.id}>
                        <td>{sku?.sku_code ?? line.productId}</td>
                        <td>{sku?.sku_name ?? "-"}</td>
                        <td>{line.expected}</td>
                        <td>{line.scanned}</td>
                        <td>
                          <Tag color={line.scanned === line.expected ? "success" : "warning"}>
                            {line.scanned === line.expected ? "ĐỦ" : "CHƯA ĐỦ"}
                          </Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {scanLog.length > 0 && (
              <div className="card soft" style={{ marginTop: 14 }}>
                <div className="section-title">Kết quả scan gần nhất</div>
                {scanLog.slice(0, 8).map((row, index) => (
                  <div key={`${row.code}-${index}`} className="kpi">
                    <span>{row.code || "-"}</span>
                    <span>{row.result}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
              <button type="button" className="btn" disabled={working} onClick={onClose}>
                Đóng
              </button>
              <div className="spacer" />
              {canCancel && isMutable && (
                <button
                  type="button"
                  className="btn danger"
                  disabled={working}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel phiếu
                </button>
              )}
              {isMutable && (
                <button
                  type="button"
                  className="btn success"
                  disabled={
                    !canPost ||
                    !isFullScan ||
                    detail.document.status !== "SCANNING" ||
                    postMutation.isPending
                  }
                  onClick={() => void handlePost()}
                >
                  {postMutation.isPending ? "Đang Full Post..." : "Full Post Receipt"}
                </button>
              )}
            </div>
          </>
        )}
      </Modal>

      <CameraScanModal
        open={cameraTarget !== null}
        title={cameraTarget === "box" ? "Quét mã BOX bằng camera" : "Quét Barcode / QR bằng camera"}
        onClose={() => setCameraTarget(null)}
        onDetected={(code) => {
          if (cameraTarget === "box") setBoxCode(code);
          else setScanCode(code);
          setCameraTarget(null);
          message.success("Đã đọc mã từ camera. Kiểm tra và bấm Ghi nhận scan.");
        }}
      />

      <Modal
        title="Cancel phiếu nhập"
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={() => void handleCancel()}
        okButtonProps={{ danger: true, disabled: !cancelReason.trim() || cancelMutation.isPending }}
        okText={cancelMutation.isPending ? "Đang Cancel..." : "Xác nhận Cancel"}
        cancelText="Quay lại"
      >
        <Alert
          type="warning"
          showIcon
          message="Cancel là trạng thái kết thúc, stock-neutral. Nếu muốn làm lại phải tạo phiếu mới."
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

/**
 * Legacy export kept temporarily for callers compiled against the old screen API.
 * The real IN-03 flow is now opened by InboundPage as an in-page modal.
 */
type LegacyScreenId = "IN-01" | "IN-02" | "IN-03";

export function InboundSourceScreen({ screenId }: { screenId: LegacyScreenId }) {
  return (
    <div className="card">
      {screenId === "IN-03"
        ? "Quét & Full Post Receipt được mở từ “Danh sách phiếu nhập” dưới dạng modal."
        : "IN-01/IN-02 được quản lý trong Danh sách phiếu nhập."}
    </div>
  );
}
