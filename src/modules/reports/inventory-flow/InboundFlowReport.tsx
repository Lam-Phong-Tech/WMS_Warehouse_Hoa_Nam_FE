import { CheckOutlined } from "@/shared/components/icons";
import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dayjs, { type Dayjs } from "dayjs";
import { UiVuexyDateRangePicker, VuexyDemoIcon } from "@/shared/ui";
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

const PAGE_SIZE = 5;
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
  if (tone === "complete") return "Hoàn tất";
  if (tone === "processing") return "Đang nhập";
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

function dateRangeValue(range: DateRange): [Dayjs | null, Dayjs | null] {
  return [
    range.from ? dayjs(range.from, ISO_DATE) : null,
    range.to ? dayjs(range.to, ISO_DATE) : null,
  ];
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
        <small>{empty ? "Chưa có dữ liệu" : note}</small>
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
      { value: "", label: "Tất cả nhà cung cấp" },
      ...supplierOptions.map((supplier) => ({
        value: supplier,
        label: supplier,
      })),
    ],
    [supplierOptions],
  );

  const statusFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: "Tất cả trạng thái" },
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

  const exportReason = (() => {
    if (exporter.exporting) return "Đang chuẩn bị tệp Excel";
    if (updating) return "Đang cập nhật dữ liệu";
    if (error != null) return "Không thể xuất khi báo cáo lỗi";
    if (invalidRange) return "Khoảng ngày không hợp lệ";
    if (!canExport) return "Bạn không có quyền xuất báo cáo";
    if (filteredDocuments.length === 0) return "Không có dữ liệu để xuất";
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
        ? `Đã lọc ${pendingCount} phiếu đang chờ duyệt.`
        : "Hiện không có phiếu nhập nào đang chờ duyệt.",
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
    ? { title: "Danh sách phiếu nhập", detail: actionNotice }
    : showSuccess
      ? { title: "Đã cập nhật báo cáo", detail: "Dữ liệu đã được làm mới." }
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

      <nav className="inbound-breadcrumb" aria-label="Đường dẫn">
        <Icon name="layout-dashboard" />
        <span>Báo cáo</span>
        <b>/</b>
        <strong>Nhập kho</strong>
      </nav>

      <header className="inbound-page-heading">
        <div>
          <h1 className="hn-report-page-title">Báo cáo Nhập kho</h1>
          <p>Theo dõi sản lượng, tiến độ và chứng từ nhập kho</p>
        </div>
        <div className="inbound-heading-actions">
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
              {exporter.exporting ? "Đang xuất..." : "Xuất Excel"}
            </button>
          </span>
          <div className="inbound-warehouse-card">
            <span className="inbound-warehouse-card__icon">
              <Icon name="warehouse" />
            </span>
            <span>
              <strong>Kho Hoa Nam</strong>
              <small>
                <i /> Đang hoạt động
              </small>
            </span>
          </div>
        </div>
      </header>

      {!canExport ? (
        <aside className="inbound-readonly-banner" role="status">
          <span>
            <Icon name="lock" />
          </span>
          <div>
            <strong>Chế độ chỉ xem</strong>
            <p>
              Bạn có thể xem và lọc báo cáo nhưng không có quyền xuất dữ liệu.
            </p>
          </div>
        </aside>
      ) : null}

      <section className="inbound-filter-card" aria-label="Bộ lọc báo cáo">
        <div className="inbound-filter-grid">
          <label
            className={`inbound-filter-field inbound-filter-field--date${invalidRange ? " is-invalid" : ""}`}
          >
            <span>Khoảng thời gian</span>
            <UiVuexyDateRangePicker
              className="inbound-date-range"
              popupClassName="inbound-date-popup"
              value={dateRangeValue(draftRange)}
              onChange={(value) =>
                setDraftRange({
                  from: value?.[0]?.format(ISO_DATE) ?? "",
                  to: value?.[1]?.format(ISO_DATE) ?? "",
                })
              }
              aria-label="Khoảng thời gian báo cáo nhập kho"
              disabled={updating}
            />
            {invalidRange ? (
              <small>Ngày bắt đầu phải trước hoặc bằng ngày kết thúc</small>
            ) : null}
          </label>
          <p className="inbound-filter-note">
            <Icon name="file-clock" />
            {dayjs(appliedRange.to).diff(dayjs(appliedRange.from), "day") +
              1}{" "}
            ngày gần nhất · Múi giờ Việt Nam
          </p>
          <div
            className="inbound-filter-field"
            data-filter="supplier"
            role="group"
            aria-labelledby="rpt01-supplier-label"
          >
            <span id="rpt01-supplier-label">Nhà cung cấp</span>
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
            <span id="rpt01-status-label">Trạng thái</span>
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
              Áp dụng
            </button>
            <button
              type="button"
              className="inbound-reset-button"
              onClick={() => void resetFilters()}
              disabled={updating}
            >
              Đặt lại
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
            <strong>Khoảng thời gian chưa hợp lệ</strong>
            <p>Dữ liệu bên dưới vẫn là kết quả của kỳ đã áp dụng gần nhất.</p>
          </div>
        </aside>
      ) : null}

      {error != null && !loading ? (
        <section className="inbound-error-card" role="alert">
          <span className="inbound-error-card__icon">
            <Icon name="triangle-alert" />
          </span>
          <small>BÁO CÁO NHẬP KHO</small>
          <h2>Không thể tải báo cáo</h2>
          <p>
            {getApiErrorMessage(
              error,
              "Đã xảy ra lỗi khi tải dữ liệu báo cáo.",
            )}
          </p>
          <button type="button" onClick={() => void refetch()}>
            <Icon name="refresh-cw" /> Thử lại
          </button>
          <em>Bộ lọc hiện tại vẫn được giữ nguyên · Mã tham chiếu RPT-01</em>
        </section>
      ) : (
        <>
          <section className="inbound-kpi-grid" aria-label="Tổng quan nhập kho">
            <span className="inbound-sr-only">Tổng quan nhập kho</span>
            {updating ? (
              Array.from({ length: 4 }, (_, index) => (
                <KpiSkeleton key={index} />
              ))
            ) : (
              <>
                <KpiCard
                  tone="cyan"
                  icon="package-plus"
                  title="Sản phẩm đã nhập"
                  value={receivedQuantity}
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
                  title="Nhà cung cấp"
                  value={supplierCount}
                  note="Có phát sinh nhập"
                  empty={reportEmpty}
                />
                <KpiCard
                  tone="amber"
                  icon="triangle-alert"
                  title="Phiếu cần xử lý"
                  value={pendingCount + progress.processing}
                  note={`${pendingCount} chờ duyệt · ${progress.processing} đang nhập`}
                  empty={reportEmpty}
                />
              </>
            )}
          </section>

          <section className="inbound-analytics-grid">
            <article className="inbound-panel inbound-chart-panel">
              <div className="inbound-panel-heading">
                <div>
                  <h2>Sản lượng nhập theo ngày</h2>
                  <p>Số lượng sản phẩm thực nhập</p>
                </div>
                <span className="inbound-panel-total">
                  <strong>Tổng: {formatNumber(receivedQuantity)}</strong> sản
                  phẩm
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
                  <strong>Chưa có sản lượng nhập kho</strong>
                  <small>
                    Dữ liệu biểu đồ sẽ xuất hiện khi có phiếu nhập trong kỳ.
                  </small>
                </div>
              ) : (
                <div
                  className="inbound-bar-chart"
                  role="img"
                  aria-label="Biểu đồ sản lượng nhập theo ngày"
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
                  <h2>Tiến độ phiếu nhập</h2>
                  <p>Tình trạng xử lý trong kỳ</p>
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
                  <strong>Chưa có phiếu nhập</strong>
                  <small>Tiến độ sẽ được tổng hợp khi có dữ liệu.</small>
                </div>
              ) : (
                <div className="inbound-progress-content">
                  <div className="inbound-donut" style={donutStyle}>
                    <span>
                      <strong>{formatNumber(totalProgress)}</strong>
                      <small>Tổng phiếu</small>
                    </span>
                  </div>
                  <ul className="inbound-progress-legend">
                    <li data-tone="complete">
                      <span>Hoàn tất</span>
                      <strong>{progress.complete}</strong>
                    </li>
                    <li data-tone="processing">
                      <span>Đang nhập</span>
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
              <div className="inbound-pending-callout">
                <span>
                  <Icon name="file-clock" />
                </span>
                <div>
                  <strong>{pendingCount} phiếu chờ duyệt</strong>
                  <small>Cần xử lý để hoàn tất nhập kho</small>
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
            className="inbound-panel inbound-table-panel"
            ref={tableRef}
            tabIndex={-1}
          >
            <div className="inbound-table-heading">
              <div>
                <span className="inbound-table-title-row">
                  <h2>Danh sách phiếu nhập</h2>
                  <b>{filteredDocuments.length}</b>
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
                  placeholder="Tìm mã phiếu, nhà cung cấp..."
                  aria-label="Tìm phiếu nhập"
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
                <h3>Chưa có dữ liệu nhập kho</h3>
                <p>Không tìm thấy phiếu nhập trong khoảng thời gian đã chọn.</p>
                <button type="button" onClick={widenRange}>
                  <Icon name="calendar-days" /> Mở rộng khoảng thời gian
                </button>
              </div>
            ) : searchEmpty ? (
              <div className="inbound-empty-table inbound-empty-table--search">
                <span>
                  <Icon name="search" />
                </span>
                <h3>Không tìm thấy phiếu nhập</h3>
                <p>
                  Không có kết quả phù hợp với “{query}”. Hãy thử từ khóa khác.
                </p>
                <button type="button" onClick={() => setQuery("")}>
                  Xóa tìm kiếm
                </button>
              </div>
            ) : (
              <div className="inbound-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Mã phiếu{" "}
                        <span className="inbound-tablet-only">/ Ngày</span>
                      </th>
                      <th className="inbound-desktop-date">Ngày nhập</th>
                      <th>Nhà cung cấp</th>
                      <th className="is-number">SL thực nhập</th>
                      <th>Trạng thái</th>
                      <th className="inbound-created-by">Người tạo</th>
                      <th>
                        <span className="sr-only">Thao tác</span>
                      </th>
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
                          <td data-label="Mã phiếu">
                            <strong>{document.document_no || "—"}</strong>
                            <small className="inbound-tablet-only">
                              {formatDay(documentDay(document))}
                            </small>
                          </td>
                          <td
                            className="inbound-desktop-date"
                            data-label="Ngày nhập"
                          >
                            {formatDay(documentDay(document))}
                          </td>
                          <td data-label="Nhà cung cấp">
                            <span className="inbound-supplier-name">
                              {document.counterpart || "—"}
                            </span>
                          </td>
                          <td className="is-number" data-label="SL thực nhập">
                            <strong>
                              {formatNumber(
                                quantityByDocument.get(document.document_no) ??
                                  0,
                              )}
                            </strong>
                          </td>
                          <td data-label="Trạng thái">
                            <span className="inbound-status" data-tone={tone}>
                              {inboundStatusLabel(document.status)}
                            </span>
                          </td>
                          <td
                            className="inbound-created-by"
                            data-label="Người tạo"
                          >
                            {document.created_by_name || "—"}
                          </td>
                          <td data-label="Thao tác">
                            <RowActionGroup>
                              <RowActionButton
                                kind="view"
                                type="button"
                                aria-label={`Xem phiếu ${document.document_no}`}
                                title={`Xem phiếu ${document.document_no}`}
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
              <span>
                {searchedDocuments.length === 0
                  ? `0 kết quả / ${filteredDocuments.length} phiếu`
                  : `Hiển thị ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, searchedDocuments.length)} trong ${searchedDocuments.length} phiếu`}
              </span>
              <div className="inbound-pagination hn-report-pagination">
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
          className="inbound-loading-overlay"
          role="status"
          aria-live="polite"
        >
          <div>
            <span className="inbound-loading-mark">
              <Icon name="warehouse" />
            </span>
            <i className="inbound-spinner" />
            <strong>Đang cập nhật báo cáo</strong>
            <small>Vui lòng chờ trong giây lát...</small>
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
