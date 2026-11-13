import { useT } from "@/shared/i18n";
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
  const t = useT();
  return (
    <div className={`dashboard-system-view ${className}`}>
      <nav
        className="system-view-breadcrumb"
        aria-label={t("dashboardAudit.navigation")}
      >
        <button type="button" onClick={() => onNavigate(home)}>
          {t("dashboardAudit.overview")}
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
          <DashIcon name="arrow-right" /> {t("dashboardAudit.backOverview")}
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
  const t = useT();
  if (loading)
    return (
      <div className="system-view-state" role="status">
        {t("dashboardAudit.loading")}
      </div>
    );
  if (error)
    return (
      <div className="system-view-state is-error" role="alert">
        {t("dashboardAudit.loadFailed")}{" "}
        <button type="button" onClick={onRetry}>
          {t("dashboardAudit.retry")}
        </button>
      </div>
    );
  return <div className="system-view-state">{empty}</div>;
}

function PartialNotice({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="snapshot-partial-alert" role="status">
      {t("dashboardAudit.stale")}{" "}
      <button type="button" onClick={onRetry}>
        {t("dashboardAudit.retry")}
      </button>
    </div>
  );
}

function WorkView({
  overview,
  showWarranty = false,
  onNavigate,
}: Omit<Props, "view">) {
  const t = useT();
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
      label: t("dashboardAudit.reconcile"),
      count: overview?.issues.inventory_mismatch ?? null,
      route: "/reports/stock-reconcile",
    },
    {
      id: "outbound",
      label: t("dashboardAudit.outboundErrors"),
      count: null,
      route: "/outbound",
    },
    {
      id: "labels",
      label: t("dashboardAudit.labelErrors"),
      count: overview?.issues.print_failed ?? null,
      route: "/reports/packing-label",
    },
    {
      id: "putaway",
      label: t("dashboardAudit.pendingPutaway"),
      count: null,
      route: "/putaway",
    },
    ...(showWarranty
      ? [
          {
            id: "warranty",
            label: t("dashboardAudit.overdueWarranty"),
            count: overview?.warranty.overdue_count ?? null,
            route: WARRANTY_OVERDUE_ROUTE,
          },
        ]
      : []),
  ];
  const active = groups.find((group) => group.id === category) ?? groups[0];
  return (
    <Frame
      title={t("dashboardAudit.workTitle")}
      description={t("dashboardAudit.workDescription")}
      onNavigate={onNavigate}
    >
      <div
        className="system-view-tabs"
        role="tablist"
        aria-label={t("dashboardAudit.workGroups")}
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
              <h2>
                {t("dashboardAudit.verifyDifferences")} {fmt(mismatches.length)}{" "}
                {t("dashboardAudit.rows")}
              </h2>
              <button type="button" onClick={() => onNavigate(active.route)}>
                {t("dashboardAudit.openReconcile")}
                <DashIcon name="arrow-right" />
              </button>
            </header>
            {source.loading ||
            (source.error && !hasSnapshot) ||
            mismatches.length === 0 ? (
              <DataState
                loading={source.loading}
                error={hasSnapshot ? null : source.error}
                onRetry={() => void source.refetch()}
                empty={t("dashboardAudit.noMismatches")}
              />
            ) : (
              <div className="system-view-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>{t("dashboardAudit.product")}</th>
                      <th>{t("dashboardAudit.warehouse")}</th>
                      <th>{t("dashboardAudit.ledger")}</th>
                      <th>{t("dashboardAudit.balance")}</th>
                      <th>{t("dashboardAudit.difference")}</th>
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
            <h2>{t("dashboardAudit.selectedRow")}</h2>
            {selected ? (
              <>
                <strong className="system-view-code">
                  {selected.sku_code}
                </strong>
                <p>{selected.sku_name}</p>
                <dl>
                  <div>
                    <dt>{t("dashboardAudit.warehouse")}</dt>
                    <dd>{selected.warehouse_code || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("dashboardAudit.stockStatus")}</dt>
                    <dd>{selected.stock_status || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("dashboardAudit.movementLedger")}</dt>
                    <dd>{fmt(selected.ledger_qty)}</dd>
                  </div>
                  <div>
                    <dt>{t("dashboardAudit.systemBalance")}</dt>
                    <dd>{fmt(selected.balance_qty)}</dd>
                  </div>
                  <div>
                    <dt>{t("dashboardAudit.delta")}</dt>
                    <dd className="is-negative">{fmt(selected.delta_qty)}</dd>
                  </div>
                  <div>
                    <dt>{t("dashboardAudit.balanceUpdated")}</dt>
                    <dd>{dateTime(selected.balance_updated_at)}</dd>
                  </div>
                </dl>
                <p className="system-view-note">
                  {t("dashboardAudit.differenceNote")}
                </p>
                <button
                  className="system-view-primary"
                  type="button"
                  onClick={() => onNavigate(active.route)}
                >
                  {t("dashboardAudit.openStockReconcile")}
                </button>
              </>
            ) : (
              <p>{t("dashboardAudit.selectRow")}</p>
            )}
          </section>
        </div>
      ) : (
        <section className="system-view-card system-view-category">
          <h2>{active.label}</h2>
          <p>
            {active.count === null
              ? t("dashboardAudit.noSummary")
              : t("dashboardAudit.recordedItems", {
                  count: fmt(active.count),
                })}{" "}
            {t("dashboardAudit.originalScreen")}
          </p>
          <button
            className="system-view-primary"
            type="button"
            onClick={() => onNavigate(active.route)}
          >
            {t("dashboardAudit.open")} {active.label.toLowerCase()}{" "}
            <DashIcon name="arrow-right" />
          </button>
        </section>
      )}
    </Frame>
  );
}

function ThresholdView({ onNavigate }: Omit<Props, "view">) {
  const t = useT();
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
      title={t("dashboardAudit.thresholdTitle")}
      description={t("dashboardAudit.thresholdDescription")}
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
              <span>{t("dashboardAudit.configured")}</span>
              <strong>{fmt(configured)}</strong>
            </div>
            <div>
              <span>{t("dashboardAudit.unconfigured")}</span>
              <strong>{fmt(unconfigured)}</strong>
            </div>
            <div>
              <span>{t("dashboardAudit.belowMin")}</span>
              <strong>{fmt(summary.below)}</strong>
            </div>
            <div>
              <span>{t("dashboardAudit.aboveMax")}</span>
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
