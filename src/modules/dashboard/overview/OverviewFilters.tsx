/**
 * Thẻ bộ lọc của demo: Kỳ KPI (kèm khoảng ngày tùy chọn + lịch tự vẽ), Loại hàng
 * và khối Làm mới. Lịch dựng lại đúng bố cục demo (6 hàng × 7 cột, chặn ngày
 * tương lai, nút "tháng sau" khoá khi đã ở tháng hiện tại).
 */
import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { DashIcon } from "../components/DashIcon";
import type { SkuTypeFilter } from "../types";
import {
  PERIOD_NAMES,
  type DateRange,
  type OverviewPeriod,
} from "./overview-data";

const ISO = "YYYY-MM-DD";
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const PERIOD_ORDER: OverviewPeriod[] = ["today", "last7", "month", "custom"];

const TYPE_ORDER: Array<{ value: SkuTypeFilter; label: string }> = [
  { value: "ALL", label: "Toàn bộ" },
  { value: "PRODUCT", label: "Sản phẩm" },
  { value: "COMPONENT", label: "Linh kiện" },
];

function monthLabel(month: dayjs.Dayjs): string {
  return `Tháng ${month.month() + 1} ${month.year()}`;
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
}: {
  label: string;
  value: string;
  today: string;
  onPick: (value: string) => void;
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
      future: raw > today,
      aria: date.format("D [tháng] M [năm] YYYY"),
    };
  });

  return (
    <div
      className="date-picker-popover"
      role="dialog"
      aria-label={`Lịch chọn ${label.toLowerCase()}`}
    >
      <div className="datepicker-head">
        <strong>{monthLabel(cursor)}</strong>
        <div className="datepicker-nav">
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={() => setCursor(cursor.subtract(1, "month"))}
          >
            <DashIcon name="chevron-left" />
          </button>
          <button
            type="button"
            aria-label="Tháng sau"
            disabled={atCurrentMonth}
            onClick={() => setCursor(cursor.add(1, "month"))}
          >
            <DashIcon name="chevron-right" />
          </button>
        </div>
      </div>
      <div className="datepicker-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
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
  onOpenChange,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!fieldRef.current?.contains(event.target as Node)) onOpenChange(false);
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
          max={today}
          aria-haspopup="dialog"
          aria-expanded={open}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="date-picker-trigger"
          type="button"
          aria-label={`Mở lịch chọn ${label.toLowerCase()}`}
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
        />
      ) : null}
    </div>
  );
}

export function OverviewFilters({
  period,
  onPeriodChange,
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
  const today = dayjs().format(ISO);

  return (
    <section className="filter-card" aria-label="Bộ lọc Dashboard">
      <div className="filter-group">
        <span className="filter-label">Kỳ KPI</span>
        <div className="segmented period-buttons">
          {PERIOD_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              className={value === period ? "active" : undefined}
              aria-pressed={value === period}
              onClick={() => onPeriodChange(value)}
            >
              {PERIOD_NAMES[value]}
            </button>
          ))}
        </div>
      </div>

      {period === "custom" ? (
        <div className="custom-range">
          <div className="custom-range-fields">
            <DatePickerField
              id="dashboard-date-from"
              label="Từ ngày"
              value={custom.from}
              today={today}
              open={openPicker === "from"}
              onOpenChange={(open) => setOpenPicker(open ? "from" : null)}
              onChange={(value) => onCustomChange({ ...custom, from: value })}
            />
            <DatePickerField
              id="dashboard-date-to"
              label="Đến ngày"
              value={custom.to}
              today={today}
              open={openPicker === "to"}
              onOpenChange={(open) => setOpenPicker(open ? "to" : null)}
              onChange={(value) => onCustomChange({ ...custom, to: value })}
            />
          </div>
          <span className="field-error" role="alert">
            {dateError}
          </span>
        </div>
      ) : null}

      <div className="filter-group">
        <span className="filter-label">Loại hàng</span>
        <div className="segmented type-buttons">
          {TYPE_ORDER.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === type ? "active" : undefined}
              aria-pressed={option.value === type}
              onClick={() => onTypeChange(option.value)}
            >
              {option.label}
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
          <DashIcon name="refresh-cw" /> Làm mới
        </button>
        <div className="refresh-meta">
          <span>{lastUpdatedLabel}</span>
          <small>Tự động làm mới sau 60 giây</small>
        </div>
      </div>
    </section>
  );
}
