import { useT } from "@/shared/i18n/useT";
import { useEffect, useState } from "react";
import type { Dayjs } from "dayjs";
import { pastDateBounds } from "@/shared/validation/date-rules";
import {
  Box,
  UiPagination,
  UiSelect,
  UiTextField,
  UiVuexyDateRangePicker,
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
} from "@/shared/constants/business-labels";
import {
  auditActionLabel,
  auditObjectCode,
  auditObjectTypeLabel,
  auditResultLabel,
  describeAuditLog,
} from "@/modules/audit-logs/constants/audit-log-labels";
import { ActionButton } from "@/shared/components/actions";
import "@/shared/ui/sku-aligned-settings.css";
import "./audit-logs.css";

const SEARCH_DEBOUNCE_MS = 250;

/** Định dạng BE nhận cho `date_from`/`date_to` (`Y-m-d H:i:s`). */
const API_DATE_TIME = "YYYY-MM-DD HH:mm:ss";

/** Chữ phụ trên toolbar (thay MUI Typography body2 color text.secondary). */
const TOOLBAR_TEXT_SX = {
  fontSize: 12,
  color: "var(--settings-muted)",
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
  // Lọc theo khoảng ngày (mục 13) — cùng một control lịch với các màn báo cáo
  // (UiVuexyDateRangePicker) thay cho 2 ô `datetime-local` của trình duyệt:
  // lịch chọn theo NGÀY, nên khoảng gửi lên BE là trọn ngày (00:00:00 →
  // 23:59:59). Bản thân control đã chặn "đến" < "từ" và ngày ngoài mốc cho
  // phép, không cần lớp kiểm tra riêng ở màn nữa.
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [userId, setUserId] = useState("");
  // Nhật ký là dữ liệu ĐÃ XẢY RA: chặn ngày tương lai ngay trên lịch (cùng
  // luật với bộ lọc kỳ của báo cáo).
  const maxSelectableDate = pastDateBounds().maxDate;

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

  // Trọn ngày: "từ" lấy 00:00:00, "đến" lấy 23:59:59 — chọn cùng một ngày ở
  // hai đầu vẫn ra đủ bản ghi của ngày đó.
  const dateFromParam = range?.[0]?.startOf("day").format(API_DATE_TIME);
  const dateToParam = range?.[1]?.endOf("day").format(API_DATE_TIME);

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
      date_from: dateFromParam,
      date_to: dateToParam,
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
      // File Excel là bản in ra cho người đọc: dùng đúng nhãn/câu chữ đang
      // hiện trên bảng, không xuất enum thô của BE.
      selectedLogs.map((log) => [
        formatDateTime(log.created_at),
        auditActionLabel(log.action),
        AUDIT_MODULE_LABELS[log.module] || log.module,
        auditObjectTypeLabel(log.object_type),
        // Cột "Mã đối tượng": số phiếu / mã hồ sơ / serial do BE tra ngược. Chỉ
        // loại đối tượng không có mã mới giữ định danh nội bộ để quản trị còn
        // tra soát được trong file.
        auditObjectCode(log) ?? log.object_id ?? "",
        log.actor?.email || log.actor?.display_name || t("audit.system"),
        log.ip_address ?? "",
        auditResultLabel(log.result),
        describeAuditLog(log),
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
    <div className="audit-logs-page hn-mvp-source-screen hn-settings-screen hn-audit-settings">
      <div className="hn-settings-card hn-audit-filters">
        <div className="hn-audit-filter hn-audit-filter-search">
          <label htmlFor="audit-log-search">{t("audit.searchAria")}</label>
          <UiTextField
            id="audit-log-search"
            fullWidth
            value={searchInput}
            placeholder={t("audit.searchPlaceholder")}
            slotProps={{
              htmlInput: { "aria-label": t("audit.searchAria") },
            }}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className="hn-audit-filter">
          <label htmlFor="audit-log-module">{t("audit.colModule")}</label>
          <UiSelect
            id="audit-log-module"
            fullWidth
            menuClassName="hn-settings-menu"
            value={module}
            aria-label={t("audit.moduleFilterAria")}
            placeholder={t("audit.moduleFilterPlaceholder")}
            onChange={(value) => {
              setModule(value as AuditModule | "");
              setPage(1);
            }}
            options={Object.entries(AUDIT_MODULE_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
          />
        </div>
        <div className="hn-audit-filter">
          <label htmlFor="audit-log-action">{t("audit.colAction")}</label>
          <UiSelect
            id="audit-log-action"
            fullWidth
            menuClassName="hn-settings-menu"
            value={action}
            aria-label={t("audit.actionFilterAria")}
            placeholder={t("audit.actionFilterPlaceholder")}
            onChange={(value) => {
              setAction(value as AuditAction | "");
              setPage(1);
            }}
            options={Object.entries(AUDIT_ACTION_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
          />
        </div>
        <div className="hn-audit-filter">
          <span className="hn-audit-filter-label">{t("audit.colActor")}</span>
          <UiSelect
            fullWidth
            menuClassName="hn-settings-menu"
            value={userId}
            aria-label={t("audit.actorFilterAria")}
            placeholder={t("audit.actorFilterPlaceholder")}
            onChange={(value) => {
              setUserId(String(value));
              setPage(1);
            }}
            options={userOptions}
          />
        </div>
        {/* Lịch "Từ ngày / Đến ngày" của dự án (cùng control với bộ lọc kỳ ở
          các màn báo cáo) — thay 2 ô `datetime-local` mà mỗi trình duyệt vẽ
          một kiểu, tiếng Anh và định dạng dd/mm/yyyy --:-- khó đọc. */}
        <div className="hn-audit-filter hn-audit-filter-range">
          <span className="hn-audit-filter-label">{t("audit.rangeAria")}</span>
          <UiVuexyDateRangePicker
            popupClassName="hn-settings-menu"
            value={range}
            aria-label={t("audit.rangeAria")}
            maxDate={maxSelectableDate}
            onChange={(next) => {
              setRange(next);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="hn-settings-card hn-audit-list-card">
        <div className="hn-audit-list-tools">
          <div className="hn-audit-page-size">
            <label htmlFor="audit-log-page-size">
              {t("audit.pageSizeAria")}
            </label>
            <UiSelect
              id="audit-log-page-size"
              menuClassName="hn-settings-menu"
              value={perPage}
              aria-label={t("audit.pageSizeAria")}
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
          </div>
          {/* Tổng số dòng đặt ngay trong toolbar (cạnh bộ lọc/số dòng mỗi trang)
           * để dễ thấy — thay vì chỉ hiện ở phần phân trang tít dưới bảng dài. */}
          <Box component="span" sx={TOOLBAR_TEXT_SX}>
            {t("audit.total", { count: pagination.total })}
          </Box>
          <div className="hn-audit-selection-actions">
            {selection.selectedCount > 0 ? (
              <>
                <Box component="span" sx={TOOLBAR_TEXT_SX}>
                  {t("audit.selected", { count: selection.selectedCount })}
                </Box>
                <ActionButton
                  className="hn-settings-secondary"
                  kind="clear"
                  onClick={selection.clear}
                >
                  {t("audit.clearSelection")}
                </ActionButton>
                <ActionButton
                  className="hn-settings-primary"
                  kind="exportExcel"
                  onClick={exportSelected}
                >
                  {t("audit.exportExcel", { count: selection.selectedCount })}
                </ActionButton>
              </>
            ) : null}
          </div>
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
        <div className="hn-audit-table">
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
        </div>
        <div className="hn-audit-pagination">
          {/* showTotal tắt: "Tổng ... bản ghi" đã hiển thị trên toolbar. */}
          <UiPagination
            page={pagination.current}
            pageSize={perPage}
            total={pagination.total}
            onPageChange={(nextPage) => setPage(nextPage)}
            showTotal={false}
          />
        </div>
      </div>

      <AuditLogDetailDrawer
        open={detailOpen}
        auditLog={selectedLog}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
