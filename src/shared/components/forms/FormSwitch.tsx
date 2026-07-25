import type { Control, FieldValues, Path } from 'react-hook-form';
import { Switch, type SwitchProps } from 'antd';
import {
  FormField,
  type FormFieldProps,
} from '@/shared/components/forms/FormField';

export type FormSwitchProps<T extends FieldValues> = SwitchProps & {
  control: Control<T>;
  name: Path<T>;
} & Partial<Pick<FormFieldProps<T>, 'label' | 'help' | 'tooltip' | 'required'>>;

/** Công tắc bật/tắt (boolean) tích hợp react-hook-form. */
export function FormSwitch<T extends FieldValues>({
  control,
  name,
  label,
  help,
  tooltip,
  required,
  ...rest
}: FormSwitchProps<T>) {
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
        <Switch {...rest} checked={!!field.value} onChange={field.onChange} />
      )}
    </FormField>
  );
}
