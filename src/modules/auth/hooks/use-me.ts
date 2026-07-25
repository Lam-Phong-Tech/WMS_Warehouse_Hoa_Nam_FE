import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authService } from '@/modules/auth/services/auth.service';
import { useAuthStore } from '@/shared/store/auth.store';

/**
 * Lấy hồ sơ + phân quyền của tài khoản hiện tại (GET /auth/me) và
 * đồng bộ vào store. Tự chạy khi có token (sau login & sau F5).
 *
 * Xử lý lỗi: nếu API /auth/me lỗi (mạng/401/500...), không giữ nguyên
 * loading vô hạn → sau 10 giây vẫn set isProfileLoaded = true để
 * người dùng thấy được menu (dù quyền rỗng), thay vì "trắng màn hình".
 */
export function useMe() {
  const token = useAuthStore((s) => s.token);
  const setProfile = useAuthStore((s) => s.setProfile);

  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.me(),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  useEffect(() => {
    if (query.data) {
      setProfile(query.data);
    }
  }, [query.data, setProfile]);

  // Fallback: nếu query lỗi (mạng/401/500...), sau 10s vẫn cho vào app
  // với quyền rỗng để tránh "trắng menu" vô hạn.
  useEffect(() => {
    if (query.isError && token) {
      const timer = setTimeout(() => {
        const store = useAuthStore.getState();
        if (!store.isProfileLoaded) {
          useAuthStore.setState({ isProfileLoaded: true });
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [query.isError, token]);

  return query;
}
