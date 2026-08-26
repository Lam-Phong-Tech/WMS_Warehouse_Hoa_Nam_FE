/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, type Key } from "react";
import { useSearchParams } from "react-router-dom";
import { Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  Button as MuiButton,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  ThemeProvider,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import {
  AppstoreOutlined,
  EyeOutlined,
  HistoryOutlined,
  SearchOutlined,
  SwapOutlined,
} from "@/shared/components/icons";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useCanAny } from "@/shared/components/permission";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import {
  INVENTORY_STOCK_STATUS_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  RECONCILE_STATUS_LABELS,
  SKU_TYPE_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
  useInventoryBalances,
  useStockMovements,
} from "../hooks/use-inventory";
import { BalanceDetailModal } from "../components/BalanceDetailModal";
import { TraceModal } from "../components/TraceModal";
import type {
  InventoryBalanceRow,
  InventoryStockStatus,
  StockMovementRow,
} from "../services/inventoryService";
import { formatDateTime } from "@/shared/utils/format-date";

const numberFormatter = new Intl.NumberFormat("vi-VN");
const SEARCH_DEBOUNCE_MS = 250;

/** Toolbar filter nhỏ gọn — đồng bộ chuẩn mui-theme.ts (xem gotcha #4/#5 memory pilot MUI). */
const TOOLBAR_SX = {
  "&, & .MuiOutlinedInput-root": { height: 35 },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    paddingTop: "8px !important",
    paddingBottom: "8px !important",
    fontSize: "13.5px !important",
    boxSizing: "border-box",
  },
};

function pageSizeOptions(current: number) {
  return MVP_PAGE_SIZE_OPTIONS.includes(
    current as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, current].sort((a, b) => a - b);
}

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
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | "">("");
  const [skuType, setSkuType] = useState<"PRODUCT" | "COMPONENT" | "">("");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [balancePage, setBalancePage] = useState(1);
  const [balancePerPage, setBalancePerPage] = useState(10);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPerPage, setMovementPerPage] = useState(10);
  const [balanceSelectedRowKeys, setBalanceSelectedRowKeys] = useState<
    Key[]
  >([]);
  const [movementSelectedRowKeys, setMovementSelectedRowKeys] = useState<
    Key[]
  >([]);

  const [activeTab, setActiveTab] = useState("balance");

  const [balanceDetailRow, setBalanceDetailRow] =
    useState<InventoryBalanceRow | null>(null);
  const [traceMovementId, setTraceMovementId] = useState<string | null>(null);

  const balanceQuery = useInventoryBalances({
    keyword: search || undefined,
    stock_status: stockStatus || undefined,
    sku_type: skuType || undefined,
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

  const overlayOpen = balanceDetailRow !== null || traceMovementId !== null;
  const closeOverlays = () => {
    setBalanceDetailRow(null);
    setTraceMovementId(null);
  };
  useOverlayBackDismiss(overlayOpen, closeOverlays, "INV-01-overlay");

  const balanceColumns: ColumnsType<InventoryBalanceRow> = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      fixed: "left",
      render: (_, __, index) =>
        mvpRowNumber(balancePage, balancePerPage, index),
    },
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
            {businessLabel(SKU_TYPE_LABELS, row.type, "Loại khác")}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "Kho", dataIndex: "warehouse", key: "warehouse", width: 130 },
    {
      title: "Trạng thái tồn",
      dataIndex: "stockStatus",
      key: "stockStatus",
      width: 170,
      render: (value: string) => (
        <Tag color={value === "AVAILABLE" ? "success" : "warning"}>
          {businessLabel(
            INVENTORY_STOCK_STATUS_LABELS,
            value,
            "Trạng thái khác",
          )}
        </Tag>
      ),
    },
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
      title: "Tồn hiện có",
      dataIndex: "onHand",
      key: "onHand",
      width: 120,
      align: "right",
      render: (value: number, row: InventoryBalanceRow) =>
        formatQty(value, row.uom),
    },
    {
      title: "Sản phẩm/Hộp",
      key: "subledger",
      width: 120,
      align: "center",
      render: (_, row: InventoryBalanceRow) => (
        <Tooltip title={`Sản phẩm: ${row.serialQty} · Hộp: ${row.boxQty}`}>
          <Typography.Text style={{ fontSize: 12 }}>
            {row.serialQty}/{row.boxQty}
          </Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: "Vị trí gợi ý",
      key: "location",
      width: 160,
      render: (_, row: InventoryBalanceRow) => {
        const parts = [row.containerCode, row.location].filter(Boolean);
        return parts.length > 0 ? (
          <Typography.Text style={{ fontSize: 12 }}>
            {parts.join(" · ")}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Chưa có vị trí gợi ý
          </Typography.Text>
        );
      },
    },
    {
      title: "Đối soát",
      dataIndex: "reconcile",
      key: "reconcile",
      width: 140,
      render: (value: string, row: InventoryBalanceRow) => (
        <Tooltip
          title={
            row.reconcileNote ||
            (value === "MATCH" || value === "PASS"
              ? "Sổ cái và số tồn hiện tại khớp nhau"
              : "Sổ cái và số tồn hiện tại đang có chênh lệch")
          }
        >
          <Tag color={reconcileColor(value)}>
            {businessLabel(RECONCILE_STATUS_LABELS, value, "Chưa đối soát")}
          </Tag>
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
          <EyeOutlined
            style={{ marginRight: 4, color: ACTION_ICON_COLORS.view }}
          />
          Mở
        </button>
      ),
    },
  ];

  const movementColumns: ColumnsType<StockMovementRow> = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      render: (_, __, index) =>
        mvpRowNumber(movementPage, movementPerPage, index),
    },
    {
      title: "Mã biến động",
      dataIndex: "movementId",
      key: "movementId",
      width: 140,
      render: (value: string) => (
        <Typography.Text code>{value || "-"}</Typography.Text>
      ),
    },
    {
      title: "Thời gian",
      dataIndex: "time",
      key: "time",
      width: 150,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: "Loại biến động",
      dataIndex: "type",
      key: "type",
      width: 170,
      render: (value: string, row: StockMovementRow) => (
        <Space orientation="vertical" size={0}>
          <Tag>
            {businessLabel(MOVEMENT_TYPE_LABELS, value, "Biến động khác")}
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {businessLabel(
              MOVEMENT_STATUS_LABELS,
              row.status,
              "Trạng thái khác",
            )}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "SKU", dataIndex: "sku", key: "sku", width: 120 },
    { title: "Kho", dataIndex: "warehouse", key: "warehouse", width: 120 },
    {
      title: "Số lượng thay đổi",
      dataIndex: "qty",
      key: "qty",
      width: 140,
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
      title: "Chứng từ nguồn",
      key: "source",
      width: 180,
      render: (_, row: StockMovementRow) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text code>{row.source || "-"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.sourceType,
              "Nguồn khác",
            )}
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
      width: 100,
      fixed: "right",
      render: (_, row: StockMovementRow) => (
        <Tooltip
          title={
            canTrace
              ? "Truy vết chứng từ nguồn"
              : "Tài khoản chưa có quyền truy vết tồn kho"
          }
        >
          <button
            className="btn small"
            type="button"
            disabled={!canTrace || !row.id}
            onClick={() => handleOpenTrace(String(row.id))}
          >
            <HistoryOutlined
              style={{ marginRight: 4, color: ACTION_ICON_COLORS.view }}
            />
            Truy vết
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
    <ThemeProvider theme={muiTheme}>
      <div className="inventory-page hn-mvp-source-screen">
      <Tabs
        value={activeTab}
        onChange={(_event, value: string) => setActiveTab(value)}
        sx={{ marginTop: "12px", minHeight: 40 }}
      >
        <Tab
          value="balance"
          icon={<AppstoreOutlined style={{ fontSize: 15 }} />}
          iconPosition="start"
          label="Tồn kho hiện tại"
          sx={{ minHeight: 40, textTransform: "none" }}
        />
        <Tab
          value="movement"
          icon={<SwapOutlined style={{ fontSize: 15 }} />}
          iconPosition="start"
          label="Lịch sử biến động"
          sx={{ minHeight: 40, textTransform: "none" }}
        />
      </Tabs>

      {activeTab === "balance" ? (
        <>
          <div className="toolbar">
            <TextField
              value={searchInput}
              placeholder="SKU, tên hàng, kho..."
              slotProps={{ htmlInput: { "aria-label": "Tìm tồn kho" } }}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{ minWidth: 220, ...TOOLBAR_SX }}
            />
            <Select
              displayEmpty
              value={skuType}
              inputProps={{ "aria-label": "Lọc loại hàng" }}
              onChange={(e) => {
                setSkuType(e.target.value as "PRODUCT" | "COMPONENT" | "");
                setBalancePage(1);
              }}
              sx={{ minWidth: 150, ...TOOLBAR_SX }}
            >
              <MenuItem value="">Loại: Tất cả</MenuItem>
              <MenuItem value="PRODUCT">Sản phẩm</MenuItem>
              <MenuItem value="COMPONENT">Linh kiện</MenuItem>
            </Select>
            <Select
              displayEmpty
              value={stockStatus}
              inputProps={{ "aria-label": "Lọc trạng thái tồn" }}
              onChange={(e) => {
                setStockStatus(e.target.value as InventoryStockStatus | "");
                setBalancePage(1);
              }}
              sx={{ minWidth: 190, ...TOOLBAR_SX }}
            >
              <MenuItem value="">Trạng thái tồn: Tất cả</MenuItem>
              <MenuItem value="AVAILABLE">Khả dụng</MenuItem>
              <MenuItem value="NON_SELLABLE">Không thể bán/xuất</MenuItem>
              <MenuItem value="DEFECTIVE">Hàng lỗi</MenuItem>
              <MenuItem value="QUARANTINE">Chờ kiểm tra</MenuItem>
            </Select>
            <Select
              value={balancePerPage}
              inputProps={{ "aria-label": "Số dòng mỗi trang" }}
              onChange={(e) => {
                setBalancePerPage(Number(e.target.value));
                setBalancePage(1);
              }}
              sx={{ minWidth: 100, ...TOOLBAR_SX }}
            >
              {pageSizeOptions(balancePerPage).map((size) => (
                <MenuItem key={size} value={size}>
                  {size} / trang
                </MenuItem>
              ))}
            </Select>
            <div className="spacer" />
            {canTrace ? (
              <MuiButton
                variant="outlined"
                onClick={() => setTraceMovementId("__lookup__")}
                startIcon={<SearchOutlined />}
              >
                Truy vết mã
              </MuiButton>
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

          <TableLoadingBanner
            loading={balanceQuery.isLoading || balanceQuery.isFetching}
          />
          <Table<InventoryBalanceRow>
            rowKey="id"
            columns={balanceColumns}
            dataSource={balances}
            loading={balanceQuery.isLoading || balanceQuery.isFetching}
            onChange={handleBalanceTableChange}
            rowSelection={{
              selectedRowKeys: balanceSelectedRowKeys,
              onChange: setBalanceSelectedRowKeys,
              fixed: true,
            }}
            pagination={{
              current: balancePagination.current,
              pageSize: balancePagination.pageSize,
              total: balancePagination.total,
              showSizeChanger: false,
              showTotal: (total) =>
                `Tổng ${numberFormatter.format(total)} dòng tồn kho`,
            }}
            locale={{
              emptyText: tableEmptyText(
                balanceQuery.isError ? balanceQuery.error : null,
                "Không có tồn kho theo bộ lọc hiện tại",
              ),
            }}
            onRow={(row) => ({
              onDoubleClick: () => setBalanceDetailRow(row),
            })}
            scroll={{ x: "max-content" }}
          />
        </>
      ) : (
        <>
          <div className="toolbar">
            <TextField
              value={movementSearch}
              placeholder="Mã biến động, chứng từ, SKU..."
              slotProps={{ htmlInput: { "aria-label": "Tìm biến động tồn kho" } }}
              onChange={(e) => {
                setMovementSearch(e.target.value);
                setMovementPage(1);
              }}
              sx={{ minWidth: 220, ...TOOLBAR_SX }}
            />
            <Select
              displayEmpty
              value={movementType}
              inputProps={{ "aria-label": "Lọc loại biến động" }}
              onChange={(e) => {
                setMovementType(e.target.value);
                setMovementPage(1);
              }}
              sx={{ minWidth: 190, ...TOOLBAR_SX }}
            >
              <MenuItem value="">Loại: Tất cả</MenuItem>
              <MenuItem value="RECEIPT">Nhập kho</MenuItem>
              <MenuItem value="ISSUE">Xuất kho</MenuItem>
              <MenuItem value="COMPONENT_ISSUE">
                Xuất linh kiện bảo hành
              </MenuItem>
              <MenuItem value="REVERSAL">Điều chỉnh tồn kho</MenuItem>
            </Select>
            <Select
              value={movementPerPage}
              inputProps={{ "aria-label": "Số dòng mỗi trang" }}
              onChange={(e) => {
                setMovementPerPage(Number(e.target.value));
                setMovementPage(1);
              }}
              sx={{ minWidth: 100, ...TOOLBAR_SX }}
            >
              {pageSizeOptions(movementPerPage).map((size) => (
                <MenuItem key={size} value={size}>
                  {size} / trang
                </MenuItem>
              ))}
            </Select>
          </div>

          {movementQuery.isError ? (
            <div style={{ marginBottom: 14 }}>
              <ApiErrorAlert
                error={movementQuery.error}
                title="Không thể tải lịch sử biến động"
                onRetry={() => movementQuery.refetch()}
              />
            </div>
          ) : null}

          <TableLoadingBanner
            loading={movementQuery.isLoading || movementQuery.isFetching}
          />
          <Table<StockMovementRow>
            rowKey="id"
            columns={movementColumns}
            dataSource={movements}
            loading={movementQuery.isLoading || movementQuery.isFetching}
            onChange={handleMovementTableChange}
            rowSelection={{
              selectedRowKeys: movementSelectedRowKeys,
              onChange: setMovementSelectedRowKeys,
            }}
            pagination={{
              current: movementPagination.current,
              pageSize: movementPagination.pageSize,
              total: movementPagination.total,
              showSizeChanger: false,
              showTotal: (total) =>
                `Tổng ${numberFormatter.format(total)} biến động`,
            }}
            locale={{
              emptyText: tableEmptyText(
                movementQuery.isError ? movementQuery.error : null,
                "Không có biến động theo bộ lọc hiện tại",
              ),
            }}
            scroll={{ x: "max-content" }}
          />
        </>
      )}

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
    </ThemeProvider>
  );
}
