import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { employeeSchema } from './employee.schema';
import { EmployeeStatus } from '@/modules/employees/types/employees.types';

const validPayload = {
  code: 'NV001',
  fullName: 'Nguyễn Văn A',
  email: 'a@gmail.com',
  phone: '0987654321',
  gender: 1,
  birthday: dayjs('1990-01-01'),
  cccd: '123456789',
  address: 'Hà Nội',
  orgUnitId: 1,
  departmentId: 1,
  positionId: 1,
  managerId: 1,
  hireDate: dayjs('2020-01-01'),
  active: true,
  employeeStatus: EmployeeStatus.OFFICIAL,
};

describe('employeeSchema', () => {
  describe('P0.1: required fields validation', () => {
    it('should pass for valid payload', () => {
      const result = employeeSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should pass if code is empty (auto-generate)', () => {
      const result = employeeSchema.safeParse({ ...validPayload, code: '' });
      expect(result.success).toBe(true);
    });

    it('should fail if fullName is empty', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        fullName: '',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Vui lòng nhập họ và tên');
    });

    it('should fail if email is invalid', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        email: 'invalid',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Email không hợp lệ');
    });

    it('should fail if phone is empty', () => {
      const result = employeeSchema.safeParse({ ...validPayload, phone: '' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        'Vui lòng nhập số điện thoại',
      );
    });

    it('should fail if phone is invalid', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        phone: '123',
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues[0].message.includes('Số điện thoại không hợp lệ'),
      ).toBe(true);
    });

    it('should fail if phone has wrong format', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        phone: 'abc',
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues[0].message.includes('Số điện thoại không hợp lệ'),
      ).toBe(true);
    });

    it('should pass for valid phone numbers', () => {
      expect(
        employeeSchema.safeParse({ ...validPayload, phone: '0987654321' })
          .success,
      ).toBe(true);
    });

    it('should fail for +84 international format', () => {
      expect(
        employeeSchema.safeParse({ ...validPayload, phone: '+84987654321' })
          .success,
      ).toBe(false);
    });

    it('should fail if gender is null', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        gender: null,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues.some((i) => i.path.includes('gender'))).toBe(
        true,
      );
    });

    it('should fail if birthday is null', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        birthday: null,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some((i) => i.path.includes('birthday')),
      ).toBe(true);
    });

    it('should fail if address is empty', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        address: '',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Vui lòng nhập địa chỉ');
    });

    it('should fail if orgUnitId is null', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        orgUnitId: null,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some((i) => i.path.includes('orgUnitId')),
      ).toBe(true);
    });

    it('should fail if departmentId is null', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        departmentId: null,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some((i) => i.path.includes('departmentId')),
      ).toBe(true);
    });

    it('should fail if positionId is null', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        positionId: null,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some((i) => i.path.includes('positionId')),
      ).toBe(true);
    });

    it('should fail if managerId is null', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        managerId: null,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some((i) => i.path.includes('managerId')),
      ).toBe(true);
    });
  });

  describe('P0.1: cccd validation', () => {
    it('should fail if cccd is empty', () => {
      const result = employeeSchema.safeParse({ ...validPayload, cccd: '' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Vui lòng nhập CCCD/CMND');
    });

    it('should fail if cccd is not 9 or 12 digits', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        cccd: '12345678',
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues[0].message.includes('CCCD/CMND phải có'),
      ).toBe(true);
    });

    it('should pass for valid 9-digit cccd', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        cccd: '123456789',
      });
      expect(result.success).toBe(true);
    });

    it('should pass for valid 12-digit cccd', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        cccd: '123456789012',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('P0.2: employeeStatus numeric validation', () => {
    it('should accept valid EmployeeStatus values', () => {
      const statuses = [
        EmployeeStatus.INTERN,
        EmployeeStatus.PROBATION,
        EmployeeStatus.OFFICIAL,
        EmployeeStatus.SUSPENDED,
        EmployeeStatus.RESIGNED,
      ];
      for (const s of statuses) {
        const result = employeeSchema.safeParse({
          ...validPayload,
          employeeStatus: s,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid employeeStatus values', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        employeeStatus: 999,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('P1: Fix cứng email chỉ chấp nhận @gmail.com', () => {
    it('should accept valid Gmail addresses', () => {
      expect(
        employeeSchema.safeParse({ ...validPayload, email: 'user@gmail.com' })
          .success,
      ).toBe(true);
      expect(
        employeeSchema.safeParse({
          ...validPayload,
          email: 'user.name@gmail.com',
        }).success,
      ).toBe(true);
      expect(
        employeeSchema.safeParse({
          ...validPayload,
          email: 'user+tag@gmail.com',
        }).success,
      ).toBe(true);
    });

    it('should reject non-gmail.com domains', () => {
      expect(
        employeeSchema.safeParse({
          ...validPayload,
          email: 'user@company.com.vn',
        }).success,
      ).toBe(false);
      expect(
        employeeSchema.safeParse({ ...validPayload, email: 'user@company.vn' })
          .success,
      ).toBe(false);
      expect(
        employeeSchema.safeParse({
          ...validPayload,
          email: 'user.name@outlook.com',
        }).success,
      ).toBe(false);
    });

    it('should reject email with local part exceeding max length', () => {
      const longEmail = 'a'.repeat(65) + '@gmail.com';
      const result = employeeSchema.safeParse({
        ...validPayload,
        email: longEmail,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('64 ký tự');
    });

    it('should reject email with consecutive dots', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        email: 'user..name@gmail.com',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('dấu chấm liên tiếp');
    });

    it('should reject email starting with dot', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        email: '.user@gmail.com',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain(
        'bắt đầu hoặc kết thúc',
      );
    });

    it('should reject email ending with dot', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        email: 'user.@gmail.com',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain(
        'bắt đầu hoặc kết thúc',
      );
    });

    it('should reject common typos of gmail.com', () => {
      const typoTests = ['user@gmai.com', 'user@gmal.com', 'user@gamil.com'];

      typoTests.forEach((email) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          email,
        });
        expect(result.success).toBe(false);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@gmail.com',
        'user@.com',
        'user@com',
        'user @gmail.com',
        'user@domain',
      ];

      invalidEmails.forEach((email) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          email,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('P1: Fix cứng SĐT tối đa 10 ký tự, đầu số 03/05/07/08/09', () => {
    it('should accept valid mobile numbers with modern prefixes', () => {
      const validPhones = [
        '0987654321', // 09
        '0912345678', // 09
        '0901234567', // 09
        '0321234567', // 03
        '0551234567', // 05
        '0701234567', // 07
        '0811234567', // 08
      ];

      validPhones.forEach((phone) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          phone,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject +84 international format and landline numbers', () => {
      const invalidPhones = [
        '+84987654321',
        '02412345678', // Hanoi landline
        '02812345678', // HCMC landline
      ];

      invalidPhones.forEach((phone) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          phone,
        });
        expect(result.success).toBe(false);
      });
    });

    it('should reject phone numbers with invalid length', () => {
      const invalidPhones = [
        '098765432', // 9 digits
        '09876543212', // 11 digits
      ];

      invalidPhones.forEach((phone) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          phone,
        });
        expect(result.success).toBe(false);
      });
    });

    it('should reject phone numbers with invalid prefixes', () => {
      const invalidPhones = [
        '0101234567', // Invalid prefix (old format)
        '0601234567', // Invalid prefix
        '0111234567', // Invalid prefix
        '0151234567', // Invalid prefix
      ];

      invalidPhones.forEach((phone) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          phone,
        });
        expect(result.success).toBe(false);
      });
    });

    it('should accept phone numbers with formatting characters', () => {
      const formattedPhones = [
        '098 765 4321',
        '098-765-4321',
        '098.765.4321',
        '(098) 765 4321',
      ];

      formattedPhones.forEach((phone) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          phone,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject non-numeric phone numbers', () => {
      const invalidPhones = ['abc', '09abc', 'phone', '098765432a'];

      invalidPhones.forEach((phone) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          phone,
        });
        expect(result.success).toBe(false);
      });
    });

    it('should reject phone numbers not starting with 0', () => {
      const invalidPhones = ['987654321', '84987654321', '1234567890'];

      invalidPhones.forEach((phone) => {
        const result = employeeSchema.safeParse({
          ...validPayload,
          phone,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('P0.1: personalTaxCode validation (BRD optional field)', () => {
    it('should pass when personalTaxCode is empty', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        personalTaxCode: '',
      });
      expect(result.success).toBe(true);
    });

    it('should pass when personalTaxCode is 10 digits', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        personalTaxCode: '1234567890',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when personalTaxCode has fewer than 10 digits', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        personalTaxCode: '12345',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        'MST cá nhân phải có đúng 10 chữ số',
      );
    });

    it('should fail when personalTaxCode has letters', () => {
      const result = employeeSchema.safeParse({
        ...validPayload,
        personalTaxCode: '12345abcde',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        'MST cá nhân phải có đúng 10 chữ số',
      );
    });
  });

  describe('P0.1: birthday age validation (minimum working age 18)', () => {
    it('should fail if birthday is in the future', () => {
      const futureDate = dayjs().add(1, 'year');
      const result = employeeSchema.safeParse({
        ...validPayload,
        birthday: futureDate,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some((i) =>
          i.message.includes('Ngày sinh phải là ngày trong quá khứ'),
        ),
      ).toBe(true);
    });

    it('should fail if age is under 18', () => {
      const youngDate = dayjs().subtract(17, 'year');
      const result = employeeSchema.safeParse({
        ...validPayload,
        birthday: youngDate,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some((i) => i.message.includes('Tuổi phải >= 18')),
      ).toBe(true);
    });

    it('should pass if age is exactly 18', () => {
      const exactDate = dayjs().subtract(18, 'year');
      const result = employeeSchema.safeParse({
        ...validPayload,
        birthday: exactDate,
      });
      expect(result.success).toBe(true);
    });
  });
});
