import { useEffect, useState } from "react";
import {
  Box,
  UiPagination,
  UiSelect,
  UiTextField,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui";
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
import { useIamUsers } from "@/modules/iam/hooks/use-iam";
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

/** Chữ phụ trên toolbar (thay MUI Typography body2 color text.secondary). */
const TOOLBAR_TEXT_SX = {
  fontSize: TYPOGRAPHY.fontSizeSecondary,
  color: S.textMedium,
  whiteSpace: "nowrap",
} as const;

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
  // Lọc theo khoảng thời gian / khung giờ (mục 13). Giá trị từ input
  // datetime-local có dạng "YYYY-MM-DDTHH:mm"; BE nhận "Y-m-d H:i:s".
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userId, setUserId] = useState("");

  // Danh bạ người dùng để lọc "ai đã thao tác". Best-effort: nếu tài khoản
  // không có quyền xem người dùng thì query lỗi và dropdown chỉ rỗng, phần
  // còn lại của trang vẫn chạy bình thường.
  const usersQuery = useIamUsers({ per_page: 200 });
  const userOptions = (usersQuery.data?.data ?? []).map((user) => ({
    value: user.user_id,
    label: user.email
      ? `${user.display_name} (${user.email})`
      : user.display_name,
  }));

  const toApiDateTime = (value: string) =>
    value ? `${value.replace("T", " ")}:00` : undefined;

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
      user_id: userId || undefined,
      date_from: toApiDateTime(dateFrom),
      date_to: toApiDateTime(dateTo),
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
    <div className="audit-logs-page hn-mvp-source-screen">
      <div className="toolbar">
        <UiTextField
          value={searchInput}
          placeholder="Tìm theo mô tả, đối tượng..."
          slotProps={{
            htmlInput: { "aria-label": "Tìm nhật ký hệ thống" },
          }}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ minWidth: 260 }}
        />
        <UiSelect
          value={module}
          aria-label="Lọc phân hệ"
          placeholder="Phân hệ: Tất cả"
          minWidth={190}
          onChange={(value) => {
            setModule(value as AuditModule | "");
            setPage(1);
          }}
          options={Object.entries(AUDIT_MODULE_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
        <UiSelect
          value={action}
          aria-label="Lọc hành động"
          placeholder="Hành động: Tất cả"
          minWidth={200}
          onChange={(value) => {
            setAction(value as AuditAction | "");
            setPage(1);
          }}
          options={Object.entries(AUDIT_ACTION_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
        <UiSelect
          value={userId}
          aria-label="Lọc theo người thực hiện"
          placeholder="Người dùng: Tất cả"
          minWidth={220}
          onChange={(value) => {
            setUserId(String(value));
            setPage(1);
          }}
          options={userOptions}
        />
        <UiTextField
          type="datetime-local"
          value={dateFrom}
          label="Từ thời điểm"
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { "aria-label": "Lọc từ thời điểm" },
          }}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 210 }}
        />
        <UiTextField
          type="datetime-local"
          value={dateTo}
          label="Đến thời điểm"
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { "aria-label": "Lọc đến thời điểm" },
          }}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 210 }}
        />
        <UiSelect
          value={perPage}
          aria-label="Số dòng mỗi trang"
          minWidth={100}
          onChange={(value) => {
            setPerPage(Number(value));
            setPage(1);
          }}
          options={perPageOptions.map((size) => ({
            value: size,
            label: `${size} / trang`,
          }))}
        />
        {/* Tổng số dòng đặt ngay trong toolbar (cạnh bộ lọc/số dòng mỗi trang)
         * để dễ thấy — thay vì chỉ hiện ở phần phân trang tít dưới bảng dài. */}
        <Box component="span" sx={TOOLBAR_TEXT_SX}>
          Tổng {pagination.total} bản ghi
        </Box>
        <div className="spacer" />
        {selection.selectedCount > 0 ? (
          <>
            <Box component="span" sx={TOOLBAR_TEXT_SX}>
              Đã chọn {selection.selectedCount}
            </Box>
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
        <Box sx={{ mb: "14px" }}>
          <ApiErrorAlert
            error={error}
            title="Không tải được nhật ký hệ thống"
            onRetry={refetch}
          />
        </Box>
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
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
        {/* showTotal tắt: "Tổng ... bản ghi" đã hiển thị trên toolbar. */}
        <UiPagination
          page={pagination.current}
          pageSize={perPage}
          total={pagination.total}
          onPageChange={(nextPage) => setPage(nextPage)}
          showTotal={false}
        />
      </Box>

      <AuditLogDetailDrawer
        open={detailOpen}
        auditLog={selectedLog}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
