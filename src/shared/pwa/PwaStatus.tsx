import { useEffect, useState } from "react";
import {
  activateWaitingServiceWorker,
  PWA_UPDATE_READY_EVENT,
} from "./register-pwa";
import { useT } from "@/shared/i18n/useT";
import { runtimeConfig } from "@/shared/config/env";
import "./pwa-status.css";

export function PwaStatus() {
  const t = useT();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    // TẠM THỜI — chế độ máy quét: không hỏi, tự áp bản mới ngay. Thanh nhắc
    // "Có phiên bản ứng dụng mới" là một cửa sổ nữa bắt người đang quét phải
    // dừng tay bấm nút. Bản mới vẫn được áp, chỉ là không hỏi.
    const handleUpdateReady = () => {
      if (runtimeConfig.scannerKioskMode) {
        activateWaitingServiceWorker();
        return;
      }
      setUpdateReady(true);
    };

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
        <strong>{t("shared.pwa.offlineTitle")}</strong>
        <span>{t("shared.pwa.offlineBody")}</span>
      </div>
    );
  }

  return (
    <div className="wms-pwa-status wms-pwa-status--update" role="status">
      <span>{t("shared.pwa.updateReady")}</span>
      <button type="button" onClick={activateWaitingServiceWorker}>
        {t("shared.pwa.updateNow")}
      </button>
    </div>
  );
}
