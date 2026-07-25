import { describe, it, expect } from 'vitest';
import {
  orgUnitSchema,
  validateParentId,
  getUnitDepth,
} from '@/modules/org-units/schemas/org-unit.schema';

describe('orgUnitSchema', () => {
  const validBase = {
    code: 'CTY-0001',
    name: 'Công ty mẹ ABC',
    unitType: 'cong_ty_me' as const,
    address: 'Số 1, Đường ABC, Hà Nội',
    active: true,
    taxCode: '0101234567',
  };

  describe('code validation', () => {
    it('should accept valid codes', () => {
      expect(
        orgUnitSchema.parse({ ...validBase, code: 'CTY-0001' }),
      ).toBeDefined();
      expect(
        orgUnitSchema.parse({ ...validBase, code: 'CN-001' }),
      ).toBeDefined();
      expect(
        orgUnitSchema.parse({ ...validBase, code: 'ABC_DEF' }),
      ).toBeDefined();
      expect(
        orgUnitSchema.parse({ ...validBase, code: 'A1B2C3' }),
      ).toBeDefined();
    });

    it('should reject invalid codes', () => {
      expect(() => orgUnitSchema.parse({ ...validBase, code: 'A' })).toThrow(); // Too short
      expect(() =>
        orgUnitSchema.parse({ ...validBase, code: 'A'.repeat(21) }),
      ).toThrow(); // Too long
      expect(() =>
        orgUnitSchema.parse({ ...validBase, code: 'abc-123' }),
      ).toThrow(); // Lowercase
      expect(() =>
        orgUnitSchema.parse({ ...validBase, code: 'CTY@123' }),
      ).toThrow(); // Invalid char
    });

    it('should allow empty code (async generation)', () => {
      expect(orgUnitSchema.parse({ ...validBase, code: '' })).toBeDefined();
    });
  });

  describe('unitType validation', () => {
    it('should accept valid unit types', () => {
      expect(
        orgUnitSchema.parse({ ...validBase, unitType: 'cong_ty_me' }),
      ).toBeDefined();
      expect(
        orgUnitSchema.parse({
          ...validBase,
          unitType: 'cong_ty_con',
          parentId: 1,
        }),
      ).toBeDefined();
      expect(
        orgUnitSchema.parse({
          ...validBase,
          unitType: 'chi_nhanh',
          parentId: 1,
          province: 'Hà Nội',
          ward: 'Phường Ba Đình',
        }),
      ).toBeDefined();
    });

    it('should reject invalid unit type', () => {
      expect(() =>
        orgUnitSchema.parse({ ...validBase, unitType: 'invalid' }),
      ).toThrow();
    });
  });

  describe('taxCode validation', () => {
    it('should accept valid MST (10-13 digits)', () => {
      expect(
        orgUnitSchema.parse({ ...validBase, taxCode: '0101234567' }),
      ).toBeDefined();
      expect(
        orgUnitSchema.parse({ ...validBase, taxCode: '0101234567890' }),
      ).toBeDefined();
    });

    it('should accept valid TMP codes', () => {
      const tmpExtra = {
        tmpCodeLocked: true,
        taxCodeStatus: 'pending',
        taxCodeDueDate: '2026-12-31',
      };
      expect(
        orgUnitSchema.parse({
          ...validBase,
          taxCode: 'TMP-ABC123',
          ...tmpExtra,
        }),
      ).toBeDefined();
      expect(
        orgUnitSchema.parse({
          ...validBase,
          taxCode: 'TMP-123456',
          ...tmpExtra,
        }),
      ).toBeDefined();
    });

    it('should reject invalid tax codes', () => {
      expect(() =>
        orgUnitSchema.parse({ ...validBase, taxCode: '12345' }),
      ).toThrow(); // Too short
      expect(() =>
        orgUnitSchema.parse({ ...validBase, taxCode: '01012345678901234' }),
      ).toThrow(); // Too long
      expect(() =>
        orgUnitSchema.parse({ ...validBase, taxCode: 'ABC123' }),
      ).toThrow(); // Not digits
    });

    it('should allow empty tax code for branches', () => {
      expect(
        orgUnitSchema.parse({
          ...validBase,
          unitType: 'chi_nhanh',
          parentId: 1,
          province: 'Hà Nội',
          ward: 'Phường Ba Đình',
          taxCode: '',
        }),
      ).toBeDefined();
    });
  });

  describe('parentId validation', () => {
    it('should reject parent for cong_ty_me', () => {
      expect(() => orgUnitSchema.parse({ ...validBase, parentId: 1 })).toThrow(
        'Công ty mẹ không được phép chọn đơn vị cha',
      );
    });

    it('should require parent for cong_ty_con and chi_nhanh', () => {
      expect(() =>
        orgUnitSchema.parse({
          ...validBase,
          unitType: 'cong_ty_con',
          parentId: null,
        }),
      ).toThrow('Vui lòng chọn đơn vị cha');
      expect(() =>
        orgUnitSchema.parse({
          ...validBase,
          unitType: 'chi_nhanh',
          parentId: null,
        }),
      ).toThrow('Vui lòng chọn đơn vị cha');
    });
  });

  describe('province/ward validation for branches', () => {
    it('should require province and ward for chi_nhanh', () => {
      expect(() =>
        orgUnitSchema.parse({
          ...validBase,
          unitType: 'chi_nhanh',
          parentId: 1,
          province: '',
          ward: '',
        }),
      ).toThrow('Chi nhánh bắt buộc chọn Tỉnh/Thành phố');
    });

    it('should skip requiring province/ward when addressMode is legacy', () => {
      expect(
        orgUnitSchema.parse({
          ...validBase,
          unitType: 'chi_nhanh',
          parentId: 1,
          province: '',
          ward: '',
          addressMode: 'legacy',
        }),
      ).toBeDefined();
    });
  });

  describe('email validation', () => {
    it('should accept valid gmail.com emails', () => {
      expect(
        orgUnitSchema.parse({ ...validBase, email: 'test@gmail.com' }),
      ).toBeDefined();
    });

    it('should reject non-gmail.com emails', () => {
      expect(() =>
        orgUnitSchema.parse({ ...validBase, email: 'test@example.com' }),
      ).toThrow();
    });

    it('should reject invalid emails', () => {
      expect(() =>
        orgUnitSchema.parse({ ...validBase, email: 'invalid' }),
      ).toThrow();
    });

    it('should allow empty string', () => {
      expect(orgUnitSchema.parse({ ...validBase, email: '' })).toBeDefined();
    });
  });

  describe('phone validation', () => {
    it('should accept valid phone numbers', () => {
      expect(
        orgUnitSchema.parse({ ...validBase, phone: '0912345678' }),
      ).toBeDefined();
    });

    it('should reject +84 international format', () => {
      expect(() =>
        orgUnitSchema.parse({ ...validBase, phone: '+84912345678' }),
      ).toThrow();
    });

    it('should reject invalid phone numbers', () => {
      expect(() =>
        orgUnitSchema.parse({ ...validBase, phone: '12345' }),
      ).toThrow();
      expect(() =>
        orgUnitSchema.parse({ ...validBase, phone: 'abc' }),
      ).toThrow();
    });
  });
});

describe('validateParentId', () => {
  const allUnits = [
    { id: 1, parentId: null, unitType: 'cong_ty_me' as const },
    { id: 2, parentId: 1, unitType: 'cong_ty_con' as const },
    { id: 3, parentId: 2, unitType: 'chi_nhanh' as const },
  ];

  it('should reject parent for cong_ty_me', () => {
    expect(validateParentId('cong_ty_me', 1, allUnits)).not.toBeNull();
  });

  it('should validate parent type for cong_ty_con', () => {
    expect(validateParentId('cong_ty_con', 1, allUnits)).toBeNull(); // OK: parent is cong_ty_me
    expect(validateParentId('cong_ty_con', 3, allUnits)).not.toBeNull(); // Error: parent is chi_nhanh
  });

  it('should validate parent type for chi_nhanh', () => {
    expect(validateParentId('chi_nhanh', 1, allUnits)).toBeNull(); // OK: parent is cong_ty_me
    expect(validateParentId('chi_nhanh', 2, allUnits)).toBeNull(); // OK: parent is cong_ty_con
    expect(validateParentId('chi_nhanh', 3, allUnits)).not.toBeNull(); // Error: parent is chi_nhanh
  });

  it('should prevent self-reference', () => {
    expect(validateParentId('cong_ty_con', 2, allUnits, 2)).not.toBeNull();
  });

  it('should enforce max hierarchy depth', () => {
    // Unit 3 is at depth 3 (cong_ty_me -> cong_ty_con -> chi_nhanh)
    // Cannot create another level under unit 3
    const deepUnit = { id: 3, parentId: 2, unitType: 'chi_nhanh' as const };
    expect(
      validateParentId('chi_nhanh', 3, [...allUnits, deepUnit]),
    ).not.toBeNull();
  });
});

describe('getUnitDepth', () => {
  const units = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 2 },
  ];

  it('should calculate depth correctly', () => {
    expect(getUnitDepth(1, units)).toBe(1);
    expect(getUnitDepth(2, units)).toBe(2);
    expect(getUnitDepth(3, units)).toBe(3);
  });

  it('should return 0 for null/undefined', () => {
    expect(getUnitDepth(null, units)).toBe(0);
    expect(getUnitDepth(undefined, units)).toBe(0);
  });

  it('should return 0 for non-existent unit', () => {
    expect(getUnitDepth(999, units)).toBe(0);
  });
});
