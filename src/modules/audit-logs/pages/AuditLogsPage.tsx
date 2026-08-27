import { useEffect, useState } from "react";
import { Pagination } from "antd";
import {
  MenuItem,
  Select,
  TextField,
  ThemeProvider,
  Typography as MuiTypography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { TableLoadingBanner } from "@/shared/components/feedback/BusinessState";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { exportXlsx } from "@/shared/utils/export-xlsx";
import { formatDateTime } from "@/shared/utils/format-date";
import { AuditLogsTable } from "@/modules/audit-logs/components/AuditLogsTable";
import { AuditLogDetailDrawer } from "@/modules/audit-logs/components/AuditLogDetailDrawer";
import { useAuditLogs } from "@/modules/audit-logs/hooks/use-audit-logs";
import type {
  AuditAction,
  AuditLog,
  AuditModule,
} from "@/modules/audit-logs/types/audit-logs.types";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_MODULE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { ActionButton } from "@/shared/components/actions";

const SEARCH_DEBOUNCE_MS = 250;

/** Toolbar filter nhỏ gọn — cùng chuẩn với WarrantyPage/InventoryPage. */
const TOOLBAR_SX = {
  "&, & .MuiOutlinedInput-root": { height: 35 },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    paddingTop: "8px !important",
    paddingBottom: "8px !important",
    fontSize: "13.5px !important",
    boxSizing: "border-box",
  },
};

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  // Tách cờ mở khỏi bản ghi đang xem: khi đóng chỉ hạ `detailOpen`, giữ nguyên
  // `selectedLog` để Dialog chạy hết hiệu ứng đóng rồi mới rỗng — bỏ bản ghi
  // ngay lúc đóng sẽ khiến modal biến mất "phựt".
  const [detailOpen, setDetailOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">();

  // Bộ lọc tra cứu: mô tả (q), phân hệ, hành động — BE đã hỗ trợ sẵn 3 param
  // này (xem AuditLogFilters/audit-logs.service.ts), chỉ còn thiếu UI (tiêu
  // chí 3: bảng tra cứu/đối soát cần có filter).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [module, setModule] = useState<AuditModule | "">("");
  const [action, setAction] = useState<AuditAction | "">("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching, isError, error, refetch } = useAuditLogs(
    {
      page,
      limit: perPage,
      sort_by: sortBy,
      sort_order: sortOrder,
      q: search || undefined,
      module: module || undefined,
      action: action || undefined,
    },
  );

  const auditLogs = data?.data ?? [];
  const pagination = resolveApiPagination(data?.meta, {
    page,
    pageSize: perPage,
    rowCount: auditLogs.length,
  });

  // Chọn nhiều dòng: chỉ theo dõi các dòng của TRANG hiện tại (xem
  // useRowSelection) — đổi trang/bộ lọc thì "chọn tất cả" tính lại theo trang mới.
  const selection = useRowSelection(auditLogs, (log) => log.id);
  const selectedLogs = auditLogs.filter((log) => selection.isSelected(log.id));

  const exportSelected = () => {
    exportXlsx(
      [
        "Thời gian",
        "Hành động",
        "Phân hệ",
        "Đối tượng",
        "Mã đối tượng",
        "Người thực hiện",
        "Địa chỉ IP",
        "Kết quả",
        "Mô tả",
      ],
      selectedLogs.map((log) => [
        formatDateTime(log.created_at),
        businessLabel(AUDIT_ACTION_LABELS, log.action, log.action),
        AUDIT_MODULE_LABELS[log.module] || log.module,
        log.object_type,
        log.object_id ?? "",
        log.actor?.email || log.actor?.display_name || "Hệ thống",
        log.ip_address ?? "",
        log.result ?? "",
        log.description,
      ]),
      `nhat-ky-he-thong-trang-${pagination.current}`,
    );
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="audit-logs-page hn-mvp-source-screen">
        <div className="toolbar">
          <TextField
            value={searchInput}
            placeholder="Tìm theo mô tả, đối tượng..."
            slotProps={{
              htmlInput: { "aria-label": "Tìm nhật ký hệ thống" },
            }}
            onChange={(event) => setSearchInput(event.target.value)}
            sx={{ minWidth: 260, ...TOOLBAR_SX }}
          />
          <Select
            displayEmpty
            value={module}
            inputProps={{ "aria-label": "Lọc phân hệ" }}
            onChange={(event) => {
              setModule(event.target.value as AuditModule | "");
              setPage(1);
            }}
            sx={{ minWidth: 190, ...TOOLBAR_SX }}
          >
            <MenuItem value="">Phân hệ: Tất cả</MenuItem>
            {Object.entries(AUDIT_MODULE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
          <Select
            displayEmpty
            value={action}
            inputProps={{ "aria-label": "Lọc hành động" }}
            onChange={(event) => {
              setAction(event.target.value as AuditAction | "");
              setPage(1);
            }}
            sx={{ minWidth: 200, ...TOOLBAR_SX }}
          >
            <MenuItem value="">Hành động: Tất cả</MenuItem>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
          <Select
            value={perPage}
            inputProps={{ "aria-label": "Số dòng mỗi trang" }}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
            sx={{ minWidth: 100, ...TOOLBAR_SX }}
          >
            {perPageOptions.map((size) => (
              <MenuItem key={size} value={size}>
                {size} / trang
              </MenuItem>
            ))}
          </Select>
          {/* Tổng số dòng đặt ngay trong toolbar (cạnh bộ lọc/số dòng mỗi trang)
           * để dễ thấy — thay vì chỉ hiện ở phần phân trang tít dưới bảng dài. */}
          <MuiTypography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
          >
            Tổng {pagination.total} bản ghi
          </MuiTypography>
          <div className="spacer" />
          {selection.selectedCount > 0 ? (
            <>
              <MuiTypography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: "nowrap" }}
              >
                Đã chọn {selection.selectedCount}
              </MuiTypography>
              <ActionButton kind="clear" onClick={selection.clear}>
                Bỏ chọn
              </ActionButton>
              <ActionButton kind="exportExcel" onClick={exportSelected}>
                Xuất Excel ({selection.selectedCount})
              </ActionButton>
            </>
          ) : null}
        </div>

        {isError ? (
          <div style={{ marginBottom: 14 }}>
            <ApiErrorAlert
              error={error}
              title="Không tải được nhật ký hệ thống"
              onRetry={refetch}
            />
          </div>
        ) : null}

        <TableLoadingBanner loading={isLoading || isFetching} />
        <AuditLogsTable
          data={auditLogs}
          loading={isLoading || isFetching}
          error={isError ? error : null}
          page={pagination.current}
          perPage={perPage}
          selection={selection}
          onSortChange={(field, order) => {
            setSortBy(field);
            setSortOrder(order);
            setPage(1);
          }}
          onView={(log) => {
            setSelectedLog(log);
            setDetailOpen(true);
          }}
        />
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}
        >
          <Pagination
            current={pagination.current}
            pageSize={perPage}
            total={pagination.total}
            showSizeChanger={false}
            onChange={(nextPage) => setPage(nextPage)}
          />
        </div>

        <AuditLogDetailDrawer
          open={detailOpen}
          auditLog={selectedLog}
          onClose={() => setDetailOpen(false)}
        />
      </div>
    </ThemeProvider>
  );
}
