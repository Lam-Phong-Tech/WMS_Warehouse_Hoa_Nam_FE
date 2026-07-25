import { useEffect, useRef, type ReactNode } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { AutoComplete, type AutoCompleteProps } from 'antd';
import { FormField } from '@/shared/components/forms/FormField';
import type {
  AutocompleteOption,
  UseAutocompleteOptions,
} from '@/shared/hooks/use-autocomplete';
import { useAutocomplete } from '@/shared/hooks/use-autocomplete';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormAutocompleteProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  placeholder?: string;
  help?: ReactNode;
  tooltip?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
  allowClear?: boolean;

  /** Cấu hình autocomplete (local/remote) */
  autocompleteOptions: UseAutocompleteOptions & {
    /** Hàm lấy value từ option khi chọn, mặc định option.value */
    getValueFromOption?: (option: AutocompleteOption) => string | number;
    /** Hàm render option (nếu muốn custom), mặc định option.label */
    renderOption?: (option: AutocompleteOption) => ReactNode;
  };

  /** Các props khác truyền thẳng xuống Antd AutoComplete */
  autoCompleteProps?: Omit<
    AutoCompleteProps,
    | 'options'
    | 'value'
    | 'onSearch'
    | 'onSelect'
    | 'onChange'
    | 'children'
    | 'filterOption'
  >;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Ô nhập tự động hoàn thành (autocomplete) tích hợp react-hook-form.
 * Hỗ trợ cả tìm kiếm local (staticOptions) và remote fetch (apiUrl).
 *
 * @example
 * ```tsx
 * // Local options
 * <FormAutocomplete
 *   control={control}
 *   name="managerId"
 *   label="Người quản lý"
 *   placeholder="Gõ để tìm kiếm..."
 *   autocompleteOptions={{
 *     staticOptions: employees.map(e => ({
 *       value: e.id,
 *       label: `${e.code} — ${e.fullName}`,
 *     })),
 *   }}
 * />
 *
 * // Remote fetch
 * <FormAutocomplete
 *   control={control}
 *   name="employeeId"
 *   label="Nhân viên"
 *   autocompleteOptions={{
 *     apiUrl: '/employees/search',
 *     transformResponse: (data: any) => data.data.map((e: any) => ({
 *       value: e.id,
 *       label: `${e.code} — ${e.fullName}`,
 *     })),
 *   }}
 * />
 * ```
 */
export function FormAutocomplete<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'Gõ để tìm kiếm...',
  help,
  tooltip,
  required = false,
  disabled = false,
  size = 'large',
  allowClear = true,
  autocompleteOptions,
  autoCompleteProps,
}: FormAutocompleteProps<T>) {
  const {
    getValueFromOption = (option) => option.value,
    renderOption,
    ...hookOptions
  } = autocompleteOptions;

  const { options, setSearchText } = useAutocomplete(hookOptions);
  const displayLabelRef = useRef<string>('');

  return (
    <FormField
      control={control}
      name={name}
      label={label}
      help={help}
      tooltip={tooltip}
      required={required}
    >
      {(field) => {
        // Sync displayLabel khi field.value thay đổi từ bên ngoài
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (
            hookOptions.staticOptions &&
            field.value !== undefined &&
            field.value !== null &&
            field.value !== ''
          ) {
            const match = hookOptions.staticOptions.find(
              (opt) => String(opt.value) === String(field.value),
            );
            if (match) {
              displayLabelRef.current = match.label;
            }
          }
        }, [field.value]);

        const displayValue =
          displayLabelRef.current ||
          (field.value !== undefined && field.value !== null
            ? String(field.value)
            : undefined);

        return (
          <AutoComplete
            value={displayValue}
            options={options.map((opt) => ({
              value: String(opt.value),
              label: renderOption?.(opt) ?? opt.label,
            }))}
            onSearch={(text) => {
              setSearchText(text);
              if (!text) {
                displayLabelRef.current = '';
              }
            }}
            onSelect={(value) => {
              const selected = options.find(
                (opt) => String(opt.value) === value,
              );
              if (selected) {
                field.onChange(getValueFromOption(selected));
                displayLabelRef.current = selected.label;
              }
              setSearchText('');
            }}
            onChange={(value) => {
              if (typeof value === 'string') {
                field.onChange(value);
                displayLabelRef.current = value;
              }
            }}
            onBlur={field.onBlur}
            onClear={() => {
              field.onChange(null);
              displayLabelRef.current = '';
              setSearchText('');
            }}
            disabled={disabled}
            placeholder={placeholder}
            allowClear={allowClear}
            size={size}
            style={{ width: '100%' }}
            {...autoCompleteProps}
          />
        );
      }}
    </FormField>
  );
}
