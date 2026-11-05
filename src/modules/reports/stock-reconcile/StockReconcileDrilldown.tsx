import { ReportExportAction } from "../components/ReportExportAction";
import { reportExportSections } from "../components/report-export-sections";
import {
  exportLocalReport,
  type ReportExportChoice,
} from "../components/report-export-workbook";
import { tStatic as tExport } from "@/shared/i18n/useT";
import { useMemo } from "react";
import dayjs from "dayjs";
import { UiButton, UiDrawer, VuexyDemoIcon } from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { formatDateTime } from "@/shared/utils/format-date";
import { useDateTimePreferences } from "@/shared/store/interface-preferences.store";
import { checkLabelOf } from "./stock-reconcile-labels";
import { useSkuMovements } from "./stock-reconcile-api";
import "./stock-reconcile-drilldown.css";

export type ReconcileDetailView = "quantity" | "code" | "flow";

export type ReconcileDetail = {
  hasFlow: boolean;
  skuCode: string;
  skuName: string;
  warehouse: string;
  kind: string;
  opening: number;
  inbound: number;
  productOutbound: number;
  componentOutbound: number;
  reversal: number;
  closing: number;
  ledgerStock: number;
  actual: number;
  available: number | null;
  delta: number;
  checks: string[];
};

type Props = {
  row: ReconcileDetail;
  range: { from: string; to: string };
  asOf: string;
  view: ReconcileDetailView;
  canExport: boolean;
  onViewChange: (view: ReconcileDetailView) => void;
  onBack: () => void;
  onOpenInventory: () => void;
  onOpenTrace: () => void;
};

const qty = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const signed = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${qty(Math.abs(value))}`;
const date = (value: string) => dayjs(value).format("DD/MM/YYYY");

function Metric({
  label,
  value,
  tone = "blue",
  icon = "warehouse",
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "orange" | "red";
  icon?: Parameters<typeof VuexyDemoIcon>[0]["name"];
}) {
  return (
    <div className={`rpt02-drill-metric rpt02-drill-metric--${tone}`}>
      <span className="rpt02-drill-metric__icon">
        <VuexyDemoIcon name={icon} />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

export function StockReconcileDrilldown({
  row,
  range,
  asOf,
  view,
  canExport,
  onViewChange,
  onBack,
  onOpenInventory,
  onOpenTrace,
}: Props) {
  useDateTimePreferences();
  const drawer = useDialogExit(onBack);
  const movements = useSkuMovements(row.skuCode, range);
  const events = useMemo(
    () =>
      movements.events
        .filter(
          (event) =>
            event.warehouse_code === row.warehouse || !event.warehouse_code,
        )
        .filter(
          (event) =>
            event.occurred_at.slice(0, 10) >= range.from &&
            event.occurred_at.slice(0, 10) <= range.to,
        )
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)),
    [movements.events, range.from, range.to, row.warehouse],
  );
  const running = events.reduce<
    { event: (typeof events)[number]; stock: number }[]
  >((items, event) => {
    items.push({
      event,
      stock: (items.at(-1)?.stock ?? row.opening) + event.qty_delta,
    });
    return items;
  }, []);
  const heading =
    view === "flow"
      ? "Phát sinh theo SKU"
      : view === "code"
        ? "Chi tiết đối soát mã"
        : "Chi tiết chênh lệch tồn";
  const status = view === "code" ? "Lệch mã" : "Lệch số lượng";
  const asOfText = asOf ? formatDateTime(asOf) : date(range.to);

  const exportMovements = (choice: ReportExportChoice) =>
    exportLocalReport(
      ["Thời gian", "Chứng từ", "Loại", "Tăng", "Giảm", "Tồn sổ sau"],
      running.map(({ event, stock }) => [
        formatDateTime(event.occurred_at),
        event.movement_no,
        event.movement_type,
        Math.max(0, event.qty_delta),
        Math.max(0, -event.qty_delta),
        stock,
      ]),
      choice,
    );

  return (
    <UiDrawer
      {...drawer.dialogProps}
      width={820}
      className="rpt02-drill-drawer"
      title={
        <span className="rpt02-drill-heading">
          <span className="rpt02-drill-title">{heading}</span>
          <span className="rpt02-drill-identity">
            {" "}
            {row.skuCode} · {row.skuName || "Chưa có tên hàng"}
          </span>
          <ActionIconButton
            kind="close"
            label={tExport("common.close")}
            onClick={drawer.close}
            className="rpt02-drill-close"
          />
        </span>
      }
      actions={
        <UiButton appearance="outlined" onClick={drawer.close}>
          ‹ Quay lại báo cáo
        </UiButton>
      }
    >
      <div
        className="hn-rpt02 rpt02-drilldown"
        data-testid="stock-reconcile-drilldown"
      >
        <div className="rpt02-drill-context">
          <p>
            Kho: {row.warehouse || "—"} · Kỳ báo cáo: {date(range.from)} –{" "}
            {date(range.to)} · Mốc dữ liệu: {asOfText}
          </p>
          {view !== "flow" ? (
            <span className={`rpt02-drill-badge rpt02-drill-badge--${view}`}>
              {status}
            </span>
          ) : null}
          {view === "flow" && canExport ? (
            <ReportExportAction
              title={tExport("reportExport.stock")}
              fileStem={
                "PhatSinh_" + row.skuCode + "_" + range.from + "-" + range.to
              }
              total={running.length}
              sections={reportExportSections(
                tExport("reportExport.movements"),
                "none",
              )}
              onExport={exportMovements}
            />
          ) : null}
        </div>
        <div className="rpt02-drill-metrics">
          {view === "flow" ? (
            <>
              <Metric
                label="Số dư đầu kỳ"
                value={qty(row.opening)}
                icon="file-clock"
              />
              <Metric
                label="Tổng nhập"
                value={qty(row.inbound)}
                tone="green"
                icon="package-plus"
              />
              <Metric
                label="Tổng xuất"
                value={qty(row.productOutbound + row.componentOutbound)}
                tone="red"
                icon="package-minus"
              />
              <Metric
                label="Hoàn tác"
                value={qty(row.reversal)}
                tone="orange"
                icon="circle-dot"
              />
              <Metric
                label="Số dư cuối kỳ"
                value={qty(row.closing)}
                icon="warehouse"
              />
            </>
          ) : (
            <>
              <Metric
                label="Tồn sổ"
                value={qty(row.ledgerStock)}
                icon="file-clock"
              />
              <Metric
                label="Tồn ghi nhận"
                value={qty(row.actual)}
                tone="green"
                icon="warehouse"
              />
              <Metric
                label={view === "code" ? "Chênh số lượng" : "Chênh lệch"}
                value={signed(row.delta)}
                tone={row.delta === 0 ? "orange" : "red"}
                icon="triangle-alert"
              />
              <Metric
                label={view === "code" ? "Phép kiểm không khớp" : "Khả dụng"}
                value={
                  view === "code"
                    ? String(row.checks.length)
                    : row.available === null
                      ? "—"
                      : qty(row.available)
                }
                tone="orange"
                icon="triangle-alert"
              />
            </>
          )}
        </div>

        <div className="rpt02-drill-grid">
          <div className="rpt02-drill-main">
            {view === "flow" ? (
              <section className="rpt02-drill-card">
                <h3>
                  Chi tiết phát sinh{" "}
                  <small>({running.length} phát sinh đã ghi sổ)</small>
                </h3>
                <div className="rpt02-drill-table-scroll">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Chứng từ</th>
                        <th>Loại</th>
                        <th className="num">Tăng</th>
                        <th className="num">Giảm</th>
                        <th className="num">Tồn sổ sau</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.loading ? (
                        <tr>
                          <td colSpan={6}>Đang tải phát sinh…</td>
                        </tr>
                      ) : running.length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            Không có phát sinh được trả về cho SKU này trong kỳ
                            báo cáo.
                          </td>
                        </tr>
                      ) : (
                        running.map(({ event, stock }) => (
                          <tr key={event.id}>
                            <td>{formatDateTime(event.occurred_at)}</td>
                            <td>{event.movement_no || "—"}</td>
                            <td>{event.movement_type}</td>
                            <td className="num is-positive">
                              {event.qty_delta > 0 ? qty(event.qty_delta) : "0"}
                            </td>
                            <td className="num is-negative">
                              {event.qty_delta < 0
                                ? qty(-event.qty_delta)
                                : "0"}
                            </td>
                            <td className="num">
                              <strong>{qty(stock)}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <>
                <div className={`rpt02-drill-alert rpt02-drill-alert--${view}`}>
                  <strong>
                    {view === "code"
                      ? "Số lượng khớp nhưng phép kiểm mã chưa khớp."
                      : `Chênh lệch dữ liệu ${signed(row.delta)}; chưa xác định nguyên nhân.`}
                  </strong>
                  <span>
                    {view === "code"
                      ? "Cần đối chiếu danh sách mã tại cùng kho, SKU và mốc dữ liệu."
                      : "Cần kiểm tra chứng từ và nguồn tồn trước khi kết luận."}
                  </span>
                </div>
                <section className="rpt02-drill-card rpt02-drill-card--fill">
                  <h3>
                    {view === "code"
                      ? "Danh sách mã chưa khớp"
                      : "Mã cần đối chiếu"}
                  </h3>
                  <p className="rpt02-drill-empty">
                    Nguồn đối soát hiện chỉ trả kết quả tổng hợp, chưa trả danh
                    sách mã chênh lệch. Không có mã nào được suy đoán để hiển
                    thị.
                  </p>
                  {row.checks.length ? (
                    <div className="rpt02-drill-checks">
                      <strong>Phép kiểm từ hệ thống:</strong>
                      {row.checks.map((check) => (
                        <span key={check}>{checkLabelOf(check)}</span>
                      ))}
                    </div>
                  ) : null}
                </section>
              </>
            )}
          </div>

          <aside className="rpt02-drill-side">
            <section className="rpt02-drill-card">
              <h3>Thông tin đối soát</h3>
              <dl>
                <div>
                  <dt>SKU / Tên hàng</dt>
                  <dd>
                    {row.skuCode}
                    <br />
                    {row.skuName || "—"}
                  </dd>
                </div>
                <div>
                  <dt>Kho</dt>
                  <dd>{row.warehouse || "—"}</dd>
                </div>
                <div>
                  <dt>Loại hàng</dt>
                  <dd>
                    {row.kind === "PRODUCT"
                      ? "Sản phẩm"
                      : row.kind === "COMPONENT"
                        ? "Linh kiện"
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Khoảng ngày</dt>
                  <dd>
                    {date(range.from)} – {date(range.to)}
                  </dd>
                </div>
                <div>
                  <dt>Mốc dữ liệu</dt>
                  <dd>{asOfText}</dd>
                </div>
              </dl>
            </section>
            {view === "flow" ? (
              <section className="rpt02-drill-card">
                <h3>Đối chiếu tồn kho</h3>
                <dl>
                  <div>
                    <dt>Tồn sổ</dt>
                    <dd>{qty(row.ledgerStock)}</dd>
                  </div>
                  <div>
                    <dt>Tồn ghi nhận</dt>
                    <dd>{qty(row.actual)}</dd>
                  </div>
                  <div>
                    <dt>Chênh lệch</dt>
                    <dd className={row.delta ? "is-alert" : ""}>
                      {signed(row.delta)}
                    </dd>
                  </div>
                </dl>
                {row.delta !== 0 ? (
                  <button
                    className="rpt02-drill-link"
                    type="button"
                    onClick={() => onViewChange("quantity")}
                  >
                    Xem chênh lệch ›
                  </button>
                ) : null}
              </section>
            ) : null}
            <section className="rpt02-drill-card">
              <h3>Công thức tính tồn sổ</h3>
              {row.hasFlow ? (
                <>
                  <p className="rpt02-drill-formula">
                    {qty(row.opening)} + {qty(row.inbound)} −{" "}
                    {qty(row.productOutbound)} − {qty(row.componentOutbound)} +{" "}
                    {qty(row.reversal)} = <strong>{qty(row.closing)}</strong>
                  </p>
                  <dl>
                    <div>
                      <dt>Tồn đầu kỳ</dt>
                      <dd>{qty(row.opening)}</dd>
                    </div>
                    <div>
                      <dt>Nhập kho trong kỳ</dt>
                      <dd>+{qty(row.inbound)}</dd>
                    </div>
                    <div>
                      <dt>Xuất sản phẩm</dt>
                      <dd>−{qty(row.productOutbound)}</dd>
                    </div>
                    <div>
                      <dt>Xuất linh kiện BH</dt>
                      <dd>−{qty(row.componentOutbound)}</dd>
                    </div>
                    <div>
                      <dt>Hoàn tác</dt>
                      <dd>+{qty(row.reversal)}</dd>
                    </div>
                    <div>
                      <dt>Tồn cuối kỳ</dt>
                      <dd>{qty(row.closing)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p>
                  Chưa có dữ liệu phát sinh trong kỳ để dựng công thức theo SKU
                  này.
                </p>
              )}
            </section>
            {view !== "flow" ? (
              <section className="rpt02-drill-card">
                <h3>Nguyên nhân</h3>
                <p>Chưa xác định.</p>
              </section>
            ) : null}
            <section className="rpt02-drill-card">
              <h3>Hành động tra cứu</h3>
              <button type="button" onClick={() => onViewChange("flow")}>
                Xem phát sinh theo SKU ›
              </button>
              <button type="button" onClick={onOpenInventory}>
                Mở tra cứu tồn ›
              </button>
              <button type="button" onClick={onOpenTrace}>
                Mở truy vết ›
              </button>
            </section>
          </aside>
        </div>
      </div>
    </UiDrawer>
  );
}
