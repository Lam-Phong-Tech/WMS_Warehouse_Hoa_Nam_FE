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
import { useId, useLayoutEffect, useRef, useState } from "react";
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
  /** Pagination options always stay on one line; ordinary filters may wrap. */
  kind?: "default" | "page-size";
  /** Connect a visible external label to the dropdown. */
  id?: string;
  /** Show an explicit empty-value choice without a placeholder row. */
  displayEmpty?: boolean;
  value: string | number | "";
  onChange: (value: string) => void;
  options: UiSelectChoice[];
  /** Nhãn nổi (InputLabel). Bỏ trống khi dùng aria-label. */
  label?: ReactNode;
  /** Bắt buộc khi không có label hiển thị. */
  "aria-label"?: string;
  placeholder?: string;
  /**
   * Value emitted when the searchable branch is cleared through MUI's ×.
   * Defaults to "" (existing "no filter" contract). When the current value
   * already equals this default, the × is hidden: a filter's default choice
   * ("Tất cả") must not be clearable to an invalid empty value.
   */
  clearValue?: string | number | "";
  disabled?: boolean;
  fullWidth?: boolean;
  /** Bề rộng tối thiểu cho toolbar (px). */
  minWidth?: number;
  /** Optional class for the non-searchable dropdown paper (useful for screen-scoped portal styling). */
  menuClassName?: string;
  /** Opt in to a short opacity transition for non-searchable dropdowns. */
  menuMotion?: "fade";
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
  kind = "default",
  id,
  displayEmpty,
  value,
  onChange,
  options,
  label,
  "aria-label": ariaLabel,
  placeholder,
  clearValue,
  disabled = false,
  fullWidth = false,
  minWidth,
  menuClassName,
  searchable,
  required = false,
  error = false,
  helperText,
  "data-testid": dataTestId,
}: UiSelectProps) {
  const labelId = useId();
  const helperId = `${labelId}-helper`;
  /**
   * Đo bề rộng THẬT của ô chọn để menu mở ra đúng bằng ô (giống popper của
   * UiAutocomplete: width = anchor.clientWidth). MUI Select chỉ đặt `min-width`
   * = bề rộng ô neo nên menu còn nở thêm tới nhãn dài nhất; khi ô nằm trong
   * lưới bộ lọc, menu sẽ rộng quá ô. Gắn ref vào FormControl (bọc sát Select),
   * theo dõi bằng ResizeObserver để giữ đúng cả lúc lưới đổi cột.
   */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [anchorWidth, setAnchorWidth] = useState<number>();
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const update = () => setAnchorWidth(node.clientWidth || undefined);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const pageSizeMode = kind === "page-size";
  const searchableMode =
    !pageSizeMode && resolveSearchable(options, searchable);
  /**
   * Bề rộng tối thiểu đi theo NHÃN chứ không theo con số từng màn đoán tay.
   * Dropdown thường tự nở theo chữ, nhưng ô gõ-để-tìm thì không — và ô này
   * bật/tắt theo số option từ API, nên một `minWidth` vừa lúc dev (danh mục
   * rỗng) cắt cụt placeholder trên máy thật ("Bệnh/lỗi: Tất c…"). Không áp
   * cho `fullWidth`: khi đó ô lọc do lưới của trang quyết bề rộng.
   */
  const fittedMinWidth =
    fullWidth && !pageSizeMode
      ? undefined
      : fitSelectMinWidth({
          texts: [
            placeholder ?? "",
            measurableText(label),
            ...(pageSizeMode
              ? options.map((option) => measurableText(option.label))
              : []),
          ],
          floor: pageSizeMode
            ? Math.max(FILTER_WIDTH.pageSize, minWidth ?? 0)
            : (minWidth ?? (searchableMode ? FILTER_WIDTH.select : 0)),
          searchable: searchableMode,
        });
  if (searchableMode) {
    const clearValueString = clearValue === undefined ? "" : String(clearValue);
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
        disableClearable={
          clearValue !== undefined && String(value) === clearValueString
        }
        onChange={(next) =>
          onChange(next == null ? clearValueString : String(next))
        }
        label={label}
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        fullWidth={fullWidth}
        menuClassName={menuClassName}
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
  // Keep the closed placeholder, but never invent a second reset choice when
  // options already defines it (including non-empty sentinels such as ALL).
  const showPlaceholderChoice =
    Boolean(placeholder) &&
    !options.some(
      (option) =>
        option.value === "" ||
        measurableText(option.label).trim() === placeholder?.trim(),
    );
  return (
    <FormControl
      ref={rootRef}
      size="small"
      disabled={disabled}
      fullWidth={fullWidth}
      required={required}
      error={error}
      data-ui-select-kind={kind}
      // Screen filter rules often reset .MuiFormControl-root min-width to 0.
      // Keep the pagination width contract above those scoped CSS selectors.
      style={
        pageSizeMode ? { minWidth: fittedMinWidth, flexShrink: 0 } : undefined
      }
      sx={
        fittedMinWidth
          ? {
              minWidth: fittedMinWidth,
              ...(pageSizeMode ? { flexShrink: 0 } : {}),
            }
          : undefined
      }
    >
      {label ? (
        <InputLabel id={labelId} shrink={forceShrink}>
          {label}
        </InputLabel>
      ) : null}
      <Select
        id={id}
        /*
         * Menu mở ra ĐÚNG bằng bề rộng ô chọn (user chốt 09/11/2026 cho bộ
         * lọc; UiAutocomplete đã có hành vi này sẵn). MUI chỉ đặt min-width =
         * bề rộng ô neo nên menu còn nở tới nhãn dài nhất; trần maxWidth =
         * bề rộng ô đo được chặn phần nở thêm. Trần CAO đúng 5 dòng: menu dài
         * hơn một tầm nhìn thì người dùng mất chỗ đứng. Danh sách dài hơn
         * ngưỡng `resolveSearchable` đã đi nhánh gõ-để-tìm ở trên, nên trần
         * này chỉ chạm tới các enum cỡ 6–8 dòng — cuộn một nhịp là hết.
         */
        MenuProps={{
          slotProps: {
            paper: {
              className:
                [menuClassName, pageSizeMode ? "hn-page-size-menu" : ""]
                  .filter(Boolean)
                  .join(" ") || undefined,
              /*
               * Trần bề rộng ĐẶT INLINE, không qua sx: các màn khai class riêng
               * cho menu (.hn-war04-menu…) có selector specificity cao hơn
               * class của sx nên từng ghi đè mất trần này và menu lại nở theo
               * nội dung. Inline style thắng mọi class.
               */
              style: { maxWidth: anchorWidth ?? 520 },
              sx: {
                maxHeight: OPTION_LIST_MAX_HEIGHT + 16,
              },
            },
          },
        }}
        labelId={label ? labelId : undefined}
        label={label}
        notched={forceShrink}
        value={value}
        onChange={(event) => onChange(String(event.target.value))}
        displayEmpty={displayEmpty ?? Boolean(placeholder)}
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
        {showPlaceholderChoice ? (
          <MenuItem value="">
            <span style={{ color: S.textDisabled }}>{placeholder}</span>
          </MenuItem>
        ) : null}
        {options.map((option) => (
          <MenuItem
            key={String(option.value)}
            value={option.value}
            disabled={option.disabled}
            // Menu không nở rộng hơn ô nữa nên nhãn dài ("Thu hồi phạm vi
            // vai trò") phải XUỐNG DÒNG trong lòng menu thay vì tràn/clip.
            sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
            // Page-specific menu classes must not reintroduce wrapping.
            style={
              pageSizeMode
                ? { whiteSpace: "nowrap", overflowWrap: "normal" }
                : undefined
            }
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
