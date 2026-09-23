/**
 * UiAutocomplete — autocomplete cho form KHÔNG dùng react-hook-form.
 *
 * `UiFormAutocomplete` bọc sẵn `Controller` nên chỉ dùng được khi field nằm
 * trong một RHF form. Vài màn (modal xuất linh kiện bảo hành, modal tiếp nhận
 * xuất kho) giữ dòng chứng từ trong state thường vì mỗi dòng là một bản ghi
 * động thêm/bớt tại chỗ, không map được vào một `Path<T>` cố định — trước đây
 * chúng phải `import Autocomplete from "@mui/material/Autocomplete"` thẳng,
 * đúng thứ guard `ui:architecture` chặn.
 *
 * Cùng dáng và cùng hành vi so khớp option (`isOptionEqualToValue` theo
 * `value`) với `UiFormAutocomplete` để hai lối vào không lệch nhau về giao diện.
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import type { SxProps, Theme } from "@mui/material/styles";
import { useT } from "@/shared/i18n/useT";
import type { UiAutocompleteOption } from "./UiFormAutocomplete";
import { OPTION_LIST_MAX_HEIGHT, useOptionWindow } from "./option-window";

/**
 * Lọc mặc định của MUI, gọi tay để CẮT bớt kết quả trước khi dựng. Giữ nguyên
 * cách so khớp cũ (không dấu, không phân biệt hoa thường) — chỗ này chỉ thêm
 * bước cắt, không đổi luật tìm.
 */
const filterByLabel = createFilterOptions<UiAutocompleteOption>();

/**
 * Sentinel của dòng "+ Thêm mới" — không phải giá trị thật, chỉ để nhận diện
 * lúc chọn rồi chặn không cho lọt ra `onChange`. Chuỗi cố ý dài/lạ để không bao
 * giờ trùng value thật (thường là UUID). Cùng quy ước với UiFormAutocomplete.
 */
const ADD_NEW_OPTION_VALUE = "__ui_autocomplete_add_new__";

interface UiAutocompleteBaseProps {
  options: UiAutocompleteOption[];
  label?: ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Mặc định true. */
  fullWidth?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  /** Đang tải danh sách option (hiện spinner của MUI trong ô). */
  loading?: boolean;
  /** Người dùng gõ để lọc từ xa — nhận chuỗi đang gõ. */
  onInputChange?: (keyword: string) => void;
  /** Chuỗi hiện khi không option nào khớp. */
  noOptionsText?: ReactNode;
  /**
   * Có truyền thì thêm một dòng đặc biệt ở CUỐI danh sách (mặc định
   * "+ Thêm mới"). Chọn dòng đó KHÔNG gọi `onChange` — chỉ gọi `onAddNew()`,
   * dùng cho case tạo nhanh một bản ghi danh mục ngay trong dropdown.
   */
  onAddNew?: () => void;
  addNewLabel?: string;
  sx?: SxProps<Theme>;
  /** Optional screen-scoped class for the dropdown portal surface. */
  menuClassName?: string;
  /** Dùng khi ô không có `label` hiển thị (bộ lọc trên thanh công cụ). */
  "aria-label"?: string;
  "data-testid"?: string;
}

/** Chọn một giá trị — xoá ô trả về `null`. */
interface UiAutocompleteSingleProps extends UiAutocompleteBaseProps {
  multiple?: false;
  /** Giá trị đang chọn — scalar, so khớp với `option.value`. */
  value: string | number | null;
  onChange: (value: string | number | null) => void;
}

/** Chọn nhiều giá trị — mỗi lựa chọn là một chip, giá trị là mảng. */
interface UiAutocompleteMultiProps extends UiAutocompleteBaseProps {
  multiple: true;
  value: Array<string | number>;
  onChange: (value: Array<string | number>) => void;
}

export type UiAutocompleteProps =
  | UiAutocompleteSingleProps
  | UiAutocompleteMultiProps;

export function UiAutocomplete({
  options,
  value,
  onChange,
  multiple = false,
  label,
  placeholder,
  required = false,
  disabled = false,
  fullWidth = true,
  error = false,
  helperText,
  loading = false,
  onInputChange,
  noOptionsText,
  onAddNew,
  addNewLabel,
  sx,
  menuClassName,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: UiAutocompleteProps) {
  const t = useT();
  // Từ khoá đang gõ chỉ dùng để ĐẶT LẠI cửa sổ dựng (gõ tiếp = danh sách khác,
  // phải quay về đầu). Việc lọc vẫn do MUI quyết định trong `filterOptions`,
  // nên không kiểm soát `inputValue` để khỏi phá hành vi "mở lại thì hiện đủ
  // danh sách" của option đang chọn.
  const [typed, setTyped] = useState("");
  const listWindow = useOptionWindow(options.length, typed);
  /**
   * PHẢI memo hoá ở nhánh multiple: MUI so `value` bằng identity, và mảng mới ở
   * mỗi lần render làm nó tưởng lựa chọn vừa đổi — hiệu ứng `resetInputValue`
   * chạy theo và XOÁ SẠCH chữ đang gõ (ở chế độ nhiều lựa chọn nó luôn đặt ô
   * nhập về rỗng). Triệu chứng: gõ tìm trong ô chọn-nhiều thì ô luôn trống và
   * danh sách không bao giờ được lọc.
   */
  const selected = useMemo(
    () =>
      multiple
        ? options.filter((option) =>
            ((value as Array<string | number> | null) ?? []).includes(
              option.value,
            ),
          )
        : (options.find((option) => option.value === value) ?? null),
    [multiple, options, value],
  );
  const optionsWithAddNew = onAddNew
    ? [
        ...options,
        {
          value: ADD_NEW_OPTION_VALUE,
          label: addNewLabel ?? t("shared.form.addNew"),
        },
      ]
    : options;

  return (
    <Autocomplete
      size="small"
      fullWidth={fullWidth}
      sx={sx}
      options={optionsWithAddNew}
      disabled={disabled}
      loading={loading}
      value={selected}
      multiple={multiple}
      onChange={(_event, next) => {
        if (multiple) {
          const picked = (next as UiAutocompleteOption[]) ?? [];
          // Dòng "+ Thêm mới" không phải giá trị thật — lọc bỏ trước khi trả ra.
          if (picked.some((option) => option.value === ADD_NEW_OPTION_VALUE)) {
            onAddNew?.();
          }
          (onChange as (value: Array<string | number>) => void)(
            picked
              .filter((option) => option.value !== ADD_NEW_OPTION_VALUE)
              .map((option) => option.value),
          );

          return;
        }
        const single = next as UiAutocompleteOption | null;
        if (single?.value === ADD_NEW_OPTION_VALUE) {
          onAddNew?.();

          return;
        }
        (onChange as (value: string | number | null) => void)(
          single?.value ?? null,
        );
      }}
      onInputChange={(_event, keyword, reason) => {
        setTyped(keyword);
        // Chỉ báo khi NGƯỜI DÙNG gõ. MUI còn bắn sự kiện này lúc `reset` và lúc
        // chọn xong option — chuyển tiếp cả hai sẽ ghi đè từ khoá tìm kiếm bằng
        // nhãn vừa chọn rồi gọi lại API một lượt thừa.
        if (reason === "input") onInputChange?.(keyword);
      }}
      /*
       * Danh mục thật (SKU, đại lý) tới vài nghìn dòng. Dựng hết một lượt thì
       * cú bấm mở menu treo cả giây, trong khi hộp chỉ cao 5 dòng — cắt còn
       * `listWindow.limit` dòng, cuộn tới đáy mới dựng thêm một nhịp.
       */
      filterOptions={(all, state) => {
        const matched = filterByLabel(all, state);
        const rows = matched.filter(
          (option) => option.value !== ADD_NEW_OPTION_VALUE,
        );
        const addNewRow = matched.find(
          (option) => option.value === ADD_NEW_OPTION_VALUE,
        );
        const sliced = rows.slice(0, listWindow.limit);
        // "+ Thêm mới" luôn là dòng CUỐI và không bao giờ bị cắt mất: nó là lối
        // thoát khi tìm không ra, đúng lúc danh sách bị cắt nhất.
        return addNewRow ? [...sliced, addNewRow] : sliced;
      }}
      slotProps={{
        paper: { className: menuClassName },
        listbox: {
          onScroll: listWindow.onListScroll,
          sx: { maxHeight: OPTION_LIST_MAX_HEIGHT },
        },
      }}
      getOptionLabel={(option) => option.label}
      getOptionDisabled={(option) => Boolean(option.disabled)}
      isOptionEqualToValue={(option, valueOption) =>
        option.value === valueOption.value
      }
      noOptionsText={noOptionsText ?? t("shared.form.noOptions")}
      // MUI mặc định "Clear"/"Open"/"Close" — đó là tooltip VÀ aria-label của
      // nút × / ▾ ngay trên ô lọc, tức chữ tiếng Anh giữa màn tiếng Việt. Nút ×
      // là lối "xoá bộ lọc" duy nhất của ô gõ-để-tìm nên nhãn của nó phải đọc
      // được.
      clearText={t("shared.form.autocompleteClear")}
      openText={t("shared.form.autocompleteOpen")}
      closeText={t("shared.form.autocompleteClose")}
      renderOption={(optionProps, option) => {
        const { key, ...rest } = optionProps;
        if (option.value === ADD_NEW_OPTION_VALUE) {
          return (
            <Box
              component="li"
              key={key}
              {...rest}
              sx={{
                color: "primary.main",
                fontWeight: 600,
                gap: 0.75,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <i className="fi fi-rr-plus" aria-hidden="true" />
              {option.label}
            </Box>
          );
        }
        return (
          <li key={key} {...rest}>
            {option.label}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          // Ô nhập LUÔN lấp đầy khung Autocomplete: bề rộng do root quyết
          // (fullWidth hoặc sx), không để TextField co theo nội dung.
          fullWidth
          label={label}
          required={required}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps?.htmlInput,
              ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
              ...(dataTestId ? { "data-testid": dataTestId } : {}),
            },
          }}
        />
      )}
    />
  );
}
