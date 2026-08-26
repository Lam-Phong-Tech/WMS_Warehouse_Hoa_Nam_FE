import { useEffect, useState, type Key } from "react";
import {
  Button,
  Space,
  Table,
  Tag,
  type TablePaginationConfig,
} from "antd";
import { Button as MuiButton, MenuItem, Select, TextField, ThemeProvider } from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ScanOutlined,
} from "@/shared/components/icons";
import type { ColumnsType } from "antd/es/table";
import { useSearchParams } from "react-router-dom";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import {
  INBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { useAuthStore } from "@/shared/store/auth.store";
import { InboundDraftModal } from "@/modules/inbound/components/InboundDraftModal";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import type { InboundDocument } from "@/modules/inbound/types";

const STATUS_OPTIONS = Object.entries(INBOUND_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as InboundDocument["status"],
    label,
  }),
);
const SEARCH_DEBOUNCE_MS = 250;

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

function statusTag(status: InboundDocument["status"]) {
  const color =
    status === "POSTED"
      ? "success"
      : status === "SCANNING"
        ? "processing"
        : status === "CANCELLED"
          ? "error"
          : "warning";
  return (
    <Tag color={color}>
      {businessLabel(INBOUND_STATUS_LABELS, status, "Chưa xác định")}
    </Tag>
  );
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

function InboundListScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [scanDocumentId, setScanDocumentId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const query = useInboundDocuments({
    search: search || undefined,
    status,
    page,
    per_page: perPage,
  });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const total = Number(meta?.total ?? rows.length);

  useEffect(() => {
    const requestedScreen = searchParams.get("screen");
    if (requestedScreen !== "IN-02" && requestedScreen !== "IN-03") return;
    const id = searchParams.get("id");
    if (requestedScreen === "IN-02") {
      setDraftDocumentId(id);
      setDraftOpen(true);
    } else if (id) {
      setScanDocumentId(id);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "IN-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const closeDraftModal = () => {
    setDraftOpen(false);
    setDraftDocumentId(null);
  };

  const handleSaved = (documentId: string) => {
    closeDraftModal();
    setScanDocumentId(documentId);
  };

  const overlayOpen = draftOpen || scanDocumentId !== null;
  useOverlayBackDismiss(
    overlayOpen,
    () => {
      setDraftOpen(false);
      setDraftDocumentId(null);
      setScanDocumentId(null);
    },
    "IN-01-overlay",
  );

  const columns: ColumnsType<InboundDocument> = [
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
      title: "Phiếu nhập",
      dataIndex: "code",
      key: "code",
      width: 180,
      fixed: "left",
      render: (value: string, row) => <strong>{value || row.id}</strong>,
    },
    {
      title: "Nguồn / tham chiếu",
      dataIndex: "source",
      key: "source",
      width: 220,
      render: (value: string) => value || "-",
    },
    {
      title: "Số lượng đã quét",
      dataIndex: "scanned",
      key: "scanned",
      width: 150,
      align: "right",
      render: (value: number) => value.toLocaleString("vi-VN"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 160,
      render: statusTag,
    },
    {
      title: "Cập nhật",
      key: "updatedAt",
      width: 180,
      render: (_, row) => row.updatedAt ?? row.date ?? "-",
    },
    {
      title: "Hành động",
      key: "actions",
      width: 230,
      fixed: "right",
      render: (_, row) => {
        const mutable = row.status === "DRAFT" || row.status === "SCANNING";
        return (
          <Space size={4} wrap>
            <Button
              type="link"
              size="small"
              icon={
                mutable && canScan ? (
                  <ScanOutlined style={{ color: ACTION_ICON_COLORS.sync }} />
                ) : (
                  <EyeOutlined style={{ color: ACTION_ICON_COLORS.view }} />
                )
              }
              onClick={() => setScanDocumentId(row.id)}
            >
              {mutable && canScan
                ? row.status === "DRAFT"
                  ? "Bắt đầu quét"
                  : "Tiếp tục quét"
                : "Xem"}
            </Button>
            {canCreate && mutable ? (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined style={{ color: ACTION_ICON_COLORS.edit }} />}
                onClick={() => {
                  setDraftDocumentId(row.id);
                  setDraftOpen(true);
                }}
              >
                Sửa thông tin
              </Button>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1);
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="inbound-page hn-mvp-source-screen">
      <div className="toolbar">
        <TextField
          value={searchInput}
          placeholder="Tìm mã phiếu / nguồn nhập..."
          slotProps={{ htmlInput: { "aria-label": "Tìm phiếu nhập" } }}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ minWidth: 220, ...TOOLBAR_SX }}
        />
        <Select
          displayEmpty
          value={status ?? ""}
          inputProps={{ "aria-label": "Lọc trạng thái phiếu nhập" }}
          onChange={(event) => {
            setStatus(event.target.value || undefined);
            setPage(1);
          }}
          sx={{ minWidth: 168, ...TOOLBAR_SX }}
        >
          <MenuItem value="">Trạng thái: Tất cả</MenuItem>
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
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
        {canCreate ? (
          <MuiButton
            variant="contained"
            onClick={() => {
              setDraftDocumentId(null);
              setDraftOpen(true);
            }}
            startIcon={<PlusOutlined />}
          >
            Tạo phiếu nhập
          </MuiButton>
        ) : null}
      </div>

      {query.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert
            error={query.error}
            title="Không tải được danh sách phiếu nhập."
            onRetry={() => query.refetch()}
          />
        </div>
      ) : null}

      <TableLoadingBanner loading={query.isLoading || query.isFetching} />
      <Table<InboundDocument>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        loading={query.isLoading || query.isFetching}
        onChange={handleTableChange}
        pagination={{
          current: Number(meta?.current_page ?? page),
          pageSize: perPage,
          total,
          showSizeChanger: false,
          showTotal: (count) => `Tổng ${count} phiếu nhập`,
        }}
        locale={{
          emptyText: tableEmptyText(
            query.isError ? query.error : null,
            "Chưa có phiếu nhập phù hợp",
          ),
        }}
        scroll={{ x: "max-content" }}
      />

      {draftOpen ? (
        <InboundDraftModal
          documentId={draftDocumentId}
          onClose={closeDraftModal}
          onSaved={handleSaved}
        />
      ) : null}

      {scanDocumentId ? (
        <InboundScanModal
          documentId={scanDocumentId}
          onClose={() => setScanDocumentId(null)}
          onChanged={() => void query.refetch()}
        />
      ) : null}
      </div>
    </ThemeProvider>
  );
}

export default function InboundPage() {
  return <InboundListScreen />;
}
