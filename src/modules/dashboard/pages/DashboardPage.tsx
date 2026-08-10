import { useQuery } from "@tanstack/react-query";
import { Button, Progress, Table } from "antd";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import type { RecentDocument } from "../types";
import {
  fetchDashboardKPI,
  fetchRecentDocuments,
  fetchReconcileHealth,
  fetchAlerts,
} from "../services/dashboardService";
import { ROUTES } from "@/shared/constants/routes";

const statusClassMap: Record<string, string> = {
  PARTIALLY_POSTED: "hn-pill hn-pill--warn",
  POSTED: "hn-pill hn-pill--success",
  SCANNING: "hn-pill hn-pill--accent",
  REVIEWING: "hn-pill hn-pill--accent",
  DRAFT: "hn-pill hn-pill--neutral",
  CANCELLED: "hn-pill hn-pill--danger",
};

function documentTypeLabel(type: RecentDocument["type"]): string {
  if (type === "INBOUND") return "Nhập kho";
  if (type === "OUTBOUND") return "Xuất kho";
  return "Kiểm kê";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: kpi } = useQuery({
    queryKey: ["dashboard", "kpi"],
    queryFn: fetchDashboardKPI,
  });
  const { data: recent = [] } = useQuery({
    queryKey: ["dashboard", "recent"],
    queryFn: fetchRecentDocuments,
  });
  const { data: health } = useQuery({
    queryKey: ["dashboard", "health"],
    queryFn: fetchReconcileHealth,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: fetchAlerts,
  });

  const recentColumns: ColumnsType<RecentDocument> = [
    {
      title: "Mã chứng từ",
      dataIndex: "code",
      key: "code",
      render: (value: string) => <span className="hn-mono">{value}</span>,
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      render: (value: RecentDocument["type"]) => documentTypeLabel(value),
    },
    { title: "Đối tác/Nguồn", dataIndex: "partner", key: "partner" },
    {
      title: "Tiến độ",
      key: "progress",
      render: (_: unknown, row) => (
        <div className="hn-progress-cell">
          <Progress
            percent={row.progress}
            showInfo={false}
            strokeColor="#356fa3"
            trailColor="#eceae6"
            size="small"
          />
          <span className="hn-wire-hint">
            {row.posted}/{row.total} đã post
          </span>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (value: string) => (
        <span className={statusClassMap[value] ?? "hn-pill hn-pill--neutral"}>
          {value}
        </span>
      ),
    },
    { title: "Người cập nhật", dataIndex: "updatedBy", key: "updatedBy" },
    { title: "Cập nhật", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Action",
      key: "action",
      render: (_: unknown, row) => (
        <button
          type="button"
          className="hn-table-action"
          onClick={() => {
            if (row.type === "INBOUND") navigate(ROUTES.INBOUND);
            else if (row.type === "OUTBOUND") navigate(ROUTES.OUTBOUND);
            else navigate(ROUTES.STOCKTAKE);
          }}
        >
          Mở
        </button>
      ),
    },
  ];

  return (
    <div className="hn-wireframe-page">
      <section className="hn-wire-section" aria-labelledby="dashboard-overview-title">
        <div className="hn-frame-label" id="dashboard-overview-title">
          1A · Tổng quan vận hành kho <span className="hn-tag">P0</span>
          <span className="hn-code">WF-WM-DASH-01 · derived overview</span>
        </div>

        <div className="hn-wireframe-panel">
          <div className="hn-api-strip">
            <span className="hn-label-mini">Nguồn</span>
            <span className="hn-chip hn-chip--api">GET /inventory</span>
            <span className="hn-chip hn-chip--api">GET /reports/*</span>
            <span className="hn-chip hn-chip--rule">01 kho tổng</span>
            <span className="hn-chip hn-chip--rule">Không hiển thị tồn đại lý</span>
            <span className="hn-chip hn-chip--tc">Chỉ tổng hợp dữ liệu đã post</span>
          </div>

          <div className="hn-wire-section-body">
            <div className="hn-kpi-grid">
              <div className="hn-kpi">
                <div className="hn-kpi__key">SKU đang hoạt động</div>
                <div className="hn-kpi__value">{kpi?.activeSku ?? 0}</div>
                <div className="hn-kpi__detail">
                  {kpi?.productCount ?? 0} PRODUCT · {kpi?.componentCount ?? 0} COMPONENT
                </div>
              </div>
              <div className="hn-kpi">
                <div className="hn-kpi__key">Tồn khả dụng</div>
                <div className="hn-kpi__value">{kpi?.availableStock ?? 0}</div>
                <div className="hn-kpi__detail">Kho tổng Hoa Nam</div>
              </div>
              <div className="hn-kpi">
                <div className="hn-kpi__key">Chờ xếp khay</div>
                <div className="hn-kpi__value">{kpi?.pendingPutaway ?? 0}</div>
                <div className="hn-kpi__detail">Putaway pending · box</div>
              </div>
              <div className="hn-kpi">
                <div className="hn-kpi__key">Phiên kiểm kê mở</div>
                <div className="hn-kpi__value">{kpi?.openStocktake ?? 0}</div>
                <div className="hn-kpi__detail">
                  {kpi?.stocktakeLines ?? 0} dòng cần review
                </div>
              </div>
              <div className="hn-kpi">
                <div className="hn-kpi__key">Bảo hành đang xử lý</div>
                <div className="hn-kpi__value">{kpi?.warrantyActive ?? 0}</div>
                <div className="hn-kpi__detail">
                  {kpi?.warrantyTempOnly ?? 0} TEMP_ONLY
                </div>
              </div>
            </div>

            <div className="hn-dashboard-two-col">
              <div className="hn-wire-item">
                <strong>⚠ Cảnh báo cần xử lý</strong>
                {alerts.length === 0 ? (
                  <div className="hn-wire-muted">Không có cảnh báo đang mở.</div>
                ) : (
                  <ul className="hn-alert-list">
                    {alerts.map((alert, index) => (
                      <li
                        key={`${alert.message}-${index}`}
                        className={
                          alert.severity === "danger"
                            ? "hn-alert-list__danger"
                            : undefined
                        }
                      >
                        {alert.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="hn-wire-item">
                <strong>Thao tác nhanh theo quyền</strong>
                <div className="hn-wire-actions">
                  <Button type="primary" onClick={() => navigate(ROUTES.INBOUND)}>
                    ＋ Tạo phiếu nhập
                  </Button>
                  <Button type="primary" onClick={() => navigate(ROUTES.OUTBOUND)}>
                    ＋ Tạo phiếu xuất
                  </Button>
                  <Button onClick={() => navigate(ROUTES.SCAN)}>⌁ Demo máy quét</Button>
                  <Button onClick={() => navigate(ROUTES.STOCKTAKE)}>
                    ＋ Tạo phiên kiểm kê
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="hn-dashboard-lower-grid">
        <section className="hn-wire-section hn-dashboard-recent" aria-labelledby="recent-title">
          <div className="hn-frame-label" id="recent-title">
            1B · Chứng từ gần đây <span className="hn-tag">P0</span>
            <span className="hn-code">operational feed</span>
          </div>
          <div className="hn-wireframe-panel">
            <div className="hn-wire-toolbar">
              <span className="hn-wire-filter">Loại chứng từ ▾</span>
              <span className="hn-wire-filter">Trạng thái ▾</span>
              <span className="hn-wire-filter">7 ngày gần nhất ▾</span>
              <span className="hn-wire-spacer" />
              <Button onClick={() => navigate(ROUTES.REPORTS)}>Xem toàn bộ</Button>
            </div>
            <Table<RecentDocument>
              className="hn-wire-table"
              dataSource={recent}
              columns={recentColumns}
              rowKey="id"
              pagination={false}
              size="middle"
              scroll={{ x: 980 }}
            />
          </div>
        </section>

        <section className="hn-wire-section hn-dashboard-health" aria-labelledby="health-title">
          <div className="hn-frame-label" id="health-title">
            1C · Sức khỏe đối soát <span className="hn-tag">P0</span>
          </div>
          <div className="hn-wireframe-panel">
            <div className="hn-api-strip">
              <span className="hn-chip hn-chip--api">GET /inventory-snapshots</span>
            </div>
            <div className="hn-health-list">
              <div className="hn-health-row">
                <div>
                  <strong>Ledger = Balance</strong>
                  <div className="hn-wire-hint">{health?.ledgerSkuCount ?? 0} SKU</div>
                </div>
                <span
                  className={
                    health?.ledgerBalance === "PASS"
                      ? "hn-pill hn-pill--success"
                      : health?.ledgerBalance === "FAIL"
                        ? "hn-pill hn-pill--danger"
                        : "hn-pill hn-pill--warn"
                  }
                >
                  {health?.ledgerBalance ?? "--"}
                </span>
              </div>
              <div className="hn-health-row">
                <div>
                  <strong>Subledger</strong>
                  <div className="hn-wire-hint">
                    {health?.subledgerMessage ?? "Chưa có dữ liệu đối soát"}
                  </div>
                </div>
                <span
                  className={
                    health?.subledger === "PASS"
                      ? "hn-pill hn-pill--success"
                      : health?.subledger === "FAIL"
                        ? "hn-pill hn-pill--danger"
                        : "hn-pill hn-pill--warn"
                  }
                >
                  {health?.subledger ?? "--"}
                </span>
              </div>
            </div>
            <div className="hn-note">
              <strong>Authority:</strong> Movement là authoritative ledger; Balance và
              subledger phải reconcile trước khi dùng số tồn để quyết định vận hành.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
