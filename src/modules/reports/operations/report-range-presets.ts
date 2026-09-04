import type { DateRangePreset } from "@/shared/ui";
import type { TranslateFn } from "@/shared/i18n/useT";
import {
  CALENDAR_PRESETS,
  ROLLING_PRESETS,
  periodPresetLabel,
  presetRange,
} from "./report-format";

/**
 * Dải "kỳ nhanh" nằm TRONG lịch chọn khoảng — dùng chung cho Tổng quan và cả 8
 * màn báo cáo.
 *
 * Vì sao gộp vào lịch thay vì để một ô "kỳ" riêng bên cạnh: hai control cùng
 * ghi một khoảng ngày là nguồn gốc của việc người dùng không biết cái nào
 * thắng — bấm preset thì ô ngày bị ghi đè, sửa ô ngày thì ô preset lặng lẽ
 * nhảy về "Tùy chọn". Một control thì không có mâu thuẫn nào để hiểu.
 *
 * `range` là HÀM, tính lúc bấm chứ không tính sẵn lúc render: một tab mở qua
 * nửa đêm mà vẫn trả kỳ của hôm qua là sai.
 */
export function reportRangePresets(t: TranslateFn): DateRangePreset[] {
  return [
    ...ROLLING_PRESETS.map((preset) => ({
      key: preset,
      label: periodPresetLabel(preset, t),
      group: t("reports.period.groupRolling"),
      range: () => presetRange(preset),
    })),
    ...CALENDAR_PRESETS.map((preset) => ({
      key: preset,
      label: periodPresetLabel(preset, t),
      group: t("reports.period.groupCalendar"),
      range: () => presetRange(preset),
    })),
  ];
}
