import { rowIndexOfBy } from "@/shared/components/data-display/row-index";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Box,
  Stack,
  UiSelect,
  UiStatusBadge,
  UiTextField,
  FILTER_WIDTH,
  TOOLBAR_SEARCH_SX,
} from "@/shared/ui";
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
import { useAuthStore } from "@/shared/store/auth.store";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { InboundDraftModal } from "@/modules/inbound/components/InboundDraftModal";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import type { InboundDocument } from "@/modules/inbound/types";
import { formatQuantity } from "@/shared/utils/format-number";
import { ActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";

const STATUS_OPTIONS = Object.entries(INBOUND_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as InboundDocument["status"],
    label,
  }),
);
const SEARCH_DEBOUNCE_MS = 250;

function statusTag(status: InboundDocument["status"], t: TranslateFn) {
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
      label={businessLabel(
        INBOUND_STATUS_LABELS,
        status,
        t("inbound.list.statusUnknown"),
      )}
    />
  );
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

function InboundListScreen() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  // undefined = không lọc; true = chỉ phiếu chờ bổ sung thông tin SKU.
  const [pendingInfo, setPendingInfo] = useState<boolean | undefined>();
  // "Sắp xếp theo" — desc = Mới nhất (phiếu tạo/sửa gần nhất lên đầu, mặc định),
  // asc = Cũ nhất. BE sắp trong SQL nên đổi chiều phải quay về trang 1.
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
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
    pendingProductInfo: pendingInfo,
    sortOrder,
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
          rowIndexOfBy(rows, row, (item) => item.id),
        ),
    },
    {
      key: "code",
      header: t("inbound.list.colDocument"),
      width: 180,
      sortAccessor: (row) => row.code || "",
      // KHÔNG fallback sang row.id: cột này là MÃ PHIẾU đọc được ("PN-…").
      // Thiếu mã thì hiện "—", không in UUID nội bộ cho người dùng.
      render: (row) => <strong>{row.code || EMPTY_TEXT}</strong>,
    },
    {
      key: "source",
      header: t("inbound.list.colSource"),
      width: 220,
      sortAccessor: (row) => row.source || "",
      render: (row) => row.source || EMPTY_TEXT,
    },
    {
      key: "date",
      header: t("inbound.list.colCreated"),
      width: 150,
      hideOnMobile: true,
      sortType: "value",
      sortAccessor: (row) => row.date || "",
      render: (row) => {
        if (!row.date) return EMPTY_TEXT;
        const parsed = dayjs(row.date);
        // Ngày-tháng-năm giờ theo cách đọc của người dùng Việt (22-09-2026 12:00),
        // ngày/tháng đệm số 0 cho các dòng thẳng cột nhau.
        return parsed.isValid() ? parsed.format("DD-MM-YYYY HH:mm") : row.date;
      },
    },
    {
      key: "note",
      header: t("inbound.list.colNote"),
      width: 200,
      hideOnMobile: true,
      sortAccessor: (row) => row.note || "",
      render: (row) => row.note || EMPTY_TEXT,
    },
    {
      key: "scanned",
      header: t("inbound.list.colScannedQty"),
      width: 150,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.scanned,
      render: (row) => formatQuantity(row.scanned),
    },
    {
      key: "status",
      header: t("inbound.list.colStatus"),
      width: 220,
      sortType: "value",
      sortAccessor: (row) => row.status,
      // Phiếu Mini App quét ra SKU mới nằm ở "Đang quét nhận hàng" và KHÔNG Ghi
      // nhận nhập kho được cho tới khi có người bổ sung tên + ĐVT. Không có dấu
      // ở đây thì phải mở từng phiếu mới biết — nên nó nằm ngay cạnh trạng thái.
      render: (row) => (
        <Stack sx={{ gap: 0.5, alignItems: "flex-start" }}>
          {statusTag(row.status, t)}
          {row.pendingProductInfo ? (
            <UiStatusBadge
              tone="warning"
              label={
                row.pendingProductInfoCount > 0
                  ? t("inbound.list.pendingInfoBadgeCount", {
                      count: row.pendingProductInfoCount,
                    })
                  : t("inbound.list.pendingInfoBadge")
              }
            />
          ) : null}
        </Stack>
      ),
    },
    {
      key: "updatedAt",
      header: t("inbound.list.colUpdated"),
      width: 180,
      sortType: "value",
      sortAccessor: (row) => row.updatedAt ?? row.date ?? "",
      render: (row) => {
        const value = row.updatedAt ?? row.date;
        if (!value) return EMPTY_TEXT;
        const parsed = dayjs(value);
        return parsed.isValid() ? parsed.format("DD-MM-YYYY HH:mm") : value;
      },
    },
  ];

  /**
   * IN-01 là màn duy nhất đặt HAI nút có nhãn trong cột Thao tác — xếp DỌC và
   * căn phải để hai nhãn "Tiếp tục quét"/"Sửa thông tin" không tràn khỏi mép
   * cột 96px mặc định (UAT TC_UI_07); bề rộng cột nới ở actionColumnWidth.
   */
  const renderRowActions = (row: InboundDocument) => {
    const mutable = row.status === "DRAFT" || row.status === "SCANNING";
    return (
      <Stack sx={{ gap: 0.5, alignItems: "flex-end" }}>
        <ActionButton kind="scan" onClick={() => setScanDocumentId(row.id)}>
          {mutable && canScan
            ? row.status === "DRAFT"
              ? t("inbound.list.startScan")
              : t("inbound.list.continueScan")
            : t("inbound.list.view")}
        </ActionButton>
        {canCreate && mutable ? (
          <ActionButton
            kind="edit"
            onClick={() => {
              setDraftDocumentId(row.id);
              setDraftOpen(true);
            }}
          >
            {t("inbound.list.editInfo")}
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
          placeholder={t("inbound.list.searchPlaceholder")}
          slotProps={{
            htmlInput: { "aria-label": t("inbound.list.searchAria") },
          }}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={TOOLBAR_SEARCH_SX}
        />
        <UiSelect
          value={status ?? ""}
          aria-label={t("inbound.list.statusFilterAria")}
          placeholder={t("inbound.list.statusFilterPlaceholder")}
          options={STATUS_OPTIONS}
          onChange={(value) => {
            setStatus(value || undefined);
            setPage(1);
          }}
          minWidth={168}
        />
        <UiSelect
          value={pendingInfo === undefined ? "" : pendingInfo ? "1" : "0"}
          aria-label={t("inbound.list.infoFilterAria")}
          placeholder={t("inbound.list.infoFilterPlaceholder")}
          options={[
            { value: "1", label: t("inbound.list.infoFilterPending") },
            { value: "0", label: t("inbound.list.infoFilterComplete") },
          ]}
          onChange={(value) => {
            setPendingInfo(value === "" ? undefined : value === "1");
            setPage(1);
          }}
        />
        {/* Khác các ô lọc (placeholder khi rỗng), ô sắp xếp LUÔN có giá trị nên
            cần nhãn nổi "Sắp xếp theo" — thiếu nó ô chỉ hiện "Mới nhất" trơ
            trọi, không ai hiểu là control gì. */}
        <UiSelect
          value={sortOrder}
          label={t("inbound.list.sortLabel")}
          aria-label={t("inbound.list.sortAria")}
          options={[
            { value: "desc", label: t("inbound.list.sortNewest") },
            { value: "asc", label: t("inbound.list.sortOldest") },
          ]}
          onChange={(value) => {
            setSortOrder(value === "asc" ? "asc" : "desc");
            setPage(1);
          }}
        />
        <UiSelect
          value={perPage}
          aria-label={t("inbound.list.pageSizeAria")}
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
        <Box sx={{ flex: 1 }} />
        {canCreate ? (
          <ActionButton
            kind="create"
            onClick={() => {
              setDraftDocumentId(null);
              setDraftOpen(true);
            }}
          >
            {t("inbound.list.create")}
          </ActionButton>
        ) : null}
      </Stack>

      {query.isError ? (
        <Box sx={{ mb: "14px" }}>
          <ApiErrorAlert
            error={query.error}
            title={t("inbound.list.loadError")}
            onRetry={() => query.refetch()}
          />
        </Box>
      ) : null}

      <TableLoadingBanner loading={query.isLoading || query.isFetching} />
      <ResponsiveDataTable<InboundDocument>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={query.isLoading || query.isFetching}
        renderRowActions={renderRowActions}
        actionColumnWidth={168}
        emptyText={tableEmptyText(
          query.isError ? query.error : null,
          t("inbound.list.empty"),
        )}
      />
      <MvpPaginationFooter
        current={Number(meta?.current_page ?? page)}
        pageSize={perPage}
        total={total}
        itemLabel={t("inbound.list.itemLabel")}
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
