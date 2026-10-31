import { ReportWarehouseCard } from "@/modules/reports/components/ReportWarehouseCard";
import { CheckOutlined } from "@/shared/components/icons";
import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { renderSortIcon } from "@/shared/components/data-display/renderSortIcon";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dayjs from "dayjs";
import { UiVuexyDateField, VuexyDemoIcon } from "@/shared/ui";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { reportStatusLabel } from "@/modules/reports/operations/report-labels";
import { useReportExport } from "@/modules/reports/operations/report-export";
import {
  ISO_DATE,
  useInventoryFlowSnapshot,
  type FlowDocument,
} from "./inventory-flow-api";
import "./inbound-flow-report.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15] as const;
const COMPLETE_STATUSES = new Set(["POSTED", "COMPLETED", "VALIDATED"]);
const PROCESSING_STATUSES = new Set([
  "SCANNING",
  "CHECKING",
  "RECEIVED",
  "REPAIRING",
]);
const CANCELLED_STATUSES = new Set(["CANCELLED", "REJECTED", "ERROR"]);

type DateRange = { from: string; to: string };
type ProgressTone = "complete" | "processing" | "pending";

function initialRange(): DateRange {
  return {
    from: dayjs().subtract(6, "day").format(ISO_DATE),
    to: dayjs().format(ISO_DATE),
  };
}

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function statusTone(status: string): ProgressTone | "cancelled" {
  const normalized = normalizeStatus(status);
  if (COMPLETE_STATUSES.has(normalized)) return "complete";
  if (PROCESSING_STATUSES.has(normalized)) return "processing";
  if (CANCELLED_STATUSES.has(normalized)) return "cancelled";
  return "pending";
}

function inboundStatusLabel(status: string) {
  const tone = statusTone(status);
  if (tone === "complete") return tUi("iam.permissionAction.post");
  if (tone === "processing") return tUi("updatedUi.text_df8c5f744740");
  if (tone === "pending") return tUi("dashboard.snapshot.statePending");
  if (tone === "cancelled") return tUi("warranty.status.cancelled");
  return reportStatusLabel(status);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDay(value: string) {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
}

function documentDay(document: FlowDocument) {
  return document.posted_at || document.document_date;
}

function rangeIsInvalid(range: DateRange) {
  return range.from === "" || range.to === "" || range.from > range.to;
}

function Icon({ name }: { name: Parameters<typeof VuexyDemoIcon>[0]["name"] }) {
  return <VuexyDemoIcon name={name} />;
}

type FilterOption = { value: string; label: string };

function normalizedSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi");
}

function FilterCombobox({
  id,
  value,
  onChange,
  options,
  icon,
  searchPlaceholder,
  ariaLabel,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  icon: Parameters<typeof VuexyDemoIcon>[0]["name"];
  searchPlaceholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const current =
    options.find((option) => option.value === value) ?? options[0];
  const needle = normalizedSearch(search.trim());
  const filteredOptions = needle
    ? options.filter((option) =>
        normalizedSearch(option.label).includes(needle),
      )
    : options;

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      searchRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const moveOptionFocus = (
    event: React.KeyboardEvent<HTMLElement>,
    direction: 1 | -1,
  ) => {
    event.preventDefault();
    const optionButtons = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>(
        ".inbound-filter-combobox__option:not([disabled])",
      ) ?? [],
    );
    if (optionButtons.length === 0) return;
    const activeIndex = optionButtons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const nextIndex =
      activeIndex < 0
        ? direction > 0
          ? 0
          : optionButtons.length - 1
        : (activeIndex + direction + optionButtons.length) %
          optionButtons.length;
    optionButtons[nextIndex]?.focus();
  };

  return (
    <span
      ref={rootRef}
      className="inbound-filter-combobox"
      data-open={open}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          close();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
          rootRef.current
            ?.querySelector<HTMLButtonElement>("[role=combobox]")
            ?.focus();
        }
      }}
    >
      <span className="inbound-filter-select__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className="inbound-filter-combobox__trigger"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{current?.label ?? ""}</span>
        <Icon name="chevron-down" />
      </button>
      <span className="inbound-filter-combobox__menu" aria-hidden={!open}>
        <span className="inbound-filter-combobox__search">
          <Icon name="search" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") moveOptionFocus(event, 1);
              if (event.key === "ArrowUp") moveOptionFocus(event, -1);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            tabIndex={open ? 0 : -1}
          />
          {search ? (
            <button
              type="button"
              aria-label={tUi("updatedUi.text_431466c48cf0")}
              onClick={() => {
                setSearch("");
                searchRef.current?.focus();
              }}
              tabIndex={open ? 0 : -1}
            >
              ×
            </button>
          ) : null}
        </span>
        <span
          id={`${id}-listbox`}
          className="inbound-filter-combobox__options"
          role="listbox"
          aria-label={ariaLabel}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="inbound-filter-combobox__option"
                key={option.value || "all"}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") moveOptionFocus(event, 1);
                  if (event.key === "ArrowUp") moveOptionFocus(event, -1);
                }}
                tabIndex={open ? 0 : -1}
              >
                <span>{option.label}</span>
                {option.value === value ? (
                  <b
                    className="inbound-filter-combobox__check"
                    aria-hidden="true"
                  >
                    <CheckOutlined />
                  </b>
                ) : null}
              </button>
            ))
          ) : (
            <span className="inbound-filter-combobox__empty">
              {tUi("updatedUi.text_8a4f82f9ad45")}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

function KpiCard({
  tone,
  icon,
  title,
  value,
  note,
  empty,
}: {
  tone: "cyan" | "green" | "violet" | "amber";
  icon: Parameters<typeof VuexyDemoIcon>[0]["name"];
  title: string;
  value: number | string;
  note: string;
  empty: boolean;
}) {
  return (
    <article className="inbound-kpi" data-tone={tone}>
      <div className="inbound-kpi__copy">
        <span>{title}</span>
        <strong>
          {empty
            ? "—"
            : typeof value === "number"
              ? formatNumber(value)
              : value}
        </strong>
        <small>{empty ? tUi("dashboard.lastUpdated.none") : note}</small>
      </div>
      <span className="inbound-kpi__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
    </article>
  );
}

function KpiSkeleton() {
  return (
    <article className="inbound-kpi inbound-skeleton-card" aria-hidden="true">
      <span className="inbound-skeleton inbound-skeleton--label" />
      <span className="inbound-skeleton inbound-skeleton--value" />
      <span className="inbound-skeleton inbound-skeleton--note" />
      <span className="inbound-skeleton inbound-skeleton--round" />
    </article>
  );
}

export default function InboundFlowReport() {
  const [draftRange, setDraftRange] = useState<DateRange>(initialRange);
  const [appliedRange, setAppliedRange] = useState<DateRange>(initialRange);
  const [draftSupplier, setDraftSupplier] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [appliedSupplier, setAppliedSupplier] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [dateSort, setDateSort] = useState<"newest" | "oldest" | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [viewDocumentId, setViewDocumentId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [updatePending, setUpdatePending] = useState(false);
  const sawUpdateLoading = useRef(false);
  const tableRef = useRef<HTMLElement | null>(null);

  const { snapshot, loading, fetching, error, refetch } =
    useInventoryFlowSnapshot(appliedRange);
  const exporter = useReportExport();
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canExport = hasAnyWmsPermission(
    permissionCodes,
    WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
    isSuperAdmin,
  );
  const updating = loading || fetching;
  const invalidRange = rangeIsInvalid(draftRange);

  useEffect(() => {
    if (updatePending && updating) sawUpdateLoading.current = true;
    if (
      updatePending &&
      sawUpdateLoading.current &&
      !updating &&
      error == null
    ) {
      setUpdatePending(false);
      sawUpdateLoading.current = false;
      setShowSuccess(true);
    }
  }, [error, updatePending, updating]);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = window.setTimeout(() => setShowSuccess(false), 4500);
    return () => window.clearTimeout(timer);
  }, [showSuccess]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const inboundDocuments = useMemo(
    () =>
      snapshot.documents.filter((document) => document.doc_type === "INBOUND"),
    [snapshot.documents],
  );

  const supplierOptions = useMemo(
    () =>
      [...new Set(inboundDocuments.map((document) => document.counterpart))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "vi")),
    [inboundDocuments],
  );

  const statusOptions = useMemo(
    () =>
      [...new Set(inboundDocuments.map((document) => document.status))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "vi")),
    [inboundDocuments],
  );

  const supplierFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: tUi("updatedUi.text_e28dc4bb66b6") },
      ...supplierOptions.map((supplier) => ({
        value: supplier,
        label: supplier,
      })),
    ],
    [supplierOptions],
  );

  const statusFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: tUi("reports.inventoryFlow.statusAll") },
      ...statusOptions.map((status) => ({
        value: status,
        label: inboundStatusLabel(status),
      })),
    ],
    [statusOptions],
  );

  const filteredDocuments = useMemo(
    () =>
      inboundDocuments.filter((document) => {
        if (appliedSupplier && document.counterpart !== appliedSupplier)
          return false;
        if (appliedStatus && document.status !== appliedStatus) return false;
        return true;
      }),
    [appliedStatus, appliedSupplier, inboundDocuments],
  );

  const filteredDocumentNumbers = useMemo(
    () => new Set(filteredDocuments.map((document) => document.document_no)),
    [filteredDocuments],
  );

  const quantityByDocument = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const movement of snapshot.ledger) {
      if (movement.movement_type !== "RECEIPT") continue;
      const documentNo = movement.source_document_no;
      if (!documentNo) continue;
      quantities.set(
        documentNo,
        (quantities.get(documentNo) ?? 0) + Math.max(0, movement.qty_delta),
      );
    }
    return quantities;
  }, [snapshot.ledger]);

  const hasDocumentFilter = appliedSupplier !== "" || appliedStatus !== "";
  const receivedQuantity = useMemo(() => {
    if (!hasDocumentFilter) return snapshot.summary.receiptNet;
    return filteredDocuments.reduce(
      (total, document) =>
        total + (quantityByDocument.get(document.document_no) ?? 0),
      0,
    );
  }, [
    filteredDocuments,
    hasDocumentFilter,
    quantityByDocument,
    snapshot.summary.receiptNet,
  ]);

  const progress = useMemo(() => {
    const counts = { complete: 0, processing: 0, pending: 0, cancelled: 0 };
    for (const document of filteredDocuments) {
      const tone = statusTone(document.status);
      counts[tone] += 1;
    }
    return counts;
  }, [filteredDocuments]);

  const completedCount = progress.complete;
  const pendingCount = progress.pending;
  const supplierCount = useMemo(
    () =>
      new Set(
        filteredDocuments
          .map((document) => document.counterpart)
          .filter(Boolean),
      ).size,
    [filteredDocuments],
  );

  const chartPoints = useMemo(() => {
    const dailyMap = new Map(
      snapshot.daily.map((point) => [point.date, point.inbound]),
    );
    const filteredDaily = new Map<string, number>();
    if (hasDocumentFilter) {
      for (const movement of snapshot.ledger) {
        if (
          movement.movement_type !== "RECEIPT" ||
          !filteredDocumentNumbers.has(movement.source_document_no)
        ) {
          continue;
        }
        const day = movement.posted_at.slice(0, 10);
        filteredDaily.set(
          day,
          (filteredDaily.get(day) ?? 0) + Math.max(0, movement.qty_delta),
        );
      }
    }
    const points: Array<{ date: string; value: number }> = [];
    const start = dayjs(appliedRange.from);
    const end = dayjs(appliedRange.to);
    const dayCount = Math.min(Math.max(end.diff(start, "day") + 1, 1), 62);
    for (let index = 0; index < dayCount; index += 1) {
      const date = start.add(index, "day").format(ISO_DATE);
      points.push({
        date,
        value: hasDocumentFilter
          ? (filteredDaily.get(date) ?? 0)
          : (dailyMap.get(date) ?? 0),
      });
    }
    return points;
  }, [
    appliedRange.from,
    appliedRange.to,
    filteredDocumentNumbers,
    hasDocumentFilter,
    snapshot.daily,
    snapshot.ledger,
  ]);

  const searchedDocuments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    if (!needle) return filteredDocuments;
    return filteredDocuments.filter((document) =>
      [
        document.document_no,
        document.counterpart,
        document.created_by_name,
        document.status,
        inboundStatusLabel(document.status),
      ]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(needle),
    );
  }, [filteredDocuments, query]);

  const sortedDocuments = useMemo(() => {
    if (dateSort === null) return searchedDocuments;
    return [...searchedDocuments].sort((left, right) => {
      const leftDate = dayjs(documentDay(left)).valueOf();
      const rightDate = dayjs(documentDay(right)).valueOf();
      const difference =
        (Number.isFinite(leftDate) ? leftDate : 0) -
        (Number.isFinite(rightDate) ? rightDate : 0);
      return dateSort === "newest" ? -difference : difference;
    });
  }, [dateSort, searchedDocuments]);

  const pageCount = Math.max(1, Math.ceil(searchedDocuments.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageDocuments = sortedDocuments.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const reportEmpty =
    !updating && error == null && filteredDocuments.length === 0;
  const searchEmpty = !reportEmpty && searchedDocuments.length === 0;

  const chartMaximum = Math.max(1, ...chartPoints.map((point) => point.value));
  const chartCeiling = Math.max(10, Math.ceil(chartMaximum / 100) * 100);
  const totalProgress =
    progress.complete +
    progress.processing +
    progress.pending +
    progress.cancelled;
  const completePct = totalProgress
    ? (progress.complete / totalProgress) * 100
    : 0;
  const processingPct = totalProgress
    ? (progress.processing / totalProgress) * 100
    : 0;
  const pendingPct = totalProgress
    ? (progress.pending / totalProgress) * 100
    : 0;
  const donutStyle = {
    "--complete-angle": `${completePct * 3.6}deg`,
    "--processing-angle": `${(completePct + processingPct) * 3.6}deg`,
    "--pending-angle": `${(completePct + processingPct + pendingPct) * 3.6}deg`,
  } as CSSProperties;

  const exportReason = (() => {
    if (exporter.exporting) return tUi("updatedUi.text_d7a37805fe18");
    if (updating) return tUi("updatedUi.text_786346f99661");
    if (error != null) return tUi("updatedUi.text_5b5f331545d6");
    if (invalidRange) return tUi("updatedUi.text_fc36c0eb5a3f");
    if (!canExport) return tUi("updatedUi.text_a3c72d7db277");
    if (filteredDocuments.length === 0)
      return tUi("updatedUi.text_9fb8f71968d2");
    return "";
  })();

  const applyFilters = async () => {
    if (invalidRange || updating) return;
    setAppliedSupplier(draftSupplier);
    setAppliedStatus(draftStatus);
    setPage(1);
    setQuery("");
    setShowSuccess(false);
    setActionNotice(null);
    sawUpdateLoading.current = false;
    setUpdatePending(true);
    const rangeChanged =
      draftRange.from !== appliedRange.from ||
      draftRange.to !== appliedRange.to;
    if (rangeChanged) {
      setAppliedRange(draftRange);
    } else {
      await refetch();
    }
  };

  const resetFilters = async () => {
    const next = initialRange();
    setDraftRange(next);
    setDraftSupplier("");
    setDraftStatus("");
    setAppliedSupplier("");
    setAppliedStatus("");
    setQuery("");
    setPage(1);
    setSelectedDocument(null);
    setShowSuccess(false);
    setActionNotice(null);
    sawUpdateLoading.current = false;
    setUpdatePending(true);
    const rangeChanged =
      next.from !== appliedRange.from || next.to !== appliedRange.to;
    if (rangeChanged) setAppliedRange(next);
    else await refetch();
  };

  const widenRange = () => {
    const next = {
      from: dayjs().subtract(29, "day").format(ISO_DATE),
      to: dayjs().format(ISO_DATE),
    };
    setDraftRange(next);
    setAppliedRange(next);
    setDraftSupplier("");
    setDraftStatus("");
    setAppliedSupplier("");
    setAppliedStatus("");
    setUpdatePending(true);
    sawUpdateLoading.current = false;
  };

  const runExport = () => {
    if (exportReason) return;
    void exporter.exportReport("xlsx", {
      reportCode: "document-history",
      fileStem: "bao-cao-nhap-kho",
      fileSuffix: `-${appliedRange.from}-${appliedRange.to}`,
      filters: {
        from_date: appliedRange.from,
        to_date: appliedRange.to,
        doc_type: "inbound",
        ...(appliedStatus ? { status: appliedStatus } : {}),
      },
    });
  };

  const scrollToPending = () => {
    const firstPending = filteredDocuments.find(
      (document) => statusTone(document.status) === "pending",
    );
    const pendingStatus = firstPending?.status ?? "";
    setDraftStatus(pendingStatus);
    setAppliedStatus(pendingStatus);
    setQuery("");
    setPage(1);
    setSelectedDocument(firstPending?.id ?? null);
    setActionNotice(
      firstPending
        ? tUi("updatedUi.text_02cd7d835950", { value0: String(pendingCount) })
        : tUi("updatedUi.text_3d6599d17ea5"),
    );
    window.requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      tableRef.current?.focus({ preventScroll: true });
    });
  };

  const openDocument = (document: FlowDocument) => {
    setSelectedDocument(document.id);
    setViewDocumentId(document.id);
  };

  const toastCopy = actionNotice
    ? { title: tUi("updatedUi.text_b7f7bae4ff19"), detail: actionNotice }
    : showSuccess
      ? {
          title: tUi("updatedUi.text_5d0cd3a93731"),
          detail: tUi("updatedUi.text_d6c349552506"),
        }
      : null;

  return (
    <div className="hn-inbound-report" data-testid="rpt01-inbound-reference">
      {toastCopy ? (
        <div className="inbound-toast" role="status">
          <span className="inbound-toast__icon" aria-hidden="true">
            <CheckOutlined />
          </span>
          <span>
            <strong>{toastCopy.title}</strong>
            <small>{toastCopy.detail}</small>
          </span>
          <button
            type="button"
            aria-label={tUi("updatedUi.text_8af6ba927e1f")}
            onClick={() => {
              setShowSuccess(false);
              setActionNotice(null);
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      <nav
        className="inbound-breadcrumb"
        aria-label={tUi("dashboard.breadcrumb.nav")}
      >
        <Icon name="layout-dashboard" />
        <span>{tUi("reports.traceability.breadcrumbReports")}</span>
        <b>/</b>
        <strong>{tUi("dashboard.snapshot.inbound")}</strong>
      </nav>

      <header className="inbound-page-heading">
        <div>
          <h1 className="hn-report-page-title">
            {tUi("updatedUi.text_19a0d713e43a")}
          </h1>
          <p>{tUi("updatedUi.text_3929c435dfd2")}</p>
        </div>
        <div className="inbound-heading-actions hn-report-warehouse-actions">
          <span
            className="inbound-tooltip"
            data-tooltip={exportReason || undefined}
          >
            <button
              type="button"
              className="inbound-export-button"
              disabled={Boolean(exportReason)}
              onClick={runExport}
            >
              <Icon name="arrow-right" />
              {exporter.exporting
                ? tUi("updatedUi.text_f218a6c991e2")
                : tUi("updatedUi.text_869645273267")}
            </button>
          </span>
          <ReportWarehouseCard />
        </div>
      </header>

      {!canExport ? (
        <aside className="inbound-readonly-banner" role="status">
          <span>
            <Icon name="lock" />
          </span>
          <div>
            <strong>{tUi("updatedUi.text_4ce6445597cc")}</strong>
            <p>{tUi("updatedUi.text_0dcd3d96bd0a")}</p>
          </div>
        </aside>
      ) : null}

      <section
        className="inbound-filter-card"
        aria-label={tUi("reports.recipientAgency.filterTitle")}
      >
        <div className="inbound-filter-grid">
          <div
            className={`inbound-filter-field--date${invalidRange ? " is-invalid" : ""}`}
            role="group"
            aria-label={tUi("reports.packingLabel.dateRangeLabel")}
          >
            <div className="inbound-filter-field inbound-date-field">
              <span>{tUi("shared.datePicker.fromDate")}</span>
              <UiVuexyDateField
                field="from"
                value={
                  draftRange.from ? dayjs(draftRange.from, ISO_DATE) : null
                }
                onChange={(value) =>
                  setDraftRange((current) => ({
                    ...current,
                    from: value?.format(ISO_DATE) ?? "",
                  }))
                }
                maxDate={draftRange.to ? dayjs(draftRange.to, ISO_DATE) : null}
                aria-label={tUi("shared.datePicker.fromDate")}
                disabled={updating}
              />
            </div>
            <div className="inbound-filter-field inbound-date-field">
              <span>{tUi("shared.datePicker.toDate")}</span>
              <UiVuexyDateField
                field="to"
                value={draftRange.to ? dayjs(draftRange.to, ISO_DATE) : null}
                onChange={(value) =>
                  setDraftRange((current) => ({
                    ...current,
                    to: value?.format(ISO_DATE) ?? "",
                  }))
                }
                minDate={
                  draftRange.from ? dayjs(draftRange.from, ISO_DATE) : null
                }
                aria-label={tUi("shared.datePicker.toDate")}
                disabled={updating}
              />
            </div>
            {invalidRange ? (
              <small>{tUi("updatedUi.text_c88aba88c1c8")}</small>
            ) : null}
          </div>
          <p className="inbound-filter-note">
            <Icon name="file-clock" />
            {dayjs(appliedRange.to).diff(dayjs(appliedRange.from), "day") +
              1}{" "}
            {tUi("updatedUi.text_a0b12849189a")}
          </p>
          <div
            className="inbound-filter-field"
            data-filter="supplier"
            role="group"
            aria-labelledby="rpt01-supplier-label"
          >
            <span id="rpt01-supplier-label">
              {tUi("updatedUi.text_039d667495cd")}
            </span>
            <FilterCombobox
              id="rpt01-supplier"
              value={draftSupplier}
              onChange={setDraftSupplier}
              options={supplierFilterOptions}
              icon="user-round"
              searchPlaceholder="Tìm nhà cung cấp..."
              ariaLabel="Chọn nhà cung cấp"
              disabled={updating}
            />
          </div>
          <div
            className="inbound-filter-field"
            data-filter="status"
            role="group"
            aria-labelledby="rpt01-status-label"
          >
            <span id="rpt01-status-label">
              {tUi("dashboard.composition.colStatus")}
            </span>
            <FilterCombobox
              id="rpt01-status"
              value={draftStatus}
              onChange={setDraftStatus}
              options={statusFilterOptions}
              icon="file-clock"
              searchPlaceholder="Tìm trạng thái..."
              ariaLabel="Chọn trạng thái phiếu nhập"
              disabled={updating}
            />
          </div>
          <div className="inbound-filter-actions">
            <button
              type="button"
              className="inbound-apply-button"
              onClick={() => void applyFilters()}
              disabled={invalidRange || updating}
            >
              {tUi("dashboard.snapshot.apply")}
            </button>
            <button
              type="button"
              className="inbound-reset-button"
              onClick={() => void resetFilters()}
              disabled={updating}
            >
              {tUi("reports.packingLabel.reset")}
            </button>
          </div>
        </div>
      </section>

      {invalidRange ? (
        <aside className="inbound-invalid-banner" role="alert">
          <span>
            <Icon name="triangle-alert" />
          </span>
          <div>
            <strong>{tUi("updatedUi.text_b6d11c8358a9")}</strong>
            <p>{tUi("updatedUi.text_4a7df2bdbb44")}</p>
          </div>
        </aside>
      ) : null}

      {error != null && !loading ? (
        <section className="inbound-error-card" role="alert">
          <span className="inbound-error-card__icon">
            <Icon name="triangle-alert" />
          </span>
          <small>{tUi("updatedUi.text_038f338b715d")}</small>
          <h2>{tUi("updatedUi.text_c1e574adfa82")}</h2>
          <p>{getApiErrorMessage(error, tUi("updatedUi.text_8bee0482cc4c"))}</p>
          <button type="button" onClick={() => void refetch()}>
            <Icon name="refresh-cw" />
            {" " + tUi("common.retry")}
          </button>
          <em>{tUi("updatedUi.text_07ef3e01e03b")}</em>
        </section>
      ) : (
        <>
          <section
            className="inbound-kpi-grid"
            aria-label={tUi("reports.inventoryFlowReport.inboundQuickTitle")}
          >
            <span className="inbound-sr-only">
              {tUi("reports.inventoryFlowReport.inboundQuickTitle")}
            </span>
            {updating ? (
              Array.from({ length: 4 }, (_, index) => (
                <KpiSkeleton key={index} />
              ))
            ) : (
              <>
                <KpiCard
                  tone="cyan"
                  icon="package-plus"
                  title={tUi("updatedUi.text_df2300943e94")}
                  value={receivedQuantity}
                  note="Trong kỳ đã chọn"
                  empty={reportEmpty}
                />
                <KpiCard
                  tone="green"
                  icon="file-clock"
                  title={tUi("updatedUi.text_4ec714e78d21")}
                  value={`${completedCount} / ${filteredDocuments.length}`}
                  note={
                    filteredDocuments.length
                      ? tUi("updatedUi.text_c49d03028966", {
                          value0: String(
                            formatNumber(
                              (completedCount / filteredDocuments.length) * 100,
                            ),
                          ),
                        })
                      : tUi("dashboard.lastUpdated.none")
                  }
                  empty={reportEmpty}
                />
                <KpiCard
                  tone="violet"
                  icon="warehouse"
                  title={tUi("updatedUi.text_039d667495cd")}
                  value={supplierCount}
                  note="Có phát sinh nhập"
                  empty={reportEmpty}
                />
                <KpiCard
                  tone="amber"
                  icon="triangle-alert"
                  title={tUi("updatedUi.text_90bb168358f1")}
                  value={pendingCount + progress.processing}
                  note={tUi("updatedUi.text_655c26553606", {
                    value0: String(pendingCount),
                    value1: String(progress.processing),
                  })}
                  empty={reportEmpty}
                />
              </>
            )}
          </section>

          <section className="inbound-analytics-grid">
            <article className="inbound-panel inbound-chart-panel">
              <div className="inbound-panel-heading">
                <div>
                  <h2>{tUi("updatedUi.text_3a13e460ab96")}</h2>
                  <p>{tUi("updatedUi.text_fdae0abff74d")}</p>
                </div>
                <span className="inbound-panel-total">
                  <strong>
                    {tUi("updatedUi.text_09caee89904d") + " "}
                    {formatNumber(receivedQuantity)}
                  </strong>
                  {" " + tUi("updatedUi.text_9bfcaa70b19e")}
                </span>
              </div>
              {updating ? (
                <div className="inbound-chart-skeleton" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => (
                    <i key={index} />
                  ))}
                </div>
              ) : reportEmpty ? (
                <div className="inbound-empty-chart">
                  <span>
                    <Icon name="chart-column-big" />
                  </span>
                  <strong>{tUi("updatedUi.text_9a5ad8b93cd8")}</strong>
                  <small>{tUi("updatedUi.text_9a04c28680cd")}</small>
                </div>
              ) : (
                <div
                  className="inbound-bar-chart"
                  role="img"
                  aria-label={tUi("updatedUi.text_d69a33a8c875")}
                >
                  <div className="inbound-chart-y-axis" aria-hidden="true">
                    <span>{formatNumber(chartCeiling)}</span>
                    <span>{formatNumber(chartCeiling * 0.75)}</span>
                    <span>{formatNumber(chartCeiling * 0.5)}</span>
                    <span>{formatNumber(chartCeiling * 0.25)}</span>
                    <span>0</span>
                  </div>
                  <div className="inbound-chart-scroll">
                    <div className="inbound-chart-plot">
                      <div
                        className="inbound-chart-gridlines"
                        aria-hidden="true"
                      >
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                      <div className="inbound-chart-bars">
                        {chartPoints.map((point) => (
                          <div
                            className="inbound-chart-bar"
                            key={point.date}
                            title={`${formatDay(point.date)}: ${formatNumber(point.value)}`}
                          >
                            <span>
                              {point.value > 0 ? formatNumber(point.value) : ""}
                            </span>
                            <i
                              style={{
                                height: `${Math.max(2, (point.value / chartCeiling) * 100)}%`,
                              }}
                            />
                            <small>{dayjs(point.date).format("DD/MM")}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="inbound-panel inbound-progress-panel">
              <div className="inbound-panel-heading">
                <div>
                  <h2>{tUi("updatedUi.text_12ee9c4508a9")}</h2>
                  <p>{tUi("updatedUi.text_410ce7ff86bb")}</p>
                </div>
              </div>
              {updating ? (
                <div className="inbound-progress-skeleton" aria-hidden="true">
                  <span className="inbound-skeleton inbound-skeleton--donut" />
                  <span>
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              ) : reportEmpty ? (
                <div className="inbound-empty-chart inbound-empty-chart--compact">
                  <span>
                    <Icon name="file-clock" />
                  </span>
                  <strong>{tUi("updatedUi.text_e4b42943fae3")}</strong>
                  <small>{tUi("updatedUi.text_c0a62bb8d645")}</small>
                </div>
              ) : (
                <div className="inbound-progress-content">
                  <div className="inbound-donut" style={donutStyle}>
                    <span>
                      <strong>{formatNumber(totalProgress)}</strong>
                      <small>{tUi("updatedUi.text_2d173f0e4679")}</small>
                    </span>
                  </div>
                  <ul className="inbound-progress-legend">
                    <li data-tone="complete">
                      <span>{tUi("iam.permissionAction.post")}</span>
                      <strong>{progress.complete}</strong>
                    </li>
                    <li data-tone="processing">
                      <span>{tUi("updatedUi.text_df8c5f744740")}</span>
                      <strong>{progress.processing}</strong>
                    </li>
                    <li data-tone="pending">
                      <span>{tUi("dashboard.snapshot.statePending")}</span>
                      <strong>{progress.pending}</strong>
                    </li>
                    <li data-tone="cancelled">
                      <span>{tUi("warranty.status.cancelled")}</span>
                      <strong>{progress.cancelled}</strong>
                    </li>
                  </ul>
                </div>
              )}
              <div className="inbound-pending-callout">
                <span>
                  <Icon name="file-clock" />
                </span>
                <div>
                  <strong>
                    {pendingCount}
                    {" " + tUi("updatedUi.text_e62d651d4a57")}
                  </strong>
                  <small>{tUi("updatedUi.text_0d4d0114ad32")}</small>
                </div>
                <button
                  type="button"
                  onClick={scrollToPending}
                  disabled={reportEmpty || updating}
                >
                  {tUi("updatedUi.text_e07402d0ac93") + " "}
                  <Icon name="arrow-right" />
                </button>
              </div>
            </article>
          </section>

          <section
            className="inbound-panel inbound-table-panel"
            ref={tableRef}
            tabIndex={-1}
          >
            <div className="inbound-table-heading">
              <div>
                <span className="inbound-table-title-row">
                  <h2>{tUi("updatedUi.text_b7f7bae4ff19")}</h2>
                </span>
              </div>
              <label className="inbound-table-search">
                <Icon name="search" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder={tUi("updatedUi.text_5a3793c82147")}
                  aria-label={tUi("inbound.list.searchAria")}
                  disabled={updating || reportEmpty}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={tUi("updatedUi.text_323a278e441f")}
                  >
                    ×
                  </button>
                ) : null}
              </label>
            </div>

            {updating ? (
              <div className="inbound-table-skeleton" aria-hidden="true">
                {Array.from({ length: 6 }, (_, row) => (
                  <div key={row}>
                    {Array.from({ length: 6 }, (_, cell) => (
                      <i key={cell} />
                    ))}
                  </div>
                ))}
              </div>
            ) : reportEmpty ? (
              <div className="inbound-empty-table">
                <span>
                  <Icon name="inbox" />
                </span>
                <h3>{tUi("updatedUi.text_e5e3c3be463c")}</h3>
                <p>{tUi("updatedUi.text_4b3751b5dba0")}</p>
                <button type="button" onClick={widenRange}>
                  <Icon name="calendar-days" />
                  {" " + tUi("updatedUi.text_879c05bb679d")}
                </button>
              </div>
            ) : searchEmpty ? (
              <div className="inbound-empty-table inbound-empty-table--search">
                <span>
                  <Icon name="search" />
                </span>
                <h3>{tUi("updatedUi.text_3f9b64561f4b")}</h3>
                <p>
                  {tUi("updatedUi.text_5a5ffc21ba7d")}
                  {query}
                  {tUi("updatedUi.text_6c2aff5a26af")}
                </p>
                <button type="button" onClick={() => setQuery("")}>
                  {tUi("updatedUi.text_816c89e8e46b")}
                </button>
              </div>
            ) : (
              <div className="inbound-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        {tUi("warranty.componentList.colCode")}{" "}
                        <span className="inbound-tablet-only">
                          {tUi("updatedUi.text_aaf42c905ec0")}
                        </span>
                      </th>
                      <th
                        className="inbound-desktop-date"
                        aria-sort={
                          dateSort === "newest"
                            ? "descending"
                            : dateSort === "oldest"
                              ? "ascending"
                              : "none"
                        }
                      >
                        <button
                          type="button"
                          className="hn-sortable-th"
                          aria-label={tUi(
                            dateSort === "newest"
                              ? "reports.inventoryFlow.sortInboundOldest"
                              : "reports.inventoryFlow.sortInboundNewest",
                          )}
                          title={tUi(
                            dateSort === "newest"
                              ? "reports.inventoryFlow.sortInboundOldest"
                              : "reports.inventoryFlow.sortInboundNewest",
                          )}
                          onClick={() => {
                            setDateSort((current) =>
                              current === "newest" ? "oldest" : "newest",
                            );
                            setPage(1);
                          }}
                        >
                          <span>
                            {tUi("reports.traceability.colInboundDate")}
                          </span>
                          {renderSortIcon({
                            sortOrder:
                              dateSort === "newest"
                                ? "descend"
                                : dateSort === "oldest"
                                  ? "ascend"
                                  : null,
                          })}
                        </button>
                      </th>
                      <th>{tUi("updatedUi.text_039d667495cd")}</th>
                      <th className="is-number">
                        {tUi("updatedUi.text_1320fb99c374")}
                      </th>
                      <th>{tUi("dashboard.composition.colStatus")}</th>
                      <th className="inbound-created-by">
                        {tUi("reverse.detail.fieldCreatedBy")}
                      </th>
                      <th>{tUi("outbound.detail.colAction")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageDocuments.map((document) => {
                      const tone = statusTone(document.status);
                      const selected = selectedDocument === document.id;
                      return (
                        <tr
                          key={document.id}
                          tabIndex={0}
                          aria-selected={selected}
                          className={selected ? "is-selected" : undefined}
                          onClick={() => setSelectedDocument(document.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedDocument(document.id);
                            }
                          }}
                        >
                          <td
                            data-label={tUi("warranty.componentList.colCode")}
                          >
                            <strong>{document.document_no || "—"}</strong>
                            <small className="inbound-tablet-only">
                              {formatDay(documentDay(document))}
                            </small>
                          </td>
                          <td
                            className="inbound-desktop-date"
                            data-label={tUi(
                              "reports.traceability.colInboundDate",
                            )}
                          >
                            {formatDay(documentDay(document))}
                          </td>
                          <td data-label={tUi("updatedUi.text_039d667495cd")}>
                            <span className="inbound-supplier-name">
                              {document.counterpart || "—"}
                            </span>
                          </td>
                          <td
                            className="is-number"
                            data-label={tUi("updatedUi.text_1320fb99c374")}
                          >
                            <strong>
                              {formatNumber(
                                quantityByDocument.get(document.document_no) ??
                                  0,
                              )}
                            </strong>
                          </td>
                          <td
                            data-label={tUi("dashboard.composition.colStatus")}
                          >
                            <span className="inbound-status" data-tone={tone}>
                              {inboundStatusLabel(document.status)}
                            </span>
                          </td>
                          <td
                            className="inbound-created-by"
                            data-label={tUi("reverse.detail.fieldCreatedBy")}
                          >
                            {document.created_by_name || "—"}
                          </td>
                          <td data-label={tUi("outbound.detail.colAction")}>
                            <RowActionGroup>
                              <RowActionButton
                                kind="view"
                                type="button"
                                aria-label={tUi("updatedUi.text_f530867d0676", {
                                  value0: String(document.document_no),
                                })}
                                title={tUi("updatedUi.text_f530867d0676", {
                                  value0: String(document.document_no),
                                })}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDocument(document);
                                }}
                              >
                                Xem
                              </RowActionButton>
                            </RowActionGroup>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="inbound-table-footer hn-report-pagination-footer">
              <div className="inbound-table-summary">
                <span>
                  {searchedDocuments.length === 0
                    ? tUi("updatedUi.text_8f31a3be9ea1", {
                        value0: String(filteredDocuments.length),
                      })
                    : tUi("updatedUi.text_c9bbf7bb2223", {
                        value0: String((safePage - 1) * pageSize + 1),
                        value1: String(
                          Math.min(
                            safePage * pageSize,
                            searchedDocuments.length,
                          ),
                        ),
                        value2: String(searchedDocuments.length),
                      })}
                </span>
                <label className="inbound-page-size">
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    aria-label={tUi("shared.table.rowsPerPageAria")}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {tUi("shared.table.perPage", { size: String(size) })}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" />
                </label>
              </div>
              <div className="inbound-pagination hn-report-pagination">
                <button
                  type="button"
                  aria-label={tUi("reports.traceability.previousPage")}
                  disabled={safePage <= 1 || searchedDocuments.length === 0}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <Icon name="chevron-left" />
                </button>
                {Array.from({ length: Math.min(3, pageCount) }, (_, index) => {
                  const first =
                    pageCount <= 3
                      ? 1
                      : Math.min(Math.max(safePage - 1, 1), pageCount - 2);
                  const pageNumber = first + index;
                  return (
                    <button
                      type="button"
                      key={pageNumber}
                      className={
                        pageNumber === safePage ? "is-active" : undefined
                      }
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                {pageCount > 3 ? <span>…</span> : null}
                <button
                  type="button"
                  aria-label="Trang sau"
                  disabled={
                    safePage >= pageCount || searchedDocuments.length === 0
                  }
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                >
                  <Icon name="chevron-right" />
                </button>
              </div>
            </footer>
          </section>
        </>
      )}

      {updating ? (
        <div
          className="inbound-loading-overlay"
          role="status"
          aria-live="polite"
        >
          <div>
            <span className="inbound-loading-mark">
              <Icon name="warehouse" />
            </span>
            <i className="inbound-spinner" />
            <strong>{tUi("updatedUi.text_434c42929257")}</strong>
            <small>{tUi("updatedUi.text_b271581f3ca5")}</small>
          </div>
        </div>
      ) : null}

      {viewDocumentId ? (
        <InboundScanModal
          documentId={viewDocumentId}
          onClose={() => setViewDocumentId(null)}
          onChanged={() => void refetch()}
        />
      ) : null}
    </div>
  );
}
