import { useEffect } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { extractFieldErrors } from "@/shared/api/api-error";

/**
 * Ghi 1 map lỗi field (`{ camelField: message }`, đã map snake_case → camelCase
 * hoặc chưa) xuống react-hook-form qua `setError`. Dùng chung cho cả
 * `useApiFormErrors` (phản ứng theo prop `apiErrors`) lẫn `applyServerErrors`
 * (gọi thẳng trong catch-block).
 *
 * ⚠️ `fieldErrors` luôn là output của `extractFieldErrors()` (api-error.ts) —
 * tức ĐÃ được tự động snake_case → camelCase trước khi tới đây. Vì vậy key của
 * `fieldMap`/logic trong `normalizeField` phải khớp với tên field SAU chuyển đổi
 * (vd `managerEmployeeId`), KHÔNG phải tên gốc từ BE (`manager_employee_id`) —
 * dùng nhầm tên gốc sẽ khiến `fieldMap` không bao giờ khớp và lỗi field bị rơi
 * mất trong im lặng (bug thật đã gặp ở `DepartmentFormModal`/`OrgUnitFormModal`,
 * xem git history). Chỉ cần khai báo entry khi tên sau chuyển đổi khác tên field
 * thật trên form.
 */
function applyFieldErrorsToForm<T extends FieldValues>(
  fieldErrors: Record<string, string>,
  setError: UseFormSetError<T>,
  fieldMap?: Partial<Record<string, string>>,
  normalizeField?: (field: string) => string,
) {
  for (const [beField, msg] of Object.entries(fieldErrors)) {
    if (!msg) continue;
    let field = fieldMap?.[beField] ?? beField;
    if (normalizeField) field = normalizeField(field);
    setError(field as Path<T>, { type: "server", message: msg });
  }
}

/**
 * Map lỗi validation server (BE, HTTP 422 — dạng `{ field_name: "message" }`)
 * xuống từng field của react-hook-form.
 *
 * Chuẩn hóa logic từng bị lặp lại độc lập ở OrgUnitFormModal, DepartmentFormModal
 * và EmployeeFormModal (mỗi nơi tự viết 1 `useEffect` giống hệt nhau map field
 * snake_case → camelCase rồi gọi `setError`).
 *
 * Dùng khi trang cha tự bắt lỗi mutation, gọi `extractFieldErrors(error)` rồi
 * truyền kết quả xuống form con qua prop (`apiErrors`). Nếu form tự bắt lỗi
 * ngay tại chỗ (trong `onSubmit`), dùng `applyServerErrors()` bên dưới thay vì
 * phải đi vòng qua prop.
 *
 * @param apiErrors  Kết quả `extractFieldErrors(error)` từ `@/shared/api/api-error`
 *                    — `{ camelField: message }` hoặc `{ snake_field: message }` nếu
 *                    chưa map, `null`/`undefined` khi không có lỗi.
 * @param setError   `setError` lấy từ `useForm()` (hoặc từ `useFormPattern()`).
 * @param fieldMap   Map field BE (có thể snake_case) → tên field trong form, cho các
 *                    field mà `extractFieldErrors` chưa tự map hoặc cần đổi tên khác.
 * @param normalizeField  Hook điều chỉnh cuối cùng, dùng khi nhiều field BE phải gộp
 *                    về 1 field hiển thị trên form (vd nhiều field MST đều hiển thị
 *                    lỗi trên field `taxCode`).
 */
export function useApiFormErrors<T extends FieldValues>(
  apiErrors: Record<string, string> | null | undefined,
  setError: UseFormSetError<T>,
  fieldMap?: Partial<Record<string, string>>,
  normalizeField?: (field: string) => string,
) {
  useEffect(() => {
    if (!apiErrors) return;
    applyFieldErrorsToForm(apiErrors, setError, fieldMap, normalizeField);
  }, [apiErrors, setError, fieldMap, normalizeField]);
}

/**
 * Map lỗi validation server (HTTP 422 — `response.data.errors` root-level hoặc
 * `response.data.error.details` nested, xem `api-response.ts`) thẳng xuống
 * react-hook-form, gọi trực tiếp từ `catch` (vd trong `onSubmit` của
 * `useFormPattern`) — không cần đi vòng qua state `apiErrors` + prop + hook riêng.
 *
 * @example
 * ```tsx
 * const { control, submitForm, applyServerErrors } = useFormPattern({
 *   schema,
 *   onSubmit: async (data) => {
 *     try {
 *       await createDepartment(data);
 *     } catch (err) {
 *       applyServerErrors(err);
 *     }
 *   },
 * });
 * ```
 *
 * @param error     Lỗi bắt được (thường là `AxiosError` từ service call).
 * @param setError  `setError` lấy từ `useForm()`/`useFormPattern()`.
 * @param fieldMap  Xem `useApiFormErrors`.
 * @param normalizeField  Xem `useApiFormErrors`.
 * @returns `true` nếu có field error nào được set (để component tự quyết định có
 *          cần hiện thêm toast/alert tổng hay không), `false` nếu `error` không
 *          phải lỗi validation theo field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMap?: Partial<Record<string, string>>,
  normalizeField?: (field: string) => string,
): boolean {
  const fieldErrors = extractFieldErrors(error);
  if (!fieldErrors) return false;
  applyFieldErrorsToForm(fieldErrors, setError, fieldMap, normalizeField);
  return true;
}
