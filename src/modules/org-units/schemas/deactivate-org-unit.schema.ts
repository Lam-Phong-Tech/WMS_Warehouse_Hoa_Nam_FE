import { z } from 'zod';
import dayjs from 'dayjs';

export const baseDeactivateOrgUnitSchema = z.object({
  mode: z.literal('deactivate_only'),
  effectiveDate: z.custom<dayjs.Dayjs | null>(
    (val) => val === null || dayjs.isDayjs(val),
    {
      message: 'Ngày hiệu lực không hợp lệ',
    },
  ),
  reason: z.string().max(500, 'Lý do không được vượt quá 500 ký tự').optional(),
  confirm14DayRule: z.literal(true, {
    message: 'Bạn phải xác nhận quy định xóa mềm 14 ngày.',
  }),
  confirmDeactivate: z.boolean().optional(),
});

export const deactivateWithEmployeesSchema = baseDeactivateOrgUnitSchema.extend(
  {
    confirmDeactivate: z.literal(true, {
      message: 'Bạn phải xác nhận việc vô hiệu hóa nhân sự.',
    }),
  },
);
