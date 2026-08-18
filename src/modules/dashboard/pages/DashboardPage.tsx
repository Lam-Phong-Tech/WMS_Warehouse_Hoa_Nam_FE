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
      { label: "Tạo DRAFT", route: ROUTES.INBOUND },
      { label: "Quét / camera", route: ROUTES.INBOUND },
      { label: "Post toàn bộ", route: ROUTES.INBOUND },
      { label: "Linh kiện chờ xếp khay", route: ROUTES.PUTAWAY },
      { label: "Putaway", route: ROUTES.PUTAWAY },
    ],
  },
  {
    label: "Xuất kho",
    nodes: [
      { label: "Phiếu yêu cầu xuất", route: ROUTES.OUTBOUND },
      { label: "Import Excel / nhập tay", route: ROUTES.OUTBOUND },
      { label: "Danh sách phiếu xuất", route: ROUTES.OUTBOUND },
      { label: "Chi tiết phiếu xuất", route: ROUTES.OUTBOUND },
      { label: "Quét match", route: ROUTES.OUTBOUND },
      { label: "In nhãn", route: ROUTES.OUTBOUND },
      { label: "Map RFID / Post", route: ROUTES.OUTBOUND },
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
      { label: "Danh sách Reversal", route: ROUTES.REVERSE },
      { label: "Tạo Reversal", route: ROUTES.REVERSE },
    ],
  },
];

const MVP_NOTES = [
  "Không dựng App PV trong bộ wireframe này.",
  "Giao diện ưu tiên tiếng Việt cho người dùng vận hành kho.",
  "Camera điện thoại có thể thay máy quét Barcode / QR trong các màn nghiệp vụ.",
  "Luồng nhập / xuất vẫn bám nguyên tắc full-post, không partial.",
];

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
        label: "Reversal (net)",
        value: dashboardQuery.data.reversal_net,
      },
    ];
  }, [dashboardQuery.data]);

  const maxFlowValue = Math.max(
    1,
    ...flowMetrics.map((metric) => Math.abs(metric.value)),
  );

  /**
   * role="img" là leaf node đối với screen reader: mọi text bên trong bị bỏ qua.
   * Nhãn vì thế phải mang luôn số liệu, nếu không người dùng AT chỉ nghe được tên
   * biểu đồ và mất toàn bộ giá trị KPI trong kỳ.
   */
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
          <div className="tag">WWHN-327 · Dashboard enhancement</div>
          <h1 id="dashboard-title" className="hn-dashboard-title">
            Tổng quan dashboard
          </h1>
          <p className="hn-dashboard-muted">
            Số liệu lấy trực tiếp từ GET /reports/dashboard-quick. Các luồng
            nhập/xuất dùng occurred_at trong kỳ; tồn khả dụng, bảo hành và đối
            soát là số liệu snapshot/toàn bộ theo contract backend.
          </p>
        </div>

        <div className="hn-dashboard-filter" aria-label="Bộ lọc kỳ dashboard">
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
              Mặc định BE
            </button>
          </div>
        </div>
        {filterError ? (
          <div className="hn-dashboard-validation" role="alert">
            {filterError}
          </div>
        ) : null}
        <div className="hn-dashboard-muted hn-dashboard-timezone">
          Cutoff ngày theo timezone backend: Asia/Ho_Chi_Minh. Khi không gửi bộ
          lọc, backend dùng kỳ mặc định 30 ngày gần nhất.
        </div>
      </section>

      {isProfileLoaded && !canViewReport ? (
        <section className="hn-card hn-dashboard-state" role="alert">
          <strong>Không có quyền xem dashboard báo cáo.</strong>
          <span>Bạn không có quyền report.view trong context hiện hành.</span>
        </section>
      ) : null}

      {canViewReport && dashboardQuery.isLoading ? (
        <section className="hn-card hn-dashboard-state" aria-live="polite">
          <strong>Đang tải số liệu dashboard…</strong>
          <span>Hệ thống đang lấy KPI từ backend.</span>
        </section>
      ) : null}

      {canViewReport && dashboardQuery.isError ? (
        <section className="hn-card hn-dashboard-state" role="alert">
          <strong>
            {status === 403
              ? "Bạn không có quyền report.view."
              : status === 422
                ? "Bộ lọc ngày không hợp lệ."
                : "Không tải được số liệu dashboard."}
          </strong>
          <span>
            {status === 401
              ? "Phiên đăng nhập không còn hợp lệ."
              : "Không hiển thị dữ liệu cũ hoặc dữ liệu giả khi API lỗi."}
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
                  KPI vận hành
                </h2>
                <div className="hn-dashboard-muted">
                  Kỳ BE trả về: {data.period.from_date} → {data.period.to_date}
                </div>
                {/* WWHN-328: phạm vi dữ liệu phải hiện trên màn hình, nếu không
                    người dùng bị giới hạn kho không phân biệt được KPI của mình
                    với KPI toàn hệ thống. */}
                <div className="hn-dashboard-muted">
                  Phạm vi dữ liệu:{" "}
                  {data.data_scope === "GLOBAL"
                    ? "Toàn hệ thống (không giới hạn kho)"
                    : `Giới hạn ${data.scope_warehouse_ids?.length ?? 0} kho theo phân quyền`}
                </div>
              </div>
              <span className="tag">Nguồn: backend authoritative</span>
            </div>

            <div className="hn-dashboard-kpi-grid">
              <DashboardMetricCard
                label="Tồn khả dụng"
                value={data.available_qty}
                note="Snapshot AVAILABLE hiện tại"
              />
              <DashboardMetricCard
                label="Nhập kho"
                value={data.receipt_qty}
                note="RECEIPT theo occurred_at trong kỳ"
              />
              <DashboardMetricCard
                label="Xuất kho"
                value={data.issue_qty}
                note="ISSUE theo occurred_at trong kỳ"
              />
              <DashboardMetricCard
                label="Xuất linh kiện"
                value={data.component_issue_qty}
                note="COMPONENT_ISSUE trong kỳ"
              />
              <DashboardMetricCard
                label="Reversal net"
                value={data.reversal_net}
                note="Có thể âm; không lấy trị tuyệt đối ở KPI"
              />
            </div>
          </section>

          {empty ? (
            <section className="hn-card hn-dashboard-state" aria-live="polite">
              <strong>Không có số liệu trong kỳ.</strong>
              <span>
                API trả về 0 cho toàn bộ KPI và không có cảnh báo/ca bảo hành để
                hiển thị.
              </span>
            </section>
          ) : (
            <section
              className="hn-dashboard-grid"
              aria-label="Biểu đồ dashboard"
            >
              <div className="hn-card">
                <div className="hn-section-title">
                  Biểu đồ luồng kho trong kỳ
                </div>
                <div className="hn-dashboard-muted">
                  So sánh theo độ lớn; Reversal vẫn giữ dấu ở nhãn số liệu.
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
                  Toàn bộ warranty case, không áp dụng bộ lọc kỳ.
                </div>
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
                        <span>{warrantyStatus.replaceAll("_", " ")}</span>
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
                  Số dòng reconciliation_status=MISMATCH tại thời điểm gọi API.
                  {/* Đếm bằng reconciliation_warning_count, không bằng độ dài mảng:
                      BE chỉ nhúng tối đa 50 dòng mẫu (WWHN-328). */}
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

      <div className="hn-grid-2" style={{ marginTop: 16 }}>
        <div className="hn-card hn-soft">
          <div className="hn-section-title">Ghi chú phạm vi MVP</div>
          {MVP_NOTES.map((note) => (
            <div className="hn-rule" key={note}>
              <span className="hn-dot" aria-hidden="true" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hn-footer-note">
        Wireframe mức low-fi · Nguồn BA: BRD / SRS-FRD / BPD hiện tại.
      </div>
    </div>
  );
}
