import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhone,
  normalizePhone,
  formatPhone,
  EMAIL_REGEX,
  PHONE_REGEX,
} from './validation.constants';

describe('Validation Constants', () => {
  describe('validateEmail', () => {
    it('should accept valid Gmail addresses', () => {
      expect(validateEmail('user@gmail.com').isValid).toBe(true);
      expect(validateEmail('user.name@gmail.com').isValid).toBe(true);
      expect(validateEmail('user+tag@gmail.com').isValid).toBe(true);
    });

    it('should reject non-Gmail domains', () => {
      expect(validateEmail('user@company.com.vn').isValid).toBe(false);
      expect(validateEmail('user@outlook.com').isValid).toBe(false);
      expect(validateEmail('user@yahoo.com').isValid).toBe(false);
    });

    it('should reject email with local part exceeding max length', () => {
      const longEmail = 'a'.repeat(65) + '@gmail.com';
      expect(validateEmail(longEmail).isValid).toBe(false);
      expect(validateEmail(longEmail).errorMessage).toContain('64 ký tự');
    });

    it('should reject email with consecutive dots', () => {
      expect(validateEmail('user..name@gmail.com').isValid).toBe(false);
      expect(validateEmail('user..name@gmail.com').errorMessage).toContain(
        'dấu chấm liên tiếp',
      );
    });

    it('should reject email starting with dot', () => {
      expect(validateEmail('.user@gmail.com').isValid).toBe(false);
    });

    it('should reject email ending with dot', () => {
      expect(validateEmail('user.@gmail.com').isValid).toBe(false);
    });

    it('should reject common typos of gmail.com', () => {
      expect(validateEmail('user@gmai.com').isValid).toBe(false);
      expect(validateEmail('user@gmal.com').isValid).toBe(false);
    });

    it('should reject invalid formats', () => {
      expect(validateEmail('invalid').isValid).toBe(false);
      expect(validateEmail('invalid@').isValid).toBe(false);
      expect(validateEmail('@gmail.com').isValid).toBe(false);
      expect(validateEmail('user@.com').isValid).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should accept valid mobile numbers with modern prefixes', () => {
      expect(validatePhone('0987654321').isValid).toBe(true); // Viettel (09)
      expect(validatePhone('0912345678').isValid).toBe(true); // 09
      expect(validatePhone('0901234567').isValid).toBe(true); // 09
      expect(validatePhone('0321234567').isValid).toBe(true); // 03
      expect(validatePhone('0551234567').isValid).toBe(true); // 05
      expect(validatePhone('0701234567').isValid).toBe(true); // 07
      expect(validatePhone('0811234567').isValid).toBe(true); // 08
    });

    it('should reject +84 international format', () => {
      expect(validatePhone('+84987654321').isValid).toBe(false);
    });

    it('should reject landline numbers', () => {
      expect(validatePhone('02412345678').isValid).toBe(false); // Hanoi
      expect(validatePhone('02812345678').isValid).toBe(false); // HCMC
    });

    it('should reject phone numbers with invalid length', () => {
      expect(validatePhone('098765432').isValid).toBe(false); // 9 digits
      expect(validatePhone('09876543212').isValid).toBe(false); // 11 digits
    });

    it('should reject phone numbers with invalid prefixes', () => {
      expect(validatePhone('0101234567').isValid).toBe(false);
      expect(validatePhone('0601234567').isValid).toBe(false);
    });

    it('should accept phone numbers with formatting characters', () => {
      expect(validatePhone('098 765 4321').isValid).toBe(true);
      expect(validatePhone('098-765-4321').isValid).toBe(true);
      expect(validatePhone('098.765.4321').isValid).toBe(true);
      expect(validatePhone('(098) 765 4321').isValid).toBe(true);
    });

    it('should reject non-numeric phone numbers', () => {
      expect(validatePhone('abc').isValid).toBe(false);
      expect(validatePhone('09abc').isValid).toBe(false);
      expect(validatePhone('098765432a').isValid).toBe(false);
    });

    it('should reject phone numbers not starting with 0', () => {
      expect(validatePhone('987654321').isValid).toBe(false);
      expect(validatePhone('84987654321').isValid).toBe(false);
    });
  });

  describe('normalizePhone', () => {
    it('should remove formatting characters', () => {
      expect(normalizePhone('098-765-4321')).toBe('0987654321');
      expect(normalizePhone('098 765 4321')).toBe('0987654321');
    });

    it('should keep 0 prefix', () => {
      expect(normalizePhone('0987654321')).toBe('0987654321');
    });
  });

  describe('formatPhone', () => {
    it('should format 10-digit phone numbers', () => {
      expect(formatPhone('0987654321')).toBe('0987-654-321');
    });

    it('should handle already formatted numbers', () => {
      expect(formatPhone('0987-654-321')).toBe('0987-654-321');
    });
  });

  describe('Regex patterns', () => {
    it('EMAIL_REGEX should only accept gmail.com', () => {
      expect(EMAIL_REGEX.test('user@gmail.com')).toBe(true);
      expect(EMAIL_REGEX.test('user@example.com')).toBe(false);
      expect(EMAIL_REGEX.test('invalid')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
    });

    it('PHONE_REGEX should validate correctly', () => {
      expect(PHONE_REGEX.test('0987654321')).toBe(true);
      expect(PHONE_REGEX.test('+84987654321')).toBe(false);
      expect(PHONE_REGEX.test('123456789')).toBe(false);
      expect(PHONE_REGEX.test('987654321')).toBe(false);
    });
  });
});
