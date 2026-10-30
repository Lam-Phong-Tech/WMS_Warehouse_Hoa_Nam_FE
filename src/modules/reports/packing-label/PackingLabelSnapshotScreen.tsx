import { formatDateTime } from "@/shared/utils/format-date";
import type { PackingLabelDetail, PackingLabelEvent } from "./packing-label-api";
import { packingLabelFailureText, LABEL_SNAPSHOT_STATUS_LABELS } from "./packing-label-labels";
import { useT } from "@/shared/i18n/useT";

type Props = {
  detail: PackingLabelDetail | null;
  loading: boolean;
  error: unknown;
  preview: boolean;
  selectedEvent: PackingLabelEvent | null;
  onBack: () => void;
  onPreview: () => void;
  onPrint: () => void;
  onOpenSource: () => void;
};

const display = (value: string | undefined) => value?.trim() || "—";

function resultLabel(result: PackingLabelEvent["result"]) {
  if (result === "PRINTED") return "Thành công";
  if (result === "PRINT_FAILED") return "Lỗi";
  return "Đang xử lý";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="hn-label-detail__field">
      <dt>{label}</dt>
      <dd>{display(value)}</dd>
    </div>
  );
}

export function PackingLabelSnapshotScreen({
  detail,
  loading,
  error,
  preview,
  selectedEvent,
  onBack,
  onPreview,
  onPrint,
  onOpenSource,
}: Props) {
  const t = useT();
  if (loading) return <div className="hn-label-detail__state" role="status">Đang tải bản lưu nhãn…</div>;
  if (error || !detail) {
    return (
      <div className="hn-label-detail__state" role="alert">
        Không tải được bản lưu nhãn. Hãy quay lại danh sách và thử lại.
        <button type="button" onClick={onBack}>Quay lại danh sách</button>
      </div>
    );
  }

  const latest = detail.attempts[0];
  const successCount = detail.attempts.filter((item) => item.result === "PRINTED").length;
  const reprintCount = detail.attempts.filter((item) => item.action === "REPRINT").length;

  if (preview) {
    return (
      <main className="hn-label-detail hn-label-detail--preview" data-testid="packing-label-preview">
        <header className="hn-label-detail__heading">
          <button type="button" className="hn-label-detail__back" onClick={onPreview} aria-label="Quay lại chi tiết nhãn">‹</button>
          <div><h1>Xem trước nhãn</h1><p>Kiểm tra nội dung của bản lưu trước khi in</p></div>
        </header>
        <div className="hn-label-detail__preview-grid">
          <section className="hn-label-detail__preview-stage" aria-label="Bản xem trước nhãn">
            <div className="hn-label-detail__preview-toolbar">Phóng to <strong>100%</strong><span>Vừa khung</span></div>
            <div className="hn-label-detail__paper-wrap">
              <span className="hn-label-detail__measure-top">100 mm</span>
              <span className="hn-label-detail__measure-side">150 mm</span>
              <article className="hn-label-detail__paper">
                <div className="hn-label-detail__paper-brand">⬡ HOA NAM WMS</div>
                <h2>NHÃN ĐÓNG GÓI</h2>
                <dl>
                  <Field label="Mã nhãn" value={detail.labelCode} />
                  <Field label="Bản lưu nhãn" value={detail.version} />
                  <Field label="Phiếu xuất" value={detail.outboundNo} />
                  <Field label="Nơi nhận" value={detail.recipient} />
                  <Field label="Sản phẩm" value={detail.content} />
                </dl>
                <div className="hn-label-detail__barcode" aria-hidden="true" />
                <small>Mã minh họa · không dùng quét</small>
              </article>
            </div>
          </section>
          <aside className="hn-label-detail__card hn-label-detail__preview-info">
            <h2>Thông tin nhãn</h2>
            <dl>
              <Field label="Mã nhãn" value={detail.labelCode} />
              <Field label="Bản lưu nhãn" value={detail.version} />
              <Field label="Phiếu xuất" value={detail.outboundNo} />
              <Field label="Nơi nhận" value={detail.recipient} />
              <Field label="Sản phẩm" value={detail.content} />
            </dl>
            <div className="hn-label-detail__notice">Nội dung được lấy từ bản lưu nhãn. In lại chỉ tạo thêm lượt in, không thay đổi bản lưu.</div>
            <button type="button" className="hn-label-detail__primary" disabled={!selectedEvent} onClick={onPrint}>In lại…</button>
            <button type="button" disabled={!detail.outboundDocumentId} onClick={onOpenSource}>Mở phiếu xuất</button>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="hn-label-detail" data-testid="packing-label-detail">
      <header className="hn-label-detail__heading">
        <div><span className="hn-label-detail__breadcrumb">Báo cáo / Nhãn đóng gói / Chi tiết</span><h1>Chi tiết nhãn đóng gói</h1><button type="button" className="hn-label-detail__back-link" onClick={onBack}>← Quay lại danh sách nhãn đóng gói</button></div>
        <div className="hn-label-detail__actions"><button type="button" onClick={onPreview}>Xem trước nhãn</button><button type="button" className="hn-label-detail__primary" disabled={!selectedEvent} onClick={onPrint}>In lại…</button><button type="button" disabled={!detail.outboundDocumentId} onClick={onOpenSource}>Mở phiếu xuất</button></div>
      </header>
      <div className="hn-label-detail__grid">
        <section className="hn-label-detail__card"><h2>Thông tin nhãn đóng gói</h2><dl>
          <Field label="Mã nhãn" value={detail.labelCode} />
          <Field label="Mã phiếu xuất (nguồn)" value={detail.outboundNo} />
          <Field label="Phiên bản nội dung" value={detail.version} />
          <Field label="Trạng thái bản lưu" value={LABEL_SNAPSHOT_STATUS_LABELS[detail.status] || detail.status} />
          <Field label="Đơn vị nhận hàng" value={detail.recipient} />
          <Field label="Máy in sử dụng" value={latest?.printerName || selectedEvent?.printerName || ""} />
          <Field label="Người thực hiện in" value={latest?.actorName || selectedEvent?.actorName || ""} />
        </dl></section>
        <div className="hn-label-detail__right">
          <section className="hn-label-detail__card"><h2>Tóm tắt</h2><p>1 nhãn · {detail.attempts.length} lượt in · {reprintCount} lượt in lại</p><Field label="Kết quả in gần nhất" value={latest ? resultLabel(latest.result) : ""} /><Field label="Lượt in thành công" value={String(successCount)} /></section>
          <section className="hn-label-detail__card"><h2>Thông tin phiếu xuất (nguồn)</h2><dl><Field label="Mã phiếu xuất" value={detail.outboundNo} /><Field label="Ngày phiếu xuất" value={detail.outboundDate} /><Field label="Đơn vị nhận hàng" value={detail.recipient} /></dl></section>
          <section className="hn-label-detail__card"><h2>Thông tin sản phẩm trên nhãn</h2><dl><Field label="SKU / số lượng" value={detail.content} /><Field label="Bản lưu bất biến" value={detail.version} /></dl></section>
        </div>
      </div>
      <section className="hn-label-detail__card hn-label-detail__history"><h2>Lịch sử in nhãn</h2>
        <div className="hn-label-detail__table-wrap"><table><thead><tr><th>Lượt in</th><th>Loại in</th><th>Thời gian</th><th>Máy in / người in</th><th>Kết quả</th><th>Ghi chú</th></tr></thead><tbody>
          {detail.attempts.length ? detail.attempts.map((attempt) => <tr key={attempt.eventId}><td>{attempt.attemptNo || "—"}</td><td>{attempt.action === "REPRINT" ? "In lại" : "In lần đầu"}</td><td>{display(attempt.attemptedAt ? formatDateTime(attempt.attemptedAt) : "")}</td><td>{display([attempt.printerName, attempt.actorName].filter(Boolean).join(" · "))}</td><td>{resultLabel(attempt.result)}</td><td>{display(attempt.reasonNote || packingLabelFailureText(attempt.errorCode, t) || packingLabelFailureText(attempt.reasonCode, t))}</td></tr>) : <tr><td colSpan={6}>Chưa có lịch sử in.</td></tr>}
        </tbody></table></div>
        <div className="hn-label-detail__notice">In lại giữ nguyên mã nhãn và bản lưu nội dung; chỉ tạo thêm lượt in.</div>
      </section>
    </main>
  );
}
