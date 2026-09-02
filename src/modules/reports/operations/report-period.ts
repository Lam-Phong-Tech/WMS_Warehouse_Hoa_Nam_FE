import { useMemo, useState } from "react";
import type { Dayjs } from "dayjs";
import { API_DATE, presetRange, type PeriodPreset } from "./report-format";

export type PeriodFilterState = {
  preset: PeriodPreset;
  setPreset: (next: PeriodPreset) => void;
  range: [Dayjs, Dayjs];
  setRange: (next: [Dayjs, Dayjs]) => void;
  from: string;
  to: string;
  /** true = từ ngày > đến ngày; mọi truy vấn phải tạm dừng. */
  invalid: boolean;
  label: string;
};

/**
 * Bộ lọc thời gian "Tuần này | Tháng này | Tùy chọn" dùng cho cả 7 tab.
 *
 * Chọn preset thì khoảng ngày được TÍNH LẠI ngay và picker hiện đúng khoảng đó
 * (thay vì để picker giữ giá trị cũ mâu thuẫn với nút đang sáng) — người dùng
 * luôn đọc được chính xác kỳ đang xem, kể cả khi vừa bấm preset. Ngược lại,
 * tự chọn ngày trên picker sẽ đẩy preset về "Tùy chọn".
 */
export function usePeriodFilter(
  defaultPreset: PeriodPreset = "this-month",
): PeriodFilterState {
  const [preset, setPresetState] = useState<PeriodPreset>(defaultPreset);
  const [range, setRangeState] = useState<[Dayjs, Dayjs]>(() =>
    presetRange(defaultPreset),
  );

  const setPreset = (next: PeriodPreset) => {
    setPresetState(next);
    if (next !== "custom") setRangeState(presetRange(next));
  };

  const setRange = (next: [Dayjs, Dayjs]) => {
    setRangeState(next);
    setPresetState("custom");
  };

  const from = range[0].format(API_DATE);
  const to = range[1].format(API_DATE);
  const invalid = range[0].isAfter(range[1], "day");
  const label = `${range[0].format("DD-MM-YYYY")} → ${range[1].format("DD-MM-YYYY")}`;

  return useMemo(
    () => ({ preset, setPreset, range, setRange, from, to, invalid, label }),
    // setPreset/setRange chỉ đóng gói setState (ổn định theo React) nên không
    // cần nằm trong deps; giá trị dẫn xuất đều suy từ `range`/`preset`.
    [preset, range, from, to, invalid, label],
  );
}

export type TimeWindow = { from: string; to: string };

export const EMPTY_TIME_WINDOW: TimeWindow = { from: "", to: "" };
