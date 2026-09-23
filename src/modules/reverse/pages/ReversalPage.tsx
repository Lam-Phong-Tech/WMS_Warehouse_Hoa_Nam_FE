/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useT } from "@/shared/i18n/useT";
import { Box, Tooltip, UiSelect, UiTextField } from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { TopPagination } from "@/shared/components/data-display/TopPagination";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { useHasPermission } from "@/shared/components/permission";
import {
  REVERSAL_REASON_LABELS,
  REVERSAL_STATUS_LABELS,
  enumLabelOrText,
} from "@/shared/constants/business-labels";
import { useReversalDocuments, reversalKeys } from "../hooks/use-reversal";
import { ReversalCreateModal } from "../components/ReversalCreateModal";
import { ReversalDetailModal } from "../components/ReversalDetailModal";
import { ReversalStatusTag } from "../components/ReversalStatusTag";
import type { ReversalDocument } from "../types";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { ActionButton, RowActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

import { SearchOutlined } from "@/shared/components/icons";
import "./reversal-list.css";

const SEARCH_DEBOUNCE_MS = 250;

/** REV-00 · Danh sách phiếu điều chỉnh tồn kho bằng nghiệp vụ hoàn đảo. */
export default function ReversalPage() {
  const t = useT();
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const canPost = can("inventory.reversal.post");

  const listQuery = useReversalDocuments({
    keyword: search || undefined,
    status: statusFilter || undefined,
    page,
    per_page: perPage,
  });
  const rows = listQuery.data?.rows ?? [];
  const listPagination = resolveApiPagination(listQuery.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const screen = searchParams.get("screen");
    if (!screen || screen === "REV-00") return;
    if (screen === "REV-01") {
      setCreateOpen(true);
    } else if (screen === "REV-02") {
      const id = searchParams.get("id");
      if (id) setDetailId(id);
    } else {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "REV-00");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: reversalKeys.all });
  };

  const columns: ResponsiveTableColumn<ReversalDocument>[] = [
    {
      key: "stt",
      header: t("reverse.detail.colStt"),
      align: "center",
      width: 48,
      hideOnMobile: true,
      // ResponsiveDataTable không truyền index vào render (khác antd Table),
      // nên STT tính theo vị trí trong `rows` (thứ tự trang hiện tại từ API)
      // — không còn tự bám theo thứ tự sau khi bấm sắp xếp cột khác như hành
      // vi cũ của antd Table (đã nêu trong báo cáo bàn giao).
      render: (row) => mvpRowNumber(page, perPage, rowIndexOf(rows, row)),
    },
    {
      key: "reversal_code",
      header: t("reverse.detail.fieldCode"),
      width: 170,
      sortAccessor: (row) => row.reversal_code || "",
      // KHÔNG fallback sang row.id: cột này là MÃ ĐIỀU CHỈNH đọc được.
      render: (row) => (
        <strong className="hn-reversal-code">
          {row.reversal_code || EMPTY_TEXT}
        </strong>
      ),
    },
    {
      key: "ref",
      header: t("reverse.detail.fieldSourceDoc"),
      width: 180,
      sortAccessor: (row) => row.reference_document_code || "",
      render: (row) => (
        <Box
          className="hn-reversal-source-code"
          component="code"
          sx={{
            px: 0.5,
            py: 0.25,
            borderRadius: 1,
            bgcolor: "action.hover",
            fontSize: 12.5,
          }}
        >
          {/* KHÔNG fallback sang *_document_id (UUID) — thiếu mã thì hiện "—". */}
          {row.reference_document_code || EMPTY_TEXT}
        </Box>
      ),
    },
    {
      key: "total_qty",
      header: t("reverse.list.colTotalQty"),
      width: 120,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.total_qty,
      render: (row) => formatQuantity(row.total_qty),
    },
    {
      key: "status",
      header: t("reverse.detail.colStatus"),
      width: 210,
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <ReversalStatusTag
          status={row.status}
          physicalReturnStatus={row.physical_return_status}
          compact
        />
      ),
    },
    {
      // Lý do là dữ liệu bắt buộc khi tạo phiếu (BR-REV: `reason` required) nên
      // luôn có nội dung — đưa lên danh sách để không phải mở từng phiếu mới
      // biết vì sao điều chỉnh. Độ dài thất thường → ellipsis + tooltip giữ
      // chiều cao dòng đều nhau (cùng cách xử lý "Vị trí gợi ý" ở INV-01).
      key: "reason",
      header: t("reverse.create.reasonLabel"),
      width: 240,
      sortAccessor: (row) => row.reason || "",
      render: (row) => (
        <div>
          <Tooltip title={row.reason || EMPTY_TEXT}>
            <Box
              className="hn-reversal-reason"
              sx={{
                maxWidth: 230,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.reason || EMPTY_TEXT}
            </Box>
          </Tooltip>
          {row.reason_code ? (
            <Box sx={{ fontSize: 12, color: "text.secondary" }}>
              {enumLabelOrText(REVERSAL_REASON_LABELS, row.reason_code)}
            </Box>
          ) : null}
        </div>
      ),
    },
    {
      key: "created_at",
      header: t("reverse.detail.fieldCreatedAt"),
      width: 160,
      sortType: "value",
      hideOnMobile: true,
      sortAccessor: (row) => row.created_at,
      render: (row) => formatDateTime(row.created_at),
    },
    {
      // reversalService chỉ nhận `created_by_name` (BE đã join tên); thiếu tên
      // thì `-`, KHÔNG rơi xuống UUID `created_by`.
      key: "created_by",
      header: t("reverse.detail.fieldCreatedBy"),
      width: 150,
      hideOnMobile: true,
      sortAccessor: (row) => row.created_by || "",
      render: (row) => row.created_by || EMPTY_TEXT,
    },
  ];

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <>
      <div
        className="reversal-page hn-mvp-source-screen hn-reversal-screen"
        data-mvp-screen="REV-00"
      >
        {!canPost ? (
          <Box
            className="hn-reversal-readonly"
            role="note"
            data-testid="reversal-readonly-note"
            sx={{ mb: 1.5 }}
          >
            {t("reverse.list.readonlyNote")}
          </Box>
        ) : null}

        <div className="hn-reversal-filters">
          <div className="hn-reversal-filter hn-reversal-filter-search">
            <label htmlFor="reversal-search">
              {t("reverse.list.searchAria")}
            </label>
            <UiTextField
              id="reversal-search"
              value={searchInput}
              placeholder={t("reverse.list.searchPlaceholder")}
              slotProps={{
                htmlInput: { "aria-label": t("reverse.list.searchAria") },
                input: {
                  startAdornment: (
                    <SearchOutlined className="hn-reversal-search-icon" />
                  ),
                },
              }}
              onChange={(event) => setSearchInput(event.target.value)}
              fullWidth
            />
          </div>
          <div className="hn-reversal-filter">
            <label id="reversal-status-label">
              {t("reverse.detail.colStatus")}
            </label>
            <UiSelect
              value={statusFilter}
              aria-label={t("reverse.list.statusFilterAria")}
              placeholder={t("reverse.list.statusFilterPlaceholder")}
              menuClassName="hn-reversal-menu"
              fullWidth
              options={Object.entries(REVERSAL_STATUS_LABELS).map(
                ([value, label]) => ({
                  value,
                  label: label.replace(/ ·.*$/, ""),
                }),
              )}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
          </div>
          <div className="hn-reversal-filter">
            <label>{t("shared.table.rowsPerPageAria")}</label>
            <UiSelect
              value={perPage}
              aria-label={t("shared.table.rowsPerPageAria")}
              menuClassName="hn-reversal-menu"
              fullWidth
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
          {canPost ? (
            <div className="hn-reversal-filter-actions">
              <ActionButton
                kind="create"
                className="hn-reversal-primary"
                onClick={() => setCreateOpen(true)}
              >
                {t("reverse.create.submit")}
              </ActionButton>
            </div>
          ) : null}
        </div>
        <section
          className="hn-reversal-list-card"
          aria-label={t("reverse.list.unitName")}
        >
          {listQuery.isError ? (
            <Box sx={{ mb: 1.75 }}>
              <ApiErrorAlert
                error={listQuery.error}
                title={t("reverse.list.loadError")}
                onRetry={() => listQuery.refetch()}
              />
            </Box>
          ) : null}

          <TableLoadingBanner
            loading={listQuery.isLoading || listQuery.isFetching}
          />
          <ResponsiveDataTable<ReversalDocument>
            headerCellStyle={{
              background: "var(--rev-pale)",
              color: "var(--rev-ink)",
              fontSize: 12,
              padding: "10px 9px",
              borderColor: "var(--rev-line)",
            }}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            // Chỉ khoá bảng khi tải lần đầu — ResponsiveDataTable thay hẳn nội
            // dung bảng bằng "Đang tải..." khi loading=true (không giữ dòng cũ
            // như overlay spinner của antd Table), nên không dùng isFetching ở
            // đây để tránh bảng trắng xoá mỗi lần đổi trang/lọc (đã có
            // TableLoadingBanner báo isFetching phía trên).
            loading={listQuery.isLoading}
            emptyText={tableEmptyText(
              listQuery.isError ? listQuery.error : null,
              t("reverse.list.empty"),
            )}
            // antd Table cũ mở modal chi tiết bằng onDoubleClick; ResponsiveDataTable
            // chỉ hỗ trợ onRowClick (bấm 1 lần) — đổi thành bấm 1 lần để mở, đã nêu
            // trong báo cáo bàn giao.
            onRowClick={(row) => setDetailId(row.id)}
            renderRowActions={(row) => (
              <RowActionButton kind="view" onClick={() => setDetailId(row.id)}>
                {t("reverse.list.open")}
              </RowActionButton>
            )}
          />
          <div className="hn-reversal-pagination">
            <TopPagination
              placement="bottom"
              total={listPagination.total}
              current={listPagination.current}
              pageSize={listPagination.pageSize}
              unitName={t("reverse.list.unitName")}
              showSizeChanger={false}
              onChange={(nextPage) => setPage(nextPage)}
            />
          </div>
        </section>

        {createOpen ? (
          <ReversalCreateModal
            onClose={() => setCreateOpen(false)}
            onCreated={(_reversalCode, reversalId) => {
              setCreateOpen(false);
              refreshAll();
              // "Chứng từ nhập/xuất/hoàn trả": phiếu vừa tạo luôn ở DRAFT — mở luôn
              // chi tiết để người dùng đính kèm chứng từ rồi Hoàn tất, đỡ phải tự
              // tìm lại trong danh sách.
              setDetailId(reversalId);
            }}
          />
        ) : null}

        {detailId ? (
          <ReversalDetailModal
            documentId={detailId}
            onClose={() => setDetailId(null)}
          />
        ) : null}
      </div>
    </>
  );
}
