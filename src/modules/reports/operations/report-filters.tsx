import { Box, UiDateRangePicker, UiSelect, UiTextField } from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import {
  ITEM_KIND_OPTIONS,
  PERIOD_PRESET_OPTIONS,
  type ItemKind,
  type PeriodPreset,
  type SelectOption,
} from "./report-format";
import type { PeriodFilterState, TimeWindow } from "./report-period";

export function PeriodFilterControls({ state }: { state: PeriodFilterState }) {
  return (
    <>
      <UiSelect
        minWidth={150}
        aria-label="Kỳ báo cáo"
        value={state.preset}
        onChange={(value) => state.setPreset(value as PeriodPreset)}
        options={PERIOD_PRESET_OPTIONS}
      />
      <UiDateRangePicker
        value={state.range}
        aria-label="Từ ngày đến ngày"
        onChange={(value) => {
          if (value?.[0] && value?.[1]) state.setRange([value[0], value[1]]);
        }}
      />
    </>
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
  return (
    <UiSelect
      minWidth={minWidth}
      aria-label="Loại hàng"
      value={value}
      onChange={(next) => onChange(next as ItemKind)}
      options={ITEM_KIND_OPTIONS}
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
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <UiTextField
        type="time"
        sx={{ width: 132 }}
        value={value.from}
        onChange={(event) => onChange({ ...value, from: event.target.value })}
        slotProps={{ htmlInput: { "aria-label": "Khung giờ từ" } }}
      />
      <Box component="span" sx={{ fontSize: 13 }}>
        →
      </Box>
      <UiTextField
        type="time"
        sx={{ width: 132 }}
        value={value.to}
        onChange={(event) => onChange({ ...value, to: event.target.value })}
        slotProps={{ htmlInput: { "aria-label": "Khung giờ đến" } }}
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
        disabledTooltip="Bạn cần quyền xuất báo cáo và bộ lọc hợp lệ"
      >
        Xuất XLSX
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
        disabledTooltip="Bạn cần quyền xuất báo cáo và bộ lọc hợp lệ"
      >
        Xuất PDF
      </ActionButton>
    </>
  );
}
