import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Dayjs } from "dayjs";
import { Link } from "react-router-dom";
import { UiVuexyDateRangePicker } from "@/shared/ui";
import {
  CloseOutlined,
  DownOutlined,
  DownloadOutlined,
  HistoryOutlined,
  StockOutlined,
  SwapOutlined,
  UserOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import type { ExportState, TransactionFilter } from "./model";
import { VI_TIMEZONE_LABEL } from "./model";

function Skeleton({ width = "70%", height = 12 }: { width?: string; height?: number }) {
  return (
    <span
      className="rpt08-skeleton"
      aria-hidden="true"
      style={{ width, height }}
    />
  );
}

function SelectControl<T extends string>({
  ariaLabel,
  value,
  options,
  icon,
  disabled,
  readonly,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  icon: ReactNode;
  disabled?: boolean;
  readonly?: boolean;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={
        "rpt08-select" +
        (open ? " is-open" : "") +
        (readonly ? " is-readonly" : "")
      }
    >
      <button
        type="button"
        className="rpt08-select__button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (!readonly) setOpen((valueOpen) => !valueOpen);
        }}
      >
        <span className="rpt08-select__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="rpt08-select__value">{current?.label ?? "—"}</span>
        <DownOutlined className="rpt08-select__chevron" />
      </button>
      {open ? (
        <div
          id={`${id}-listbox`}
          className="rpt08-select__menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "is-selected" : ""}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DateRangeControl({
  value,
  invalid,
  disabled,
  onChange,
}: {
  value: [Dayjs, Dayjs];
  invalid?: boolean;
  disabled?: boolean;
  onChange: (value: [Dayjs, Dayjs]) => void;
}) {
  const pickerValue: [Dayjs, Dayjs] = value[0].isAfter(value[1])
    ? [value[1], value[0]]
    : value;

  return (
    <div
      className={"rpt08-date-control" + (invalid ? " is-invalid" : "")}
      aria-invalid={invalid || undefined}
      tabIndex={-1}
    >
      <div className="rpt08-date-control__visual" aria-hidden="true">
        <HistoryOutlined />
        <span>
          {value[0].format("DD/MM/YYYY")} – {value[1].format("DD/MM/YYYY")}
        </span>
        <DownOutlined />
      </div>
      <UiVuexyDateRangePicker
        value={pickerValue}
        disabled={disabled}
        allowClear={false}
        format="DD/MM/YYYY"
        className="rpt08-date-proxy"
        popupClassName="rpt08-date-popup"
        aria-label="Khoảng thời gian"
        onChange={(next) => {
          if (next?.[0] && next?.[1]) onChange([next[0], next[1]]);
        }}
      />
    </div>
  );
}

export function HeaderActions({
  warehouse,
  demo,
  readonly,
  exportState,
  exportDisabled,
  onExport,
}: {
  warehouse: string;
  demo: boolean;
  readonly: boolean;
  exportState: ExportState;
  exportDisabled: boolean;
  onExport: () => void;
}) {
  return (
    <div className="rpt08-header-actions">
      <span className="rpt08-demo-chip" role="note">
        <span aria-hidden="true">ⓘ</span>
        {demo ? "Dữ liệu minh họa" : "Dữ liệu hệ thống"}
      </span>

      <details className="rpt08-warehouse-menu">
        <summary>
          <StockOutlined />
          <span>
            <strong>{warehouse}</strong>
            <small>
              <i /> Đang hoạt động
            </small>
          </span>
          <DownOutlined />
        </summary>
        <div className="rpt08-warehouse-menu__popover" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <StockOutlined />
            <span>
              <strong>{warehouse}</strong>
              <small>Kho đang xem</small>
            </span>
          </button>
        </div>
      </details>

      {readonly ? (
        <span className="rpt08-readonly-pill">Chỉ xem</span>
      ) : (
        <button
          type="button"
          className="rpt08-export-button"
          disabled={exportDisabled}
          aria-busy={exportState === "exporting" || undefined}
          onClick={onExport}
        >
          {exportState === "exporting" ? (
            <span className="rpt08-spinner" aria-hidden="true" />
          ) : (
            <DownloadOutlined />
          )}
          {exportState === "exporting" ? "Đang xuất..." : "Xuất báo cáo"}
        </button>
      )}
    </div>
  );
}

export function InitialLoadingBody() {
  return (
    <div className="rpt08-loading-body" role="status" aria-live="polite">
      <span className="rpt08-sr-only">Đang tải báo cáo</span>

      <section className="rpt08-card rpt08-loading-filter" aria-hidden="true">
        <div className="rpt08-loading-filter__grid">
          {[82, 50, 80, 72].map((width, index) => (
            <div key={index} className="rpt08-loading-field">
              <Skeleton width={`${width}px`} height={11} />
              <div className="rpt08-loading-control">
                <Skeleton width="12px" height={12} />
                <Skeleton width={index === 0 ? "62%" : "48%"} height={12} />
                <Skeleton width="7px" height={7} />
              </div>
            </div>
          ))}
          <Skeleton width="176px" height={45} />
          <Skeleton width="64px" height={12} />
        </div>
        <Skeleton width="255px" height={11} />
      </section>

      <div className="rpt08-summary-grid">
        <section className="rpt08-card rpt08-loading-summary" aria-hidden="true">
          <span className="rpt08-loading-round" />
          <div className="rpt08-loading-summary__body">
            <Skeleton width="180px" height={14} />
            <Skeleton width="70px" height={34} />
            <Skeleton width="64px" height={11} />
          </div>
          <div className="rpt08-loading-summary__wide">
            <Skeleton width="100%" height={31} />
            <div>
              <Skeleton width="120px" height={12} />
              <Skeleton width="118px" height={12} />
            </div>
          </div>
        </section>
        <section className="rpt08-card rpt08-loading-product" aria-hidden="true">
          <span className="rpt08-loading-round" />
          <div>
            <Skeleton width="180px" height={14} />
            <Skeleton width="145px" height={32} />
            <Skeleton width="74%" height={26} />
          </div>
        </section>
      </div>

      <div className="rpt08-analysis-grid">
        <section className="rpt08-card rpt08-loading-chart" aria-hidden="true">
          <div className="rpt08-loading-panel-title">
            <Skeleton width="285px" height={17} />
            <div>
              <Skeleton width="80px" height={11} />
              <Skeleton width="80px" height={11} />
              <Skeleton width="80px" height={11} />
            </div>
          </div>
          <Skeleton width="82px" height={11} />
          <div className="rpt08-loading-bars">
            {[46, 38, 58, 45, 63, 51, 67, 49, 61, 44, 65, 55, 60, 47].map(
              (height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ),
            )}
          </div>
        </section>
        <section className="rpt08-card rpt08-loading-donut" aria-hidden="true">
          <Skeleton width="250px" height={17} />
          <Skeleton width="94px" height={11} />
          <div className="rpt08-loading-donut__body">
            <div>
              <Skeleton width="54px" height={15} />
              <Skeleton width="70px" height={10} />
            </div>
            <span className="rpt08-loading-ring" />
            <div>
              <Skeleton width="54px" height={15} />
              <Skeleton width="70px" height={10} />
            </div>
          </div>
          <div className="rpt08-loading-donut__footer">
            <Skeleton width="38px" height={38} />
            <div>
              <Skeleton width="165px" height={11} />
              <Skeleton width="125px" height={16} />
            </div>
          </div>
        </section>
      </div>

      <section className="rpt08-card rpt08-loading-table" aria-hidden="true">
        <div className="rpt08-loading-table__head">
          <Skeleton width="280px" height={17} />
          <Skeleton width="420px" height={38} />
        </div>
        <div className="rpt08-loading-table__search">
          <Skeleton width="12px" height={12} />
          <Skeleton width="60%" height={12} />
        </div>
        <div className="rpt08-loading-table__columns">
          {["17%", "9%", "15%", "28%", "8%", "14%", "7%"].map((width) => (
            <Skeleton key={width} width={width} height={10} />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div className="rpt08-loading-table__row" key={index}>
            <Skeleton width="15%" height={11} />
            <Skeleton width="8%" height={22} />
            <Skeleton width="13%" height={11} />
            <Skeleton width="27%" height={11} />
            <Skeleton width="5%" height={11} />
            <Skeleton width="13%" height={11} />
            <Skeleton width="5%" height={11} />
          </div>
        ))}
        <div className="rpt08-loading-table__foot">
          <Skeleton width="210px" height={11} />
          <div className="rpt08-loading-pages">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} width="28px" height={28} />
            ))}
          </div>
          <Skeleton width="205px" height={11} />
        </div>
      </section>
    </div>
  );
}

export function FilterCard({
  range,
  type,
  actor,
  actorOptions,
  warehouse,
  invalid,
  busy,
  isDefaultRange,
  onRangeChange,
  onTypeChange,
  onActorChange,
  onApply,
  onReset,
}: {
  range: [Dayjs, Dayjs];
  type: TransactionFilter;
  actor: string;
  actorOptions: ReadonlyArray<{ value: string; label: string }>;
  warehouse: string;
  invalid: boolean;
  busy: boolean;
  isDefaultRange: boolean;
  onRangeChange: (range: [Dayjs, Dayjs]) => void;
  onTypeChange: (type: TransactionFilter) => void;
  onActorChange: (actor: string) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <section className="rpt08-card rpt08-filter-card" aria-label="Bộ lọc báo cáo">
      <div className="rpt08-filter-grid">
        <div className="rpt08-filter-field rpt08-filter-field--date">
          <label>Khoảng thời gian</label>
          <DateRangeControl
            value={range}
            invalid={invalid}
            disabled={busy}
            onChange={onRangeChange}
          />
        </div>

        <div className="rpt08-filter-field">
          <label>Kho</label>
          <SelectControl
            ariaLabel="Kho"
            value="warehouse"
            options={[{ value: "warehouse", label: warehouse }]}
            icon={<span className="rpt08-diamond">◇</span>}
            disabled={busy}
            readonly
            onChange={() => undefined}
          />
        </div>

        <div className="rpt08-filter-field">
          <label>Loại giao dịch</label>
          <SelectControl
            ariaLabel="Loại giao dịch"
            value={type}
            options={[
              { value: "ALL", label: "Tất cả" },
              { value: "INBOUND", label: "Nhập kho" },
              { value: "OUTBOUND", label: "Xuất kho" },
            ]}
            icon={<SwapOutlined />}
            disabled={busy}
            onChange={onTypeChange}
          />
        </div>

        <div className="rpt08-filter-field">
          <label>Người thực hiện</label>
          <SelectControl
            ariaLabel="Người thực hiện"
            value={actor}
            options={actorOptions}
            icon={<UserOutlined />}
            disabled={busy}
            onChange={onActorChange}
          />
        </div>

        <div className="rpt08-filter-actions">
          <button
            type="button"
            className="rpt08-apply-button"
            disabled={busy || invalid}
            onClick={onApply}
          >
            Áp dụng
          </button>
          <button
            type="button"
            className="rpt08-reset-button"
            disabled={busy}
            onClick={onReset}
          >
            Đặt lại
          </button>
        </div>

        <div
          className={"rpt08-filter-helper" + (invalid ? " is-invalid" : "")}
          role={invalid ? "alert" : undefined}
          aria-live={invalid ? "polite" : undefined}
        >
          {invalid
            ? "Ngày bắt đầu không được sau ngày kết thúc."
            : `${isDefaultRange ? "7 ngày gần nhất" : "7 ngày"} · ${VI_TIMEZONE_LABEL}`}
        </div>
      </div>
    </section>
  );
}

export function RefreshStrip() {
  return (
    <div className="rpt08-refresh-strip" role="status" aria-live="polite">
      <span className="rpt08-spinner" aria-hidden="true" />
      <span>Đang cập nhật dữ liệu...</span>
      <i aria-hidden="true" />
    </div>
  );
}

export function StatusBanner({
  tone,
  title,
  message,
  primaryLabel,
  onPrimary,
  onClose,
}: {
  tone: "warning" | "error";
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      className={`rpt08-status-banner is-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <WarningOutlined />
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <div className="rpt08-status-banner__actions">
        {primaryLabel && onPrimary ? (
          <button type="button" onClick={onPrimary}>
            {primaryLabel}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            className="rpt08-banner-close"
            aria-label="Đóng thông báo"
            onClick={onClose}
          >
            {primaryLabel && tone === "error" ? "Đóng" : <CloseOutlined />}
          </button>
        ) : null}
      </div>
    </div>
  );
}


export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rpt08-card rpt08-load-error" role="alert">
      <div className="rpt08-load-error__icon"><WarningOutlined /></div>
      <h2>Không thể tải báo cáo</h2>
      <p>Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.</p>
      <div>
        <button type="button" onClick={onRetry}>Thử lại</button>
        <Link to="/dashboard">Quay lại Tổng quan</Link>
      </div>
    </section>
  );
}
