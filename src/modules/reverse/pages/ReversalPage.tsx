/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
      header: "STT",
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
      header: "Mã điều chỉnh",
      width: 170,
      sortAccessor: (row) => row.reversal_code || "",
      // KHÔNG fallback sang row.id: cột này là MÃ ĐIỀU CHỈNH đọc được.
      render: (row) => <strong>{row.reversal_code || EMPTY_TEXT}</strong>,
    },
    {
      key: "ref",
      header: "Chứng từ gốc",
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
      header: "Tổng số lượng",
      width: 120,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.total_qty,
      render: (row) => formatQuantity(row.total_qty),
    },
    {
      key: "status",
      header: "Trạng thái",
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
      header: "Lý do điều chỉnh",
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
      header: "Ngày tạo",
      width: 160,
      sortType: "value",
      hideOnMobile: true,
      sortAccessor: (row) => row.created_at,
      render: (row) => formatDateTime(row.created_at),
    },
    {
      // reversalService map `created_by_name ?? created_by` nên cột này ra tên
      // người dùng khi BE trả về, fallback mã/`-` khi không có.
      key: "created_by",
      header: "Người tạo",
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
            Chế độ chỉ xem: tài khoản hiện tại chưa có quyền tạo, xác nhận, hoàn
            tất hoặc hủy phiếu điều chỉnh tồn kho. Bạn vẫn có thể xem danh sách
            và chi tiết.
          </Box>
        ) : null}

        <div className="toolbar">
          <UiTextField
            value={searchInput}
            placeholder="Mã điều chỉnh, chứng từ gốc, lý do..."
            slotProps={{
              htmlInput: { "aria-label": "Tìm phiếu điều chỉnh tồn kho" },
            }}
            onChange={(event) => setSearchInput(event.target.value)}
            sx={{ minWidth: 220 }}
          />
          <UiSelect
            value={statusFilter}
            aria-label="Lọc trạng thái phiếu điều chỉnh"
            placeholder="Trạng thái: Tất cả"
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
            aria-label="Số dòng mỗi trang"
            minWidth={100}
            options={perPageOptions.map((size) => ({
              value: size,
              label: `${size} / trang`,
            }))}
            onChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
          />
          <div className="spacer" />
          {canPost ? (
            <ActionButton kind="create" onClick={() => setCreateOpen(true)}>
              Tạo phiếu điều chỉnh
            </ActionButton>
          ) : null}
        </div>

        {listQuery.isError ? (
          <Box sx={{ mb: 1.75 }}>
            <ApiErrorAlert
              error={listQuery.error}
              title="Không tải được danh sách phiếu điều chỉnh"
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
            `Chọn phiếu điều chỉnh ${row.reversal_code || "chưa có mã"}`
          }
          // Chỉ khoá bảng khi tải lần đầu — ResponsiveDataTable thay hẳn nội
          // dung bảng bằng "Đang tải..." khi loading=true (không giữ dòng cũ
          // như overlay spinner của antd Table), nên không dùng isFetching ở
          // đây để tránh bảng trắng xoá mỗi lần đổi trang/lọc (đã có
          // TableLoadingBanner báo isFetching phía trên).
          loading={listQuery.isLoading}
          emptyText={tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Không có phiếu điều chỉnh theo bộ lọc hiện tại",
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
              Mở
            </ActionButton>
          )}
        />
        <TopPagination
          placement="bottom"
          total={listPagination.total}
          current={listPagination.current}
          pageSize={listPagination.pageSize}
          unitName="phiếu điều chỉnh"
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
