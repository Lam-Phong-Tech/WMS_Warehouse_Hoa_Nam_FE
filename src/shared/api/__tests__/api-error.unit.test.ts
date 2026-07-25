/**
 * Unit test cho api-error.ts
 *
 * Cách chạy test này:
 * 1. Tạm thời comment setupFiles trong vite.config.ts
 * 2. Chạy: npx vitest run src/shared/api/__tests__/api-error.unit.test.ts
 * 3. Hoặc chạy toàn bộ suite: npx vitest run (sau khi fix setup.ts)
 */

import { describe, it, expect } from 'vitest';
import { getApiErrorMessage, createMockAxiosError } from '../api-error';

describe('api-error.unit', () => {
  it('should extract BE message', () => {
    const error = createMockAxiosError({
      status: 400,
      data: { message: 'Lỗi từ BE' },
    });
    expect(getApiErrorMessage(error)).toBe('Lỗi từ BE');
  });

  it('should extract error_code', () => {
    const error = createMockAxiosError({
      status: 400,
      data: { error_code: 'VALIDATION_ERROR' },
    });
    expect(getApiErrorMessage(error)).toBe('VALIDATION_ERROR');
  });

  it('should extract nested error.code', () => {
    const error = createMockAxiosError({
      status: 500,
      data: { error: { code: 'INTERNAL_ERROR' } },
    });
    expect(getApiErrorMessage(error)).toBe('INTERNAL_ERROR');
  });

  it('should extract field errors', () => {
    const error = createMockAxiosError({
      status: 422,
      data: {
        errors: {
          email: ['Email không hợp lệ'],
          password: ['Mật khẩu quá ngắn'],
        },
      },
    });
    expect(getApiErrorMessage(error)).toBe(
      'email: Email không hợp lệ; password: Mật khẩu quá ngắn',
    );
  });

  it('should handle unknown error', () => {
    const error = createMockAxiosError({
      status: 500,
      data: {},
    });
    expect(getApiErrorMessage(error)).toBe('Lỗi hệ thống');
  });
});
