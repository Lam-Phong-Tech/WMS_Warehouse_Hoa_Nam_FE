import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Box, Stack, UiSelect, UiStatusBadge, UiTextField } from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { useSearchParams } from "react-router-dom";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";
import { MvpPaginationFooter } from "@/shared/components/mvp/MvpListPagination";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import {
  INBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { useAuthStore } from "@/shared/store/auth.store";
import { InboundDraftModal } from "@/modules/inbound/components/InboundDraftModal";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import type { InboundDocument } from "@/modules/inbound/types";
import { formatQuantity } from "@/shared/utils/format-number";
import { ActionButton } from "@/shared/components/actions";

const STATUS_OPTIONS = Object.entries(INBOUND_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as InboundDocument["status"],
    label,
  }),
);
const SEARCH_DEBOUNCE_MS = 250;

function statusTag(status: InboundDocument["status"]) {
  const tone =
    status === "POSTED"
      ? ("success" as const)
      : status === "SCANNING"
        ? ("info" as const)
        : status === "CANCELLED"
          ? ("error" as const)
          : ("warning" as const);
  return (
    <UiStatusBadge
      tone={tone}
      label={businessLabel(INBOUND_STATUS_LABELS, status, "Chưa xác định")}
    />
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

  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const query = useInboundDocuments({
    search: search || undefined,
    status,
    page,
    per_page: perPage,
  });
  const rows = query.data?.data ?? [];
  const rowSelection = useRowSelection(rows, (row) => row.id);
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

  const columns: ResponsiveTableColumn<InboundDocument>[] = [
    {
      key: "stt",
      header: "STT",
      align: "center",
      width: 48,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(
          page,
          perPage,
          rows.findIndex((item) => item.id === row.id),
        ),
    },
    {
      key: "code",
      header: "Phiếu nhập",
      width: 180,
      sortAccessor: (row) => row.code || row.id,
      render: (row) => <strong>{row.code || row.id}</strong>,
    },
    {
      key: "source",
      header: "Nguồn / tham chiếu",
      width: 220,
      sortAccessor: (row) => row.source || "",
      render: (row) => row.source || "-",
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
        // ngày/tháng đệm số 0 cho các dòng thẳng cột nhau.
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
      key: "scanned",
      header: "Số lượng đã quét",
      width: 150,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.scanned,
      render: (row) => formatQuantity(row.scanned),
    },
    {
      key: "status",
      header: "Trạng thái",
      width: 160,
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => statusTag(row.status),
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      width: 180,
      sortType: "value",
      sortAccessor: (row) => row.updatedAt ?? row.date ?? "",
      render: (row) => {
        const value = row.updatedAt ?? row.date;
        if (!value) return "-";
        const parsed = dayjs(value);
        return parsed.isValid() ? parsed.format("DD-MM-YYYY HH:mm") : value;
      },
    },
  ];

  const renderRowActions = (row: InboundDocument) => {
    const mutable = row.status === "DRAFT" || row.status === "SCANNING";
    return (
      <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
        <ActionButton kind="scan" onClick={() => setScanDocumentId(row.id)}>
          {mutable && canScan
            ? row.status === "DRAFT"
              ? "Bắt đầu quét"
              : "Tiếp tục quét"
            : "Xem"}
        </ActionButton>
        {canCreate && mutable ? (
          <ActionButton
            kind="edit"
            onClick={() => {
              setDraftDocumentId(row.id);
              setDraftOpen(true);
            }}
          >
            Sửa thông tin
          </ActionButton>
        ) : null}
      </Stack>
    );
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <div className="inbound-page hn-mvp-source-screen">
      {/* Toolbar filter — thay wireframe vocab `.toolbar/.spacer` bằng Stack/Box
          sx cùng nhịp (gap 8, wrap, mb 14) theo Part 4 Vuexy sync. */}
      <Stack
        direction="row"
        sx={{
          gap: 1,
          alignItems: "center",
          flexWrap: "wrap",
          mb: "14px",
          "& > *": { minWidth: 0, maxWidth: "100%" },
        }}
      >
        <UiTextField
          value={searchInput}
          placeholder="Tìm mã phiếu / nguồn nhập..."
          slotProps={{ htmlInput: { "aria-label": "Tìm phiếu nhập" } }}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ minWidth: 220 }}
        />
        <UiSelect
          value={status ?? ""}
          aria-label="Lọc trạng thái phiếu nhập"
          placeholder="Trạng thái: Tất cả"
          options={STATUS_OPTIONS}
          onChange={(value) => {
            setStatus(value || undefined);
            setPage(1);
          }}
          minWidth={168}
        />
        <UiSelect
          value={perPage}
          aria-label="Số dòng mỗi trang"
          options={perPageOptions.map((size) => ({
            value: size,
            label: `${size} / trang`,
          }))}
          onChange={(value) => {
            setPerPage(Number(value));
            setPage(1);
          }}
          minWidth={100}
        />
        <Box sx={{ flex: 1 }} />
        {canCreate ? (
          <ActionButton
            kind="create"
            onClick={() => {
              setDraftDocumentId(null);
              setDraftOpen(true);
            }}
          >
            Tạo phiếu nhập
          </ActionButton>
        ) : null}
      </Stack>

      {query.isError ? (
        <Box sx={{ mb: "14px" }}>
          <ApiErrorAlert
            error={query.error}
            title="Không tải được danh sách phiếu nhập."
            onRetry={() => query.refetch()}
          />
        </Box>
      ) : null}

      <TableLoadingBanner loading={query.isLoading || query.isFetching} />
      <ResponsiveDataTable<InboundDocument>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowSelection={rowSelection}
        selectionLabel={(row) => `Chọn phiếu nhập ${row.code || row.id}`}
        loading={query.isLoading || query.isFetching}
        renderRowActions={renderRowActions}
        emptyText={tableEmptyText(
          query.isError ? query.error : null,
          "Chưa có phiếu nhập phù hợp",
        )}
      />
      <MvpPaginationFooter
        current={Number(meta?.current_page ?? page)}
        pageSize={perPage}
        total={total}
        itemLabel="phiếu nhập"
        onChange={setPage}
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
  );
}

export default function InboundPage() {
  return <InboundListScreen />;
}
