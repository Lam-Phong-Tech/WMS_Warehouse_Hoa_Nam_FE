import { ReportDateRangePicker } from "../components/ReportDateRangePicker";
import { CheckOutlined } from "@/shared/components/icons";
import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { VuexyDemoIcon } from "@/shared/ui";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { AlignedOutboundDetailModal } from "@/modules/outbound/components/AlignedOutboundDetailModal";
import { OutboundIntakeModal } from "@/modules/outbound/components/OutboundIntakeModal";
import {
  fetchOutboundDocuments,
  type OutboundDocumentRecord,
} from "@/modules/outbound/services/alignedOutboundService";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { reportStatusLabel } from "@/modules/reports/operations/report-labels";
import {
  businessLabel,
  OUTBOUND_STATUS_LABELS,
} from "@/shared/constants/business-labels";
import {
  ISO_DATE,
  useInventoryFlowSnapshot,
  type FlowDocument,
} from "./inventory-flow-api";
import "./outbound-flow-report.css";
import { tStatic as tUi } from "@/shared/i18n/useT";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/shared/constants/table-pagination";

const METADATA_PAGE_SIZE = 100;
const METADATA_MAX_PAGES = 50;
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

function outboundStatusLabel(status: string) {
  const outboundLabel = businessLabel(OUTBOUND_STATUS_LABELS, status);
  if (outboundLabel) return outboundLabel;
  const tone = statusTone(status);
  if (tone === "complete") return tUi("reports.traceability.issued");
  if (tone === "processing") return tUi("updatedUi.text_989a7c2159f4");
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

async function fetchOutboundMetadata(
  documents: FlowDocument[],
): Promise<OutboundDocumentRecord[]> {
  const keyById = new Map<string, string>();
  const keyByCode = new Map<string, string>();

  for (const document of documents) {
    const key = document.id || document.document_no;
    if (document.id) keyById.set(document.id, key);
    if (document.document_no) keyByCode.set(document.document_no, key);
  }

  const targetCount = new Set([...keyById.values(), ...keyByCode.values()])
    .size;
  const matched = new Map<string, OutboundDocumentRecord>();

  for (let page = 1; page <= METADATA_MAX_PAGES; page += 1) {
    const result = await fetchOutboundDocuments({
      page,
      per_page: METADATA_PAGE_SIZE,
      sortOrder: "desc",
    });

    for (const record of result.data) {
      const key = keyById.get(record.id) ?? keyByCode.get(record.code);
      if (key) matched.set(key, record);
    }

    if (matched.size >= targetCount) break;
    const lastPage = Number(result.meta.last_page);
    const reachedLastPage = Number.isFinite(lastPage)
      ? page >= lastPage
      : result.data.length < METADATA_PAGE_SIZE;
    if (result.data.length === 0 || reachedLastPage) break;
  }

  return [...matched.values()];
}

function rangeIsInvalid(range: DateRange) {
  return range.from === "" || range.to === "" || range.from > range.to;
}

function Icon({ name }: { name: Parameters<typeof VuexyDemoIcon>[0]["name"] }) {
  return <VuexyDemoIcon name={name} />;
}

function CollapseButton({
  title,
  expanded,
  controls,
  onClick,
}: {
  title: string;
  expanded: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="outbound-collapse-button"
      aria-label={tUi(
        expanded
          ? "reports.stockReconcileReport.collapseSection"
          : "reports.stockReconcileReport.expandSection",
        { title },
      )}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      <Icon name="chevron-down" />
    </button>
  );
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
        ".outbound-filter-combobox__option:not([disabled])",
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
      className="outbound-filter-combobox"
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
      <span className="outbound-filter-select__icon" aria-hidden="true">
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
        className="outbound-filter-combobox__trigger"
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
      <span className="outbound-filter-combobox__menu" aria-hidden={!open}>
        <span className="outbound-filter-combobox__search">
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
          className="outbound-filter-combobox__options"
          role="listbox"
          aria-label={ariaLabel}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="outbound-filter-combobox__option"
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
                    className="outbound-filter-combobox__check"
                    aria-hidden="true"
                  >
                    <CheckOutlined />
                  </b>
                ) : null}
              </button>
            ))
          ) : (
            <span className="outbound-filter-combobox__empty">
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
  expanded,
  onToggle,
}: {
  tone: "cyan" | "green" | "violet" | "amber";
  icon: Parameters<typeof VuexyDemoIcon>[0]["name"];
  title: string;
  value: number | string;
  note: string;
  empty: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const contentId = `outbound-kpi-${tone}-content`;
  return (
    <article
      className="outbound-kpi"
      data-tone={tone}
      data-collapsed={!expanded}
    >
      <div className="outbound-kpi__copy">
        <span>{title}</span>
        <div
          className="outbound-kpi__details"
          id={contentId}
          hidden={!expanded}
        >
          <strong>
            {empty
              ? "—"
              : typeof value === "number"
                ? formatNumber(value)
                : value}
          </strong>
          <small>{empty ? tUi("dashboard.lastUpdated.none") : note}</small>
        </div>
      </div>
      <CollapseButton
        title={title}
        expanded={expanded}
        controls={contentId}
        onClick={onToggle}
      />
      {expanded ? (
        <span className="outbound-kpi__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
      ) : null}
    </article>
  );
}

function KpiSkeleton() {
  return (
    <article className="outbound-kpi outbound-skeleton-card" aria-hidden="true">
      <span className="outbound-skeleton outbound-skeleton--label" />
      <span className="outbound-skeleton outbound-skeleton--value" />
      <span className="outbound-skeleton outbound-skeleton--note" />
      <span className="outbound-skeleton outbound-skeleton--round" />
    </article>
  );
}

export default function OutboundFlowReport() {
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [chartOpen, setChartOpen] = useState(true);
  const [progressOpen, setProgressOpen] = useState(true);
  const [kpiOpen, setKpiOpen] = useState({
    cyan: true,
    green: true,
    violet: true,
    amber: true,
  });
  const toggleKpi = (tone: keyof typeof kpiOpen) =>
    setKpiOpen((current) => ({ ...current, [tone]: !current[tone] }));
  const [draftRange, setDraftRange] = useState<DateRange>(initialRange);
  const [appliedRange, setAppliedRange] = useState<DateRange>(initialRange);
  const [draftRecipient, setDraftRecipient] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [appliedRecipient, setAppliedRecipient] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(TABLE_PAGE_SIZE_OPTIONS[0]);
  const [viewDocumentId, setViewDocumentId] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [updatePending, setUpdatePending] = useState(false);
  const sawUpdateLoading = useRef(false);
  const tableRef = useRef<HTMLElement | null>(null);

  const {
    snapshot,
    loading,
    fetching,
    error,
    refetch: refetchSnapshot,
  } = useInventoryFlowSnapshot(appliedRange);
  const outboundDocuments = useMemo(
    () =>
      snapshot.documents.filter((document) => document.doc_type === "OUTBOUND"),
    [snapshot.documents],
  );
  const outboundMetadataQuery = useQuery({
    queryKey: [
      "reports",
      "outbound-flow",
      "document-metadata",
      outboundDocuments
        .map((document) => `${document.id}:${document.document_no}`)
        .sort(),
    ],
    queryFn: () => fetchOutboundMetadata(outboundDocuments),
    enabled: outboundDocuments.length > 0,
  });
  const outboundMetadataByDocument = useMemo(() => {
    const metadata = new Map<string, OutboundDocumentRecord>();
    for (const document of outboundMetadataQuery.data ?? []) {
      if (document.id) metadata.set(document.id, document);
      if (document.code) metadata.set(document.code, document);
    }
    return metadata;
  }, [outboundMetadataQuery.data]);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canImport =
    hasAnyWmsPermission(
      permissionCodes,
      WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_IMPORT,
      isSuperAdmin,
    ) ||
    hasAnyWmsPermission(
      permissionCodes,
      WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_MANUAL_CREATE,
      isSuperAdmin,
    );
  const updating =
    loading ||
    fetching ||
    outboundMetadataQuery.isLoading ||
    outboundMetadataQuery.isFetching;
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

  const recipientOptions = useMemo(
    () =>
      [...new Set(outboundDocuments.map((document) => document.counterpart))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "vi")),
    [outboundDocuments],
  );

  const statusOptions = useMemo(
    () =>
      [...new Set(outboundDocuments.map((document) => document.status))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "vi")),
    [outboundDocuments],
  );

  const recipientFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: tUi("reports.recipientAgency.recipientAll") },
      ...recipientOptions.map((recipient) => ({
        value: recipient,
        label: recipient,
      })),
    ],
    [recipientOptions],
  );

  const statusFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: tUi("reports.inventoryFlow.statusAll") },
      ...statusOptions.map((status) => ({
        value: status,
        label: outboundStatusLabel(status),
      })),
    ],
    [statusOptions],
  );

  const filteredDocuments = useMemo(
    () =>
      outboundDocuments.filter((document) => {
        if (appliedRecipient && document.counterpart !== appliedRecipient)
          return false;
        if (appliedStatus && document.status !== appliedStatus) return false;
        return true;
      }),
    [appliedStatus, appliedRecipient, outboundDocuments],
  );

  const filteredDocumentNumbers = useMemo(
    () => new Set(filteredDocuments.map((document) => document.document_no)),
    [filteredDocuments],
  );

  const quantityByDocument = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const movement of snapshot.ledger) {
      if (
        movement.movement_type !== "ISSUE" &&
        movement.movement_type !== "COMPONENT_ISSUE"
      ) {
        continue;
      }
      const documentNo = movement.source_document_no;
      if (!documentNo) continue;
      quantities.set(
        documentNo,
        (quantities.get(documentNo) ?? 0) + Math.max(0, -movement.qty_delta),
      );
    }
    return quantities;
  }, [snapshot.ledger]);

  const hasDocumentFilter = appliedRecipient !== "" || appliedStatus !== "";
  const issuedQuantity = useMemo(() => {
    if (!hasDocumentFilter)
      return snapshot.summary.issueNet + snapshot.summary.componentNet;
    return filteredDocuments.reduce(
      (total, document) =>
        total + (quantityByDocument.get(document.document_no) ?? 0),
      0,
    );
  }, [
    filteredDocuments,
    hasDocumentFilter,
    quantityByDocument,
    snapshot.summary.componentNet,
    snapshot.summary.issueNet,
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
  const recipientCount = useMemo(
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
      snapshot.daily.map((point) => [
        point.date,
        point.product + point.component,
      ]),
    );
    const filteredDaily = new Map<string, number>();
    if (hasDocumentFilter) {
      for (const movement of snapshot.ledger) {
        if (
          (movement.movement_type !== "ISSUE" &&
            movement.movement_type !== "COMPONENT_ISSUE") ||
          !filteredDocumentNumbers.has(movement.source_document_no)
        ) {
          continue;
        }
        const day = movement.posted_at.slice(0, 10);
        filteredDaily.set(
          day,
          (filteredDaily.get(day) ?? 0) + Math.max(0, -movement.qty_delta),
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
    return filteredDocuments.filter((document) => {
      const metadata =
        outboundMetadataByDocument.get(document.id) ??
        outboundMetadataByDocument.get(document.document_no);
      return [
        document.document_no,
        metadata?.requestNo,
        document.counterpart,
        document.created_by_name,
        document.status,
        outboundStatusLabel(document.status),
      ]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(needle);
    });
  }, [filteredDocuments, outboundMetadataByDocument, query]);

  const pageCount = Math.max(1, Math.ceil(searchedDocuments.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageDocuments = searchedDocuments.slice(
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

  const refetchReport = async () => {
    await Promise.all([refetchSnapshot(), outboundMetadataQuery.refetch()]);
  };

  const applyFilters = async () => {
    if (invalidRange || updating) return;
    setAppliedRecipient(draftRecipient);
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
      await refetchReport();
    }
  };

  const resetFilters = async () => {
    const next = initialRange();
    setDraftRange(next);
    setDraftRecipient("");
    setDraftStatus("");
    setAppliedRecipient("");
    setAppliedStatus("");
    setQuery("");
    setPage(1);
    setShowSuccess(false);
    setActionNotice(null);
    sawUpdateLoading.current = false;
    setUpdatePending(true);
    const rangeChanged =
      next.from !== appliedRange.from || next.to !== appliedRange.to;
    if (rangeChanged) setAppliedRange(next);
    else await refetchReport();
  };

  const widenRange = () => {
    const next = {
      from: dayjs().subtract(29, "day").format(ISO_DATE),
      to: dayjs().format(ISO_DATE),
    };
    setDraftRange(next);
    setAppliedRange(next);
    setDraftRecipient("");
    setDraftStatus("");
    setAppliedRecipient("");
    setAppliedStatus("");
    setUpdatePending(true);
    sawUpdateLoading.current = false;
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
    setActionNotice(
      firstPending
        ? tUi("updatedUi.text_02cd7d835950", { value0: String(pendingCount) })
        : tUi("updatedUi.text_9e6751b449e6"),
    );
    window.requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      tableRef.current?.focus({ preventScroll: true });
    });
  };

  const openDocument = (document: FlowDocument) => {
    setViewDocumentId(document.id);
  };

  const toastCopy = actionNotice
    ? { title: tUi("updatedUi.text_b6f8caf7b7cc"), detail: actionNotice }
    : showSuccess
      ? {
          title: tUi("updatedUi.text_5d0cd3a93731"),
          detail: tUi("updatedUi.text_d6c349552506"),
        }
      : null;

  return (
    <div className="hn-outbound-report" data-testid="rpt01-outbound-reference">
      {toastCopy ? (
        <div className="outbound-toast" role="status">
          <span className="outbound-toast__icon" aria-hidden="true">
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

      <header className="outbound-page-heading">
        <div>
          <h1 className="hn-report-page-title">
            {tUi("reports.inventoryFlowReport.outboundTitle")}
          </h1>
        </div>
        <div className="outbound-heading-actions">
          {canImport ? (
            <button
              type="button"
              className="outbound-intake-button"
              onClick={() => setIntakeOpen(true)}
            >
              <Icon name="package-plus" />
              {tUi("outbound.list.intake")}
            </button>
          ) : null}
        </div>
      </header>

      <section
        className="outbound-top-filters"
        aria-label="Bộ lọc báo cáo xuất kho"
      >
        <div
          className="outbound-top-filters__date"
          role="group"
          aria-label={tUi("reports.packingLabel.dateRangeLabel")}
        >
          <ReportDateRangePicker
            value={[
              draftRange.from ? dayjs(draftRange.from, ISO_DATE) : null,
              draftRange.to ? dayjs(draftRange.to, ISO_DATE) : null,
            ]}
            onChange={(value) =>
              setDraftRange({
                from: value?.[0]?.format(ISO_DATE) ?? "",
                to: value?.[1]?.format(ISO_DATE) ?? "",
              })
            }
            aria-label={tUi("reports.packingLabel.dateRangeLabel")}
            disabled={updating}
          />
        </div>
        <FilterCombobox
          id="rpt01b-recipient"
          value={draftRecipient}
          onChange={setDraftRecipient}
          options={recipientFilterOptions}
          icon="user-round"
          searchPlaceholder="Tìm người nhận..."
          ariaLabel="Chọn người nhận"
          disabled={updating}
        />
        <FilterCombobox
          id="rpt01b-status"
          value={draftStatus}
          onChange={setDraftStatus}
          options={statusFilterOptions}
          icon="file-clock"
          searchPlaceholder="Tìm trạng thái..."
          ariaLabel="Chọn trạng thái phiếu xuất"
          disabled={updating}
        />
        <div className="outbound-top-filters__actions">
          <button
            type="button"
            className="outbound-apply-button"
            onClick={() => void applyFilters()}
            disabled={invalidRange || updating}
          >
            {tUi("dashboard.snapshot.apply")}
          </button>
          <button
            type="button"
            className="outbound-reset-button"
            onClick={() => void resetFilters()}
            disabled={updating}
          >
            {tUi("reports.packingLabel.reset")}
          </button>
        </div>
      </section>

      {invalidRange ? (
        <aside className="outbound-invalid-banner" role="alert">
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
        <section className="outbound-error-card" role="alert">
          <span className="outbound-error-card__icon">
            <Icon name="triangle-alert" />
          </span>
          <small>{tUi("updatedUi.text_251995a970f7")}</small>
          <h2>{tUi("updatedUi.text_c1e574adfa82")}</h2>
          <p>{getApiErrorMessage(error, tUi("updatedUi.text_8bee0482cc4c"))}</p>
          <button type="button" onClick={() => void refetchReport()}>
            <Icon name="refresh-cw" />
            {" " + tUi("common.retry")}
          </button>
          <em>{tUi("updatedUi.text_a633b0be40c4")}</em>
        </section>
      ) : (
        <>
          <section
            className="outbound-reference-summary"
            aria-label={tUi("updatedUi.text_b11b59304497")}
            data-collapsed={!summaryOpen}
          >
            <div className="outbound-reference-summary__heading">
              <h2>{tUi("updatedUi.text_b11b59304497")}</h2>
              <CollapseButton
                title={tUi("updatedUi.text_b11b59304497")}
                expanded={summaryOpen}
                controls="outbound-reference-summary-content"
                onClick={() => setSummaryOpen((current) => !current)}
              />
            </div>
            <div id="outbound-reference-summary-content" hidden={!summaryOpen}>
              {updating ? (
                <div
                  className="outbound-reference-summary__loading"
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              ) : (
                <div className="outbound-reference-summary__grid">
                  <div className="outbound-reference-total">
                    <strong>{formatNumber(filteredDocuments.length)}</strong>
                    <span>{tUi("updatedUi.text_b825b57a8a53")}</span>
                  </div>
                  <div className="outbound-reference-summary__stats">
                    <div data-tone="draft">
                      <i />
                      <strong>{progress.pending}</strong>
                      <span>{tUi("outbound.detail.labelStatusDraft")}</span>
                    </div>
                    <div data-tone="scanning">
                      <i />
                      <strong>{progress.processing}</strong>
                      <span>{tUi("updatedUi.text_71e1f4001cc2")}</span>
                    </div>
                    <div data-tone="posted">
                      <i />
                      <strong>{progress.complete}</strong>
                      <span>{tUi("reports.traceability.issued")}</span>
                    </div>
                    <div data-tone="cancelled">
                      <i />
                      <strong>{progress.cancelled}</strong>
                      <span>{tUi("warranty.status.cancelled")}</span>
                    </div>
                  </div>
                </div>
              )}
              <aside className="outbound-scanner-banner" role="status">
                <Icon name="info" />
                <span>{tUi("updatedUi.text_ef700a3a2f41")}</span>
              </aside>
            </div>
          </section>

          <section
            className="outbound-kpi-grid"
            aria-label={tUi("reports.inventoryFlowReport.outboundQuickTitle")}
          >
            <span className="outbound-sr-only">
              {tUi("reports.inventoryFlowReport.outboundQuickTitle")}
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
                  title={tUi("updatedUi.text_71beef8c0375")}
                  value={issuedQuantity}
                  note="Trong kỳ đã chọn"
                  empty={reportEmpty}
                  expanded={kpiOpen.cyan}
                  onToggle={() => toggleKpi("cyan")}
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
                  expanded={kpiOpen.green}
                  onToggle={() => toggleKpi("green")}
                />
                <KpiCard
                  tone="violet"
                  icon="warehouse"
                  title={tUi("outbound.list.colRecipient")}
                  value={recipientCount}
                  note="Có phát sinh xuất"
                  empty={reportEmpty}
                  expanded={kpiOpen.violet}
                  onToggle={() => toggleKpi("violet")}
                />
                <KpiCard
                  tone="amber"
                  icon="triangle-alert"
                  title={tUi("updatedUi.text_90bb168358f1")}
                  value={pendingCount + progress.processing}
                  note={tUi("updatedUi.text_20a9363803ba", {
                    value0: String(pendingCount),
                    value1: String(progress.processing),
                  })}
                  empty={reportEmpty}
                  expanded={kpiOpen.amber}
                  onToggle={() => toggleKpi("amber")}
                />
              </>
            )}
          </section>

          <section className="outbound-analytics-grid">
            <article
              className="outbound-panel outbound-chart-panel"
              data-collapsed={!chartOpen}
            >
              <div className="outbound-panel-heading">
                <div>
                  <h2>{tUi("updatedUi.text_25b7ff634d6b")}</h2>
                  <p>{tUi("updatedUi.text_aa4934a59d93")}</p>
                </div>
                <div className="outbound-panel-heading__actions">
                  <span className="outbound-panel-total" hidden={!chartOpen}>
                    <strong>
                      {tUi("updatedUi.text_09caee89904d") + " "}
                      {formatNumber(issuedQuantity)}
                    </strong>
                    {" " + tUi("updatedUi.text_9bfcaa70b19e")}
                  </span>
                  <CollapseButton
                    title={tUi("updatedUi.text_25b7ff634d6b")}
                    expanded={chartOpen}
                    controls="outbound-chart-content"
                    onClick={() => setChartOpen((current) => !current)}
                  />
                </div>
              </div>
              <div id="outbound-chart-content" hidden={!chartOpen}>
                {updating ? (
                  <div className="outbound-chart-skeleton" aria-hidden="true">
                    {Array.from({ length: 7 }, (_, index) => (
                      <i key={index} />
                    ))}
                  </div>
                ) : reportEmpty ? (
                  <div className="outbound-empty-chart">
                    <span>
                      <Icon name="chart-column-big" />
                    </span>
                    <strong>{tUi("updatedUi.text_3c74df9b8416")}</strong>
                    <small>{tUi("updatedUi.text_f6125c738589")}</small>
                  </div>
                ) : (
                  <div
                    className="outbound-bar-chart"
                    role="img"
                    aria-label={tUi("updatedUi.text_518e399f02c3")}
                  >
                    <div className="outbound-chart-y-axis" aria-hidden="true">
                      <span>{formatNumber(chartCeiling)}</span>
                      <span>{formatNumber(chartCeiling * 0.75)}</span>
                      <span>{formatNumber(chartCeiling * 0.5)}</span>
                      <span>{formatNumber(chartCeiling * 0.25)}</span>
                      <span>0</span>
                    </div>
                    <div className="outbound-chart-scroll">
                      <div className="outbound-chart-plot">
                        <div
                          className="outbound-chart-gridlines"
                          aria-hidden="true"
                        >
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                        <div className="outbound-chart-bars">
                          {chartPoints.map((point) => (
                            <div
                              className="outbound-chart-bar"
                              key={point.date}
                              title={`${formatDay(point.date)}: ${formatNumber(point.value)}`}
                            >
                              <span>
                                {point.value > 0
                                  ? formatNumber(point.value)
                                  : ""}
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
              </div>
            </article>

            <article
              className="outbound-panel outbound-progress-panel"
              data-collapsed={!progressOpen}
            >
              <div className="outbound-panel-heading">
                <div>
                  <h2>{tUi("updatedUi.text_eb1594670cb4")}</h2>
                  <p>{tUi("updatedUi.text_410ce7ff86bb")}</p>
                </div>
                <CollapseButton
                  title={tUi("updatedUi.text_eb1594670cb4")}
                  expanded={progressOpen}
                  controls="outbound-progress-content"
                  onClick={() => setProgressOpen((current) => !current)}
                />
              </div>
              <div
                className="outbound-progress-panel__body"
                id="outbound-progress-content"
                hidden={!progressOpen}
              >
                {updating ? (
                  <div
                    className="outbound-progress-skeleton"
                    aria-hidden="true"
                  >
                    <span className="outbound-skeleton outbound-skeleton--donut" />
                    <span>
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                ) : reportEmpty ? (
                  <div className="outbound-empty-chart outbound-empty-chart--compact">
                    <span>
                      <Icon name="file-clock" />
                    </span>
                    <strong>{tUi("updatedUi.text_fea159fea064")}</strong>
                    <small>{tUi("updatedUi.text_c0a62bb8d645")}</small>
                  </div>
                ) : (
                  <div className="outbound-progress-content">
                    <div className="outbound-donut" style={donutStyle}>
                      <span>
                        <strong>{formatNumber(totalProgress)}</strong>
                        <small>{tUi("updatedUi.text_2d173f0e4679")}</small>
                      </span>
                    </div>
                    <ul className="outbound-progress-legend">
                      <li data-tone="complete">
                        <span>{tUi("iam.permissionAction.post")}</span>
                        <strong>{progress.complete}</strong>
                      </li>
                      <li data-tone="processing">
                        <span>{tUi("updatedUi.text_989a7c2159f4")}</span>
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
                <div className="outbound-pending-callout">
                  <span>
                    <Icon name="file-clock" />
                  </span>
                  <div>
                    <strong>
                      {pendingCount}
                      {" " + tUi("updatedUi.text_e62d651d4a57")}
                    </strong>
                    <small>{tUi("updatedUi.text_7f30733ab451")}</small>
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
              </div>
            </article>
          </section>

          <section
            className="outbound-panel outbound-table-panel"
            ref={tableRef}
            tabIndex={-1}
          >
            <div className="outbound-table-heading">
              <div>
                <span className="outbound-table-title-row">
                  <h2>{tUi("updatedUi.text_b6f8caf7b7cc")}</h2>
                </span>
              </div>
              <button
                type="button"
                className="outbound-refresh-button"
                onClick={() => void applyFilters()}
                disabled={updating || invalidRange}
              >
                {tUi("updatedUi.text_83ddf4187c12") + " "}
                <Icon name="refresh-cw" />
              </button>
            </div>

            <div
              className="outbound-reference-filters outbound-table-filters"
              role="region"
              aria-label="Bộ lọc danh sách phiếu xuất"
            >
              <label className="outbound-table-search">
                <Icon name="search" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Mã phiếu, mã tờ yêu cầu, người nhận..."
                  aria-label={tUi("outbound.list.searchAria")}
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
              <FilterCombobox
                id="rpt01b-table-status"
                value={appliedStatus}
                onChange={(value) => {
                  setDraftStatus(value);
                  setAppliedStatus(value);
                  setPage(1);
                }}
                options={statusFilterOptions.map((option) => ({
                  ...option,
                  label: `${tUi("dashboard.composition.colStatus")}: ${option.label}`,
                }))}
                icon="file-clock"
                searchPlaceholder="Tìm trạng thái..."
                ariaLabel="Lọc trạng thái"
                disabled={updating}
              />
              <FilterCombobox
                id="rpt01b-table-recipient"
                value={appliedRecipient}
                onChange={(value) => {
                  setDraftRecipient(value);
                  setAppliedRecipient(value);
                  setPage(1);
                }}
                options={recipientFilterOptions.map((option) => ({
                  ...option,
                  label: `${tUi("outbound.list.colRecipient")}: ${option.label}`,
                }))}
                icon="user-round"
                searchPlaceholder="Tìm người nhận..."
                ariaLabel="Lọc người nhận"
                disabled={updating}
              />
              {query || appliedRecipient || appliedStatus ? (
                <button
                  type="button"
                  className="outbound-clear-filters"
                  disabled={updating}
                  onClick={() => {
                    setQuery("");
                    setDraftStatus("");
                    setAppliedStatus("");
                    setDraftRecipient("");
                    setAppliedRecipient("");
                    setPage(1);
                  }}
                >
                  Xóa lọc
                </button>
              ) : null}
            </div>

            {updating ? (
              <div className="outbound-table-skeleton" aria-hidden="true">
                {Array.from({ length: 6 }, (_, row) => (
                  <div key={row}>
                    {Array.from({ length: 6 }, (_, cell) => (
                      <i key={cell} />
                    ))}
                  </div>
                ))}
              </div>
            ) : reportEmpty ? (
              <div className="outbound-empty-table">
                <span>
                  <Icon name="inbox" />
                </span>
                <h3>{tUi("updatedUi.text_22ddab94d334")}</h3>
                <p>{tUi("updatedUi.text_3b849599a666")}</p>
                <button type="button" onClick={widenRange}>
                  <Icon name="calendar-days" />
                  {" " + tUi("updatedUi.text_879c05bb679d")}
                </button>
              </div>
            ) : searchEmpty ? (
              <div className="outbound-empty-table outbound-empty-table--search">
                <span>
                  <Icon name="search" />
                </span>
                <h3>{tUi("updatedUi.text_e069efc59c5c")}</h3>
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
              <div className="outbound-table-wrap outbound-report-table">
                <table>
                  <colgroup>
                    {[5, 21, 20, 23, 12, 12, 7].map((width, index) => (
                      <col key={index} style={{ width: `${width}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">{tUi("shared.table.rowNumber")}</th>
                      <th>
                        {tUi("outbound.list.colDocument")}
                        <span className="outbound-tablet-only">
                          {" " + tUi("updatedUi.text_52d04fdc17f2")}
                        </span>
                      </th>
                      <th className="outbound-reference-request">
                        {tUi("updatedUi.text_49c053966833")}
                      </th>
                      <th>{tUi("outbound.list.colRecipient")}</th>
                      <th className="outbound-desktop-date">
                        {tUi("inbound.list.colCreated")}
                      </th>
                      <th>{tUi("dashboard.composition.colStatus")}</th>
                      <th aria-label={tUi("outbound.detail.colAction")} />
                    </tr>
                  </thead>
                  <tbody>
                    {pageDocuments.map((document, index) => {
                      const tone = statusTone(document.status);
                      const metadata =
                        outboundMetadataByDocument.get(document.id) ??
                        outboundMetadataByDocument.get(document.document_no);
                      const requestNo = metadata?.requestNo?.trim() || "—";
                      return (
                        <tr key={document.id}>
                          <td
                            className="outbound-row-number"
                            data-label={tUi("shared.table.rowNumber")}
                          >
                            {(safePage - 1) * pageSize + index + 1}
                          </td>
                          <td
                            data-label={tUi("warranty.componentList.colCode")}
                          >
                            <strong>{document.document_no || "—"}</strong>
                            <small className="outbound-tablet-only">
                              {requestNo}
                            </small>
                          </td>
                          <td
                            className="outbound-reference-request"
                            data-label={tUi("updatedUi.text_49c053966833")}
                            title={requestNo === "—" ? undefined : requestNo}
                          >
                            {requestNo}
                          </td>
                          <td
                            data-label={tUi("outbound.list.colRecipient")}
                            className="outbound-recipient-cell"
                          >
                            <span className="outbound-recipient-name">
                              {document.counterpart || "—"}
                            </span>
                          </td>
                          <td
                            className="outbound-desktop-date"
                            data-label={tUi("inbound.list.colCreated")}
                          >
                            {formatDay(documentDay(document))}
                          </td>
                          <td
                            data-label={tUi("dashboard.composition.colStatus")}
                          >
                            <span className="outbound-status" data-tone={tone}>
                              {outboundStatusLabel(document.status)}
                            </span>
                          </td>
                          <td>
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
                                onClick={() => openDocument(document)}
                              >
                                {normalizeStatus(document.status) === "POSTED"
                                  ? "Xem"
                                  : tUi("outbound.list.open")}
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

            <footer className="outbound-table-footer hn-report-pagination-footer">
              <div className="outbound-table-summary">
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
                <label className="outbound-page-size">
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    aria-label={tUi("shared.table.rowsPerPageAria")}
                  >
                    {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {tUi("shared.table.perPage", { size: String(size) })}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" />
                </label>
              </div>
              <div className="outbound-pagination hn-report-pagination">
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
          className="outbound-loading-overlay"
          role="status"
          aria-live="polite"
        >
          <div>
            <span className="outbound-loading-mark">
              <Icon name="warehouse" />
            </span>
            <i className="outbound-spinner" />
            <strong>{tUi("updatedUi.text_434c42929257")}</strong>
            <small>{tUi("updatedUi.text_b271581f3ca5")}</small>
          </div>
        </div>
      ) : null}

      {intakeOpen ? (
        <OutboundIntakeModal
          open
          canImport={canImport}
          onClose={() => setIntakeOpen(false)}
          onConsumed={(documentIds) => {
            setIntakeOpen(false);
            void refetchReport();
            if (documentIds[0]) setViewDocumentId(documentIds[0]);
          }}
        />
      ) : null}

      {viewDocumentId ? (
        <AlignedOutboundDetailModal
          documentId={viewDocumentId}
          onClose={() => setViewDocumentId(null)}
          onChanged={() => void refetchReport()}
        />
      ) : null}
    </div>
  );
}
