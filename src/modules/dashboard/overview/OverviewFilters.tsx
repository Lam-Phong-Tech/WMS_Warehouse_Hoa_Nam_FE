/**
 * Thẻ bộ lọc của demo: Kỳ KPI (kèm khoảng ngày tùy chọn + lịch tự vẽ), Loại hàng
 * và khối Làm mới. Lịch dựng lại đúng bố cục demo (6 hàng × 7 cột, chặn ngày
 * tương lai, nút "tháng sau" khoá khi đã ở tháng hiện tại).
 */
import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { DashIcon } from "../components/DashIcon";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import type { SkuTypeFilter } from "../types";
import {
  DATE_LIMITS,
  dateInputBounds,
  pastDateBounds,
} from "@/shared/validation/date-rules";
import {
  PERIOD_NAME_KEYS,
  activeLocale,
  type DateRange,
  type OverviewPeriod,
} from "./overview-data";

const ISO = "YYYY-MM-DD";
/** Mốc sớm nhất của ô ngày — cùng cửa sổ với các bộ chọn ngày dùng chung. */
const MIN_DATE = dateInputBounds(pastDateBounds()).min;

const WEEKDAY_KEYS: MessageKey[] = [
  "dashboard.weekday.sun",
  "dashboard.weekday.mon",
  "dashboard.weekday.tue",
  "dashboard.weekday.wed",
  "dashboard.weekday.thu",
  "dashboard.weekday.fri",
  "dashboard.weekday.sat",
];

const PERIOD_ORDER: OverviewPeriod[] = ["today", "last7", "month", "custom"];

const TYPE_ORDER: Array<{ value: SkuTypeFilter; labelKey: MessageKey }> = [
  { value: "ALL", labelKey: "dashboard.skuType.all" },
  { value: "PRODUCT", labelKey: "dashboard.skuType.product" },
  { value: "COMPONENT", labelKey: "dashboard.skuType.component" },
];

/**
 * Tên tháng bản địa cho lịch: "Tháng 9" ở vi-VN, "September" ở en-US.
 *
 * Viết hoa chữ đầu vì Intl trả về dạng thường ở tiếng Việt, mà chuỗi này đứng
 * đầu tiêu đề lịch. Nhờ dùng chung một chỗ trống {monthName} cho cả hai ngôn
 * ngữ, guard parity placeholder vẫn so được VI với EN.
 */
function monthName(month: dayjs.Dayjs): string {
  const name = new Intl.DateTimeFormat(activeLocale(), {
    month: "long",
  }).format(month.toDate());
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function monthLabel(month: dayjs.Dayjs, t: TranslateFn): string {
  return t("dashboard.filters.monthLabel", {
    monthName: monthName(month),
    year: month.year(),
  });
}

/**
 * Lịch của demo. Mount MỚI mỗi lần mở nên con trỏ tháng khởi tạo thẳng từ giá
 * trị đang chọn — không cần effect đồng bộ state (tránh cascading render).
 */
function CalendarPopover({
  label,
  value,
  today,
  onPick,
  t,
}: {
  label: string;
  value: string;
  today: string;
  onPick: (value: string) => void;
  t: TranslateFn;
}) {
  const [cursor, setCursor] = useState(() =>
    dayjs(value || today).startOf("month"),
  );
  const todayDate = dayjs(today);
  const firstWeekday = cursor.day();
  const daysInMonth = cursor.daysInMonth();
  const atCurrentMonth =
    cursor.year() > todayDate.year() ||
    (cursor.year() === todayDate.year() && cursor.month() >= todayDate.month());
  // Khoá lùi tháng ở 01/2000 như các bộ chọn ngày dùng chung — hệ thống không
  // có dữ liệu trước mốc đó.
  const atMinMonth =
    cursor.year() < DATE_LIMITS.businessMinYear ||
    (cursor.year() === DATE_LIMITS.businessMinYear && cursor.month() === 0);

  const cells = Array.from({ length: 42 }, (_, index) => {
    const dayOffset = index - firstWeekday + 1;
    const date = cursor.add(dayOffset - 1, "day");
    const outside = dayOffset < 1 || dayOffset > daysInMonth;
    const raw = date.format(ISO);
    return {
      raw,
      day: date.date(),
      outside,
      selected: raw === value,
      isToday: raw === today,
      future: raw > today || raw < MIN_DATE,
      aria: t("dashboard.filters.dayLabel", {
        day: date.date(),
        monthName: monthName(date),
        year: date.year(),
      }),
    };
  });

  return (
    <div
      className="date-picker-popover"
      role="dialog"
      aria-label={t("dashboard.filters.calendarDialog", {
        field: label.toLowerCase(),
      })}
    >
      <div className="datepicker-head">
        <strong>{monthLabel(cursor, t)}</strong>
        <div className="datepicker-nav">
          <button
            type="button"
            aria-label={t("dashboard.filters.prevMonth")}
            disabled={atMinMonth}
            onClick={() => setCursor(cursor.subtract(1, "month"))}
          >
            <DashIcon name="chevron-left" />
          </button>
          <button
            type="button"
            aria-label={t("dashboard.filters.nextMonth")}
            disabled={atCurrentMonth}
            onClick={() => setCursor(cursor.add(1, "month"))}
          >
            <DashIcon name="chevron-right" />
          </button>
        </div>
      </div>
      <div className="datepicker-weekdays" aria-hidden="true">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key}>{t(key)}</span>
        ))}
      </div>
      <div className="datepicker-grid" role="grid">
        {cells.map((cell, index) => (
          <button
            key={`${cell.raw}-${index}`}
            type="button"
            role="gridcell"
            className={[
              "datepicker-day",
              cell.outside ? "is-outside" : "",
              cell.selected ? "is-selected" : "",
              cell.isToday ? "is-today" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={cell.aria}
            aria-current={cell.selected ? "date" : undefined}
            disabled={cell.outside || cell.future}
            onClick={() => onPick(cell.raw)}
          >
            {cell.day}
          </button>
        ))}
      </div>
    </div>
  );
}

function DatePickerField({
  id,
  label,
  value,
  today,
  open,
  invalid,
  onOpenChange,
  onChange,
  t,
}: {
  id: string;
  label: string;
  value: string;
  today: string;
  open: boolean;
  invalid: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  t: TranslateFn;
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!fieldRef.current?.contains(event.target as Node))
        onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className="date-picker-field" ref={fieldRef}>
      <label htmlFor={id}>{label}</label>
      <div className="date-picker-control">
        <input
          id={id}
          type="date"
          value={value}
          min={MIN_DATE}
          max={today}
          aria-invalid={invalid}
          aria-haspopup="dialog"
          aria-expanded={open}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="date-picker-trigger"
          type="button"
          aria-label={t("dashboard.filters.openCalendar", {
            field: label.toLowerCase(),
          })}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          <DashIcon name="calendar-days" />
        </button>
      </div>
      {open ? (
        <CalendarPopover
          label={label}
          value={value}
          today={today}
          onPick={(picked) => {
            onChange(picked);
            onOpenChange(false);
          }}
          t={t}
        />
      ) : null}
    </div>
  );
}

export function OverviewFilters({
  period,
  onPeriodChange,
  rangeLabel,
  custom,
  onCustomChange,
  dateError,
  type,
  onTypeChange,
  lastUpdatedLabel,
  refreshing,
  onRefresh,
}: {
  period: OverviewPeriod;
  onPeriodChange: (period: OverviewPeriod) => void;
  /**
   * Khoảng ngày THẬT của kỳ đang chọn, kèm số ngày.
   *
   * Nút kỳ chỉ nói LUẬT ("Tháng này"), không nói kết quả — mùng 4 bấm "Tháng
   * này" chỉ ra 4 ngày dữ liệu mà nhìn nhãn thì tưởng cả tháng. Dòng này nói
   * thẳng kết quả nên không còn chỗ để hiểu nhầm, và nhãn nút vẫn ngắn (nút
   * `white-space: nowrap`, nhồi chữ vào là vỡ dải segmented ở khổ hẹp).
   */
  rangeLabel: string;
  custom: DateRange;
  onCustomChange: (range: DateRange) => void;
  dateError: string;
  type: SkuTypeFilter;
  onTypeChange: (type: SkuTypeFilter) => void;
  lastUpdatedLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [openPicker, setOpenPicker] = useState<"from" | "to" | null>(null);
  const t = useT();
  const today = dayjs().format(ISO);

  return (
    <section className="filter-card" aria-label={t("dashboard.filters.region")}>
      <div className="filter-group">
        <span className="filter-label">
          {t("dashboard.filters.periodLabel")}
        </span>
        <div className="segmented period-buttons">
          {PERIOD_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              className={value === period ? "active" : undefined}
              aria-pressed={value === period}
              onClick={() => onPeriodChange(value)}
            >
              {t(PERIOD_NAME_KEYS[value])}
            </button>
          ))}
        </div>
        <span className="filter-range-note">{rangeLabel}</span>
      </div>

      {period === "custom" ? (
        <div className="custom-range">
          <div className="custom-range-fields">
            <DatePickerField
              id="dashboard-date-from"
              label={t("dashboard.filters.from")}
              value={custom.from}
              today={today}
              invalid={Boolean(dateError)}
              open={openPicker === "from"}
              onOpenChange={(open) => setOpenPicker(open ? "from" : null)}
              onChange={(value) => onCustomChange({ ...custom, from: value })}
              t={t}
            />
            <DatePickerField
              id="dashboard-date-to"
              label={t("dashboard.filters.to")}
              value={custom.to}
              today={today}
              invalid={Boolean(dateError)}
              open={openPicker === "to"}
              onOpenChange={(open) => setOpenPicker(open ? "to" : null)}
              onChange={(value) => onCustomChange({ ...custom, to: value })}
              t={t}
            />
          </div>
          <span className="field-error" role="alert">
            {dateError}
          </span>
        </div>
      ) : null}

      <div className="filter-group">
        <span className="filter-label">{t("dashboard.filters.typeLabel")}</span>
        <div className="segmented type-buttons">
          {TYPE_ORDER.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === type ? "active" : undefined}
              aria-pressed={option.value === type}
              onClick={() => onTypeChange(option.value)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="refresh-block">
        <button
          className="button button-primary"
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <DashIcon name="refresh-cw" /> {t("dashboard.filters.refresh")}
        </button>
        <div className="refresh-meta">
          <span>{lastUpdatedLabel}</span>
          <small>{t("dashboard.filters.autoRefresh")}</small>
        </div>
      </div>
    </section>
  );
}
