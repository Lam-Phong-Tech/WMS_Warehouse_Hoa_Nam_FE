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

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export interface UiVuexyDateRangePickerProps {
  value: [Dayjs | null, Dayjs | null] | null;
  onChange: (value: [Dayjs | null, Dayjs | null] | null) => void;
  placeholder?: [string, string];
  format?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  popupClassName?: string;
  "aria-label"?: string;
}

function isSameDay(left: Dayjs | null, right: Dayjs) {
  return left?.startOf("day").valueOf() === right.startOf("day").valueOf();
}

function buildCalendarDays(month: Dayjs) {
  const firstCell = month.startOf("month").startOf("week");
  return Array.from({ length: 42 }, (_, index) => firstCell.add(index, "day"));
}

/**
 * Date range picker theo ngôn ngữ Vuexy, dùng MUI Popover để neo đúng trong
 * dashboard có vùng cuộn riêng. Contract dayjs giữ nguyên để thay thế trực tiếp
 * RangePicker cũ mà không tác động query/API của report.
 */
export function UiVuexyDateRangePicker({
  value,
  onChange,
  placeholder = ["Từ ngày", "Đến ngày"],
  format = "DD/MM/YYYY",
  allowClear = true,
  disabled = false,
  className,
  popupClassName,
  "aria-label": ariaLabel = "Chọn khoảng ngày",
}: UiVuexyDateRangePickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeField, setActiveField] = useState<"start" | "end">("start");
  const [panelMonth, setPanelMonth] = useState(() =>
    (value?.[0] ?? dayjs()).startOf("month"),
  );
  const [draftStart, setDraftStart] = useState<Dayjs | null>(
    value?.[0] ?? null,
  );
  const [draftEnd, setDraftEnd] = useState<Dayjs | null>(value?.[1] ?? null);

  const open = Boolean(anchorEl);
  const days = useMemo(() => buildCalendarDays(panelMonth), [panelMonth]);

  const openPicker = (
    field: "start" | "end",
    event: MouseEvent<HTMLElement>,
  ) => {
    if (disabled) return;
    setDraftStart(value?.[0] ?? null);
    setDraftEnd(value?.[1] ?? null);
    setActiveField(field);
    setPanelMonth(
      ((field === "end" ? value?.[1] : value?.[0]) ?? dayjs()).startOf("month"),
    );
    setAnchorEl(event.currentTarget);
  };

  const closePicker = () => setAnchorEl(null);

  const selectDay = (day: Dayjs) => {
    const selected = day.startOf("day");

    if (activeField === "start") {
      setDraftStart(selected);
      if (draftEnd && selected.valueOf() > draftEnd.startOf("day").valueOf()) {
        setDraftEnd(null);
      }
      setActiveField("end");
      return;
    }

    if (!draftStart) {
      setDraftStart(selected);
      setActiveField("end");
      return;
    }

    if (selected.valueOf() < draftStart.startOf("day").valueOf()) return;
    setDraftEnd(selected);
  };

  const applyRange = () => {
    if (!draftStart || !draftEnd) return;
    onChange([draftStart.startOf("day"), draftEnd.startOf("day")]);
    closePicker();
  };

  const clearRange = () => {
    setDraftStart(null);
    setDraftEnd(null);
    onChange(null);
    closePicker();
  };

  const rangeStartValue = draftStart?.startOf("day").valueOf() ?? null;
  const rangeEndValue = draftEnd?.startOf("day").valueOf() ?? null;

  return (
    <>
      <Box
        role="group"
        className={className}
        aria-label={ariaLabel}
        sx={{
          width: "100%",
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
          gap: 1,
        }}
      >
        <Box
          component="button"
          type="button"
          disabled={disabled}
          className="hn-vuexy-date-field"
          data-date-field="from"
          aria-label="Từ ngày"
          aria-haspopup="dialog"
          aria-expanded={open && activeField === "start"}
          onClick={(event) => openPicker("start", event)}
          sx={dateFieldButtonSx(open && activeField === "start", disabled)}
        >
          <Box component="span" sx={dateFieldPrefixSx}>
            Từ
          </Box>
          <Box
            component="span"
            data-date-value="from"
            sx={dateFieldValueSx(Boolean(value?.[0]))}
          >
            {value?.[0]?.format(format) ?? placeholder[0]}
          </Box>
          <CalendarIcon style={{ color: S.textMedium }} />
        </Box>
        <Box
          component="button"
          type="button"
          disabled={disabled}
          className="hn-vuexy-date-field"
          data-date-field="to"
          aria-label="Đến ngày"
          aria-haspopup="dialog"
          aria-expanded={open && activeField === "end"}
          onClick={(event) => openPicker("end", event)}
          sx={dateFieldButtonSx(open && activeField === "end", disabled)}
        >
          <Box component="span" sx={dateFieldPrefixSx}>
            Đến
          </Box>
          <Box
            component="span"
            data-date-value="to"
            sx={dateFieldValueSx(Boolean(value?.[1]))}
          >
            {value?.[1]?.format(format) ?? placeholder[1]}
          </Box>
          <CalendarIcon style={{ color: S.textMedium }} />
        </Box>
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
            className: popupClassName,
            role: "dialog",
            "aria-label": ariaLabel,
            sx: {
              width: 350,
              maxWidth: "calc(100vw - 24px)",
              mt: 0.75,
              overflow: "hidden",
              border: `1px solid ${S.border}`,
              borderRadius: `${RADIUS.control}px`,
              bgcolor: S.bgSurface,
              boxShadow: S.shadowFloating,
            },
          },
        }}
      >
        <Box sx={{ p: 1.5 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 1,
              mb: 1.25,
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => {
                setActiveField("start");
                setPanelMonth((draftStart ?? dayjs()).startOf("month"));
              }}
              sx={pickerFieldTabSx(activeField === "start")}
            >
              <Box component="span">Từ ngày</Box>
              <Box component="strong">
                {draftStart?.format(format) ?? "Chưa chọn"}
              </Box>
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => {
                setActiveField("end");
                setPanelMonth(
                  (draftEnd ?? draftStart ?? dayjs()).startOf("month"),
                );
              }}
              sx={pickerFieldTabSx(activeField === "end")}
            >
              <Box component="span">Đến ngày</Box>
              <Box component="strong">
                {draftEnd?.format(format) ?? "Chưa chọn"}
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              minHeight: 40,
              display: "grid",
              gridTemplateColumns: "36px 1fr 36px",
              alignItems: "center",
              mb: 0.75,
            }}
          >
            <Box
              component="button"
              type="button"
              aria-label="Tháng trước"
              onClick={() =>
                setPanelMonth((month) => month.subtract(1, "month"))
              }
              sx={calendarNavButtonSx}
            >
              <PrevIcon />
            </Box>
            <Box
              sx={{
                color: S.textHigh,
                fontSize: 15,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              Tháng {panelMonth.format("M YYYY")}
            </Box>
            <Box
              component="button"
              type="button"
              aria-label="Tháng sau"
              onClick={() => setPanelMonth((month) => month.add(1, "month"))}
              sx={calendarNavButtonSx}
            >
              <NextIcon />
            </Box>
          </Box>

          <Box
            aria-hidden="true"
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              mb: 0.25,
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
                  fontWeight: 500,
                }}
              >
                {weekday}
              </Box>
            ))}
          </Box>

          <Box
            role="grid"
            aria-label={`Tháng ${panelMonth.format("M YYYY")}`}
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            }}
          >
            {days.map((day) => {
              const dayValue = day.startOf("day").valueOf();
              const selectedStart = isSameDay(draftStart, day);
              const selectedEnd = isSameDay(draftEnd, day);
              const selected = selectedStart || selectedEnd;
              const inRange =
                rangeStartValue != null &&
                rangeEndValue != null &&
                dayValue >= rangeStartValue &&
                dayValue <= rangeEndValue;
              const outsideMonth = day.month() !== panelMonth.month();
              const disabledDay =
                activeField === "end" &&
                rangeStartValue != null &&
                dayValue < rangeStartValue;

              return (
                <Box
                  key={day.format("YYYY-MM-DD")}
                  role="gridcell"
                  sx={{
                    py: 0.25,
                    bgcolor: inRange ? S.primarySoft : "transparent",
                    borderRadius: selectedStart
                      ? `${RADIUS.pill}px 0 0 ${RADIUS.pill}px`
                      : selectedEnd
                        ? `0 ${RADIUS.pill}px ${RADIUS.pill}px 0`
                        : 0,
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    aria-label={day.format("DD/MM/YYYY")}
                    aria-selected={selected}
                    aria-disabled={disabledDay}
                    disabled={disabledDay}
                    onClick={() => selectDay(day)}
                    sx={{
                      width: 34,
                      height: 34,
                      mx: "auto",
                      display: "grid",
                      placeItems: "center",
                      border: 0,
                      borderRadius: RADIUS.pill,
                      bgcolor: selected ? S.primary : "transparent",
                      color: selected
                        ? S.onPrimary
                        : outsideMonth
                          ? S.textDisabled
                          : S.textHigh,
                      font: "inherit",
                      fontSize: 13,
                      cursor: disabledDay ? "not-allowed" : "pointer",
                      opacity: disabledDay ? 0.34 : 1,
                      transition: `background ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
                      "&:hover": {
                        bgcolor: selected ? S.primaryDark : S.primarySoft,
                        color: selected ? S.onPrimary : S.primaryDark,
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
        </Box>

        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            borderTop: `1px solid ${S.border}`,
            bgcolor: S.bgSubtle,
          }}
        >
          <Box sx={{ minWidth: 0, color: S.textMedium, fontSize: 12 }}>
            Đang chọn {activeField === "start" ? "từ ngày" : "đến ngày"}
          </Box>
          <Box sx={{ display: "flex", flexShrink: 0, gap: 0.75 }}>
            {allowClear ? (
              <Box
                component="button"
                type="button"
                onClick={clearRange}
                sx={footerButtonSx}
              >
                Xóa
              </Box>
            ) : null}
            <Box
              component="button"
              type="button"
              onClick={closePicker}
              sx={footerButtonSx}
            >
              Hủy
            </Box>
            <Box
              component="button"
              type="button"
              disabled={!draftStart || !draftEnd}
              onClick={applyRange}
              sx={primaryFooterButtonSx}
            >
              Áp dụng
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
}

const dateFieldButtonSx = (active: boolean, disabled: boolean) => ({
  width: "100%",
  minWidth: 0,
  height: CONTROL.height,
  px: 1.25,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 0.75,
  border: `1px solid ${active ? S.primary : S.borderInput}`,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: S.bgSurface,
  boxShadow: active ? S.focusRing : "none",
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
});

const dateFieldPrefixSx = {
  color: S.textMedium,
  fontSize: 12,
  fontWeight: 600,
} as const;

const dateFieldValueSx = (hasValue: boolean) => ({
  overflow: "hidden",
  color: hasValue ? S.textHigh : S.textDisabled,
  fontSize: 14,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const pickerFieldTabSx = (active: boolean) => ({
  minWidth: 0,
  minHeight: 48,
  px: 1.25,
  display: "grid",
  alignContent: "center",
  gap: 0.25,
  border: `1px solid ${active ? S.primary : S.border}`,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: active ? S.primarySoft : S.bgSurface,
  color: active ? S.primaryDark : S.textMedium,
  font: "inherit",
  fontSize: 11,
  textAlign: "left",
  cursor: "pointer",
  "& strong": { color: S.textHigh, fontSize: 13, fontWeight: 600 },
  "&:hover": { borderColor: S.primary },
  "&:focus-visible": { outline: `2px solid ${S.primary}`, outlineOffset: 1 },
});

const calendarNavButtonSx = {
  width: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  border: 0,
  borderRadius: RADIUS.pill,
  bgcolor: S.bgSubtle,
  color: S.textHigh,
  cursor: "pointer",
  "&:hover": { bgcolor: S.primarySoft, color: S.primaryDark },
  "&:focus-visible": { outline: `2px solid ${S.primary}`, outlineOffset: 1 },
} as const;

const footerButtonSx = {
  height: 32,
  px: 1,
  border: 0,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: "transparent",
  color: S.primary,
  font: "inherit",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  "&:hover": { bgcolor: S.primarySoft },
} as const;

const primaryFooterButtonSx = {
  ...footerButtonSx,
  px: 1.25,
  bgcolor: S.primary,
  color: S.onPrimary,
  "&:hover": { bgcolor: S.primaryDark },
  "&:disabled": {
    bgcolor: S.grey200,
    color: S.textDisabled,
    cursor: "not-allowed",
  },
} as const;
