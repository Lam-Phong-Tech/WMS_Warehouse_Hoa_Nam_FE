import { useState } from "react";
import { formatDateTime } from "@/shared/utils/format-date";
import { UiAlert, UiButton } from "@/shared/ui";
import type {
  PackingLabelDetail,
  PackingLabelEvent,
} from "./packing-label-api";
import {
  packingLabelFailureText,
  LABEL_SNAPSHOT_STATUS_LABELS,
} from "./packing-label-labels";
import { printGate } from "./packing-label-view";
import { useT } from "@/shared/i18n/useT";
import { BrandMark } from "@/shared/ui/BrandMark";

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
  onRetry: () => void;
  canPrint: boolean;
  canReprint: boolean;
  busy: boolean;
  locked?: boolean;
};
const display = (value: string | undefined) => value?.trim() || "—";
const resultLabel = (result: string) =>
  result === "PRINTED"
    ? "Thành công"
    : result === "PRINT_FAILED"
      ? "Lỗi"
      : "Chưa xác định";
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
  onRetry,
  canPrint,
  canReprint,
  busy,
  locked = false,
}: Props) {
  const t = useT();
  const [zoom, setZoom] = useState("fit");
  if (loading)
    return (
      <div className="hn-label-detail__state" role="status">
        Đang tải bản lưu nhãn…
      </div>
    );
  if (error || !detail)
    return (
      <div className="hn-label-detail__state" role="alert">
        <h2>Không tải được bản lưu nhãn</h2>
        <p>Danh sách và bộ lọc của bạn được giữ nguyên.</p>
        <UiButton appearance="filled" onClick={onRetry}>
          Thử lại
        </UiButton>
        <UiButton appearance="outlined" onClick={onBack}>
          Quay lại danh sách
        </UiButton>
      </div>
    );
  const latest = detail.attempts[0];
  const missing = detail.missingFields ?? [];
  const gate = printGate(detail.status, detail.attempts, missing);
  const success = detail.attempts.filter((a) => a.result === "PRINTED").length;
  const reprints = detail.attempts.filter((a) => a.action === "REPRINT").length;
  const target = selectedEvent ?? latest;
  const printText = gate.action === "REPRINT" ? "In lại nhãn" : "In nhãn";
  const printButton = (
    <UiButton
      appearance="filled"
      disabled={
        !gate.action ||
        !(gate.action === "REPRINT" ? canReprint : canPrint) ||
        busy ||
        locked
      }
      onClick={onPrint}
    >
      {printText}
    </UiButton>
  );
  const sourceButton = (
    <UiButton
      appearance="outlined"
      disabled={!detail.outboundDocumentId}
      onClick={onOpenSource}
    >
      Mở phiếu xuất
    </UiButton>
  );
  const items = detail.items ?? [];
  const info = (
    <dl>
      <Field label="Mã nhãn" value={detail.labelCode} />
      <Field label="Phiếu xuất" value={detail.outboundNo} />
      <Field label="Toa xuất" value={detail.sourceNo} />
      <Field label="Bản lưu nhãn" value={detail.version} />
      <Field
        label="Nơi nhận"
        value={detail.snapshotRecipient || detail.recipient}
      />
    </dl>
  );

  return (
    <div
      className="hn-label-detail"
      data-testid={preview ? "packing-label-preview" : "packing-label-detail"}
    >
      <header className="hn-label-detail__heading">
        <div>
          <strong>{detail.labelCode}</strong>
          <p>
            {detail.outboundNo} · {detail.version || "Chưa có phiên bản"}
          </p>
        </div>
        <div className="hn-label-detail__actions">
          {preview ? (
            <UiButton appearance="outlined" onClick={onPreview}>
              Quay lại chi tiết nhãn
            </UiButton>
          ) : (
            <UiButton
              appearance="outlined"
              disabled={missing.length > 0}
              onClick={onPreview}
            >
              Xem trước nhãn
            </UiButton>
          )}
          {printButton}
          {sourceButton}
        </div>
      </header>
      {missing.length > 0 && (
        <section className="hn-label-detail__validation" role="alert">
          <UiAlert tone="error">
            Bản lưu nhãn thiếu dữ liệu bắt buộc. Không thể xem trước hoặc in cho
            đến khi dữ liệu được bổ sung qua luồng phiếu xuất.
          </UiAlert>
          <h2>Các lỗi kiểm tra dữ liệu</h2>
          <ul>
            {missing.map((field) => (
              <li key={field}>
                <strong>{field}</strong>
                <span>Thiếu trong bản lưu nhãn</span>
              </li>
            ))}
          </ul>
          <p>
            Đối chiếu với dữ liệu nguồn và tạo lại bản lưu qua luồng được cấp
            quyền. Không chỉnh sửa dữ liệu tại báo cáo.
          </p>
        </section>
      )}
      {gate.reason && missing.length === 0 && !locked && (
        <div className="hn-label-detail__validation">
          <UiAlert tone="warning">{gate.reason}</UiAlert>
          <UiButton appearance="outlined" disabled={busy} onClick={onRetry}>
            Kiểm tra trạng thái
          </UiButton>
        </div>
      )}
      {preview && missing.length === 0 ? (
        <div className="hn-label-detail__preview-grid">
          <section
            className="hn-label-detail__preview-stage"
            aria-label="Bản xem trước nhãn"
          >
            <div className="hn-label-detail__preview-toolbar">
              <label>
                Phóng to{" "}
                <select
                  aria-label="Phóng to bản xem trước"
                  value={zoom}
                  onChange={(e) => setZoom(e.target.value)}
                >
                  <option value="fit">Vừa khung</option>
                  <option value="80">80%</option>
                  <option value="100">100%</option>
                </select>
              </label>
              <span>1 / 1</span>
            </div>
            <div className={"hn-label-detail__paper-wrap zoom-" + zoom}>
              <span className="hn-label-detail__measure-top">100 mm</span>
              <span className="hn-label-detail__measure-side">150 mm</span>
              <article className="hn-label-detail__paper">
                <div className="hn-label-detail__paper-brand">
                  <BrandMark size={22} aria-hidden="true" /> HOA NAM WMS
                </div>
                <h2>NHÃN ĐÓNG GÓI</h2>
                {info}
                <div className="hn-label-detail__paper-items">
                  {items.map((item, i) => (
                    <div key={item.code + i}>
                      <strong>{item.code}</strong>
                      <span>{item.name}</span>
                      <b>
                        {item.quantity} {item.unit}
                      </b>
                    </div>
                  ))}
                </div>
                <p>
                  Tổng: {items.length} SKU /{" "}
                  {items.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm
                </p>
                <div className="hn-label-detail__barcode" aria-hidden="true" />
                <small>Mã minh họa · không dùng quét</small>
              </article>
            </div>
          </section>
          <section className="hn-label-detail__card">
            <h2>Thông tin nhãn</h2>
            {info}
            <UiAlert tone="success">
              Đủ dữ liệu bắt buộc trong bản lưu {detail.version}.
            </UiAlert>
            <UiAlert tone="info">
              Bản xem trước dùng đúng nội dung bất biến của nhãn. In lại giữ
              nguyên mã nhãn; không tạo phiếu xuất hoặc trừ tồn.
            </UiAlert>
          </section>
        </div>
      ) : (
        !preview && (
          <>
            <section
              className="hn-label-detail__summary"
              aria-label="Tóm tắt nhãn"
            >
              <div>
                <strong>1</strong>
                <span>Nhãn duy nhất</span>
              </div>
              <div>
                <strong>{detail.attempts.length}</strong>
                <span>Lượt in</span>
              </div>
              <div>
                <strong>{success}</strong>
                <span>Thành công</span>
              </div>
              <div>
                <strong>{reprints}</strong>
                <span>In lại</span>
              </div>
            </section>
            {target && (
              <section className="hn-label-detail__card">
                <h2>
                  {selectedEvent
                    ? "Chi tiết lượt in đang xem"
                    : "Lượt in gần nhất"}
                </h2>
                <dl className="hn-label-detail__metadata">
                  <Field
                    label="Lượt in"
                    value={
                      String(target.attemptNo || "—") +
                      " · " +
                      (target.action === "REPRINT"
                        ? "In lại"
                        : "In lần đầu / thử lại")
                    }
                  />
                  <Field
                    label="Thời gian"
                    value={
                      target.attemptedAt
                        ? formatDateTime(target.attemptedAt)
                        : ""
                    }
                  />
                  <Field label="Máy in" value={target.printerName} />
                  <Field label="Người thực hiện" value={target.actorName} />
                  <Field
                    label="Kết quả lượt này"
                    value={resultLabel(target.result)}
                  />
                  <Field
                    label="Phản hồi / lý do"
                    value={packingLabelFailureText(
                      target.reasonNote ||
                        target.errorCode ||
                        target.reasonCode,
                      t,
                    )}
                  />
                </dl>
                {latest &&
                  selectedEvent &&
                  latest.eventId !== selectedEvent.eventId && (
                    <UiAlert tone="info">
                      Đây là lượt in lịch sử. Kết quả gần nhất của nhãn:{" "}
                      {resultLabel(latest.result)}.
                    </UiAlert>
                  )}
              </section>
            )}
            <section className="hn-label-detail__card">
              <h2>Thông tin nhãn đóng gói</h2>
              <dl className="hn-label-detail__metadata">
                <Field label="Mã nhãn" value={detail.labelCode} />
                <Field
                  label="Mã phiếu xuất (nguồn)"
                  value={detail.outboundNo}
                />
                <Field label="Phiên bản nội dung" value={detail.version} />
                <Field
                  label="Trạng thái bản lưu"
                  value={
                    LABEL_SNAPSHOT_STATUS_LABELS[detail.status] || detail.status
                  }
                />
                <Field
                  label="Đơn vị nhận hàng"
                  value={detail.snapshotRecipient || detail.recipient}
                />
                <Field label="Toa xuất" value={detail.sourceNo} />
                <Field
                  label="Ngày tạo nhãn"
                  value={
                    detail.createdAt ? formatDateTime(detail.createdAt) : ""
                  }
                />
                <Field
                  label="Đã xác nhận dán nhãn"
                  value={
                    detail.appliedAt
                      ? formatDateTime(detail.appliedAt)
                      : "Chưa ghi nhận"
                  }
                />
              </dl>
            </section>
            <section className="hn-label-detail__card">
              <h2>Thông tin sản phẩm trên nhãn</h2>
              {items.length ? (
                <div className="hn-label-detail__products">
                  {items.map((item, i) => (
                    <div key={item.code + i}>
                      <div>
                        <strong>{item.code}</strong>
                        <span>{item.name || "—"}</span>
                      </div>
                      <b>
                        {item.quantity} {item.unit}
                      </b>
                    </div>
                  ))}
                </div>
              ) : (
                <p>
                  {detail.content || "Chưa có dữ liệu sản phẩm trong bản lưu"}
                </p>
              )}
            </section>
          </>
        )
      )}
      <section className="hn-label-detail__card hn-label-detail__history">
        <h2>Lịch sử in nhãn</h2>
        <div
          className="hn-label-detail__table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Lịch sử in, cuộn ngang để xem đầy đủ"
        >
          <table>
            <colgroup>
              {[9, 15, 20, 24, 13, 19].map((w, i) => (
                <col key={i} style={{ width: w + "%" }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>Lượt</th>
                <th>Loại in</th>
                <th>Thời gian</th>
                <th>Máy in / Người in</th>
                <th>Kết quả</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {detail.attempts.length ? (
                detail.attempts.map((attempt) => (
                  <tr
                    key={attempt.eventId}
                    className={
                      attempt.eventId === selectedEvent?.eventId
                        ? "is-selected"
                        : ""
                    }
                  >
                    <td>{attempt.attemptNo || "—"}</td>
                    <td>
                      {attempt.action === "REPRINT"
                        ? "In lại"
                        : "In lần đầu / thử lại"}
                    </td>
                    <td>
                      {attempt.attemptedAt
                        ? formatDateTime(attempt.attemptedAt)
                        : "—"}
                    </td>
                    <td>
                      {display(
                        [attempt.printerName, attempt.actorName]
                          .filter(Boolean)
                          .join(" · "),
                      )}
                    </td>
                    <td>{resultLabel(attempt.result)}</td>
                    <td>
                      {display(
                        packingLabelFailureText(
                          attempt.reasonNote ||
                            attempt.errorCode ||
                            attempt.reasonCode,
                          t,
                        ),
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>Chưa có lịch sử in.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <UiAlert tone="info">
        In lại giữ nguyên mã nhãn và bản lưu nội dung; chỉ tạo thêm lượt in.
        Không thay đổi tồn kho.
      </UiAlert>
    </div>
  );
}
