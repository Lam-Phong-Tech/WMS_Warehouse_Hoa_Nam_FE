/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, type Key } from "react";
import { useSearchParams } from "react-router-dom";
import { Table, Tag, Typography } from "antd";
import { Button as MuiButton, MenuItem, Select, TextField, ThemeProvider } from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { EyeOutlined, PlusOutlined } from "@/shared/components/icons";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
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
  REVERSAL_STATUS_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useReversalDocuments, reversalKeys } from "../hooks/use-reversal";
import { ReversalCreateModal } from "../components/ReversalCreateModal";
import { ReversalDetailModal } from "../components/ReversalDetailModal";
import { ReversalStatusTag } from "../components/ReversalStatusTag";
import type { ReversalDocument } from "../types";
import { formatDateTime } from "@/shared/utils/format-date";

const SEARCH_DEBOUNCE_MS = 250;
const numberFormatter = new Intl.NumberFormat("vi-VN");

/** Toolbar filter nhỏ gọn — đồng bộ chuẩn mui-theme.ts (xem gotcha #4/#5 memory pilot MUI). */
const TOOLBAR_SX = {
  "&, & .MuiOutlinedInput-root": { height: 35 },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    paddingTop: "8px !important",
    paddingBottom: "8px !important",
    fontSize: "13.5px !important",
    boxSizing: "border-box",
  },
};

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

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

  const columns: ColumnsType<ReversalDocument> = [
    {
      title: "STT",
      key: "stt",
      className: "stt-col",
      width: 48,
      align: "center",
      fixed: "left",
      render: (_value, _row, index) => mvpRowNumber(page, perPage, index),
    },
    {
      title: "Mã điều chỉnh",
      dataIndex: "reversal_code",
      key: "reversal_code",
      width: 170,
      fixed: "left",
      render: (value: string, row) => <strong>{value || row.id}</strong>,
    },
    {
      title: "Chứng từ gốc",
      key: "ref",
      width: 180,
      render: (_, row) => (
        <Typography.Text code>
          {row.reference_document_code || row.reference_document_id}
        </Typography.Text>
      ),
    },
    {
      title: "Loại chứng từ gốc",
      key: "reference_document_type",
      width: 180,
      render: (_, row) => (
        <Tag>
          {businessLabel(
            SOURCE_DOCUMENT_TYPE_LABELS,
            row.reference_document_type,
            "Chứng từ khác",
          )}
        </Tag>
      ),
    },
    {
      title: "Kho",
      dataIndex: "warehouse_name",
      key: "warehouse",
      width: 140,
    },
    {
      title: "Tổng số lượng",
      dataIndex: "total_qty",
      key: "total_qty",
      width: 120,
      align: "right",
      render: (value: number) => numberFormatter.format(value),
    },
    {
      title: "Lý do",
      dataIndex: "reason",
      key: "reason",
      width: 220,
      ellipsis: true,
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 210,
      render: (_, row) => (
        <ReversalStatusTag
          status={row.status}
          physicalReturnStatus={row.physical_return_status}
          compact
        />
      ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (created_at: string) => formatDateTime(created_at),
    },
    {
      title: "Người tạo",
      dataIndex: "created_by",
      key: "created_by",
      width: 130,
    },
    {
      title: "",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_, row) => (
        <button
          className="btn small"
          type="button"
          onClick={() => setDetailId(row.id)}
        >
          <EyeOutlined
            style={{ marginRight: 4, color: ACTION_ICON_COLORS.view }}
          />
          Mở
        </button>
      ),
    },
  ];

  const handleTableChange = (nextPagination: TablePaginationConfig) => {
    setPage(nextPagination.current ?? 1);
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="reversal-page hn-mvp-source-screen">
      {!canPost ? (
        <div
          className="footer-note"
          role="note"
          data-testid="reversal-readonly-note"
          style={{ marginBottom: 12 }}
        >
          Chế độ chỉ xem: tài khoản hiện tại chưa có quyền tạo, xác nhận, hoàn
          tất hoặc hủy phiếu điều chỉnh tồn kho. Bạn vẫn có thể xem danh sách và
          chi tiết.
        </div>
      ) : null}

      <div className="toolbar">
        <TextField
          value={searchInput}
          placeholder="Mã điều chỉnh, chứng từ gốc, lý do..."
          slotProps={{ htmlInput: { "aria-label": "Tìm phiếu điều chỉnh tồn kho" } }}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ minWidth: 220, ...TOOLBAR_SX }}
        />
        <Select
          displayEmpty
          value={statusFilter}
          inputProps={{ "aria-label": "Lọc trạng thái phiếu điều chỉnh" }}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 168, ...TOOLBAR_SX }}
        >
          <MenuItem value="">Trạng thái: Tất cả</MenuItem>
          {Object.entries(REVERSAL_STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label.replace(/ ·.*$/, "")}
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
        <div className="spacer" />
        {canPost ? (
          <MuiButton
            variant="contained"
            onClick={() => setCreateOpen(true)}
            startIcon={<PlusOutlined />}
          >
            Tạo phiếu điều chỉnh
          </MuiButton>
        ) : null}
      </div>

      {listQuery.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert
            error={listQuery.error}
            title="Không tải được danh sách phiếu điều chỉnh"
            onRetry={() => listQuery.refetch()}
          />
        </div>
      ) : null}

      <TableLoadingBanner
        loading={listQuery.isLoading || listQuery.isFetching}
      />
      <Table<ReversalDocument>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={listQuery.isLoading || listQuery.isFetching}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        onChange={handleTableChange}
        pagination={{
          current: listPagination.current,
          pageSize: listPagination.pageSize,
          total: listPagination.total,
          showSizeChanger: false,
          showTotal: (total) =>
            `Tổng ${numberFormatter.format(total)} phiếu điều chỉnh`,
        }}
        locale={{
          emptyText: tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Không có phiếu điều chỉnh theo bộ lọc hiện tại",
          ),
        }}
        onRow={(row) => ({ onDoubleClick: () => setDetailId(row.id) })}
        scroll={{ x: "max-content" }}
      />

      {createOpen ? (
        <ReversalCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            refreshAll();
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
    </ThemeProvider>
  );
}
