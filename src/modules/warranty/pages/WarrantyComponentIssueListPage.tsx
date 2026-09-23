import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Menu,
  MenuItem,
  UiIcon,
  UiPagination,
  UiSelect,
  UiTextField,
} from "@/shared/ui";
import { useWarehouseDirectory } from "@/shared/data/reference-queries";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
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
import { fetchWarrantyCase } from "@/modules/warranty/services/warrantyService";
import type { WarrantyCase } from "@/modules/warranty/types";
import {
  useComponentIssues,
  warrantyKeys,
} from "@/modules/warranty/hooks/use-warranty";
import {
  fetchComponentIssueDocument,
  type ComponentIssueDocument,
  type ComponentIssueStatus,
} from "@/modules/warranty/services/componentIssueService";
import { ComponentIssueModal } from "@/modules/warranty/components/ComponentIssueModal";
import { ComponentIssueOverview } from "@/modules/warranty/components/ComponentIssueOverview";
import { ComponentIssueCasePicker } from "@/modules/warranty/components/ComponentIssueCasePicker";
import {
  WARRANTY_STATUS_LABELS,
  warrantyPiiText,
} from "@/modules/warranty/constants";
import { mvpMasterKeys } from "@/modules/master-data/hooks/use-mvp-master";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { useT } from "@/shared/i18n/useT";
import {
  fetchComponentIssueSkuIndex,
  fetchComponentIssueTrackingRows,
  withComponentIssueReadSlot,
  resolveComponentIssueTracking,
} from "./component-issue-list-data";
import "./warranty-component-issues.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

const getSTATUS_LABELS = localizedUiValue(
  (): Record<ComponentIssueStatus, string> => ({
    DRAFT: tUi("outbound.detail.labelStatusDraft"),
    SCANNING: tUi("updatedUi.text_097ecdcddc79"),
    POSTED: tUi("catalog.common.posted"),
    CANCELLED: tUi("warranty.status.cancelled"),
  }),
);
const EMPTY_SKU_INDEX = new Map<string, SkuRecord>();
const SORT_ACCESSORS = {
  code: (row: ComponentIssueDocument) => row.component_issue_no || row.id,
  date: (row: ComponentIssueDocument) =>
    row.posted_at || row.document_date || "",
  status: (row: ComponentIssueDocument) => row.status,
};
type Tracking = "" | "SERIAL" | "QUANTITY";
type OpenTarget = { documentId?: string; caseId: string; caseCode?: string };

function displayDate(value?: string) {
  if (!value) return EMPTY_TEXT;
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY · HH:mm") : EMPTY_TEXT;
}

/** WAR-04 presentation. Mutations remain owned by the existing COMP-01 modal. */
export default function WarrantyComponentIssueListPage() {
  const t = useT();
  const can = useHasPermission();
  const navigate = useNavigate();
  const canViewPii = can("warranty.pii.view");
  const canIssue = can("warranty.component_issue");
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ComponentIssueStatus | "">("");
  const [tracking, setTracking] = useState<Tracking>("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openTarget, setOpenTarget] = useState<OpenTarget | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<{
    anchor: HTMLElement;
    row: ComponentIssueDocument;
  } | null>(null);
  const [warehouseAnchor, setWarehouseAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const listQuery = useComponentIssues(
    {
      keyword: search || undefined,
      status: status || undefined,
      page,
      per_page: perPage,
    },
    !tracking,
  );
  // The API has no tracking parameter. Resolve this view filter over complete,
  // paginated results so it never reports a page-local subset as a global total.
  const trackingQuery = useQuery({
    queryKey: [
      ...warrantyKeys.all,
      "component-issues-by-tracking",
      { search, status, tracking },
    ],
    queryFn: () =>
      fetchComponentIssueTrackingRows(queryClient, {
        keyword: search || undefined,
        status: status || undefined,
        tracking: tracking as "SERIAL" | "QUANTITY",
      }),
    enabled: Boolean(tracking),
  });
  const activeQuery = tracking ? trackingQuery : listQuery;
  const rows = useMemo(
    () =>
      tracking
        ? (trackingQuery.data ?? []).slice((page - 1) * perPage, page * perPage)
        : (listQuery.data?.data ?? []),
    [tracking, trackingQuery.data, listQuery.data, page, perPage],
  );
  const pagination = resolveApiPagination(
    tracking
      ? {
          total: trackingQuery.data?.length ?? 0,
          current_page: page,
          per_page: perPage,
        }
      : listQuery.data?.meta,
    { page, pageSize: perPage, rowCount: rows.length },
  );
  const reportedTotal = tracking
    ? trackingQuery.data?.length
    : listQuery.data?.meta?.total;
  const hasKnownTotal =
    activeQuery.isSuccess &&
    typeof reportedTotal === "number" &&
    Number.isSafeInteger(reportedTotal) &&
    reportedTotal >= 0;
  const { sortedRows, sortState, requestSort } = useClientSort(
    rows,
    SORT_ACCESSORS,
  );
  const warehousesQuery = useWarehouseDirectory();
  const warehouseById = useMemo(
    () =>
      new Map(
        (warehousesQuery.data ?? []).map((row) => [String(row.id ?? ""), row]),
      ),
    [warehousesQuery.data],
  );
  const activeWarehouse = (warehousesQuery.data ?? []).find(
    (row) => row.status === "ACTIVE",
  );
  const warehouseName = activeWarehouse
    ? String(
        activeWarehouse.name ?? activeWarehouse.warehouse_name ?? "Kho Hoa Nam",
      )
    : "Kho Hoa Nam";
  const caseIds = useMemo(
    () => [...new Set(rows.map((row) => row.warranty_case_id).filter(Boolean))],
    [rows],
  );
  const caseQueries = useQueries({
    queries: caseIds.map((caseId) => ({
      queryKey: warrantyKeys.detail(caseId),
      queryFn: () =>
        withComponentIssueReadSlot(() => fetchWarrantyCase(caseId)),
    })),
  });
  const caseById = new Map<string, WarrantyCase>();
  caseIds.forEach((id, index) => {
    const data = caseQueries[index]?.data;
    if (data) caseById.set(id, data);
  });
  const detailIds = useMemo(
    () => rows.filter((row) => !row.lines.length).map((row) => row.id),
    [rows],
  );
  const detailQueries = useQueries({
    queries: detailIds.map((id) => ({
      queryKey: warrantyKeys.componentIssueDetail(id),
      queryFn: () =>
        withComponentIssueReadSlot(() => fetchComponentIssueDocument(id)),
    })),
  });
  const detailById = new Map<string, ComponentIssueDocument>();
  detailIds.forEach((id, index) => {
    const data = detailQueries[index]?.data;
    if (data) detailById.set(id, data);
  });
  const documents = rows.map((row) => detailById.get(row.id) ?? row);
  const skuIdentities = [
    ...new Set(
      documents.flatMap((row) =>
        row.lines.map((line) => JSON.stringify([line.sku_id, line.sku_code])),
      ),
    ),
  ].sort();
  const skuIndexQuery = useQuery({
    queryKey: [...warrantyKeys.all, "component-issue-sku-index", skuIdentities],
    queryFn: () => fetchComponentIssueSkuIndex(queryClient, documents),
    enabled: skuIdentities.length > 0,
  });
  const skuById = skuIndexQuery.data ?? EMPTY_SKU_INDEX;
  const relatedError =
    detailQueries.some((query) => query.isError) ||
    caseQueries.some((query) => query.isError) ||
    skuIndexQuery.isError;
  const hasFilters = Boolean(searchInput || status || tracking);
  const isInitialLoading =
    activeQuery.isLoading || (activeQuery.isPending && !online);
  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
  };
  const openDocument = (row: ComponentIssueDocument) =>
    setOpenTarget({
      documentId: row.id,
      caseId: row.warranty_case_id,
      caseCode: caseById.get(row.warranty_case_id)?.case_code,
    });
  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setTracking("");
    setPage(1);
  };
  const applyFilters = () => {
    if (search !== searchInput.trim()) {
      setSearch(searchInput.trim());
      setPage(1);
    } else void activeQuery.refetch();
  };
  const trackingLabel = (document: ComponentIssueDocument) => {
    const value = resolveComponentIssueTracking(document, skuById);
    return value === "SERIAL"
      ? "Serial"
      : value === "QUANTITY"
        ? "Box + SL"
        : value === "MIXED"
          ? "Serial · Box + SL"
          : EMPTY_TEXT;
  };
  const renderComponents = (row: ComponentIssueDocument) => {
    const document = detailById.get(row.id) ?? row;
    const query = detailQueries[detailIds.indexOf(row.id)];
    if (!document.lines.length)
      return (
        <span className="hn-war04-muted">
          {query?.isLoading
            ? tUi("warranty.detail.uploading")
            : query?.isError
              ? tUi("updatedUi.text_5b436b07866c")
              : EMPTY_TEXT}
        </span>
      );
    const title = document.lines
      .map((line) => `${line.sku_code || line.sku_id} · ${line.sku_name}`)
      .join("; ");
    return (
      <span className="hn-war04-component-summary" title={title}>
        <span>
          {document.lines[0].sku_code || document.lines[0].sku_id} ·{" "}
          {document.lines[0].sku_name}
        </span>
        <small>
          {new Set(document.lines.map((line) => line.sku_id)).size} SKU ·{" "}
          {document.lines
            .reduce((total, line) => total + line.required_qty, 0)
            .toLocaleString("vi-VN")}{" "}
          {tUi("updatedUi.text_835ab3a8df42")}
        </small>
      </span>
    );
  };

  return (
    <div
      className="hn-war04 warranty-component-issue-list-page"
      data-screen="WAR-04"
    >
      <header className="hn-war04-header">
        <div className="hn-war04-heading">
          <nav
            className="hn-war04-breadcrumb"
            aria-label={tUi("updatedUi.text_4b213f6974d1")}
          >
            <button
              type="button"
              onClick={() => navigate("/warranty?screen=WAR-01")}
            >
              {tUi("updatedUi.text_3df91fdd6362")}
            </button>
            <span>/</span>
            <span>{tUi("warranty.detail.colIssueCode")}</span>
          </nav>
          <h1>{tUi("updatedUi.text_c16cb40fc462")}</h1>
          <p>{tUi("updatedUi.text_3d3d7084fc83")}</p>
        </div>
        <div className="hn-war04-header-actions">
          <button
            type="button"
            className="hn-war04-button hn-war04-primary"
            onClick={() => setCreateOpen(true)}
            disabled={!canIssue || !online}
            title={
              !canIssue
                ? tUi("updatedUi.text_8b9ea58d5387")
                : !online
                  ? tUi("updatedUi.text_ee41b3a150d1")
                  : undefined
            }
          >
            <UiIcon name="plus" size="sm" />
            {tUi("updatedUi.text_6f935d4fb7e5")}
          </button>
          <button
            type="button"
            className="hn-war04-warehouse"
            aria-label={tUi("updatedUi.text_b1358217705d")}
            aria-haspopup="menu"
            aria-expanded={Boolean(warehouseAnchor)}
            onClick={(event) => setWarehouseAnchor(event.currentTarget)}
          >
            <UiIcon name="warehouse-alt" />
            <span>
              <strong>{warehouseName}</strong>
              <small>
                {warehousesQuery.isLoading ? (
                  tUi("warranty.detail.uploading")
                ) : warehousesQuery.isError ? (
                  tUi("updatedUi.text_e2fc06eb7f37")
                ) : activeWarehouse ? (
                  <>
                    <i />
                    {tUi("dashboard.snapshot.warehouseActive")}
                  </>
                ) : (
                  tUi("updatedUi.text_5b9b6206bb97")
                )}
              </small>
            </span>
          </button>
        </div>
        <p className="hn-war04-header-note">
          {tUi("updatedUi.text_538fdb6d29e5")}
        </p>
      </header>
      <ComponentIssueOverview
        onStatusSelect={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />
      <aside className="hn-war04-stock-note">
        <UiIcon name="info" size="sm" />
        <span>
          <strong>{tUi("updatedUi.text_9a966c0016ec")}</strong>
          <small>{tUi("updatedUi.text_d988df33685a")}</small>
        </span>
      </aside>
      {!online ? (
        <div className="hn-war04-warning" role="status">
          <UiIcon name="wifi-slash" size="sm" />
          {tUi("updatedUi.text_2ee63258302d")}
        </div>
      ) : null}
      <section
        className="hn-war04-list"
        aria-labelledby="hn-war04-list-title"
        aria-busy={activeQuery.isFetching}
      >
        <div className="hn-war04-list-heading">
          <h2 id="hn-war04-list-title">
            {tUi("updatedUi.text_e8768a710dc6")}{" "}
            <span
              className="hn-war04-count"
              aria-label={
                hasKnownTotal
                  ? t("warranty.componentList.total", {
                      count: pagination.total,
                    })
                  : tUi("updatedUi.text_b254b45a81d8")
              }
            >
              {hasKnownTotal ? pagination.total.toLocaleString("vi-VN") : "—"}
            </span>
          </h2>
          <button
            type="button"
            className="hn-war04-refresh"
            onClick={refreshAll}
            disabled={activeQuery.isFetching || !online}
            title={tUi("updatedUi.text_3e8bc3252b10")}
          >
            {activeQuery.isFetching
              ? tUi("updatedUi.text_f1d2b14e62c7")
              : tUi("updatedUi.text_83ddf4187c12")}
          </button>
        </div>
        <form
          className="hn-war04-filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="hn-war04-field hn-war04-search">
            <label htmlFor="hn-war04-search">
              {tUi("reports.packingLabel.searchLabel")}
            </label>
            <UiTextField
              id="hn-war04-search"
              value={searchInput}
              placeholder=""
              slotProps={{
                htmlInput: {
                  "aria-label": t("warranty.componentList.searchAria"),
                },
              }}
              onChange={(event) => setSearchInput(event.target.value)}
              fullWidth
            />
          </div>
          <div className="hn-war04-field">
            <label htmlFor="hn-war04-status">
              {tUi("dashboard.composition.colStatus")}
            </label>
            <UiSelect
              id="hn-war04-status"
              value={status}
              aria-label={t("warranty.componentList.statusFilterAria")}
              displayEmpty
              fullWidth
              menuClassName="hn-war04-menu"
              options={[
                { value: "", label: tUi("dashboard.operations.filterAll") },
                ...Object.entries(getSTATUS_LABELS()).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              onChange={(value) => {
                setStatus(value as ComponentIssueStatus | "");
                setPage(1);
              }}
            />
          </div>
          <div className="hn-war04-field">
            <label htmlFor="hn-war04-tracking">
              {tUi("dashboard.severity.p2")}
            </label>
            <UiSelect
              id="hn-war04-tracking"
              value={tracking}
              aria-label={tUi("updatedUi.text_a9a7bcf8d30a")}
              displayEmpty
              fullWidth
              menuClassName="hn-war04-menu"
              options={[
                { value: "", label: tUi("dashboard.operations.filterAll") },
                { value: "SERIAL", label: "Serial" },
                { value: "QUANTITY", label: "Box + SL" },
              ]}
              onChange={(value) => {
                setTracking(value as Tracking);
                setPage(1);
              }}
            />
          </div>
          <div className="hn-war04-filter-actions">
            <button
              type="submit"
              className="hn-war04-button hn-war04-primary"
              disabled={activeQuery.isFetching || !online}
            >
              {tUi("dashboard.snapshot.apply")}
            </button>
            <button
              type="button"
              className="hn-war04-button hn-war04-reset"
              onClick={resetFilters}
            >
              {tUi("reports.packingLabel.reset")}
            </button>
          </div>
        </form>
        {activeQuery.isError ? (
          <ApiErrorAlert
            error={activeQuery.error}
            title={t("warranty.componentList.loadError")}
            onRetry={() => activeQuery.refetch()}
          />
        ) : null}
        {relatedError && !activeQuery.isError ? (
          <div className="hn-war04-warning" role="status">
            {tUi("updatedUi.text_11b3c173ea45")}
            <button
              type="button"
              onClick={() => {
                refreshAll();
                void queryClient.invalidateQueries({
                  queryKey: mvpMasterKeys.all,
                });
              }}
            >
              {tUi("common.retry")}
            </button>
          </div>
        ) : null}
        <TableLoadingBanner
          loading={activeQuery.isFetching && !isInitialLoading}
        />
        {isInitialLoading ? (
          <div
            className="hn-war04-loading"
            {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-table")}
            aria-busy="true"
            role="status"
          >
            <span>{tUi("updatedUi.text_08bfc6f1ff01")}</span>
            {[0, 1, 2, 3, 4].map((value) => (
              <div className="hn-war04-skeleton" key={value} />
            ))}
          </div>
        ) : rows.length ? (
          <div className="hn-war04-table-wrap">
            <table
              className="hn-war04-table"
              aria-label={tUi("updatedUi.text_11362358afdc")}
            >
              <colgroup>
                <col className="hn-war04-code-col" />
                <col className="hn-war04-case-col" />
                <col className="hn-war04-components-col" />
                <col className="hn-war04-tracking-col" />
                <col className="hn-war04-status-col" />
                <col className="hn-war04-date-col" />
                <col className="hn-war04-actions-col" />
              </colgroup>
              <thead>
                <tr>
                  <SortableTh
                    label={tUi("inbound.detail.fieldDocument")}
                    sortKey="code"
                    sortState={sortState}
                    onSort={requestSort}
                  />
                  <th>{tUi("notifications.subject.warrantyCase")}</th>
                  <th className="hn-war04-desktop">
                    {tUi("dashboard.skuType.component")}
                  </th>
                  <th className="hn-war04-desktop">
                    {tUi("dashboard.severity.p2")}
                  </th>
                  <SortableTh
                    label={tUi("dashboard.composition.colStatus")}
                    sortKey="status"
                    sortState={sortState}
                    onSort={requestSort}
                  />
                  <SortableTh
                    label={tUi("updatedUi.text_5293d03c5908")}
                    sortKey="date"
                    sortType="value"
                    sortState={sortState}
                    onSort={requestSort}
                  />
                  <th>{tUi("outbound.detail.colAction")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const caseInfo = caseById.get(row.warranty_case_id);
                  const caseQuery =
                    caseQueries[caseIds.indexOf(row.warranty_case_id)];
                  const document = detailById.get(row.id) ?? row;
                  const warehouse = warehouseById.get(row.warehouse_id);
                  const warehouseText = warehouse
                    ? `${String(warehouse.code ?? warehouse.warehouse_code ?? "")} · ${String(warehouse.name ?? warehouse.warehouse_name ?? "")}`
                    : row.warehouse_id;
                  const action =
                    row.status === "DRAFT"
                      ? tUi("updatedUi.text_7a77d7612e12")
                      : row.status === "SCANNING"
                        ? tUi("outbound.detail.postConfirm")
                        : tUi("reports.importMatchReport.detail");
                  return (
                    <tr key={row.id} onClick={() => openDocument(row)}>
                      <td data-label={tUi("inbound.detail.fieldDocument")}>
                        <button
                          type="button"
                          className="hn-war04-code"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDocument(row);
                          }}
                        >
                          {row.component_issue_no || row.id}
                        </button>
                        <span className="hn-war04-compact hn-war04-muted">
                          {trackingLabel(document)}
                        </span>
                        <span className="hn-war04-sr-only">
                          {warehouseText}
                        </span>
                      </td>
                      <td
                        data-label={tUi("notifications.subject.warrantyCase")}
                      >
                        <span className="hn-war04-case-code">
                          {caseInfo?.case_code || (
                            <span onClick={(event) => event.stopPropagation()}>
                              <CopyableId value={row.warranty_case_id} />
                            </span>
                          )}
                        </span>
                        <small className="hn-war04-case-status">
                          {caseInfo
                            ? `${caseInfo.identification_type === "TEMP_ONLY" ? "TEMP_ONLY · " : ""}${WARRANTY_STATUS_LABELS[caseInfo.status] ?? EMPTY_TEXT}`
                            : caseQuery?.isError
                              ? tUi("updatedUi.text_82a90f6c797e")
                              : caseQuery?.isPending
                                ? tUi("warranty.detail.uploading")
                                : EMPTY_TEXT}
                        </small>
                        <span className="hn-war04-compact">
                          {renderComponents(row)}
                        </span>
                        <span className="hn-war04-sr-only">
                          {caseInfo
                            ? warrantyPiiText(
                                caseInfo.customer_name,
                                canViewPii && !caseInfo.pii_masked,
                                "name",
                              )
                            : ""}
                        </span>
                      </td>
                      <td
                        data-label={tUi("dashboard.skuType.component")}
                        className="hn-war04-desktop"
                      >
                        {renderComponents(row)}
                      </td>
                      <td
                        data-label={tUi("dashboard.severity.p2")}
                        className="hn-war04-desktop"
                      >
                        {trackingLabel(document)}
                      </td>
                      <td data-label={tUi("dashboard.composition.colStatus")}>
                        <span
                          className={`hn-war04-status hn-war04-status-${row.status.toLowerCase()}`}
                        >
                          {getSTATUS_LABELS()[row.status] ?? row.status}
                        </span>
                      </td>
                      <td data-label={tUi("updatedUi.text_5293d03c5908")}>
                        <time
                          dateTime={row.posted_at || row.document_date}
                          title={
                            row.posted_at
                              ? tUi("reports.inventoryFlow.colPostedAt")
                              : tUi("updatedUi.text_a17e6038ba64")
                          }
                        >
                          {displayDate(row.posted_at || row.document_date)}
                        </time>
                      </td>
                      <td data-label={tUi("outbound.detail.colAction")}>
                        <RowActionGroup
                          className="hn-war04-row-actions"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <RowActionButton
                            kind={
                              row.status === "DRAFT"
                                ? "edit"
                                : row.status === "SCANNING"
                                  ? "scan"
                                  : "view"
                            }
                            label={action}
                            onClick={() => openDocument(row)}
                            aria-label={`${action} ${row.component_issue_no || row.id}`}
                          />
                          <RowActionButton
                            kind="more"
                            aria-label={tUi("updatedUi.text_391ce00892b9", {
                              value0: String(row.component_issue_no || row.id),
                            })}
                            aria-haspopup="menu"
                            aria-expanded={rowMenu?.row.id === row.id}
                            onClick={(event) =>
                              setRowMenu({ anchor: event.currentTarget, row })
                            }
                          />
                        </RowActionGroup>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hn-war04-empty">
            {tableEmptyText(
              activeQuery.isError ? activeQuery.error : null,
              hasFilters
                ? tUi("updatedUi.text_63b19aadd227")
                : t("warranty.componentList.empty"),
            )}
            {hasFilters && !activeQuery.isError ? (
              <button
                type="button"
                className="hn-war04-button"
                onClick={resetFilters}
              >
                {tUi("updatedUi.text_f8f509b1e9da")}
              </button>
            ) : null}
          </div>
        )}
        <footer className="hn-war04-pagination">
          <span>
            {!hasKnownTotal
              ? tUi("updatedUi.text_b254b45a81d8")
              : tracking
                ? tUi("updatedUi.text_1c482bfc5151", {
                    value0: String(rows.length),
                    value1: String(pagination.total),
                  })
                : tUi("updatedUi.text_4fb2cad0256d", {
                    value0: String(
                      rows.length
                        ? (pagination.current - 1) * pagination.pageSize + 1
                        : 0,
                    ),
                    value1: String(
                      rows.length
                        ? (pagination.current - 1) * pagination.pageSize +
                            rows.length
                        : 0,
                    ),
                    value2: String(pagination.total),
                  })}
          </span>
          <div className="hn-war04-pagination-controls">
            <UiSelect
              value={perPage}
              aria-label={t("warranty.componentList.pageSizeAria")}
              menuClassName="hn-war04-menu"
              options={MVP_PAGE_SIZE_OPTIONS.map((size) => ({
                value: size,
                label: `${size} / trang`,
              }))}
              onChange={(value) => {
                setPerPage(Number(value));
                setPage(1);
              }}
            />
            {hasKnownTotal ? (
              <UiPagination
                page={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                showTotal={false}
                onPageChange={setPage}
                disabled={activeQuery.isFetching}
              />
            ) : null}
          </div>
        </footer>
      </section>
      <p className="hn-war04-footer-note">
        {tUi("updatedUi.text_98a5893d0fce")}
      </p>
      <Menu
        anchorEl={rowMenu?.anchor ?? null}
        open={Boolean(rowMenu)}
        onClose={() => setRowMenu(null)}
        slotProps={{ paper: { className: "hn-war04-menu" } }}
      >
        <MenuItem
          onClick={() => {
            if (rowMenu) openDocument(rowMenu.row);
            setRowMenu(null);
          }}
        >
          <UiIcon name="eye" size="sm" />
          {tUi("updatedUi.text_913855b2952b")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (rowMenu)
              navigate(
                `/warranty?screen=WAR-03&id=${encodeURIComponent(rowMenu.row.warranty_case_id)}`,
              );
            setRowMenu(null);
          }}
        >
          <UiIcon name="document" size="sm" />
          {tUi("dashboard.insight.warrantyAction")}
        </MenuItem>
        {rowMenu ? (
          <li className="hn-war04-menu-detail" role="presentation">
            <strong>{tUi("warranty.componentList.colWarehouse")}</strong>
            <span>
              {String(
                warehouseById.get(rowMenu.row.warehouse_id)?.name ??
                  rowMenu.row.warehouse_id,
              )}
            </span>
            <strong>{tUi("inbound.list.colNote")}</strong>
            <span>
              {rowMenu.row.cancel_reason || rowMenu.row.note || EMPTY_TEXT}
            </span>
          </li>
        ) : null}
      </Menu>
      <Menu
        anchorEl={warehouseAnchor}
        open={Boolean(warehouseAnchor)}
        onClose={() => setWarehouseAnchor(null)}
        slotProps={{ paper: { className: "hn-war04-menu" } }}
      >
        <li className="hn-war04-menu-detail" role="presentation">
          <strong>{warehouseName}</strong>
          <span>
            {activeWarehouse
              ? String(
                  activeWarehouse.code ?? activeWarehouse.warehouse_code ?? "",
                )
              : tUi("updatedUi.text_d75562257216")}
          </span>
          <span>{tUi("updatedUi.text_e2f1a830e8f7")}</span>
        </li>
        {warehousesQuery.isError ? (
          <MenuItem
            onClick={() => {
              void warehousesQuery.refetch();
              setWarehouseAnchor(null);
            }}
          >
            {tUi("common.retry")}
          </MenuItem>
        ) : null}
      </Menu>
      {createOpen ? (
        <ComponentIssueCasePicker
          onClose={() => setCreateOpen(false)}
          onSelect={(caseInfo) => {
            setCreateOpen(false);
            setOpenTarget({
              caseId: caseInfo.id,
              caseCode: caseInfo.case_code,
            });
          }}
        />
      ) : null}
      {openTarget ? (
        <ComponentIssueModal
          className="hn-war04-dialog"
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
