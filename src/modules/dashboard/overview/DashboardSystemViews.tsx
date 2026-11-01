import { useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { DashIcon } from "../components/DashIcon";
import { dashboardNow, fmt } from "./overview-data";
import { useStockReconcileSnapshot } from "@/modules/reports/stock-reconcile/stock-reconcile-api";
import {
  useInventoryFlowSnapshot,
  type FlowDocument,
} from "@/modules/reports/inventory-flow/inventory-flow-api";
import type { DashboardOverview } from "../types";
import { buildDashboardThresholds } from "./dashboard-threshold-model";
import "./dashboard-system-views.css";

export type DashboardSystemView =
  "work" | "stock" | "thresholds" | "transaction";

type Props = {
  view: DashboardSystemView;
  documentId?: string;
  overview?: DashboardOverview;
  showWarranty?: boolean;
  onNavigate: (route: string) => void;
};

const home = "/dashboard?screen=MAP-01";
const link = (view: DashboardSystemView, extra = "") =>
  `${home}&view=${view}${extra}`;
const dateTime = (value?: string) =>
  value && dayjs(value).isValid()
    ? dayjs(value).format(
        value.length <= 10 ? "DD/MM/YYYY" : "DD/MM/YYYY HH:mm",
      )
    : "—";

function Frame({
  title,
  description,
  onNavigate,
  children,
}: {
  title: string;
  description: string;
  onNavigate: Props["onNavigate"];
  children: ReactNode;
}) {
  return (
    <div className="dashboard-system-view">
      <nav className="system-view-breadcrumb" aria-label="Điều hướng">
        <button type="button" onClick={() => onNavigate(home)}>
          Tổng quan
        </button>
        <span aria-hidden="true">/</span>
        <strong>{title}</strong>
      </nav>
      <header className="system-view-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button type="button" onClick={() => onNavigate(home)}>
          <DashIcon name="arrow-right" /> Về tổng quan
        </button>
      </header>
      {children}
    </div>
  );
}

function DataState({
  loading,
  error,
  onRetry,
  empty,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: string;
}) {
  if (loading)
    return (
      <div className="system-view-state" role="status">
        Đang tải số liệu…
      </div>
    );
  if (error)
    return (
      <div className="system-view-state is-error" role="alert">
        Không tải được số liệu.{" "}
        <button type="button" onClick={onRetry}>
          Thử lại
        </button>
      </div>
    );
  return <div className="system-view-state">{empty}</div>;
}

function PartialNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="snapshot-partial-alert" role="status">
      Dữ liệu đang hiển thị có thể đã cũ. Lần cập nhật mới chưa hoàn tất.{" "}
      <button type="button" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}

function WorkView({
  overview,
  showWarranty = false,
  onNavigate,
}: Omit<Props, "view">) {
  const source = useStockReconcileSnapshot({ asOf: "" });
  const hasSnapshot = Boolean(source.snapshot.as_of);
  const [selectedKey, setSelectedKey] = useState("");
  const [category, setCategory] = useState("reconcile");
  const mismatches = source.snapshot.rows.filter(
    (row) => row.reconciliation_status === "MISMATCH",
  );
  const selected =
    mismatches.find(
      (row) => `${row.warehouse_id}:${row.drillKey}` === selectedKey,
    ) ?? mismatches[0];
  const groups = [
    {
      id: "reconcile",
      label: "Đối soát tồn",
      count: overview?.issues.inventory_mismatch ?? null,
      route: "/reports/stock-reconcile",
    },
    {
      id: "outbound",
      label: "Yêu cầu xuất lỗi",
      count: null,
      route: "/outbound",
    },
    {
      id: "labels",
      label: "Nhãn in lỗi",
      count: overview?.issues.print_failed ?? null,
      route: "/reports/packing-label",
    },
    { id: "putaway", label: "Chờ xếp khay", count: null, route: "/putaway" },
    ...(showWarranty
      ? [
          {
            id: "warranty",
            label: "Bảo hành quá hạn",
            count: overview?.warranty.overdue_count ?? null,
            route: "/warranty",
          },
        ]
      : []),
  ];
  const active = groups.find((group) => group.id === category) ?? groups[0];
  return (
    <Frame
      title="Việc cần xử lý"
      description="Các nhóm có thể trùng chứng từ; số lượng từng nhóm không cộng thành tổng duy nhất."
      onNavigate={onNavigate}
    >
      <div
        className="system-view-tabs"
        role="tablist"
        aria-label="Nhóm công việc"
      >
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={category === group.id}
            onClick={() => setCategory(group.id)}
          >
            {group.label}{" "}
            <span>{group.count === null ? "—" : fmt(group.count)}</span>
          </button>
        ))}
      </div>
      {source.error && hasSnapshot ? (
        <PartialNotice onRetry={() => void source.refetch()} />
      ) : null}
      {category === "reconcile" ? (
        <div className="system-view-split">
          <section className="system-view-card">
            <header>
              <h2>Chênh lệch cần xác minh · {fmt(mismatches.length)} dòng</h2>
              <button type="button" onClick={() => onNavigate(active.route)}>
                Mở đối soát <DashIcon name="arrow-right" />
              </button>
            </header>
            {source.loading || (source.error && !hasSnapshot) || mismatches.length === 0 ? (
              <DataState
                loading={source.loading}
                error={hasSnapshot ? null : source.error}
                onRetry={() => void source.refetch()}
                empty="Hiện không có dòng đối soát lệch."
              />
            ) : (
              <div className="system-view-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Sản phẩm</th>
                      <th>Kho</th>
                      <th>Sổ</th>
                      <th>Số dư</th>
                      <th>Lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mismatches.map((row) => (
                      <tr
                        key={`${row.warehouse_id}-${row.drillKey}`}
                        className={row === selected ? "is-selected" : ""}
                      >
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedKey(
                                `${row.warehouse_id}:${row.drillKey}`,
                              )
                            }
                          >
                            {row.sku_code}
                          </button>
                        </td>
                        <td>{row.sku_name || "—"}</td>
                        <td>{row.warehouse_code || "—"}</td>
                        <td>{fmt(row.ledger_qty)}</td>
                        <td>{fmt(row.balance_qty)}</td>
                        <td className="is-negative">{fmt(row.delta_qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="system-view-card system-view-detail">
            <h2>Chi tiết dòng đang chọn</h2>
            {selected ? (
              <>
                <strong className="system-view-code">
                  {selected.sku_code}
                </strong>
                <p>{selected.sku_name}</p>
                <dl>
                  <div>
                    <dt>Kho</dt>
                    <dd>{selected.warehouse_code || "—"}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái tồn</dt>
                    <dd>{selected.stock_status || "—"}</dd>
                  </div>
                  <div>
                    <dt>Sổ movement</dt>
                    <dd>{fmt(selected.ledger_qty)}</dd>
                  </div>
                  <div>
                    <dt>Số dư hệ thống</dt>
                    <dd>{fmt(selected.balance_qty)}</dd>
                  </div>
                  <div>
                    <dt>Chênh lệch</dt>
                    <dd className="is-negative">{fmt(selected.delta_qty)}</dd>
                  </div>
                  <div>
                    <dt>Cập nhật số dư</dt>
                    <dd>{dateTime(selected.balance_updated_at)}</dd>
                  </div>
                </dl>
                <p className="system-view-note">
                  Chênh lệch sổ và số dư cần kiểm tra. Đây chưa phải kết luận
                  thiếu hàng thực tế.
                </p>
                <button
                  className="system-view-primary"
                  type="button"
                  onClick={() => onNavigate(active.route)}
                >
                  Mở đối soát tồn
                </button>
              </>
            ) : (
              <p>Chọn một dòng để xem chi tiết.</p>
            )}
          </section>
        </div>
      ) : (
        <section className="system-view-card system-view-category">
          <h2>{active.label}</h2>
          <p>
            {active.count === null
              ? "Chưa có số tổng hợp đáng tin cậy cho nhóm này trong Dashboard API."
              : `Có ${fmt(active.count)} mục được ghi nhận.`}{" "}
            Danh sách và thao tác nằm ở màn nghiệp vụ gốc.
          </p>
          <button
            className="system-view-primary"
            type="button"
            onClick={() => onNavigate(active.route)}
          >
            Mở {active.label.toLowerCase()} <DashIcon name="arrow-right" />
          </button>
        </section>
      )}
    </Frame>
  );
}

function StockView({ onNavigate }: Omit<Props, "view">) {
  const today = dashboardNow().format("YYYY-MM-DD");
  const balance = useStockReconcileSnapshot({ asOf: "" });
  const flow = useInventoryFlowSnapshot({ from: today, to: today });
  const hasBalance = Boolean(balance.snapshot.as_of);
  const hasFlow = Boolean(flow.snapshot.as_of);
  const byType = (["PRODUCT", "COMPONENT"] as const).map((type) => {
    const rows = balance.snapshot.rows.filter((row) => row.item_kind === type);
    const onHand = rows.reduce((sum, row) => sum + row.balance_qty, 0);
    const available = rows.reduce((sum, row) => sum + row.available_qty, 0);
    return { type, onHand, available, unavailable: onHand - available };
  });
  const summary = flow.snapshot.summary;
  return (
    <Frame
      title="Tồn kho & biến động"
      description="Giải thích tồn hiện có và biến động ghi sổ trong ngày."
      onNavigate={onNavigate}
    >
      <div className="system-view-split">
        <section className="system-view-card">
          <header>
            <h2>Tồn kho hiện tại</h2>
            <button
              type="button"
              onClick={() => onNavigate("/reports/stock-reconcile")}
            >
              Xem đối soát <DashIcon name="arrow-right" />
            </button>
          </header>
          {balance.error && hasBalance ? (
            <PartialNotice onRetry={() => void balance.refetch()} />
          ) : null}
          {balance.loading || (balance.error && !hasBalance) ? (
            <DataState
              loading={balance.loading}
              error={hasBalance ? null : balance.error}
              onRetry={() => void balance.refetch()}
              empty=""
            />
          ) : (
            <>
              <div className="system-view-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Loại hàng</th>
                      <th>Tồn hiện có</th>
                      <th>Khả dụng</th>
                      <th>Không khả dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byType.map((row) => (
                      <tr key={row.type}>
                        <th>
                          {row.type === "PRODUCT" ? "Sản phẩm" : "Linh kiện"}
                        </th>
                        <td>{fmt(row.onHand)}</td>
                        <td>{fmt(row.available)}</td>
                        <td>{fmt(row.unavailable)}</td>
                      </tr>
                    ))}
                    <tr className="is-total">
                      <th>Tổng</th>
                      <td>{fmt(byType.reduce((n, r) => n + r.onHand, 0))}</td>
                      <td>
                        {fmt(byType.reduce((n, r) => n + r.available, 0))}
                      </td>
                      <td>
                        {fmt(byType.reduce((n, r) => n + r.unavailable, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="system-view-note">
                Tồn hiện có = khả dụng + không khả dụng. Ảnh chụp đối soát lúc{" "}
                {dateTime(balance.snapshot.as_of)}.
              </p>
            </>
          )}
        </section>
        <section className="system-view-card">
          <header>
            <h2>Biến động ngày {dayjs(today).format("DD/MM/YYYY")}</h2>
            <button
              type="button"
              onClick={() => onNavigate("/reports/inventory-flow")}
            >
              Xem báo cáo <DashIcon name="arrow-right" />
            </button>
          </header>
          {flow.error && hasFlow ? (
            <PartialNotice onRetry={() => void flow.refetch()} />
          ) : null}
          {flow.loading || (flow.error && !hasFlow) ? (
            <DataState
              loading={flow.loading}
              error={hasFlow ? null : flow.error}
              onRetry={() => void flow.refetch()}
              empty=""
            />
          ) : (
            <>
              <div className="system-view-equation">
                <div>
                  <span>Đầu ngày</span>
                  <strong>{fmt(summary.opening)}</strong>
                </div>
                <div>
                  <span>+ Nhập</span>
                  <strong>{fmt(summary.receiptNet)}</strong>
                </div>
                <div>
                  <span>− Xuất sản phẩm</span>
                  <strong>{fmt(summary.issueNet)}</strong>
                </div>
                <div>
                  <span>− Xuất linh kiện BH</span>
                  <strong>{fmt(summary.componentNet)}</strong>
                </div>
                <div>
                  <span>+ Hoàn tác</span>
                  <strong>{fmt(summary.reversalUnlinked)}</strong>
                </div>
                <div className="is-total">
                  <span>Cuối ngày (tồn hiện có)</span>
                  <strong>{fmt(summary.closing)}</strong>
                </div>
              </div>
              <p className="system-view-note">
                Phương trình dùng tồn hiện có. Quét, xếp khay và in nhãn không
                tự làm thay đổi số tồn. Đã ghi sổ đến{" "}
                {dateTime(flow.snapshot.source_watermark)}.
              </p>
            </>
          )}
        </section>
      </div>
    </Frame>
  );
}

function ThresholdView({ onNavigate }: Omit<Props, "view">) {
  const source = useStockReconcileSnapshot({ asOf: "" });
  const hasSnapshot =
    Boolean(source.snapshot.as_of) && source.thresholds.size > 0;
  const [filter, setFilter] = useState<"alerts" | "low" | "high" | "all">(
    "alerts",
  );
  const [selectedSku, setSelectedSku] = useState("");
  const summary = buildDashboardThresholds(
    source.snapshot.rows,
    source.thresholds,
  );
  const rows = summary.rows;
  const visible = rows.filter(
    (row) =>
      filter === "all" ||
      (filter === "alerts" && row.state !== "ok") ||
      filter === row.state,
  );
  const selected = visible.find((row) => row.sku === selectedSku) ?? visible[0];
  const { configured, unconfigured } = summary;
  return (
    <Frame
      title="Cảnh báo định mức tồn"
      description="Chỉ SKU đã đặt min hoặc max mới được đánh giá; chưa cấu hình khác với min = 0."
      onNavigate={onNavigate}
    >
      {source.error && hasSnapshot ? (
        <PartialNotice onRetry={() => void source.refetch()} />
      ) : null}
      {source.loading || (source.error && !hasSnapshot) ? (
        <DataState
          loading={source.loading}
          error={hasSnapshot ? null : source.error}
          onRetry={() => void source.refetch()}
          empty=""
        />
      ) : (
        <>
          <div className="system-view-metrics">
            <div>
              <span>Đã cấu hình</span>
              <strong>{fmt(configured)}</strong>
            </div>
            <div>
              <span>Chưa cấu hình</span>
              <strong>{fmt(unconfigured)}</strong>
            </div>
            <div>
              <span>Dưới mức tối thiểu</span>
              <strong>{fmt(summary.below)}</strong>
            </div>
            <div>
              <span>Vượt mức tối đa</span>
              <strong>{fmt(summary.above)}</strong>
            </div>
          </div>
          <div className="system-view-split">
            <section className="system-view-card">
              <header>
                <h2>Danh sách SKU</h2>
                <select
                  aria-label="Lọc trạng thái định mức"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as typeof filter)
                  }
                >
                  <option value="alerts">Đang cảnh báo</option>
                  <option value="low">Dưới min</option>
                  <option value="high">Trên max</option>
                  <option value="all">Tất cả đã cấu hình</option>
                </select>
              </header>
              {visible.length ? (
                <div className="system-view-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Tên</th>
                        <th>Khả dụng</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr
                          key={row.sku}
                          className={row === selected ? "is-selected" : ""}
                        >
                          <td>
                            <button
                              type="button"
                              onClick={() => setSelectedSku(row.sku)}
                            >
                              {row.sku}
                            </button>
                          </td>
                          <td>{row.name || "—"}</td>
                          <td>{fmt(row.available)}</td>
                          <td>{row.min === null ? "—" : fmt(row.min)}</td>
                          <td>{row.max === null ? "—" : fmt(row.max)}</td>
                          <td>
                            <span
                              className={`system-view-status is-${row.state}`}
                            >
                              {row.state === "low"
                                ? "Dưới min"
                                : row.state === "high"
                                  ? "Trên max"
                                  : "Trong ngưỡng"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <DataState
                  loading={false}
                  error={null}
                  onRetry={() => void source.refetch()}
                  empty="Không có SKU trong bộ lọc này."
                />
              )}
            </section>
            <section className="system-view-card system-view-detail">
              <h2>Chi tiết định mức</h2>
              {selected ? (
                <>
                  <strong className="system-view-code">{selected.sku}</strong>
                  <p>{selected.name || "Chưa có tên SKU"}</p>
                  <dl>
                    <div>
                      <dt>Loại hàng</dt>
                      <dd>
                        {selected.kind === "PRODUCT"
                          ? "Sản phẩm"
                          : selected.kind === "COMPONENT"
                            ? "Linh kiện"
                            : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Tồn khả dụng</dt>
                      <dd>{fmt(selected.available)}</dd>
                    </div>
                    <div>
                      <dt>Định mức min</dt>
                      <dd>
                        {selected.min === null ? "Chưa đặt" : fmt(selected.min)}
                      </dd>
                    </div>
                    <div>
                      <dt>Định mức max</dt>
                      <dd>
                        {selected.max === null ? "Chưa đặt" : fmt(selected.max)}
                      </dd>
                    </div>
                    <div>
                      <dt>Mức cần kiểm tra</dt>
                      <dd>
                        {selected.state === "low"
                          ? `Thiếu ${fmt((selected.min ?? 0) - selected.available)}`
                          : selected.state === "high"
                            ? `Vượt ${fmt(selected.available - (selected.max ?? 0))}`
                            : "Trong ngưỡng"}
                      </dd>
                    </div>
                  </dl>
                  <p className="system-view-note">
                    Kiểm tra nhu cầu và số tồn trước khi điều chuyển hoặc nhập
                    thêm.
                  </p>
                  <button
                    className="system-view-primary"
                    type="button"
                    onClick={() => onNavigate("/inventory")}
                  >
                    Xem tồn kho
                  </button>
                </>
              ) : (
                <p>Chọn SKU để xem chi tiết.</p>
              )}
            </section>
          </div>
        </>
      )}
    </Frame>
  );
}

function TransactionView({ documentId, onNavigate }: Omit<Props, "view">) {
  const today = dashboardNow();
  const source = useInventoryFlowSnapshot({
    from: today.subtract(6, "day").format("YYYY-MM-DD"),
    to: today.format("YYYY-MM-DD"),
  });
  const documents = source.snapshot.documents
    .filter((row) => row.status === "POSTED")
    .sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  const hasSnapshot = Boolean(source.snapshot.as_of || documents.length);
  const selected: FlowDocument | undefined =
    documents.find((row) => row.id === documentId) ?? documents[0];
  const movements = selected
    ? source.snapshot.ledger.filter(
        (row) => row.source_document_no === selected.document_no,
      )
    : [];
  const quantityFor = (doc: FlowDocument): number | null => {
    const ownMovements = source.snapshot.ledger.filter(
      (row) => row.source_document_no === doc.document_no,
    );
    if (ownMovements.length)
      return ownMovements.reduce((sum, row) => sum + row.qty_delta, 0);
    if (!doc.reportLines?.length || doc.doc_type === "REVERSAL") return null;
    const amount = doc.reportLines.reduce((sum, row) => sum + row.posted, 0);
    return doc.doc_type === "INBOUND" ? amount : -amount;
  };
  const quantityText = (value: number | null) =>
    value === null ? "—" : `${value > 0 ? "+" : ""}${fmt(value)}`;
  return (
    <Frame
      title="Chi tiết giao dịch"
      description="Thông tin chứng từ và biến động đã ghi sổ trong 7 ngày gần nhất."
      onNavigate={onNavigate}
    >
      {source.error && hasSnapshot ? (
        <PartialNotice onRetry={() => void source.refetch()} />
      ) : null}
      {source.loading || (source.error && !hasSnapshot) ? (
        <DataState
          loading={source.loading}
          error={hasSnapshot ? null : source.error}
          onRetry={() => void source.refetch()}
          empty=""
        />
      ) : documents.length === 0 ? (
        <DataState
          loading={false}
          error={null}
          onRetry={() => void source.refetch()}
          empty={
            source.error
              ? "Chưa xác định được giao dịch vì một nguồn dữ liệu chưa tải xong."
              : "Chưa có giao dịch đã ghi sổ trong 7 ngày gần nhất."
          }
        />
      ) : (
        <div className="system-view-split">
          <section className="system-view-card">
            <header>
              <h2>Giao dịch gần đây</h2>
              <button
                type="button"
                onClick={() => onNavigate("/reports/inventory-flow")}
              >
                Xem lịch sử <DashIcon name="arrow-right" />
              </button>
            </header>
            <div className="system-view-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ghi sổ</th>
                    <th>Mã chứng từ</th>
                    <th>Loại</th>
                    <th>Số lượng</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.slice(0, 20).map((doc) => (
                    <tr
                      key={doc.id}
                      className={doc.id === selected?.id ? "is-selected" : ""}
                    >
                      <td>{dateTime(doc.posted_at)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate(
                              link(
                                "transaction",
                                `&document=${encodeURIComponent(doc.id)}`,
                              ),
                            )
                          }
                        >
                          {doc.document_no}
                        </button>
                      </td>
                      <td>
                        {doc.doc_type === "INBOUND"
                          ? "Nhập"
                          : doc.doc_type === "OUTBOUND"
                            ? "Xuất"
                            : "Hoàn tác"}
                      </td>
                      <td>{quantityText(quantityFor(doc))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="system-view-card system-view-detail">
            <h2>{selected?.document_no ?? "Chi tiết"}</h2>
            {selected ? (
              <>
                <span className="system-view-status is-ok">Đã ghi sổ</span>
                <dl>
                  <div>
                    <dt>Loại chứng từ</dt>
                    <dd>
                      {selected.doc_type === "INBOUND"
                        ? "Nhập kho"
                        : selected.doc_type === "OUTBOUND"
                          ? "Xuất kho"
                          : "Hoàn tác"}
                    </dd>
                  </div>
                  <div>
                    <dt>Đối tác</dt>
                    <dd>{selected.counterpart || "—"}</dd>
                  </div>
                  <div>
                    <dt>Kho</dt>
                    <dd>{selected.warehouse_code || "—"}</dd>
                  </div>
                  <div>
                    <dt>Người tạo</dt>
                    <dd>{selected.created_by_name || "—"}</dd>
                  </div>
                  <div>
                    <dt>Ngày chứng từ</dt>
                    <dd>{dateTime(selected.document_date)}</dd>
                  </div>
                  <div>
                    <dt>Ghi sổ lúc</dt>
                    <dd>{dateTime(selected.posted_at)}</dd>
                  </div>
                  <div>
                    <dt>Biến động tồn</dt>
                    <dd>{quantityText(quantityFor(selected))}</dd>
                  </div>
                </dl>
                <h3>Dòng SKU</h3>
                {selected.reportLines?.length ? (
                  <div className="system-view-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Tên</th>
                          <th>Đã ghi sổ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.reportLines.map((row) => (
                          <tr key={row.id}>
                            <td>{row.sku}</td>
                            <td>{row.name}</td>
                            <td>{fmt(row.posted)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>Dòng SKU không có trong dữ liệu báo cáo này.</p>
                )}
                <h3>Biến động tồn</h3>
                {movements.length ? (
                  <div className="system-view-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ghi sổ</th>
                          <th>SKU</th>
                          <th>Loại</th>
                          <th>Thay đổi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map((row) => (
                          <tr key={row.movement_id}>
                            <td>{dateTime(row.posted_at)}</td>
                            <td>{row.sku_code || "—"}</td>
                            <td>{row.movement_type || "—"}</td>
                            <td>{quantityText(row.qty_delta)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>Chưa có dòng movement truy được từ chứng từ này.</p>
                )}
                <button
                  className="system-view-primary"
                  type="button"
                  onClick={() => onNavigate("/reports/inventory-flow")}
                >
                  Mở báo cáo nhập xuất tồn
                </button>
              </>
            ) : null}
          </section>
        </div>
      )}
    </Frame>
  );
}

export function DashboardSystemViews(props: Props) {
  if (props.view === "work") return <WorkView {...props} />;
  if (props.view === "stock") return <StockView {...props} />;
  if (props.view === "thresholds") return <ThresholdView {...props} />;
  return <TransactionView {...props} />;
}
