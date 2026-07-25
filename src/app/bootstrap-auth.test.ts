import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test riêng cho bootstrapAuth() (tách từ main.tsx) — đảm bảo khi refresh
 * lúc khởi động app thất bại (chưa login / refresh cookie hết hạn / lỗi
 * mạng), luồng bootstrap không redirect, không log lỗi ra console (noise),
 * và luôn kết thúc với `isBootstrapped: true` để ProtectedRoute không bị
 * treo ở trạng thái loading vĩnh viễn.
 */

const { rehydrateMock, setTokenMock, setStateMock } = vi.hoisted(() => ({
  rehydrateMock: vi.fn(),
  setTokenMock: vi.fn(),
  setStateMock: vi.fn(),
}));

vi.mock('@/shared/store/auth.store', () => ({
  useAuthStore: {
    persist: { rehydrate: rehydrateMock },
    getState: () => ({ setToken: setTokenMock }),
    setState: setStateMock,
  },
}));

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock('@/modules/auth/services/auth.service', () => ({
  authService: { refresh: refreshMock },
}));

import { bootstrapAuth } from '@/app/bootstrap-auth';

describe('bootstrapAuth', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleErrorSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleWarnSpy: any;

  beforeEach(() => {
    rehydrateMock.mockReset().mockResolvedValue(undefined);
    setTokenMock.mockReset();
    setStateMock.mockReset();
    refreshMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('refresh fail (chưa login) → không setToken, không log noise, vẫn set isBootstrapped: true', async () => {
    refreshMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Unauthenticated' } },
    });

    await bootstrapAuth();

    expect(setTokenMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(setStateMock).toHaveBeenCalledWith({ isBootstrapped: true });
  });

  it('refresh lỗi mạng (không phải 401) → vẫn im lặng, vẫn set isBootstrapped: true', async () => {
    refreshMock.mockRejectedValue(new Error('Network Error'));

    await bootstrapAuth();

    expect(setTokenMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(setStateMock).toHaveBeenCalledWith({ isBootstrapped: true });
  });

  it('refresh thành công → setToken với access_token mới, vẫn set isBootstrapped: true', async () => {
    refreshMock.mockResolvedValue({ access_token: 'new-token' });

    await bootstrapAuth();

    expect(setTokenMock).toHaveBeenCalledWith('new-token');
    expect(setStateMock).toHaveBeenCalledWith({ isBootstrapped: true });
  });

  it('rehydrate xong trước rồi mới gọi refresh (đảm bảo thứ tự)', async () => {
    const callOrder: string[] = [];
    rehydrateMock.mockImplementation(() => {
      callOrder.push('rehydrate');
    });
    refreshMock.mockImplementation(async () => {
      callOrder.push('refresh');
      return { access_token: 'tok' };
    });

    await bootstrapAuth();

    expect(callOrder).toEqual(['rehydrate', 'refresh']);
  });
});
