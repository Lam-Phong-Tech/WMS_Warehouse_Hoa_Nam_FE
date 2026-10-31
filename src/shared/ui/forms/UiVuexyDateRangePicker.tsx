import { Fragment, useMemo, useState } from "react";
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
import { defaultDateBounds } from "@/shared/validation/date-rules";
import type { MessageKey } from "@/shared/i18n/messages";

const WEEKDAY_KEYS: readonly MessageKey[] = [
  "shared.datePicker.weekdaySun",
  "shared.datePicker.weekdayMon",
  "shared.datePicker.weekdayTue",
  "shared.datePicker.weekdayWed",
  "shared.datePicker.weekdayThu",
  "shared.datePicker.weekdayFri",
  "shared.datePicker.weekdaySat",
];

export interface DateRangePreset {
  /** Khoá ổn định để biết preset nào đang được áp dụng. */
  key: string;
  label: string;
  /**
   * Tên nhóm hiện thành tiêu đề nhỏ phía trên preset đầu tiên của nhóm.
   *
   * Có nhóm thì người dùng đọc được LUẬT của từng kỳ chứ không phải nhớ thuộc
   * lòng: nhóm "Gần đây" đếm lùi từ hôm nay, nhóm "Theo lịch" bám mốc lịch.
   * Bỏ trống thì dải preset là một danh sách phẳng như trước.
   */
  group?: string;
  /**
   * Tính khoảng ngày TẠI THỜI ĐIỂM BẤM, không tính sẵn lúc render: "Tháng này"
   * phải đúng theo hôm nay, kể cả khi tab mở qua nửa đêm.
   */
  range: () => [Dayjs, Dayjs];
}

export interface UiVuexyDateRangePickerProps {
  value: [Dayjs | null, Dayjs | null] | null;
  onChange: (value: [Dayjs | null, Dayjs | null] | null) => void;
  placeholder?: [string, string];
  showFieldPrefixes?: boolean;
  format?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  popupClassName?: string;
  "aria-label"?: string;
  /**
   * Kỳ nhanh ("Tuần này", "Tháng này"…) hiện ngay trong panel lịch.
   *
   * Có `presets` thì màn KHÔNG cần thêm ô chọn kỳ riêng bên ngoài nữa. Hai
   * control cùng set một khoảng ngày là nguồn gốc của việc người dùng không
   * hiểu cái nào thắng cái nào: chọn preset thì ô ngày bị ghi đè, sửa ô ngày
   * thì ô preset lặng lẽ nhảy về "Tùy chọn".
   */
  presets?: ReadonlyArray<DateRangePreset>;
  /**
   * Ngày muộn nhất được chọn (bao gồm chính nó). Báo cáo lịch sử không có dữ
   * liệu tương lai nên chặn ngay ở lịch, thay vì để người dùng chọn ra một kỳ
   * chắc chắn rỗng.
   */
  maxDate?: Dayjs;
  /** Ngày sớm nhất được chọn (bao gồm chính nó). */
  minDate?: Dayjs;
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
  placeholder,
  showFieldPrefixes = true,
  format = "DD/MM/YYYY",
  allowClear = true,
  disabled = false,
  className,
  popupClassName,
  "aria-label": ariaLabelProp,
  presets,
  maxDate: maxDateProp,
  minDate: minDateProp,
}: UiVuexyDateRangePickerProps) {
  const t = useT();
  // Không ô ngày nào được "vô hạn": màn không truyền mốc thì áp cửa sổ chung
  // của dự án (date-rules.ts) — chặn cả việc bấm lùi lịch về năm 0001.
  const fallbackBounds = useMemo(() => defaultDateBounds(), []);
  const maxDate = maxDateProp ?? fallbackBounds.maxDate;
  const minDate = minDateProp ?? fallbackBounds.minDate;
  const resolvedPlaceholder = placeholder ?? [
    t("shared.datePicker.fromDate"),
    t("shared.datePicker.toDate"),
  ];
  const ariaLabel = ariaLabelProp ?? t("shared.datePicker.selectRange");
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
  const maxValue = maxDate.startOf("day").valueOf();
  const minValue = minDate.startOf("day").valueOf();
  const canGoPrevMonth = panelMonth.startOf("month").isAfter(minDate, "month");
  const canGoNextMonth = panelMonth.startOf("month").isBefore(maxDate, "month");

  const hasPresets = (presets?.length ?? 0) > 0;

  /**
   * Preset là lối tắt một chạm: áp dụng và đóng luôn. Bắt người dùng bấm thêm
   * "Áp dụng" thì nó chẳng còn là lối tắt nữa.
   */
  const applyPreset = (preset: DateRangePreset) => {
    const [start, end] = preset.range();
    const from = start.startOf("day");
    const to = end.startOf("day");
    setDraftStart(from);
    setDraftEnd(to);
    setPanelMonth(from.startOf("month"));
    setActiveField("start");
    onChange([from, to]);
    closePicker();
  };

  /** Preset nào khớp đúng khoảng đang chọn — không khớp cái nào là khoảng tự đặt. */
  const activePresetKey = useMemo(() => {
    const from = value?.[0]?.startOf("day").valueOf();
    const to = value?.[1]?.startOf("day").valueOf();
    if (!presets || from == null || to == null) return null;
    const match = presets.find((preset) => {
      const [start, end] = preset.range();
      return (
        start.startOf("day").valueOf() === from &&
        end.startOf("day").valueOf() === to
      );
    });
    return match?.key ?? null;
  }, [presets, value]);

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
          aria-label={t("shared.datePicker.fromDate")}
          aria-haspopup="dialog"
          aria-expanded={open && activeField === "start"}
          onClick={(event) => openPicker("start", event)}
          sx={dateFieldButtonSx(
            open && activeField === "start",
            disabled,
            showFieldPrefixes,
          )}
        >
          {showFieldPrefixes ? (
            <Box component="span" sx={dateFieldPrefixSx}>
              {t("shared.datePicker.from")}
            </Box>
          ) : null}
          <Box
            component="span"
            data-date-value="from"
            sx={dateFieldValueSx(Boolean(value?.[0]))}
          >
            {value?.[0]?.format(format) ?? resolvedPlaceholder[0]}
          </Box>
          <CalendarIcon style={{ color: S.textMedium }} />
        </Box>
        <Box
          component="button"
          type="button"
          disabled={disabled}
          className="hn-vuexy-date-field"
          data-date-field="to"
          aria-label={t("shared.datePicker.toDate")}
          aria-haspopup="dialog"
          aria-expanded={open && activeField === "end"}
          onClick={(event) => openPicker("end", event)}
          sx={dateFieldButtonSx(
            open && activeField === "end",
            disabled,
            showFieldPrefixes,
          )}
        >
          {showFieldPrefixes ? (
            <Box component="span" sx={dateFieldPrefixSx}>
              {t("shared.datePicker.to")}
            </Box>
          ) : null}
          <Box
            component="span"
            data-date-value="to"
            sx={dateFieldValueSx(Boolean(value?.[1]))}
          >
            {value?.[1]?.format(format) ?? resolvedPlaceholder[1]}
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
              width: hasPresets ? 500 : 350,
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
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: hasPresets ? "148px minmax(0, 1fr)" : "minmax(0, 1fr)",
            },
          }}
        >
          {hasPresets ? (
            <Box
              role="group"
              aria-label={t("shared.datePicker.presets")}
              sx={presetColumnSx}
            >
              {presets?.map((preset, index) => (
                <Fragment key={preset.key}>
                  {preset.group !== undefined &&
                  preset.group !== presets[index - 1]?.group ? (
                    <Box aria-hidden="true" sx={presetGroupLabelSx}>
                      {preset.group}
                    </Box>
                  ) : null}
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={activePresetKey === preset.key}
                    onClick={() => applyPreset(preset)}
                    sx={presetButtonSx(activePresetKey === preset.key)}
                  >
                    {/* UAT TC_UI_15: kỳ đang chọn phải nổi bật — thêm dấu
                        check (glyph Flaticon, đúng quy ước ui:icons) bên cạnh
                        nền/viền primary, người dùng nhìn lướt vẫn thấy mình
                        đang ở kỳ nào. */}
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{
                        display: "inline-flex",
                        width: 16,
                        alignItems: "center",
                      }}
                    >
                      {activePresetKey === preset.key ? (
                        <Box
                          component="i"
                          className="fi fi-rr-check"
                          sx={{ fontSize: 12, lineHeight: 1 }}
                        />
                      ) : null}
                    </Box>
                    {preset.label}
                  </Box>
                </Fragment>
              ))}
            </Box>
          ) : null}
          <Box sx={{ p: 1.5, minWidth: 0 }}>
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
                data-date-tab="start"
                data-active={activeField === "start"}
                onClick={() => {
                  setActiveField("start");
                  setPanelMonth((draftStart ?? dayjs()).startOf("month"));
                }}
                sx={pickerFieldTabSx(activeField === "start")}
              >
                <Box component="span">{t("shared.datePicker.fromDate")}</Box>
                <Box component="strong">
                  {draftStart?.format(format) ??
                    t("shared.datePicker.notSelected")}
                </Box>
              </Box>
              <Box
                component="button"
                type="button"
                data-date-tab="end"
                data-active={activeField === "end"}
                onClick={() => {
                  setActiveField("end");
                  setPanelMonth(
                    (draftEnd ?? draftStart ?? dayjs()).startOf("month"),
                  );
                }}
                sx={pickerFieldTabSx(activeField === "end")}
              >
                <Box component="span">{t("shared.datePicker.toDate")}</Box>
                <Box component="strong">
                  {draftEnd?.format(format) ??
                    t("shared.datePicker.notSelected")}
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
                aria-label={t("shared.datePicker.prevMonth")}
                disabled={!canGoPrevMonth}
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
                {t("shared.datePicker.monthLabel", {
                  month: panelMonth.format("M YYYY"),
                })}
              </Box>
              <Box
                component="button"
                type="button"
                aria-label={t("shared.datePicker.nextMonth")}
                disabled={!canGoNextMonth}
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
              {WEEKDAY_KEYS.map((weekdayKey) => (
                <Box
                  key={weekdayKey}
                  sx={{
                    height: 30,
                    display: "grid",
                    placeItems: "center",
                    color: S.textMedium,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {t(weekdayKey)}
                </Box>
              ))}
            </Box>

            <Box
              role="grid"
              aria-label={t("shared.datePicker.monthLabel", {
                month: panelMonth.format("M YYYY"),
              })}
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
                  (activeField === "end" &&
                    rangeStartValue != null &&
                    dayValue < rangeStartValue) ||
                  (maxValue != null && dayValue > maxValue) ||
                  (minValue != null && dayValue < minValue);

                return (
                  <Box
                    key={day.format("YYYY-MM-DD")}
                    role="gridcell"
                    data-in-range={inRange || undefined}
                    data-range-edge={
                      selectedStart ? "start" : selectedEnd ? "end" : undefined
                    }
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
                          color: selected ? S.onPrimary : S.infoText,
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
          {/*
           * Khoảng đang chọn + SỐ NGÀY. Nhãn kỳ ("Tháng này (đến nay)") nói
           * luật, con số này nói kết quả — thiếu nó thì người dùng vẫn phải tự
           * trừ hai mốc trong đầu để biết mình đang xem bao nhiêu ngày.
           */}
          <Box sx={{ minWidth: 0, color: S.textMedium, fontSize: 12 }}>
            {draftStart && draftEnd
              ? t("shared.datePicker.rangeSummary", {
                  from: draftStart.format(format),
                  to: draftEnd.format(format),
                  days: draftEnd.diff(draftStart, "day") + 1,
                })
              : t("shared.datePicker.selecting", {
                  field:
                    activeField === "start"
                      ? t("shared.datePicker.fromDateLower")
                      : t("shared.datePicker.toDateLower"),
                })}
          </Box>
          <Box sx={{ display: "flex", flexShrink: 0, gap: 0.75 }}>
            {allowClear ? (
              <Box
                component="button"
                type="button"
                data-date-action="clear"
                onClick={clearRange}
                sx={footerButtonSx}
              >
                {t("shared.actions.clear")}
              </Box>
            ) : null}
            <Box
              component="button"
              type="button"
              data-date-action="cancel"
              onClick={closePicker}
              sx={footerButtonSx}
            >
              {t("shared.actions.cancel")}
            </Box>
            <Box
              component="button"
              type="button"
              data-date-action="apply"
              disabled={!draftStart || !draftEnd}
              onClick={applyRange}
              sx={primaryFooterButtonSx}
            >
              {t("shared.actions.apply")}
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
}

/**
 * Cột kỳ nhanh: dọc bên trái ở màn rộng, xuống thành hàng chip cuộn ngang ở
 * màn hẹp — panel chỉ rộng `100vw - 24px` nên cột dọc sẽ bóp nát phần lịch.
 */
const presetColumnSx = {
  display: "flex",
  flexDirection: { xs: "row", sm: "column" },
  alignContent: "flex-start",
  gap: 0.5,
  p: 1.5,
  overflowX: { xs: "auto", sm: "visible" },
  borderBottom: { xs: `1px solid ${S.border}`, sm: "none" },
  borderRight: { xs: "none", sm: `1px solid ${S.border}` },
  bgcolor: S.bgSubtle,
} as const;

/**
 * Tiêu đề nhóm trong dải kỳ nhanh. Ở khổ hẹp dải xếp NGANG và cuộn, lúc đó
 * tiêu đề nhóm chen giữa các nút chỉ làm rối — ẩn đi, thứ tự nút vẫn giữ
 * nguyên nhóm nên nghĩa không mất.
 *
 * UAT TC_UI_15: từ nhóm thứ hai trở đi có đường phân cách nhẹ phía trên để
 * người dùng thấy ngay ranh giới GẦN ĐÂY / THEO KỲ.
 */
const presetGroupLabelSx = {
  display: { xs: "none", sm: "block" },
  mt: 0.75,
  "&:not(:first-of-type)": {
    mt: 1.25,
    pt: 1.25,
    borderTop: `1px solid ${S.border}`,
  },
  px: 1.25,
  color: S.textMedium,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  "&:first-of-type": { mt: 0 },
} as const;

const presetButtonSx = (active: boolean) => ({
  flex: "none",
  minHeight: 34,
  px: 1.25,
  border: `1px solid ${active ? S.primary : "transparent"}`,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: active ? S.primarySoft : "transparent",
  color: active ? S.infoText : S.textHigh,
  font: "inherit",
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  textAlign: "left",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: `background ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
  "&:hover": { bgcolor: S.primarySoft, color: S.infoText },
  "&:focus-visible": { outline: `2px solid ${S.primary}`, outlineOffset: 1 },
});

const dateFieldButtonSx = (
  active: boolean,
  disabled: boolean,
  showFieldPrefixes: boolean,
) => ({
  width: "100%",
  minWidth: 0,
  height: CONTROL.height,
  px: 1.25,
  display: "grid",
  gridTemplateColumns: showFieldPrefixes
    ? "auto minmax(0, 1fr) auto"
    : "minmax(0, 1fr) auto",
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
  color: active ? S.infoText : S.textMedium,
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
  "&:hover": { bgcolor: S.primarySoft, color: S.infoText },
  "&:focus-visible": { outline: `2px solid ${S.primary}`, outlineOffset: 1 },
  "&:disabled": { opacity: 0.35, cursor: "not-allowed" },
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
  "&:hover": { bgcolor: S.infoText },
  "&:disabled": {
    bgcolor: S.grey200,
    color: S.textDisabled,
    cursor: "not-allowed",
  },
} as const;
