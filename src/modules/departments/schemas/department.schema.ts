import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Chuẩn hoá mã phòng ban: uppercase + strip ký tự không hợp lệ (A-Z, 0-9, _, -). */
export function normalizeDeptCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const departmentSchema = z
  .object({
    /**
     * Mã phòng ban: 2–20 ký tự, chỉ A-Z, 0-9, _ và -.
     * Form tự động uppercase khi nhập.
     */
    code: z
      .string()
      .min(2, 'Mã chỉ gồm chữ in hoa, số, dấu - hoặc _, dài 2–20 ký tự')
      .max(20, 'Mã chỉ gồm chữ in hoa, số, dấu - hoặc _, dài 2–20 ký tự')
      .regex(
        /^[A-Z0-9_-]+$/,
        'Mã chỉ gồm chữ in hoa, số, dấu - hoặc _, dài 2–20 ký tự',
      ),
    name: z
      .string()
      .min(1, 'Vui lòng nhập tên phòng ban')
      .max(200, 'Tên phòng ban tối đa 200 ký tự'),
    orgUnitId: z.number().nullable(),
    departmentType: z.enum(['phong_ban', 'nhom_to']),
    parentId: z.number().nullable().optional(),
    managerId: z.number().nullable().optional(),
    note: z.string().optional(),
    active: z.boolean(),
  })
  .refine((d) => d.orgUnitId !== null, {
    message: 'Vui lòng chọn đơn vị tổ chức',
    path: ['orgUnitId'],
  })
  .refine((d) => d.departmentType !== 'nhom_to' || d.parentId != null, {
    message: 'Nhóm/tổ phải thuộc về một phòng ban cha',
    path: ['parentId'],
  });

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
