import { useState } from "react";
import { UiDialog } from "@/shared/ui";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useBoxReadProjection, useContainerRegisterDetail } from "../hooks/use-inventory";

type Props = {
  containerId: string;
  warehouseId: string;
  code: string;
  onClose: () => void;
};

/** Read-only BOX register detail. The API deliberately does not promise availability or physical placement. */
export function BoxReadDetailDialog({ containerId, warehouseId, code, onClose }: Props) {
  const [showTray, setShowTray] = useState(false);
  const box = useBoxReadProjection(containerId, warehouseId);
  const trayId = showTray ? box.data?.parent_container_id : null;
  const tray = useContainerRegisterDetail(trayId);

  return (
    <UiDialog open onClose={onClose} title={`Chi tiết ${code}`} maxWidth="md" fullWidth className="hn-box-read-dialog">
      <div className="hn-box-read">
        {box.isLoading ? <p role="status">Đang tải BOX…</p> : null}
        {box.isError ? <ApiErrorAlert error={box.error} title="Không tải được chi tiết BOX" onRetry={() => box.refetch()} /> : null}
        {box.data ? (
          <>
            <div className="hn-box-read__grid">
              <div><span>Mã BOX</span><strong>{box.data.container_code}</strong></div>
              <div><span>SKU ghi nhận</span><strong>{box.data.sku?.code || "Chưa gán"}</strong></div>
              <div><span>Trạng thái</span><strong>{box.data.status || "—"}</strong></div>
              <div><span>Số lượng trong BOX đã ghi nhận</span><strong>{box.data.contained_qty === null ? "Chưa ghi nhận" : box.data.contained_qty.toLocaleString("vi-VN")}</strong></div>
              <div><span>Gợi ý vị trí đã lưu</span><strong>{box.data.location_hint || "Chưa có"}</strong></div>
              <div><span>Khay liên kết trong sổ</span><strong>{box.data.parent_container_id || "Chưa có"}</strong></div>
            </div>
            <p className="hn-box-read__note">Nguồn BOX chưa có dữ liệu lượng giữ và khả dụng. Gợi ý vị trí và liên kết khay chưa xác nhận vị trí vật lý.</p>
            {box.data.parent_container_id ? (
              <button type="button" className="hn-box-read__link" onClick={() => setShowTray((value) => !value)}>
                {showTray ? "Ẩn khay liên kết" : "Xem khay liên kết"}
              </button>
            ) : null}
            {showTray ? (
              <section className="hn-box-read__tray">
                <h3>Chi tiết khay trong sổ</h3>
                {tray.isLoading ? <p role="status">Đang tải khay…</p> : null}
                {tray.isError ? <ApiErrorAlert error={tray.error} title="Không tải được khay liên kết" onRetry={() => tray.refetch()} /> : null}
                {tray.data ? (
                  tray.data.container_type === "TRAY" ? (
                    <div className="hn-box-read__grid">
                      <div><span>Mã khay</span><strong>{tray.data.container_code}</strong></div>
                      <div><span>Trạng thái</span><strong>{tray.data.status || "—"}</strong></div>
                      <div><span>Gợi ý vị trí đã lưu</span><strong>{tray.data.location_hint || "Chưa có"}</strong></div>
                    </div>
                  ) : <p>Liên kết cha hiện không phải khay theo dữ liệu nguồn.</p>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </UiDialog>
  );
}
