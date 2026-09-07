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
import FormHelperText from "@mui/material/FormHelperText";
import { useId } from "react";
import type { ReactNode } from "react";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { UiAutocomplete } from "../forms/UiAutocomplete";
import {
  FILTER_WIDTH,
  fitSelectMinWidth,
  measurableText,
} from "../forms/control-width";
import { resolveSearchable } from "../forms/searchable-options";
import { OPTION_LIST_MAX_HEIGHT } from "../forms/option-window";

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
  /**
   * Ô bắt buộc — hiện dấu sao trên nhãn. KHÔNG tự chặn: màn hình vẫn phải kiểm
   * trong hàm validate của mình (dialog nào cũng lưu bằng onClick nên thuộc
   * tính `required` của HTML không bao giờ chạy).
   */
  required?: boolean;
  /** Đang có lỗi — viền/nhãn đổi màu lỗi. */
  error?: boolean;
  /**
   * Câu lỗi (hoặc gợi ý) hiện dưới ô. Trước 06/09/2026 UiSelect KHÔNG có chỗ
   * này, nên ô select bắt buộc đặt trong form không có đường hiện câu lỗi —
   * người viết màn phải nhớ đổi sang UiFormSelect hoặc UiTextField select.
   */
  helperText?: ReactNode;
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
  required = false,
  error = false,
  helperText,
  "data-testid": dataTestId,
}: UiSelectProps) {
  const labelId = useId();
  const helperId = `${labelId}-helper`;
  const searchableMode = resolveSearchable(options, searchable);
  /**
   * Bề rộng tối thiểu đi theo NHÃN chứ không theo con số từng màn đoán tay.
   * Dropdown thường tự nở theo chữ, nhưng ô gõ-để-tìm thì không — và ô này
   * bật/tắt theo số option từ API, nên một `minWidth` vừa lúc dev (danh mục
   * rỗng) cắt cụt placeholder trên máy thật ("Bệnh/lỗi: Tất c…"). Không áp
   * cho `fullWidth`: khi đó ô lọc do lưới của trang quyết bề rộng.
   */
  const fittedMinWidth = fullWidth
    ? undefined
    : fitSelectMinWidth({
        texts: [placeholder ?? "", measurableText(label)],
        floor: minWidth ?? (searchableMode ? FILTER_WIDTH.select : 0),
        searchable: searchableMode,
      });
  if (searchableMode) {
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
        // Ô tìm kiếm không co theo nội dung như dropdown thường: bề rộng lấy từ
        // nhãn (fitSelectMinWidth), sàn FILTER_WIDTH.select khi màn không khai.
        sx={{ minWidth: fittedMinWidth }}
        required={required}
        error={error}
        helperText={helperText}
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
      required={required}
      error={error}
      sx={fittedMinWidth ? { minWidth: fittedMinWidth } : undefined}
    >
      {label ? (
        <InputLabel id={labelId} shrink={forceShrink}>
          {label}
        </InputLabel>
      ) : null}
      <Select
        /*
         * Trần bề rộng để nhãn quá dài không kéo menu tràn màn hình, và trần
         * CAO đúng 5 dòng: menu dài hơn một tầm nhìn thì người dùng mất chỗ
         * đứng (trên điện thoại nó che gần hết trang). Danh sách dài hơn ngưỡng
         * `resolveSearchable` đã đi nhánh gõ-để-tìm ở trên, nên trần này chỉ
         * chạm tới các enum cỡ 6–8 dòng — cuộn một nhịp là hết.
         */
        MenuProps={{
          slotProps: {
            paper: {
              sx: { maxWidth: 520, maxHeight: OPTION_LIST_MAX_HEIGHT + 16 },
            },
          },
        }}
        labelId={label ? labelId : undefined}
        label={label}
        notched={forceShrink}
        value={value}
        onChange={(event) => onChange(String(event.target.value))}
        displayEmpty={Boolean(placeholder)}
        // aria-invalid/aria-describedby phải tự khai: MUI Select không tự gắn
        // như TextField, nên trình đọc màn hình sẽ không đọc câu lỗi nếu thiếu.
        inputProps={{
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
          ...(error ? { "aria-invalid": true } : {}),
          ...(helperText ? { "aria-describedby": helperId } : {}),
        }}
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
      {helperText ? (
        <FormHelperText id={helperId}>{helperText}</FormHelperText>
      ) : null}
    </FormControl>
  );
}
