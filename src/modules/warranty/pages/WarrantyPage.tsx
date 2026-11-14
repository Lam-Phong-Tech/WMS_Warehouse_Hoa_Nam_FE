/* eslint-disable react-hooks/set-state-in-effect */
import { rowIndexOfBy } from "@/shared/components/data-display/row-index";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Box,
  Stack,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiText,
  type UiStatusTone,
  FILTER_WIDTH,
} from "@/shared/ui";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { type ResponsiveTableColumn } from "@/shared/components/data-display/ResponsiveDataTable";
import { FilterOutlined, ToolOutlined } from "@/shared/components/icons";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { useHasPermission } from "@/shared/components/permission";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import {
  WARRANTY_BASELINE_STATUSES,
  WARRANTY_IDENTIFICATION_STATUS_SHORT_LABELS,
  WARRANTY_IDENTIFICATION_TYPES,
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  formatWarrantyDateTime,
  warrantyPiiText,
} from "@/modules/warranty/constants";
import { businessLabel } from "@/shared/constants/business-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import {
  useWarrantyCases,
  warrantyKeys,
} from "@/modules/warranty/hooks/use-warranty";
import { ComponentIssueModal } from "@/modules/warranty/components/ComponentIssueModal";
import { WarrantyDetailModal } from "@/modules/warranty/components/WarrantyDetailModal";
import { WarrantyIntakeModal } from "@/modules/warranty/components/WarrantyIntakeModal";
import type {
  WarrantyCase,
  WarrantyCaseStatus,
  WarrantyIdentificationType,
} from "@/modules/warranty/types";
import { ActionButton, RowActionButton } from "@/shared/components/actions";

import { WarrantyListTable } from "@/modules/warranty/components/WarrantyListTable";
import "./warranty-list.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

const SEARCH_DEBOUNCE_MS = 250;
const DETAIL_SCREENS = new Set(["WAR-03"]);
type WarrantySortMode =
  | "newest"
  | "oldest"
  | "defect-asc"
  | "defect-desc"
  | "identification-asc"
  | "identification-desc";

/** antd Tag color (WARRANTY_STATUS_COLORS) → tone soft-tint của UiStatusBadge. */
const TAG_TONE_MAP: Record<string, UiStatusTone> = {
  green: "success",
  success: "success",
  red: "error",
  error: "error",
  volcano: "error",
  orange: "warning",
  gold: "warning",
  warning: "warning",
  blue: "info",
  processing: "info",
  geekblue: "info",
  cyan: "info",
  purple: "primary",
};

const statusTone = (color?: string): UiStatusTone =>
  TAG_TONE_MAP[color ?? ""] ?? "neutral";

interface ComponentIssueTarget {
  caseId: string;
  caseCode?: string;
  caseActive: boolean;
  documentId?: string | null;
}

/**
 * WAR-01 · Danh sách bảo hành — màn hub của luồng 04 · Bảo hành & linh kiện.
 * Tiếp nhận (WAR-02) và Chi tiết (WAR-03) mở trong panel bên phải;
 * Xuất linh kiện (COMP-01) mở ngay trên danh sách, không chuyển trang.
 */
export default function WarrantyPage() {
  const t = useT();
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const overdueRequested = searchParams.get("overdue") === "1";

  const searchRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState<WarrantyCaseStatus | "">("");
  const [identification, setIdentification] = useState<
    WarrantyIdentificationType | ""
  >("");
  const [defectId, setDefectId] = useState("");
  const [sortMode, setSortMode] = useState<WarrantySortMode>("newest");
  const [overdueOnly, setOverdueOnly] = useState(overdueRequested);
  const [filtersOpen, setFiltersOpen] = useState(overdueRequested);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [componentTarget, setComponentTarget] =
    useState<ComponentIssueTarget | null>(null);

  const canManage = can("warranty.manage");
  const canViewPii = can("warranty.pii.view");
  const searchPlaceholder = t(
    canViewPii
      ? "warranty.list.searchPlaceholder"
      : "warranty.list.searchPlaceholderNoPii",
  );

  const listQuery = useWarrantyCases({
    search: search || undefined,
    status: status || undefined,
    identification_status: identification || undefined,
    defect_id: defectId || undefined,
    page,
    per_page: perPage,
    sort_order: sortMode === "oldest" ? "asc" : "desc",
    overdue: overdueOnly || undefined,
  });
  const defectsQuery = useMvpDefects(
    { status: "ACTIVE", per_page: 100 },
    { all: true },
  );

  const rows = listQuery.data?.data ?? [];
  const pagination = resolveApiPagination(listQuery.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });
  const hasFilters = Boolean(
    searchInput ||
    status ||
    identification ||
    defectId ||
    overdueOnly ||
    sortMode !== "newest",
  );
  const listSort = sortMode.startsWith("defect-")
    ? {
        key: "defect" as const,
        direction: sortMode.endsWith("-asc")
          ? ("asc" as const)
          : ("desc" as const),
      }
    : sortMode.startsWith("identification-")
      ? {
          key: "identification_type" as const,
          direction: sortMode.endsWith("-asc")
            ? ("asc" as const)
            : ("desc" as const),
        }
      : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!overdueRequested) return;
    setOverdueOnly(true);
    setFiltersOpen(true);
    setSearchInput("");
    setSearch("");
    setStatus("");
    setIdentification("");
    setDefectId("");
    setSortMode("newest");
    setPage(1);
  }, [overdueRequested, location.key]);

  const clearOverdueLink = () => {
    if (!searchParams.has("overdue")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("overdue");
    setSearchParams(next, { replace: true });
  };

  // Deep-link các màn wireframe: ?screen=WAR-02 mở tiếp nhận, ?screen=WAR-03&id=...
  // mở chi tiết, ?screen=COMP-01&id=<caseId> mở xuất linh kiện. URL trở về WAR-01.
  useEffect(() => {
    const screen = searchParams.get("screen");
    if (!screen || screen === "WAR-01") return;
    if (screen === "WAR-02") {
      setIntakeOpen(true);
    } else if (DETAIL_SCREENS.has(screen)) {
      const id = searchParams.get("id");
      if (id) setDetailId(id);
    } else if (screen === "COMP-01") {
      const id = searchParams.get("id");
      if (id) {
        setComponentTarget({ caseId: id, caseActive: true, documentId: null });
      } else {
        toast.info(t("warranty.list.pickCaseFirst"));
      }
    } else {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "WAR-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, t]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
  };

  const columns: ResponsiveTableColumn<WarrantyCase>[] = [
    {
      key: "stt",
      header: "#",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(
          page,
          perPage,
          rowIndexOfBy(rows, row, (item) => item.id),
        ),
    },
    {
      key: "case_code",
      header: t("warranty.list.colCase"),
      width: 190,
      sortAccessor: (row) => row.case_code || "",
      // KHÔNG fallback sang row.id: cột này là MÃ PHIẾU bảo hành đọc được.
      render: (row) => row.case_code || EMPTY_TEXT,
    },
    {
      key: "customer",
      header: t("warranty.list.colCustomer"),
      width: 190,
      sortAccessor: (row) => row.customer_name || "",
      render: (row) => (
        <Stack spacing={0}>
          {/* §13.8: mask lại ở tầng render — không tin payload đã mask sẵn. */}
          <UiText variant="body">
            {warrantyPiiText(row.customer_name, canViewPii, "name") ||
              EMPTY_TEXT}
          </UiText>
          <UiText variant="caption">
            {warrantyPiiText(row.customer_phone, canViewPii, "phone") ||
              EMPTY_TEXT}
          </UiText>
        </Stack>
      ),
    },
    {
      key: "sku",
      header: t("warranty.list.colProduct"),
      width: 170,
      sortAccessor: (row) => row.sku || row.sku_name || "",
      render: (row) =>
        row.identification_type === "TEMP_ONLY" && !row.sku ? (
          t("warranty.list.manualDescription")
        ) : row.sku ? (
          <SkuLink code={row.sku} />
        ) : (
          row.sku_name || EMPTY_TEXT
        ),
    },
    {
      key: "defect",
      header: t("warranty.list.colDefect"),
      width: 170,
      hideOnMobile: true,
      sortAccessor: (row) => row.defect_code || row.defect || "",
      render: (row) => {
        const names = (row.defects ?? [])
          .map((defect) => defect.defect_name)
          .filter(Boolean);
        return names.length ? names.join(", ") : row.defect || EMPTY_TEXT;
      },
    },
    {
      key: "identification_type",
      header: t("warranty.list.colIdentification"),
      width: 130,
      hideOnMobile: true,
      sortAccessor: (row) => row.identification_type || "",
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            WARRANTY_IDENTIFICATION_STATUS_SHORT_LABELS,
            row.identification_type,
            EMPTY_TEXT,
          )}
        />
      ),
    },
    {
      key: "received_at",
      header: t("warranty.list.colReceivedAt"),
      width: 150,
      sortType: "value",
      hideOnMobile: true,
      sortAccessor: (row) => row.received_at || "",
      render: (row) => formatWarrantyDateTime(row.received_at),
    },
    {
      key: "status",
      header: t("warranty.list.colStatus"),
      width: 150,
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={statusTone(WARRANTY_STATUS_COLORS[row.status])}
          // Trạng thái lạ (BE thêm enum mới) phải ra "Chưa xác định", KHÔNG
          // được rơi về in nguyên mã máy giữa bảng tiếng Việt.
          label={businessLabel(WARRANTY_STATUS_LABELS, row.status)}
        />
      ),
    },
  ];

  const renderRowActions = (row: WarrantyCase) => (
    <RowActionButton kind="view" onClick={() => setDetailId(row.id)}>
      {tUi("reports.importMatchReport.detail")}
    </RowActionButton>
  );

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <>
      <div className="warranty-page hn-war-list">
        {!canViewPii ? (
          <Box className="footer-note" sx={{ mb: 1 }}>
            <ToolOutlined style={{ marginRight: 6 }} />
            {t("warranty.list.maskedNotice")} <b>warranty.pii.view</b>.
          </Box>
        ) : null}

        <header className="hn-war-header">
          <h1>{tUi("notifications.subject.warrantyCase")}</h1>
          <div className="hn-war-header-actions">
            {" "}
            {canManage ? (
              <ActionButton kind="create" onClick={() => setIntakeOpen(true)}>
                {t("warranty.list.intake")}
              </ActionButton>
            ) : null}
          </div>
        </header>
        <section
          className="hn-war-card"
          aria-label={tUi("updatedUi.text_158cb245bd0c")}
        >
          <div className="hn-war-filters" role="search">
            <div className="hn-war-field hn-war-search">
              <SearchInput
                id="hn-war-search"
                fullWidth
                autoFocus
                value={searchInput}
                placeholder={searchPlaceholder}
                width="100%"
                slotProps={{
                  htmlInput: {
                    "aria-label": t("warranty.list.searchAria"),
                    // Placeholder dài bị cắt ở tablet/hẹp — title giữ nguyên
                    // toàn bộ gợi ý để trình duyệt hiện tooltip khi hover.
                    title: searchPlaceholder,
                  },
                  input: { inputRef: searchRef },
                }}
                onChange={setSearchInput}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  setSearch(searchInput.trim());
                  setPage(1);
                  searchRef.current?.focus();
                }}
              />
            </div>
            <div className="hn-war-field">
              <UiSelect
                id="hn-war-status"
                fullWidth
                menuClassName="hn-war-menu"
                value={status}
                aria-label={t("warranty.list.statusFilterAria")}
                placeholder={t("warranty.list.statusFilterPlaceholder")}
                options={WARRANTY_BASELINE_STATUSES.map((value) => ({
                  value,
                  label: `${t("warranty.list.colStatus")}: ${WARRANTY_STATUS_LABELS[value]}`,
                }))}
                onChange={(value) => {
                  setStatus(value as WarrantyCaseStatus | "");
                  setPage(1);
                }}
              />
            </div>
            <div className="hn-war-field">
              <UiSelect
                id="hn-war-identification"
                fullWidth
                menuClassName="hn-war-menu"
                value={identification}
                aria-label={t("warranty.list.identificationFilterAria")}
                placeholder={t("warranty.list.identificationFilterPlaceholder")}
                // UAT TC_FUNC_02: nhãn của ô lọc phải lấy từ ĐÚNG registry mà cột
                // "Nhận diện" đang dùng. Bản trước gõ lại nhãn ở messages.ts nên ô
                // lọc ghi "Đã xác định sản phẩm" còn cột ghi "Đã xác định" — người
                // kiểm thử đối chiếu hai chữ khác nhau và kết luận lọc trả sai.
                options={WARRANTY_IDENTIFICATION_TYPES.map((value) => ({
                  value,
                  label: `${t("warranty.list.colIdentification")}: ${WARRANTY_IDENTIFICATION_STATUS_SHORT_LABELS[value]}`,
                }))}
                onChange={(value) => {
                  setIdentification(value as WarrantyIdentificationType | "");
                  setPage(1);
                }}
              />
            </div>
            <button
              type="button"
              className="hn-war-more-filters"
              aria-expanded={filtersOpen}
              aria-controls="hn-war-extra-filters"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <FilterOutlined aria-hidden="true" />
              {t("inbound.list.filterButton")}
            </button>
            {hasFilters ? (
              <button
                type="button"
                className="hn-war-clear-filters"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setStatus("");
                  setIdentification("");
                  setDefectId("");
                  setSortMode("newest");
                  setOverdueOnly(false);
                  clearOverdueLink();
                  setPage(1);
                  searchRef.current?.focus();
                }}
              >
                {t("inbound.list.clearFilters")}
              </button>
            ) : null}
          </div>
          <div
            id="hn-war-extra-filters"
            className="hn-war-extra-filters"
            hidden={!filtersOpen}
          >
            <div className="hn-war-field">
              <UiSelect
                id="hn-war-defect"
                fullWidth
                menuClassName="hn-war-menu"
                value={defectId}
                aria-label={t("warranty.list.defectFilterAria")}
                placeholder={t("warranty.list.defectFilterPlaceholder")}
                // Nhãn lựa chọn là "DEF-013 · Chập điện / cháy mô-tơ" — ô hẹp làm
                // menu gãy dòng giữa tên bệnh/lỗi (phản hồi người dùng 07/09/2026).
                options={[...(defectsQuery.data?.data ?? [])]
                  // BE trả danh mục theo created_at nên menu ra DEF-006, DEF-013,
                  // DEF-014, DEF-008... — người dùng phải quét mắt cả 15 dòng mới
                  // tìm được mã mình cần. Xếp theo mã cho khớp thứ tự họ tra.
                  .sort((a, b) =>
                    String(a.defect_code ?? "").localeCompare(
                      String(b.defect_code ?? ""),
                      "vi",
                    ),
                  )
                  .map((defect) => ({
                    value: String(
                      defect.defect_id ?? (defect as { id?: unknown }).id ?? "",
                    ).trim(),
                    label: `${t("warranty.list.colDefect")}: ${defect.defect_code} · ${defect.defect_name}`,
                  }))
                  .filter((option) => option.value !== "")}
                onChange={(value) => {
                  setDefectId(value);
                  setPage(1);
                }}
              />
            </div>
            <div className="hn-war-field">
              <UiSelect
                id="hn-war-sort"
                fullWidth
                menuClassName="hn-war-menu"
                value={sortMode}
                aria-label={t("warranty.list.sortAria")}
                options={[
                  {
                    value: "newest",
                    label: `${t("warranty.list.sortLabel")}: ${t("warranty.list.sortNewest")}`,
                  },
                  {
                    value: "oldest",
                    label: `${t("warranty.list.sortLabel")}: ${t("warranty.list.sortOldest")}`,
                  },
                  ...(["defect", "identification"] as const).flatMap((key) =>
                    (["asc", "desc"] as const).map((direction) => ({
                      value: `${key}-${direction}`,
                      label: `${t("warranty.list.sortLabel")}: ${t(
                        key === "defect"
                          ? "warranty.list.colDefect"
                          : "warranty.list.colIdentification",
                      )} ${direction === "asc" ? "A → Z" : "Z → A"}`,
                    })),
                  ),
                ]}
                onChange={(value) => {
                  setSortMode(value as WarrantySortMode);
                  setPage(1);
                }}
              />
            </div>
            <div className="hn-war-field">
              <UiSelect
                id="hn-war-overdue"
                fullWidth
                menuClassName="hn-war-menu"
                value={overdueOnly ? "1" : ""}
                aria-label={t("warranty.list.overdueFilterAria")}
                placeholder={t("warranty.list.overdueFilterPlaceholder")}
                options={[
                  { value: "1", label: t("warranty.list.overdueFilterOnly") },
                ]}
                onChange={(value) => {
                  setOverdueOnly(value === "1");
                  setPage(1);
                  clearOverdueLink();
                }}
              />
            </div>
          </div>
          {listQuery.isError ? (
            <Box sx={{ mb: "14px" }}>
              <ApiErrorAlert
                error={listQuery.error}
                title={t("warranty.list.loadError")}
                onRetry={() => listQuery.refetch()}
              />
            </Box>
          ) : null}

          <TableLoadingBanner loading={listQuery.isLoading} />
          <WarrantyListTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            listSort={listSort}
            rowNumberOffset={(pagination.current - 1) * perPage}
            loading={listQuery.isLoading}
            emptyText={tableEmptyText(
              listQuery.isError ? listQuery.error : null,
              t("warranty.list.empty"),
            )}
            onRowClick={(row) => setDetailId(row.id)}
            renderRowActions={renderRowActions}
          />
          <div className="hn-war-pagination">
            <div className="hn-war-pagination-info">
              <span>
                {tUi("putaway.queue.showing")}{" "}
                {rows.length ? (pagination.current - 1) * perPage + 1 : 0} –{" "}
                {rows.length
                  ? (pagination.current - 1) * perPage + rows.length
                  : 0}{" "}
                / {pagination.total.toLocaleString("vi-VN")}
                {" " + tUi("reports.warrantyReport.tableUnit")}
              </span>{" "}
              <UiSelect
                kind="page-size"
                menuClassName="hn-war-menu"
                value={perPage}
                aria-label={t("warranty.list.pageSizeAria")}
                minWidth={FILTER_WIDTH.pageSize}
                options={perPageOptions.map((size) => ({
                  value: size,
                  label: t("shared.table.perPage", { size }),
                }))}
                onChange={(value) => {
                  setPerPage(Number(value));
                  setPage(1);
                }}
              />
            </div>
            {/* Tổng số đã hiện trong toolbar → showTotal=false, tránh lặp. */}
            <UiPagination
              page={pagination.current}
              pageSize={perPage}
              total={pagination.total}
              showTotal={false}
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          </div>
        </section>
        {intakeOpen ? (
          <WarrantyIntakeModal
            open
            onClose={() => setIntakeOpen(false)}
            onCreated={(created) => {
              setIntakeOpen(false);
              refreshAll();
              setDetailId(created.id);
            }}
          />
        ) : null}

        {detailId ? (
          <WarrantyDetailModal
            caseId={detailId}
            onClose={() => setDetailId(null)}
            onOpenComponentIssue={(target) => setComponentTarget(target)}
          />
        ) : null}

        <CameraScanModal
          open={cameraOpen}
          title={t("warranty.list.scanTitle")}
          onDetected={(code) => {
            setSearchInput(code.trim());
            setSearch(code.trim());
            setPage(1);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />

        {componentTarget ? (
          <ComponentIssueModal
            caseId={componentTarget.caseId}
            caseCode={componentTarget.caseCode}
            caseActive={componentTarget.caseActive}
            documentId={componentTarget.documentId}
            onClose={() => setComponentTarget(null)}
            onChanged={refreshAll}
          />
        ) : null}
      </div>
    </>
  );
}
