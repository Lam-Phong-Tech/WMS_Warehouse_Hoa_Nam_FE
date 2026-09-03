import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import { CalendarIcon, NextIcon, PrevIcon } from "@/shared/ui/icons";
import {
  CONTROL,
  MOTION,
  RADIUS,
  SEMANTIC_LIGHT as S,
} from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";

/**
 * Base DatePicker MỘT ngày theo ngôn ngữ Vuexy — biến thể một-ô của
 * `UiVuexyDateRangePicker` (cùng ô cao 38/radius 6/viền token, cùng Popover neo
 * bằng MUI để chạy đúng trong vùng cuộn của shell).
 *
 * Vì sao cần bản riêng thay vì dùng range picker: màn báo cáo 8.4 đặt "Từ ngày"
 * và "Đến ngày" thành HAI ô độc lập nằm ở hai cột lưới khác nhau, mỗi ô có nhãn
 * riêng phía trên — range picker gộp hai ô trong một control nên không xếp được
 * vào lưới đó.
 *
 * Nhãn tháng/thứ giữ nguyên tiếng Anh theo bản demo đã duyệt (Base DatePicker
 * mặc định), không tự ý Việt hoá.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface UiVuexyDateFieldProps {
  value: Dayjs | null;
  onChange: (value: Dayjs | null) => void;
  /** Nhãn trợ năng của ô (nhãn nhìn thấy do màn hình tự đặt phía trên ô). */
  "aria-label": string;
  /** Chuỗi hiện khi chưa chọn ngày. */
  placeholder?: string;
  format?: string;
  disabled?: boolean;
  /** Giá trị `data-date-field` + `data-date-value` để E2E bắt đúng ô. */
  field?: string;
  id?: string;
  /** Chặn chọn ngày trước mốc này (dùng cho ô "Đến ngày"). */
  minDate?: Dayjs | null;
  /** Chặn chọn ngày sau mốc này (dùng cho ô "Từ ngày"). */
  maxDate?: Dayjs | null;
}

function buildCalendarDays(month: Dayjs) {
  const firstCell = month.startOf("month").startOf("week");
  return Array.from({ length: 42 }, (_, index) => firstCell.add(index, "day"));
}

export function UiVuexyDateField({
  value,
  onChange,
  "aria-label": ariaLabel,
  placeholder,
  format = "DD/MM/YYYY",
  disabled = false,
  field,
  id,
  minDate = null,
  maxDate = null,
}: UiVuexyDateFieldProps) {
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t("shared.datePicker.selectDate");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [panelMonth, setPanelMonth] = useState(() =>
    (value ?? dayjs()).startOf("month"),
  );

  const open = Boolean(anchorEl);
  const days = useMemo(() => buildCalendarDays(panelMonth), [panelMonth]);
  const selectedValue = value?.startOf("day").valueOf() ?? null;
  const todayValue = dayjs().startOf("day").valueOf();
  const minValue = minDate?.startOf("day").valueOf() ?? null;
  const maxValue = maxDate?.startOf("day").valueOf() ?? null;

  const openPicker = (event: MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setPanelMonth((value ?? dayjs()).startOf("month"));
    setAnchorEl(event.currentTarget);
  };

  const closePicker = () => setAnchorEl(null);

  return (
    <>
      <Box
        component="button"
        type="button"
        id={id}
        disabled={disabled}
        className="hn-vuexy-date-field"
        data-date-field={field}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
        sx={{
          width: "100%",
          minWidth: 0,
          height: CONTROL.height,
          px: 1.25,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 1,
          border: `1px solid ${open ? S.primary : S.borderInput}`,
          borderRadius: `${RADIUS.control}px`,
          bgcolor: S.bgSurface,
          boxShadow: open ? S.focusRing : "none",
          color: S.textHigh,
          font: "inherit",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.56 : 1,
          transition: `border-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}, box-shadow ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
          "&:hover": { borderColor: disabled ? S.borderInput : S.primary },
          "&:focus-visible": {
            outline: "none",
            borderColor: S.primary,
            boxShadow: S.focusRing,
          },
        }}
      >
        <Box
          component="span"
          data-date-value={field}
          sx={{
            overflow: "hidden",
            color: value ? S.textHigh : S.textDisabled,
            fontSize: 14,
            fontWeight: 400,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value ? value.format(format) : resolvedPlaceholder}
        </Box>
        <CalendarIcon style={{ color: S.textMedium }} />
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={closePicker}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        marginThreshold={12}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-label": ariaLabel,
            sx: {
              width: 272,
              maxWidth: "calc(100vw - 24px)",
              mt: 0.75,
              p: 1.5,
              overflow: "hidden",
              border: `1px solid ${S.border}`,
              borderRadius: `${RADIUS.control}px`,
              bgcolor: S.bgSurface,
              boxShadow: S.shadowFloating,
            },
          },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 34px 34px",
            alignItems: "center",
            gap: 0.25,
          }}
        >
          <Box
            sx={{
              pl: 1,
              color: S.textHigh,
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {`${MONTH_NAMES[panelMonth.month()]} ${panelMonth.format("YYYY")}`}
          </Box>
          <Box
            component="button"
            type="button"
            aria-label="Previous month"
            onClick={() => setPanelMonth((m) => m.subtract(1, "month"))}
            sx={calendarNavButtonSx}
          >
            <PrevIcon />
          </Box>
          <Box
            component="button"
            type="button"
            aria-label="Next month"
            onClick={() => setPanelMonth((m) => m.add(1, "month"))}
            sx={calendarNavButtonSx}
          >
            <NextIcon />
          </Box>
        </Box>

        <Box
          aria-hidden="true"
          sx={{
            mt: 1,
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          }}
        >
          {WEEKDAYS.map((weekday) => (
            <Box
              key={weekday}
              sx={{
                height: 30,
                display: "grid",
                placeItems: "center",
                color: S.textMedium,
                fontSize: 12,
              }}
            >
              {weekday}
            </Box>
          ))}
        </Box>

        <Box
          role="grid"
          aria-label={`${MONTH_NAMES[panelMonth.month()]} ${panelMonth.format("YYYY")}`}
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          }}
        >
          {days.map((day) => {
            const dayValue = day.startOf("day").valueOf();
            const selected = dayValue === selectedValue;
            const isToday = dayValue === todayValue;
            const outsideMonth = day.month() !== panelMonth.month();
            const disabledDay =
              (minValue != null && dayValue < minValue) ||
              (maxValue != null && dayValue > maxValue);

            return (
              <Box
                key={day.format("YYYY-MM-DD")}
                role="gridcell"
                sx={{ minHeight: 38, display: "grid", placeItems: "center" }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-label={day.format(format)}
                  aria-selected={selected}
                  aria-disabled={disabledDay}
                  disabled={disabledDay}
                  onClick={() => {
                    onChange(day.startOf("day"));
                    closePicker();
                  }}
                  sx={{
                    width: 32,
                    height: 32,
                    display: "grid",
                    placeItems: "center",
                    border: 0,
                    borderRadius: RADIUS.pill,
                    bgcolor:
                      selected || isToday ? S.primarySoft : "transparent",
                    color:
                      selected || isToday
                        ? S.primaryDark
                        : outsideMonth
                          ? S.textDisabled
                          : S.textHigh,
                    font: "inherit",
                    fontSize: 13,
                    fontWeight: selected || isToday ? 600 : 400,
                    cursor: disabledDay ? "not-allowed" : "pointer",
                    opacity: disabledDay ? 0.35 : 1,
                    transition: `background ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
                    "&:hover": {
                      bgcolor: S.primarySoft,
                      color: S.primaryDark,
                    },
                    "&:focus-visible": {
                      outline: `2px solid ${S.primary}`,
                      outlineOffset: 1,
                    },
                  }}
                >
                  {day.date()}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}

const calendarNavButtonSx = {
  width: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  border: 0,
  borderRadius: RADIUS.pill,
  bgcolor: S.bgSubtle,
  color: S.textHigh,
  font: "inherit",
  fontSize: 16,
  cursor: "pointer",
  transition: `background ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
  "&:hover": { bgcolor: S.primarySoft, color: S.primaryDark },
  "&:focus-visible": { outline: `2px solid ${S.primary}`, outlineOffset: 1 },
} as const;
