import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiText,
  UiTextField,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
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
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import { fetchWarrantyCase } from "@/modules/warranty/services/warrantyService";
import type { WarrantyCase } from "@/modules/warranty/types";
import {
  useComponentIssues,
  warrantyKeys,
} from "@/modules/warranty/hooks/use-warranty";
import type {
  ComponentIssueDocument,
  ComponentIssueStatus,
} from "@/modules/warranty/services/componentIssueService";
import { ComponentIssueModal } from "@/modules/warranty/components/ComponentIssueModal";
import {
  COMPONENT_ISSUE_STATUS_BADGE,
  formatWarrantyDateTime,
  warrantyPiiText,
} from "@/modules/warranty/constants";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";

const SEARCH_DEBOUNCE_MS = 250;

const STATUS_OPTIONS: ComponentIssueStatus[] = [
  "DRAFT",
  "SCANNING",
  "POSTED",
  "CANCELLED",
];

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
};

function normalizeWarehouseRow(row: Record<string, unknown>): WarehouseRow {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? row.warehouse_code ?? ""),
    name: String(row.name ?? row.warehouse_name ?? ""),
  };
}

/**
 * WAR-04 · Danh sách phiếu xuất linh kiện — gom TẤT CẢ phiếu xuất linh kiện
 * xuyên các case bảo hành (phản hồi người dùng 2026-08-30: trước đây chỉ xem
 * được theo từng case, không có nơi tra cứu tổng). Bấm 1 dòng mở lại đúng
 * ComponentIssueModal (COMP-01) hiện có — không tạo luồng thao tác mới.
 *
 * API danh sách chỉ trả về id kho/case, không kèm tên — trang tự tra thêm:
 * tên kho qua 1 lần gọi danh mục kho, mã case/khách hàng qua useQueries theo
 * đúng các case_id xuất hiện trên trang hiện tại (không tải toàn bộ case).
 */
export default function WarrantyComponentIssueListPage() {
  const t = useT();
  const can = useHasPermission();
  const canViewPii = can("warranty.pii.view");
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ComponentIssueStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openTarget, setOpenTarget] = useState<{
    documentId: string;
    caseId: string;
    caseCode?: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useComponentIssues({
    keyword: search || undefined,
    status: status || undefined,
    page,
    per_page: perPage,
  });

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const pagination = resolveApiPagination(listQuery.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "component-issue-list"],
    queryFn: () => fetchWarehouses({ per_page: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const warehouseById = useMemo(() => {
    const map = new Map<string, WarehouseRow>();
    (warehousesQuery.data ?? []).forEach((row) => {
      const wh = normalizeWarehouseRow(row);
      if (wh.id) map.set(wh.id, wh);
    });
    return map;
  }, [warehousesQuery.data]);

  // Chỉ tra case cho các warranty_case_id THỰC SỰ xuất hiện trên trang hiện
  // tại (tối đa = perPage) — không kéo toàn bộ danh sách case về chỉ để lấy tên.
  const caseIds = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.warranty_case_id).filter(Boolean)),
      ),
    [rows],
  );
  const caseQueries = useQueries({
    queries: caseIds.map((caseId) => ({
      queryKey: warrantyKeys.detail(caseId),
      queryFn: () => fetchWarrantyCase(caseId),
      staleTime: 60 * 1000,
    })),
  });
  const caseById = useMemo(() => {
    const map = new Map<string, WarrantyCase>();
    caseIds.forEach((caseId, index) => {
      const data = caseQueries[index]?.data;
      if (data) map.set(caseId, data);
    });
    return map;
  }, [caseIds, caseQueries]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
  };

  const columns: ResponsiveTableColumn<ComponentIssueDocument>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(
          page,
          perPage,
          rows.findIndex((item) => item.id === row.id),
        ),
    },
    {
      key: "component_issue_no",
      header: t("warranty.componentList.colCode"),
      width: 170,
      sortAccessor: (row) => row.component_issue_no || row.id,
      render: (row) => (
        <strong>
          {row.component_issue_no || <CopyableId value={row.id} />}
        </strong>
      ),
    },
    {
      key: "warranty_case",
      header: t("warranty.componentList.colCase"),
      width: 220,
      render: (row) => {
        const caseInfo = caseById.get(row.warranty_case_id);
        if (!caseInfo) {
          return <CopyableId value={row.warranty_case_id} />;
        }
        return (
          <Stack spacing={0}>
            <UiText variant="body">{caseInfo.case_code || EMPTY_TEXT}</UiText>
            <UiText variant="caption">
              {warrantyPiiText(caseInfo.customer_name, canViewPii, "name") ||
                EMPTY_TEXT}
            </UiText>
          </Stack>
        );
      },
    },
    {
      key: "warehouse",
      header: t("warranty.componentList.colWarehouse"),
      width: 190,
      hideOnMobile: true,
      render: (row) => {
        const wh = warehouseById.get(row.warehouse_id);
        if (wh)
          return wh.code ? `${wh.code} · ${wh.name}` : wh.name || EMPTY_TEXT;
        return warehousesQuery.isLoading ? (
          t("warranty.componentList.loading")
        ) : (
          <CopyableId value={row.warehouse_id} />
        );
      },
    },
    {
      key: "document_date",
      header: t("warranty.componentList.colCreated"),
      width: 140,
      sortType: "value",
      sortAccessor: (row) => row.document_date || "",
      render: (row) => formatWarrantyDateTime(row.document_date),
    },
    {
      key: "status",
      header: t("warranty.componentList.colStatus"),
      width: 140,
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={COMPONENT_ISSUE_STATUS_BADGE[row.status]?.tone ?? "neutral"}
          label={COMPONENT_ISSUE_STATUS_BADGE[row.status]?.label ?? row.status}
        />
      ),
    },
    {
      key: "note",
      header: t("warranty.componentList.colNote"),
      width: 220,
      hideOnMobile: true,
      render: (row) => row.cancel_reason || row.note || EMPTY_TEXT,
    },
  ];

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <div className="warranty-component-issue-list-page hn-mvp-source-screen">
      <div className="toolbar">
        <UiTextField
          value={searchInput}
          placeholder={t("warranty.componentList.searchPlaceholder")}
          slotProps={{
            htmlInput: {
              "aria-label": t("warranty.componentList.searchAria"),
            },
          }}
          onChange={(event) => setSearchInput(event.target.value)}
          sx={{ minWidth: 240 }}
        />
        <UiSelect
          value={status}
          aria-label={t("warranty.componentList.statusFilterAria")}
          placeholder={t("warranty.componentList.statusFilterPlaceholder")}
          minWidth={170}
          options={STATUS_OPTIONS.map((value) => ({
            value,
            label: COMPONENT_ISSUE_STATUS_BADGE[value].label,
          }))}
          onChange={(value) => {
            setStatus(value as ComponentIssueStatus | "");
            setPage(1);
          }}
        />
        <UiSelect
          value={perPage}
          aria-label={t("warranty.componentList.pageSizeAria")}
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
        <Box component="span" sx={{ whiteSpace: "nowrap" }}>
          <UiText variant="secondary">
            {t("warranty.componentList.total", {
              count: pagination.total,
            })}
          </UiText>
        </Box>
        <div className="spacer" />
      </div>

      {listQuery.isError ? (
        <Box sx={{ mb: "14px" }}>
          <ApiErrorAlert
            error={listQuery.error}
            title={t("warranty.componentList.loadError")}
            onRetry={() => listQuery.refetch()}
          />
        </Box>
      ) : null}

      <TableLoadingBanner
        loading={listQuery.isLoading || listQuery.isFetching}
      />
      <ResponsiveDataTable<ComponentIssueDocument>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading || listQuery.isFetching}
        emptyText={tableEmptyText(
          listQuery.isError ? listQuery.error : null,
          t("warranty.componentList.empty"),
        )}
        onRowClick={(row) =>
          setOpenTarget({
            documentId: row.id,
            caseId: row.warranty_case_id,
            caseCode: caseById.get(row.warranty_case_id)?.case_code,
          })
        }
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
        <UiPagination
          page={pagination.current}
          pageSize={perPage}
          total={pagination.total}
          showTotal={false}
          onPageChange={(nextPage) => setPage(nextPage)}
        />
      </Box>

      {openTarget ? (
        <ComponentIssueModal
          caseId={openTarget.caseId}
          caseCode={openTarget.caseCode}
          caseActive
          documentId={openTarget.documentId}
          onClose={() => setOpenTarget(null)}
          onChanged={refreshAll}
        />
      ) : null}
    </div>
  );
}
