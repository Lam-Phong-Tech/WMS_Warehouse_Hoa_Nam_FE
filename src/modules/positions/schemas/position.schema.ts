import { z } from 'zod';

export const PositionLevel = {
  LEVEL_1: 1,
  LEVEL_2: 2,
  TEAM_LEAD: 3,
  DEPARTMENT_MANAGER: 4,
  BRANCH_RESPONSIBLE: 5,
  COMPANY_REPRESENTATIVE: 6,
  LEVEL_7: 7,
} as const;

export type PositionLevel = (typeof PositionLevel)[keyof typeof PositionLevel];

export const positionSchema = z.object({
  code: z
    .string()
    .min(1, 'Vui lòng nhập mã')
    .transform((val) => val.toUpperCase())
    .pipe(z.string().max(20, 'Mã không được vượt quá 20 ký tự')),
  name: z
    .string()
    .min(1, 'Vui lòng nhập tên')
    .max(200, 'Tên chức danh không được vượt quá 200 ký tự'),
  management_level: z
    .number()
    .int('Cấp quản lý phải là số nguyên')
    .min(1, 'Cấp quản lý phải từ 1 đến 7')
    .max(7, 'Cấp quản lý phải từ 1 đến 7'),
  description: z.string().optional(),
  grade: z.number().optional(),
  active: z.boolean(),
});

export type PositionFormValues = z.infer<typeof positionSchema>;
