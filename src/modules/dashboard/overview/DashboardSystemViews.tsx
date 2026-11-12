import { useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { DashIcon } from "../components/DashIcon";
import { fmt } from "./overview-data";
import { useStockReconcileSnapshot } from "@/modules/reports/stock-reconcile/stock-reconcile-api";
import type { DashboardOverview } from "../types";
import { buildDashboardThresholds } from "./dashboard-threshold-model";
import { ThresholdSkuList } from "./ThresholdSkuList";
import { WARRANTY_OVERDUE_ROUTE } from "@/shared/constants/routes";
import "./dashboard-system-views.css";

export type DashboardSystemView = "work" | "thresholds";

type Props = {
  view: DashboardSystemView;
  overview?: DashboardOverview;
  showWarranty?: boolean;
  onNavigate: (route: string) => void;
};

const home = "/dashboard?screen=MAP-01";
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
  className = "",
}: {
  className?: string;
  title: string;
  description: string;
  onNavigate: Props["onNavigate"];
  children: ReactNode;
}) {
  return (
    <div className={`dashboard-system-view ${className}`}>
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
            route: WARRANTY_OVERDUE_ROUTE,
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
            {source.loading ||
            (source.error && !hasSnapshot) ||
            mismatches.length === 0 ? (
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

function ThresholdView({ onNavigate }: Omit<Props, "view">) {
  const source = useStockReconcileSnapshot({ asOf: "" });
  const hasSnapshot =
    Boolean(source.snapshot.as_of) && source.thresholds.size > 0;
  const summary = buildDashboardThresholds(
    source.snapshot.rows,
    source.thresholds,
  );
  const { configured, unconfigured } = summary;
  return (
    <Frame
      className="dashboard-threshold-view"
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
          <ThresholdSkuList rows={summary.rows} onNavigate={onNavigate} />
        </>
      )}
    </Frame>
  );
}

export function DashboardSystemViews(props: Props) {
  if (props.view === "work") return <WorkView {...props} />;
  if (props.view === "thresholds") return <ThresholdView {...props} />;
  return null;
}
