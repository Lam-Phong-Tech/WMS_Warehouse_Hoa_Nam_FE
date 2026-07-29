import { useState, useCallback } from "react";
import {
  useForm,
  type UseFormProps,
  type SubmitHandler,
  type Path,
  type PathValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { applyServerErrors } from "@/shared/hooks/useApiFormErrors";

/**
 * Form mode: create | edit | view
 */
export type FormMode = "create" | "edit" | "view";

export interface UseFormPatternOptions<T extends Record<string, unknown>> {
  /** Zod schema for validation */
  schema: ZodType<T>;
  /** Default values for the form */
  defaultValues?: Partial<T>;
  /** Callback when form is submitted successfully */
  onSubmit: SubmitHandler<T>;
  /** Whether to enable real-time validation */
  validateOnChange?: boolean;
}

export interface UseFormPatternReturn<T extends Record<string, unknown>> {
  /** React Hook Form control */
  control: ReturnType<typeof useForm<T>>["control"];
  /** Form register */
  register: ReturnType<typeof useForm<T>>["register"];
  /** Form handleSubmit (raw RHF handleSubmit, in case a custom submit callback is needed) */
  handleSubmit: ReturnType<typeof useForm<T>>["handleSubmit"];
  /** Ready-to-use submit handler bound to the `onSubmit` option — pass directly to onOk/onClick */
  submitForm: () => void;
  /** Form errors */
  errors: ReturnType<typeof useForm<T>>["formState"]["errors"];
  /** Form is submitting */
  isSubmitting: boolean;
  /** Form is dirty (has changes) */
  isDirty: boolean;
  /** Reset form to initial state */
  resetForm: () => void;
  /** Set form values */
  setValues: (values: Partial<T>) => void;
  /** Current form mode */
  mode: FormMode;
  /** Set form mode */
  setMode: (mode: FormMode) => void;
  /** Form state */
  formState: ReturnType<typeof useForm<T>>["formState"];
  /** Watch form values */
  watch: ReturnType<typeof useForm<T>>["watch"];
  /** Get form values */
  getValues: ReturnType<typeof useForm<T>>["getValues"];
  /** Set field value */
  setValue: ReturnType<typeof useForm<T>>["setValue"];
  /** Reset field value */
  resetField: ReturnType<typeof useForm<T>>["resetField"];
  /** Clear errors */
  clearErrors: ReturnType<typeof useForm<T>>["clearErrors"];
  /** Trigger validation */
  trigger: ReturnType<typeof useForm<T>>["trigger"];
  /**
   * Set lỗi cho 1 field cụ thể (vd để map lỗi validation từ server — HTTP 422).
   * Dùng cùng `@/shared/hooks/useApiFormErrors` để map nguyên cụm `{ field: message }`
   * từ `extractFieldErrors()` (`@/shared/api/api-error`) xuống form.
   */
  setError: ReturnType<typeof useForm<T>>["setError"];
  /**
   * Map lỗi validation server (HTTP 422 — `errors` root-level hoặc `error.details`
   * nested, snake_case tự map camelCase) thẳng xuống form — gọi trực tiếp trong
   * `catch` của `onSubmit`, không cần đi vòng qua state/prop `apiErrors` +
   * `useApiFormErrors` riêng. Xem `@/shared/hooks/useApiFormErrors`.
   */
  applyServerErrors: (
    error: unknown,
    fieldMap?: Partial<Record<string, string>>,
    normalizeField?: (field: string) => string,
  ) => boolean;
}

/**
 * Hook quản lý form pattern chuẩn cho Create/Edit/View
 *
 * @example
 * ```tsx
 * const {
 *   control,
 *   submitForm,
 *   errors,
 *   isSubmitting,
 *   mode,
 *   setMode,
 *   resetForm
 * } = useFormPattern({
 *   schema: CreateOrgUnitSchema,
 *   defaultValues: { type: 'branch', status: 'active' },
 *   onSubmit: async (data) => {
 *     await createOrgUnit(data);
 *   },
 *   onCancel: () => {
 *     setOpen(false);
 *     resetForm();
 *   },
 * });
 *
 * // <FormDrawer onOk={submitForm} ... />
 *
 * // Switch to edit mode
 * const handleEdit = (record) => {
 *   setMode('edit');
 *   setValues(record);
 * };
 * ```
 */
export function useFormPattern<T extends Record<string, unknown>>({
  schema,
  defaultValues,
  onSubmit,
  validateOnChange = true,
}: UseFormPatternOptions<T>): UseFormPatternReturn<T> {
  const [mode, setMode] = useState<FormMode>("create");

  const form = useForm<T>({
    resolver: zodResolver(schema as ZodType<T, T>),
    defaultValues: defaultValues as UseFormProps<T>["defaultValues"],
    mode: validateOnChange ? "onChange" : "onBlur",
    reValidateMode: "onChange",
  } as UseFormProps<T>);

  const {
    control,
    register,
    handleSubmit,
    formState,
    watch,
    getValues,
    setValue,
    resetField,
    clearErrors,
    trigger,
    setError,
  } = form;
  const { errors, isSubmitting, isDirty } = formState;

  const resetForm = useCallback(() => {
    form.reset(defaultValues as T);
    setMode("create");
  }, [form, defaultValues]);

  const setValues = useCallback(
    (values: Partial<T>) => {
      (Object.keys(values) as Array<Path<T>>).forEach((key) => {
        setValue(key, values[key] as PathValue<T, Path<T>>);
      });
    },
    [setValue],
  );

  const submitForm = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  const boundApplyServerErrors = useCallback(
    (
      error: unknown,
      fieldMap?: Partial<Record<string, string>>,
      normalizeField?: (field: string) => string,
    ) => applyServerErrors(error, setError, fieldMap, normalizeField),
    [setError],
  );

  return {
    control,
    register,
    handleSubmit,
    submitForm,
    errors,
    isSubmitting,
    isDirty,
    resetForm,
    setValues,
    mode,
    setMode,
    formState,
    watch,
    getValues,
    setValue,
    resetField,
    clearErrors,
    trigger,
    setError,
    applyServerErrors: boundApplyServerErrors,
  };
}
