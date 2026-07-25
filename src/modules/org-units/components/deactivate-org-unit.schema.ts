import { z } from 'zod';
import type { Dayjs } from 'dayjs';

// Base schema without conditional fields
export const baseDeactivateOrgUnitSchema = z.object({
  mode: z.enum(['transfer', 'deactivate_only']),
  effectiveDate: z.custom<Dayjs | null>().optional(),
  reason: z.string().optional(),
  confirm14DayRule: z.boolean().refine((val) => val === true, {
    message: 'Bạn phải xác nhận đã đọc và hiểu quy định.',
  }),
});

// Schema for when there are employees to deactivate
export const deactivateWithEmployeesSchema = baseDeactivateOrgUnitSchema.extend(
  {
    confirmDeactivate: z.boolean().refine((val) => val === true, {
      message: 'Bạn phải xác nhận sẽ vô hiệu hóa nhân sự.',
    }),
  },
);

export type DeactivateOrgUnitFormValues = z.infer<
  typeof baseDeactivateOrgUnitSchema
> & {
  confirmDeactivate?: boolean;
};
