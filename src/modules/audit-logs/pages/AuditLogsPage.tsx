import { toast } from "sonner";
import { CloseCircleOutlined, FilterOutlined } from "@/shared/components/icons";
import { useT } from "@/shared/i18n/useT";
import { useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";
import { pastDateBounds } from "@/shared/validation/date-rules";
import {
  Box,
  UiPagination,
  UiSelect,
  UiAutocomplete,
  UiTextField,
  InputAdornment,
  UiIcon,
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
import { dateFilterBoundary } from "@/shared/utils/date-time";
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

/** Chữ phụ trên toolbar — cùng cỡ 14px với chữ trên nút để một hàng đồng đều. */
const TOOLBAR_TEXT_SX = {
  fontSize: 14,
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const [actorSearch, setActorSearch] = useState("");
  const [actorKeyword, setActorKeyword] = useState("");
  const [selectedActor, setSelectedActor] = useState<{
    value: string;
    label: string;
  } | null>(null);
  // Nhật ký là dữ liệu ĐÃ XẢY RA: chặn ngày tương lai ngay trên lịch (cùng
  // luật với bộ lọc kỳ của báo cáo).
  const maxSelectableDate = pastDateBounds().maxDate;

  // Danh bạ người dùng để lọc "ai đã thao tác". Best-effort: nếu tài khoản
  // không có quyền xem người dùng thì query lỗi và dropdown chỉ rỗng, phần
  // còn lại của trang vẫn chạy bình thường.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setActorKeyword(actorSearch.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [actorSearch]);
  const usersQuery = useIamUsers({
    keyword: actorKeyword || undefined,
    page: 1,
    per_page: 20,
  });
  const actorResults = (usersQuery.data?.data ?? []).map((user) => ({
    value: user.user_id,
    label: user.email
      ? `${user.display_name} (${user.email})`
      : user.display_name,
  }));
  const userOptions =
    selectedActor &&
    !actorResults.some((option) => option.value === selectedActor.value)
      ? [selectedActor, ...actorResults]
      : actorResults;
  const hasMoreActors =
    Number(usersQuery.data?.meta?.total) > actorResults.length;

  // Calendar dates are in the account zone; never let the DB session infer it.
  const dateFromParam = range?.[0]
    ? dateFilterBoundary(range[0].format("YYYY-MM-DD"), false)
    : undefined;
  const dateToParam = range?.[1]
    ? dateFilterBoundary(range[1].format("YYYY-MM-DD"), true)
    : undefined;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Người dùng gõ "Cập nhật" (nhãn VI) hoặc "update" (mã) — gom mọi hành động có
  // mã hoặc nhãn (ngôn ngữ hiện tại) chứa từ khóa để BE OR-thêm vào điều kiện
  // tìm kiếm (param actions[]), nhờ vậy ô tìm kiếm khớp đúng "hành động".
  const matchedActionCodes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return undefined;
    const codes = Object.entries(AUDIT_ACTION_LABELS)
      .filter(
        ([code, label]) =>
          code.toLowerCase().includes(keyword) ||
          String(label).toLowerCase().includes(keyword),
      )
      .map(([code]) => code);
    return codes.length ? codes : undefined;
  }, [search]);

  const { data, isLoading, isError, error, refetch } = useAuditLogs({
    page,
    limit: perPage,
    sort_by: sortBy,
    sort_order: sortOrder,
    q: search || undefined,
    actions: matchedActionCodes,
    module: module || undefined,
    action: action || undefined,
    user_id: userId || undefined,
    date_from: dateFromParam,
    date_to: dateToParam,
  });

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

  const exportSelected = async () => {
    try {
      await exportXlsx(
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
    } catch {
      toast.error(t("reportExport.failed"));
    }
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  const hasFilters = Boolean(
    searchInput ||
    module ||
    action ||
    userId ||
    actorSearch ||
    range?.[0] ||
    range?.[1],
  );
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setModule("");
    setAction("");
    setUserId("");
    setSelectedActor(null);
    setActorSearch("");
    setRange(null);
    setPage(1);
    selection.clear();
  };

  return (
    <div className="audit-logs-page hn-mvp-source-screen hn-settings-screen hn-audit-settings">
      <header className="hn-audit-page-header">
        <div>
          <div className="hn-audit-title-line">
            <h1>{t("audit.pageTitle")}</h1>
          </div>
          <p>{t("audit.pageDescription")}</p>
        </div>
        <div className="hn-audit-export">
          <ActionButton
            kind="exportExcel"
            appearance="flat"
            disabled={!selection.selectedCount}
            title={t("audit.exportHint")}
            onClick={exportSelected}
          >
            {t("audit.exportExcel", { count: selection.selectedCount })}
          </ActionButton>
          <span>{t("audit.exportHint")}</span>
        </div>
      </header>
      <div
        className="hn-audit-filters"
        role="search"
        aria-label={t("audit.pageTitle")}
      >
        <div className="hn-audit-filter hn-audit-filter-search">
          <UiTextField
            id="audit-log-search"
            fullWidth
            value={searchInput}
            placeholder={t("audit.searchPlaceholder")}
            slotProps={{
              htmlInput: {
                "aria-label": t("audit.searchAria"),
                title: t("audit.searchHint"),
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <UiIcon name="search" size="sm" />
                  </InputAdornment>
                ),
              },
            }}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className="hn-audit-filter hn-audit-filter-range">
          <UiVuexyDateRangePicker
            popupClassName="hn-settings-menu"
            showFieldPrefixes={false}
            allowClear={false}
            value={range}
            aria-label={t("audit.rangeAria")}
            maxDate={maxSelectableDate}
            onChange={(next) => {
              setRange(next);
              setPage(1);
            }}
          />
        </div>
        <div className="hn-audit-filter">
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
        <button
          type="button"
          className="hn-audit-more-filters"
          aria-expanded={filtersOpen}
          aria-controls="hn-audit-extra-filters"
          onClick={() => setFiltersOpen((current) => !current)}
        >
          <FilterOutlined aria-hidden="true" />
          {t("inbound.list.filterButton")}
        </button>
        {hasFilters ? (
          <ActionButton kind="clear" appearance="flat" onClick={clearFilters}>
            {t("audit.filterReset")}
          </ActionButton>
        ) : null}
        <div
          id="hn-audit-extra-filters"
          className="hn-audit-extra-filters"
          hidden={!filtersOpen}
        >
          <div className="hn-audit-filter">
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
            <UiAutocomplete
              fullWidth
              menuClassName="hn-settings-menu"
              value={userId || null}
              aria-label={t("audit.actorFilterAria")}
              placeholder={t("audit.actorFilterPlaceholder")}
              filterMode="server"
              onInputChange={setActorSearch}
              loading={usersQuery.isFetching}
              error={usersQuery.isError}
              helperText={
                usersQuery.isError
                  ? t("iam.user.errLoadUsers")
                  : hasMoreActors
                    ? t("iam.effectiveUi.userSearchPartial")
                    : undefined
              }
              onChange={(value) => {
                const id = value == null ? "" : String(value);
                setUserId(id);
                if (!id) setActorSearch("");
                setSelectedActor(
                  userOptions.find((option) => option.value === id) ?? null,
                );
                setPage(1);
              }}
              options={userOptions}
            />
          </div>
        </div>
      </div>
      <div className="hn-audit-list-card">
        {selection.selectedCount > 0 ? (
          <div className="hn-audit-list-tools">
            <Box component="span" sx={TOOLBAR_TEXT_SX}>
              {t("audit.selected", { count: selection.selectedCount })}
            </Box>
            <ActionButton
              kind="clear"
              appearance="flat"
              icon={
                <CloseCircleOutlined
                  style={{ color: "var(--wms-error-text)" }}
                />
              }
              sx={{
                color: "var(--wms-error-text)",
                "&:hover:not(.Mui-disabled)": {
                  color: "var(--wms-error-text)",
                },
              }}
              onClick={selection.clear}
            >
              {t("audit.clearSelection")}
            </ActionButton>
          </div>
        ) : null}
        {isError ? (
          <ApiErrorAlert
            error={error}
            title={t("audit.loadError")}
            onRetry={refetch}
          />
        ) : null}
        <TableLoadingBanner loading={isLoading} />
        <div className="hn-audit-table">
          <AuditLogsTable
            data={auditLogs}
            loading={isLoading}
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
          <div className="hn-audit-page-size">
            <Box component="span" sx={TOOLBAR_TEXT_SX}>
              {t("audit.total", { count: pagination.total })}
            </Box>
            <UiSelect
              kind="page-size"
              id="audit-log-page-size"
              menuClassName="hn-settings-menu"
              value={perPage}
              aria-label={t("audit.pageSizeAria")}
              minWidth={110}
              onChange={(value) => {
                setPerPage(Number(value));
                setPage(1);
              }}
              options={perPageOptions.map((size) => ({
                value: size,
                label: t("shared.table.perPage", { size }),
              }))}
            />
          </div>
          <UiPagination
            page={pagination.current}
            pageSize={perPage}
            total={pagination.total}
            onPageChange={setPage}
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
