/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Space, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  AppstoreOutlined,
  EyeOutlined,
  HistoryOutlined,
  SearchOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useCanAny } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import {
  useInventoryBalances,
  useStockMovements,
} from "../hooks/use-inventory";
import { BalanceDetailModal } from "../components/BalanceDetailModal";
import { TraceModal } from "../components/TraceModal";
import type {
  InventoryBalanceRow,
  StockMovementRow,
} from "../services/inventoryService";

const numberFormatter = new Intl.NumberFormat("vi-VN");
const SEARCH_DEBOUNCE_MS = 250;

function formatQty(value: number | null | undefined, uom = "") {
  if (value === null || value === undefined) return "-";
  return `${numberFormatter.format(value)}${uom ? ` ${uom}` : ""}`;
}

function reconcileColor(status: string) {
  if (status === "MATCH" || status === "PASS") return "success";
  if (status === "MISMATCH" || status === "FAIL") return "error";
  return "warning";
}

/**
 * INV-01 · Tra cứu tồn & đối soát — màn hub của luồng 05 · Tồn kho & kiểm soát.
 * Truy vết (TRACE-01) mở modal ngay trên danh sách, không chuyển trang —
 * đồng bộ pattern luồng 02/03/04.
 */
export default function InventoryPage() {
  const canTrace = useCanAny([P.INVENTORY_TRACE]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [balancePage, setBalancePage] = useState(1);
  const [balancePerPage, setBalancePerPage] = useState(15);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPerPage, setMovementPerPage] = useState(15);

  const [activeTab, setActiveTab] = useState("balance");

  const [balanceDetailRow, setBalanceDetailRow] =
    useState<InventoryBalanceRow | null>(null);
  const [traceMovementId, setTraceMovementId] = useState<string | null>(null);

  const balanceQuery = useInventoryBalances({
    keyword: search || undefined,
    status: stockStatus || undefined,
    page: balancePage,
    per_page: balancePerPage,
  });

  const movementQuery = useStockMovements({
    search: movementSearch || undefined,
    keyword: movementSearch || undefined,
    movement_type: movementType || undefined,
    page: movementPage,
    per_page: movementPerPage,
  });

  const balances = balanceQuery.data?.rows ?? [];
  const balanceMeta = balanceQuery.data?.meta;
  const movements = movementQuery.data?.rows ?? [];
  const movementMeta = movementQuery.data?.meta;

  const balancePagination = resolveApiPagination(balanceMeta, {
    page: balancePage,
    pageSize: balancePerPage,
    rowCount: balances.length,
  });
  const movementPagination = resolveApiPagination(movementMeta, {
    page: movementPage,
    pageSize: movementPerPage,
    rowCount: movements.length,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setBalancePage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const screen = searchParams.get("screen");
    if (!screen || screen === "INV-01") return;
    if (screen === "TRACE-01") {
      const id = searchParams.get("id");
      if (id) {
        setTraceMovementId(id);
      } else {
        setTraceMovementId("__lookup__");
      }
    } else {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "INV-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleOpenTrace = (movementId: string) => {
    setBalanceDetailRow(null);
    setTraceMovementId(movementId);
  };

  const balanceColumns: ColumnsType<InventoryBalanceRow> = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      width: 140,
      fixed: "left",
      render: (value: string) => (
        <Typography.Text code copyable>
          {value || "-"}
        </Typography.Text>
      ),
    },
    {
      title: "Tên hàng",
      key: "name",
      width: 200,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <strong>{row.name || "-"}</strong>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.type}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "Kho", dataIndex: "warehouse", key: "warehouse", width: 130 },
    { title: "Lô", dataIndex: "lotNo", key: "lotNo", width: 90 },
    {
      title: "Khả dụng",
      dataIndex: "available",
      key: "available",
      width: 110,
      align: "right",
      render: (value: number, row: InventoryBalanceRow) => (
        <strong>{formatQty(value, row.uom)}</strong>
      ),
    },
    {
      title: "On-hand",
      dataIndex: "onHand",
      key: "onHand",
      width: 100,
      align: "right",
      render: (value: number, row: InventoryBalanceRow) =>
        formatQty(value, row.uom),
    },
    {
      title: "Reserved",
      dataIndex: "reserved",
      key: "reserved",
      width: 100,
      align: "right",
      render: (value: number, row: InventoryBalanceRow) =>
        formatQty(value, row.uom),
    },
    {
      title: "In-transit",
      dataIndex: "inTransit",
      key: "inTransit",
      width: 100,
      align: "right",
      render: (value: number, row: InventoryBalanceRow) =>
        formatQty(value, row.uom),
    },
    {
      title: "Item/Box",
      key: "subledger",
      width: 90,
      align: "center",
      render: (_, row: InventoryBalanceRow) => (
        <Tooltip title={`Item: ${row.serialQty} · Container: ${row.boxQty}`}>
          <Typography.Text style={{ fontSize: 12 }}>
            {row.serialQty}/{row.boxQty}
          </Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: "Vị trí gợi ý",
      dataIndex: "location",
      key: "location",
      width: 120,
    },
    {
      title: "Đối soát",
      dataIndex: "reconcile",
      key: "reconcile",
      width: 110,
      render: (value: string, row: InventoryBalanceRow) => (
        <Tooltip
          title={
            row.reconcileNote ||
            (value === "MATCH"
              ? "Ledger ↔ Balance khớp"
              : "Ledger ↔ Balance lệch")
          }
        >
          <Tag color={reconcileColor(value)}>{value}</Tag>
        </Tooltip>
      ),
    },
    {
      title: "Cập nhật",
      key: "updatedAt",
      width: 140,
      render: (_, row: InventoryBalanceRow) =>
        row.updatedAt || row.dataAsOf || "-",
    },
    {
      title: "",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_, row: InventoryBalanceRow) => (
        <button
          className="btn small"
          type="button"
          onClick={() => setBalanceDetailRow(row)}
        >
          <EyeOutlined style={{ marginRight: 4 }} />
          Mở
        </button>
      ),
    },
  ];

  const movementColumns: ColumnsType<StockMovementRow> = [
    {
      title: "Mã dịch chuyển",
      dataIndex: "movementId",
      key: "movementId",
      width: 140,
      render: (value: string) => (
        <Typography.Text code>{value || "-"}</Typography.Text>
      ),
    },
    { title: "Thời gian", dataIndex: "time", key: "time", width: 150 },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 130,
      render: (value: string, row: StockMovementRow) => (
        <Space orientation="vertical" size={0}>
          <Tag>{value || "-"}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.status}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "SKU", dataIndex: "sku", key: "sku", width: 120 },
    { title: "Kho", dataIndex: "warehouse", key: "warehouse", width: 120 },
    {
      title: "SL thay đổi",
      dataIndex: "qty",
      key: "qty",
      width: 110,
      align: "right",
      render: (value: number) => (
        <Typography.Text
          style={{
            color: value >= 0 ? "#237804" : "#cf1322",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {value >= 0
            ? `+${numberFormatter.format(value)}`
            : numberFormatter.format(value)}
        </Typography.Text>
      ),
    },
    {
      title: "Nguồn",
      key: "source",
      width: 160,
      render: (_, row: StockMovementRow) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text code>{row.source || "-"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.sourceType}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Người thao tác",
      dataIndex: "actor",
      key: "actor",
      width: 120,
    },
    {
      title: "",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_, row: StockMovementRow) => (
        <Tooltip
          title={
            canTrace
              ? "Truy vết chứng từ nguồn"
              : "Cần quyền inventory.trace để truy vết"
          }
        >
          <button
            className="btn small"
            type="button"
            disabled={!canTrace || !row.id}
            onClick={() => handleOpenTrace(String(row.id))}
          >
            <HistoryOutlined style={{ marginRight: 4 }} />
            Trace
          </button>
        </Tooltip>
      ),
    },
  ];

  const handleBalanceTableChange = (p: TablePaginationConfig) => {
    setBalancePage(p.current ?? 1);
  };

  const handleMovementTableChange = (p: TablePaginationConfig) => {
    setMovementPage(p.current ?? 1);
  };

  return (
    <div className="inventory-page">
      <div className="toolbar-wrap" style={{ gap: 6 }}>
        <span className="pill blue">GET /inventory/balances</span>
        <span className="pill blue">GET /stock-movements</span>
        <span className="pill blue">GET /stock-movements/:id/trace-source</span>
        <span className="pill blue">GET /stock-movements/trace-by-code</span>
        <span className="pill ok">
          Balance là chiếu (projection) · Movement là sổ cái (ledger) ·
          Reconciliation authoritative
        </span>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 12 }}
        items={[
          {
            key: "balance",
            label: (
              <span>
                <AppstoreOutlined style={{ marginRight: 6 }} />
                Tồn kho hiện tại
              </span>
            ),
            children: (
              <>
                <div className="toolbar">
                  <input
                    className="input search"
                    value={searchInput}
                    placeholder="SKU, tên hàng, kho..."
                    aria-label="Tìm tồn kho"
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <select
                    className="select"
                    value={stockStatus}
                    aria-label="Lọc trạng thái tồn"
                    onChange={(e) => {
                      setStockStatus(e.target.value);
                      setBalancePage(1);
                    }}
                  >
                    <option value="">Trạng thái: Tất cả</option>
                    <option value="normal">Bình thường</option>
                    <option value="low_stock">Sắp hết</option>
                    <option value="overflow">Vượt mức</option>
                  </select>
                  <div className="spacer" />
                  {canTrace ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => setTraceMovementId("__lookup__")}
                    >
                      <SearchOutlined style={{ marginRight: 4 }} />
                      Truy vết mã
                    </button>
                  ) : null}
                </div>

                {balanceQuery.isError ? (
                  <div style={{ marginBottom: 14 }}>
                    <ApiErrorAlert
                      error={balanceQuery.error}
                      title="Không thể tải tồn kho hiện tại"
                      onRetry={() => balanceQuery.refetch()}
                    />
                  </div>
                ) : null}

                <MvpPageSizeSelector
                  value={balancePerPage}
                  onChange={(v) => {
                    setBalancePerPage(v);
                    setBalancePage(1);
                  }}
                />

                <Table<InventoryBalanceRow>
                  rowKey="id"
                  columns={balanceColumns}
                  dataSource={balances}
                  loading={balanceQuery.isLoading || balanceQuery.isFetching}
                  onChange={handleBalanceTableChange}
                  pagination={{
                    current: balancePagination.current,
                    pageSize: balancePagination.pageSize,
                    total: balancePagination.total,
                    showSizeChanger: false,
                    showTotal: (total) =>
                      `Tổng ${numberFormatter.format(total)} dòng tồn kho`,
                  }}
                  locale={{
                    emptyText: balanceQuery.isError
                      ? "Không tải được dữ liệu"
                      : "Không có tồn kho theo bộ lọc hiện tại",
                  }}
                  onRow={(row) => ({
                    onDoubleClick: () => setBalanceDetailRow(row),
                  })}
                  scroll={{ x: 1600 }}
                />

                <div className="footer-note" style={{ marginBottom: 8 }}>
                  <b>Đối soát</b> do backend tính: Ledger (SUM qty_delta) ↔
                  Balance (on_hand_qty). MATCH = khớp, MISMATCH = lệch. Bấm{" "}
                  <b>Mở</b> để xem chi tiết tồn kho, item/box subledger và
                  movement liên quan.
                </div>
              </>
            ),
          },
          {
            key: "movement",
            label: (
              <span>
                <SwapOutlined style={{ marginRight: 6 }} />
                Lịch sử dịch chuyển
              </span>
            ),
            children: (
              <>
                <div className="toolbar">
                  <input
                    className="input search"
                    value={movementSearch}
                    placeholder="Movement, chứng từ, SKU..."
                    aria-label="Tìm movement"
                    onChange={(e) => {
                      setMovementSearch(e.target.value);
                      setMovementPage(1);
                    }}
                  />
                  <select
                    className="select"
                    value={movementType}
                    aria-label="Lọc loại dịch chuyển"
                    onChange={(e) => {
                      setMovementType(e.target.value);
                      setMovementPage(1);
                    }}
                  >
                    <option value="">Loại: Tất cả</option>
                    <option value="RECEIPT">Nhập kho</option>
                    <option value="ISSUE">Xuất kho</option>
                    <option value="COMPONENT_ISSUE">Xuất linh kiện BH</option>
                    <option value="REVERSAL">Hoàn đảo</option>
                  </select>
                </div>

                {movementQuery.isError ? (
                  <div style={{ marginBottom: 14 }}>
                    <ApiErrorAlert
                      error={movementQuery.error}
                      title="Không thể tải lịch sử dịch chuyển"
                      onRetry={() => movementQuery.refetch()}
                    />
                  </div>
                ) : null}

                <MvpPageSizeSelector
                  value={movementPerPage}
                  onChange={(v) => {
                    setMovementPerPage(v);
                    setMovementPage(1);
                  }}
                />

                <Table<StockMovementRow>
                  rowKey="id"
                  columns={movementColumns}
                  dataSource={movements}
                  loading={movementQuery.isLoading || movementQuery.isFetching}
                  onChange={handleMovementTableChange}
                  pagination={{
                    current: movementPagination.current,
                    pageSize: movementPagination.pageSize,
                    total: movementPagination.total,
                    showSizeChanger: false,
                    showTotal: (total) =>
                      `Tổng ${numberFormatter.format(total)} movement`,
                  }}
                  locale={{
                    emptyText: movementQuery.isError
                      ? "Không tải được dữ liệu"
                      : "Không có movement theo bộ lọc hiện tại",
                  }}
                  scroll={{ x: 1200 }}
                />
              </>
            ),
          },
        ]}
      />

      {/* ──── Modals ──── */}
      {balanceDetailRow ? (
        <BalanceDetailModal
          balance={balanceDetailRow}
          onClose={() => setBalanceDetailRow(null)}
          onTraceMovement={canTrace ? handleOpenTrace : undefined}
        />
      ) : null}

      {traceMovementId ? (
        <TraceModal
          movementId={traceMovementId === "__lookup__" ? null : traceMovementId}
          onClose={() => setTraceMovementId(null)}
        />
      ) : null}
    </div>
  );
}
