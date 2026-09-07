/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateStockDerived } from "@/shared/cache/invalidation";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  LinearProgress,
  Stack,
  UiSelect,
  UiStatusBadge,
  UiTextField,
  type UiStatusTone,
  FILTER_WIDTH,
  TOOLBAR_SEARCH_SX,
} from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
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
import { EMPTY_TEXT } from "@/shared/constants/display";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

const SEARCH_DEBOUNCE_MS = 250;

const STATUS_OPTIONS: Array<{ value: OutboundStatus; label: string }> =
  Object.entries(OUTBOUND_STATUS_LABELS).map(([value, label]) => ({
    value: value as OutboundStatus,
    label,
  }));

/** Tông màu soft-tint theo UiStatusBadge — "processing" (antd cũ) ⇒ info. */
const STATUS_TONE: Record<OutboundStatus, UiStatusTone> = {
  DRAFT: "warning",
  SCANNING: "info",
  POSTED: "success",
  CANCELLED: "error",
};

const DETAIL_SCREENS = new Set(["OUT-03", "OUT-02", "LBL-01", "RFID-01"]);

/** BA baseline 2026-08-25: quét đủ -> Post Issue -> Packing Label độc lập; RFID tùy chọn. */
export default function AlignedMvpOutboundPage() {
  const t = useT();
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
      render: (row) => mvpRowNumber(page, perPage, rowIndexOf(rows, row)),
    },
    {
      key: "code",
      header: t("outbound.list.colDocument"),
      width: 190,
      sortAccessor: (row) => row.code || "",
      // KHÔNG fallback sang row.id: cột này là MÃ PHIẾU đọc được ("PX-…").
      render: (row) => <strong>{row.code || EMPTY_TEXT}</strong>,
    },
    {
      key: "request",
      header: t("outbound.list.colRequestNo"),
      width: 150,
      hideOnMobile: true,
      sortAccessor: (row) => row.requestNo ?? "",
      render: (row) => {
        if (!row.outboundRequestId) {
          return (
            <UiStatusBadge
              tone="error"
              label={t("outbound.list.missingRequest")}
            />
          );
        }
        // Chỉ hiện MÃ TOA đọc được (request_no). Trước đây khi thiếu request_no
        // thì rút gọn UUID và nhét nguyên chuỗi thô vào thuộc tính title —
        // người dùng rê chuột là thấy. Nay thiếu mã thì báo thẳng bằng lời.
        return row.requestNo ? (
          <span>{row.requestNo}</span>
        ) : (
          <UiStatusBadge
            tone="warning"
            label={t("outbound.list.noRequestNo")}
          />
        );
      },
    },
    {
      key: "recipientName",
      header: t("outbound.list.colRecipient"),
      width: 190,
      sortAccessor: (row) => row.recipientName,
      render: (row) => row.recipientName,
    },
    {
      key: "date",
      header: t("outbound.list.colCreated"),
      width: 150,
      hideOnMobile: true,
      sortType: "value",
      sortAccessor: (row) => row.date || "",
      render: (row) => {
        if (!row.date) return EMPTY_TEXT;
        const parsed = dayjs(row.date);
        // Ngày-tháng-năm giờ theo cách đọc của người dùng Việt (22-09-2026 12:00),
        // cùng chuẩn với cột Ngày tạo bên Danh sách phiếu nhập.
        return parsed.isValid() ? parsed.format("DD-MM-YYYY HH:mm") : row.date;
      },
    },
    {
      key: "note",
      header: t("outbound.list.colNote"),
      width: 200,
      hideOnMobile: true,
      sortAccessor: (row) => row.note || "",
      render: (row) => row.note || EMPTY_TEXT,
    },
    {
      key: "match",
      header: t("outbound.list.colReconcile"),
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
          // Không hiện chữ % trên thanh: nó lặp lại thông tin của số đếm bên
          // cạnh mà lại chiếm chiều ngang — chính phần thừa đó từng đẩy nội
          // dung tràn khỏi ô (thời antd Progress showInfo).
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minWidth: 0,
            }}
          >
            <LinearProgress
              variant="determinate"
              value={percent}
              color={row.status === "POSTED" ? "success" : "primary"}
              sx={{ flex: 1, minWidth: 48 }}
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
      header: t("outbound.list.colStatus"),
      width: 170,
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={STATUS_TONE[row.status]}
          label={businessLabel(
            OUTBOUND_STATUS_LABELS,
            row.status,
            t("outbound.list.statusUnknown"),
          )}
        />
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
        {mutable && canScan ? t("outbound.list.open") : t("outbound.list.view")}
      </ActionButton>
    );
  };

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["mvp-outbound"] });
    void invalidateStockDerived(queryClient);
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <>
      <div className="outbound-page hn-mvp-source-screen">
        <Stack
          className="toolbar"
          direction="row"
          sx={{ gap: 1, alignItems: "center", flexWrap: "wrap", mb: "14px" }}
        >
          <UiTextField
            value={searchInput}
            placeholder={t("outbound.list.searchPlaceholder")}
            slotProps={{
              htmlInput: { "aria-label": t("outbound.list.searchAria") },
            }}
            onChange={(event) => setSearchInput(event.target.value)}
            sx={TOOLBAR_SEARCH_SX}
          />
          <UiSelect
            aria-label={t("outbound.list.statusFilterAria")}
            value={status}
            placeholder={t("outbound.list.statusFilterPlaceholder")}
            options={STATUS_OPTIONS}
            onChange={(value) => {
              setStatus(value as OutboundStatus | "");
              setPage(1);
            }}
            minWidth={168}
          />
          <UiSelect
            aria-label={t("outbound.list.pageSizeAria")}
            value={perPage}
            options={perPageOptions.map((size) => ({
              value: size,
              label: `${size} / trang`,
            }))}
            onChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
            minWidth={FILTER_WIDTH.pageSize}
          />
          <Box className="spacer" sx={{ flex: 1 }} />
          {canImport ? (
            <ActionButton kind="create" onClick={() => setIntakeOpen(true)}>
              {t("outbound.list.intake")}
            </ActionButton>
          ) : null}
        </Stack>

        {listQuery.isError ? (
          <Box sx={{ mb: "14px" }}>
            <ApiErrorAlert
              error={listQuery.error}
              title={t("outbound.list.loadError")}
              onRetry={() => listQuery.refetch()}
            />
          </Box>
        ) : null}

        <TableLoadingBanner
          loading={listQuery.isLoading || listQuery.isFetching}
        />
        <ResponsiveDataTable<OutboundDocumentRecord>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading || listQuery.isFetching}
          emptyText={tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            t("outbound.list.empty"),
          )}
          renderRowActions={renderRowActions}
        />
        <TopPagination
          total={pagination.total}
          current={pagination.current}
          pageSize={perPage}
          unitName={t("outbound.list.unitName")}
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
    </>
  );
}
