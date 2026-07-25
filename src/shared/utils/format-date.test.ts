import { describe, expect, it } from 'vitest';
import { formatDate } from '@/shared/utils/format-date';

describe('formatDate', () => {
  it('định dạng ngày theo locale vi-VN (dd/mm/yyyy)', () => {
    expect(formatDate('2026-06-22')).toBe('22/6/2026');
  });
});
