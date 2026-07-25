import { z } from 'zod';
import dayjs, { type Dayjs } from 'dayjs';

export const userSchema = z.object({
  code: z.string().min(1, 'Vui lòng nhập mã'),
  name: z.string().min(1, 'Vui lòng nhập tên'),
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  role: z.string().min(1, 'Vui lòng chọn vai trò'),
  salary: z
    .number({ message: 'Vui lòng nhập lương' })
    .min(0, 'Lương không hợp lệ'),
  joinedAt: z
    .custom<Dayjs>((v) => dayjs.isDayjs(v), 'Ngày không hợp lệ')
    .nullable()
    .optional(),
  note: z.string().optional(),
  active: z.boolean(),
});

export type UserFormValues = z.infer<typeof userSchema>;
