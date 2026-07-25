import { z } from 'zod';
import dayjs from 'dayjs';
import { EmployeeStatus } from '../types/employees.types';
import {
  EMAIL_REGEX,
  EMAIL_MAX_LENGTH,
  EMAIL_LOCAL_PART_MAX_LENGTH,
  PHONE_REGEX,
  PHONE_MAX_LENGTH,
} from '@/shared/constants/validation.constants';

/**
 * Schema validate nhân sự theo BRD Module 1 — Phụ lục C (mục 4).
 * - Tất cả trường bắt buộc: họ tên, mã NV, SĐT, email, địa chỉ, giới tính, ngày sinh, CCCD/CMND, phòng ban, đơn vị, người quản lý
 * - personalTaxCode: Không bắt buộc (cho phép bổ sung sau), 10 chữ số nếu nhập, duy nhất
 * - CCCD: 12 chữ số (CCCD) hoặc 9 chữ số (CMND cũ), duy nhất toàn hệ thống
 * - SĐT/Email: duy nhất trong cùng tenant/công ty (BE validate)
 * - Ngày sinh: ngày trong quá khứ, tuổi >= tuổi lao động tối thiểu (18)
 * - Email: bắt buộc phải là địa chỉ @gmail.com
 * - SĐT: fix cứng tối đa 10 ký tự, đầu số hợp lệ 03/05/07/08/09 (0xxxxxxxxx)
 */
export const employeeSchema = z
  .object({
    code: z.string().optional(),
    fullName: z.string().min(1, 'Vui lòng nhập họ và tên'),
    email: z
      .string()
      .min(1, 'Vui lòng nhập email')
      .max(
        EMAIL_MAX_LENGTH,
        `Email không được vượt quá ${EMAIL_MAX_LENGTH} ký tự`,
      )
      .refine((val) => {
        const atIndex = val.indexOf('@');
        return atIndex <= EMAIL_LOCAL_PART_MAX_LENGTH;
      }, `Phần trước @ không được vượt quá ${EMAIL_LOCAL_PART_MAX_LENGTH} ký tự`)
      .refine(
        (val) => !val.includes('..'),
        'Email không được chứa dấu chấm liên tiếp',
      )
      .refine((val) => {
        const atIndex = val.indexOf('@');
        const localPart = val.slice(0, atIndex);
        return !localPart.startsWith('.') && !localPart.endsWith('.');
      }, 'Email không được bắt đầu hoặc kết thúc bằng dấu chấm')
      .regex(
        EMAIL_REGEX,
        'Email không hợp lệ, chỉ chấp nhận địa chỉ @gmail.com',
      ),
    phone: z
      .string()
      .min(1, 'Vui lòng nhập số điện thoại')
      .refine(
        (val) => val.replace(/[\s\-().]/g, '').length <= PHONE_MAX_LENGTH,
        `Số điện thoại không được vượt quá ${PHONE_MAX_LENGTH} ký tự`,
      )
      .refine(
        (val) => PHONE_REGEX.test(val.replace(/[\s\-().]/g, '')),
        'Số điện thoại không hợp lệ (định dạng: 0xxxxxxxxx, đầu số 03/05/07/08/09)',
      ),
    gender: z.union([z.number(), z.null()]).optional(),
    birthday: z
      .custom<dayjs.Dayjs | null>((val) => val === null || dayjs.isDayjs(val))
      .nullable()
      .optional(),
    cccd: z
      .string()
      .min(1, 'Vui lòng nhập CCCD/CMND')
      .regex(
        /^(?:\d{9}|\d{12})$/,
        'CCCD/CMND phải có 9 chữ số (CMND cũ) hoặc 12 chữ số (CCCD)',
      ),
    /**
     * Mã số thuế cá nhân — không bắt buộc theo BRD. Nếu nhập thì phải đúng 10 chữ số.
     */
    personalTaxCode: z
      .string()
      .optional()
      .refine((val) => {
        if (!val || val.trim() === '') return true;
        return /^\d{10}$/.test(val);
      }, 'MST cá nhân phải có đúng 10 chữ số'),
    address: z.string().min(1, 'Vui lòng nhập địa chỉ'),
    orgUnitId: z.union([z.number(), z.null()]).optional(),
    departmentId: z.union([z.number(), z.null()]).optional(),
    positionId: z.union([z.number(), z.null()]).optional(),
    managerId: z.union([z.number(), z.null()]).optional(),
    hireDate: z
      .custom<dayjs.Dayjs | null>((val) => val === null || dayjs.isDayjs(val))
      .nullable()
      .optional(),
    active: z.boolean(),
    employeeStatus: z.nativeEnum(EmployeeStatus).nullable().optional(),
    /**
     * Mật khẩu cấp tài khoản đăng nhập — chỉ dùng khi tạo mới.
     * Xác minh thật qua Swagger + BE (astrodev.test8.io.vn, 2026-07-05):
     * POST /employees nhận kèm `password` sẽ tạo nhân sự + tài khoản đăng nhập
     * ATOMIC trong cùng 1 request (response trả `user_id`/`account_status`
     * ngay lập tức, login thử thành công) — thay cho luồng cũ gọi riêng
     * POST /employees/{id}/account sau khi tạo xong (không transactional).
     * Không validate bắt buộc trong zod vì chỉ áp dụng lúc tạo mới — required
     * + độ mạnh mật khẩu được kiểm tra ở UI (EmployeeFormModal), giống cách
     * CreateAccountModal đã làm trước đây.
     */
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Giới tính bắt buộc
    if (data.gender == null)
      ctx.addIssue({
        code: 'custom',
        path: ['gender'],
        message: 'Vui lòng chọn giới tính',
      });

    // Ngày sinh bắt buộc
    if (data.birthday == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthday'],
        message: 'Vui lòng chọn ngày sinh',
      });
    } else {
      // Validate ngày sinh trong quá khứ và tuổi >= 18
      const birthDate = data.birthday.toDate();
      const now = new Date();
      if (birthDate >= now) {
        ctx.addIssue({
          code: 'custom',
          path: ['birthday'],
          message: 'Ngày sinh phải là ngày trong quá khứ',
        });
      } else {
        let age = now.getFullYear() - birthDate.getFullYear();
        const monthDiff = now.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && now.getDate() < birthDate.getDate())
        ) {
          age--;
        }
        if (age < 18) {
          ctx.addIssue({
            code: 'custom',
            path: ['birthday'],
            message: 'Tuổi phải >= 18 (tuổi lao động tối thiểu)',
          });
        }
      }
    }

    // Đơn vị bắt buộc
    if (data.orgUnitId == null)
      ctx.addIssue({
        code: 'custom',
        path: ['orgUnitId'],
        message: 'Vui lòng chọn đơn vị',
      });

    // Phòng ban bắt buộc
    if (data.departmentId == null)
      ctx.addIssue({
        code: 'custom',
        path: ['departmentId'],
        message: 'Vui lòng chọn phòng ban',
      });

    // Chức vụ bắt buộc
    if (data.positionId == null)
      ctx.addIssue({
        code: 'custom',
        path: ['positionId'],
        message: 'Vui lòng chọn chức vụ',
      });

    // Người quản lý bắt buộc
    if (data.managerId == null)
      ctx.addIssue({
        code: 'custom',
        path: ['managerId'],
        message: 'Vui lòng chọn người quản lý',
      });

    // Trạng thái nhân viên bắt buộc
    if (data.employeeStatus == null)
      ctx.addIssue({
        code: 'custom',
        path: ['employeeStatus'],
        message: 'Vui lòng chọn trạng thái',
      });
  });

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
