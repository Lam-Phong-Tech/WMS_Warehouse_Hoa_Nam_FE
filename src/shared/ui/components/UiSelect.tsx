/**
 * UiSelect — select ĐIỀU KHIỂN TRỰC TIẾP (value/onChange, không RHF) cho
 * toolbar/bộ lọc — thay antd Select và MUI Select trần trong feature (Part 4).
 * Bản RHF cho form: UiFormSelect (@/shared/ui/forms).
 *
 * Danh sách DÀI (> SEARCHABLE_OPTION_THRESHOLD option, nhãn dạng chuỗi) tự đổi
 * sang ô gõ-để-tìm: bộ lọc theo SKU/hãng/kho/người dùng lấy từ API không bao
 * giờ rơi vào cảnh cuộn tay hết menu, còn enum ngắn (trạng thái, số dòng/
 * trang) giữ nguyên dropdown thường. Ép tay bằng prop `searchable`.
 */
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useId } from "react";
import type { ReactNode } from "react";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { UiAutocomplete } from "../forms/UiAutocomplete";
import { resolveSearchable } from "../forms/searchable-options";

export interface UiSelectChoice {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
}

export interface UiSelectProps {
  value: string | number | "";
  onChange: (value: string) => void;
  options: UiSelectChoice[];
  /** Nhãn nổi (InputLabel). Bỏ trống khi dùng aria-label. */
  label?: ReactNode;
  /** Bắt buộc khi không có label hiển thị. */
  "aria-label"?: string;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Bề rộng tối thiểu cho toolbar (px). */
  minWidth?: number;
  /**
   * Ép có/không ô tìm kiếm. Bỏ trống = tự quyết theo số option (xem
   * resolveSearchable) — mặc định nên để tự.
   */
  searchable?: boolean;
  "data-testid"?: string;
}

export function UiSelect({
  value,
  onChange,
  options,
  label,
  "aria-label": ariaLabel,
  placeholder,
  disabled = false,
  fullWidth = false,
  minWidth,
  searchable,
  "data-testid": dataTestId,
}: UiSelectProps) {
  const labelId = useId();
  if (resolveSearchable(options, searchable)) {
    return (
      <UiAutocomplete
        // Nhãn đã được resolveSearchable bảo đảm là chuỗi.
        options={
          options as Array<{
            value: string | number;
            label: string;
            disabled?: boolean;
          }>
        }
        value={value}
        onChange={(next) => onChange(next == null ? "" : String(next))}
        label={label}
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        fullWidth={fullWidth}
        // Ô tìm kiếm cần chỗ hiển thị chữ đang gõ: toolbar không đặt minWidth
        // thì lấy 200px thay vì co theo nội dung như dropdown thường.
        sx={{ minWidth: minWidth ?? 200 }}
        data-testid={dataTestId}
      />
    );
  }
  /**
   * Có placeholder ⇒ `displayEmpty` bật ⇒ ô LUÔN hiển thị chữ (placeholder khi
   * chưa chọn). Nhãn outlined của MUI mặc định chỉ "co lên" khi có giá trị
   * hoặc đang focus, nên lúc chưa chọn nó nằm giữa ô và ĐÈ LÊN placeholder.
   * Ép nhãn co sẵn và mở sẵn khe viền để hai thứ không chồng nhau.
   *
   * Chỉ ép khi có placeholder — không có placeholder thì giữ nguyên hành vi
   * mặc định của MUI (nhãn nằm trong ô khi rỗng), tránh đổi giao diện các chỗ
   * đang dùng `label` một mình.
   */
  const forceShrink = Boolean(placeholder) || undefined;
  return (
    <FormControl
      size="small"
      disabled={disabled}
      fullWidth={fullWidth}
      sx={minWidth ? { minWidth } : undefined}
    >
      {label ? (
        <InputLabel id={labelId} shrink={forceShrink}>
          {label}
        </InputLabel>
      ) : null}
      <Select
        // Trần bề rộng để nhãn quá dài không kéo menu tràn màn hình.
        MenuProps={{ slotProps: { paper: { sx: { maxWidth: 520 } } } }}
        labelId={label ? labelId : undefined}
        label={label}
        notched={forceShrink}
        value={value}
        onChange={(event) => onChange(String(event.target.value))}
        displayEmpty={Boolean(placeholder)}
        inputProps={ariaLabel ? { "aria-label": ariaLabel } : undefined}
        renderValue={
          placeholder
            ? (selected) => {
                if (selected === "" || selected === undefined) {
                  return (
                    <span style={{ color: S.textDisabled }}>{placeholder}</span>
                  );
                }
                const match = options.find((o) => o.value === selected);
                return <>{match?.label ?? String(selected)}</>;
              }
            : undefined
        }
        data-testid={dataTestId}
      >
        {placeholder ? (
          <MenuItem value="">
            <span style={{ color: S.textDisabled }}>{placeholder}</span>
          </MenuItem>
        ) : null}
        {options.map((option) => (
          <MenuItem
            key={String(option.value)}
            value={option.value}
            disabled={option.disabled}
            // Menu của MUI rộng TỐI THIỂU bằng ô neo. Không khai nowrap thì
            // nhãn dài ("Thu hồi phạm vi vai trò") gãy dòng giữa từ trong một
            // menu hẹp; có nowrap, menu tự nở cho vừa nhãn dài nhất.
            sx={{ whiteSpace: "nowrap" }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
