/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Progress, Tag } from "antd";
import { Box, MenuItem, Select, TextField, ThemeProvider } from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
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
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import {
  OUTBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { TopPagination } from "@/shared/components/data-display/TopPagination";
import { AlignedOutboundDetailModal } from "@/modules/outbound/components/AlignedOutboundDetailModal";
import { OutboundIntakeModal } from "@/modules/outbound/components/OutboundIntakeModal";
import {
  fetchOutboundDocuments,
  type OutboundDocumentRecord,
  type OutboundStatus,
} from "@/modules/outbound/services/alignedOutboundService";
import { ActionButton } from "@/shared/components/actions";

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

  // BE mở nhóm yêu cầu xuất bằng OR: `outbound.request.import|outbound.import`,
  // `outbound.request.manual_create|outbound.import`. Gate FE chỉ bằng
  // `outbound.import` là chặt HƠN backend — WAREHOUSE_STAFF được cấp đủ bộ
  // outbound.request.* nhưng KHÔNG có outbound.import, nên nút "Nhập yêu cầu
  // xuất" bị ẩn mất dù API hoàn toàn cho phép. Khớp đúng bộ mã của route.
  const canImport =
    WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_IMPORT.some(can) ||
    WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_MANUAL_CREATE.some(can);
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
  const rowSelection = useRowSelection(rows, (row) => row.id);
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

  const columns: ResponsiveTableColumn<OutboundDocumentRecord>[] = [
    {
      key: "stt",
      header: "STT",
      align: "center",
      width: 48,
      hideOnMobile: true,
      render: (row) => mvpRowNumber(page, perPage, rows.indexOf(row)),
    },
    {
      key: "code",
      header: "Phiếu xuất",
      width: 190,
      sortAccessor: (row) => row.code || row.id,
      render: (row) => <strong>{row.code || row.id}</strong>,
    },
    {
      key: "request",
      header: "Yêu cầu xuất",
      width: 150,
      hideOnMobile: true,
      sortAccessor: (row) => row.outboundRequestId ?? "",
      render: (row) => {
        const value = row.outboundRequestId;
        return value ? (
          <span title={value}>
            {value.length > 12 ? `${value.slice(0, 8)}…` : value}
          </span>
        ) : (
          <Tag color="error">Thiếu yêu cầu xuất</Tag>
        );
      },
    },
    {
      key: "recipientName",
      header: "Người nhận",
      width: 190,
      sortAccessor: (row) => row.recipientName,
      render: (row) => row.recipientName,
    },
    {
      key: "date",
      header: "Ngày tạo",
      width: 150,
      hideOnMobile: true,
      sortType: "value",
      sortAccessor: (row) => row.date || "",
      render: (row) => {
        if (!row.date) return "-";
        const parsed = dayjs(row.date);
        // Ngày-tháng-năm giờ theo cách đọc của người dùng Việt (22-09-2026 12:00),
        // cùng chuẩn với cột Ngày tạo bên Danh sách phiếu nhập.
        return parsed.isValid() ? parsed.format("DD-MM-YYYY HH:mm") : row.date;
      },
    },
    {
      key: "note",
      header: "Ghi chú",
      width: 200,
      hideOnMobile: true,
      sortAccessor: (row) => row.note || "",
      render: (row) => row.note || "-",
    },
    {
      key: "match",
      header: "Đối chiếu",
      width: 190,
      sortType: "value",
      sortAccessor: (row) =>
        row.expected > 0 ? row.scanned / row.expected : 0,
      render: (row) => {
        const percent =
          row.expected > 0
            ? Math.min(100, Math.round((row.scanned / row.expected) * 100))
            : 0;
        return (
          // Bảng của ResponsiveDataTable rộng 100% và bóp cột khi tổng bề rộng
          // vượt khung, nên nội dung ô PHẢI co lại theo cột. `minWidth` cứng ở
          // đây từng làm thanh đối chiếu tràn sang đè lên cột "Trạng thái".
          // Flex + minWidth:0 cho thanh co lại, số đếm giữ nguyên không xuống dòng.
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minWidth: 0,
            }}
          >
            <Progress
              percent={percent}
              size="small"
              // Tắt chữ % có sẵn của antd: nó lặp lại thông tin của số đếm bên
              // cạnh mà lại chiếm ~2.5em chiều ngang — chính phần thừa đó đẩy
              // nội dung tràn khỏi ô.
              showInfo={false}
              status={row.status === "POSTED" ? "success" : "normal"}
              style={{ flex: 1, minWidth: 48, margin: 0, lineHeight: 1 }}
            />
            <Box
              component="span"
              sx={{ fontSize: 12, whiteSpace: "nowrap", flex: "none" }}
            >
              {row.scanned}/{row.expected}
            </Box>
          </Box>
        );
      },
    },
    {
      key: "status",
      header: "Trạng thái",
      width: 170,
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <Tag color={STATUS_COLOR[row.status]}>
          {businessLabel(OUTBOUND_STATUS_LABELS, row.status, "Chưa xác định")}
        </Tag>
      ),
    },
  ];

  const renderRowActions = (row: OutboundDocumentRecord) => {
    const mutable = row.status === "DRAFT" || row.status === "SCANNING";
    return (
      <ActionButton
        kind="view"
        sx={{ whiteSpace: "nowrap" }}
        onClick={() => setDetailId(row.id)}
      >
        {mutable && canScan ? "Mở" : "Xem"}
      </ActionButton>
    );
  };

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
            <ActionButton kind="create" onClick={() => setIntakeOpen(true)}>
              Tiếp nhận yêu cầu xuất
            </ActionButton>
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
        <ResponsiveDataTable<OutboundDocumentRecord>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowSelection={rowSelection}
          selectionLabel={(row) => `Chọn phiếu xuất ${row.code || row.id}`}
          loading={listQuery.isLoading || listQuery.isFetching}
          emptyText={tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Chưa có phiếu xuất phù hợp",
          )}
          renderRowActions={renderRowActions}
        />
        <TopPagination
          total={pagination.total}
          current={pagination.current}
          pageSize={perPage}
          unitName="phiếu xuất"
          showSizeChanger={false}
          placement="bottom"
          onChange={(nextPage) => setPage(nextPage)}
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
