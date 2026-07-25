import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';

/**
 * Test "thật" cho refresh flow — khác với axios.test.ts (mock trực tiếp
 * `api.post`/`api.request`), test này dùng axios-mock-adapter để mock ở tầng
 * adapter: request đi qua TOÀN BỘ chain thật (request interceptor gắn
 * Authorization header, response interceptor bắt 401, gọi refresh, retry) —
 * chỉ tầng network (XHR/HTTP) là giả lập, giống hành vi thật khi access token
 * hết hạn + refresh cookie hợp lệ.
 */

const { setStateMock } = vi.hoisted(() => ({ setStateMock: vi.fn() }));

vi.mock('@/shared/store/auth.store', async () => {
  const actual = await vi.importActual<
    typeof import('@/shared/store/auth.store')
  >('@/shared/store/auth.store');
  return {
    ...actual,
    useAuthStore: {
      ...actual.useAuthStore,
      getState: () => ({ logout: vi.fn() }),
      persist: { clearStorage: vi.fn() },
      setState: setStateMock,
    },
  };
});

import { api } from '@/shared/api/axios';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { memoryStorage } from '@/shared/lib/memory-storage';

describe('axios refresh interceptor — integration (mock ở tầng HTTP adapter)', () => {
  let mock: MockAdapter;
  const originalLocation = window.location;

  beforeEach(() => {
    mock = new MockAdapter(api);
    setStateMock.mockReset();
    memoryStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/employees', assign: vi.fn() },
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('access token hết hạn (401) + refresh cookie hợp lệ → tự refresh rồi retry request gốc thành công', async () => {
    memoryStorage.setItem('expired-access-token');

    let employeesCallCount = 0;
    mock.onGet('/employees').reply((config) => {
      employeesCallCount += 1;
      // Lần đầu: token cũ (hết hạn) → BE trả 401.
      // Lần retry sau refresh: header phải mang token mới.
      if (config.headers?.Authorization === 'Bearer fresh-access-token') {
        return [
          200,
          { success: true, data: [{ id: 1, name: 'Nguyen Van A' }] },
        ];
      }
      return [401, { success: false, message: 'Token expired' }];
    });

    mock.onPost(API_ENDPOINTS.REFRESH).reply(200, {
      success: true,
      data: {
        access_token: 'fresh-access-token',
        token_type: 'bearer',
        expires_in: 900,
      },
    });

    const res = await api.get('/employees');

    expect(employeesCallCount).toBe(2);
    expect(res.status).toBe(200);
    expect(res.data.data).toEqual([{ id: 1, name: 'Nguyen Van A' }]);
    expect(memoryStorage.getToken()).toBe('fresh-access-token');
    expect(setStateMock).toHaveBeenCalledWith({
      token: 'fresh-access-token',
      isAuthenticated: true,
    });
  });

  it('access token hết hạn (401) + refresh cookie CŨNG hết hạn/invalid (refresh trả 401) → logout, redirect /login, không retry', async () => {
    memoryStorage.setItem('expired-access-token');

    mock.onGet('/employees').reply(401, {
      success: false,
      message: 'Token expired',
    });
    mock.onPost(API_ENDPOINTS.REFRESH).reply(401, {
      success: false,
      message: 'Refresh token invalid or expired',
    });

    await expect(api.get('/employees')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(window.location.assign).toHaveBeenCalledWith('/login');
    expect(memoryStorage.getToken()).toBe('expired-access-token'); // không bị ghi đè bởi token mới
  });

  it('nhiều request 401 đồng thời cùng lúc access token hết hạn → chỉ gọi /auth/refresh một lần, cả hai đều retry thành công', async () => {
    memoryStorage.setItem('expired-access-token');

    let refreshCallCount = 0;
    mock.onPost(API_ENDPOINTS.REFRESH).reply(() => {
      refreshCallCount += 1;
      return [
        200,
        {
          success: true,
          data: {
            access_token: 'fresh-access-token',
            token_type: 'bearer',
            expires_in: 900,
          },
        },
      ];
    });
    mock
      .onGet('/employees')
      .reply((config) =>
        config.headers?.Authorization === 'Bearer fresh-access-token'
          ? [200, { success: true, data: [] }]
          : [401, { success: false, message: 'Token expired' }],
      );
    mock
      .onGet('/departments')
      .reply((config) =>
        config.headers?.Authorization === 'Bearer fresh-access-token'
          ? [200, { success: true, data: [] }]
          : [401, { success: false, message: 'Token expired' }],
      );

    const [res1, res2] = await Promise.all([
      api.get('/employees'),
      api.get('/departments'),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(refreshCallCount).toBe(1);
  });
});
