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
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { REVERSAL_STATUS_LABELS } from "@/shared/constants/business-labels";
import { useReversalDocuments, reversalKeys } from "../hooks/use-reversal";
import { ReversalCreateModal } from "../components/ReversalCreateModal";
import { ReversalDetailModal } from "../components/ReversalDetailModal";
import { ReversalStatusTag } from "../components/ReversalStatusTag";
import type { ReversalDocument } from "../types";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { ActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";

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
  const rowSelection = useRowSelection(rows, (row) => row.id);
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
      render: (row) =>
        mvpRowNumber(
          page,
          perPage,
          rows.findIndex((r) => r.id === row.id),
        ),
    },
    {
      key: "reversal_code",
      header: t("reverse.detail.fieldCode"),
      width: 170,
      sortAccessor: (row) => row.reversal_code || "",
      // KHÔNG fallback sang row.id: cột này là MÃ ĐIỀU CHỈNH đọc được.
      render: (row) => <strong>{row.reversal_code || EMPTY_TEXT}</strong>,
    },
    {
      key: "ref",
      header: t("reverse.detail.fieldSourceDoc"),
      width: 180,
      sortAccessor: (row) => row.reference_document_code || "",
      render: (row) => (
        <Box
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
              {row.reason_code}
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
      <div className="reversal-page hn-mvp-source-screen">
        {!canPost ? (
          <Box
            className="footer-note"
            role="note"
            data-testid="reversal-readonly-note"
            sx={{ mb: 1.5 }}
          >
            {t("reverse.list.readonlyNote")}
          </Box>
        ) : null}

        <div className="toolbar">
          <UiTextField
            value={searchInput}
            placeholder={t("reverse.list.searchPlaceholder")}
            slotProps={{
              htmlInput: { "aria-label": t("reverse.list.searchAria") },
            }}
            onChange={(event) => setSearchInput(event.target.value)}
            sx={{ minWidth: 220 }}
          />
          <UiSelect
            value={statusFilter}
            aria-label={t("reverse.list.statusFilterAria")}
            placeholder={t("reverse.list.statusFilterPlaceholder")}
            minWidth={168}
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
          <UiSelect
            value={perPage}
            aria-label={t("shared.table.rowsPerPageAria")}
            minWidth={100}
            options={perPageOptions.map((size) => ({
              value: size,
              label: t("shared.table.perPage", { size }),
            }))}
            onChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
          />
          <div className="spacer" />
          {canPost ? (
            <ActionButton kind="create" onClick={() => setCreateOpen(true)}>
              {t("reverse.create.submit")}
            </ActionButton>
          ) : null}
        </div>

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
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowSelection={rowSelection}
          selectionLabel={(row) =>
            t("reverse.list.selectRowAria", {
              code: row.reversal_code || t("reverse.list.noCode"),
            })
          }
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
            <ActionButton
              kind="view"
              sx={{ whiteSpace: "nowrap" }}
              onClick={() => setDetailId(row.id)}
            >
              {t("reverse.list.open")}
            </ActionButton>
          )}
        />
        <TopPagination
          placement="bottom"
          total={listPagination.total}
          current={listPagination.current}
          pageSize={listPagination.pageSize}
          unitName={t("reverse.list.unitName")}
          showSizeChanger={false}
          onChange={(nextPage) => setPage(nextPage)}
        />

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
