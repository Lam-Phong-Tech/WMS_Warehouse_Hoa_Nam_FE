import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test riêng cho response interceptor trong axios.ts (401/403/422/409),
 * đặc biệt case PASSWORD_CHANGE_REQUIRED (403 nhưng không đánh dấu
 * _isNoPermission, mà redirect sang /change-password).
 *
 * Interceptor không export riêng nên test lấy trực tiếp qua
 * `api.interceptors.response` (axios lưu handler đã `use()` trong mảng nội
 * bộ `handlers`) thay vì gọi HTTP thật.
 */

const { logoutMock, clearStorageMock, setStateMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  clearStorageMock: vi.fn(),
  setStateMock: vi.fn(),
}));

vi.mock('@/shared/store/auth.store', () => ({
  useAuthStore: {
    getState: () => ({ logout: logoutMock }),
    persist: { clearStorage: clearStorageMock },
    setState: setStateMock,
  },
}));

const { memoryStorageMock } = vi.hoisted(() => ({
  memoryStorageMock: { getToken: vi.fn(() => null), setItem: vi.fn() },
}));

vi.mock('@/shared/lib/memory-storage', () => ({
  memoryStorage: memoryStorageMock,
}));

import { api } from '@/shared/api/axios';
import { ROUTES } from '@/shared/constants/routes';
import { API_ENDPOINTS } from '@/shared/api/endpoints';

function getRejectedHandler() {
  const handlers = (
    api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<never> }>;
    }
  ).handlers;
  const handler = handlers.find((h) => h?.rejected);
  if (!handler) throw new Error('Không tìm thấy response interceptor');
  return handler.rejected;
}

function makeError(status: number, data: unknown = {}) {
  return {
    isAxiosError: true,
    response: { status, data },
  } as {
    isAxiosError: boolean;
    response: { status: number; data: unknown };
    _isNoPermission?: boolean;
    _isValidationError?: boolean;
    _isConflictError?: boolean;
  };
}

describe('axios response interceptor', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    logoutMock.mockReset();
    clearStorageMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/employees', assign: vi.fn() },
    });
  });

  it('401: logout, clear storage, redirect về /login', async () => {
    const rejected = getRejectedHandler();
    const error = makeError(401);

    await expect(rejected(error)).rejects.toBe(error);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(clearStorageMock).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(ROUTES.LOGIN);
  });

  it('401: không redirect lặp nếu đã ở /login', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: ROUTES.LOGIN, assign: vi.fn() },
    });
    const rejected = getRejectedHandler();
    const error = makeError(401);

    await expect(rejected(error)).rejects.toBe(error);
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('403 thường: đánh dấu _isNoPermission, không redirect', async () => {
    const rejected = getRejectedHandler();
    const error = makeError(403, { message: 'Không có quyền' });

    await expect(rejected(error)).rejects.toBe(error);
    expect(error._isNoPermission).toBe(true);
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('403 PASSWORD_CHANGE_REQUIRED (root-level error_code): redirect /change-password, không đánh dấu _isNoPermission', async () => {
    const rejected = getRejectedHandler();
    const error = makeError(403, { error_code: 'PASSWORD_CHANGE_REQUIRED' });

    await expect(rejected(error)).rejects.toBe(error);
    expect(window.location.assign).toHaveBeenCalledWith(ROUTES.CHANGE_PASSWORD);
    expect(error._isNoPermission).toBeUndefined();
  });

  it('403 PASSWORD_CHANGE_REQUIRED (nested error.code): redirect /change-password', async () => {
    const rejected = getRejectedHandler();
    const error = makeError(403, {
      error: { code: 'PASSWORD_CHANGE_REQUIRED' },
    });

    await expect(rejected(error)).rejects.toBe(error);
    expect(window.location.assign).toHaveBeenCalledWith(ROUTES.CHANGE_PASSWORD);
  });

  it('403 PASSWORD_CHANGE_REQUIRED: không redirect lặp nếu đã ở /change-password (rơi xuống nhánh _isNoPermission)', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: ROUTES.CHANGE_PASSWORD,
        assign: vi.fn(),
      },
    });
    const rejected = getRejectedHandler();
    const error = makeError(403, { error_code: 'PASSWORD_CHANGE_REQUIRED' });

    await expect(rejected(error)).rejects.toBe(error);
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(error._isNoPermission).toBe(true);
  });

  it('422: đánh dấu _isValidationError', async () => {
    const rejected = getRejectedHandler();
    const error = makeError(422, { errors: { name: ['bắt buộc'] } });

    await expect(rejected(error)).rejects.toBe(error);
    expect(error._isValidationError).toBe(true);
  });

  it('409: đánh dấu _isConflictError', async () => {
    const rejected = getRejectedHandler();
    const error = makeError(409, { message: 'Trùng dữ liệu' });

    await expect(rejected(error)).rejects.toBe(error);
    expect(error._isConflictError).toBe(true);
  });

  it('lỗi khác (5xx): không đánh dấu cờ nào, reject nguyên trạng', async () => {
    const rejected = getRejectedHandler();
    const error = makeError(500);

    await expect(rejected(error)).rejects.toBe(error);
    expect(error._isNoPermission).toBeUndefined();
    expect(error._isValidationError).toBeUndefined();
    expect(error._isConflictError).toBeUndefined();
  });
});

function makeErrorWithConfig(
  status: number,
  url: string,
  data: unknown = {},
  extra: Partial<{ _isRetryAfterRefresh: boolean }> = {},
) {
  return {
    isAxiosError: true,
    response: { status, data },
    config: { url, headers: {}, ...extra },
  } as {
    isAxiosError: boolean;
    response: { status: number; data: unknown };
    config: {
      url: string;
      headers: Record<string, string>;
      _isRetryAfterRefresh?: boolean;
    };
  };
}

describe('axios response interceptor: 401 refresh flow', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    logoutMock.mockReset();
    clearStorageMock.mockReset();
    setStateMock.mockReset();
    memoryStorageMock.setItem.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/employees', assign: vi.fn() },
    });
  });

  it('refresh thành công → retry request gốc với Authorization header mới', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          access_token: 'new-token',
          token_type: 'bearer',
          expires_in: 900,
        },
      },
    });
    const requestSpy = vi
      .spyOn(api, 'request')
      .mockResolvedValue({ data: 'ok' });

    const rejected = getRejectedHandler();
    const error = makeErrorWithConfig(401, '/employees');

    const result = await rejected(error);

    expect(postSpy).toHaveBeenCalledWith(API_ENDPOINTS.REFRESH);
    expect(memoryStorageMock.setItem).toHaveBeenCalledWith('new-token');
    expect(setStateMock).toHaveBeenCalledWith({
      token: 'new-token',
      isAuthenticated: true,
    });
    expect(error.config._isRetryAfterRefresh).toBe(true);
    expect(error.config.headers.Authorization).toBe('Bearer new-token');
    expect(requestSpy).toHaveBeenCalledWith(error.config);
    expect(result).toEqual({ data: 'ok' });
    expect(logoutMock).not.toHaveBeenCalled();

    postSpy.mockRestore();
    requestSpy.mockRestore();
  });

  it('refresh thất bại → logout + redirect /login, không retry', async () => {
    const postSpy = vi
      .spyOn(api, 'post')
      .mockRejectedValue(new Error('refresh failed'));
    const requestSpy = vi.spyOn(api, 'request');

    const rejected = getRejectedHandler();
    const error = makeErrorWithConfig(401, '/employees');

    await expect(rejected(error)).rejects.toBe(error);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(clearStorageMock).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(requestSpy).not.toHaveBeenCalled();

    postSpy.mockRestore();
    requestSpy.mockRestore();
  });

  it('hai 401 đồng thời → chỉ gọi /auth/refresh một lần (gom qua refreshPromise)', async () => {
    let resolvePost: (v: unknown) => void;
    const postSpy = vi.spyOn(api, 'post').mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }) as ReturnType<typeof api.post>,
    );
    const requestSpy = vi
      .spyOn(api, 'request')
      .mockResolvedValue({ data: 'ok' });

    const rejected = getRejectedHandler();
    const error1 = makeErrorWithConfig(401, '/employees');
    const error2 = makeErrorWithConfig(401, '/departments');

    const p1 = rejected(error1);
    const p2 = rejected(error2);

    resolvePost!({
      data: {
        success: true,
        data: {
          access_token: 'shared-token',
          token_type: 'bearer',
          expires_in: 900,
        },
      },
    });
    await Promise.all([p1, p2]);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledTimes(2);

    postSpy.mockRestore();
    requestSpy.mockRestore();
  });

  it('request đã retry vẫn 401 → không refresh vòng lặp, logout thẳng', async () => {
    const postSpy = vi.spyOn(api, 'post');
    const requestSpy = vi.spyOn(api, 'request');

    const rejected = getRejectedHandler();
    const error = makeErrorWithConfig(
      401,
      '/employees',
      {},
      {
        _isRetryAfterRefresh: true,
      },
    );

    await expect(rejected(error)).rejects.toBe(error);
    expect(postSpy).not.toHaveBeenCalled();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(ROUTES.LOGIN);

    postSpy.mockRestore();
    requestSpy.mockRestore();
  });

  it('login 401 không gọi refresh', async () => {
    const postSpy = vi.spyOn(api, 'post');

    const rejected = getRejectedHandler();
    const error = makeErrorWithConfig(401, API_ENDPOINTS.LOGIN);

    await expect(rejected(error)).rejects.toBe(error);
    expect(postSpy).not.toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledTimes(1);

    postSpy.mockRestore();
  });

  it('refresh endpoint 401 không tự refresh chính nó', async () => {
    const postSpy = vi.spyOn(api, 'post');

    const rejected = getRejectedHandler();
    const error = makeErrorWithConfig(401, API_ENDPOINTS.REFRESH);

    await expect(rejected(error)).rejects.toBe(error);
    expect(postSpy).not.toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledTimes(1);

    postSpy.mockRestore();
  });
});
