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

const PAGE_SIZE = 5;
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
  if (tone === "complete") return "Đã xuất kho";
  if (tone === "processing") return "Đang xuất";
  if (tone === "pending") return "Chờ duyệt";
  if (tone === "cancelled") return "Đã hủy";
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
              aria-label="Xóa từ khóa tìm kiếm"
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
                    ✓
                  </b>
                ) : null}
              </button>
            ))
          ) : (
            <span className="outbound-filter-combobox__empty">
              Không tìm thấy kết quả
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
    <article className="outbound-kpi" data-tone={tone}>
      <div className="outbound-kpi__copy">
        <span>{title}</span>
        <strong>
          {empty
            ? "—"
            : typeof value === "number"
              ? formatNumber(value)
              : value}
        </strong>
        <small>{empty ? "Chưa có dữ liệu" : note}</small>
      </div>
      <span className="outbound-kpi__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
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
  const [draftRange, setDraftRange] = useState<DateRange>(initialRange);
  const [appliedRange, setAppliedRange] = useState<DateRange>(initialRange);
  const [draftRecipient, setDraftRecipient] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [appliedRecipient, setAppliedRecipient] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
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
      { value: "", label: "Tất cả người nhận" },
      ...recipientOptions.map((recipient) => ({
        value: recipient,
        label: recipient,
      })),
    ],
    [recipientOptions],
  );

  const statusFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: "Tất cả trạng thái" },
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
        metadata?.note,
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

  const pageCount = Math.max(
    1,
    Math.ceil(searchedDocuments.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount);
  const pageDocuments = searchedDocuments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
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
    setSelectedDocument(null);
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
    setSelectedDocument(firstPending?.id ?? null);
    setActionNotice(
      firstPending
        ? `Đã lọc ${pendingCount} phiếu đang chờ duyệt.`
        : "Hiện không có phiếu xuất nào đang chờ duyệt.",
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
    ? { title: "Danh sách phiếu xuất", detail: actionNotice }
    : showSuccess
      ? { title: "Đã cập nhật báo cáo", detail: "Dữ liệu đã được làm mới." }
      : null;

  return (
    <div className="hn-outbound-report" data-testid="rpt01-outbound-reference">
      {toastCopy ? (
        <div className="outbound-toast" role="status">
          <span className="outbound-toast__icon">✓</span>
          <span>
            <strong>{toastCopy.title}</strong>
            <small>{toastCopy.detail}</small>
          </span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => {
              setShowSuccess(false);
              setActionNotice(null);
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      <nav className="outbound-breadcrumb" aria-label="Đường dẫn">
        <span>Xuất kho</span>
        <Icon name="chevron-right" />
        <strong>Phiếu xuất kho</strong>
      </nav>

      <header className="outbound-page-heading">
        <div>
          <h1>Phiếu xuất kho</h1>
          <p>Tiếp nhận, quản lý và theo dõi tiến độ xuất kho từ Scanner App</p>
        </div>
        <div className="outbound-heading-actions">
          <div className="outbound-warehouse-card">
            <span className="outbound-warehouse-card__icon">
              <Icon name="warehouse" />
            </span>
            <span>
              <strong>Kho Hoa Nam</strong>
              <small>
                <i /> Đang hoạt động
              </small>
            </span>
            <Icon name="chevron-down" />
          </div>
          {canImport ? (
            <button
              type="button"
              className="outbound-intake-button"
              onClick={() => setIntakeOpen(true)}
            >
              <Icon name="package-plus" />
              Tiếp nhận yêu cầu xuất
            </button>
          ) : null}
        </div>
      </header>

      {invalidRange ? (
        <aside className="outbound-invalid-banner" role="alert">
          <span>
            <Icon name="triangle-alert" />
          </span>
          <div>
            <strong>Khoảng thời gian chưa hợp lệ</strong>
            <p>Dữ liệu bên dưới vẫn là kết quả của kỳ đã áp dụng gần nhất.</p>
          </div>
        </aside>
      ) : null}

      {error != null && !loading ? (
        <section className="outbound-error-card" role="alert">
          <span className="outbound-error-card__icon">
            <Icon name="triangle-alert" />
          </span>
          <small>BÁO CÁO XUẤT KHO</small>
          <h2>Không thể tải báo cáo</h2>
          <p>
            {getApiErrorMessage(
              error,
              "Đã xảy ra lỗi khi tải dữ liệu báo cáo.",
            )}
          </p>
          <button type="button" onClick={() => void refetchReport()}>
            <Icon name="refresh-cw" /> Thử lại
          </button>
          <em>Bộ lọc hiện tại vẫn được giữ nguyên · Mã tham chiếu RPT-01B</em>
        </section>
      ) : (
        <>
          <section
            className="outbound-reference-summary"
            aria-label="Tình trạng xử lý phiếu"
          >
            <h2>Tình trạng xử lý phiếu</h2>
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
                  <span>Tổng phiếu xuất</span>
                </div>
                <div className="outbound-reference-summary__stats">
                  <div data-tone="draft">
                    <i />
                    <strong>{progress.pending}</strong>
                    <span>Nháp</span>
                  </div>
                  <div data-tone="scanning">
                    <i />
                    <strong>{progress.processing}</strong>
                    <span>Đang quét xuất hàng</span>
                  </div>
                  <div data-tone="posted">
                    <i />
                    <strong>{progress.complete}</strong>
                    <span>Đã xuất kho</span>
                  </div>
                  <div data-tone="cancelled">
                    <i />
                    <strong>{progress.cancelled}</strong>
                    <span>Đã hủy</span>
                  </div>
                </div>
              </div>
            )}
            <aside className="outbound-scanner-banner" role="status">
              <Icon name="info" />
              <span>
                Quét và đối chiếu thực hiện trên Scanner App. Chỉ Post Issue
                thành công mới làm giảm tồn kho; in hoặc in lại nhãn không làm
                thay đổi tồn.
              </span>
            </aside>
          </section>

          <section
            className="outbound-kpi-grid"
            aria-label="Tổng quan xuất kho"
          >
            <span className="outbound-sr-only">Tổng quan xuất kho</span>
            {updating ? (
              Array.from({ length: 4 }, (_, index) => (
                <KpiSkeleton key={index} />
              ))
            ) : (
              <>
                <KpiCard
                  tone="cyan"
                  icon="package-plus"
                  title="Sản phẩm đã xuất"
                  value={issuedQuantity}
                  note="Trong kỳ đã chọn"
                  empty={reportEmpty}
                />
                <KpiCard
                  tone="green"
                  icon="file-clock"
                  title="Phiếu hoàn tất"
                  value={`${completedCount} / ${filteredDocuments.length}`}
                  note={
                    filteredDocuments.length
                      ? `${formatNumber((completedCount / filteredDocuments.length) * 100)}% tổng phiếu`
                      : "Chưa có dữ liệu"
                  }
                  empty={reportEmpty}
                />
                <KpiCard
                  tone="violet"
                  icon="warehouse"
                  title="Người nhận"
                  value={recipientCount}
                  note="Có phát sinh xuất"
                  empty={reportEmpty}
                />
                <KpiCard
                  tone="amber"
                  icon="triangle-alert"
                  title="Phiếu cần xử lý"
                  value={pendingCount + progress.processing}
                  note={`${pendingCount} chờ duyệt · ${progress.processing} đang xuất`}
                  empty={reportEmpty}
                />
              </>
            )}
          </section>

          <section className="outbound-analytics-grid">
            <article className="outbound-panel outbound-chart-panel">
              <div className="outbound-panel-heading">
                <div>
                  <h2>Sản lượng xuất theo ngày</h2>
                  <p>Số lượng sản phẩm thực xuất</p>
                </div>
                <span className="outbound-panel-total">
                  <strong>Tổng: {formatNumber(issuedQuantity)}</strong> sản phẩm
                </span>
              </div>
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
                  <strong>Chưa có sản lượng xuất kho</strong>
                  <small>
                    Dữ liệu biểu đồ sẽ xuất hiện khi có phiếu xuất trong kỳ.
                  </small>
                </div>
              ) : (
                <div
                  className="outbound-bar-chart"
                  role="img"
                  aria-label="Biểu đồ sản lượng xuất theo ngày"
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

            <article className="outbound-panel outbound-progress-panel">
              <div className="outbound-panel-heading">
                <div>
                  <h2>Tiến độ phiếu xuất</h2>
                  <p>Tình trạng xử lý trong kỳ</p>
                </div>
              </div>
              {updating ? (
                <div className="outbound-progress-skeleton" aria-hidden="true">
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
                  <strong>Chưa có phiếu xuất</strong>
                  <small>Tiến độ sẽ được tổng hợp khi có dữ liệu.</small>
                </div>
              ) : (
                <div className="outbound-progress-content">
                  <div className="outbound-donut" style={donutStyle}>
                    <span>
                      <strong>{formatNumber(totalProgress)}</strong>
                      <small>Tổng phiếu</small>
                    </span>
                  </div>
                  <ul className="outbound-progress-legend">
                    <li data-tone="complete">
                      <span>Hoàn tất</span>
                      <strong>{progress.complete}</strong>
                    </li>
                    <li data-tone="processing">
                      <span>Đang xuất</span>
                      <strong>{progress.processing}</strong>
                    </li>
                    <li data-tone="pending">
                      <span>Chờ duyệt</span>
                      <strong>{progress.pending}</strong>
                    </li>
                    <li data-tone="cancelled">
                      <span>Đã hủy</span>
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
                  <strong>{pendingCount} phiếu chờ duyệt</strong>
                  <small>Cần xử lý để hoàn tất xuất kho</small>
                </div>
                <button
                  type="button"
                  onClick={scrollToPending}
                  disabled={reportEmpty || updating}
                >
                  Xem phiếu <Icon name="arrow-right" />
                </button>
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
                  <h2>Danh sách phiếu xuất</h2>
                  <b>{filteredDocuments.length}</b>
                </span>
              </div>
              <button
                type="button"
                className="outbound-refresh-button"
                onClick={() => void applyFilters()}
                disabled={updating || invalidRange}
              >
                Cập nhật mới nhất <Icon name="refresh-cw" />
              </button>
            </div>

            <div
              className="outbound-reference-filters"
              aria-label="Bộ lọc phiếu xuất"
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
                  placeholder="Mã phiếu hoặc ghi chú..."
                  aria-label="Tìm phiếu xuất"
                  disabled={updating || reportEmpty}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Xóa từ khóa"
                  >
                    ×
                  </button>
                ) : null}
              </label>
              <div className="outbound-reference-filter" data-filter="status">
                <span>Trạng thái</span>
                <FilterCombobox
                  id="rpt01-status"
                  value={draftStatus}
                  onChange={setDraftStatus}
                  options={statusFilterOptions}
                  icon="file-clock"
                  searchPlaceholder="Tìm trạng thái..."
                  ariaLabel="Chọn trạng thái phiếu xuất"
                  disabled={updating}
                />
              </div>
              <div
                className="outbound-reference-filter"
                data-filter="recipient"
              >
                <span>Người nhận</span>
                <FilterCombobox
                  id="rpt01-recipient"
                  value={draftRecipient}
                  onChange={setDraftRecipient}
                  options={recipientFilterOptions}
                  icon="user-round"
                  searchPlaceholder="Tìm người nhận..."
                  ariaLabel="Chọn người nhận"
                  disabled={updating}
                />
              </div>
              <button
                type="button"
                className="outbound-apply-button"
                onClick={() => void applyFilters()}
                disabled={invalidRange || updating}
              >
                Áp dụng
              </button>
              <button
                type="button"
                className="outbound-reset-button"
                onClick={() => void resetFilters()}
                disabled={updating}
              >
                Đặt lại
              </button>
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
                <h3>Chưa có dữ liệu xuất kho</h3>
                <p>Không tìm thấy phiếu xuất trong khoảng thời gian đã chọn.</p>
                <button type="button" onClick={widenRange}>
                  <Icon name="calendar-days" /> Mở rộng khoảng thời gian
                </button>
              </div>
            ) : searchEmpty ? (
              <div className="outbound-empty-table outbound-empty-table--search">
                <span>
                  <Icon name="search" />
                </span>
                <h3>Không tìm thấy phiếu xuất</h3>
                <p>
                  Không có kết quả phù hợp với “{query}”. Hãy thử từ khóa khác.
                </p>
                <button type="button" onClick={() => setQuery("")}>
                  Xóa tìm kiếm
                </button>
              </div>
            ) : (
              <div className="outbound-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Phiếu xuất
                        <span className="outbound-tablet-only"> / Toà</span>
                      </th>
                      <th className="outbound-reference-request">
                        Mã tòa yêu cầu
                      </th>
                      <th>Người nhận</th>
                      <th className="outbound-desktop-date">Ngày tạo</th>
                      <th className="outbound-reference-note">Ghi chú</th>
                      <th className="outbound-reference-progress">Đối chiếu</th>
                      <th>Trạng thái</th>
                      <th>
                        <span className="sr-only">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageDocuments.map((document) => {
                      const tone = statusTone(document.status);
                      const selected = selectedDocument === document.id;
                      const metadata =
                        outboundMetadataByDocument.get(document.id) ??
                        outboundMetadataByDocument.get(document.document_no);
                      const requestNo = metadata?.requestNo?.trim() || "—";
                      const note = metadata?.note?.trim() || "—";
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
                          <td data-label="Mã phiếu">
                            <strong>{document.document_no || "—"}</strong>
                            <small className="outbound-tablet-only">
                              {requestNo}
                            </small>
                          </td>
                          <td
                            className="outbound-reference-request"
                            data-label="Mã tòa yêu cầu"
                            title={requestNo === "—" ? undefined : requestNo}
                          >
                            {requestNo}
                          </td>
                          <td
                            data-label="Người nhận"
                            className="outbound-recipient-cell"
                          >
                            <span className="outbound-recipient-name">
                              {document.counterpart || "—"}
                            </span>
                          </td>
                          <td
                            className="outbound-desktop-date"
                            data-label="Ngày tạo"
                          >
                            {formatDay(documentDay(document))}
                          </td>
                          <td
                            className="outbound-reference-note"
                            data-label="Ghi chú"
                            title={note === "—" ? undefined : note}
                          >
                            {note}
                          </td>
                          <td
                            className="outbound-reference-progress"
                            data-label="Đối chiếu"
                          >
                            <span
                              className="outbound-reconcile"
                              data-tone={
                                normalizeStatus(document.status) === "POSTED"
                                  ? "complete"
                                  : "empty"
                              }
                            >
                              <i />
                              <b>
                                {normalizeStatus(document.status) === "POSTED"
                                  ? `${formatNumber(quantityByDocument.get(document.document_no) ?? 0)} đã xuất`
                                  : "—"}
                              </b>
                            </span>
                          </td>
                          <td data-label="Trạng thái">
                            <span className="outbound-status" data-tone={tone}>
                              {outboundStatusLabel(document.status)}
                            </span>
                          </td>
                          <td data-label="Thao tác">
                            <button
                              type="button"
                              aria-label={`Xem phiếu ${document.document_no}`}
                              title={`Xem phiếu ${document.document_no}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openDocument(document);
                              }}
                            >
                              <Icon
                                name={
                                  normalizeStatus(document.status) === "POSTED"
                                    ? "eye"
                                    : "chevron-right"
                                }
                              />
                              <span>
                                {normalizeStatus(document.status) === "POSTED"
                                  ? "Xem"
                                  : "Mở"}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="outbound-table-footer">
              <span>
                {searchedDocuments.length === 0
                  ? `0 kết quả / ${filteredDocuments.length} phiếu`
                  : `Hiển thị ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, searchedDocuments.length)} trong ${searchedDocuments.length} phiếu`}
              </span>
              <div className="outbound-pagination">
                <button
                  type="button"
                  aria-label="Trang trước"
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
            <strong>Đang cập nhật báo cáo</strong>
            <small>Vui lòng chờ trong giây lát...</small>
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
