/**
 * Barrel cho nhóm Form field (react-hook-form + antd).
 * Import gọn: `import { FormInput, TextField } from '@/shared/components/forms'`.
 *
 * Mọi field xây trên `FormField` (Controller + Form.Item) nên lỗi validation
 * tự hiển thị. Quy ước props: luôn có `control` + `name` (+ `label`).
 * Có hai bộ tên: `Form*` (gốc) và tên theo taxonomy (`TextField`…) là alias.
 */
export { FormField, type FormFieldProps } from "./FormField";
export { FormInput, type FormInputProps } from "./FormInput";
export { FormSelect, type FormSelectProps } from "./FormSelect";
export { FormNumber, type FormNumberProps } from "./FormNumber";
export { FormDatePicker, type FormDatePickerProps } from "./FormDatePicker";
export { FormSwitch, type FormSwitchProps } from "./FormSwitch";
export { FormTextarea, type FormTextareaProps } from "./FormTextarea";
export {
  FormAutocomplete,
  type FormAutocompleteProps,
} from "./FormAutocomplete";
export { ScanInput, type ScanInputProps } from "./ScanInput";

// Alias theo taxonomy chung + nút submit
export { TextField, type TextFieldProps } from "./TextField";
export { SelectField, type SelectFieldProps } from "./SelectField";
export { DateField, type DateFieldProps } from "./DateField";
export { FormError, type FormErrorProps } from "./FormError";
export { SubmitButton, type SubmitButtonProps } from "./SubmitButton";
