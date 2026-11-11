import { ReportExportAction } from "../components/ReportExportAction";
import { reportExportSections } from "../components/report-export-sections";
import {
  exportLocalReport,
  type ReportExportChoice,
} from "../components/report-export-workbook";
import { tStatic as tExport } from "@/shared/i18n/useT";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useMemo } from "react";
import { useWarehouseDirectory } from "@/shared/data/reference-queries";
import { useAuthStore } from "@/shared/store/auth.store";
import { CANONICAL_WAREHOUSE_CODE } from "@/modules/master-data/services/warehouse.service";
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
  const language = useLanguageStore((state) => state.language);
  const copy = (vi: string, en: string, zh: string) =>
    language === "vi" ? vi : language === "zh" ? zh : en;
  const context = useAuthStore((state) => state.currentContext);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const directory = useWarehouseDirectory({ enabled: authenticated });
  const warehouseCode = row.warehouse.trim().toUpperCase();
  const warehouse = (directory.data ?? []).find(
    (item) =>
      String(item.warehouse_code ?? item.code ?? "")
        .trim()
        .toUpperCase() === warehouseCode,
  );
  const warehouseName =
    String(warehouse?.warehouse_name ?? warehouse?.name ?? "").trim() ||
    (warehouseCode === CANONICAL_WAREHOUSE_CODE
      ? context?.warehouse_name?.trim() || "Kho Hoa Nam"
      : "—");
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
      ? copy("Phát sinh theo SKU", "Movements by SKU", "按 SKU 的变动")
      : view === "code"
        ? copy("Chi tiết đối soát mã", "Code reconciliation details", "编码对账详情")
        : copy("Chi tiết chênh lệch tồn", "Stock difference details", "库存差异详情");
  const status =
    view === "code"
      ? copy("Lệch mã", "Code mismatch", "编码差异")
      : copy("Lệch số lượng", "Quantity mismatch", "数量差异");
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
            {row.skuCode} ·{" "}
            {row.skuName || copy("Chưa có tên hàng", "No product name", "尚无品名")}
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
          ‹ {copy("Quay lại báo cáo", "Back to report", "返回报告")}
        </UiButton>
      }
    >
      <div
        className="hn-rpt02 rpt02-drilldown"
        data-testid="stock-reconcile-drilldown"
      >
        <div className="rpt02-drill-context">
          <p>
            {copy("Kho", "Warehouse", "仓库")}: {warehouseName} ·{" "}
            {copy("Kỳ báo cáo", "Reporting period", "报告期间")}:{" "}
            {date(range.from)} – {date(range.to)} ·{" "}
            {copy("Mốc dữ liệu", "Data as of", "数据截止")}: {asOfText}
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
                label={copy("Số dư đầu kỳ", "Opening balance", "期初余额")}
                value={qty(row.opening)}
                icon="file-clock"
              />
              <Metric
                label={copy("Tổng nhập", "Total receipts", "入库合计")}
                value={qty(row.inbound)}
                tone="green"
                icon="package-plus"
              />
              <Metric
                label={copy("Tổng xuất", "Total issues", "出库合计")}
                value={qty(row.productOutbound + row.componentOutbound)}
                tone="red"
                icon="package-minus"
              />
              <Metric
                label={copy("Hoàn tác", "Reversal", "冲销")}
                value={qty(row.reversal)}
                tone="orange"
                icon="circle-dot"
              />
              <Metric
                label={copy("Số dư cuối kỳ", "Closing balance", "期末余额")}
                value={qty(row.closing)}
                icon="warehouse"
              />
            </>
          ) : (
            <>
              <Metric
                label={copy("Tồn sổ", "Ledger stock", "账面库存")}
                value={qty(row.ledgerStock)}
                icon="file-clock"
              />
              <Metric
                label={copy("Tồn ghi nhận", "Recorded stock", "实盘库存")}
                value={qty(row.actual)}
                tone="green"
                icon="warehouse"
              />
              <Metric
                label={
                  view === "code"
                    ? copy("Chênh số lượng", "Quantity difference", "数量差异")
                    : copy("Chênh lệch", "Difference", "差异")
                }
                value={signed(row.delta)}
                tone={row.delta === 0 ? "orange" : "red"}
                icon="triangle-alert"
              />
              <Metric
                label={
                  view === "code"
                    ? copy(
                        "Phép kiểm không khớp",
                        "Unmatched checks",
                        "未匹配检查",
                      )
                    : copy("Khả dụng", "Available", "可用")
                }
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
                  {copy("Chi tiết phát sinh", "Movement details", "变动明细")}{" "}
                  <small>
                    (
                    {copy(
                      `${running.length} phát sinh đã ghi sổ`,
                      `${running.length} posted movements`,
                      `${running.length} 笔已记账变动`,
                    )}
                    )
                  </small>
                </h3>
                <div className="rpt02-drill-table-scroll">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>{copy("Thời gian", "Time", "时间")}</th>
                        <th>{copy("Chứng từ", "Document", "单据")}</th>
                        <th>{copy("Loại", "Type", "类型")}</th>
                        <th className="num">{copy("Tăng", "Increase", "增加")}</th>
                        <th className="num">{copy("Giảm", "Decrease", "减少")}</th>
                        <th className="num">
                          {copy("Tồn sổ sau", "Balance after", "结存")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.loading ? (
                        <tr>
                          <td colSpan={6}>
                            {copy(
                              "Đang tải phát sinh…",
                              "Loading movements…",
                              "正在加载变动…",
                            )}
                          </td>
                        </tr>
                      ) : running.length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            {copy(
                              "Không có phát sinh được trả về cho SKU này trong kỳ báo cáo.",
                              "No movements were returned for this SKU in the reporting period.",
                              "报告期间内没有返回此 SKU 的变动。",
                            )}
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
                      ? copy(
                          "Số lượng khớp nhưng phép kiểm mã chưa khớp.",
                          "Quantities match but code checks do not.",
                          "数量一致，但编码检查未匹配。",
                        )
                      : copy(
                          `Chênh lệch dữ liệu ${signed(row.delta)}; chưa xác định nguyên nhân.`,
                          `Data difference ${signed(row.delta)}; cause not identified.`,
                          `数据差异 ${signed(row.delta)}；原因尚未确定。`,
                        )}
                  </strong>
                  <span>
                    {view === "code"
                      ? copy(
                          "Cần đối chiếu danh sách mã tại cùng kho, SKU và mốc dữ liệu.",
                          "Reconcile the code lists for the same warehouse, SKU and data timestamp.",
                          "请在同一仓库、SKU 和数据截止时间下核对编码清单。",
                        )
                      : copy(
                          "Cần kiểm tra chứng từ và nguồn tồn trước khi kết luận.",
                          "Check the documents and stock source before concluding.",
                          "在得出结论前，请检查单据和库存来源。",
                        )}
                  </span>
                </div>
                <section className="rpt02-drill-card rpt02-drill-card--fill">
                  <h3>
                    {view === "code"
                      ? copy(
                          "Danh sách mã chưa khớp",
                          "Unmatched code list",
                          "未匹配编码清单",
                        )
                      : copy(
                          "Mã cần đối chiếu",
                          "Codes to reconcile",
                          "需核对的编码",
                        )}
                  </h3>
                  <p className="rpt02-drill-empty">
                    {copy(
                      "Nguồn đối soát hiện chỉ trả kết quả tổng hợp, chưa trả danh sách mã chênh lệch. Không có mã nào được suy đoán để hiển thị.",
                      "The reconciliation source currently returns aggregate results only, not the differing code list. No codes are inferred for display.",
                      "对账来源目前仅返回汇总结果，尚未返回差异编码清单。不会推测任何编码来显示。",
                    )}
                  </p>
                  {row.checks.length ? (
                    <div className="rpt02-drill-checks">
                      <strong>
                        {copy(
                          "Phép kiểm từ hệ thống:",
                          "System checks:",
                          "系统检查：",
                        )}
                      </strong>
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
              <h3>{copy("Thông tin đối soát", "Reconciliation details", "对账信息")}</h3>
              <dl>
                <div>
                  <dt>
                    {copy("SKU / Tên hàng", "SKU / Product name", "SKU / 品名")}
                  </dt>
                  <dd>
                    {row.skuCode}
                    <br />
                    {row.skuName || "—"}
                  </dd>
                </div>
                <div>
                  <dt>{copy("Kho", "Warehouse", "仓库")}</dt>
                  <dd>{warehouseName}</dd>
                </div>
                <div>
                  <dt>{copy("Loại hàng", "Item type", "货物类型")}</dt>
                  <dd>
                    {row.kind === "PRODUCT"
                      ? copy("Sản phẩm", "Product", "产品")
                      : row.kind === "COMPONENT"
                        ? copy("Linh kiện", "Component", "组件")
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{copy("Khoảng ngày", "Date range", "日期范围")}</dt>
                  <dd>
                    {date(range.from)} – {date(range.to)}
                  </dd>
                </div>
                <div>
                  <dt>{copy("Mốc dữ liệu", "Data as of", "数据截止")}</dt>
                  <dd>{asOfText}</dd>
                </div>
              </dl>
            </section>
            {view === "flow" ? (
              <section className="rpt02-drill-card">
                <h3>{copy("Đối chiếu tồn kho", "Stock reconciliation", "库存对账")}</h3>
                <dl>
                  <div>
                    <dt>{copy("Tồn sổ", "Ledger stock", "账面库存")}</dt>
                    <dd>{qty(row.ledgerStock)}</dd>
                  </div>
                  <div>
                    <dt>{copy("Tồn ghi nhận", "Recorded stock", "实盘库存")}</dt>
                    <dd>{qty(row.actual)}</dd>
                  </div>
                  <div>
                    <dt>{copy("Chênh lệch", "Difference", "差异")}</dt>
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
                    {copy("Xem chênh lệch ›", "View difference ›", "查看差异 ›")}
                  </button>
                ) : null}
              </section>
            ) : null}
            <section className="rpt02-drill-card">
              <h3>{copy("Công thức tính tồn sổ", "Ledger stock formula", "账面库存公式")}</h3>
              {row.hasFlow ? (
                <>
                  <p className="rpt02-drill-formula">
                    {qty(row.opening)} + {qty(row.inbound)} −{" "}
                    {qty(row.productOutbound)} − {qty(row.componentOutbound)} +{" "}
                    {qty(row.reversal)} = <strong>{qty(row.closing)}</strong>
                  </p>
                  <dl>
                    <div>
                      <dt>{copy("Tồn đầu kỳ", "Opening stock", "期初库存")}</dt>
                      <dd>{qty(row.opening)}</dd>
                    </div>
                    <div>
                      <dt>
                        {copy("Nhập kho trong kỳ", "Receipts in period", "期间入库")}
                      </dt>
                      <dd>+{qty(row.inbound)}</dd>
                    </div>
                    <div>
                      <dt>{copy("Xuất sản phẩm", "Product issues", "产品出库")}</dt>
                      <dd>−{qty(row.productOutbound)}</dd>
                    </div>
                    <div>
                      <dt>
                        {copy(
                          "Xuất linh kiện BH",
                          "Warranty component issues",
                          "保修组件出库",
                        )}
                      </dt>
                      <dd>−{qty(row.componentOutbound)}</dd>
                    </div>
                    <div>
                      <dt>{copy("Hoàn tác", "Reversal", "冲销")}</dt>
                      <dd>+{qty(row.reversal)}</dd>
                    </div>
                    <div>
                      <dt>{copy("Tồn cuối kỳ", "Closing stock", "期末库存")}</dt>
                      <dd>{qty(row.closing)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p>
                  {copy(
                    "Chưa có dữ liệu phát sinh trong kỳ để dựng công thức theo SKU này.",
                    "No movements in the period to build the formula for this SKU.",
                    "期间内没有变动数据，无法为此 SKU 生成公式。",
                  )}
                </p>
              )}
            </section>
            {view !== "flow" ? (
              <section className="rpt02-drill-card">
                <h3>{copy("Nguyên nhân", "Cause", "原因")}</h3>
                <p>{copy("Chưa xác định.", "Not identified.", "尚未确定。")}</p>
              </section>
            ) : null}
            <section className="rpt02-drill-card">
              <h3>{copy("Hành động tra cứu", "Lookup actions", "查询操作")}</h3>
              <button type="button" onClick={() => onViewChange("flow")}>
                {copy(
                  "Xem phát sinh theo SKU ›",
                  "View movements by SKU ›",
                  "查看按 SKU 的变动 ›",
                )}
              </button>
              <button type="button" onClick={onOpenInventory}>
                {copy(
                  "Mở tra cứu tồn ›",
                  "Open stock lookup ›",
                  "打开库存查询 ›",
                )}
              </button>
              <button type="button" onClick={onOpenTrace}>
                {copy("Mở truy vết ›", "Open traceability ›", "打开追踪 ›")}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </UiDrawer>
  );
}
