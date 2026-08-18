import { useEffect, useState } from "react";
import {
  activateWaitingServiceWorker,
  PWA_UPDATE_READY_EVENT,
} from "./register-pwa";
import "./pwa-status.css";

export function PwaStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleUpdateReady = () => setUpdateReady(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady);
    };
  }, []);

  if (isOnline && !updateReady) return null;

  if (!isOnline) {
    return (
      <div className="wms-pwa-status wms-pwa-status--offline" role="status">
        <strong>Đang ngoại tuyến.</strong>
        <span>
          Chỉ giao diện tĩnh có thể dùng từ cache. Dữ liệu nghiệp vụ không được
          cache và mọi thao tác ghi đã bị khóa; hãy kết nối mạng rồi thử lại.
        </span>
      </div>
    );
  }

  return (
    <div className="wms-pwa-status wms-pwa-status--update" role="status">
      <span>Có phiên bản ứng dụng mới, cần tải lại để tránh chạy bundle cũ.</span>
      <button type="button" onClick={activateWaitingServiceWorker}>
        Cập nhật ngay
      </button>
    </div>
  );
}
