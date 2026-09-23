/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  SEMANTIC_LIGHT,
  Stack,
  Tooltip,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiTabPanel,
  UiText,
  UiTextField,
  type UiTabItem,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import {
  AppstoreOutlined,
  SwapOutlined,
  SearchOutlined,
} from "@/shared/components/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
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
  RECONCILE_REASON_LABELS,
  RECONCILE_STATUS_LABELS,
  SKU_TYPE_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
  enumLabelOrText,
} from "@/shared/constants/business-labels";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
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
import { formatQuantity } from "@/shared/utils/format-number";
import {
  ActionButton,
  ActionIconButton,
  RowActionButton,
} from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

import "./inventory-page.css";

const SEARCH_DEBOUNCE_MS = 250;

function pageSizeOptions(current: number) {
  return MVP_PAGE_SIZE_OPTIONS.includes(
    current as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, current].sort((a, b) => a - b);
}

function formatQty(value: number | null | undefined, uom = "") {
  const formatted = formatQuantity(value);
  if (formatted === EMPTY_TEXT) return EMPTY_TEXT;
  return `${formatted}${uom ? ` ${uom}` : ""}`;
}

function reconcileColor(status: string): "success" | "error" | "warning" {
  if (status === "MATCH" || status === "PASS") return "success";
  if (status === "MISMATCH" || status === "FAIL") return "error";
  return "warning";
}

/** Nhãn tab kèm icon — UiTabs nhận label ReactNode nên icon ghép ngay trong label. */
function TabLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
    >
      {icon}
      <span>{text}</span>
    </Box>
  );
}

/**
 * Mã dạng code (SKU/chứng từ) — thay antd Typography.Text `code`.
 *
 * Ô bảng đi qua `TruncatedText` (`.hn-truncate`, overflow hidden) nên chip này
 * PHẢI tự co và tự cắt: `<code>` mặc định là inline nên `text-overflow` không
 * áp được lên nó, và làm phần tử flex thì nó cũng không chịu co
 * (`min-width: auto`) — mã dài bị cắt cụt giữa ký tự, đồng thời đẩy phần tử
 * đứng sau (nút sao chép) ra ngoài vùng thấy được. Khai `inline-block` +
 * `minWidth: 0` + ellipsis để mã dài kết thúc bằng "…" thay vì cắt ngang.
 */
function CodeText({ children }: { children: ReactNode }) {
  return <code className="hn-inventory-code">{children}</code>;
}

const inventoryTabItems = (t: TranslateFn): UiTabItem[] => [
  {
    key: "balance",
    label: (
      <TabLabel
        icon={<AppstoreOutlined style={{ fontSize: 15 }} />}
        text={t("inventory.tab.balances")}
      />
    ),
  },
  {
    key: "movement",
    label: (
      <TabLabel
        icon={<SwapOutlined style={{ fontSize: 15 }} />}
        text={t("inventory.tab.movements")}
      />
    ),
  },
];

/**
 * INV-01 · Tra cứu tồn & đối soát — màn hub của luồng 05 · Tồn kho & kiểm soát.
 * Truy vết (TRACE-01) mở modal ngay trên danh sách, không chuyển trang —
 * đồng bộ pattern luồng 02/03/04.
 */
export default function InventoryPage() {
  const t = useT();
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

  // Bảng nhiều cột nhất dự án (~16 cột cả 2 tab) — chuyển sang
  // ResponsiveDataTable: desktop giữ UX bảng, mobile/tablet hẹp (<md) chuyển
  // thành card. Các cột nghiệp vụ đều hiện trên card, gồm cả tồn hiện có và sổ cái
  // để không mất bằng chứng đối soát ở màn hình hẹp. Chỉ STT được ẩn. Toàn bộ sorter ở đây vốn là client-side (so sánh trực tiếp
  // trên mảng `balances` của trang hiện tại, không có tham số sort gửi lên
  // API) nên cột nào cũng giữ được qua `sortAccessor`.
  const balanceColumns: ResponsiveTableColumn<InventoryBalanceRow>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(balancePage, balancePerPage, rowIndexOf(balances, row)),
    },
    {
      key: "sku",
      header: "SKU",
      // Ô này chứa chip mã (mã SKU dài nhất của hệ ~17 ký tự monospace ≈ 130px)
      // + nút sao chép (34px) + khoảng cách. 140px cũ không đủ chỗ nên nút sao
      // chép nằm hẳn ngoài vùng cắt của `.hn-truncate`, chỉ ló ra một mẩu bo
      // góc trông như ký tự lạ. 190px đủ cho cả hai mà không phải cắt chữ.
      width: 190,
      sortAccessor: (row) => row.sku,
      render: (row) => (
        // `minWidth: 0` cho cả hàng flex lẫn chip mã: thiếu nó thì phần tử flex
        // giữ nguyên bề ngang nội dung và đẩy nút sao chép ra khỏi ô thay vì
        // để chip mã tự cắt bằng "…".
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <CodeText>
            <SkuLink code={row.sku} />
          </CodeText>
          <ActionIconButton
            kind="copy"
            sx={{ flexShrink: 0 }}
            onClick={(event) => {
              event.stopPropagation();
              void navigator.clipboard?.writeText(row.sku || EMPTY_TEXT);
            }}
          />
        </Stack>
      ),
    },
    {
      key: "name",
      header: t("inventory.balance.colName"),
      width: 200,
      sortAccessor: (row) => row.name || "",
      render: (row) => (
        <Stack>
          <strong>{row.name || EMPTY_TEXT}</strong>
          <UiText variant="secondary">
            {businessLabel(
              SKU_TYPE_LABELS,
              row.type,
              t("inventory.fallback.skuType"),
            )}
          </UiText>
        </Stack>
      ),
    },
    {
      key: "stockStatus",
      header: t("inventory.balance.colStockStatus"),
      width: 170,
      sortType: "value",
      sortAccessor: (row) => row.stockStatus,
      render: (row) => (
        <UiStatusBadge
          tone={row.stockStatus === "AVAILABLE" ? "success" : "warning"}
          data-tone={row.stockStatus === "AVAILABLE" ? "success" : "warning"}
          label={businessLabel(
            INVENTORY_STOCK_STATUS_LABELS,
            row.stockStatus,
            t("inventory.fallback.status"),
          )}
        />
      ),
    },
    {
      key: "available",
      header: t("inventory.balance.colAvailable"),
      width: 110,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.available,
      render: (row) => <strong>{formatQty(row.available, row.uom)}</strong>,
    },
    {
      key: "onHand",
      header: t("inventory.balance.colOnHand"),
      width: 120,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.onHand,
      render: (row) => formatQty(row.onHand, row.uom),
    },
    {
      // WWHN-191: tổng theo sổ cái (sum stock_movements.qty_delta) — vế còn lại
      // của phép đối soát. Trước đây chỉ pass-through trong service, nay hiện
      // luôn cạnh "Tồn hiện có" để người dùng thấy cả 2 số đang so với nhau.
      key: "ledgerTotal",
      header: t("inventory.balance.colLedger"),
      width: 130,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.ledgerTotal,
      render: (row) => formatQty(row.ledgerTotal, row.uom),
    },
    {
      // Chênh lệch có dấu = tồn hiện có - sổ cái. Đây là con số đứng sau tag
      // "Đối soát" nên tô màu theo hướng lệch, 0 để mờ cho đỡ nhiễu.
      key: "variance",
      header: t("inventory.balance.colVariance"),
      width: 120,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.variance,
      render: (row) => {
        if (row.variance === null) return EMPTY_TEXT;
        if (row.variance === 0) {
          return (
            <Box
              component="span"
              sx={{
                color: "var(--inv-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              0
            </Box>
          );
        }
        return (
          <Box
            component="span"
            sx={{
              color:
                row.variance > 0
                  ? SEMANTIC_LIGHT.warningText
                  : SEMANTIC_LIGHT.errorText,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
            }}
          >
            {row.variance > 0
              ? `+${formatQuantity(row.variance)}`
              : formatQuantity(row.variance)}
          </Box>
        );
      },
    },
    {
      key: "location",
      header: t("inventory.balance.colSuggestedLocation"),
      width: 160,
      sortAccessor: (row) => row.containerCode || row.trayCode || "",
      render: (row) => {
        // Danh sách chỉ cần 2 mã định danh để nhận ra ngay "đang ở đâu": mã hộp
        // (container_code — có ngay sau khi nhập kho) và mã khay (tray_code —
        // container_code của TRAY cha, chỉ có sau khi Putaway xếp hộp vào khay).
        // Vị trí mô tả rời (location_hint) chi tiết hơn — xem ở "Xem chi tiết".
        const parts = [
          row.containerCode
            ? t("inventory.balance.boxPrefix", { code: row.containerCode })
            : null,
          row.trayCode ? `Khay ${row.trayCode}` : null,
        ].filter((part): part is string => Boolean(part));
        if (parts.length === 0) {
          return (
            <UiText variant="secondary">
              {t("inventory.balance.noSuggestedLocation")}
            </UiText>
          );
        }
        const text = parts.join(" · ");
        // Độ dài container/location thất thường (có khi rất dài) — ellipsis +
        // tooltip để tránh dòng bị dồn/cắt xấu hoặc kéo lệch chiều cao bảng
        // (tiêu chí 2), vẫn xem được đầy đủ khi hover.
        return (
          <Tooltip title={text}>
            <Box
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 150,
                fontSize: 12,
              }}
            >
              {text}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      key: "reconcile",
      header: t("inventory.balance.colReconcile"),
      width: 140,
      sortType: "value",
      sortAccessor: (row) => row.reconcile,
      render: (row) => (
        <Tooltip
          title={
            (row.reconcileNote &&
              enumLabelOrText(RECONCILE_REASON_LABELS, row.reconcileNote)) ||
            (row.reconcile === "MATCH" || row.reconcile === "PASS"
              ? t("inventory.balance.reconcileMatch")
              : t("inventory.balance.reconcileMismatch"))
          }
        >
          <span>
            <UiStatusBadge
              tone={reconcileColor(row.reconcile)}
              data-tone={reconcileColor(row.reconcile)}
              label={businessLabel(
                RECONCILE_STATUS_LABELS,
                row.reconcile,
                t("inventory.fallback.notReconciled"),
              )}
            />
          </span>
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
        mvpRowNumber(movementPage, movementPerPage, rowIndexOf(movements, row)),
    },
    {
      key: "time",
      header: t("inventory.movement.colTime"),
      width: 150,
      sortType: "value",
      sortAccessor: (row) => row.time || "",
      render: (row) => formatDateTime(row.time),
    },
    {
      key: "type",
      header: t("inventory.movement.colType"),
      width: 170,
      sortType: "value",
      sortAccessor: (row) => row.type,
      render: (row) => (
        <Stack sx={{ alignItems: "flex-start" }}>
          <UiStatusBadge
            tone="neutral"
            data-tone="neutral"
            label={businessLabel(
              MOVEMENT_TYPE_LABELS,
              row.type,
              t("inventory.fallback.movementType"),
            )}
          />
          <UiText variant="secondary">
            {businessLabel(
              MOVEMENT_STATUS_LABELS,
              row.status,
              t("inventory.fallback.status"),
            )}
          </UiText>
        </Stack>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      // Mã SKU dài nhất của hệ (~17 ký tự) chiếm ~130px ở font thân bài; cộng
      // 20px padding của ô là 150px. 120px cũ khiến MỌI mã trong tab này bị cắt
      // bằng "…" dù cột kế bên còn thừa chỗ.
      width: 160,
      sortAccessor: (row) => row.sku,
      render: (row) => <SkuLink code={row.sku} />,
    },
    {
      key: "qty",
      header: t("inventory.movement.colQtyChange"),
      width: 140,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.qty,
      render: (row) => (
        <Box
          component="span"
          sx={{
            color:
              row.qty === null
                ? "text.secondary"
                : row.qty >= 0
                  ? SEMANTIC_LIGHT.successText
                  : SEMANTIC_LIGHT.errorText,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {row.qty !== null && row.qty >= 0
            ? `+${formatQuantity(row.qty)}`
            : formatQuantity(row.qty)}
        </Box>
      ),
    },
    {
      key: "source",
      header: t("inventory.movement.colSourceDocument"),
      width: 180,
      sortAccessor: (row) => row.source || "",
      render: (row) => (
        <Stack sx={{ alignItems: "flex-start" }}>
          <CodeText>{row.source || EMPTY_TEXT}</CodeText>
          <UiText variant="secondary">
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.sourceType,
              t("inventory.fallback.source"),
            )}
          </UiText>
        </Stack>
      ),
    },
  ];

  const isBalance = activeTab === "balance";
  const query = isBalance ? balanceQuery : movementQuery;
  const pagination = isBalance ? balancePagination : movementPagination;
  const perPage = isBalance ? balancePerPage : movementPerPage;
  const hasFilters = isBalance
    ? Boolean(searchInput || skuType || stockStatus)
    : Boolean(movementSearch || movementType);
  const resetFilters = () => {
    if (isBalance) {
      setSearchInput("");
      setSearch("");
      setSkuType("");
      setStockStatus("");
      setBalancePage(1);
    } else {
      setMovementSearch("");
      setMovementType("");
      setMovementPage(1);
    }
  };
  const emptyContent = (
    <div className="hn-inventory-empty">
      {tableEmptyText(
        query.isError ? query.error : null,
        t(isBalance ? "inventory.balance.empty" : "inventory.movement.empty"),
      )}
      {hasFilters && !query.isError ? (
        <ActionButton kind="reset" onClick={resetFilters} />
      ) : null}
    </div>
  );

  return (
    <div className="inventory-page hn-mvp-source-screen hn-inventory">
      <div className="hn-inventory-navigation">
        <UiTabs
          items={inventoryTabItems(t)}
          value={activeTab}
          onChange={setActiveTab}
        />
        <div className="hn-inventory-actions">
          <ActionButton
            kind="refresh"
            className="hn-inventory-refresh"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          />
          {isBalance && canTrace ? (
            <ActionButton
              kind="trace"
              className="hn-inventory-primary"
              onClick={() => setTraceMovementId("__lookup__")}
            >
              {t("inventory.balance.traceCode")}
            </ActionButton>
          ) : null}
        </div>
      </div>

      <UiTabPanel value={activeTab} className="hn-inventory-panel">
        <div
          className={
            isBalance
              ? "hn-inventory-filters"
              : "hn-inventory-filters hn-inventory-filters--movement"
          }
        >
          <div className="hn-inventory-field hn-inventory-search">
            <label htmlFor="inventory-search">
              {t(
                isBalance
                  ? "inventory.balance.searchAria"
                  : "inventory.movement.searchAria",
              )}
            </label>
            <UiTextField
              id="inventory-search"
              fullWidth
              value={isBalance ? searchInput : movementSearch}
              placeholder={t(
                isBalance
                  ? "inventory.balance.searchPlaceholder"
                  : "inventory.movement.searchPlaceholder",
              )}
              slotProps={{
                input: {
                  startAdornment: (
                    <SearchOutlined className="hn-inventory-search-icon" />
                  ),
                },
                htmlInput: {
                  "aria-label": t(
                    isBalance
                      ? "inventory.balance.searchAria"
                      : "inventory.movement.searchAria",
                  ),
                },
              }}
              onChange={(e) => {
                if (isBalance) setSearchInput(e.target.value);
                else {
                  setMovementSearch(e.target.value);
                  setMovementPage(1);
                }
              }}
            />
          </div>
          <div className="hn-inventory-field">
            <label htmlFor="inventory-type">
              {t(
                isBalance
                  ? "inventory.balance.typeFilterAria"
                  : "inventory.movement.colType",
              )}
            </label>
            <UiSelect
              id="inventory-type"
              fullWidth
              menuClassName="hn-inventory-menu"
              value={isBalance ? skuType : movementType}
              aria-label={t(
                isBalance
                  ? "inventory.balance.typeFilterAria"
                  : "inventory.movement.typeFilterAria",
              )}
              placeholder={t(
                isBalance
                  ? "inventory.balance.typeFilterPlaceholder"
                  : "inventory.movement.typeFilterPlaceholder",
              )}
              options={
                isBalance
                  ? [
                      {
                        value: "PRODUCT",
                        label: t("inventory.balance.typeProduct"),
                      },
                      {
                        value: "COMPONENT",
                        label: t("inventory.balance.typeComponent"),
                      },
                    ]
                  : [
                      {
                        value: "RECEIPT",
                        label: t("inventory.movement.typeReceipt"),
                      },
                      {
                        value: "ISSUE",
                        label: t("inventory.movement.typeIssue"),
                      },
                      {
                        value: "COMPONENT_ISSUE",
                        label: t("inventory.movement.typeComponentIssue"),
                      },
                      {
                        value: "REVERSAL",
                        label: t("inventory.movement.typeReversal"),
                      },
                    ]
              }
              onChange={(value) => {
                if (isBalance) {
                  setSkuType(value as "PRODUCT" | "COMPONENT" | "");
                  setBalancePage(1);
                } else {
                  setMovementType(value);
                  setMovementPage(1);
                }
              }}
            />
          </div>
          {isBalance ? (
            <div className="hn-inventory-field">
              <label htmlFor="inventory-status">
                {t("inventory.balance.colStockStatus")}
              </label>
              <UiSelect
                id="inventory-status"
                fullWidth
                menuClassName="hn-inventory-menu"
                value={stockStatus}
                aria-label={t("inventory.balance.statusFilterAria")}
                placeholder={t("inventory.balance.statusFilterPlaceholder")}
                options={[
                  {
                    value: "AVAILABLE",
                    label: t("inventory.balance.statusAvailable"),
                  },
                  {
                    value: "NON_SELLABLE",
                    label: t("inventory.balance.statusNonSellable"),
                  },
                  {
                    value: "DEFECTIVE",
                    label: t("inventory.balance.statusDefective"),
                  },
                  {
                    value: "QUARANTINE",
                    label: t("inventory.balance.statusQuarantine"),
                  },
                ]}
                onChange={(value) => {
                  setStockStatus(value as InventoryStockStatus | "");
                  setBalancePage(1);
                }}
              />
            </div>
          ) : null}
          <ActionButton
            kind="reset"
            disabled={!hasFilters}
            onClick={resetFilters}
            className="hn-inventory-reset"
          />
        </div>

        <section
          className="hn-inventory-data"
          aria-labelledby="inventory-table-title"
        >
          <div className="hn-inventory-data-heading">
            <h2 id="inventory-table-title">
              {t(
                isBalance
                  ? "inventory.tab.balances"
                  : "inventory.tab.movements",
              )}
            </h2>
            <span className="hn-inventory-count" aria-live="polite">
              {t(
                isBalance
                  ? "inventory.balance.total"
                  : "inventory.movement.total",
                {
                  count: formatQuantity(pagination.total),
                },
              )}
            </span>
          </div>
          {query.isError ? (
            <div className="hn-inventory-feedback">
              <ApiErrorAlert
                error={query.error}
                title={t(
                  isBalance
                    ? "inventory.balance.loadError"
                    : "inventory.movement.loadError",
                )}
                onRetry={() => void query.refetch()}
              />
            </div>
          ) : null}
          <TableLoadingBanner loading={query.isLoading || query.isFetching} />
          <div className="hn-inventory-table">
            {isBalance ? (
              <ResponsiveDataTable<InventoryBalanceRow>
                headerCellStyle={{
                  background: "var(--inv-pale)",
                  color: "var(--inv-ink)",
                  fontSize: 12,
                  padding: "10px 9px",
                  borderColor: "var(--inv-line)",
                  borderBottom: "1px solid var(--inv-line)",
                }}
                rowKey={(row) => row.id}
                maxBodyHeight="clamp(280px, 52dvh, 640px)"
                columns={balanceColumns}
                rows={balances}
                loading={balanceQuery.isLoading || balanceQuery.isFetching}
                emptyText={emptyContent}
                onRowClick={(row) => setBalanceDetailRow(row)}
                renderRowActions={(row) => (
                  <RowActionButton
                    kind="view"
                    onClick={(event) => {
                      event.stopPropagation();
                      setBalanceDetailRow(row);
                    }}
                  >
                    {t("inventory.balance.open")}
                  </RowActionButton>
                )}
              />
            ) : (
              <ResponsiveDataTable<StockMovementRow>
                headerCellStyle={{
                  background: "var(--inv-pale)",
                  color: "var(--inv-ink)",
                  fontSize: 12,
                  padding: "10px 9px",
                  borderColor: "var(--inv-line)",
                  borderBottom: "1px solid var(--inv-line)",
                }}
                actionColumnWidth={128}
                rowKey={(row) => row.id}
                maxBodyHeight="clamp(280px, 52dvh, 640px)"
                columns={movementColumns}
                rows={movements}
                loading={movementQuery.isLoading || movementQuery.isFetching}
                emptyText={emptyContent}
                renderRowActions={(row) => (
                  <Tooltip
                    title={t(
                      canTrace
                        ? "inventory.movement.traceTooltip"
                        : "inventory.movement.traceNoPermission",
                    )}
                  >
                    <span>
                      <RowActionButton
                        kind="trace"
                        disabled={!canTrace || !row.id}
                        onClick={() => handleOpenTrace(String(row.id))}
                      >
                        {t("inventory.movement.trace")}
                      </RowActionButton>
                    </span>
                  </Tooltip>
                )}
              />
            )}
          </div>
          <div className="hn-inventory-footer">
            <div className="hn-inventory-page-size">
              <label htmlFor="inventory-page-size">
                {t("inventory.balance.pageSizeAria")}
              </label>
              <UiSelect
                id="inventory-page-size"
                value={perPage}
                aria-label={t("inventory.balance.pageSizeAria")}
                menuClassName="hn-inventory-menu"
                minWidth={76}
                options={pageSizeOptions(perPage).map((size) => ({
                  value: size,
                  label: String(size),
                }))}
                onChange={(value) => {
                  if (isBalance) {
                    setBalancePerPage(Number(value));
                    setBalancePage(1);
                  } else {
                    setMovementPerPage(Number(value));
                    setMovementPage(1);
                  }
                }}
              />
            </div>
            <UiPagination
              page={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              showTotal={false}
              onPageChange={(page) =>
                isBalance ? setBalancePage(page) : setMovementPage(page)
              }
            />
          </div>
        </section>
      </UiTabPanel>
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
