/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pagination, Space, Tag, Tooltip, Typography } from "antd";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { MenuItem, Select, Tab, Tabs, TextField } from "@mui/material";
import { AppstoreOutlined, SwapOutlined } from "@/shared/components/icons";
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
import { useRowSelection } from "@/shared/hooks/useRowSelection";
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
import { ActionButton } from "@/shared/components/actions";

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
  const balanceSelection = useRowSelection(balances, (row) => row.id);
  const balanceMeta = balanceQuery.data?.meta;
  const movements = movementQuery.data?.rows ?? [];
  const movementSelection = useRowSelection(movements, (row) => row.id);
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

  // Bảng nhiều cột nhất dự án (~16 cột cả 2 tab) — chuyển sang
  // ResponsiveDataTable: desktop giữ UX bảng, mobile/tablet hẹp (<md) chuyển
  // thành card. 5-6 cột nghiệp vụ cốt lõi (SKU/tên/trạng thái/khả
  // dụng/vị trí/đối soát — đúng mục đích "Tra cứu tồn & đối soát" của màn
  // này) hiện trên card; "Tồn hiện có"/"Tồn theo sổ cái" (số lượng phụ, đã có
  // "Khả dụng" là số chính và "Chênh lệch" đã tóm tắt phép so 2 số này) cùng
  // "STT" (thứ tự không còn ý nghĩa nhiều trong danh sách card) ẩn trên
  // mobile. Toàn bộ sorter ở đây vốn là client-side (so sánh trực tiếp
  // trên mảng `balances` của trang hiện tại, không có tham số sort gửi lên
  // API) nên cột nào cũng giữ được qua `sortAccessor`.
  const balanceColumns: ResponsiveTableColumn<InventoryBalanceRow>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(balancePage, balancePerPage, balances.indexOf(row)),
    },
    {
      key: "sku",
      header: "SKU",
      width: 140,
      sortAccessor: (row) => row.sku,
      render: (row) => (
        <Typography.Text code copyable>
          {row.sku || "-"}
        </Typography.Text>
      ),
    },
    {
      key: "name",
      header: "Tên hàng",
      width: 200,
      sortAccessor: (row) => row.name || "",
      render: (row) => (
        <Space orientation="vertical" size={0}>
          <strong>{row.name || "-"}</strong>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {businessLabel(SKU_TYPE_LABELS, row.type, "Loại khác")}
          </Typography.Text>
        </Space>
      ),
    },
    {
      key: "stockStatus",
      header: "Trạng thái tồn",
      width: 170,
      sortType: "value",
      sortAccessor: (row) => row.stockStatus,
      render: (row) => (
        <Tag color={row.stockStatus === "AVAILABLE" ? "success" : "warning"}>
          {businessLabel(
            INVENTORY_STOCK_STATUS_LABELS,
            row.stockStatus,
            "Trạng thái khác",
          )}
        </Tag>
      ),
    },
    {
      key: "available",
      header: "Khả dụng",
      width: 110,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.available,
      render: (row) => <strong>{formatQty(row.available, row.uom)}</strong>,
    },
    {
      key: "onHand",
      header: "Tồn hiện có",
      width: 120,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.onHand,
      hideOnMobile: true,
      render: (row) => formatQty(row.onHand, row.uom),
    },
    {
      // WWHN-191: tổng theo sổ cái (sum stock_movements.qty_delta) — vế còn lại
      // của phép đối soát. Trước đây chỉ pass-through trong service, nay hiện
      // luôn cạnh "Tồn hiện có" để người dùng thấy cả 2 số đang so với nhau.
      key: "ledgerTotal",
      header: "Tồn theo sổ cái",
      width: 130,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.ledgerTotal,
      hideOnMobile: true,
      render: (row) => formatQty(row.ledgerTotal, row.uom),
    },
    {
      // Chênh lệch có dấu = tồn hiện có - sổ cái. Đây là con số đứng sau tag
      // "Đối soát" nên tô màu theo hướng lệch, 0 để mờ cho đỡ nhiễu.
      key: "variance",
      header: "Chênh lệch",
      width: 120,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.variance,
      render: (row) => {
        if (row.variance === 0) {
          return (
            <Typography.Text
              type="secondary"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              0
            </Typography.Text>
          );
        }
        return (
          <Typography.Text
            style={{
              color: row.variance > 0 ? "#d46b08" : "#cf1322",
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
            }}
          >
            {row.variance > 0
              ? `+${numberFormatter.format(row.variance)}`
              : numberFormatter.format(row.variance)}
          </Typography.Text>
        );
      },
    },
    {
      key: "location",
      header: "Vị trí gợi ý",
      width: 160,
      sortAccessor: (row) => row.containerCode || row.location || "",
      render: (row) => {
        const parts = [row.containerCode, row.location].filter(Boolean);
        if (parts.length === 0) {
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Chưa có vị trí gợi ý
            </Typography.Text>
          );
        }
        const text = parts.join(" · ");
        // Độ dài container/location thất thường (có khi rất dài) — ellipsis +
        // tooltip để tránh dòng bị dồn/cắt xấu hoặc kéo lệch chiều cao bảng
        // (tiêu chí 2), vẫn xem được đầy đủ khi hover.
        return (
          <Typography.Text
            style={{ fontSize: 12, maxWidth: 150 }}
            ellipsis={{ tooltip: text }}
          >
            {text}
          </Typography.Text>
        );
      },
    },
    {
      key: "reconcile",
      header: "Đối soát",
      width: 140,
      sortType: "value",
      sortAccessor: (row) => row.reconcile,
      render: (row) => (
        <Tooltip
          title={
            row.reconcileNote ||
            (row.reconcile === "MATCH" || row.reconcile === "PASS"
              ? "Sổ cái và số tồn hiện tại khớp nhau"
              : "Sổ cái và số tồn hiện tại đang có chênh lệch")
          }
        >
          <Tag color={reconcileColor(row.reconcile)}>
            {businessLabel(
              RECONCILE_STATUS_LABELS,
              row.reconcile,
              "Chưa đối soát",
            )}
          </Tag>
        </Tooltip>
      ),
    },
  ];

  // Bảng "Lịch sử biến động" chỉ có 5 cột nghiệp vụ thật (không tính STT/thao
  // tác) nên không có cột "phụ" nào để ẩn trên mobile — tất cả đều là thông
  // tin cốt lõi của 1 dòng biến động. Chỉ ẩn STT (thứ tự không cần thiết ở
  // dạng card). Sorter cũng thuần client-side như bảng tồn kho ở trên.
  const movementColumns: ResponsiveTableColumn<StockMovementRow>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(movementPage, movementPerPage, movements.indexOf(row)),
    },
    {
      key: "time",
      header: "Thời gian",
      width: 150,
      sortType: "value",
      sortAccessor: (row) => row.time || "",
      render: (row) => formatDateTime(row.time),
    },
    {
      key: "type",
      header: "Loại biến động",
      width: 170,
      sortType: "value",
      sortAccessor: (row) => row.type,
      render: (row) => (
        <Space orientation="vertical" size={0}>
          <Tag>
            {businessLabel(MOVEMENT_TYPE_LABELS, row.type, "Biến động khác")}
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
    {
      key: "sku",
      header: "SKU",
      width: 120,
      sortAccessor: (row) => row.sku,
      render: (row) => row.sku,
    },
    {
      key: "qty",
      header: "Số lượng thay đổi",
      width: 140,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.qty,
      render: (row) => (
        <Typography.Text
          style={{
            color: row.qty >= 0 ? "#237804" : "#cf1322",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {row.qty >= 0
            ? `+${numberFormatter.format(row.qty)}`
            : numberFormatter.format(row.qty)}
        </Typography.Text>
      ),
    },
    {
      key: "source",
      header: "Chứng từ nguồn",
      width: 180,
      sortAccessor: (row) => row.source || "",
      render: (row) => (
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
  ];

  return (
    <>
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
              {/* Tổng số dòng hiển thị ngay trong khu vực filter/toolbar — tránh
                phải kéo xuống cuối bảng mới thấy (tiêu chí 4). */}

              <div className="spacer" />
              {canTrace ? (
                <ActionButton
                  kind="trace"
                  onClick={() => setTraceMovementId("__lookup__")}
                >
                  Truy vết mã
                </ActionButton>
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
            <ResponsiveDataTable<InventoryBalanceRow>
              rowKey={(row) => row.id}
              columns={balanceColumns}
              rows={balances}
              rowSelection={balanceSelection}
              selectionLabel={(row) => `Chọn dòng tồn kho SKU ${row.sku}`}
              loading={balanceQuery.isLoading || balanceQuery.isFetching}
              emptyText={tableEmptyText(
                balanceQuery.isError ? balanceQuery.error : null,
                "Không có tồn kho theo bộ lọc hiện tại",
              )}
              onRowClick={(row) => setBalanceDetailRow(row)}
              renderRowActions={(row) => (
                <ActionButton
                  kind="view"
                  sx={{ whiteSpace: "nowrap" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setBalanceDetailRow(row);
                  }}
                >
                  Mở
                </ActionButton>
              )}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <Pagination
                size="small"
                current={balancePagination.current}
                pageSize={balancePagination.pageSize}
                total={balancePagination.total}
                showSizeChanger={false}
                showTotal={(total) =>
                  `Tổng ${numberFormatter.format(total)} dòng tồn kho`
                }
                onChange={(page) => setBalancePage(page)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="toolbar">
              <TextField
                value={movementSearch}
                placeholder="Mã biến động, chứng từ, SKU..."
                slotProps={{
                  htmlInput: { "aria-label": "Tìm biến động tồn kho" },
                }}
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
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Tổng {numberFormatter.format(movementPagination.total)} biến
                động
              </Typography.Text>
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
            <ResponsiveDataTable<StockMovementRow>
              rowKey={(row) => row.id}
              columns={movementColumns}
              rows={movements}
              rowSelection={movementSelection}
              selectionLabel={(row) => `Chọn biến động ${row.id}`}
              loading={movementQuery.isLoading || movementQuery.isFetching}
              emptyText={tableEmptyText(
                movementQuery.isError ? movementQuery.error : null,
                "Không có biến động theo bộ lọc hiện tại",
              )}
              renderRowActions={(row) => (
                <Tooltip
                  title={
                    canTrace
                      ? "Truy vết chứng từ nguồn"
                      : "Tài khoản chưa có quyền truy vết tồn kho"
                  }
                >
                  <ActionButton
                    kind="history"
                    sx={{ whiteSpace: "nowrap" }}
                    disabled={!canTrace || !row.id}
                    onClick={() => handleOpenTrace(String(row.id))}
                  >
                    Truy vết
                  </ActionButton>
                </Tooltip>
              )}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <Pagination
                size="small"
                current={movementPagination.current}
                pageSize={movementPagination.pageSize}
                total={movementPagination.total}
                showSizeChanger={false}
                showTotal={(total) =>
                  `Tổng ${numberFormatter.format(total)} biến động`
                }
                onChange={(page) => setMovementPage(page)}
              />
            </div>
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
            movementId={
              traceMovementId === "__lookup__" ? null : traceMovementId
            }
            onClose={() => setTraceMovementId(null)}
          />
        ) : null}
      </div>
    </>
  );
}
