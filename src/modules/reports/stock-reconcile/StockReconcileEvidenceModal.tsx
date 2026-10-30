import { Box, UiDialog, UiStatusBadge } from "@/shared/ui";
import { formatDateTime } from "@/shared/utils/format-date";
import { checkLabelOf } from "./stock-reconcile-labels";
import { useSkuMovements } from "./stock-reconcile-api";

export type StockReconcileEvidence = {
  skuCode: string;
  skuName: string;
  warehouse: string;
  opening: number;
  inbound: number;
  productOutbound: number;
  componentOutbound: number;
  reversal: number;
  closing: number;
  actual: number;
  delta: number;
  checks: string[];
};

const quantity = (value: number) => value.toLocaleString("vi-VN");

/** Read-only evidence for the selected SKU. No serial-level comparison is implied. */
export function StockReconcileEvidenceModal({
  skuCode,
  skuName,
  warehouse,
  opening,
  inbound,
  productOutbound,
  componentOutbound,
  reversal,
  closing,
  actual,
  delta,
  checks,
  onClose,
}: StockReconcileEvidence & { onClose: () => void }) {
  const movements = useSkuMovements(skuCode);
  return (
    <UiDialog
      open
      onClose={onClose}
      title={`Bằng chứng đối soát · ${skuCode}`}
      maxWidth="lg"
      fullWidth
      className="rpt02-evidence-dialog"
      actions={
        <button type="button" className="rpt02-button rpt02-button--ghost" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <Box className="rpt02-evidence">
        <div className="rpt02-evidence__identity">
          <div><span>SKU</span><strong>{skuCode}</strong></div>
          <div><span>Tên hàng</span><strong>{skuName || "—"}</strong></div>
          <div><span>Kho</span><strong>{warehouse || "—"}</strong></div>
        </div>
        <div className="rpt02-evidence__metrics">
          <div><span>Tồn theo sổ cái</span><strong>{quantity(closing)}</strong></div>
          <div><span>Tồn ghi nhận</span><strong>{quantity(actual)}</strong></div>
          <div><span>Chênh lệch</span><strong className={delta === 0 ? "" : "is-alert"}>{delta > 0 ? "+" : ""}{quantity(delta)}</strong></div>
        </div>
        <section>
          <h3>Phép kiểm đối soát</h3>
          {checks.length ? (
            <div className="rpt02-evidence__checks">
              {checks.map((check) => <UiStatusBadge key={check} tone="warning" label={checkLabelOf(check)} />)}
            </div>
          ) : <p>Chưa có phép kiểm chi tiết từ dữ liệu hiện tại.</p>}
          {checks.some((check) => check.includes("serial") || check.includes("container")) ? (
            <p className="rpt02-evidence__note">API hiện chỉ trả kết quả kiểm tra tổng hợp; chưa có danh sách mã chênh lệch để hiển thị từng serial hoặc BOX.</p>
          ) : null}
        </section>
        <section>
          <h3>Phát sinh theo SKU</h3>
          <p className="rpt02-evidence__formula">
            {quantity(opening)} + {quantity(inbound)} − {quantity(productOutbound)} − {quantity(componentOutbound)} + {quantity(reversal)} = {quantity(closing)}
          </p>
          {movements.loading ? <p role="status">Đang tải phát sinh…</p> : movements.events.length ? (
            <div className="rpt02-evidence__table-wrap">
              <table className="report-table">
                <thead><tr><th>Mã phát sinh</th><th>Thời gian</th><th>Loại</th><th>Kho</th><th className="num">Thay đổi</th></tr></thead>
                <tbody>{movements.events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.movement_no || "—"}</td>
                    <td>{formatDateTime(event.occurred_at)}</td>
                    <td>{event.movement_type}</td>
                    <td>{event.warehouse_code || "—"}</td>
                    <td className="num">{event.qty_delta > 0 ? "+" : ""}{quantity(event.qty_delta)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p>Không có phát sinh được trả về trong 90 ngày gần đây.</p>}
        </section>
      </Box>
    </UiDialog>
  );
}
