import { useT } from "@/shared/i18n/useT";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  checkDateRange,
  dateTimeInputBounds,
  pastDateBounds,
} from "@/shared/validation/date-rules";
import {
  Box,
  UiPagination,
  UiSelect,
  UiTextField,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
  FILTER_WIDTH,
  TOOLBAR_SEARCH_SX,
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
const LOCAL_DATETIME = "YYYY-MM-DDTHH:mm";

/**
 * Parse giá trị datetime-local NGHIÊM NGẶT: dayjs tự "cuộn" tháng/ngày sai
 * thành ngày hợp lệ kế tiếp, nên đối chiếu lại chuỗi sau khi format; sai thì
 * trả Dayjs invalid để checkDate báo "không hợp lệ". Rỗng → null (không lọc).
 */
function parseLocalDateTime(raw: string): dayjs.Dayjs | null {
  if (!raw) return null;
  const parsed = dayjs(raw);
  return parsed.isValid() && parsed.format(LOCAL_DATETIME) === raw
    ? parsed
    : dayjs("");
}

/** Chữ phụ trên toolbar (thay MUI Typography body2 color text.secondary). */
const TOOLBAR_TEXT_SX = {
  fontSize: TYPOGRAPHY.fontSizeSecondary,
  color: S.textMedium,
  whiteSpace: "nowrap",
} as const;

export function AuditLogsPage() {
  const t = useT();
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
  // Khoảng thời gian ĐÃ hợp lệ gần nhất — query chỉ dùng cặp này, nên gõ dở
  // "đến" < "từ" hay năm 9999 không bao giờ bắn lên API; ô vẫn giữ giá trị
  // đang gõ để người dùng sửa.
  const [appliedRange, setAppliedRange] = useState({ from: "", to: "" });
  const [userId, setUserId] = useState("");
  const dateRangeCheck = checkDateRange(
    parseLocalDateTime(dateFrom),
    parseLocalDateTime(dateTo),
    pastDateBounds(),
  );
  const dateError = dateRangeCheck.ok ? null : dateRangeCheck.message;
  const dateTimeBounds = dateTimeInputBounds(pastDateBounds());
  const applyDateRange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
    const check = checkDateRange(
      parseLocalDateTime(from),
      parseLocalDateTime(to),
      pastDateBounds(),
    );
    if (check.ok) setAppliedRange({ from, to });
  };

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
      date_from: toApiDateTime(appliedRange.from),
      date_to: toApiDateTime(appliedRange.to),
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
        t("audit.colTime"),
        t("audit.colAction"),
        t("audit.colModule"),
        t("audit.colObject"),
        t("audit.colObjectId"),
        t("audit.colActor"),
        t("audit.colIp"),
        t("audit.colResult"),
        t("audit.colDescription"),
      ],
      selectedLogs.map((log) => [
        formatDateTime(log.created_at),
        businessLabel(AUDIT_ACTION_LABELS, log.action, log.action),
        AUDIT_MODULE_LABELS[log.module] || log.module,
        log.object_type,
        log.object_id ?? "",
        log.actor?.email || log.actor?.display_name || t("audit.system"),
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
          placeholder={t("audit.searchPlaceholder")}
          slotProps={{
            htmlInput: { "aria-label": t("audit.searchAria") },
          }}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={TOOLBAR_SEARCH_SX}
        />
        <UiSelect
          value={module}
          aria-label={t("audit.moduleFilterAria")}
          placeholder={t("audit.moduleFilterPlaceholder")}
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
          aria-label={t("audit.actionFilterAria")}
          placeholder={t("audit.actionFilterPlaceholder")}
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
          aria-label={t("audit.actorFilterAria")}
          placeholder={t("audit.actorFilterPlaceholder")}
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
          label={t("audit.fromLabel")}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              "aria-label": t("audit.fromAria"),
              "aria-invalid": Boolean(dateError),
              ...dateTimeBounds,
            },
          }}
          onChange={(event) => applyDateRange(event.target.value, dateTo)}
          error={Boolean(dateError)}
          helperText={dateError ?? undefined}
          sx={{ minWidth: 210 }}
        />
        <UiTextField
          type="datetime-local"
          value={dateTo}
          label={t("audit.toLabel")}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              "aria-label": t("audit.toAria"),
              "aria-invalid": Boolean(dateError),
              ...dateTimeBounds,
            },
          }}
          onChange={(event) => applyDateRange(dateFrom, event.target.value)}
          error={Boolean(dateError)}
          sx={{ minWidth: 210 }}
        />
        <UiSelect
          value={perPage}
          aria-label={t("audit.pageSizeAria")}
          minWidth={FILTER_WIDTH.pageSize}
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
          {t("audit.total", { count: pagination.total })}
        </Box>
        <div className="spacer" />
        {selection.selectedCount > 0 ? (
          <>
            <Box component="span" sx={TOOLBAR_TEXT_SX}>
              {t("audit.selected", { count: selection.selectedCount })}
            </Box>
            <ActionButton kind="clear" onClick={selection.clear}>
              {t("audit.clearSelection")}
            </ActionButton>
            <ActionButton kind="exportExcel" onClick={exportSelected}>
              {t("audit.exportExcel", { count: selection.selectedCount })}
            </ActionButton>
          </>
        ) : null}
      </div>

      {isError ? (
        <Box sx={{ mb: "14px" }}>
          <ApiErrorAlert
            error={error}
            title={t("audit.loadError")}
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
