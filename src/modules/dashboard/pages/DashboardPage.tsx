import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchDashboardKPI } from "../services/dashboardService";
import type { DashboardKPI, DashboardQuery } from "../types";
import "./DashboardPage.css";

type FlowNode = {
  label: string;
  route?: string;
};

type FlowLane = {
  label: string;
  nodes: FlowNode[];
};

type FlowMetric = {
  key: keyof Pick<
    DashboardKPI,
    "receipt_qty" | "issue_qty" | "component_issue_qty" | "reversal_net"
  >;
  label: string;
  value: number;
};

const FLOW_LANES: FlowLane[] = [
  {
    label: "Nhập kho",
    nodes: [
      { label: "Danh sách phiếu nhập", route: ROUTES.INBOUND },
      { label: "Tạo phiếu nháp", route: ROUTES.INBOUND },
      { label: "Quét hàng", route: ROUTES.INBOUND },
      { label: "Ghi nhận nhập kho", route: ROUTES.INBOUND },
      { label: "Linh kiện chờ xếp khay", route: ROUTES.PUTAWAY },
      { label: "Xếp vị trí", route: ROUTES.PUTAWAY },
    ],
  },
  {
    label: "Xuất kho",
    nodes: [
      { label: "Phiếu yêu cầu xuất", route: ROUTES.OUTBOUND },
      { label: "Nhập từ Excel / nhập tay", route: ROUTES.OUTBOUND },
      { label: "Danh sách phiếu xuất", route: ROUTES.OUTBOUND },
      { label: "Chi tiết phiếu xuất", route: ROUTES.OUTBOUND },
      { label: "Quét đối chiếu", route: ROUTES.OUTBOUND },
      { label: "In nhãn", route: ROUTES.OUTBOUND },
      { label: "Gắn RFID / ghi nhận xuất", route: ROUTES.OUTBOUND },
    ],
  },
  {
    label: "Bảo hành",
    nodes: [
      { label: "Danh sách bảo hành", route: ROUTES.WARRANTY },
      { label: "Tiếp nhận bảo hành", route: ROUTES.WARRANTY },
      { label: "Chi tiết bảo hành", route: ROUTES.WARRANTY },
      { label: "Xuất linh kiện", route: ROUTES.WARRANTY },
    ],
  },
  {
    label: "Kiểm soát",
    nodes: [
      { label: "Tra cứu tồn", route: ROUTES.INVENTORY },
      { label: "Truy vết", route: ROUTES.SCAN },
      { label: "Danh sách điều chỉnh tồn", route: ROUTES.REVERSE },
      { label: "Tạo điều chỉnh tồn", route: ROUTES.REVERSE },
    ],
  },
];

const WARRANTY_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Đã tiếp nhận",
  CHECKING: "Đang kiểm tra",
  REPAIRING: "Đang sửa chữa",
  COMPLETED: "Đã hoàn tất sửa chữa",
  RETURNED: "Đã trả khách",
  CANCELLED: "Đã hủy",
};

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function getHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

function isDashboardEmpty(data: DashboardKPI): boolean {
  return (
    data.available_qty === 0 &&
    data.receipt_qty === 0 &&
    data.issue_qty === 0 &&
    data.component_issue_qty === 0 &&
    data.reversal_net === 0 &&
    Object.values(data.warranty_cases_by_status).every(
      (count) => count === 0,
    ) &&
    data.reconciliation_warning_count === 0
  );
}

function DashboardMetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="hn-card hn-dashboard-metric">
      <div className="hn-dashboard-metric-label">{label}</div>
      <strong className="hn-dashboard-metric-value">
        {formatNumber(value)}
      </strong>
      <div className="hn-dashboard-muted">{note}</div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const isProfileLoaded = useAuthStore((state) => state.isProfileLoaded);

  const canViewReport =
    !isProfileLoaded || isSuperAdmin || permissionCodes.includes("report.view");

  const [appliedQuery, setAppliedQuery] = useState<DashboardQuery>({});
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [datesInitialized, setDatesInitialized] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: [
      "dashboard",
      "quick",
      appliedQuery.from_date ?? "server-default",
      appliedQuery.to_date ?? "server-default",
    ],
    queryFn: () => fetchDashboardKPI(appliedQuery),
    enabled: canViewReport,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = getHttpStatus(error);
      if (status === 401 || status === 403 || status === 422) return false;
      return failureCount < 1;
    },
  });

  useEffect(() => {
    if (!dashboardQuery.data || datesInitialized) return;
    setDraftFrom(dashboardQuery.data.period.from_date);
    setDraftTo(dashboardQuery.data.period.to_date);
    setDatesInitialized(true);
  }, [dashboardQuery.data, datesInitialized]);

  const filterError = useMemo(() => {
    if (Boolean(draftFrom) !== Boolean(draftTo)) {
      return "Cần nhập đủ cả Từ ngày và Đến ngày.";
    }
    if (draftFrom && draftTo && draftTo < draftFrom) {
      return "Đến ngày phải lớn hơn hoặc bằng Từ ngày.";
    }
    return null;
  }, [draftFrom, draftTo]);

  const flowMetrics = useMemo<FlowMetric[]>(() => {
    if (!dashboardQuery.data) return [];
    return [
      {
        key: "receipt_qty",
        label: "Nhập kho",
        value: dashboardQuery.data.receipt_qty,
      },
      {
        key: "issue_qty",
        label: "Xuất kho",
        value: dashboardQuery.data.issue_qty,
      },
      {
        key: "component_issue_qty",
        label: "Xuất linh kiện",
        value: dashboardQuery.data.component_issue_qty,
      },
      {
        key: "reversal_net",
        label: "Điều chỉnh tồn (ròng)",
        value: dashboardQuery.data.reversal_net,
      },
    ];
  }, [dashboardQuery.data]);

  const maxFlowValue = Math.max(
    1,
    ...flowMetrics.map((metric) => Math.abs(metric.value)),
  );

  const flowChartLabel = useMemo(() => {
    if (!dashboardQuery.data) return "";
    const series = flowMetrics
      .map((metric) => `${metric.label} ${formatNumber(metric.value)}`)
      .join("; ");
    return `Biểu đồ luồng kho từ ${dashboardQuery.data.period.from_date} đến ${dashboardQuery.data.period.to_date}: ${series}`;
  }, [dashboardQuery.data, flowMetrics]);

  const applyFilter = () => {
    if (filterError) return;
    setAppliedQuery(
      draftFrom && draftTo ? { from_date: draftFrom, to_date: draftTo } : {},
    );
  };

  const resetFilter = () => {
    setDraftFrom("");
    setDraftTo("");
    setDatesInitialized(false);
    setAppliedQuery({});
  };

  const status = getHttpStatus(dashboardQuery.error);
  const data = dashboardQuery.data;
  const empty = data ? isDashboardEmpty(data) : false;
  const warrantyEntries = data
    ? Object.entries(data.warranty_cases_by_status).sort(([a], [b]) =>
        a.localeCompare(b),
      )
    : [];

  return (
    <div className="hn-dashboard-page">
      <section
        className="hn-card hn-dashboard-header"
        aria-labelledby="dashboard-title"
      >
        <div>
          <div className="tag">Tổng quan vận hành</div>
          <h1 id="dashboard-title" className="hn-dashboard-title">
            Tổng quan kho
          </h1>
          <p className="hn-dashboard-muted">
            Theo dõi tồn khả dụng, nhập kho, xuất kho, bảo hành và các cảnh báo
            đối soát trên cùng một màn hình.
          </p>
        </div>

        <div className="hn-dashboard-filter" aria-label="Bộ lọc kỳ thống kê">
          <label>
            <span>Từ ngày</span>
            <input
              type="date"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              disabled={dashboardQuery.isFetching || !canViewReport}
            />
          </label>
          <label>
            <span>Đến ngày</span>
            <input
              type="date"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              disabled={dashboardQuery.isFetching || !canViewReport}
            />
          </label>
          <div className="hn-dashboard-filter-actions">
            <button
              type="button"
              className="hn-node"
              onClick={applyFilter}
              disabled={
                Boolean(filterError) ||
                dashboardQuery.isFetching ||
                !canViewReport
              }
            >
              {dashboardQuery.isFetching ? "Đang tải…" : "Áp dụng"}
            </button>
            <button
              type="button"
              className="hn-node hn-dashboard-secondary-button"
              onClick={resetFilter}
              disabled={dashboardQuery.isFetching || !canViewReport}
            >
              Đặt lại
            </button>
          </div>
        </div>
        {filterError ? (
          <div className="hn-dashboard-validation" role="alert">
            {filterError}
          </div>
        ) : null}
        <div className="hn-dashboard-muted hn-dashboard-timezone">
          Dữ liệu được tổng hợp theo múi giờ Việt Nam. Khi không chọn khoảng
          ngày, hệ thống hiển thị 30 ngày gần nhất.
        </div>
      </section>

      {isProfileLoaded && !canViewReport ? (
        <section className="hn-card hn-dashboard-state" role="alert">
          <strong>Không có quyền xem báo cáo tổng quan.</strong>
          <span>Vui lòng liên hệ quản trị viên nếu bạn cần quyền truy cập.</span>
        </section>
      ) : null}

      {canViewReport && dashboardQuery.isLoading ? (
        <section className="hn-card hn-dashboard-state" aria-live="polite">
          <strong>Đang tải số liệu tổng quan…</strong>
          <span>Hệ thống đang tổng hợp dữ liệu vận hành.</span>
        </section>
      ) : null}

      {canViewReport && dashboardQuery.isError ? (
        <section className="hn-card hn-dashboard-state" role="alert">
          <strong>
            {status === 403
              ? "Bạn không có quyền xem báo cáo tổng quan."
              : status === 422
                ? "Khoảng ngày đã chọn không hợp lệ."
                : "Không tải được số liệu tổng quan."}
          </strong>
          <span>
            {status === 401
              ? "Phiên đăng nhập không còn hợp lệ."
              : "Hệ thống không hiển thị dữ liệu cũ khi việc tải dữ liệu thất bại."}
          </span>
          <button
            type="button"
            className="hn-node"
            onClick={() => dashboardQuery.refetch()}
            disabled={dashboardQuery.isFetching}
          >
            Thử lại
          </button>
        </section>
      ) : null}

      {data ? (
        <>
          <section aria-labelledby="dashboard-kpi-title">
            <div className="hn-dashboard-section-heading">
              <div>
                <h2 id="dashboard-kpi-title" className="hn-section-title">
                  Chỉ số vận hành
                </h2>
                <div className="hn-dashboard-muted">
                  Kỳ thống kê: {data.period.from_date} → {data.period.to_date}
                </div>
                <div className="hn-dashboard-muted">
                  Phạm vi dữ liệu:{" "}
                  {data.data_scope === "GLOBAL"
                    ? "Toàn hệ thống"
                    : `Theo ${data.scope_warehouse_ids?.length ?? 0} kho bạn được phân quyền`}
                </div>
              </div>
              <span className="tag">Dữ liệu hệ thống</span>
            </div>

            <div className="hn-dashboard-kpi-grid">
              <DashboardMetricCard
                label="Tồn khả dụng"
                value={data.available_qty}
                note="Số lượng hiện có thể sử dụng"
              />
              <DashboardMetricCard
                label="Nhập kho"
                value={data.receipt_qty}
                note="Tổng số lượng đã ghi nhận nhập trong kỳ"
              />
              <DashboardMetricCard
                label="Xuất kho"
                value={data.issue_qty}
                note="Tổng số lượng đã ghi nhận xuất trong kỳ"
              />
              <DashboardMetricCard
                label="Xuất linh kiện"
                value={data.component_issue_qty}
                note="Tổng linh kiện đã xuất trong kỳ"
              />
              <DashboardMetricCard
                label="Điều chỉnh tồn (ròng)"
                value={data.reversal_net}
                note="Chênh lệch tăng/giảm tồn do điều chỉnh trong kỳ"
              />
            </div>
          </section>

          {empty ? (
            <section className="hn-card hn-dashboard-state" aria-live="polite">
              <strong>Không có số liệu trong kỳ.</strong>
              <span>Chưa phát sinh dữ liệu vận hành trong khoảng ngày đã chọn.</span>
            </section>
          ) : (
            <section
              className="hn-dashboard-grid"
              aria-label="Biểu đồ tổng quan"
            >
              <div className="hn-card">
                <div className="hn-section-title">
                  Biểu đồ luồng kho trong kỳ
                </div>
                <div className="hn-dashboard-muted">
                  So sánh quy mô nhập, xuất, xuất linh kiện và điều chỉnh tồn.
                </div>
                <div
                  className="hn-dashboard-bar-chart"
                  role="img"
                  aria-label={flowChartLabel}
                >
                  {flowMetrics.map((metric) => (
                    <div className="hn-dashboard-bar-row" key={metric.key}>
                      <div className="hn-dashboard-bar-label">
                        {metric.label}
                      </div>
                      <div
                        className="hn-dashboard-bar-track"
                        aria-hidden="true"
                      >
                        <div
                          className="hn-dashboard-bar-fill"
                          style={{
                            width: `${(Math.abs(metric.value) / maxFlowValue) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{formatNumber(metric.value)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hn-card">
                <div className="hn-section-title">Bảo hành theo trạng thái</div>
                <div className="hn-dashboard-muted">
                  Tổng hợp các ca bảo hành hiện có trong hệ thống.
                </div>
                {data.data_scope === "WAREHOUSE_SCOPED" ? (
                  <div className="hn-dashboard-scope-exception" role="note">
                    Số liệu bảo hành được tổng hợp toàn hệ thống và không giới
                    hạn theo kho.
                  </div>
                ) : null}
                {warrantyEntries.length === 0 ? (
                  <div className="hn-dashboard-inline-empty">
                    Chưa có ca bảo hành.
                  </div>
                ) : (
                  <div className="hn-dashboard-status-list">
                    {warrantyEntries.map(([warrantyStatus, count]) => (
                      <div
                        className="hn-dashboard-status-row"
                        key={warrantyStatus}
                      >
                        <span>
                          {WARRANTY_STATUS_LABELS[warrantyStatus] ??
                            warrantyStatus.replaceAll("_", " ")}
                        </span>
                        <strong>{formatNumber(count)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="hn-card">
                <div className="hn-section-title">Đối soát tồn kho</div>
                <strong className="hn-dashboard-warning-count">
                  {formatNumber(data.reconciliation_warning_count)} cảnh báo
                </strong>
                <div className="hn-dashboard-muted">
                  Số trường hợp chênh lệch cần kiểm tra tại thời điểm hiện tại.
                </div>
              </div>
            </section>
          )}
        </>
      ) : null}

      <section aria-labelledby="workflow-title">
        <div className="hn-dashboard-section-heading">
          <h2 id="workflow-title" className="hn-section-title">
            Điều hướng luồng nghiệp vụ
          </h2>
        </div>
        <div className="hn-flow">
          {FLOW_LANES.map((lane) => (
            <div className="hn-lane" key={lane.label}>
              <div className="tag">{lane.label}</div>
              {lane.nodes.map((node, index) => (
                <span
                  key={`${lane.label}-${node.label}`}
                  style={{ display: "contents" }}
                >
                  {index > 0 ? <span aria-hidden="true">→</span> : null}
                  <button
                    type="button"
                    className="hn-node"
                    onClick={() => node.route && navigate(node.route)}
                    style={{ cursor: node.route ? "pointer" : "default" }}
                  >
                    {node.label}
                  </button>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
