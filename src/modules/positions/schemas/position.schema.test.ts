import { describe, it, expect } from 'vitest';
import { positionSchema } from '@/modules/positions/schemas/position.schema';

describe('positionSchema', () => {
  const validBase = {
    code: 'nv01',
    name: 'Nhân viên',
    management_level: 1,
    active: true,
  };

  it('should accept valid values and uppercase the code', () => {
    const result = positionSchema.parse(validBase);
    expect(result.code).toBe('NV01');
  });

  it('should reject empty code', () => {
    expect(() => positionSchema.parse({ ...validBase, code: '' })).toThrow();
  });

  it('should reject code longer than 20 chars', () => {
    expect(() =>
      positionSchema.parse({ ...validBase, code: 'A'.repeat(21) }),
    ).toThrow();
  });

  it('should reject empty name', () => {
    expect(() => positionSchema.parse({ ...validBase, name: '' })).toThrow();
  });

  it('should reject name longer than 200 chars', () => {
    expect(() =>
      positionSchema.parse({ ...validBase, name: 'A'.repeat(201) }),
    ).toThrow();
  });

  it('should allow optional description and grade to be omitted', () => {
    const result = positionSchema.parse(validBase);
    expect(result.description).toBeUndefined();
    expect(result.grade).toBeUndefined();
  });

  it('should keep grade when provided', () => {
    const result = positionSchema.parse({ ...validBase, grade: 4 });
    expect(result.grade).toBe(4);
  });
});
