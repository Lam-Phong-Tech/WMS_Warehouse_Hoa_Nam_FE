import { ReportWarehouseCard } from "@/modules/reports/components/ReportWarehouseCard";
import { SelectControl } from "./SelectControl";
import type { Dayjs } from "dayjs";
import { Link } from "react-router-dom";
import { UiVuexyDateRangePicker } from "@/shared/ui";
import {
  CloseOutlined,
  DownOutlined,
  DownloadOutlined,
  HistoryOutlined,
  SwapOutlined,
  UserOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import type { ExportState, TransactionFilter } from "./model";
import { tStatic as tUi } from "@/shared/i18n/useT";
function Skeleton({
  width = "70%",
  height = 12,
}: {
  width?: string;
  height?: number;
}) {
  return (
    <span
      className="rpt08-skeleton"
      aria-hidden="true"
      style={{ width, height }}
    />
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
        aria-label={tUi("reports.packingLabel.dateRangeLabel")}
        onChange={(next) => {
          if (next?.[0] && next?.[1]) onChange([next[0], next[1]]);
        }}
      />
    </div>
  );
}

export function HeaderActions({
  readonly,
  exportState,
  exportDisabled,
  onExport,
}: {
  warehouse: string;
  readonly: boolean;
  exportState: ExportState;
  exportDisabled: boolean;
  onExport: () => void;
}) {
  return (
    <div className="rpt08-header-actions hn-report-warehouse-actions">
      <span className="rpt08-demo-chip" role="note">
        <span aria-hidden="true">ⓘ</span>
        {tUi("updatedUi.text_098cc1b3c5b9")}
      </span>

      <ReportWarehouseCard />

      {readonly ? (
        <span className="rpt08-readonly-pill">
          {tUi("masterData.common.viewOnly")}
        </span>
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
          {exportState === "exporting"
            ? tUi("updatedUi.text_f218a6c991e2")
            : tUi("reports.traceability.exportReport")}
        </button>
      )}
    </div>
  );
}

export function InitialLoadingBody() {
  return (
    <div className="rpt08-loading-body" role="status" aria-live="polite">
      <span className="rpt08-sr-only">
        {tUi("updatedUi.text_fd676da72cbc")}
      </span>

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
        <section
          className="rpt08-card rpt08-loading-summary"
          aria-hidden="true"
        >
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
        <section
          className="rpt08-card rpt08-loading-product"
          aria-hidden="true"
        >
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
    <section
      className="rpt08-card rpt08-filter-card"
      aria-label={tUi("reports.recipientAgency.filterTitle")}
    >
      <div className="rpt08-filter-grid">
        <div className="rpt08-filter-field rpt08-filter-field--date">
          <label>{tUi("reports.packingLabel.dateRangeLabel")}</label>
          <DateRangeControl
            value={range}
            invalid={invalid}
            disabled={busy}
            onChange={onRangeChange}
          />
        </div>

        <div className="rpt08-filter-field">
          <label>{tUi("updatedUi.text_19c608bfa103")}</label>
          <SelectControl
            ariaLabel={tUi("updatedUi.text_19c608bfa103")}
            value="warehouse"
            options={[{ value: "warehouse", label: warehouse }]}
            icon={<span className="rpt08-diamond">◇</span>}
            disabled={busy}
            readonly
            onChange={() => undefined}
          />
        </div>

        <div className="rpt08-filter-field">
          <label>{tUi("updatedUi.text_94c1cbc6d405")}</label>
          <SelectControl
            ariaLabel={tUi("updatedUi.text_94c1cbc6d405")}
            value={type}
            options={[
              { value: "ALL", label: tUi("dashboard.operations.filterAll") },
              { value: "INBOUND", label: tUi("dashboard.snapshot.inbound") },
              { value: "OUTBOUND", label: tUi("dashboard.snapshot.outbound") },
            ]}
            icon={<SwapOutlined />}
            disabled={busy}
            onChange={onTypeChange}
          />
        </div>

        <div className="rpt08-filter-field">
          <label>{tUi("inventory.trace.colPerformedBy")}</label>
          <SelectControl
            ariaLabel={tUi("inventory.trace.colPerformedBy")}
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
            {tUi("dashboard.snapshot.apply")}
          </button>
          <button
            type="button"
            className="rpt08-reset-button"
            disabled={busy}
            onClick={onReset}
          >
            {tUi("reports.packingLabel.reset")}
          </button>
        </div>

        <div
          className={"rpt08-filter-helper" + (invalid ? " is-invalid" : "")}
          role={invalid ? "alert" : undefined}
          aria-live={invalid ? "polite" : undefined}
        >
          {invalid
            ? tUi("dashboard.dateError.order")
            : `${isDefaultRange ? tUi("dashboard.snapshot.periodLast7") : tUi("updatedUi.text_fc11ccee30a8")} · ${tUi("updatedUi.text_bebd46bc068a")}`}
        </div>
      </div>
    </section>
  );
}

export function RefreshStrip() {
  return (
    <div className="rpt08-refresh-strip" role="status" aria-live="polite">
      <span className="rpt08-spinner" aria-hidden="true" />
      <span>{tUi("updatedUi.text_0c576314af49")}</span>
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
            aria-label={tUi("updatedUi.text_8af6ba927e1f")}
            onClick={onClose}
          >
            {primaryLabel && tone === "error" ? (
              tUi("common.close")
            ) : (
              <CloseOutlined />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rpt08-card rpt08-load-error" role="alert">
      <div className="rpt08-load-error__icon">
        <WarningOutlined />
      </div>
      <h2>{tUi("updatedUi.text_c1e574adfa82")}</h2>
      <p>{tUi("updatedUi.text_1ec35f35e954")}</p>
      <div>
        <button type="button" onClick={onRetry}>
          {tUi("common.retry")}
        </button>
        <Link to="/dashboard">{tUi("dashboard.snapshot.backOverview")}</Link>
      </div>
    </section>
  );
}
