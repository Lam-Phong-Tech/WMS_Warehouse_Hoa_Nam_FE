import { useMemo } from "react";
import dayjs from "dayjs";
import { useT } from "@/shared/i18n/useT";
import {
  Box,
  UiSelect,
  UiTextField,
  UiVuexyDateRangePicker,
} from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import {
  itemKindOptions,
  type ItemKind,
  type SelectOption,
} from "./report-format";
import { reportRangePresets } from "./report-range-presets";
import type { PeriodFilterState, TimeWindow } from "./report-period";

/**
 * Bộ chọn kỳ của khối báo cáo: MỘT control duy nhất.
 *
 * Trước đây là cặp "ô chọn kỳ + ô ngày". Hai control cùng ghi một khoảng ngày
 * là chỗ người dùng không biết cái nào thắng — chọn kỳ thì ô ngày bị ghi đè,
 * còn sửa ô ngày thì ô kỳ lặng lẽ nhảy về "Tùy chọn" mà không nói vì sao. Kỳ
 * nhanh nay nằm trong panel lịch, cùng một bộ với cả 8 màn báo cáo.
 */
export function PeriodFilterControls({ state }: { state: PeriodFilterState }) {
  const t = useT();
  const presets = useMemo(() => reportRangePresets(t), [t]);
  return (
    <UiVuexyDateRangePicker
      value={state.range}
      aria-label={t("reports.filters.dateRangeAria")}
      format="DD/MM/YYYY"
      allowClear={false}
      // Báo cáo vận hành chỉ có dữ liệu ĐÃ XẢY RA: không cho chọn ngày tương lai.
      maxDate={dayjs().endOf("day")}
      presets={presets}
      className="hn-vuexy-date-range"
      popupClassName="hn-vuexy-date-popup"
      onChange={(value) => {
        if (value?.[0] && value?.[1]) state.setRange([value[0], value[1]]);
      }}
    />
  );
}

export function ItemKindFilter({
  value,
  onChange,
  minWidth = 180,
}: {
  value: ItemKind;
  onChange: (next: ItemKind) => void;
  minWidth?: number;
}) {
  const t = useT();
  return (
    <UiSelect
      minWidth={minWidth}
      aria-label={t("reports.filters.itemKindAria")}
      value={value}
      onChange={(next) => onChange(next as ItemKind)}
      options={itemKindOptions(t)}
    />
  );
}

/** Bộ lọc "Tất cả …" chuẩn — giá trị rỗng nghĩa là không lọc. */
export function AllOrPickFilter({
  value,
  onChange,
  options,
  allLabel,
  ariaLabel,
  minWidth = 190,
}: {
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
  allLabel: string;
  ariaLabel: string;
  minWidth?: number;
}) {
  // `placeholder` (không phải một option value="") là cách UiSelect hiển thị
  // trạng thái "chưa chọn": thiếu nó thì `displayEmpty` tắt và ô hiện TRỐNG
  // TRƠN, người dùng không biết bộ lọc đang ở mức nào. UiSelect tự thêm mục
  // rỗng vào danh sách nên không khai lại option "" ở đây.
  return (
    <UiSelect
      minWidth={minWidth}
      aria-label={ariaLabel}
      placeholder={allLabel}
      value={value}
      onChange={onChange}
      options={options}
    />
  );
}

/**
 * Khung giờ cụ thể `hh:mm → hh:mm` (mục 1.4). Dùng `<input type="time">` gốc
 * qua UiTextField thay vì hai select giờ/phút: bàn phím số trên mobile và
 * spinner trên desktop đều đã có sẵn, và giá trị luôn ở dạng "HH:mm" nên không
 * phải parse chuỗi người dùng gõ tay.
 */
export function TimeWindowFilter({
  value,
  onChange,
}: {
  value: TimeWindow;
  onChange: (next: TimeWindow) => void;
}) {
  const t = useT();
  // "HH:mm" so sánh chuỗi là đủ (cùng độ dài, zero-padded). Giá trị vẫn giữ
  // nguyên để người dùng sửa — chỉ báo lỗi, không tự đảo/xoá.
  const orderInvalid = Boolean(value.from && value.to && value.from > value.to);
  const orderError = orderInvalid ? t("reports.common.timeOrderError") : null;
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
      <UiTextField
        type="time"
        sx={{ width: 132 }}
        value={value.from}
        onChange={(event) => onChange({ ...value, from: event.target.value })}
        error={orderInvalid}
        slotProps={{
          htmlInput: {
            "aria-label": t("reports.filters.timeFromAria"),
            "aria-invalid": orderInvalid,
            step: 60,
          },
        }}
      />
      <Box component="span" sx={{ fontSize: 13, pt: 1 }}>
        →
      </Box>
      <UiTextField
        type="time"
        sx={{ width: 132 }}
        value={value.to}
        onChange={(event) => onChange({ ...value, to: event.target.value })}
        error={orderInvalid}
        helperText={orderError ?? undefined}
        slotProps={{
          htmlInput: {
            "aria-label": t("reports.filters.timeToAria"),
            "aria-invalid": orderInvalid,
            step: 60,
          },
        }}
      />
    </Box>
  );
}

/** Cặp nút xuất XLSX/PDF chuẩn của trang báo cáo (gated bởi REPORT_EXPORT). */
export function ExportButtons({
  exporting,
  disabled,
  onExport,
}: {
  exporting: "xlsx" | "pdf" | null;
  disabled?: boolean;
  onExport: (format: "xlsx" | "pdf") => void;
}) {
  const t = useT();
  return (
    <>
      <ActionButton
        kind="exportExcel"
        module="reports"
        action="export"
        permissionCode="REPORT_EXPORT"
        mode="disable"
        loading={exporting === "xlsx"}
        disabled={Boolean(exporting) || disabled}
        onClick={() => onExport("xlsx")}
        disabledTooltip={t("reports.filters.exportTooltip")}
      >
        {t("reports.filters.exportXlsx")}
      </ActionButton>
      <ActionButton
        kind="exportPdf"
        module="reports"
        action="export"
        permissionCode="REPORT_EXPORT"
        mode="disable"
        loading={exporting === "pdf"}
        disabled={Boolean(exporting) || disabled}
        onClick={() => onExport("pdf")}
        disabledTooltip={t("reports.filters.exportTooltip")}
      >
        {t("reports.filters.exportPdf")}
      </ActionButton>
    </>
  );
}
