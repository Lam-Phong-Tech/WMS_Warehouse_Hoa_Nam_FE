import { describe, it, expect } from 'vitest';
import { isContextScopedQuery } from '@/modules/auth/hooks/use-switch-context';

// P2: sau switch-context, chỉ invalidate các query phụ thuộc data-scope
// (org_unit/department/warehouse) của context hiện tại — domain đã xác nhận
// context-independent (audit-logs) được giữ nguyên cache.
describe('isContextScopedQuery', () => {
  it('audit-logs không bị invalidate vì không lọc theo data-scope', () => {
    expect(isContextScopedQuery(['audit-logs'])).toBe(false);
    expect(isContextScopedQuery(['audit-logs', { page: 1 }])).toBe(false);
  });

  it('domain chưa được xác nhận vẫn bị invalidate theo mặc định an toàn', () => {
    expect(isContextScopedQuery(['employees'])).toBe(true);
    expect(isContextScopedQuery(['departments', 'list'])).toBe(true);
    expect(isContextScopedQuery(['org-units'])).toBe(true);
    expect(isContextScopedQuery(['roles'])).toBe(true);
    expect(isContextScopedQuery(['auth', 'me'])).toBe(true);
  });

  it('queryKey rỗng hoặc phần tử đầu không phải string vẫn bị invalidate', () => {
    expect(isContextScopedQuery([])).toBe(true);
    expect(isContextScopedQuery([123])).toBe(true);
  });
});
