import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal } from "antd";
import { CloseOutlined } from "@ant-design/icons";

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
};
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

export interface CameraScanModalProps {
  open: boolean;
  title: string;
  onDetected: (code: string) => void;
  onClose: () => void;
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

/**
 * Camera Barcode/QR reader for Web WMS. It intentionally exposes only the
 * physical code; page-specific business validation must still run afterwards.
 */
export function CameraScanModal({
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
            // Detector failures can be transient; manual fallback remains available.
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
      footer={<Button icon={<CloseOutlined />} onClick={onClose}>Đóng / nhập tay</Button>}
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
            description="Đưa Barcode/QR vào khung hình. Camera chỉ đọc mã; dữ liệu vẫn phải qua validation nghiệp vụ như nhập tay. Camera không đọc RFID."
          />
        </>
      )}
    </Modal>
  );
}
