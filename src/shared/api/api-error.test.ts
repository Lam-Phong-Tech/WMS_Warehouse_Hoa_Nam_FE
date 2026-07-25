/**
 * Unit test cho api-error.ts
 *
 * NOTE: File này cần chạy với `--no-coverage` và `--reporter=basic` để tránh
 * vấn đề với antd mock trong setup.ts:
 *   npx vitest run src/shared/api/api-error.test.ts --no-coverage --reporter=basic
 *
 * Hoặc tạm thời comment dòng `setupFiles: './src/test/setup.ts'` trong vite.config.ts
 * khi chạy test này.
 */

import { describe, it, expect } from 'vitest';
import { getApiErrorMessage, createMockAxiosError } from './api-error';

describe('api-error', () => {
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
