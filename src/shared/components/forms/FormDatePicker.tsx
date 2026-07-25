import type { Control, FieldValues, Path } from 'react-hook-form';
import { DatePicker } from 'antd';
import { FormField } from '@/shared/components/forms/FormField';
import type { FormFieldProps } from '@/shared/components/forms/FormField';

export interface FormDatePickerProps<T extends FieldValues> extends Partial<
  Pick<FormFieldProps<T>, 'label' | 'help' | 'tooltip' | 'required'>
> {
  control: Control<T>;
  name: Path<T>;
  placeholder?: string;
  format?: string;
  showTime?: boolean;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
}

/**
 * Ô chọn ngày tích hợp react-hook-form.
 * Giá trị trong form là đối tượng dayjs (theo antd DatePicker).
 */
export function FormDatePicker<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  format = 'DD/MM/YYYY',
  showTime = false,
  disabled = false,
  size = 'large',
  help,
  tooltip,
  required,
}: FormDatePickerProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      help={help}
      tooltip={tooltip}
      required={required}
    >
      {(field) => (
        <DatePicker
          {...field}
          placeholder={placeholder}
          format={format}
          showTime={showTime}
          disabled={disabled}
          size={size}
          style={{ width: '100%' }}
          autoComplete="off"
        />
      )}
    </FormField>
  );
}
