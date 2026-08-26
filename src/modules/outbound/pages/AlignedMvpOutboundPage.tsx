/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, type Key } from "react";
import { Progress, Table, Tag, type TablePaginationConfig } from "antd";
import { Button as MuiButton, MenuItem, Select, TextField, ThemeProvider } from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import { EyeOutlined, PlusOutlined, ScanOutlined } from "@/shared/components/icons";
import type { ColumnsType } from "antd/es/table";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import { useHasPermission } from "@/shared/components/permission";
import {
  OUTBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { AlignedOutboundDetailModal } from "@/modules/outbound/components/AlignedOutboundDetailModal";
import { OutboundIntakeModal } from "@/modules/outbound/components/OutboundIntakeModal";
import {
  fetchOutboundDocuments,
  type OutboundDocumentRecord,
  type OutboundStatus,
} from "@/modules/outbound/services/alignedOutboundService";

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

const STATUS_OPTIONS: Array<{ value: OutboundStatus; label: string }> =
  Object.entries(OUTBOUND_STATUS_LABELS).map(([value, label]) => ({
    value: value as OutboundStatus,
    label,
  }));

const STATUS_COLOR: Record<OutboundStatus, string> = {
  DRAFT: "warning",
  SCANNING: "processing",
  POSTED: "success",
  CANCELLED: "error",
};

const DETAIL_SCREENS = new Set(["OUT-03", "OUT-02", "LBL-01", "RFID-01"]);

/** BA baseline 2026-08-25: quét đủ -> Post Issue -> Packing Label độc lập; RFID tùy chọn. */
export default function AlignedMvpOutboundPage() {
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OutboundStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const canImport = can("outbound.import");
  const canScan = can("outbound.scan");

  const listQuery = useQuery({
    queryKey: ["mvp-outbound", "list", search, status, page, perPage],
    queryFn: () =>
      fetchOutboundDocuments({
        search: search || undefined,
        status: status || undefined,
        page,
        per_page: perPage,
      }),
  });

  const rows = listQuery.data?.data ?? [];
  const pagination = resolveApiPagination(listQuery.data?.meta, {
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
    if (!screen || screen === "OUT-01") return;
    if (screen === "OUT-REQ-01") {
      setIntakeOpen(true);
    } else if (DETAIL_SCREENS.has(screen)) {
      const id = searchParams.get("id");
      if (id) setDetailId(id);
    } else {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("screen", "OUT-01");
    next.delete("id");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const overlayOpen = intakeOpen || detailId !== null;
  const closeOverlays = () => {
    setIntakeOpen(false);
    setDetailId(null);
  };
  useOverlayBackDismiss(overlayOpen, closeOverlays, "OUT-01-overlay");

  const columns: ColumnsType<OutboundDocumentRecord> = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      fixed: "left",
      render: (_: unknown, __: OutboundDocumentRecord, index: number) =>
        (page - 1) * perPage + index + 1,
    },
    {
      title: "Phiếu xuất",
      dataIndex: "code",
      key: "code",
      width: 190,
      fixed: "left",
      render: (value: string, row) => <strong>{value || row.id}</strong>,
    },
    {
      title: "Yêu cầu xuất",
      dataIndex: "outboundRequestId",
      key: "request",
      width: 150,
      render: (value: string | null | undefined) =>
        value ? (
          <span title={value}>
            {value.length > 12 ? `${value.slice(0, 8)}…` : value}
          </span>
        ) : (
          <Tag color="error">Thiếu yêu cầu xuất</Tag>
        ),
    },
    {
      title: "Người nhận",
      dataIndex: "recipientName",
      key: "recipientName",
      width: 190,
    },
    {
      title: "Đối chiếu",
      key: "match",
      width: 190,
      render: (_, row) => {
        const percent =
          row.expected > 0
            ? Math.min(100, Math.round((row.scanned / row.expected) * 100))
            : 0;
        return (
          <div style={{ minWidth: 150 }}>
            <Progress
              percent={percent}
              size="small"
              status={row.status === "POSTED" ? "success" : "normal"}
            />
            <span style={{ fontSize: 12 }}>
              {row.scanned} / {row.expected}
            </span>
          </div>
        );
      },
    },
    {
      title: "Nhãn đóng gói",
      key: "label",
      width: 180,
      render: (_, row) => {
        const printed = row.labelPrintedCount ?? 0;
        if (printed >= 1) return <Tag color="success">Đã in</Tag>;
        return row.status === "POSTED" ? (
          <Tag color="warning">Chờ xử lý sau xuất kho</Tag>
        ) : (
          <Tag>Chưa tới bước nhãn</Tag>
        );
      },
    },
    {
      title: "RFID",
      key: "rfid",
      width: 150,
      render: (_, row) => (
        <Tag
          color={
            row.rfidMappedCount && row.rfidMappedCount > 0 ? "blue" : "default"
          }
        >
          Tùy chọn · {row.rfidMappedCount ?? 0}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 170,
      render: (value: OutboundStatus) => (
        <Tag color={STATUS_COLOR[value]}>
          {businessLabel(OUTBOUND_STATUS_LABELS, value, "Chưa xác định")}
        </Tag>
      ),
    },
    {
      title: "Cập nhật",
      key: "updatedAt",
      width: 170,
      render: (_, row) => row.updatedAt ?? row.date ?? "-",
    },
    {
      title: "Hành động",
      key: "actions",
      width: 130,
      fixed: "right",
      render: (_, row) => {
        const mutable = row.status === "DRAFT" || row.status === "SCANNING";
        return (
          <button
            className="btn small"
            type="button"
            onClick={() => setDetailId(row.id)}
          >
            {mutable && canScan ? (
              <ScanOutlined
                style={{ marginRight: 4, color: ACTION_ICON_COLORS.sync }}
              />
            ) : (
              <EyeOutlined
                style={{ marginRight: 4, color: ACTION_ICON_COLORS.view }}
              />
            )}
            {mutable && canScan ? "Mở" : "Xem"}
          </button>
        );
      },
    },
  ];

  const refreshAll = () =>
    void queryClient.invalidateQueries({ queryKey: ["mvp-outbound"] });

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="outbound-page hn-mvp-source-screen">
      <div className="toolbar">
        <TextField
          value={searchInput}
          placeholder="Tìm mã phiếu xuất / ghi chú..."
          slotProps={{ htmlInput: { "aria-label": "Tìm phiếu xuất" } }}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ minWidth: 220, ...TOOLBAR_SX }}
        />
        <Select
          displayEmpty
          value={status}
          inputProps={{ "aria-label": "Lọc trạng thái phiếu xuất" }}
          onChange={(event) => {
            setStatus(event.target.value as OutboundStatus | "");
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
        {canImport ? (
          <MuiButton
            variant="contained"
            onClick={() => setIntakeOpen(true)}
            startIcon={<PlusOutlined />}
          >
            Tiếp nhận yêu cầu xuất
          </MuiButton>
        ) : null}
      </div>

      {listQuery.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert
            error={listQuery.error}
            title="Không tải được danh sách phiếu xuất"
            onRetry={() => listQuery.refetch()}
          />
        </div>
      ) : null}

      <TableLoadingBanner
        loading={listQuery.isLoading || listQuery.isFetching}
      />
      <Table<OutboundDocumentRecord>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        loading={listQuery.isLoading || listQuery.isFetching}
        onChange={(next: TablePaginationConfig) => setPage(next.current ?? 1)}
        pagination={{
          current: pagination.current,
          pageSize: perPage,
          total: pagination.total,
          showSizeChanger: false,
          showTotal: (count) => `Tổng ${count} phiếu xuất`,
        }}
        locale={{
          emptyText: tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Chưa có phiếu xuất phù hợp",
          ),
        }}
        scroll={{ x: "max-content" }}
      />

      {intakeOpen ? (
        <OutboundIntakeModal
          open
          canImport={canImport}
          onClose={() => setIntakeOpen(false)}
          onConsumed={(documentIds) => {
            setIntakeOpen(false);
            refreshAll();
            if (documentIds[0]) setDetailId(documentIds[0]);
          }}
        />
      ) : null}

      {detailId ? (
        <AlignedOutboundDetailModal
          documentId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refreshAll}
        />
      ) : null}
      </div>
    </ThemeProvider>
  );
}
