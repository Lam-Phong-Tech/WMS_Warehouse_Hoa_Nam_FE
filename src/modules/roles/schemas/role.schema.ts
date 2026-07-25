import { z } from 'zod';

export const roleSchema = z.object({
  code: z.string().min(1, 'Mã vai trò là bắt buộc'),
  name: z.string().min(1, 'Tên vai trò là bắt buộc'),
  description: z.string().optional(),
  type: z.enum(['co_dinh', 'linh_hoat']).optional(),
  status: z.number().int().positive('Trạng thái không hợp lệ'),
});

export type RoleFormValues = z.infer<typeof roleSchema>;
